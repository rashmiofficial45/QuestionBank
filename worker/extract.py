from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path
import re

import pymupdf as pdf
from pydantic import BaseModel

from document_layout import analyze_page, center, read_scanned_columns


QUESTION = re.compile(r"^(\d{1,3})[.)](?:\s+|$)(.*)$")
OCR_QUESTION = re.compile(r"^(\d{1,3})[,.:)](?:\s+|$)(.*)$")
OPTION = re.compile(r"^\(([A-Za-z])\)\s*(.*)$")
KEY_START = re.compile(
    r"(?<![\w.])(\d{1,3})(?:\s*[.):–-]\s*|\s+)"
    r"(?=\(?\s*(?:[A-Za-z]|true|false)\b(?:[\s),;&+]|/(?=[A-Za-z(])|$))",
    re.I,
)
KEY_LABEL = r"(?:\(\s*[A-Za-z]\s*\)|[A-Za-z])"
KEY_SEPARATOR = r"\s*(?:,\s*(?:and\b)?|[&+]|\band\b)\s*"
KEY_VALUE = re.compile(
    rf"(?:{KEY_LABEL}(?:{KEY_SEPARATOR}{KEY_LABEL})*|\(\s*[A-Za-z](?:{KEY_SEPARATOR}[A-Za-z])+\s*\))",
    re.I,
)
KEY_BOOLEAN = re.compile(r"(true|false)|\(\s*(true|false)\s*\)", re.I)
MAX_PAGES = 100
POLITY_TABLES = {6, 18, 23, 25, 27, 35, 39, 43, 47}


class Choice(BaseModel):
    id: str
    label: str
    text: str


@dataclass
class Line:
    page: int
    column: int
    box: pdf.Rect
    text: str


def open_paper(path: Path):
    doc = pdf.open(path)
    if not doc.is_pdf or doc.is_encrypted or not 1 <= len(doc) <= MAX_PAGES:
        doc.close()
        raise ValueError("Use an unencrypted PDF with 1–100 pages.")
    return doc


def read_layouts(doc, label, stage, *, include_tables=True):
    layouts = []
    for page in doc:
        stage(f"Reading {label} page {page.number + 1} of {len(doc)}")
        layouts.append(analyze_page(page, include_tables=include_tables))
    return layouts


def read_lines(doc, layouts, polity, stage):
    for page, layout in enumerate(layouts, start=1):
        buckets = [[], []] if polity else [[]]
        if polity and page == 1:
            continue
        lines = layout.lines
        if polity and layout.scanned and not doc[page - 1].rotation:
            stage(f"Resolving OCR reading order on paper page {page} of {len(doc)}")
            lines = read_scanned_columns(doc[page - 1])
        for box, text in lines:
            if polity and (box.y0 < 46 or box.y0 >= 795):
                continue
            column = int(polity and box.x0 >= 300)
            buckets[column].append(Line(page, column, box, text))
        for bucket in buckets:
            yield from sorted(bucket, key=lambda line: (round(line.box.y0, 1), line.box.x0))


def read_key(layouts):
    answers = defaultdict(set)
    for layout in layouts:
        for _, text in layout.lines:
            entries = list(KEY_START.finditer(text))
            for position, entry in enumerate(entries):
                next_entry = entries[position + 1] if position + 1 < len(entries) else None
                value = text[entry.end():next_entry.start() if next_entry else len(text)].strip()
                if next_entry:
                    value = value.rstrip(",; ")
                boolean = KEY_BOOLEAN.fullmatch(value)
                if boolean:
                    labels = [(boolean[1] or boolean[2]).lower()]
                else:
                    labels = re.findall(r"\b[a-z]\b", value.lower()) if KEY_VALUE.fullmatch(value) else []
                answer = frozenset(labels)
                answers[int(entry[1])].add(answer if 1 <= len(labels) == len(answer) <= 12 else None)
    return answers


def as_text(lines):
    if not lines:
        return ""
    chunks = [lines[0].text]
    for previous, line in zip(lines, lines[1:]):
        paragraph = (
            line.page != previous.page or line.column != previous.column
            or (line.box.y0 - previous.box.y0 > 25)
            or bool(re.match(r"^(?:\d+[.)]|Statement \d|Which |How many )", line.text))
        )
        chunks.append(("\n" if paragraph else " ") + line.text)
    return "".join(chunks).strip()


def crop_stem(doc, output, number, stem):
    regions = defaultdict(list)
    for line in stem:
        regions[(line.page, line.column)].append(line.box)
    crops = []
    for i, ((page_number, _), boxes) in enumerate(regions.items()):
        rect = pdf.Rect(boxes[0])
        for box in boxes[1:]:
            rect.include_rect(box)
        page = doc[page_number - 1]
        rect = pdf.Rect(rect.x0 - 4, rect.y0 - 3, rect.x1 + 5, rect.y1 + 2) & page.rect
        file = f"page-{number}-{i + 1}.png"
        if output:
            scale = min(2, 2200 / max(rect.width, rect.height, 1))
            page.get_pixmap(matrix=pdf.Matrix(scale, scale), clip=rect * page.rotation_matrix, alpha=False).save(output / file)
        crops.append(dict(id=f"source-{i + 1}", type="source_crop", page=page_number, file=file,
                          alt=f"Original prompt layout for question {number}, PDF page {page_number}"))
    return crops


def inside_table(line, box):
    # Use the line's center so glyphs from an adjacent prompt cannot move inside a cell.
    return box.contains(center(line.box))


def build_blocks(stem, layouts):
    tables = {}
    for line in stem:
        for index, table in enumerate(layouts[line.page - 1].tables):
            if inside_table(line, table.box):
                tables[(line.page, index)] = table
    if not tables:
        return [dict(id="stem", type="paragraph", text=as_text(stem))]
    blocks = []
    text_lines = []
    emitted = set()

    def flush():
        if text_lines:
            blocks.append(dict(id=f"stem-{len(blocks) + 1}", type="paragraph", text=as_text(text_lines)))
            text_lines.clear()

    for line in stem:
        match = next(((key, table) for key, table in tables.items() if key[0] == line.page
                      and inside_table(line, table.box)), None)
        if not match:
            text_lines.append(line)
        elif match[0] not in emitted:
            flush()
            key, table = match
            emitted.add(key)
            blocks.append(dict(id=f"table-{key[0]}-{key[1] + 1}", type="table", page=line.page,
                               bounds=list(table.box), headers=table.headers, rows=table.rows))
    flush()
    return blocks


def extract(paper: Path, key: Path, output: Path | None = None, stage=lambda _: None):
    stage("Reading paper layout and answer key")
    with open_paper(paper) as doc, open_paper(key) as key_doc:
        layouts = read_layouts(doc, "paper", stage)
        key_layouts = read_layouts(key_doc, "answer key", stage, include_tables=False)
        cover = " ".join(text for _, text in layouts[0].lines)
        masthead = " ".join(text for box, text in layouts[1].lines if box.y0 < 46 or box.y0 > 795) if len(doc) > 1 else ""
        polity = (
            len(doc) == 13
            and "polity" in cover.lower()
            and "vajiram" in masthead.lower()
            and bool(re.search(r"polity\s*[-–]\s*pt\s*[-–]\s*01\b", masthead, re.I))
        )
        answers = read_key(key_layouts)
        segments = []
        current = None
        lines = list(read_lines(doc, layouts, polity, stage))
        if not lines:
            raise ValueError("No legible question text was recognized in this PDF.")
        if len(lines) > 25000:
            raise ValueError("Document exceeds the MVP text-processing limit.")
        left = min((line.box.x0 for line in lines if QUESTION.match(line.text)), default=0)
        for line in lines:
            pattern = OCR_QUESTION if layouts[line.page - 1].scanned else QUESTION
            match = pattern.match(line.text)
            margin = (304 if line.column else 28) if polity else left
            if match and abs(line.box.x0 - margin) <= 5:
                current = (int(match[1]), line.page, [])
                segments.append(current)
                if match[2]:
                    current[2].append(Line(line.page, line.column, line.box, match[2]))
            elif current:
                current[2].append(line)
        if not segments:
            raise ValueError("No numbered questions were found in a supported layout.")
        numbering = [number for number, _, _ in segments]
        if len(numbering) != len(set(numbering)):
            raise ValueError("Repeated question numbers made the source ambiguous.")
        global_issues = []
        if numbering != sorted(answers):
            global_issues.append("Question numbering and the answer key differ. Verify the paper against the source.")
        if not polity:
            global_issues.append("Layout has no verified profile. Compare the draft with the source before publishing.")
        stage("Mapping answers and validating drafts")
        items = []
        for number, page, content in segments:
            stem = []
            options = []
            for line in content:
                marker = OPTION.match(line.text)
                option_margin = (328 if line.column else 52) if polity else None
                if marker and (option_margin is None or abs(line.box.x0 - option_margin) <= 5):
                    options.append((marker[1].lower(), [Line(line.page, line.column, line.box, marker[2])]))
                elif options:
                    options[-1][1].append(line)
                else:
                    stem.append(line)
            choices = [Choice(id=letter, label=letter.upper(), text=as_text(parts)).model_dump() for letter, parts in options]
            option_ids = {option["id"] for option in choices}
            boolean_options = {option["text"].strip().lower(): option["id"] for option in choices}
            is_boolean = len(choices) == len(option_ids) == 2 and boolean_options.keys() == {"true", "false"}
            candidates = answers[number]
            if is_boolean:
                candidates = {
                    frozenset(boolean_options.get(label, label) for label in candidate) if candidate else None
                    for candidate in candidates
                }
            selected = next(iter(candidates)) if len(candidates) == 1 else None
            interaction = "true_false" if is_boolean else "single_choice"
            answer = None
            issues = list(global_issues)
            page_layouts = [layouts[index - 1] for index in {page, *(line.page for line in content)}]
            if any(layout.scanned for layout in page_layouts):
                issues.append("Question text was read using OCR. Verify it against the source page.")
                if any(layout.uncertain_words for layout in page_layouts):
                    issues.append("OCR detected low-confidence words on a source page.")
            if any(layout.scanned for layout in key_layouts):
                issues.append("The answer key was read using OCR. Verify the selected answer against the key.")
            if not selected or not selected.issubset(option_ids) or (is_boolean and len(selected) != 1):
                issues.append("Missing or conflicting official answer.")
            elif len(selected) == 1:
                answer = next(iter(selected))
            else:
                interaction = "multiple_choice"
                answer = [option["id"] for option in choices if option["id"] in selected]
                issues.append("The key lists multiple correct options. Verify the full answer set against the source.")
            if len(choices) < 2 or len(option_ids) != len(choices) or any(not c["text"] for c in choices):
                issues.append("Option boundaries need review.")
            if polity and [choice["id"] for choice in choices] != list("abcd"):
                issues.append("Expected four options in source order.")
            if not as_text(stem):
                issues.append("Question text is missing.")
            blocks = build_blocks(stem, layouts)
            structured = any(block["type"] == "table" for block in blocks)
            unresolved = any(inside_table(line, box) for line in stem
                             for box in layouts[line.page - 1].unresolved_tables or [])
            if unresolved or (polity and number in POLITY_TABLES and not structured):
                issues.append("A table could not be structured safely. Compare the original layout before publishing.")
            if stem and (structured or unresolved or (polity and number in POLITY_TABLES) or any(layout.scanned for layout in page_layouts)):
                crops = crop_stem(doc, output, number, stem)
                if not unresolved and (structured or any(layout.scanned for layout in page_layouts)):
                    for crop in crops:
                        crop["reference"] = True
                blocks.extend(crops)
            items.append((number, page, dict(version=1, interaction=interaction, blocks=blocks,
                                              options=choices, answer=answer, explanation=""), issues))
        return items

from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path
import re

import pymupdf as pdf
from pydantic import BaseModel


QUESTION = re.compile(r"^(\d{1,3})[.)](?:\s+|$)(.*)$")
OPTION = re.compile(r"^\(([A-Za-z])\)\s*(.*)$")
KEY = re.compile(r"(?<![\w.])(\d{1,3})\s*(?:[.):–-]\s*|\s+)\(?([A-Za-z])\)?(?=\s|$)")
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


def raw_lines(page):
    flags = pdf.TEXTFLAGS_DICT & ~pdf.TEXT_PRESERVE_IMAGES
    for block in page.get_text("dict", flags=flags)["blocks"]:
        for line in block.get("lines", []):
            text = "".join(span["text"] for span in line["spans"]).strip()
            if text:
                yield pdf.Rect(line["bbox"]), text


def read_lines(doc, polity):
    for page in doc:
        buckets = [[], []] if polity else [[]]
        if polity and page.number == 0:
            continue
        for box, text in raw_lines(page):
            if polity and (box.y0 < 46 or box.y0 >= 795):
                continue
            column = int(polity and box.x0 >= 300)
            buckets[column].append(Line(page.number + 1, column, box, text))
        for bucket in buckets:
            yield from sorted(bucket, key=lambda line: (round(line.box.y0, 1), line.box.x0))


def read_key(doc):
    answers = defaultdict(set)
    for page in doc:
        for _, text in raw_lines(page):
            for match in KEY.finditer(text):
                answers[int(match[1])].add(match[2].lower())
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
            page.get_pixmap(matrix=pdf.Matrix(2, 2), clip=rect, alpha=False).save(output / file)
        crops.append(dict(id=f"source-{i + 1}", type="source_crop", page=page_number, file=file,
                          alt=f"Original prompt layout for question {number}, PDF page {page_number}"))
    return crops


def extract(paper: Path, key: Path, output: Path | None = None, stage=lambda _: None):
    stage("Reading paper layout and answer key")
    with open_paper(paper) as doc, open_paper(key) as key_doc:
        polity = (
            len(doc) == 13 and "Polity" in doc[0].get_text()
            and "Test-Polity-PT - 01" in doc[1].get_text()
            and "Vajiram" in doc[1].get_text()
        )
        answers = read_key(key_doc)
        segments = []
        current = None
        lines = list(read_lines(doc, polity))
        if not lines:
            raise ValueError("No native text was found. This PDF needs OCR.")
        if len(lines) > 25000:
            raise ValueError("Document exceeds the MVP text-processing limit.")
        left = min((line.box.x0 for line in lines if QUESTION.match(line.text)), default=0)
        for line in lines:
            match = QUESTION.match(line.text)
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
            candidates = answers[number]
            answer = next(iter(candidates)) if len(candidates) == 1 else None
            issues = list(global_issues)
            if not answer or answer not in {option["id"] for option in choices}:
                issues.append("Missing or conflicting official answer.")
                answer = None
            if len(choices) < 2 or len({choice["id"] for choice in choices}) != len(choices) or any(not c["text"] for c in choices):
                issues.append("Option boundaries need review.")
            if polity and [choice["id"] for choice in choices] != list("abcd"):
                issues.append("Expected four options in source order.")
            text = as_text(stem)
            if not text:
                issues.append("Question text is missing.")
            blocks = [dict(id="stem", type="paragraph", text=text)]
            if polity and number in POLITY_TABLES and stem:
                blocks.extend(crop_stem(doc, output, number, stem))
            items.append((number, page, dict(version=1, interaction="single_choice", blocks=blocks,
                                              options=choices, answer=answer, explanation=""), issues))
        return items

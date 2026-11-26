from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path
import re
from contextlib import nullcontext

import pymupdf as pdf
from pydantic import BaseModel

from document_layout import analyze_page, center, Layout, read_scanned_columns
from layout_cache import page_layout
from detailed_answers import read_detailed_answers, render_solution


QUESTION = re.compile(r"^(\d{1,3})[.)](?:\s+|$)(.*)$")
OCR_QUESTION = re.compile(r"^(\d{1,3})[,.:)](?:\s+|$)(.*)$")
OPTION = re.compile(r"^\(([A-Za-z])\)\s*(.*)$")
GENERIC_OPTION = re.compile(r"^(?:\(([A-Za-z0-9]{1,4})\)\s*|([A-Za-z0-9]{1,4})[.)](?:\s+|$))(.*)$")
SECTION = re.compile(r"^(?:section|part)\s+([a-z]|[ivx]{1,4}|\d{1,2})(?:\s*[:.\-–]\s*.*)?$", re.I)
BOOKLET = re.compile(r"^(?:Test\s+)?Booklet(?:\s+(?:Series|Code|Variant))?\s*[:–-]?\s+([A-Z0-9]{1,4})\s*$", re.I)
OPTIONS_HEADING = re.compile(r"^(?:options|choices)\s*:?$", re.I)
PASSAGE = re.compile(r"^(?:passage|comprehension)\s+(?:for questions|questions)\s+(\d{1,3})\s*[-–]\s*(\d{1,3})\s*:?\s*(.*)$", re.I)
EXPLANATION = re.compile(r"^(?:Explanation\s+(\d{1,3})\s*:|(?:Question\s+)?(\d{1,3})[.)]\s+Explanation\s*:)\s*(.*)$", re.I)
ANSWER_KEY_HEADING = re.compile(r"^answer\s+key\s*:?$", re.I)
PAPER_CODE = re.compile(r"\bPT\s*[-–—]\s*(\d+)\b", re.I)
STATEMENT = re.compile(
    r"^(?P<label>(?P<prefix>Statement[ \t]+)?(?:\((?P<wrapped>\d{1,2}|[IVX]+)\)|"
    r"(?P<bare>\d{1,2}|[IVX]+)[.):]))[ \t]+(?P<text>\S.*)$",
    re.I,
)
ROMAN_ORDINALS = dict(zip(("I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"), range(1, 11)))
ASSERTION_REASON = re.compile(
    r"^(?P<label>(?P<kind>Assertion|Reason)(?:[ \t]*\([AR]\))?[ \t]*[:–-])[ \t]*(?P<text>.*)$",
    re.I,
)
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


def read_layouts(doc, label, stage, *, include_tables=True, checkpoint=None):
    layouts = []
    for page in doc:
        stage(f"Reading {label} page {page.number + 1} of {len(doc)}")
        layouts.append(page_layout(checkpoint, label.replace(" ", "-"), page.number,
                                   lambda: analyze_page(page, include_tables=include_tables)))
    return layouts


def column_margins(page, layout):
    if page.rotation:
        return None
    midpoint = page.rect.width / 2
    pattern = OCR_QUESTION if layout.scanned else QUESTION
    anchors = [box.x0 for box, text in layout.lines if pattern.match(text)]
    left = min((x for x in anchors if x < midpoint), default=None)
    right = min((x for x in anchors if x >= midpoint), default=None)
    if left is None or right is None or right - left < page.rect.width * .32:
        return None
    return left, right


def read_lines(doc, layouts, polity, stage, columns, checkpoint):
    for page, layout in enumerate(layouts, start=1):
        split = 300 if polity else columns[page][1] - 8 if page in columns else None
        buckets = [[], []] if split is not None else [[]]
        if polity and page == 1:
            continue
        lines = layout.lines
        if polity and layout.scanned and not doc[page - 1].rotation:
            stage(f"Resolving OCR reading order on paper page {page} of {len(doc)}")
            lines = page_layout(checkpoint, "polity-columns", page,
                                lambda: Layout(read_scanned_columns(doc[page - 1]), [], scanned=True)).lines
        if split is not None and not polity:
            lines = sorted(lines, key=lambda pair: (round(pair[0].y0, 1), pair[0].x0))
        for box, text in lines:
            if split is not None and not polity and (box.x0 < split < box.x1 or SECTION.fullmatch(text)):
                for bucket in buckets:
                    yield from bucket
                    bucket.clear()
                yield Line(page, 0, box, text)
                continue
            if polity and (box.y0 < 46 or box.y0 >= 795):
                continue
            column = int(split is not None and box.x0 >= split)
            buckets[column].append(Line(page, column, box, text))
        for bucket in buckets:
            yield from sorted(bucket, key=lambda line: (round(line.box.y0, 1), line.box.x0))


def special_option(value):
    if value.isdecimal() and 1 <= int(value) <= 99:
        return "numeric", int(value)
    if value.upper() in ROMAN_ORDINALS:
        return "roman", ROMAN_ORDINALS[value.upper()]
    return None


def booklet_labels(layouts):
    return {marker[1].upper() for layout in layouts for _, text in layout.lines
            if (marker := BOOKLET.fullmatch(text))}


def read_key(layouts, booklet=None):
    answers = defaultdict(set)
    section = ""
    variants = booklet_labels(layouts)
    current_booklet = None
    if variants and booklet is None:
        return answers
    for layout in layouts:
        for _, text in layout.lines:
            if marker := BOOKLET.fullmatch(text):
                current_booklet, section = marker[1].upper(), ""
                continue
            if variants and current_booklet != booklet:
                continue
            if marker := SECTION.fullmatch(text):
                section = marker[1].casefold()
                continue
            row = re.fullmatch(r"(\d{1,3})[.) :–-]+(.+)", text)
            if row:
                value = row[2].strip().strip("()")
                labels = [part.strip().strip("()").lower() for part in re.split(KEY_SEPARATOR, value)]
                if all(special_option(label) for label in labels):
                    choice = frozenset(labels)
                    answers[(section, int(row[1]))].add(choice if len(choice) == len(labels) <= 12 else None)
                    continue
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
                answers[(section, int(entry[1]))].add(answer if 1 <= len(labels) == len(answer) <= 12 else None)
    return answers


def read_explanations(path, stage, checkpoint):
    entries = defaultdict(list)
    current = None
    scanned = False
    section = ""
    numbered = False
    with open_paper(path) as doc:
        for layout in read_layouts(doc, "explanations", stage, include_tables=False, checkpoint=checkpoint):
            scanned |= layout.scanned
            for _, text in sorted(layout.lines, key=lambda line: (line[0].y0, line[0].x0)):
                if marker := SECTION.fullmatch(text):
                    section, current = marker[1].casefold(), None
                elif re.fullmatch(r"(?:answer\s+)?explanations\s*:?", text, re.I):
                    numbered = True
                    current = None
                elif marker := EXPLANATION.match(text):
                    current = [marker[3]]
                    entries[(section, int(marker[1] or marker[2]))].append(current)
                elif numbered and (marker := QUESTION.match(text)):
                    current = [marker[2]]
                    entries[(section, int(marker[1]))].append(current)
                elif QUESTION.match(text):
                    current = None
                elif current is not None:
                    current.append(text)
    return entries, scanned


def statement_marker(line):
    marker = STATEMENT.match(line)
    if not marker:
        return None
    ordinal = marker["wrapped"] or marker["bare"]
    numeric = ordinal.isdecimal()
    number = int(ordinal) if numeric else ROMAN_ORDINALS.get(ordinal.upper(), 0)
    if number > 0:
        return number, (bool(marker["prefix"]), numeric), dict(label=marker["label"], text=marker["text"])
    return None


def structure_statements(block):
    if block["type"] != "paragraph":
        return [block]
    lines = block["text"].split("\n")
    markers = [statement_marker(line) for line in lines]
    start = 0
    index = 0
    parts = []

    def add_paragraph(end):
        text = "\n".join(lines[start:end]).strip()
        if text:
            parts.append(dict(id=f"{block['id']}-part-{len(parts) + 1}", type="paragraph", text=text))

    while index + 1 < len(lines):
        first, second = markers[index:index + 2]
        if not first or not second or first[0] != 1 or second[:2] != (2, first[1]):
            index += 1
            continue
        add_paragraph(index)
        items = [first[2], second[2]]
        index += 2
        while index < len(lines) and (marker := markers[index]) and marker[:2] == (len(items) + 1, first[1]):
            items.append(marker[2])
            index += 1
        parts.append(dict(id=f"{block['id']}-part-{len(parts) + 1}", type="statements", items=items))
        start = index
    if not parts:
        return [block]
    add_paragraph(len(lines))
    return parts


def structure_assertion_reason(block):
    if block["type"] != "paragraph":
        return [block]
    lines = block["text"].split("\n")
    for index, (first, second) in enumerate(zip(lines, lines[1:])):
        assertion = ASSERTION_REASON.match(first)
        reason = ASSERTION_REASON.match(second)
        if (not assertion or not reason or assertion["kind"].lower() != "assertion"
                or reason["kind"].lower() != "reason" or not assertion["text"] or not reason["text"]):
            continue

        parts = [dict(id=f"{block['id']}-pair", type="assertion_reason",
                      assertion=dict(label=assertion["label"], text=assertion["text"]),
                      reason=dict(label=reason["label"], text=reason["text"]))]
        if before := "\n".join(lines[:index]).strip():
            parts.insert(0, dict(id=f"{block['id']}-before-pair", type="paragraph", text=before))
        if after := "\n".join(lines[index + 2:]).strip():
            parts.append(dict(id=f"{block['id']}-after-pair", type="paragraph", text=after))
        return parts
    return [block]


def as_text(lines):
    if not lines:
        return ""
    chunks = [lines[0].text]
    for previous, line in zip(lines, lines[1:]):
        paragraph = (
            line.page != previous.page or line.column != previous.column
            or (line.box.y0 - previous.box.y0 > 25)
            or statement_marker(line.text) is not None
            or ASSERTION_REASON.match(line.text) is not None
            or bool(re.match(r"^(?:\d+[.)]|Statement \d|Which |How many |Select the |Choose the |In the light of )", line.text))
        )
        chunks.append(("\n" if paragraph else " ") + line.text)
    return "".join(chunks).strip()


def source_regions(lines):
    boxes = {}
    for line in lines:
        key = line.page, line.column
        if key in boxes:
            boxes[key].include_rect(line.box)
        else:
            boxes[key] = pdf.Rect(line.box)
    return [dict(page=page, bounds=list(bounds)) for (page, _), bounds in boxes.items()]


def crop_stem(doc, output, number, stem, images=None):
    regions = defaultdict(list)
    for line in stem:
        regions[(line.page, line.column)].append(line.box)
    for region, boxes in (images or {}).items():
        regions[region].extend(boxes)
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


def embedded_prompt_images(stem, options, page_images, polity):
    regions = defaultdict(list)
    for line in stem:
        regions[(line.page, line.column)].append(line.box)
    first_option = options[0][1][0] if options else None
    images = {}
    for (page, column), boxes in regions.items():
        top = min(box.y0 for box in boxes)
        bottom = max(box.y1 for box in boxes)
        if first_option and (first_option.page, first_option.column) == (page, column):
            bottom = first_option.box.y0
        for image in page_images.get(page, []):
            # The verified Polity layout places question content inside one column.
            # Page-wide overlays such as the repeated watermark are not prompt images.
            within_column = not polity or (image.x0 >= 300 if column else image.x1 <= 300)
            if top <= image.y0 and image.y1 <= bottom and within_column:
                images.setdefault((page, column), []).append(image)
    return images


def option_images(doc, output, number, marker, next_marker, images, boundary, option_index):
    bottom = marker.box.y1 + 60
    if next_marker and (next_marker.page, next_marker.column) == (marker.page, marker.column):
        bottom = next_marker.box.y0
    blocks = []
    for image in images:
        same_column = boundary is None or (image.x0 >= boundary if marker.column else image.x1 <= boundary)
        if not same_column or image.y0 < marker.box.y0 - 3 or image.y1 > bottom:
            continue
        page = doc[marker.page - 1]
        rect = image & page.rect
        if rect.is_empty or len(blocks) == 5:
            continue
        index = len(blocks) + 1
        file = f"page-{number}-{100 + option_index * 10 + index}.png"
        if output:
            scale = min(2, 2200 / max(rect.width, rect.height, 1))
            page.get_pixmap(matrix=pdf.Matrix(scale, scale), clip=rect, alpha=False).save(output / file)
        blocks.append(dict(id=f"image-{index}", type="source_crop", page=marker.page, file=file,
                           alt=f"Source image {index} for option {option_index + 1}, page {marker.page}"))
    return blocks


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
                               bounds=list(table.box), headers=table.headers, rows=table.rows,
                               **({"spans": table.spans} if table.spans else {})))
    flush()
    return blocks


def extract(paper: Path, key: Path | None, output: Path | None = None, stage=lambda _: None, *, explanation: Path | None = None, detailed: Path | None = None, checkpoint: Path | None = None):
    stage("Reading paper layout and answer key")
    with (open_paper(paper) as doc,
          (open_paper(key) if key else nullcontext()) as key_doc,
          (open_paper(detailed) if detailed else nullcontext()) as detailed_doc):
        layouts = read_layouts(doc, "paper", stage, checkpoint=checkpoint)
        key_start = next((index for index, layout in enumerate(layouts[1:], 1)
                          if layout.lines and ANSWER_KEY_HEADING.fullmatch(layout.lines[0][1])), None)
        embedded_key = layouts[key_start:] if key_start else []
        if key_start:
            layouts = layouts[:key_start]
        detailed_solutions = {}
        detailed_layouts = []
        detailed_key_scanned = False
        if detailed_doc is not None:
            detailed_pages = read_layouts(detailed_doc, "detailed answers", stage, include_tables=False, checkpoint=checkpoint)
            paper_code = PAPER_CODE.search(" ".join(text for _, text in layouts[0].lines))
            solution_code = PAPER_CODE.search(" ".join(text for _, text in detailed_pages[0].lines)) if detailed_pages else None
            if paper_code and solution_code and int(paper_code[1]) != int(solution_code[1]):
                raise ValueError("The paper code on the detailed answer PDF differs from the question paper.")
            detailed_layouts, detailed_solutions = read_detailed_answers(detailed_doc, detailed_pages)
            detailed_key_scanned = any(layout.scanned and layout.lines for layout in detailed_layouts)
        if key_doc is not None:
            key_layouts = read_layouts(key_doc, "answer key", stage, include_tables=False, checkpoint=checkpoint)
        elif detailed_doc is not None:
            key_layouts = detailed_layouts
        else:
            if not embedded_key:
                raise ValueError("For a combined PDF, place an Answer Key heading at the start of a separate page, or upload a separate answer key.")
            key_layouts = embedded_key
        cover = " ".join(text for _, text in layouts[0].lines)
        masthead = " ".join(text for box, text in layouts[1].lines if box.y0 < 46 or box.y0 > 795) if len(layouts) > 1 else ""
        polity = (
            len(layouts) == 13
            and "polity" in cover.lower()
            and "vajiram" in masthead.lower()
            and bool(re.search(r"polity\s*[-–]\s*pt\s*[-–]\s*01\b", masthead, re.I))
        )
        paper_variants = booklet_labels(layouts)
        key_variants = booklet_labels(key_layouts)
        booklet = next(iter(paper_variants)) if len(paper_variants) == 1 else None
        answers = read_key(key_layouts, booklet)
        detailed_key = read_key(detailed_layouts, booklet) if detailed_doc is not None else {}
        page_images = {}
        for page, layout in zip(doc, layouts):
            if layout.scanned or page.rotation:
                continue
            boxes = [pdf.Rect(item["bbox"]) for item in page.get_image_info()]
            if not polity:
                table_bounds = [table.box for table in layout.tables] + (layout.unresolved_tables or [])
                boxes.extend(box for box in page.cluster_drawings(x_tolerance=8, y_tolerance=8)
                             if not any(table.intersects(box) for table in table_bounds))
            page_images[page.number + 1] = [
                box for box in boxes if box.width >= 32 and box.height >= 32 and box.get_area() < page.rect.get_area() * 0.7
            ]
        segments = []
        current = None
        columns = {} if polity else {
            page.number + 1: margins for page, layout in zip(doc, layouts)
            if (margins := column_margins(page, layout))
        }
        lines = list(read_lines(doc, layouts, polity, stage, columns, checkpoint))
        if not lines:
            raise ValueError("No legible question text was recognized in this PDF.")
        if len(lines) > 25000:
            raise ValueError("Document exceeds the text-processing limit.")
        anchors = defaultdict(list)
        for line in lines:
            marker = OCR_QUESTION if layouts[line.page - 1].scanned else QUESTION
            if not line.column and marker.match(line.text):
                anchors[line.page].append(line.box.x0)
        left = min((x for margin in anchors.values() for x in margin), default=0)
        page_left = {page: left if any(abs(x - left) <= 5 for x in margins) else min(margins)
                     for page, margins in anchors.items()}
        section = ""
        passages = []
        active_passage = None
        for line in lines:
            if not polity and BOOKLET.fullmatch(line.text):
                continue
            if not polity and (marker := SECTION.fullmatch(line.text)):
                section, current, active_passage = marker[1].casefold(), None, None
                continue
            if not polity and (marker := PASSAGE.match(line.text)):
                active_passage = (section, int(marker[1]), int(marker[2]), [marker[3]])
                passages.append(active_passage)
                current = None
                continue
            pattern = OCR_QUESTION if layouts[line.page - 1].scanned else QUESTION
            match = pattern.match(line.text)
            margin = (304 if line.column else 28) if polity else columns.get(line.page, (page_left.get(line.page, left),))[line.column]
            if match and abs(line.box.x0 - margin) <= 5:
                current = ((section, int(match[1])), line.page, [])
                active_passage = None
                segments.append(current)
                if match[2]:
                    current[2].append(Line(line.page, line.column, line.box, match[2]))
            elif current:
                current[2].append(line)
            elif active_passage is not None:
                active_passage[3].append(line.text)
        if not segments:
            raise ValueError("No numbered questions were found in a supported layout.")
        numbering = [number for number, _, _ in segments]
        if len(numbering) != len(set(numbering)):
            raise ValueError("Repeated question numbers made the source ambiguous.")
        global_issues = []
        if key_variants and booklet not in key_variants:
            global_issues.append("The answer key booklet could not be matched to the question paper.")
        if set(numbering) != set(answers):
            global_issues.append("Question numbering and the answer key differ. Verify the paper against the source.")
        if not polity:
            global_issues.append("Layout has no verified profile. Compare the draft with the source before publishing.")
        if not key and not detailed:
            global_issues.append("The answer key came from the combined PDF. Verify the answers before publishing.")
        if detailed_doc is not None:
            if set(detailed_solutions) != {number for _, number in numbering}:
                global_issues.append("Detailed explanation numbering does not match the question paper.")
            if any(layout.scanned for layout in detailed_pages):
                global_issues.append("Detailed answer headings were read using OCR. Verify the key and explanation crops.")
        explanations = {}
        if explanation:
            try:
                explanations, scanned_explanations = read_explanations(explanation, stage, checkpoint)
                if scanned_explanations:
                    global_issues.append("Explanations were read using OCR. Verify the imported text against its source.")
                if not explanations or explanations.keys() - set(numbering):
                    global_issues.append("Some numbered explanations could not be matched. Compare the explanation PDF before publishing.")
            except (ValueError, pdf.FileDataError):
                global_issues.append("The optional explanation PDF could not be read. Compare it with the drafts before publishing.")
        stage("Mapping answers and validating drafts")
        items = []
        renumber = len({number for _, number in numbering}) != len(numbering)
        for segment_index, (source, page, content) in enumerate(segments):
            section, original_number = source
            number = segment_index + 1 if renumber else original_number
            stem = []
            options = []
            option_kind = None
            explicit_options = False
            for line in content:
                if not polity and OPTIONS_HEADING.fullmatch(line.text):
                    explicit_options = True
                    continue
                marker = (OPTION if polity else GENERIC_OPTION).match(line.text)
                option_margin = (328 if line.column else 52) if polity else None
                if marker and not polity:
                    label = marker[1] or marker[2]
                    special = special_option(label)
                    if special and (option_kind in ("numeric", "roman") or not options):
                        kind, ordinal = special
                        indented = line.box.x0 > (content[0].box.x0 + 4)
                        if ordinal != len(options) + 1 or (not options and not (explicit_options or indented or (kind == "numeric" and marker[1]))):
                            marker = None
                        elif option_kind is None:
                            option_kind = kind
                    elif len(label) != 1 or option_kind in ("numeric", "roman"):
                        marker = None
                    else:
                        option_kind = "alphabetic"
                if marker and (option_margin is None or abs(line.box.x0 - option_margin) <= 5):
                    letter, text = (marker[1], marker[2]) if polity else (marker[1] or marker[2], marker[3])
                    options.append((letter.lower(), [Line(line.page, line.column, line.box, text)]))
                elif options:
                    options[-1][1].append(line)
                else:
                    stem.append(line)
            choices = [Choice(id=letter, label=letter.upper(), text=as_text(parts)).model_dump() for letter, parts in options]
            # A generic option needs a clear visual region bounded by its source marker.
            if not polity:
                for index, (choice, (_, parts)) in enumerate(zip(choices, options)):
                    marker = parts[0]
                    next_marker = options[index + 1][1][0] if index + 1 < len(options) else None
                    if next_marker is None and segment_index + 1 < len(segments):
                        next_marker = next(iter(segments[segment_index + 1][2]), None)
                    boundary = columns[marker.page][1] - 8 if marker.page in columns else None
                    blocks = option_images(doc, output, number, marker, next_marker,
                                           page_images.get(marker.page, []), boundary, index)
                    if blocks:
                        choice["blocks"] = blocks
                        choice["text"] = choice["text"] or f"Image option {choice['label']}"
            option_ids = {option["id"] for option in choices}
            boolean_options = {option["text"].strip().lower(): option["id"] for option in choices}
            is_boolean = len(choices) == len(option_ids) == 2 and boolean_options.keys() == {"true", "false"}
            candidates = answers[source]
            detail_issues = []
            answer_crops = []
            if detailed_doc is not None:
                matched = detailed_solutions.get(original_number, [])
                solution = matched[0] if len(matched) == 1 and not section else None
                official = detailed_key.get(source, set())
                if solution:
                    answer_crops = render_solution(detailed_doc, output, number, solution.crops)
                    marker = f"{original_number}. {solution.answer}"
                    inline = read_key([type(key_layouts[0])([(pdf.Rect(), marker)], [])]).get(("", original_number), set())
                    if detailed_key_scanned:
                        allowed_labels = option_ids | (boolean_options.keys() if is_boolean else set())
                        official = {entry for entry in official if entry and entry.issubset(allowed_labels)}
                        if not official:
                            detail_issues.append("The scanned key entry is unreadable. Verify the answer from the detailed explanation against the original PDF.")
                            official = inline
                        if key_doc is None:
                            candidates = official
                    if len(inline) != 1 or None in inline or inline != official or candidates != official:
                        detail_issues.append("The answer key and detailed answer disagree or are incomplete. Verify the correct option against the PDFs.")
                        candidates = set()
                    if not solution.explained or not solution.crops or solution.incomplete:
                        detail_issues.append("The detailed explanation region needs verification.")
                else:
                    detail_issues.append("No unique detailed explanation was mapped to this question.")
                    candidates = set()

            if is_boolean:
                candidates = {
                    frozenset(boolean_options.get(label, label) for label in candidate) if candidate else None
                    for candidate in candidates
                }
            selected = next(iter(candidates)) if len(candidates) == 1 else None
            interaction = "true_false" if is_boolean else "single_choice"
            answer = None
            issues = [*global_issues, *detail_issues]
            explanation_text = ""
            if entries := explanations.get(source):
                text = "\n".join(entries[0]).strip()
                if len(entries) == 1 and 0 < len(text) <= 8000:
                    explanation_text = text
                    issues.append("Verify the imported explanation against its source.")
                else:
                    issues.append("The explanation is ambiguous, empty, or too long. Review the source PDF.")
            source_pages = {page, *(line.page for line in content)}
            page_layouts = [layouts[index - 1] for index in source_pages]
            inferred_columns = any(index in columns for index in source_pages)
            if inferred_columns:
                issues.append("An inferred two-column reading order needs source verification.")
            if any(choice.get("blocks") for choice in choices):
                issues.append("Answer options include source images. Verify each image and its description before publishing.")
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
            for group, first, last, parts in passages:
                if group == section and first <= original_number <= last and (text := "\n".join(parts).strip()):
                    blocks.insert(0, dict(id="shared-passage", type="paragraph", style="passage", text=text))
                    break
            blocks = [part for block in blocks for part in structure_assertion_reason(block)]
            blocks = [part for block in blocks for part in structure_statements(block)]
            structured = any(block["type"] == "table" for block in blocks)
            images = embedded_prompt_images(stem, options, page_images, polity)
            visual_regions = defaultdict(list, images)
            unresolved = False
            for line in stem:
                layout = layouts[line.page - 1]
                for box in layout.unresolved_tables or []:
                    if inside_table(line, box):
                        unresolved = True
                        visual_regions[(line.page, line.column)].append(box)
                for table in layout.tables:
                    if inside_table(line, table.box):
                        visual_regions[(line.page, line.column)].append(table.box)
            if unresolved or (polity and number in POLITY_TABLES and not structured):
                issues.append("A table could not be structured safely. Compare the original layout before publishing.")
            visual_math = not polity and any(re.search(r"[∫∑√≈≠≤≥]", line.text) for line in stem)
            if visual_math:
                issues.append("Check mathematical notation against the original PDF region.")
            if stem and (images or visual_math or structured or unresolved or inferred_columns or (polity and number in POLITY_TABLES) or any(layout.scanned for layout in page_layouts)):
                crops = crop_stem(doc, output, number, stem, visual_regions)
                if not images and not visual_math and not unresolved and (structured or inferred_columns or any(layout.scanned for layout in page_layouts)):
                    for crop in crops:
                        crop["reference"] = True
                blocks.extend(crops)
            items.append((number, page, dict(version=1, interaction=interaction, blocks=blocks,
                                              options=choices, answer=answer, explanation=explanation_text,
                                              sourceRegions=source_regions(content),
                                              **({"explanationCrops": answer_crops} if answer_crops else {}),
                                              **({"sourceLabel": f"Section {section.upper()} · Question {original_number}"} if section else {})), issues))
        return items

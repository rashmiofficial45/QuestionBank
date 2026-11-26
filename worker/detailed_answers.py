"""Read numbered solutions without reconstructing their visual content."""
from collections import defaultdict
from dataclasses import dataclass, field
import re

import pymupdf as pdf


QUESTION_HEADING = re.compile(r"^Q(?:uestion)?\s*(\d{1,3})\s*[.):]?$", re.I)
OCR_QUESTION_HEADING = re.compile(r"^Q\s*([0-9IlOS]{1,3})\s*[.):]$")
OCR_DIGITS = str.maketrans({"I": "1", "l": "1", "O": "0", "S": "5"})
ANSWER_HEADING = re.compile(r"^Answer\s*:\s*(.*?)$", re.I)
EXPLANATION_HEADING = re.compile(r"^(?:Detailed\s+)?Explanation\s*:", re.I)
KEY_TITLE = re.compile(r"\banswer\s+key\s*:?\s*$", re.I)
KEY_CONTEXT = re.compile(r"^(?:(?:test\s+)?booklet|section|part)\b", re.I)
INLINE_TITLE = re.compile(r"^answers\s*(?:&|and)\s*explanations$", re.I)
INLINE_LABEL = r"(?:\([A-L]\)|[A-L])"
INLINE_HEADING = re.compile(rf"^Q(?:uestion)?\s*(\d{{1,3}})[.)]\s+({INLINE_LABEL}(?:\s*(?:,|&|\+|\band\b)\s*{INLINE_LABEL})*)$", re.I)
EXPLANATION_TITLE = re.compile(r"^(?:detailed\s+|answer\s+)?explanations\s*:?$", re.I)
NUMBERED_EXPLANATION = re.compile(r"^(?:Explanation\s+(\d{1,3})\s*[:.]|(?:Q(?:uestion)?\s*)?(\d{1,3})[.):]\s*Explanation\s*:)", re.I)
NUMBERED_ENTRY = re.compile(r"^(?:Q(?:uestion)?\s*)?(\d{1,3})[.):](?:\s+.*)?$", re.I)
VISION_TEST_CODE = re.compile(r"\btest\s*[-–—]\s*(\d{4,6})\b", re.I)
VISION_COPYRIGHT = re.compile(r"^Copyright\s+©\s+by\s+Vision\s+IAS\b", re.I)


@dataclass
class Solution:
    number: int
    page: int
    top: float
    answer: str = ""
    explained: bool = False
    incomplete: bool = False
    crops: list[dict] = field(default_factory=list)
    alternate_number: int | None = None
    inline: bool = False
    key_from_summary: bool = False


def read_detailed_answers(doc, layouts, *, allow_key_only=False):
    """Return key lines before the first solution and unambiguous question regions."""
    beginnings = []
    inline_format = any(INLINE_TITLE.fullmatch(text) for _, text in layouts[0].lines)
    vision = inline_format and any("www.visionias.in" in text.lower() for _, text in layouts[0].lines)
    inline_margin = None
    explanation_margin = None
    separate_section = False
    for index, layout in enumerate(layouts):
        lines = sorted(layout.lines, key=lambda pair: (round(pair[0].y0, 1), pair[0].x0))
        if not lines:
            continue
        left = min(box.x0 for box, _ in lines)
        for position, (box, text) in enumerate(lines):
            if EXPLANATION_TITLE.fullmatch(text):
                separate_section = True
                continue
            nearby = [(region, value) for region, value in lines[position + 1:position + 6]
                      if region.y0 - box.y0 <= 80]
            heading = INLINE_HEADING.fullmatch(text)
            body = bool(nearby and nearby[0][0].y0 - box.y0 <= 35 and
                        not INLINE_HEADING.fullmatch(nearby[0][1]) and
                        re.search(r"\b[A-Za-z]{2,}\s+[A-Za-z]{2,}\b", nearby[0][1]))
            if heading and (inline_format or (allow_key_only and body)):
                if inline_margin is None:
                    inline_margin = box.x0
                if abs(box.x0 - inline_margin) <= 5:
                    beginnings.append(Solution(int(heading[1]), index + 1, box.y0, heading[2].lower(), inline=True))
                continue
            if explicit := NUMBERED_EXPLANATION.match(text):
                beginnings.append(Solution(int(explicit[1] or explicit[2]), index + 1, box.y0, explained=True, key_from_summary=True))
                continue
            if (separate_section and (numbered := NUMBERED_ENTRY.fullmatch(text))
                    and not any(ANSWER_HEADING.fullmatch(value) for _, value in nearby[:2])):
                if explanation_margin is None:
                    explanation_margin = box.x0
                if abs(box.x0 - explanation_margin) <= 5:
                    beginnings.append(Solution(int(numbered[1]), index + 1, box.y0, explained=True, key_from_summary=True))
                    continue
            match = QUESTION_HEADING.fullmatch(text)
            scanned_match = OCR_QUESTION_HEADING.fullmatch(text) if layout.scanned and not match else None
            if not (match or scanned_match) or box.x0 > left + 20:
                continue
            answer = ""
            explained = False
            has_answer_heading = False
            for offset, (_, value) in enumerate(nearby):
                if QUESTION_HEADING.fullmatch(value):
                    break
                if marker := ANSWER_HEADING.fullmatch(value):
                    has_answer_heading = True
                    answer = marker[1]
                    if not answer and offset + 1 < len(nearby):
                        next_line = nearby[offset + 1][1]
                        if not EXPLANATION_HEADING.match(next_line):
                            answer = next_line
                if EXPLANATION_HEADING.match(value):
                    explained = True
                    break
            if scanned_match and (not answer or not explained):
                continue
            digits = match[1] if match else scanned_match[1].translate(OCR_DIGITS)
            alternate = (int(digits[1:]) if scanned_match and len(digits) == 3
                         and scanned_match[1][0] in "IlS" else None)
            if layout.scanned:
                answer = re.sub(r"^\(?(?:¢c?|c¢)\)?$", "c", answer)
            key_from_summary = allow_key_only and not has_answer_heading and (explained or body)
            beginnings.append(Solution(int(digits), index + 1, box.y0, answer, explained or key_from_summary,
                                       alternate_number=alternate, key_from_summary=key_from_summary))

    if not beginnings:
        if allow_key_only:
            return layouts, {}
        raise ValueError("The detailed PDF needs numbered solutions, such as Q1 followed by Answer and Explanation.")
    first = beginnings[0]
    key_layouts = []
    key_on_page = next(((index, box.y1) for index, layout in enumerate(layouts[:first.page])
                        for box, text in layout.lines if KEY_TITLE.search(text)
                        and (index + 1 < first.page or box.y1 < first.top)), None)
    for index, layout in enumerate(layouts):
        number = index + 1
        if number > first.page:
            break
        lines = [(box, text) for box, text in layout.lines if number < first.page or box.y1 < first.top]
        if key_on_page:
            header_page, header_bottom = key_on_page
            lines = [(box, text) for box, text in lines
                     if KEY_CONTEXT.match(text) or index > header_page or (index == header_page and box.y0 >= header_bottom)]
        if layout.scanned:
            lines = [(box, re.sub(r"^(\d{1,3})\s*,\s*(?=\()", r"\1.", text)) for box, text in lines]
        key_layouts.append(type(layout)(lines, [], layout.scanned))
    keyed_solutions = [solution for solution in beginnings if solution.answer and (solution.inline or allow_key_only)]
    if keyed_solutions and not any(
        re.match(r"^(?:Q(?:uestion)?\s*)?\d{1,3}(?:[.):\s]|$)", text, re.I)
        for layout in key_layouts for _, text in layout.lines
    ):
        key_layouts = [type(layouts[0])(
            [(pdf.Rect(), f"{solution.number}. {solution.answer}") for solution in keyed_solutions],
            [], any(layouts[solution.page - 1].scanned for solution in keyed_solutions),
        )]
    solutions = defaultdict(list)
    cover = " ".join(text for _, text in layouts[0].lines)
    sample_profile = (
        ("ANSWER KEY AND EXPLANATION" in cover.upper() or
         (layouts[0].scanned and re.search(r"\bTEST\s*[-–].+\bPT\s*[-–]\s*\d+\b", cover, re.I)))
        and all(any(box.y0 > 736 and "vajiram & ravi" in text.lower() for box, text in layout.lines)
                for layout in layouts[1:3])
    )
    for index, current in enumerate(beginnings):
        next_solution = beginnings[index + 1] if index + 1 < len(beginnings) else None
        if current.alternate_number is not None and index > 0:
            # Some scanned headings have a duplicated glyph before a two-digit number.
            if current.alternate_number == beginnings[index - 1].number + 1 and (
                not next_solution or next_solution.number == current.alternate_number + 1
            ):
                current.number = current.alternate_number
        final_page = next_solution.page if next_solution else len(doc)
        for page_number in range(current.page, final_page + 1):
            page = doc[page_number - 1]
            if page.rotation:
                current.incomplete = True
                continue
            # The verified layout has a repeating masthead and footer in these bands.
            top = 39 if sample_profile else 0
            bottom = min(736, page.rect.height) if sample_profile else page.rect.height
            if vision:
                page_lines = layouts[page_number - 1].lines
                if page_number != current.page and any(box.y0 < 100 and VISION_COPYRIGHT.match(text) for box, text in page_lines):
                    break
                bottom = min((box.y0 - 2 for box, text in page_lines
                              if box.y0 > page.rect.height * .9 and "www.visionias.in" in text.lower()), default=bottom)
            if page_number == current.page:
                top = max(0, current.top - (5 if layouts[page_number - 1].scanned else 2))
            if next_solution and page_number == next_solution.page:
                bottom = min(bottom, next_solution.top - 3)
            if bottom <= top:
                continue
            if current.inline:
                current.explained |= any(
                    top <= box.y0 < bottom and re.search(r"[A-Za-z]{2,}", text)
                    and (box.x0 > inline_margin + 30 if vision else not INLINE_HEADING.fullmatch(text))
                    for box, text in layouts[page_number - 1].lines
                )
            if next_solution and page_number == next_solution.page and page_number != current.page:
                lines = layouts[page_number - 1].lines
                has_text = any(top <= box.y0 < bottom for box, _ in lines)
                region = pdf.Rect(0, top, page.rect.width, bottom)
                has_image = any(region.intersects(pdf.Rect(image["bbox"])) for image in page.get_image_info()
                                if pdf.Rect(image["bbox"]).get_area() < page.rect.get_area() * .9)
                if not has_text and not has_image:
                    continue
            current.crops.append(dict(page=page_number, bounds=(0, top, page.rect.width, bottom)))
        solutions[current.number].append(current)
    return key_layouts, solutions


def render_solution(doc, output, number, regions):
    crops = []
    for index, region in enumerate(regions, 1):
        page_number = region["page"]
        file = f"answer-{number}-{index}.png"
        rect = pdf.Rect(region["bounds"])
        if output:
            scale = min(2.3, 2000 / max(rect.width, rect.height))
            doc[page_number - 1].get_pixmap(matrix=pdf.Matrix(scale, scale), clip=rect, alpha=False).save(output / file)
        crops.append(dict(page=page_number, file=file))
    return crops

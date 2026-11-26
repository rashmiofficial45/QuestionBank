"""Read numbered solutions without reconstructing their visual content."""
from collections import defaultdict
from dataclasses import dataclass, field
import re

import pymupdf as pdf


QUESTION_HEADING = re.compile(r"^Q(?:uestion)?\s*(\d{1,3})\s*[.):]?$", re.I)
ANSWER_HEADING = re.compile(r"^Answer\s*:\s*(.*?)$", re.I)
EXPLANATION_HEADING = re.compile(r"^(?:Detailed\s+)?Explanation\s*:", re.I)


@dataclass
class Solution:
    number: int
    page: int
    top: float
    answer: str = ""
    explained: bool = False
    incomplete: bool = False
    crops: list[dict] = field(default_factory=list)


def read_detailed_answers(doc, layouts):
    """Return key lines before the first solution and unambiguous question regions."""
    beginnings = []
    for index, layout in enumerate(layouts):
        lines = sorted(layout.lines, key=lambda pair: (round(pair[0].y0, 1), pair[0].x0))
        if not lines:
            continue
        left = min(box.x0 for box, _ in lines)
        for position, (box, text) in enumerate(lines):
            match = QUESTION_HEADING.fullmatch(text)
            if not match or box.x0 > left + 20:
                continue
            nearby = [(region, value) for region, value in lines[position + 1:position + 6]
                      if region.y0 - box.y0 <= 80]
            answer = ""
            explained = False
            for offset, (_, value) in enumerate(nearby):
                if QUESTION_HEADING.fullmatch(value):
                    break
                if marker := ANSWER_HEADING.fullmatch(value):
                    answer = marker[1]
                    if not answer and offset + 1 < len(nearby):
                        next_line = nearby[offset + 1][1]
                        if not EXPLANATION_HEADING.match(next_line):
                            answer = next_line
                if EXPLANATION_HEADING.match(value):
                    explained = True
                    break
            beginnings.append(Solution(int(match[1]), index + 1, box.y0, answer, explained))

    if not beginnings:
        raise ValueError("The detailed PDF needs numbered solutions, such as Q1 followed by Answer and Explanation.")
    first = beginnings[0]
    key_layouts = []
    for index, layout in enumerate(layouts):
        number = index + 1
        if number > first.page:
            break
        lines = [(box, text) for box, text in layout.lines if number < first.page or box.y1 < first.top]
        key_layouts.append(type(layout)(lines, [], layout.scanned))
    solutions = defaultdict(list)
    sample_profile = any("ANSWER KEY AND EXPLANATION" in text.upper() for _, text in layouts[0].lines) and any(
        "Vajiram & Ravi" in text for layout in layouts[1:3] for _, text in layout.lines
    )
    for index, current in enumerate(beginnings):
        next_solution = beginnings[index + 1] if index + 1 < len(beginnings) else None
        final_page = next_solution.page if next_solution else len(doc)
        for page_number in range(current.page, final_page + 1):
            page = doc[page_number - 1]
            if page.rotation:
                current.incomplete = True
                continue
            # The verified layout has a repeating masthead and footer in these bands.
            top = 39 if sample_profile else 0
            bottom = min(736, page.rect.height) if sample_profile else page.rect.height
            if page_number == current.page:
                top = max(0, current.top - 2)
            if next_solution and page_number == next_solution.page:
                bottom = min(bottom, next_solution.top - 3)
            if bottom <= top:
                continue
            if next_solution and page_number == next_solution.page and page_number != current.page:
                lines = layouts[page_number - 1].lines
                has_text = any(top <= box.y0 < bottom for box, _ in lines)
                region = pdf.Rect(0, top, page.rect.width, bottom)
                has_image = any(region.intersects(pdf.Rect(image["bbox"])) for image in page.get_image_info())
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

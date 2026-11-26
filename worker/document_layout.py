from collections import defaultdict
import csv
from dataclasses import dataclass
from io import StringIO
import os
import re
import subprocess

import numpy as np
import pymupdf as pdf


@dataclass
class Word:
    box: pdf.Rect
    text: str
    confidence: float = 100


@dataclass
class DetectedTable:
    box: pdf.Rect
    headers: list[str]
    rows: list[list[str]]
    spans: list[dict] | None = None


@dataclass
class Layout:
    lines: list[tuple[pdf.Rect, str]]
    tables: list[DetectedTable]
    scanned: bool = False
    uncertain_words: bool = False
    unresolved_tables: list[pdf.Rect] | None = None


def center(box):
    return pdf.Point((box.x0 + box.x1) / 2, (box.y0 + box.y1) / 2)


def native_lines(page):
    flags = pdf.TEXTFLAGS_DICT & ~pdf.TEXT_PRESERVE_IMAGES
    lines = []
    for block in page.get_text("dict", flags=flags)["blocks"]:
        for line in block.get("lines", []):
            text = "".join(span["text"] for span in line["spans"]).strip()
            if text:
                lines.append((pdf.Rect(line["bbox"]), text))
    return lines


def scan_page(page, psm, clip=None):
    # Cap total raster dimensions, even when a PDF specifies an unusually large page.
    zoom = min(240 / 72, 3200 / max(page.rect.width, page.rect.height))
    pixmap = page.get_pixmap(matrix=pdf.Matrix(zoom, zoom), alpha=False, colorspace=pdf.csGRAY, clip=clip)
    try:
        result = subprocess.run(
            ["tesseract", "stdin", "stdout", "-l", "eng", "--dpi", str(round(zoom * 72)), "--psm", str(psm), "tsv"],
            input=pixmap.tobytes("png"), capture_output=True, timeout=35, check=True,
            env={**os.environ, "OMP_THREAD_LIMIT": "1"},
        )
    except FileNotFoundError as error:
        raise ValueError("Install Tesseract with English language data to read scanned PDFs.") from error
    except (subprocess.TimeoutExpired, subprocess.CalledProcessError) as error:
        raise ValueError(f"OCR could not read page {page.number + 1}. Check the scan and Tesseract setup.") from error
    grouped = defaultdict(list)
    transform = pdf.Matrix(1 / zoom, 0, 0, 1 / zoom, pixmap.x / zoom, pixmap.y / zoom) * page.derotation_matrix
    for row in csv.DictReader(StringIO(result.stdout.decode()), delimiter="\t", quoting=csv.QUOTE_NONE):
        text = (row.get("text") or "").strip()
        if not text:
            continue
        x, y, w, h = (int(row[field]) for field in ("left", "top", "width", "height"))
        key = tuple(row[field] for field in ("block_num", "par_num", "line_num"))
        grouped[key].append(Word(pdf.Rect(x, y, x + w, y + h) * transform, text, float(row["conf"])))
    return pixmap, transform, grouped


def scan_lines(groups):
    lines = []
    for words in groups:
        current = pdf.Rect(words[0].box)
        text = [words[0].text]
        for word in words[1:]:
            if word.box.x0 - current.x1 > max(13, current.height * 1.6):
                lines.append((current, " ".join(text)))
                current, text = pdf.Rect(word.box), []
            current.include_rect(word.box)
            text.append(word.text)
        lines.append((current, " ".join(text)))
    return lines


def read_scanned_columns(page):
    lines = []
    for left, right in ((23, 299), (300, 579)):
        _, _, groups = scan_page(page, 6, clip=pdf.Rect(left, 46, right, 795))
        lines.extend(scan_lines(groups.values()))
    return lines


def raster_segments(mask, minimum, vertical=False):
    segments = []
    for offset, row in enumerate(mask):
        changes = np.flatnonzero(np.diff(row.astype(np.int8), prepend=0, append=0))
        for start, end in zip(changes[::2], changes[1::2]):
            if end - start < minimum:
                continue
            # Collapse neighboring pixels of the same straight rule.
            if segments and offset - segments[-1][0] <= 2 and abs(start - segments[-1][1]) <= 5 and abs(end - segments[-1][2]) <= 5:
                segments[-1] = (offset, min(start, segments[-1][1]), max(end, segments[-1][2]))
            else:
                segments.append((offset, start, end))
    if vertical:
        return [((offset, start), (offset, end)) for offset, start, end in segments]
    return [((start, offset), (end, offset)) for offset, start, end in segments]


def raster_grids(cells):
    # The PDF table finder exposes line intersections even when the page has no text layer.
    by_corner = defaultdict(list)
    rectangles = [pdf.Rect(cell) for cell in cells]
    for index, rect in enumerate(rectangles):
        for point in (rect.tl, rect.tr, rect.bl, rect.br):
            by_corner[tuple(point)].append(index)
    visited = set()
    for start in range(len(rectangles)):
        if start in visited:
            continue
        queue = [start]
        visited.add(start)
        group = []
        while queue:
            rect = rectangles[queue.pop()]
            group.append(rect)
            for point in (rect.tl, rect.tr, rect.bl, rect.br):
                for neighbor in by_corner[tuple(point)]:
                    if neighbor not in visited:
                        visited.add(neighbor)
                        queue.append(neighbor)
        xs = sorted({x for rect in group for x in (rect.x0, rect.x1)})
        ys = sorted({y for rect in group for y in (rect.y0, rect.y1)})
        bounds = pdf.Rect(xs[0], ys[0], xs[-1], ys[-1])
        if len(xs) < 3 or len(ys) < 3:
            continue
        grid = [[(x0, y0, x1, y1) for x0, x1 in zip(xs, xs[1:])] for y0, y1 in zip(ys, ys[1:])]
        if {cell for row in grid for cell in row} != {tuple(rect) for rect in group}:
            yield bounds, [[tuple(rect) for rect in group]]
        else:
            yield bounds, grid


def merged_grid(physical):
    xs = sorted({round(value, 2) for cell in physical for value in (cell[0], cell[2])})
    ys = sorted({round(value, 2) for cell in physical for value in (cell[1], cell[3])})
    if not 3 <= len(xs) <= 13 or not 3 <= len(ys) <= 41:
        return None
    grid = [[None] * (len(xs) - 1) for _ in ys[:-1]]
    occupied = set()
    spans = []
    for cell in physical:
        x0, y0, x1, y1 = (round(value, 2) for value in cell)
        col, row = xs.index(x0), ys.index(y0)
        columns, rows = xs.index(x1) - col, ys.index(y1) - row
        covered = {(y, x) for y in range(row, row + rows) for x in range(col, col + columns)}
        if not covered or occupied & covered:
            return None
        occupied.update(covered)
        grid[row][col] = cell
        if rows > 1 or columns > 1:
            spans.append(dict(row=row, column=col, rowSpan=rows, colSpan=columns))
    if len(occupied) != len(grid) * len(grid[0]):
        return None
    return grid, spans


def read_tables(page, words, add_lines=None):
    if add_lines is not None and len(add_lines) < 6:
        return [], []
    result = page.find_tables(use_layout=False, paths=[] if add_lines is not None else None, add_lines=add_lines)
    grids = raster_grids(result.cells) if add_lines is not None else (
        (pdf.Rect(table.bbox), [row.cells for row in table.rows]) for table in result.tables
    )
    tables, unresolved = [], []
    for bounds, grid in grids:
        spans = None
        if len(grid) == 1 or any(cell is None for row in grid for cell in row):
            merged = merged_grid([cell for row in grid for cell in row if cell is not None])
            if merged is None:
                unresolved.append(bounds)
                continue
            grid, spans = merged
        if not 2 <= len(grid) <= 40 or not 2 <= len(grid[0]) <= 12:
            unresolved.append(bounds)
            continue
        rows = []
        for row in grid:
            cells = []
            for cell in row:
                if cell is None:
                    cells.append("")
                    continue
                rect = pdf.Rect(cell)
                tokens = sorted((word for word in words if rect.contains(center(word.box))), key=lambda word: center(word.box).y)
                lines = []
                for token in tokens:
                    y = center(token.box).y
                    if lines and y - lines[-1][0] < 4:
                        lines[-1][1].append(token)
                    else:
                        lines.append((y, [token]))
                cells.append(" ".join(token.text for _, line in lines for token in sorted(line, key=lambda word: word.box.x0)))
            rows.append(cells)
        if not spans and (sum(bool(value) for value in rows[0]) < 2 or any(sum(bool(value) for value in row) < 2 for row in rows[1:])):
            unresolved.append(bounds)
            continue
        tables.append(DetectedTable(bounds, rows[0], rows[1:], spans))
    return tables, unresolved


def analyze_page(page, include_tables=True):
    lines = native_lines(page)
    # An image page may have an unused native page label or watermark.
    # Require a meaningful image region before replacing sparse native text.
    scan = not lines or (
        sum(len(text) for _, text in lines) < 45
        and any(pdf.Rect(image["bbox"]).get_area() > page.rect.get_area() * 0.45 for image in page.get_image_info())
    )
    if not scan:
        words = [Word(pdf.Rect(token[:4]), token[4]) for token in page.get_text("words")] if include_tables else []
        tables, unresolved = read_tables(page, words) if include_tables else ([], [])
        return Layout(lines, tables, unresolved_tables=unresolved)
    pixmap, transform, groups = scan_page(page, 3)
    lines = scan_lines(groups.values())
    if not lines:
        pixmap, transform, groups = scan_page(page, 11)
        lines = scan_lines(groups.values())
    if not include_tables and not any(re.search(r"\b\d{1,3}[.) :–-]+\(?[A-Za-z]\)?(?:\s|$)", text) for _, text in lines):
        # Small keys consisting of a single line may need uniform-block segmentation.
        pixmap, transform, groups = scan_page(page, 6)
        lines = scan_lines(groups.values())
    words = [word for group in groups.values() for word in group]
    tables, unresolved = [], []
    if include_tables:
        dark = np.frombuffer(pixmap.samples_mv, dtype=np.uint8).reshape(pixmap.height, pixmap.width) < 135
        rules = raster_segments(dark, max(80, pixmap.width // 11))
        rules += raster_segments(dark.T, max(75, pixmap.height // 26), vertical=True)
        # The line finder is quadratic with dense vector paths.
        if len(rules) <= 450:
            segments = [(pdf.Point(start) * transform, pdf.Point(end) * transform) for start, end in rules]
            tables, unresolved = read_tables(page, words, add_lines=segments)
    return Layout(lines, tables, True, any(word.confidence < 65 for word in words), unresolved)

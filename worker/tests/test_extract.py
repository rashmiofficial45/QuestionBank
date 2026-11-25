import os
from pathlib import Path

import pymupdf
import pytest

from extract import POLITY_TABLES, extract

POLITY_ANSWERS = "BDDCA ADAAB BBCDB AADDA DBADC BDADB ACBCB CABAA BBDCA ACCAA".replace(" ", "").lower()


def make_pdf(path, lines):
    with pymupdf.open() as doc:
        page = doc.new_page()
        for index, line in enumerate(lines):
            page.insert_text((40, 50 + index * 20), line)
        doc.save(path)


def test_unrecognized_layout_is_staged_with_review_flags(tmp_path):
    paper, key = tmp_path / "paper.pdf", tmp_path / "key.pdf"
    make_pdf(paper, ["1. Which option is correct?", "(a) A", "(b) B"])
    make_pdf(key, ["1.(b)"])
    [(number, page, content, issues)] = extract(paper, key, tmp_path)
    assert (number, page, content["answer"]) == (1, 1, "b")
    assert any("verified profile" in issue for issue in issues)


def test_conflicting_key_does_not_guess(tmp_path):
    paper, key = tmp_path / "paper.pdf", tmp_path / "key.pdf"
    make_pdf(paper, ["1. Which option is correct?", "(a) A", "(b) B"])
    make_pdf(key, ["1.(b)", "1.(a)"])
    [(_, _, content, issues)] = extract(paper, key, tmp_path)
    assert content["answer"] is None
    assert "Missing or conflicting official answer." in issues


def test_actual_polity_paper_and_key(tmp_path):
    fixture_dir = os.getenv("POLITY_FIXTURE_DIR")
    if not fixture_dir:
        pytest.skip("Set POLITY_FIXTURE_DIR to the supplied PDF directory.")
    directory = Path(fixture_dir)
    paper = directory / "Test-01-Polity-01-QP-23-Nov-.pdf"
    key = directory / "Test-01-Polity-01-Answer-Key-23-Nov-.pdf"
    items = extract(paper, key, tmp_path)
    assert [row[0] for row in items] == list(range(1, 51))
    assert [row[1] for row in items] == sorted(row[1] for row in items)
    assert all([option["id"] for option in content["options"]] == list("abcd") for _, _, content, _ in items)
    assert "".join(content["answer"] for _, _, content, _ in items) == POLITY_ANSWERS
    assert not any(issues for _, _, _, issues in items)
    assert {number for number, _, c, _ in items if any(b["type"] == "table" for b in c["blocks"])} == POLITY_TABLES
    for _, page, content, _ in items:
        assert content["blocks"][0]["text"]
        for block in content["blocks"]:
            if block["type"] == "source_crop":
                assert block["page"] == page and block["reference"]
                pixmap = pymupdf.Pixmap(tmp_path / block["file"])
                assert pixmap.width > 200 and pixmap.height > 200
    first_table = next(b for b in items[5][2]["blocks"] if b["type"] == "table")
    assert first_table["headers"] == ["", "List I (Constituent Assembly Committee)", "", "List II (Chairman)"]
    assert first_table["rows"][0] == ["A.", "House Committee", "1.", "S.K. Dhar"]


def make_table_paper(path):
    with pymupdf.open() as doc:
        page = doc.new_page()
        page.insert_text((40, 50), "1. Which body carries out the duty listed below?")
        for x in (65, 160, 345):
            page.draw_line((x, 65), (x, 137))
        for y in (65, 89, 113, 137):
            page.draw_line((65, y), (345, y))
        for row, (body, duty) in enumerate((("Body", "Duty"), ("Parliament", "Makes laws"), ("Courts", "Interpret laws"))):
            page.insert_text((72, 82 + 24 * row), body)
            page.insert_text((168, 82 + 24 * row), duty)
        page.insert_text((65, 159), "(a) Parliament")
        page.insert_text((65, 177), "(b) Courts")
        doc.save(path)


def scan(source, target):
    with pymupdf.open(source) as doc, pymupdf.open() as scanned:
        for page in doc:
            image = page.get_pixmap(dpi=240, alpha=False, colorspace=pymupdf.csGRAY)
            scanned.new_page(width=page.rect.width, height=page.rect.height).insert_image(page.rect, pixmap=image)
        scanned.save(target, deflate=True, garbage=4)


@pytest.mark.parametrize("scanned", [False, True])
def test_structured_table_and_answer_key(tmp_path, scanned):
    paper, key = tmp_path / "paper.pdf", tmp_path / "key.pdf"
    make_table_paper(paper)
    make_pdf(key, ["1.(a)"])
    if scanned:
        import shutil

        if not shutil.which("tesseract"):
            pytest.skip("Install Tesseract and its English language data.")
        scan(paper, tmp_path / "scan.pdf")
        scan(key, tmp_path / "scan-key.pdf")
        paper, key = tmp_path / "scan.pdf", tmp_path / "scan-key.pdf"

    [(_, _, content, issues)] = extract(paper, key, tmp_path)
    assert [option["text"] for option in content["options"]] == ["Parliament", "Courts"]
    assert content["answer"] == "a"
    table, = [block for block in content["blocks"] if block["type"] == "table"]
    assert table["headers"] == ["Body", "Duty"]
    assert table["rows"] == [["Parliament", "Makes laws"], ["Courts", "Interpret laws"]]
    assert table["page"] == 1
    if scanned:
        assert any("OCR" in issue for issue in issues)


def test_rasterized_polity_layout_and_key():
    fixture_dir = os.getenv("POLITY_RASTER_FIXTURE_DIR")
    if not fixture_dir:
        pytest.skip("Set POLITY_RASTER_FIXTURE_DIR to include the full raster OCR regression.")
    folder = Path(fixture_dir)
    items = extract(folder / "polity-raster.pdf", folder / "polity-key-raster.pdf")
    assert [number for number, *_ in items] == list(range(1, 51))
    assert all([option["id"] for option in content["options"]] == list("abcd") for _, _, content, _ in items)
    assert "".join(content["answer"] for _, _, content, _ in items) == POLITY_ANSWERS
    assert {number for number, _, c, _ in items if any(b["type"] == "table" for b in c["blocks"])} == POLITY_TABLES
    assert all(any("Question text was read using OCR" in flag for flag in issues)
               for _, _, _, issues in items)

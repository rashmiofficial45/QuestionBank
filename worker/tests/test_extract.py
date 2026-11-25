import os
from pathlib import Path

import pymupdf
import pytest

from extract import POLITY_TABLES, extract


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
    expected = "BDDCA ADAAB BBCDB AADDA DBADC BDADB ACBCB CABAA BBDCA ACCAA".replace(" ", "").lower()
    items = extract(paper, key, tmp_path)
    assert [row[0] for row in items] == list(range(1, 51))
    assert [row[1] for row in items] == sorted(row[1] for row in items)
    assert all([option["id"] for option in content["options"]] == list("abcd") for _, _, content, _ in items)
    assert "".join(content["answer"] for _, _, content, _ in items) == expected
    assert not any(issues for _, _, _, issues in items)
    assert {number for number, _, c, _ in items if len(c["blocks"]) > 1} == POLITY_TABLES
    for _, page, content, _ in items:
        assert content["blocks"][0]["text"]
        for block in content["blocks"][1:]:
            assert block["page"] == page
            pixmap = pymupdf.Pixmap(tmp_path / block["file"])
            assert pixmap.width > 200 and pixmap.height > 200

import os
from pathlib import Path

import pymupdf
import pytest

from extract import POLITY_TABLES, extract
from document_layout import Layout

POLITY_ANSWERS = "BDDCA ADAAB BBCDB AADDA DBADC BDADB ACBCB CABAA BBDCA ACCAA".replace(" ", "").lower()


def make_pdf(path, lines):
    with pymupdf.open() as doc:
        page = doc.new_page()
        for index, line in enumerate(lines):
            page.insert_text((40, 50 + index * 20), line)
        doc.save(path)


def test_detailed_pdf_conflict_requires_editorial_verification(tmp_path):
    paper = tmp_path / "paper.pdf"
    detailed = tmp_path / "detailed.pdf"
    make_pdf(paper, ["1. Which option is correct?", "(a) One", "(b) Two"])
    make_pdf(detailed, ["Answer Key", "1. A", "Q1.", "Answer: B", "Explanation: Two."])
    [(_, _, content, issues)] = extract(paper, None, tmp_path, detailed=detailed)
    assert content["answer"] is None
    assert any("disagree or are incomplete" in issue for issue in issues)
    assert (tmp_path / content["explanationCrops"][0]["file"]).is_file()


def test_detailed_pdf_rejects_a_different_paper_code(tmp_path):
    paper = tmp_path / "paper.pdf"
    detailed = tmp_path / "detailed.pdf"
    make_pdf(paper, ["Test - PT - 01", "1. Which option is correct?", "(a) One", "(b) Two"])
    make_pdf(detailed, ["Test - PT - 02", "Answer Key", "1. A", "Q1.", "Answer: A", "Explanation: One."])
    with pytest.raises(ValueError, match="paper code"):
        extract(paper, None, detailed=detailed)


@pytest.mark.parametrize("standalone_key,expected", [(None, "b"), ("B", "b"), ("A", None)])
def test_inline_answer_label_is_mapped_without_a_separate_key(tmp_path, standalone_key, expected):
    paper = tmp_path / "paper.pdf"
    detailed = tmp_path / "detailed.pdf"
    key = tmp_path / "key.pdf" if standalone_key else None
    make_pdf(paper, ["1. Which option is correct?", "(a) One", "(b) Two"])
    with pymupdf.open() as doc:
        page = doc.new_page()
        page.insert_text((100, 50), "ANSWERS & EXPLANATIONS")
        page.insert_text((40, 85), "Q 1. B")
        page.insert_text((95, 85), "The second option is correct.")
        doc.save(detailed)
    if key:
        make_pdf(key, [f"1. {standalone_key}"])
    [(_, _, content, issues)] = extract(paper, key, tmp_path, detailed=detailed)
    assert content["answer"] == expected
    assert content["explanationCrops"] == [{"page": 1, "file": "answer-1-1.png"}]
    assert "The detailed explanation region needs verification." not in issues


def test_actual_vision_inline_answers_and_question_paper():
    fixture = os.getenv("VISION_FIXTURE_DIR")
    if not fixture:
        pytest.skip("Set VISION_FIXTURE_DIR to the 15601 PDF directory.")
    directory = Path(fixture)
    paper = directory / "Test 01 (15601) Eng QP.pdf"
    detailed = directory / "Test 01 (15601) Eng Sol.pdf"
    items = extract(paper, None, detailed=detailed)
    assert [number for number, _, _, _ in items] == list(range(1, 101))
    assert all(not issues and [option["id"] for option in content["options"]] == list("abcd")
               for _, _, content, issues in items)
    assert "".join(content["answer"] for _, _, content, _ in items) == (
        "aacbcacabaabbabcbacabcbcccbcaaacaacbcabbcaccdbdaccbcddbaabdbdbbcddaabddbdbdbcbbdadbbbbabdbaaccbdcbca"
    )
    assert [crop["page"] for crop in items[2][2]["explanationCrops"]] == [1, 2]
    assert [crop["page"] for crop in items[99][2]["explanationCrops"]] == [37]
    assert items[62][2]["blocks"][1]["type"] == "statements"
    assert all(block["type"] != "table" for item in items[-3:] for block in item[2]["blocks"])


@pytest.mark.parametrize("source_entry,expected", [("1, (c)", "c"), ("1.)", "c"), ("1. (b)", None)])
def test_scanned_detailed_key_keeps_real_conflicts_for_review(tmp_path, monkeypatch, source_entry, expected):
    paper = tmp_path / "paper.pdf"
    detailed = tmp_path / "detailed.pdf"
    make_pdf(paper, ["1. Which option is correct?", "(a) One", "(b) Two", "(c) Three"])
    lines = ["Answer Key", source_entry, "Ql.", "Answer: ¢c", "Explanation: The third choice."]
    make_pdf(detailed, lines)
    from extract import analyze_page

    def simulate_ocr(page, **kwargs):
        if Path(page.parent.name) != detailed:
            return analyze_page(page, **kwargs)
        return Layout([(pymupdf.Rect(40, 40 + i * 20, 150, 50 + i * 20), line)
                       for i, line in enumerate(lines)], [], scanned=True)

    monkeypatch.setattr("extract.analyze_page", simulate_ocr)
    [(_, _, content, issues)] = extract(paper, None, tmp_path, detailed=detailed)
    assert content["answer"] == expected
    assert content["explanationCrops"] == [{"page": 1, "file": "answer-1-1.png"}]
    assert any("using OCR" in issue for issue in issues)
    assert any("disagree" in issue for issue in issues) == (expected is None)


def test_unrecognized_layout_is_staged_with_review_flags(tmp_path):
    paper, key = tmp_path / "paper.pdf", tmp_path / "key.pdf"
    make_pdf(paper, ["1. Which option is correct?", "(a) A", "(b) B"])
    make_pdf(key, ["1.(b)"])
    [(number, page, content, issues)] = extract(paper, key, tmp_path)
    assert (number, page, content["answer"]) == (1, 1, "b")
    assert any("verified profile" in issue for issue in issues)


def test_generic_columns_preserve_question_and_option_order(tmp_path):
    paper, key = tmp_path / "paper.pdf", tmp_path / "key.pdf"
    with pymupdf.open() as doc:
        page = doc.new_page()
        for x, number, subject in [(40, 1, "Left"), (330, 2, "Right")]:
            for index, line in enumerate([f"{number}. {subject} question?", "A. First", "B. Second"]):
                page.insert_text((x, 50 + index * 25), line)
        doc.save(paper)
    make_pdf(key, ["1. B", "2. A"])
    items = extract(paper, key, tmp_path)
    assert [(number, content["answer"]) for number, _, content, _ in items] == [(1, "b"), (2, "a")]
    for (_, _, content, issues), subject in zip(items, ("Left", "Right")):
        assert [option["text"] for option in content["options"]] == ["First", "Second"]
        assert content["blocks"][0]["text"] == f"{subject} question?"
        assert content["blocks"][1]["reference"]
        assert any("two-column" in issue for issue in issues)


def test_combined_pdf_separates_answer_key_from_roman_statements(tmp_path):
    paper = tmp_path / "combined.pdf"
    with pymupdf.open() as doc:
        for lines in (["1. Consider the following:", "I. First claim", "II. Second claim", "A. One", "B. Two"],
                      ["Answer Key", "1. B"]):
            page = doc.new_page()
            for index, line in enumerate(lines):
                page.insert_text((40, 50 + index * 20), line)
        doc.save(paper)
    [(_, _, content, issues)] = extract(paper, None)
    assert content["blocks"][1]["type"] == "statements"
    assert [option["label"] for option in content["options"]] == ["A", "B"]
    assert content["answer"] == "b"
    assert any("combined PDF" in issue for issue in issues)


def test_assertion_reason_keeps_source_labels_options_and_key(tmp_path):
    paper, key = tmp_path / "paper.pdf", tmp_path / "key.pdf"
    make_pdf(paper, [
        "1. Consider the following:",
        "Assertion (A): A leap year has 366 days.",
        "Reason (R): February has one additional day in a leap year.",
        "Select the correct answer.",
        "(a) Both are true and R explains A.", "(b) Both are true but R does not explain A.",
    ])
    make_pdf(key, ["1. (a)"])
    [(_, _, content, _)] = extract(paper, key)
    intro, pair, instruction = content["blocks"]
    assert intro["text"] == "Consider the following:"
    assert pair["type"] == "assertion_reason"
    assert pair["assertion"] == {"label": "Assertion (A):", "text": "A leap year has 366 days."}
    assert pair["reason"] == {"label": "Reason (R):", "text": "February has one additional day in a leap year."}
    assert instruction["text"] == "Select the correct answer."
    assert content["interaction"] == "single_choice"
    assert content["answer"] == "a"


def test_unpaired_assertion_remains_source_text(tmp_path):
    paper, key = tmp_path / "paper.pdf", tmp_path / "key.pdf"
    make_pdf(paper, ["1. Assertion: One hour has sixty minutes.", "(a) True", "(b) False"])
    make_pdf(key, ["1. (a)"])
    [(_, _, content, _)] = extract(paper, key)
    assert content["blocks"] == [{"id": "stem", "type": "paragraph", "text": "Assertion: One hour has sixty minutes."}]


def test_embedded_prompt_image_is_preserved_as_source_crop(tmp_path):
    paper, key = tmp_path / "paper.pdf", tmp_path / "key.pdf"
    with pymupdf.open() as art, pymupdf.open() as doc:
        square = art.new_page(width=80, height=80)
        square.draw_circle((40, 40), 25, fill=(0, 0, 0))
        page = doc.new_page()
        page.insert_text((40, 50), "1. Identify the shape shown.")
        page.insert_image(pymupdf.Rect(50, 65, 130, 145), pixmap=square.get_pixmap())
        page.insert_text((40, 170), "(a) Circle")
        page.insert_text((40, 190), "(b) Square")
        doc.save(paper)
    make_pdf(key, ["1. (a)"])
    [(_, _, content, _)] = extract(paper, key, tmp_path)
    crop = next(block for block in content["blocks"] if block["type"] == "source_crop")
    assert not crop.get("reference")
    assert pymupdf.Pixmap(tmp_path / crop["file"]).height >= 190
    assert content["answer"] == "a"


def test_embedded_option_images_follow_their_own_markers(tmp_path):
    paper, key = tmp_path / "paper.pdf", tmp_path / "key.pdf"
    with pymupdf.open() as art, pymupdf.open() as doc:
        drawing = art.new_page(width=40, height=40)
        drawing.draw_circle((20, 20), 12, fill=(0, 0, 0))
        page = doc.new_page()
        page.insert_text((40, 50), "1. Select the diagram.")
        for label, y in [("a", 80), ("b", 145)]:
            page.insert_text((40, y), f"({label})")
            page.insert_image(pymupdf.Rect(65, y, 105, y + 40), pixmap=drawing.get_pixmap())
        doc.save(paper)
    make_pdf(key, ["1. (b)"])
    [(_, _, content, issues)] = extract(paper, key, tmp_path)
    files = [option["blocks"][0]["file"] for option in content["options"]]
    assert len(set(files)) == 2 and all((tmp_path / file).is_file() for file in files)
    assert [option["text"] for option in content["options"]] == ["Image option A", "Image option B"]
    assert content["answer"] == "b" and any("source images" in issue for issue in issues)


def test_conflicting_key_does_not_guess(tmp_path):
    paper, key = tmp_path / "paper.pdf", tmp_path / "key.pdf"
    make_pdf(paper, ["1. Which option is correct?", "(a) A", "(b) B"])
    make_pdf(key, ["1.(b)", "1.(a)"])
    [(_, _, content, issues)] = extract(paper, key, tmp_path)
    assert content["answer"] is None
    assert "Missing or conflicting official answer." in issues


def test_optional_explanations_map_by_number_and_flag_duplicates(tmp_path):
    paper, key, explanations = (tmp_path / name for name in ("paper.pdf", "key.pdf", "explanations.pdf"))
    make_pdf(paper, ["1. First?", "(a) A", "(b) B", "2. Second?", "(a) A", "(b) B"])
    make_pdf(key, ["1. (a)", "2. (b)"])
    make_pdf(explanations, ["Explanation 2: Source for the second question.", "Second line.",
                            "1. Explanation: An ambiguous explanation.", "Explanation 1: Another explanation."])
    first, second = extract(paper, key, explanation=explanations)
    assert first[2]["explanation"] == ""
    assert any("ambiguous" in issue for issue in first[3])
    assert second[2]["explanation"] == "Source for the second question.\nSecond line."
    assert second[2]["answer"] == "b"


@pytest.mark.parametrize("entries", [
    ["1. A, C"],
    ["1.(A, C)"],
    ["1.(C) and (A)"],
    ["1. C & A", "1. A + C"],
])
def test_multiple_answer_entry_preserves_option_order(tmp_path, entries):
    paper, key = tmp_path / "paper.pdf", tmp_path / "key.pdf"
    make_pdf(paper, ["1. Which options are correct?", "(a) First", "(b) Second", "(c) Third"])
    make_pdf(key, entries)
    [(_, _, content, issues)] = extract(paper, key)
    assert content["interaction"] == "multiple_choice"
    assert content["answer"] == ["a", "c"]
    assert any("Verify the full answer set" in issue for issue in issues)


@pytest.mark.parametrize("entries", [
    ["1. A, D"],
    ["1. A, A"],
    ["1. A and"],
    ["1. A / C"],
    ["1. A or C"],
    ["1. A, C", "1. A"],
])
def test_invalid_or_conflicting_answer_set_is_flagged(tmp_path, entries):
    paper, key = tmp_path / "paper.pdf", tmp_path / "key.pdf"
    make_pdf(paper, ["1. Which options are correct?", "(a) First", "(b) Second", "(c) Third"])
    make_pdf(key, entries)
    [(_, _, content, issues)] = extract(paper, key)
    assert content["answer"] is None
    assert "Missing or conflicting official answer." in issues


def test_inline_single_and_multiple_answer_entries(tmp_path):
    paper, key = tmp_path / "paper.pdf", tmp_path / "key.pdf"
    make_pdf(paper, ["1. First question?", "(a) A", "(b) B", "2. Second question?", "(a) A", "(b) B"])
    make_pdf(key, ["1. A, B; 2.(b)"])
    assert [content["answer"] for _, _, content, _ in extract(paper, key)] == [["a", "b"], "b"]


@pytest.mark.parametrize(("entries", "expected"), [
    (["1. (true)"], "b"),
    (["1. False"], "a"),
    (["1. True", "1. B"], "b"),
    (["1. True", "1. A"], None),
    (["1. A, B"], None),
])
def test_true_false_maps_key_to_original_option_ids(tmp_path, entries, expected):
    paper, key = tmp_path / "paper.pdf", tmp_path / "key.pdf"
    make_pdf(paper, ["1. A year has twelve months.", "(a) FALSE", "(b) True"])
    make_pdf(key, entries)
    [(_, _, content, issues)] = extract(paper, key)
    assert content["interaction"] == "true_false"
    assert [option["text"] for option in content["options"]] == ["FALSE", "True"]
    assert content["answer"] == expected
    assert ("Missing or conflicting official answer." in issues) == (expected is None)


def test_true_false_key_requires_explicit_binary_options(tmp_path):
    paper, key = tmp_path / "paper.pdf", tmp_path / "key.pdf"
    make_pdf(paper, ["1. Which option is correct?", "(a) One", "(b) Two"])
    make_pdf(key, ["1. True"])
    [(_, _, content, issues)] = extract(paper, key)
    assert content["interaction"] == "single_choice"
    assert content["answer"] is None
    assert "Missing or conflicting official answer." in issues


def test_actual_polity_detailed_answer_pdf(tmp_path):
    fixture_dir = os.getenv("POLITY_FIXTURE_DIR")
    if not fixture_dir:
        pytest.skip("Set POLITY_FIXTURE_DIR to the supplied PDF directory.")
    directory = Path(fixture_dir)
    paper = directory / "Test-01-Polity-01-QP-23-Nov-.pdf"
    detailed = directory / "Test-01-Polity-01-Detailed-Explaination-23-Nov-.pdf"
    items = extract(paper, None, tmp_path, detailed=detailed)
    assert [number for number, _, _, _ in items] == list(range(1, 51))
    assert "".join(content["answer"] for _, _, content, _ in items) == POLITY_ANSWERS
    assert not any(issues for _, _, _, issues in items)
    assert [crop["page"] for crop in items[0][2]["explanationCrops"]] == [2, 3]
    assert [crop["page"] for crop in items[42][2]["explanationCrops"]] == [30, 31]
    assert all((tmp_path / crop["file"]).stat().st_size > 0
               for _, _, content, _ in items for crop in content["explanationCrops"])
    assert all(content["explanationCrops"] for _, _, content, _ in items)


def test_actual_polity_pt2_skips_the_numbered_cover_and_preserves_questions(tmp_path):
    fixture_dir = os.getenv("POLITY_PT2_FIXTURE_DIR")
    if not fixture_dir:
        pytest.skip("Set POLITY_PT2_FIXTURE_DIR to the PT-02 paper and detailed PDF directory.")
    directory = Path(fixture_dir)
    items = extract(directory / "paper.pdf", None, tmp_path, detailed=directory / "detailed.pdf")
    assert [number for number, _, _, _ in items] == list(range(1, 51))
    assert items[0][1] == 2 and items[-1][1] == 13
    assert "Which one of the following pairs of rights" in items[0][2]["blocks"][0]["text"]
    assert all(not issues and [option["id"] for option in content["options"]] == list("abcd")
               for _, _, content, issues in items)
    assert "".join(content["answer"] for _, _, content, _ in items) == "acbdcadccccadcbbbaadcadcbdbdcddccbabbabcbcabbbcbbb"
    assert {number for number, _, content, _ in items if any(block["type"] == "table" for block in content["blocks"])} == {5, 13, 29, 34, 38}
    assert all(content.get("explanationCrops") for _, _, content, _ in items)
    assert sum(len(content["explanationCrops"]) for _, _, content, _ in items) == 72


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
    numbered = next(block for block in items[8][2]["blocks"] if block["type"] == "statements")
    labeled = next(block for block in items[1][2]["blocks"] if block["type"] == "statements")
    assert [item["label"] for item in numbered["items"]] == ["1.", "2.", "3.", "4."]
    assert [item["label"] for item in labeled["items"]] == ["Statement 1:", "Statement 2:"]
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


def test_scanned_multiple_answer_key(tmp_path):
    import shutil

    if not shutil.which("tesseract"):
        pytest.skip("Install Tesseract with English language data.")
    paper, key, scanned = (tmp_path / name for name in ("paper.pdf", "key.pdf", "scan-key.pdf"))
    make_pdf(paper, ["1. Which options are correct?", "(a) First", "(b) Second", "(c) Third"])
    make_pdf(key, ["1. A, C"])
    scan(key, scanned)
    [(_, _, content, issues)] = extract(paper, scanned)
    assert content["answer"] == ["a", "c"]
    assert any("answer key was read using OCR" in issue for issue in issues)


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


def test_sectioned_numbering_numeric_roman_and_passage(tmp_path):
    paper, key, explanations = (tmp_path / name for name in ("paper.pdf", "key.pdf", "explanations.pdf"))
    make_pdf(paper, [
        "Section A", "Passage for questions 1-1: A shared reading passage.",
        "1. First question?", "Options:", "(1) One", "(2) Two", "(3) Three",
        "Section B", "1. Second question?", "Choices:", "(I) First", "(II) Second",
    ])
    make_pdf(key, ["Section A", "1. 3", "Section B", "1. II"])
    make_pdf(explanations, ["Section A", "Explanation 1: Answer three.", "Section B", "Explanation 1: Answer two."])
    first, second = extract(paper, key, explanation=explanations)
    assert [first[0], second[0]] == [1, 2]
    assert first[2]["blocks"][0]["style"] == "passage"
    assert first[2]["options"][2]["id"] == first[2]["answer"] == "3"
    assert second[2]["options"][1]["id"] == second[2]["answer"] == "ii"
    assert second[2]["sourceLabel"] == "Section B · Question 1"
    assert second[2]["explanation"] == "Answer two."


def test_page_checkpoints_reuse_completed_analysis_on_retry(tmp_path, monkeypatch):
    import importlib

    module = importlib.import_module("extract")
    paper, key = tmp_path / "paper.pdf", tmp_path / "key.pdf"
    make_pdf(paper, ["1. Choose one.", "(a) A", "(b) B"])
    make_pdf(key, ["1. B"])
    cache = tmp_path / "checkpoints"
    initial = extract(paper, key, checkpoint=cache)
    def new_analysis(*args, **kwargs):
        raise AssertionError("A completed page should be reused during retry")
    monkeypatch.setattr(module, "analyze_page", new_analysis)
    assert extract(paper, key, checkpoint=cache) == initial


def test_reconstructs_a_merged_header_from_pdf_geometry(tmp_path):
    paper, key = tmp_path / "paper.pdf", tmp_path / "key.pdf"
    with pymupdf.open() as doc:
        page = doc.new_page()
        page.insert_text((40, 40), "1. Refer to the table.")
        for bounds in ((40, 60, 240, 85), (40, 85, 140, 110), (140, 85, 240, 110)):
            page.draw_rect(pymupdf.Rect(bounds))
        for point, value in [((50, 77), "Merged heading"), ((50, 102), "Left"), ((150, 102), "Right")]:
            page.insert_text(point, value)
        page.insert_text((40, 133), "(a) Left")
        page.insert_text((40, 153), "(b) Right")
        doc.save(paper)
    make_pdf(key, ["1. B"])
    [(_, _, content, _)] = extract(paper, key)
    table = next(block for block in content["blocks"] if block["type"] == "table")
    assert table["headers"] == ["Merged heading", ""]
    assert table["spans"] == [{"row": 0, "column": 0, "rowSpan": 1, "colSpan": 2}]


def test_mixed_columns_and_multipage_question_keep_reading_order(tmp_path):
    paper, key = tmp_path / "paper.pdf", tmp_path / "key.pdf"
    with pymupdf.open() as doc:
        page = doc.new_page()
        page.insert_text((40, 40), "Section A: " + "Full-width instructions " * 3)
        for x, number, subject in [(40, 1, "Left"), (330, 2, "Right")]:
            page.insert_text((x, 70), f"{number}. {subject} question?")
            page.insert_text((x, 90), "(a) First")
            if number == 1:
                page.insert_text((x, 110), "(b) Second")
        page = doc.new_page()
        page.insert_text((40, 45), "(b) Continues on the next page")
        page.insert_text((40, 75), "3. Next question?")
        page.insert_text((40, 95), "(a) First")
        page.insert_text((40, 115), "(b) Second")
        doc.save(paper)
    make_pdf(key, ["Section A", "1. A", "2. B", "3. A"])
    items = extract(paper, key)
    assert [item[0] for item in items] == [1, 2, 3]
    assert items[1][2]["answer"] == "b"
    assert items[1][2]["options"][1]["text"] == "Continues on the next page"
    assert {region["page"] for region in items[1][2]["sourceRegions"]} == {1, 2}


def test_uses_only_the_matching_explicit_booklet(tmp_path):
    paper, key = tmp_path / "paper.pdf", tmp_path / "key.pdf"
    make_pdf(paper, ["Test Booklet Series B", "1. Choose one.", "(a) First", "(b) Second"])
    make_pdf(key, ["Booklet A", "1. A", "Booklet B", "1. B"])
    [(_, _, content, _)] = extract(paper, key)
    assert content["answer"] == "b"
    make_pdf(paper, ["1. Choose one.", "(a) First", "(b) Second"])
    [(_, _, content, issues)] = extract(paper, key)
    assert content["answer"] is None
    assert any("booklet could not be matched" in issue for issue in issues)

"""Add verified table structure to unchanged questions from an existing import."""

import argparse
from pathlib import Path
from uuid import UUID

from psycopg import connect
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb

from extract import extract
from main import DATABASE, STORAGE


def search_text(blocks):
    parts = []
    for block in blocks:
        if block["type"] == "paragraph":
            parts.append(block["text"])
        elif block["type"] == "table":
            parts.extend(" ".join(row) for row in [block["headers"], *block["rows"]])
    return parts


def refresh(import_id: UUID, storage: Path):
    directory = storage / str(import_id)
    items = extract(directory / "paper.pdf", directory / "key.pdf")
    tables = {number: (page, content) for number, page, content, issues in items if not issues and
              any(block["type"] == "table" for block in content["blocks"])}
    count = 0
    with connect(DATABASE, row_factory=dict_row) as conn:
        record = conn.execute("SELECT * FROM paper_imports WHERE id=%s AND status='ready' FOR UPDATE", (import_id,)).fetchone()
        if not record:
            raise ValueError("Import must be ready.")
        artifacts = directory / str(record["claim_token"])
        rows = conn.execute("""
            SELECT id, number, page, content, original FROM question_drafts
            WHERE import_id=%s ORDER BY number FOR UPDATE
        """, (import_id,)).fetchall()
        for draft in rows:
            candidate = tables.get(draft["number"])
            if not candidate:
                continue
            page, rebuilt = candidate
            original = draft["original"]
            blocks = rebuilt["blocks"]
            old_crops = {block["file"]: block for block in original["blocks"] if block["type"] == "source_crop"}
            references = [block for block in blocks if block["type"] == "source_crop"]
            if page != draft["page"] or original["answer"] != rebuilt["answer"] or original["options"] != rebuilt["options"]:
                continue
            if not references or any(ref["file"] not in old_crops or not (artifacts / ref["file"]).is_file() for ref in references):
                continue
            updated = conn.execute("""
                UPDATE question_drafts SET content=jsonb_set(content, '{blocks}', %s)
                WHERE id=%s AND content->'blocks'= %s
            """, (Jsonb(blocks), draft["id"], Jsonb(original["blocks"])))
            if not updated.rowcount:
                continue
            conn.execute("""
                UPDATE published_questions SET content=jsonb_set(content, '{blocks}', %s), search_text=%s
                WHERE draft_id=%s AND content->'blocks'= %s
            """, (Jsonb(blocks), "\n".join([*search_text(blocks), record["subject"], record["title"]]), draft["id"], Jsonb(original["blocks"])))
            count += 1
    return count


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("import_id", type=UUID)
    args = parser.parse_args()
    print(f"Updated structured layout for {refresh(args.import_id, STORAGE)} questions.")

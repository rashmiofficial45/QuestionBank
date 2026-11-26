"""Store completed page analyses separately from a worker claim's output."""
import json
from contextlib import suppress
from dataclasses import asdict
from uuid import uuid4

import pymupdf as pdf

from document_layout import DetectedTable, Layout


def page_layout(directory, label, index, analyze):
    if directory is None:
        return analyze()
    directory.mkdir(mode=0o700, parents=True, exist_ok=True)
    path = directory / f"layout-v1-{label}-{index}.json"
    try:
        record = json.loads(path.read_text())
        return Layout(
            lines=[(pdf.Rect(box), text) for box, text in record["lines"]],
            tables=[DetectedTable(pdf.Rect(item["box"]), item["headers"], item["rows"], item.get("spans"))
                    for item in record["tables"]],
            scanned=record["scanned"],
            uncertain_words=record["uncertain_words"],
            unresolved_tables=[pdf.Rect(box) for box in record["unresolved_tables"] or []],
        )
    except (FileNotFoundError, ValueError, KeyError, TypeError):
        pass

    result = analyze()
    temp = path.with_name(f"{path.name}.{uuid4()}.tmp")
    try:
        temp.write_text(json.dumps(asdict(result), default=lambda rect: list(rect)))
        temp.replace(path)
    finally:
        with suppress(FileNotFoundError):
            temp.unlink()
    return result

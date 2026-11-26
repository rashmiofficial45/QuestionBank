"""Measure local extraction time and Python peak RSS for one PDF pair."""

import argparse
import json
from pathlib import Path
import resource
import sys
from time import perf_counter

from extract import extract

parser = argparse.ArgumentParser()
parser.add_argument("paper", type=Path)
parser.add_argument("key", type=Path)
args = parser.parse_args()
start = perf_counter()
questions = extract(args.paper, args.key)
rss = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
print(json.dumps({
    "questions": len(questions),
    "options": sum(len(content["options"]) for _, _, content, _ in questions),
    "seconds": round(perf_counter() - start, 2),
    "pythonPeakMiB": round(rss / (1024 ** 2 if sys.platform == "darwin" else 1024), 1),
}))

"""Shared paths and small helpers for every pipeline script.

Import with:  from pipelines.common import RAW, STAGED, MARTS, read_text
Run scripts from the repo root as modules, for example:
    uv run python -X utf8 -m pipelines.fetch.fetch_raw
"""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
CATALOG = DATA / "catalog.json"
RAW = DATA / "raw"          # as downloaded, never edited
STAGED = DATA / "staged"    # cleaned per dataset: UTF-8, EPSG:4326, normalized keys
MARTS = DATA / "marts"      # joined tables shared by research and the app
MANUAL = DATA / "manual"    # inputs that people edit by hand; scripts read, never overwrite

# Coordinate systems used in Taipei data
CRS_WGS84 = "EPSG:4326"
CRS_TWD97 = "EPSG:3826"     # TWD97 TM2, metres; use it for area and distance


def read_text(path, encodings=("utf-8-sig", "big5", "cp950")):
    """Read a text file whose encoding is UTF-8 or Big5. Returns (text, encoding)."""
    raw = Path(path).read_bytes()
    for enc in encodings:
        try:
            return raw.decode(enc), enc
        except UnicodeDecodeError:
            continue
    raise UnicodeDecodeError("unknown", raw[:0], 0, 0, f"none of {encodings} fit {path}")


def load_catalog():
    return json.loads(CATALOG.read_text(encoding="utf-8"))


def source_dir(slug):
    """Return data/raw/<group>/<slug> for a slug in catalog.json."""
    for src in load_catalog()["sources"]:
        if src["slug"] == slug:
            return RAW / src["group"] / slug
    raise KeyError(slug)

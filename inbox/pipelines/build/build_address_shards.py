"""Build address lookup shards for the S2 page: one JSON file per district.

Spec: coordinator decision BD10 as revised 2026-10-18
(research/issue-06/solutions/decisions/2026-10-18-consensus.md §2):
  * one shard per town_code; each record has only the fields in FIELDS;
  * sea_sand and quake_listed are treated the same: both kept, shown only when the
    user's address matches exactly, never as a browsable layer;
  * the flags sit only on buildings matched at geo_level 1 (exact house number);
    cases placed by nearest number or lane (geo_level 2-3) carry no flag here and
    count only in village totals;
  * the list's own address text and version go with each flag, so the page quotes
    the official list, not our matched address;
  * built_year_min / built_year_max / age_source / age_conf from the K6 ladder;
  * near_heritage_50m / heritage_n_50m in both versions (coordinator ruling: official
    public locations, licence OK, no personal data).
The shards are generated, not committed (CONVENTIONS §4a-1).

--public drops liq_level_national2026 and liq_agreement: the national 2026 map has
no stated licence for re-publishing per address (docs/data-licenses.md §6). The
default (internal) output keeps every field for the VM prototype.

Usage:   uv run python -X utf8 -m pipelines.build.build_address_shards [--public]
Input:   data/marts/building_points.parquet (run build_building_points first)
Output:  data/marts/shards/<town_code>.json   {"town_code", "town_name", "generated", "records": [...]}
         data/marts/shards/index.json         town list, record counts, data dates
         with --public: the same under data/marts/shards_public/
Network: no
"""

import argparse
import json
from datetime import date

import pandas as pd

from pipelines.address import TOWN_NAMES
from pipelines.common import MARTS

OUT = MARTS / "shards"
OUT_PUBLIC = MARTS / "shards_public"
PUBLIC_DROP = ["liq_level_national2026", "liq_agreement"]
FIELDS = ["point_id", "address", "village_code", "lon", "lat", "status", "undetermined_reason", "built_year",
          "built_year_min", "built_year_max", "age_source", "age_conf",
          "code_generation", "structure_class", "floors", "liq_level_city2019", "liq_level_national2026",
          "liq_agreement", "soft_story_candidate",
          "sea_sand", "sea_sand_list_address", "sea_sand_list_version",
          "quake_listed", "quake_listed_address", "quake_listed_version",
          "near_heritage_50m", "heritage_n_50m"]
DATA_DATES = {
    "house_numbers": "2026-10-02",
    "use_permits": "ROC 90-115",
    "real_price_registration": "101S4-115S3",
    "liquefaction_city2019": "soil.taipei 2019",
    "liquefaction_national2026": "2026 (115/9/24)",
    "sea_sand_list": "115.3.25",
    "quake_list": "115.3.18",
}


def clean(v):
    if v is None or (isinstance(v, float) and pd.isna(v)) or v is pd.NA:
        return None
    if isinstance(v, float) and v.is_integer():
        return int(v)
    return v


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--public", action="store_true", help="drop fields not cleared for the public site")
    args = ap.parse_args()
    fields = [f for f in FIELDS if not (args.public and f in PUBLIC_DROP)]
    out_dir = OUT_PUBLIC if args.public else OUT
    b = pd.read_parquet(MARTS / "building_points.parquet")
    b["soft_story_candidate"] = b["soft_story_candidate"].replace("", None)
    b["undetermined_reason"] = b["undetermined_reason"].replace("", None)
    b["age_conf"] = b["age_conf"].replace("", None)
    out_dir.mkdir(parents=True, exist_ok=True)
    dates = {k: v for k, v in DATA_DATES.items() if not (args.public and k == "liquefaction_national2026")}
    index = {"generated": date.today().isoformat(), "public": args.public, "fields": fields,
             "data_dates": dates, "towns": []}
    for town, g in b.groupby("town_code"):
        # null fields are left out to keep shards small; a missing key means null
        recs = [{k: c for k, v in zip(fields, row) if (c := clean(v)) is not None}
                for row in g[fields].itertuples(index=False)]
        shard = {"town_code": town, "town_name": TOWN_NAMES.get(town), "generated": index["generated"],
                 "records": recs}
        path = out_dir / f"{town}.json"
        path.write_text(json.dumps(shard, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        index["towns"].append({"town_code": town, "town_name": TOWN_NAMES.get(town), "file": path.name,
                               "records": len(recs), "bytes": path.stat().st_size})
    (out_dir / "index.json").write_text(json.dumps(index, ensure_ascii=False, indent=1), encoding="utf-8")
    total = sum(t["bytes"] for t in index["towns"])
    print(f"public={args.public} fields={len(fields)} shards={len(index['towns'])} records={sum(t['records'] for t in index['towns'])} "
          f"total_mb={total / 1e6:.1f} max_mb={max(t['bytes'] for t in index['towns']) / 1e6:.1f}")


if __name__ == "__main__":
    main()

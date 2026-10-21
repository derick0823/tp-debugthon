"""Stage the fire access lane list (消防通道清冊): one row per lane x village.

Fixes applied (see docs/issues/06-seismic-old-buildings.md):
  * one cell can list several villages with mixed separators -> split, weight = 1/n
  * trailing full-width spaces -> stripped
  * 葫州里 -> 葫洲里 (typo; the population file uses 葫洲里)
  * 糖部里 -> 糖廍里 (typo in 萬華區; not listed in the docs yet)

Usage:   uv run python -X utf8 -m pipelines.stage.stage_fire_access_lanes
Input:   data/raw/building-hazard/fire-access-lanes/r000-351307e4.csv
         data/staged/base/village-boundary-nlsc.csv
Output:  data/staged/building-hazard/fire-access-lanes.csv
         columns: lane_id, town_code, village_code, village_name, village_weight,
                  lane_name, criteria, site_type, fire_unit
Network: no
"""

import re

import pandas as pd

from pipelines.common import RAW, STAGED

SRC = RAW / "building-hazard" / "fire-access-lanes" / "r000-351307e4.csv"
VILLAGES = STAGED / "base" / "village-boundary-nlsc.csv"
OUT = STAGED / "building-hazard" / "fire-access-lanes.csv"
FIXES = {"葫州里": "葫洲里", "糖部里": "糖廍里"}


def split_villages(cell):
    cell = re.sub(r"[\s　]+", "", str(cell))
    names = re.findall(r"[^、,，/;；及]+?里", cell)
    return [FIXES.get(n, n) for n in names]


def main():
    d = pd.read_csv(SRC, dtype=str, encoding="utf-8-sig")
    v = pd.read_csv(VILLAGES, dtype=str)
    rows = []
    for r in d.itertuples(index=False):
        names = split_villages(r.里別)
        for n in names:
            rows.append({"lane_id": int(r.項次編號), "town_code": r.行政區代碼, "village_name": n,
                         "village_weight": round(1 / len(names), 4), "lane_name": r.列管名稱,
                         "criteria": r.列管要件, "site_type": r.搶救困難地區場所, "fire_unit": r.轄區分隊})
    out = pd.DataFrame(rows).merge(v[["town_code", "village_name", "village_code"]],
                                   on=["town_code", "village_name"], how="left")
    miss = out[out.village_code.isna()]
    multi = (out.groupby("lane_id").size() > 1).sum()
    print(f"lanes={d.shape[0]} lane-village rows={len(out)} multi-village lanes={multi} unmatched={len(miss)}")
    if len(miss):
        print(miss[["lane_id", "town_code", "village_name"]].to_string(index=False))
    out = out[["lane_id", "town_code", "village_code", "village_name", "village_weight",
               "lane_name", "criteria", "site_type", "fire_unit"]]
    OUT.parent.mkdir(parents=True, exist_ok=True)
    out.to_csv(OUT, index=False, encoding="utf-8")


if __name__ == "__main__":
    main()

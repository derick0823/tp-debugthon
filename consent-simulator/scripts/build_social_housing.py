"""Summarise completed Taipei social housing by district for the relocation section.

Social housing is only one possible source of relocation housing, and only when the city
approves it case by case (S29 rule 2). The page must say so; this script only counts units.

Usage:   uv run python -X utf8 research/issue-06/mvp-variants/consent-simulator/scripts/build_social_housing.py
Input:   research/issue-06/mvp-variants/uro-cases/out/social-housing.csv (e3, data.taipei 659c3565)
Output:  research/issue-06/mvp-variants/consent-simulator/data/social-housing.js (window.SOCIAL_HOUSING)
Network: no
"""

import json
from pathlib import Path

import pandas as pd

HERE = Path(__file__).resolve().parents[1]
SRC = HERE.parent / "uro-cases" / "out" / "social-housing.csv"
TAIPEI = {"松山區", "信義區", "大安區", "中山區", "中正區", "大同區", "萬華區", "文山區", "南港區", "內湖區", "士林區", "北投區"}


def main():
    d = pd.read_csv(SRC)
    done = d[d.progress.astype(str) == "已完工"]
    g = (done.groupby("town_name").agg(sites=("name", "size"), households=("households_planned", "sum"))
         .reset_index().sort_values("households", ascending=False))
    rows = [{"town": r.town_name, "in_taipei": r.town_name in TAIPEI, "sites": int(r.sites),
             "households": int(r.households)} for r in g.itertuples()]
    for t in sorted(TAIPEI - set(g.town_name)):
        rows.append({"town": t, "in_taipei": True, "sites": 0, "households": 0})
    payload = {
        "source": "data.taipei 659c3565 臺北市社會住宅興建工程進度（都發局），e3 2026-10-22 下載",
        "progress_counts": {k: int(v) for k, v in d.progress.value_counts().items()},
        "completed_sites": int(len(done)),
        "completed_households": int(done.households_planned.sum()),
        "by_town": rows,
    }
    out = HERE / "data" / "social-housing.js"
    out.write_text("window.SOCIAL_HOUSING = " + json.dumps(payload, ensure_ascii=False) + ";\n", encoding="utf-8")
    print(payload["completed_sites"], "sites", payload["completed_households"], "households")


if __name__ == "__main__":
    main()

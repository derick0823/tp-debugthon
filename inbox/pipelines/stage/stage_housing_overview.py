"""Stage the house-tax housing overview (臺北市房屋概況) by district and year.

The header says 戶 but the unit is buildings (棟): the 12 districts sum to the
official building-count table for 113 and 114 [docs/extra-data.md].

Usage:   uv run python -X utf8 -m pipelines.stage.stage_housing_overview
Input:   data/raw/extra/housing-stats/house-tax-housing-overview-by-tax-office/housing-overview-{113,114,115}.csv
Output:  data/staged/housing-stats/house-tax-housing-overview-by-tax-office.csv
         columns: year_roc, town_code, town_name, bld_1f, bld_2f, bld_3f, bld_4f, bld_5_6f,
                  bld_7_9f, bld_10_12f, bld_13_15f, bld_16f_plus, bld_age_lt30, bld_age_30plus,
                  bld_total, share_age_30plus, share_4_6f
Network: no
"""

import pandas as pd

from pipelines.address import TOWNS
from pipelines.common import RAW, STAGED

SRC = RAW / "extra" / "housing-stats" / "house-tax-housing-overview-by-tax-office"
OUT = STAGED / "housing-stats" / "house-tax-housing-overview-by-tax-office.csv"
COLS = ["bld_1f", "bld_2f", "bld_3f", "bld_4f", "bld_5_6f", "bld_7_9f", "bld_10_12f", "bld_13_15f",
        "bld_16f_plus", "bld_age_lt30", "bld_age_30plus"]


def main():
    frames = []
    for p in sorted(SRC.glob("housing-overview-*.csv")):
        # the 114 file has 13 trailing empty columns
        d = pd.read_csv(p, dtype=str, encoding="utf-8-sig", usecols=range(12))
        d.columns = ["office"] + COLS
        for c in COLS:
            d[c] = pd.to_numeric(d[c].str.replace(",", "").str.strip(), errors="coerce").astype(int)
        d["year_roc"] = int(p.stem.split("-")[-1])
        d["town_name"] = d["office"].str.replace("分處", "區", regex=False)
        frames.append(d)
    d = pd.concat(frames, ignore_index=True)
    d["town_code"] = d["town_name"].map(TOWNS)
    assert d["town_code"].notna().all(), d.loc[d.town_code.isna(), "office"].tolist()
    d["bld_total"] = d["bld_age_lt30"] + d["bld_age_30plus"]
    floors_total = d[COLS[:9]].sum(axis=1)
    print("floor sum == age sum:", (floors_total == d["bld_total"]).all())
    d["share_age_30plus"] = (d["bld_age_30plus"] / d["bld_total"]).round(4)
    d["share_4_6f"] = ((d["bld_4f"] + d["bld_5_6f"]) / d["bld_total"]).round(4)
    out = d[["year_roc", "town_code", "town_name"] + COLS + ["bld_total", "share_age_30plus", "share_4_6f"]]
    print(out.groupby("year_roc")[["bld_total", "bld_age_30plus"]].sum())
    OUT.parent.mkdir(parents=True, exist_ok=True)
    out.to_csv(OUT, index=False, encoding="utf-8")


if __name__ == "__main__":
    main()

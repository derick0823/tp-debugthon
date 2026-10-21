"""Stage the official building count table (臺北市現有營造建築物棟數), city level, by year.

Age bands exist only from ROC 96; earlier years have 0 in both age columns,
so they are written as empty.

Usage:   uv run python -X utf8 -m pipelines.stage.stage_building_count
Input:   data/raw/building-hazard/building-count/r000-53e04f4c.csv
Output:  data/staged/building-hazard/building-count.csv
         columns: year_roc, bld_total, bld_1f, bld_2f, bld_3f, bld_4f, bld_5_6f, bld_7_9f,
                  bld_10_12f, bld_13_15f, bld_16f_plus, bld_age_lt30, bld_age_30plus
Network: no
"""

import pandas as pd

from pipelines.common import RAW, STAGED

SRC = RAW / "building-hazard" / "building-count" / "r000-53e04f4c.csv"
OUT = STAGED / "building-hazard" / "building-count.csv"
COLS = ["bld_total", "bld_1f", "bld_2f", "bld_3f", "bld_4f", "bld_5_6f", "bld_7_9f", "bld_10_12f",
        "bld_13_15f", "bld_16f_plus", "bld_age_lt30", "bld_age_30plus"]


def main():
    d = pd.read_csv(SRC, dtype=str, encoding="utf-8-sig")
    d.columns = ["period"] + COLS
    d["year_roc"] = d["period"].str.extract(r"(\d+)")[0].astype(int)
    for c in COLS:
        d[c] = pd.to_numeric(d[c], errors="coerce").astype("Int64")
    no_age = (d["bld_age_lt30"] == 0) & (d["bld_age_30plus"] == 0)
    d.loc[no_age, ["bld_age_lt30", "bld_age_30plus"]] = pd.NA
    out = d[["year_roc"] + COLS]
    print(out.tail(3).to_string(index=False))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    out.to_csv(OUT, index=False, encoding="utf-8")


if __name__ == "__main__":
    main()

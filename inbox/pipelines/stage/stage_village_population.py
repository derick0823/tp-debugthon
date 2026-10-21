"""Stage village population by age: one row per village and month, both sexes.

Usage:   uv run python -X utf8 -m pipelines.stage.stage_village_population
Input:   data/raw/base/village-population-by-age/r00*.csv   (Big5, one column per age)
Output:  data/staged/base/village-population-by-age.csv
         columns: year_roc, month, town_code, village_code, village_name,
                  pop_total, pop_0_14, pop_15_64, pop_65plus, pop_75plus, pop_80plus, pop_85plus
Network: no
"""

import io
import re

import pandas as pd

from pipelines.common import RAW, STAGED, read_text

SRC = RAW / "base" / "village-population-by-age"
OUT = STAGED / "base" / "village-population-by-age.csv"


def age_of(col):
    m = re.match(r"(\d+)歲", col)
    return int(m.group(1)) if m else None


def main():
    frames = []
    for p in sorted(SRC.glob("r00*.csv")):
        text, _ = read_text(p)
        frames.append(pd.read_csv(io.StringIO(text), dtype={"區域代碼": str}))
    d = pd.concat(frames, ignore_index=True)
    d = d[(d["性別"] == "計") & (d["區域代碼"].str.len() == 11)].copy()
    ages = {c: age_of(c) for c in d.columns if age_of(c) is not None}
    num = d[list(ages)].apply(pd.to_numeric, errors="coerce").fillna(0)

    def band(lo, hi=999):
        return num[[c for c, a in ages.items() if lo <= a <= hi]].sum(axis=1).astype(int)

    out = pd.DataFrame({
        "year_roc": d["年份"].astype(int), "month": d["月份"].astype(int),
        "town_code": d["區域代碼"].str[:8], "village_code": d["區域代碼"],
        "village_name": d["區域別"].str.strip(),
        "pop_total": pd.to_numeric(d["總計"]).astype(int),
        "pop_0_14": band(0, 14), "pop_15_64": band(15, 64), "pop_65plus": band(65),
        "pop_75plus": band(75), "pop_80plus": band(80), "pop_85plus": band(85),
    })
    # the top age column is open-ended ("100歲以上"), so band sums must equal the total
    bad = (out.pop_0_14 + out.pop_15_64 + out.pop_65plus != out.pop_total).sum()
    print(f"rows={len(out)} months={out[['year_roc','month']].drop_duplicates().shape[0]} band_mismatch={bad}")
    out = out.sort_values(["year_roc", "month", "village_code"])
    OUT.parent.mkdir(parents=True, exist_ok=True)
    out.to_csv(OUT, index=False, encoding="utf-8")
    last = out[(out.year_roc == out.year_roc.max())]
    last = last[last.month == last.month.max()]
    print(f"latest {last.year_roc.iat[0]}/{last.month.iat[0]} villages={len(last)} "
          f"pop={last.pop_total.sum()} 65+={last.pop_65plus.sum()}")


if __name__ == "__main__":
    main()

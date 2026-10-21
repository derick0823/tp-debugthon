"""Stage city-level use permits by structure and year (使照按構造別，57-94 and 95+).

The two source tables use different structure categories; both are written to one
long table with a `scheme` column, and a common `structure_class` where possible.
In ROC 57-62 the per-structure building counts are 0 and the whole count sits in
"其他/棟數"; use permits and floor area for those years, not buildings.

Usage:   uv run python -X utf8 -m pipelines.stage.stage_use_permit_by_structure
Input:   data/raw/extra/housing-stats/use-permit-by-structure-57-94/use-permit-by-structure-57-94.csv
         data/raw/extra/housing-stats/use-permit-by-structure-95-plus/use-permit-by-structure-95-plus.csv
Output:  data/staged/housing-stats/use-permit-by-structure.csv
         columns: year_roc, year_ad, scheme (57-94|95-plus), structure, structure_class,
                  permits, buildings, floor_area_m2
Network: no
"""

import pandas as pd

from pipelines.common import RAW, STAGED

SRC = {
    "57-94": RAW / "extra" / "housing-stats" / "use-permit-by-structure-57-94" / "use-permit-by-structure-57-94.csv",
    "95-plus": RAW / "extra" / "housing-stats" / "use-permit-by-structure-95-plus" / "use-permit-by-structure-95-plus.csv",
}
OUT = STAGED / "housing-stats" / "use-permit-by-structure.csv"
CLASS = {"鋼骨鋼筋混凝土造": "src_steel", "鋼骨鋼筋混凝土構造": "src_steel", "鋼鐵或其他金屬構造": "src_steel",
         "鋼構造": "src_steel", "冷軋鋼構造": "src_steel", "鋼筋混凝土造": "rc", "混凝土構造": "rc",
         "加強磚造": "brick_reinforced", "磚構造": "brick", "木構造": "wood", "其他": "other", "總計": "total"}
MEASURE = {"件數[件]": "permits", "棟數[棟]": "buildings", "總面積[平方公尺]": "floor_area_m2"}


def main():
    rows = []
    for scheme, p in SRC.items():
        d = pd.read_csv(p, dtype=str, encoding="utf-8-sig")
        d["year_roc"] = d["統計期"].str.extract(r"(\d+)")[0].astype(int)
        long = d.drop(columns="統計期").melt("year_roc", var_name="col", value_name="value")
        long[["structure", "measure"]] = long["col"].str.split("/", n=1, expand=True)
        long["measure"] = long["measure"].map(MEASURE)
        long["value"] = pd.to_numeric(long["value"], errors="coerce")
        w = long.pivot_table(index=["year_roc", "structure"], columns="measure", values="value",
                             aggfunc="sum").reset_index()
        w["scheme"] = scheme
        rows.append(w)
    out = pd.concat(rows, ignore_index=True)
    out["year_ad"] = out["year_roc"] + 1911
    out["structure_class"] = out["structure"].map(CLASS).fillna("other")
    out = out[["year_roc", "year_ad", "scheme", "structure", "structure_class", "permits", "buildings",
               "floor_area_m2"]].sort_values(["year_roc", "structure"])
    print(out.groupby(["scheme", "structure_class"])["floor_area_m2"].sum())
    OUT.parent.mkdir(parents=True, exist_ok=True)
    out.to_csv(OUT, index=False, encoding="utf-8")


if __name__ == "__main__":
    main()

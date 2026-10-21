"""Stage use-permit summaries (使用執照摘要, ROC 90 onward) and locate each permit.

Combines the historical file (90-114) and the 115 file. Each row is one permit.
The original construction permit number (原核發執照, e.g. "088建字第0221號") is kept
as `cp_key` = "088-0221" so building-permit footprints can join to it.

Usage:   uv run python -X utf8 -m pipelines.stage.stage_use_permits
Input:   data/raw/extra/permits/use-permit-summary-historical/use-permit-90-114.flat.csv
         data/raw/extra/permits/use-permit-summary-115/use-permit-115.flat.csv
         data/staged/base/house-number-coordinates.parquet
Output:  data/staged/permits/use-permits.csv
         columns: permit_no, issued_year_ad, completed_date (ISO), completed_year_ad,
                  build_type (新建|增建|修建|改建), structure, structure_class, floors_above,
                  floors_below, units, buildings, height_m, town_name, address, cp_key,
                  village_code, x, y (EPSG:3826), geo_level, geo_note
Network: no
"""

import re

import pandas as pd

from pipelines.address import Geocoder, match_report
from pipelines.common import RAW, STAGED

SRC = [RAW / "extra" / "permits" / "use-permit-summary-historical" / "use-permit-90-114.flat.csv",
       RAW / "extra" / "permits" / "use-permit-summary-115" / "use-permit-115.flat.csv"]
OUT = STAGED / "permits" / "use-permits.csv"


def structure_class(s):
    """Map a free-text structure to rc | src_steel | brick_reinforced | brick | wood | other."""
    s = str(s)
    if "加強磚" in s:
        return "brick_reinforced"
    if "磚" in s:
        return "brick"
    if "鋼骨" in s or "鋼構" in s or "鋼架" in s or "鋼鐵" in s or "SRC" in s.upper():
        return "src_steel"
    if "RC" in s.upper() or "鋼筋混凝土" in s or "混凝土" in s:
        return "rc"
    if "木" in s:
        return "wood"
    return "other"


def roc7(s):
    s = str(s).strip()
    if not re.fullmatch(r"\d{6,7}", s):
        return pd.NaT
    s = s.zfill(7)
    try:
        return pd.Timestamp(int(s[:3]) + 1911, int(s[3:5]), int(s[5:]))
    except ValueError:
        return pd.NaT


def main():
    d = pd.concat([pd.read_csv(p, dtype=str, encoding="utf-8-sig") for p in SRC], ignore_index=True)
    d = d.drop_duplicates("執照號碼")
    d["completed"] = d["竣工日期"].map(roc7)
    cp = d["原核發執照"].str.extract(r"^(\d{2,3})建字第(\d+)號")
    d["cp_key"] = cp[0].str.zfill(3) + "-" + cp[1].str.zfill(4)
    out = pd.DataFrame({
        "permit_no": d["執照號碼"],
        "issued_year_ad": pd.to_numeric(d["執照年度"], errors="coerce") + 1911,
        "completed_date": d["completed"].dt.strftime("%Y-%m-%d"),
        "completed_year_ad": d["completed"].dt.year,
        "build_type": d["建造類別"], "structure": d["構造種類"],
        "structure_class": d["構造種類"].map(structure_class),
        "floors_above": pd.to_numeric(d["地上層數"], errors="coerce"),
        "floors_below": pd.to_numeric(d["地下層數"], errors="coerce"),
        "units": pd.to_numeric(d["戶數"], errors="coerce"),
        "buildings": pd.to_numeric(d["棟數"], errors="coerce"),
        "height_m": pd.to_numeric(d["建物高度"].str.replace("M", "", regex=False), errors="coerce"),
        "town_name": d["行政區"], "address": d["地址_首筆"], "cp_key": d["cp_key"],
    })
    out = Geocoder().locate_frame(out, "address")
    match_report(out, "use-permits")
    print(f"permits={len(out)} no address={out.address.isna().sum()} cp_key={out.cp_key.notna().sum()}")
    OUT.parent.mkdir(parents=True, exist_ok=True)
    out.to_csv(OUT, index=False, encoding="utf-8")


if __name__ == "__main__":
    main()

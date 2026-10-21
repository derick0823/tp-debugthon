"""Stage Taipei real-price registration sales (實價登錄，買賣) with a building, and locate each one.

One row per transaction that includes a building (交易標的 contains 建物).
Duplicates by 編號 are dropped. This is a sample of traded buildings, not the
building stock (see the research report).

Two outputs:
  * the CSV keeps only the 4 recent seasons (114S4-115S3). The village indicators
    and the R1 report use it, so their numbers stay fixed.
  * the Parquet keeps every season from 101S4 (history backfill, R1c). The building
    table uses it to give each building a built year and structure.
Old and new season files share the same column names (checked 2026-10-18).

Usage:   uv run python -X utf8 -m pipelines.stage.stage_real_price_registration
Input:   data/raw/extra/housing-stats/real-price-registration-lvr/taipei-<season>/a_lvr_land_a.csv
         data/raw/extra/housing-stats/lvr-history/<season>/a_lvr_land_a.csv
         data/staged/base/house-number-coordinates.parquet
Output:  data/staged/housing-stats/real-price-registration-lvr.csv          (4 recent seasons)
         data/staged/housing-stats/real-price-registration-lvr-all.parquet  (all seasons)
         columns: txn_id, season, town_name, address, trade_date (ISO), built_date (ISO),
                  built_year_ad, building_type, has_elevator, total_floors, structure,
                  structure_class, main_use, transfer_floors, includes_ground_floor,
                  zoning, building_area_m2, total_price, village_code,
                  x, y (EPSG:3826), geo_level, geo_note, building_key
Network: no
"""

import re

import pandas as pd

from pipelines.address import Geocoder, cn_to_int, match_report, normalize
from pipelines.common import RAW, STAGED
from pipelines.stage.stage_use_permits import roc7, structure_class

SRC = RAW / "extra" / "housing-stats" / "real-price-registration-lvr"
HISTORY = RAW / "extra" / "housing-stats" / "lvr-history"
OUT = STAGED / "housing-stats" / "real-price-registration-lvr.csv"
OUT_ALL = STAGED / "housing-stats" / "real-price-registration-lvr-all.parquet"
RECENT = ["114S4", "115S1", "115S2", "115S3"]
TYPES = {"住宅大樓(11層含以上有電梯)": "tower_11plus", "華廈(10層含以下有電梯)": "midrise_elevator",
         "公寓(5樓含以下無電梯)": "walkup_5_or_less", "透天厝": "townhouse", "套房(1房1廳1衛)": "studio",
         "店面(店鋪)": "shop", "辦公商業大樓": "office", "工廠": "factory", "廠辦": "factory_office",
         "倉庫": "warehouse", "農舍": "farmhouse", "其他": "other"}


def floors(s):
    m = re.match(r"^(.+?)層$", str(s))
    if not m:
        return None
    return cn_to_int(m.group(1))


def includes_ground(s):
    """True when 移轉層次 lists the ground floor ("一層") or the whole building ("全").

    Tokens are split on commas, so "十一層" does not count as "一層".
    """
    if not isinstance(s, str):
        return False
    tokens = [x.strip() for x in s.replace("，", ",").replace("、", ",").split(",")]
    return any(x.startswith("一層") or x.startswith("全") for x in tokens)


def read_season(p, season):
    a = pd.read_csv(p, dtype=str, skiprows=[1], encoding="utf-8-sig")
    a["season"] = season
    return a


def main():
    frames = [read_season(p, p.parent.name.replace("taipei-", "")) for p in sorted(SRC.glob("taipei-*/a_lvr_land_a.csv"))]
    frames += [read_season(p, p.parent.name) for p in sorted(HISTORY.glob("*/a_lvr_land_a.csv"))]
    a = pd.concat(frames, ignore_index=True)
    n_all = len(a)
    a = a[a["交易標的"].str.contains("建物", na=False)].drop_duplicates("編號")
    built = a["建築完成年月"].map(roc7)
    out = pd.DataFrame({
        "txn_id": a["編號"], "season": a["season"], "town_name": a["鄉鎮市區"],
        "address": a["土地位置建物門牌"],
        "trade_date": a["交易年月日"].map(roc7).dt.strftime("%Y-%m-%d"),
        "built_date": built.dt.strftime("%Y-%m-%d"), "built_year_ad": built.dt.year,
        "building_type": a["建物型態"].map(lambda s: TYPES.get(s, "other") if isinstance(s, str) else None),
        "has_elevator": a["電梯"].map({"有": True, "無": False}),
        "total_floors": a["總樓層數"].map(floors),
        "structure": a["主要建材"].map(normalize),
        "main_use": a["主要用途"],
        "transfer_floors": a["移轉層次"],
        "includes_ground_floor": a["移轉層次"].map(includes_ground),
        "zoning": a["都市土地使用分區"],
        "building_area_m2": pd.to_numeric(a["建物移轉總面積平方公尺"], errors="coerce"),
        "total_price": pd.to_numeric(a["總價元"], errors="coerce"),
    })
    out["structure_class"] = out["structure"].map(lambda s: structure_class(s) if s else None)
    out.loc[out["structure"].str.contains("見使用執照", na=False), "structure_class"] = None
    out = Geocoder().locate_frame(out, "address")
    match_report(out, "real-price-registration")
    print(f"rows in files={n_all} with building={len(out)} built year known={out.built_year_ad.notna().sum()}")
    print(out["structure_class"].value_counts(dropna=False).to_dict())
    print(f"seasons={out.season.nunique()} buildings with key={out.building_key.nunique()}")
    OUT.parent.mkdir(parents=True, exist_ok=True)
    out.to_parquet(OUT_ALL, index=False)
    out[out.season.isin(RECENT)].to_csv(OUT, index=False, encoding="utf-8")


if __name__ == "__main__":
    main()

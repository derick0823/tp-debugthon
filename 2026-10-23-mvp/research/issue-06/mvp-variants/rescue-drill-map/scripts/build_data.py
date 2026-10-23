"""Data files for MVP variant C: the rescue-access drill map (S5), for 里長 and fire units.

Everything comes from data/marts and data/staged; nothing new is fetched. Sources are
all open-licensed (data.taipei, BOCH, NLSC): no national 2026 liquefaction geometry.

Usage:   uv run python -X utf8 research/issue-06/mvp-variants/rescue-drill-map/scripts/build_data.py
Input:   data/marts/village_rankings.geojson, data/marts/village_indicators.csv
         data/staged/hazard/narrow-lanes-red-yellow.csv
         data/staged/building-hazard/fire-access-lanes.csv
         data/staged/land/cultural-heritage.geojson
         data/staged/building-hazard/soil-liquefaction.geojson
Output:  research/issue-06/mvp-variants/rescue-drill-map/data/
           villages.geojson, narrow_lanes.geojson, fire_access_lanes.json,
           heritage.geojson, liq_high_city2019.geojson, meta.json
         (generated, not committed; run this script)
Network: no
"""

import json
import sys
from datetime import date
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[4]
sys.path.insert(0, str(ROOT))

import geopandas as gpd  # noqa: E402
import pandas as pd  # noqa: E402

from pipelines.common import MARTS, STAGED, CRS_TWD97, CRS_WGS84  # noqa: E402

OUT = HERE.parent / "data"
V_COLS = ["village_code", "town_code", "town_name", "village_name", "s5_candidate", "s5_reason",
          "lv_elderly", "lv_old_stock", "lv_liquefaction_city2019", "lv_rescue", "lv_soft_story"]
I_COLS = ["village_code", "pop_total", "pop_80plus", "share_80plus", "share_65plus", "narrow_lanes_n",
          "narrow_lanes_red_n", "fire_access_lanes", "fire_rescue_sites_n", "heritage_sites_n", "soft_story_a_n",
          "soft_story_b_n", "liq_high_share_city2019", "liq_medium_share_city2019", "doorplate_buildings",
          "bld_share_pre_policy_1999", "bld_age_known_unit_share"]


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    r = gpd.read_file(MARTS / "village_rankings.geojson")[V_COLS + ["geometry"]]
    i = pd.read_csv(MARTS / "village_indicators.csv", dtype={"village_code": str})[I_COLS]
    v = r.merge(i, on="village_code")
    v["s5_candidate"] = v["s5_candidate"].astype(bool)
    v.to_file(OUT / "villages.geojson", driver="GeoJSON", COORDINATE_PRECISION=5)

    n = pd.read_csv(STAGED / "hazard" / "narrow-lanes-red-yellow.csv", dtype={"village_code": str})
    n = n[n.geo_level.between(1, 3)]
    g = gpd.GeoDataFrame(n[["lane_id", "zone", "lane_name", "width_m", "fire_unit", "village_code", "geo_level"]],
                         geometry=gpd.points_from_xy(n.x, n.y), crs=CRS_TWD97).to_crs(CRS_WGS84)
    g.to_file(OUT / "narrow_lanes.geojson", driver="GeoJSON", COORDINATE_PRECISION=5)

    f = pd.read_csv(STAGED / "building-hazard" / "fire-access-lanes.csv", dtype={"village_code": str})
    by = {k: d[["lane_name", "criteria", "site_type", "fire_unit"]].to_dict("records")
          for k, d in f.dropna(subset=["village_code"]).groupby("village_code")}
    (OUT / "fire_access_lanes.json").write_text(json.dumps(by, ensure_ascii=False), encoding="utf-8")

    h = gpd.read_file(STAGED / "land" / "cultural-heritage.geojson")[["case_name", "category", "class_name",
                                                                       "village_code", "geometry"]]
    h.to_file(OUT / "heritage.geojson", driver="GeoJSON", COORDINATE_PRECISION=5)

    liq = gpd.read_file(STAGED / "building-hazard" / "soil-liquefaction.geojson")
    liq = liq[liq.level == "high"].to_crs(CRS_TWD97)
    liq["geometry"] = liq.simplify(15)
    liq.to_crs(CRS_WGS84)[["level", "geometry"]].to_file(OUT / "liq_high_city2019.geojson", driver="GeoJSON",
                                                           COORDINATE_PRECISION=5)
    meta = {"generated": date.today().isoformat(),
            "candidates": int(v.s5_candidate.sum()),
            "sources": {"villages": "NLSC 115/8/17; population 115/9; rankings data/marts",
                        "narrow_lanes": "data.taipei 狹小巷道清冊（紅黃區）, 2026-10-17 下載; 位置為該巷門牌中心（推估）",
                        "fire_access_lanes": "data.taipei 消防通道清冊, 2026-10-17 下載; 無座標",
                        "heritage": "文化部文資局開放資料 v2, 2026-10-18 下載",
                        "liquefaction": "臺北市土壤液化潛勢圖（城市版 2019, data.taipei）, class 1＝高【推論，鑽孔驗證】"}}
    (OUT / "meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=1), encoding="utf-8")
    sizes = {p.name: round(p.stat().st_size / 1e6, 2) for p in OUT.iterdir()}
    print(f"candidates={meta['candidates']} lanes={len(g)} heritage={len(h)} sizes_mb={sizes}")


if __name__ == "__main__":
    main()

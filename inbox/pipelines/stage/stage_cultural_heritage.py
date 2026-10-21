"""Stage Taipei cultural heritage sites with a location (古蹟、歷史建築、紀念建築、聚落建築群).

Source: the national case lists (pipelines.fetch.fetch_heritage_boch), which carry
latitude, longitude and addresses. Rows are kept when the point falls inside Taipei
or the address says 臺北市. A row without usable coordinates is placed from its
address with pipelines.address (geo_level 1-3 only).

Usage:   uv run python -X utf8 -m pipelines.stage.stage_cultural_heritage
Input:   data/raw/extra/land/cultural-heritage-boch/assetsCase-1.*.json
         data/staged/base/village-boundary-nlsc.geojson
         data/staged/base/house-number-coordinates.parquet
Output:  data/staged/land/cultural-heritage.geojson  (EPSG:4326)
         columns: case_id, case_name, category (monument|historic_building|memorial_building|settlement),
                  class_name, address, village_code, geo_source (coords|address), geo_level
Network: no
"""

import json

import geopandas as gpd
import pandas as pd

from pipelines.address import Geocoder
from pipelines.common import RAW, STAGED, CRS_TWD97, CRS_WGS84

SRC = RAW / "extra" / "land" / "cultural-heritage-boch"
VILLAGES = STAGED / "base" / "village-boundary-nlsc.geojson"
OUT = STAGED / "land" / "cultural-heritage.geojson"
CATEGORY = {"1.1": "monument", "1.2": "historic_building", "1.3": "memorial_building", "1.4": "settlement"}


def first_address(addrs):
    if not addrs:
        return None, None
    a = addrs[0]
    city = (a.get("cityName") or "").replace("台", "臺")
    return city, f"{city}{a.get('distName') or ''}{a.get('address') or ''}"


def main():
    rows = []
    for p in sorted(SRC.glob("assetsCase-1.*.json")):
        code = p.stem.replace("assetsCase-", "")
        for r in json.loads(p.read_text(encoding="utf-8")):
            city, addr = first_address(r.get("addresses"))
            rows.append({"case_id": r.get("caseId"), "case_name": r.get("caseName"),
                         "category": CATEGORY.get(code, code), "class_name": r.get("assetsClassifyName"),
                         "city": city, "address": addr,
                         "lon": pd.to_numeric(r.get("longitude"), errors="coerce"),
                         "lat": pd.to_numeric(r.get("latitude"), errors="coerce")})
    d = pd.DataFrame(rows).drop_duplicates("case_id")
    v = gpd.read_file(VILLAGES).to_crs(CRS_TWD97)[["village_code", "geometry"]]
    ok = d.lon.between(119, 123) & d.lat.between(21, 26)
    pts = gpd.GeoDataFrame(d[ok], geometry=gpd.points_from_xy(d[ok].lon, d[ok].lat), crs=CRS_WGS84).to_crs(CRS_TWD97)
    j = gpd.sjoin(pts, v, how="left", predicate="within").drop_duplicates("case_id")
    d["village_code"] = d.case_id.map(j.set_index("case_id").village_code)
    d["geo_source"] = d.village_code.notna().map({True: "coords", False: None})
    d["geo_level"] = d.village_code.notna().map({True: 1, False: 0})
    # Taipei rows by address but outside the boundary or without coordinates: geocode the address
    need = (d.city == "臺北市") & d.village_code.isna()
    if need.any():
        gc = Geocoder()
        for i in d[need].index:
            hit = gc.locate(d.at[i, "address"])
            if hit["geo_level"] and hit["geo_level"] <= 3:
                d.at[i, "village_code"] = hit["village_code"]
                d.at[i, "geo_source"], d.at[i, "geo_level"] = "address", hit["geo_level"]
                d.at[i, "x"], d.at[i, "y"] = hit["x"], hit["y"]
    tp = d[d.village_code.notna()].copy()
    xy = gpd.GeoSeries(gpd.points_from_xy(tp.lon, tp.lat), crs=CRS_WGS84).to_crs(CRS_TWD97)
    if "x" in tp:
        use_addr = tp.geo_source.eq("address").values
        xy = gpd.GeoSeries([gpd.points_from_xy([x], [y])[0] if a else g
                            for g, a, x, y in zip(xy, use_addr, tp.get("x"), tp.get("y"))], crs=CRS_TWD97)
    g = gpd.GeoDataFrame(tp[["case_id", "case_name", "category", "class_name", "address", "village_code",
                             "geo_source", "geo_level"]].reset_index(drop=True), geometry=xy.values, crs=CRS_TWD97)
    print(f"national rows={len(d)} taipei located={len(g)} by={g.geo_source.value_counts().to_dict()} "
          f"taipei by address not located={int(((d.city == '臺北市') & d.village_code.isna()).sum())}")
    print(g.category.value_counts().to_dict())
    OUT.parent.mkdir(parents=True, exist_ok=True)
    g.to_crs(CRS_WGS84).to_file(OUT, driver="GeoJSON")


if __name__ == "__main__":
    main()

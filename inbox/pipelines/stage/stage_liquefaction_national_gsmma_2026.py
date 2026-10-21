"""Stage the national liquefaction map 2026 (GSMMA), clipped to Taipei.

Usage:   uv run python -X utf8 -m pipelines.stage.stage_liquefaction_national_gsmma_2026
Input:   data/raw/extra/hazard/liquefaction-national-gsmma-2026/soil-cgs-2026-taipei-bbox.geojson
         data/staged/base/village-boundary-nlsc.geojson  (city outline for clipping)
Output:  data/staged/hazard/liquefaction-national-gsmma-2026.geojson  (EPSG:4326)
         columns: level (high|medium|low|none), source_type, area_m2
Network: no
"""

import geopandas as gpd
from shapely.validation import make_valid

from pipelines.common import RAW, STAGED, CRS_WGS84, CRS_TWD97

SRC = RAW / "extra" / "hazard" / "liquefaction-national-gsmma-2026" / "soil-cgs-2026-taipei-bbox.geojson"
CITY = STAGED / "base" / "village-boundary-nlsc.geojson"
OUT = STAGED / "hazard" / "liquefaction-national-gsmma-2026.geojson"
LEVEL = {"HIGH": "high", "MED": "medium", "LOW": "low", "NOT": "none"}


def main():
    g = gpd.read_file(SRC).to_crs(CRS_TWD97)
    g["geometry"] = g.geometry.map(make_valid)
    g["source_type"] = g["TYPE"]
    g["level"] = g["TYPE"].map(LEVEL)
    city = gpd.read_file(CITY).to_crs(CRS_TWD97).union_all()
    g = g.dissolve("level", as_index=False)[["level", "source_type", "geometry"]]
    g["geometry"] = g.geometry.intersection(city)
    g["area_m2"] = g.area.round(0)
    print(g[["level", "area_m2"]].assign(km2=lambda x: x.area_m2 / 1e6).to_string(index=False))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    g.to_crs(CRS_WGS84).to_file(OUT, driver="GeoJSON")


if __name__ == "__main__":
    main()

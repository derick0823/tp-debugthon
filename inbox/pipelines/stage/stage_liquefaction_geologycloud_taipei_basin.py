"""Stage the older national liquefaction map for the Taipei basin (geologycloud).

Usage:   uv run python -X utf8 -m pipelines.stage.stage_liquefaction_geologycloud_taipei_basin
Input:   data/raw/extra/hazard/liquefaction-geologycloud-taipei-basin/taipei-basin-{high,med,low}.json
         data/staged/base/village-boundary-nlsc.geojson  (city outline for clipping)
Output:  data/staged/hazard/liquefaction-geologycloud-taipei-basin.geojson  (EPSG:4326)
         columns: level (high|medium|low), area_m2
Network: no
"""

import geopandas as gpd
import pandas as pd
from shapely.validation import make_valid

from pipelines.common import RAW, STAGED, CRS_WGS84, CRS_TWD97

SRC = RAW / "extra" / "hazard" / "liquefaction-geologycloud-taipei-basin"
CITY = STAGED / "base" / "village-boundary-nlsc.geojson"
OUT = STAGED / "hazard" / "liquefaction-geologycloud-taipei-basin.geojson"
FILES = {"high": "taipei-basin-high.json", "medium": "taipei-basin-med.json", "low": "taipei-basin-low.json"}


def main():
    parts = []
    for level, name in FILES.items():
        g = gpd.read_file(SRC / name).to_crs(CRS_TWD97)
        g["level"] = level
        parts.append(g[["level", "geometry"]])
    g = gpd.GeoDataFrame(pd.concat(parts, ignore_index=True), crs=CRS_TWD97)
    g["geometry"] = g.geometry.map(make_valid)
    g = g.dissolve("level", as_index=False)
    city = gpd.read_file(CITY).to_crs(CRS_TWD97).union_all()
    g["geometry"] = g.geometry.intersection(city)
    g["area_m2"] = g.area.round(0)
    print(g[["level", "area_m2"]].assign(km2=lambda x: x.area_m2 / 1e6).to_string(index=False))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    g.to_crs(CRS_WGS84).to_file(OUT, driver="GeoJSON")


if __name__ == "__main__":
    main()

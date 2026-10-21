"""Stage the city liquefaction map (soil.taipei, the one listed by issue 6).

class 1 = high, 2 = medium, 3 = low [inference, strong evidence: borehole PL medians
18.9 / 8.1 / 0, see docs/issues/06-seismic-old-buildings.md].

Usage:   uv run python -X utf8 -m pipelines.stage.stage_soil_liquefaction
Input:   data/raw/building-hazard/soil-liquefaction/r000-980834a9.geojson  (TWD97, TPLiquid_97)
Output:  data/staged/building-hazard/soil-liquefaction.geojson  (EPSG:4326)
         columns: level (high|medium|low), source_class, area_m2
Network: no
"""

import geopandas as gpd
from shapely.validation import make_valid

from pipelines.common import RAW, STAGED, CRS_WGS84, CRS_TWD97

SRC = RAW / "building-hazard" / "soil-liquefaction" / "r000-980834a9.geojson"
OUT = STAGED / "building-hazard" / "soil-liquefaction.geojson"
LEVEL = {"1": "high", "2": "medium", "3": "low"}


def main():
    g = gpd.read_file(SRC).set_crs(CRS_TWD97, allow_override=True)
    g["source_class"] = g["class"].astype(str)
    g["level"] = g["source_class"].map(LEVEL)
    g["geometry"] = g.geometry.map(make_valid)
    g = g.dissolve("level", as_index=False)[["level", "source_class", "geometry"]]
    g["area_m2"] = g.area.round(0)
    print(g[["level", "area_m2"]].assign(km2=lambda x: x.area_m2 / 1e6).to_string(index=False))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    g.to_crs(CRS_WGS84).to_file(OUT, driver="GeoJSON")


if __name__ == "__main__":
    main()

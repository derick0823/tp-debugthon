"""Build the building table: one row per house-number building in Taipei (S2 base).

A "building" is one base house number (town + road + lane + alley + number);
all floors and 之-numbers of it are one row. Each attribute says where it comes
from, using the status values of ops/CONVENTIONS.md §4a:
  confirmed     an official list or permit says so
  estimated     inferred from real-price transactions at this address
  undetermined  no data for this building

Built year and code generation:
  * confirmed: a new-build use permit (90-115) matched to this exact address;
  * estimated: median built year of real-price transactions at this address (101S4-115S3);
  * otherwise undetermined.
  The code generation uses an assumed application year = built year - LAG_YEARS
  [inference: completion usually follows the permit application by 2-3 years].
  Breakpoints are the design-year cuts of the official preliminary assessment form
  (ROC 63-02, 71-06, 78-05, 86-05) and the 1999 policy line (88-12-31), from
  research/issue-06/gov-reports/notes/_bundle-assessment-methods.md.

Soft-story candidate (一樓軟弱層候選): research/issue-06/gov-reports/soft-story-spec.md.

Usage:   uv run python -X utf8 -m pipelines.build.build_building_points
Input:   data/staged/base/house-number-coordinates.parquet
         data/staged/building-hazard/soil-liquefaction.geojson
         data/staged/hazard/liquefaction-national-gsmma-2026.geojson
         data/staged/permits/use-permits.csv
         data/staged/housing-stats/real-price-registration-lvr-all.parquet
         data/staged/renewal/sea-sand-houses-full-list.csv
         data/staged/hazard/earthquake-listed-buildings.csv
         data/staged/land/cultural-heritage.geojson
Output:  data/marts/building_points.parquet   (all columns, EPSG:4326 lon/lat)
         data/marts/building_points.csv       (same columns, no geometry column)
         data/marts/building_points_lite.geojson  (display columns; only buildings with a built year or a flag)
Network: no
"""

import hashlib

import geopandas as gpd
import numpy as np
import pandas as pd

from pipelines.address import building_key
from pipelines.common import MARTS, STAGED, CRS_TWD97, CRS_WGS84

LAG_YEARS = 2
# (label, last assumed application year that still belongs to the generation)
GENERATIONS = [
    ("g1_pre1974", 1973),        # before ROC 63-02: no seismic force in the building code
    ("g2_1974_1982", 1981),      # ROC 63-02 .. 71-06
    ("g3_1982_1989", 1988),      # ROC 71-06 .. 78-05
    ("g4_1989_1997", 1996),      # ROC 78-05 .. 86-05
    ("g5_1997_1999", 1999),      # ROC 86-05 .. 88-12-31 (policy line)
    ("g6_2000_plus", 9999),      # applied after the 1999 policy line
]
COMMERCIAL_USE = ("商業用", "住商用")
SEA_SAND_LIST_VERSION = "115.3.25"     # 海砂屋完整列管清冊
QUAKE_LIST_VERSION = "115.3.18"        # 921、331、403 地震列管建築物
HERITAGE_RADIUS_M = 50
NEIGHBOR_RANGE = 4                    # L2: house numbers within ±4 on the same lane or alley
NEIGHBOR_MARGIN = 5                   # L2: neighbour year ±5 years
NEIGHBOR_MAX_SPREAD = 10              # L2: skip when the neighbours disagree by more than this


def generation(built_year):
    if pd.isna(built_year):
        return None
    app = built_year - LAG_YEARS
    for label, last in GENERATIONS:
        if app <= last:
            return label
    return None


def point_id(key):
    return hashlib.sha1(key.encode("utf-8")).hexdigest()[:12]


def mode(s):
    s = s.dropna()
    return s.mode().iat[0] if len(s) else None


def buildings():
    hn = pd.read_parquet(STAGED / "base" / "house-number-coordinates.parquet")
    hn = hn[hn["no"].notna()]
    b = (hn.groupby(["town_code", "road", "lane", "alley", "no"])
           .agg(village_code=("village_code", lambda s: s.mode().iat[0]),
                x=("x", "mean"), y=("y", "mean"), lon=("lon", "mean"), lat=("lat", "mean"),
                doorplate_units=("village_code", "size"))
           .reset_index())
    b["building_key"] = [building_key(*r) for r in
                         b[["town_code", "road", "lane", "alley", "no"]].itertuples(index=False)]
    b["point_id"] = b["building_key"].map(point_id)
    b["on_main_road"] = (b["lane"] == "") & (b["alley"] == "")
    b["address"] = (b["road"] + b["lane"].where(b["lane"] == "", b["lane"] + "巷")
                    + b["alley"].where(b["alley"] == "", b["alley"] + "弄") + b["no"].astype(int).astype(str) + "號")
    return b


def liquefaction(b):
    pts = gpd.GeoDataFrame(b[["point_id"]], geometry=gpd.points_from_xy(b.x, b.y), crs=CRS_TWD97)
    out = {}
    for name, path in [("city2019", STAGED / "building-hazard" / "soil-liquefaction.geojson"),
                       ("national2026", STAGED / "hazard" / "liquefaction-national-gsmma-2026.geojson")]:
        poly = gpd.read_file(path).to_crs(CRS_TWD97)[["level", "geometry"]]
        j = gpd.sjoin(pts, poly, how="left", predicate="within").drop_duplicates("point_id")
        out[name] = j.set_index("point_id")["level"]
    c = out["city2019"].reindex(b.point_id).values
    n = out["national2026"].reindex(b.point_id).values
    b["liq_level_city2019"] = pd.Series(c).fillna("not_mapped").values
    b["liq_level_national2026"] = pd.Series(n).fillna("not_mapped").values

    def agree(ci, ni):
        hi_c, hi_n = ci == "high", ni == "high"
        if hi_c and hi_n:
            return "both_high"
        if hi_c or hi_n:
            return "one_high"
        if ci in ("not_mapped",) and ni in ("none", "not_mapped"):
            return "undetermined"
        return "neither_high"

    b["liq_agreement"] = [agree(ci, ni) for ci, ni in zip(b.liq_level_city2019, b.liq_level_national2026)]
    return b


def permits(b):
    up = pd.read_csv(STAGED / "permits" / "use-permits.csv", dtype={"building_key": str})
    up = up[(up.build_type == "新建") & (up.geo_level == 1) & up.building_key.notna()]
    up = up.sort_values("completed_year_ad").drop_duplicates("building_key", keep="last")
    up = up.set_index("building_key")
    b["permit_completed_year"] = b.building_key.map(up["completed_year_ad"])
    b["permit_structure_class"] = b.building_key.map(up["structure_class"])
    b["permit_floors"] = b.building_key.map(up["floors_above"])
    return b


def real_price(b):
    lv = pd.read_parquet(STAGED / "housing-stats" / "real-price-registration-lvr-all.parquet")
    lv = lv[(lv.geo_level == 1) & lv.building_key.notna()].copy()
    lv["ground_commercial"] = (lv.includes_ground_floor & lv.main_use.isin(COMMERCIAL_USE)) | (lv.building_type == "shop")
    lv["zoning_commercial"] = lv.zoning.fillna("").str.contains("商")
    g = lv.groupby("building_key")
    agg = pd.DataFrame({
        "lvr_txn_n": g.size(),
        "lvr_built_year": g["built_year_ad"].median(),
        "lvr_built_year_spread": (g["built_year_ad"].max() - g["built_year_ad"].min()),
        "lvr_structure_class": g["structure_class"].agg(mode),
        "lvr_total_floors": g["total_floors"].agg(mode),
        "lvr_building_type": g["building_type"].agg(mode),
        "lvr_has_elevator": g["has_elevator"].agg(mode),
        "lvr_ground_commercial": g["ground_commercial"].any(),
        "lvr_zoning_commercial": g["zoning_commercial"].any(),
    })
    b = b.merge(agg, left_on="building_key", right_index=True, how="left")
    b["lvr_txn_n"] = b["lvr_txn_n"].fillna(0).astype(int)
    return b


def known_cases(b):
    ss = pd.read_csv(STAGED / "renewal" / "sea-sand-houses-full-list.csv", dtype={"building_key": str})
    ss = ss[ss.building_key.notna()].drop_duplicates("building_key").set_index("building_key")
    q = pd.read_csv(STAGED / "hazard" / "earthquake-listed-buildings.csv", dtype={"building_key": str})
    q = q[q.building_key.notna()].drop_duplicates("building_key").set_index("building_key")
    b["sea_sand"] = b.building_key.map(ss["category"])           # rebuild | retrofit | NaN
    b["sea_sand_permit_year"] = b.building_key.map(ss["permit_year_ad"])
    b["quake_listed"] = b.building_key.map(q["quake"])            # 921 | 331 | 403 | NaN
    # the list's own address text and version, so the card can quote the official list
    b["sea_sand_list_address"] = b.building_key.map(ss["address"])
    b["sea_sand_list_version"] = np.where(b.sea_sand.notna(), SEA_SAND_LIST_VERSION, None)
    b["quake_listed_address"] = b.building_key.map(q["address"])
    b["quake_listed_version"] = np.where(b.quake_listed.notna(), QUAKE_LIST_VERSION, None)
    return b


def heritage(b):
    """near_heritage_50m: a heritage site point (古蹟、歷史建築、紀念建築、聚落) within 50 m.

    Heritage sites are single points, so a large site is measured from its point only.
    For pre-checks and feasibility screening, not a legal boundary.
    """
    h = gpd.read_file(STAGED / "land" / "cultural-heritage.geojson").to_crs(CRS_TWD97)
    rings = gpd.GeoDataFrame(geometry=h.buffer(HERITAGE_RADIUS_M), crs=CRS_TWD97)
    pts = gpd.GeoDataFrame({"i": range(len(b))}, geometry=gpd.points_from_xy(b.x, b.y), crs=CRS_TWD97)
    hits = gpd.sjoin(pts, rings, how="inner", predicate="within").groupby("i").size()
    b["heritage_n_50m"] = hits.reindex(range(len(b))).fillna(0).astype(int).values
    b["near_heritage_50m"] = b["heritage_n_50m"] > 0
    return b


def age_fields(b):
    has_permit = b.permit_completed_year.notna()
    has_lvr = b.lvr_built_year.notna()
    b["built_year"] = pd.Series(np.where(has_permit, b.permit_completed_year, b.lvr_built_year), index=b.index).round(0)
    b["status_built_year"] = np.select([has_permit, has_lvr], ["confirmed", "estimated"], "undetermined")
    # a sea-sand permit number gives the permit year: confirmed when nothing better exists
    ss_year = b.sea_sand_permit_year.notna() & ~has_permit
    b.loc[ss_year, "built_year"] = b.loc[ss_year, "sea_sand_permit_year"]
    b.loc[ss_year, "status_built_year"] = "confirmed"
    # K6 §10 ladder (adopted parts): where the year comes from, and how far to trust it
    b["age_source"] = np.select([has_permit, ss_year, has_lvr], ["permit", "sea_sand_list", "lvr"], "none")
    spread = b["lvr_built_year_spread"].fillna(0)
    b["age_conf"] = np.select([b.age_source.isin(["permit", "sea_sand_list"]),
                               (b.age_source == "lvr") & (spread <= 2), b.age_source == "lvr"],
                              ["high", "high", "medium"], "")
    b["code_generation"] = b["built_year"].map(generation)
    b["pre_policy_1999"] = (b["built_year"] - LAG_YEARS <= 1999).where(b["built_year"].notna())
    b["structure_class"] = b.permit_structure_class.where(has_permit, b.lvr_structure_class)
    b["status_structure"] = np.select([has_permit & b.permit_structure_class.notna(),
                                       b.lvr_structure_class.notna()], ["confirmed", "estimated"], "undetermined")
    b["floors"] = b.permit_floors.where(has_permit, b.lvr_total_floors)
    b["status"] = b["status_built_year"]       # contract column: status of the built year
    # why the built year is undetermined; shown on screen so the gap is not a silent blank.
    # Permits exist only from ROC 90 (2001), so older buildings depend on a sale record.
    b["undetermined_reason"] = np.select(
        [b.status != "undetermined", b.lvr_txn_n > 0],
        ["", "sale_without_built_year"], "no_sale_since_2012_no_permit")
    # S2 situation C/D (R2b): 30 years or older and no elevator; walk-ups count as no elevator
    no_lift = (b.lvr_has_elevator == False) | (b.lvr_building_type == "walkup_5_or_less")  # noqa: E712
    b["no_elevator_30plus"] = no_lift & (b["built_year"] <= 1996)
    return b


def neighbor_ages(b):
    """K6 L2: borrow a year range from neighbours on the same lane or alley.

    For an undetermined building, take known (permit / list / real-price) neighbours
    with house numbers within ±NEIGHBOR_RANGE. If their years agree within
    NEIGHBOR_MAX_SPREAD, give built_year_min/max = their min/max ± NEIGHBOR_MARGIN.
    built_year stays empty: this is a range, not a year [inference: row houses on one
    lane were often built as one project].
    """
    b["built_year_min"] = b["built_year"]
    b["built_year_max"] = b["built_year"]
    key = ["town_code", "road", "lane", "alley"]
    known = b[b.age_source.isin(["permit", "sea_sand_list", "lvr"])]
    todo = b[b.status == "undetermined"]
    kg = {k: (g["no"].to_numpy(float), g["built_year"].to_numpy(float)) for k, g in known.groupby(key)}
    lo, hi = {}, {}
    for k, g in todo.groupby(key):
        if k not in kg:
            continue
        kn, ky = kg[k]
        for idx, no in zip(g.index, g["no"].to_numpy(float)):
            near = np.abs(kn - no) <= NEIGHBOR_RANGE
            if not near.any():
                continue
            ys = ky[near]
            if ys.max() - ys.min() > NEIGHBOR_MAX_SPREAD:
                continue
            lo[idx], hi[idx] = ys.min() - NEIGHBOR_MARGIN, ys.max() + NEIGHBOR_MARGIN
    idx = list(lo)
    b.loc[idx, "built_year_min"] = pd.Series(lo)
    b.loc[idx, "built_year_max"] = pd.Series(hi)
    b.loc[idx, ["status", "status_built_year"]] = "estimated"
    b.loc[idx, "age_source"] = "lvr_neighbor"
    b.loc[idx, "age_conf"] = "low"
    b.loc[idx, "undetermined_reason"] = ""
    g_lo = b.loc[idx, "built_year_min"].map(generation)
    g_hi = b.loc[idx, "built_year_max"].map(generation)
    b.loc[idx, "code_generation"] = g_lo.where(g_lo == g_hi)
    pre = pd.Series(np.nan, index=idx, dtype=object)
    pre[(b.loc[idx, "built_year_max"] - LAG_YEARS) <= 1999] = True
    pre[(b.loc[idx, "built_year_min"] - LAG_YEARS) > 1999] = False
    b.loc[idx, "pre_policy_1999"] = pre
    return b


def soft_story(b):
    """Spec R3c (soft-story-spec.md). Needs built year, floors, structure and C3 evidence.

    C1 uses an actual year only (permit, list or real-price). A neighbour range (K6 L2,
    age_conf low) does not count: the spec bases C1 on the recorded built year.
    """
    actual_year = b.age_source.isin(["permit", "sea_sand_list", "lvr"])
    c1 = (b.pre_policy_1999 == True) & actual_year  # noqa: E712
    rc = b.structure_class == "rc"
    br = b.structure_class == "brick_reinforced"
    fl = b.floors
    c2a = (rc & fl.between(3, 5)) | (br & fl.between(2, 3))
    c2b = fl >= 6
    c3 = b.lvr_ground_commercial == True  # noqa: E712
    c4 = b.on_main_road
    a = c1 & c2a & c3 & c4
    bb = c1 & c2b & c3 & ~a
    b["soft_story_candidate"] = np.select([a, bb], ["A", "B"], "")
    b["soft_story_post1999_A_pattern"] = (b.pre_policy_1999 == False) & actual_year & c2a & c3 & c4  # noqa: E712
    b["soft_story_zoning_commercial"] = b.lvr_zoning_commercial.fillna(False) & (b.soft_story_candidate != "")
    return b


def main():
    b = buildings()
    b = liquefaction(b)
    b = permits(b)
    b = real_price(b)
    b = known_cases(b)
    b = heritage(b)
    b = age_fields(b)
    b = neighbor_ages(b)
    b = soft_story(b)
    cols = ["point_id", "village_code", "town_code", "address", "lon", "lat", "doorplate_units", "on_main_road",
            "status", "undetermined_reason", "built_year", "built_year_min", "built_year_max", "status_built_year",
            "age_source", "age_conf", "code_generation", "pre_policy_1999",
            "structure_class", "status_structure", "floors", "lvr_txn_n", "lvr_built_year_spread",
            "lvr_building_type", "lvr_has_elevator", "no_elevator_30plus", "lvr_ground_commercial",
            "liq_level_city2019", "liq_level_national2026", "liq_agreement",
            "sea_sand", "sea_sand_list_address", "sea_sand_list_version",
            "quake_listed", "quake_listed_address", "quake_listed_version", "soft_story_candidate", "soft_story_post1999_A_pattern",
            "soft_story_zoning_commercial", "near_heritage_50m", "heritage_n_50m", "building_key"]
    out = b[cols].copy()
    out["lon"], out["lat"] = out.lon.round(6), out.lat.round(6)
    MARTS.mkdir(parents=True, exist_ok=True)
    out.to_parquet(MARTS / "building_points.parquet", index=False)
    out.to_csv(MARTS / "building_points.csv", index=False, encoding="utf-8")
    # display version: only buildings with a built year or a flag, short columns,
    # 5-decimal coordinates (about 1 m). The full table is the Parquet / CSV.
    # No sea_sand or quake_listed here: this file is a browsable layer, and those
    # appear only in the exact-address lookup (sea sand) or as village totals (yellow
    # tags), per coordinator decision BD10.
    lite_cols = ["point_id", "status", "undetermined_reason", "built_year", "code_generation", "liq_agreement",
                 "soft_story_candidate"]
    keep = (out.status != "undetermined") | (out.soft_story_candidate != "")
    lite = out.loc[keep, lite_cols + ["lon", "lat"]].copy()
    lite["built_year"] = lite["built_year"].astype("Int64")
    lite = gpd.GeoDataFrame(lite[lite_cols], geometry=gpd.points_from_xy(lite.lon, lite.lat), crs=CRS_WGS84)
    lite.to_file(MARTS / "building_points_lite.geojson", driver="GeoJSON", COORDINATE_PRECISION=5)

    n = len(out)
    st = out.status.value_counts().to_dict()
    print(f"buildings={n} status={st} known share={(out.status != 'undetermined').mean():.4f}")
    w = out.doorplate_units
    print(f"unit-weighted known share={(w * (out.status != 'undetermined')).sum() / w.sum():.4f}")
    print("generation:", out.code_generation.value_counts().sort_index().to_dict())
    print("soft story:", out.soft_story_candidate.value_counts().to_dict(),
          "post1999 A pattern:", int(out.soft_story_post1999_A_pattern.sum()))
    print("liq agreement:", out.liq_agreement.value_counts().to_dict())
    print("sea sand:", out.sea_sand.notna().sum(), "quake:", out.quake_listed.notna().sum())


if __name__ == "__main__":
    main()

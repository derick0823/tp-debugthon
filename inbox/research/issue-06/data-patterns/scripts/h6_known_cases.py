"""H6: do known high-risk buildings (sea-sand list, earthquake yellow tags) fall where
the factors are high? Can they serve as a validation set?

Two tests:
  1. Building level: the liquefaction class at each case point vs all buildings
     (one point per house-number building) as the base rate.
  2. Village level: AUC of each factor for "village has >= 1 case".
     AUC 0.5 = no signal, 1.0 = perfect ranking.

Usage:   uv run python -X utf8 research/issue-06/data-patterns/scripts/h6_known_cases.py
Input:   data/marts/village_indicators.csv
         data/staged/renewal/sea-sand-houses-full-list.csv
         data/staged/hazard/earthquake-listed-buildings.csv
         data/staged/base/house-number-coordinates.parquet
         data/staged/building-hazard/soil-liquefaction.geojson
         data/staged/hazard/liquefaction-national-gsmma-2026.geojson
Output:  out/h6_point_liquefaction.csv, out/h6_village_auc.csv, results.json["h6"]
Network: no
"""

import geopandas as gpd
import pandas as pd

from common import OUT, STAGED, mart, save_result
from pipelines.common import CRS_TWD97


def auc(score, label):
    d = pd.concat([score, label], axis=1).dropna()
    s, y = d.iloc[:, 0], d.iloc[:, 1].astype(bool)
    if y.sum() == 0 or (~y).sum() == 0:
        return None
    r = s.rank()
    n1, n0 = y.sum(), (~y).sum()
    return round((r[y].sum() - n1 * (n1 + 1) / 2) / (n1 * n0), 3)


def level_at(points, path, name):
    poly = gpd.read_file(path).to_crs(CRS_TWD97)[["level", "geometry"]]
    j = gpd.sjoin(points, poly, how="left", predicate="within")
    j = j[~j.index.duplicated()]
    return j["level"].fillna("not mapped").rename(name)


def main():
    hn = pd.read_parquet(STAGED / "base" / "house-number-coordinates.parquet",
                         columns=["town_code", "road", "lane", "alley", "no", "x", "y"])
    blds = hn.groupby(["town_code", "road", "lane", "alley", "no"], dropna=False)[["x", "y"]].mean().reset_index()
    sets = {
        "all_buildings": blds,
        "sea_sand": pd.read_csv(STAGED / "renewal" / "sea-sand-houses-full-list.csv").query("geo_level in [1, 2]"),
        "quake_listed": pd.read_csv(STAGED / "hazard" / "earthquake-listed-buildings.csv").query("geo_level in [1, 2]"),
    }
    rows = []
    for name, d in sets.items():
        pts = gpd.GeoDataFrame(d, geometry=gpd.points_from_xy(d.x, d.y), crs=CRS_TWD97)
        lc = level_at(pts, STAGED / "building-hazard" / "soil-liquefaction.geojson", "city")
        ln = level_at(pts, STAGED / "hazard" / "liquefaction-national-gsmma-2026.geojson", "national")
        for ver, s in [("city", lc), ("national2026", ln)]:
            share = s.value_counts(normalize=True)
            for lv, v in share.items():
                rows.append({"set": name, "n": len(d), "version": ver, "level": lv, "share": round(v, 4)})
    pl = pd.DataFrame(rows)
    pl.to_csv(OUT / "h6_point_liquefaction.csv", index=False, encoding="utf-8")
    print(pl.pivot_table(index=["version", "level"], columns="set", values="share").round(3))

    t = mart()
    pr = lambda s: s.rank(pct=True)  # noqa: E731
    t["liq_city_score"] = t.liq_high_share_city2019 + 0.5 * t.liq_medium_share_city2019
    t["liq_nat_score"] = t.liq_high_share_national2026 + 0.5 * t.liq_medium_share_national2026
    t["lanes_total"] = t.fire_access_lanes + t.narrow_lanes_n
    t["composite_equal"] = pr(t.share_65plus) + pr(t.lvr_share_pre1982_est) + pr(t.liq_city_score)
    # sea-sand permits span 1972-1992: share of traded units built in that window
    lv = pd.read_csv(STAGED / "housing-stats" / "real-price-registration-lvr.csv", dtype={"village_code": str})
    lv = lv[lv.geo_level.between(1, 3) & lv.built_year_ad.notna()]
    lv["y7292"] = lv.built_year_ad.between(1972, 1992)
    t["lvr_share_1972_1992"] = t.village_code.map(lv.groupby("village_code")["y7292"].mean())
    t["has_sea_sand"] = t.sea_sand_cases_n > 0
    t["has_quake"] = t.quake_listed_n > 0
    factors = ["share_65plus", "share_80plus", "lvr_share_pre1982_est", "lvr_share_pre1999", "lvr_share_1972_1992",
               "lvr_share_walkup",
               "new2001_units_share", "town_share_age_30plus", "liq_city_score", "liq_nat_score", "lanes_total",
               "road_markers_lt6m_share", "pop_density_per_km2", "composite_equal"]
    au = pd.DataFrame({
        "auc_sea_sand": {f: auc(t[f], t.has_sea_sand) for f in factors},
        "auc_quake_listed": {f: auc(t[f], t.has_quake) for f in factors},
    })
    au.to_csv(OUT / "h6_village_auc.csv", encoding="utf-8")
    print(au)

    piv = pl.pivot_table(index=["version", "level"], columns="set", values="share")
    res = {
        "sea_sand_villages": int(t.has_sea_sand.sum()), "quake_villages": int(t.has_quake.sum()),
        "sea_sand_points_used": len(sets["sea_sand"]), "quake_points_used": len(sets["quake_listed"]),
        "point_share_city_high": piv.loc[("city", "high")].round(3).to_dict(),
        "point_share_nat_high": piv.loc[("national2026", "high")].round(3).to_dict(),
        "point_share_city_not_mapped": piv.loc[("city", "not mapped")].round(3).to_dict(),
        "auc": au.to_dict(),
        "sea_sand_by_town": t.groupby("town_name").sea_sand_cases_n.sum().sort_values(ascending=False).to_dict(),
        "quake_by_town": t.groupby("town_name").quake_listed_n.sum().sort_values(ascending=False).to_dict(),
    }
    save_result("h6", res)
    for k, v in res.items():
        print(k, v)


if __name__ == "__main__":
    main()

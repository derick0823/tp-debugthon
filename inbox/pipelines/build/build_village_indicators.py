"""Build the village indicator table for issue 6 (456 villages, one row each).

Every column is defined in data/marts/README.md (source slug, year, raw or estimate).
Point lists that were geocoded count only rows with geo_level <= 3
(exact, nearest number, or lane majority); see pipelines/address.py.

Usage:   uv run python -X utf8 -m pipelines.build.build_village_indicators
Input:   data/staged/** (run the stage scripts listed in pipelines/README.md first)
         data/marts/building_points.parquet (run build_building_points first)
Output:  data/marts/village_indicators.csv
         data/marts/village_indicators.geojson  (EPSG:4326, same columns + village polygon)
Network: no
"""

import geopandas as gpd
import numpy as np
import pandas as pd

from pipelines.common import MARTS, STAGED, CRS_WGS84, CRS_TWD97

GEO_OK = 3          # max geo_level counted at village level
LVR_PRIOR = 20      # pseudo-count for shrinking small-sample village shares toward the district
NOW_YEAR = 2026


def villages():
    g = gpd.read_file(STAGED / "base" / "village-boundary-nlsc.geojson")
    g["area_km2"] = (g["area_m2"] / 1e6).round(4)
    return g.drop(columns="area_m2")


def population(v):
    p = pd.read_csv(STAGED / "base" / "village-population-by-age.csv", dtype={"village_code": str})
    last = p[(p.year_roc == 115) & (p.month == 9)].set_index("village_code")
    first = p[(p.year_roc == 110) & (p.month == 1)].set_index("village_code")
    out = pd.DataFrame(index=v.village_code)
    out["pop_total"] = last["pop_total"]
    out["pop_65plus"] = last["pop_65plus"]
    out["share_65plus"] = (last["pop_65plus"] / last["pop_total"]).round(4)
    out["pop_80plus"] = last["pop_80plus"]
    out["share_80plus"] = (last["pop_80plus"] / last["pop_total"]).round(4)
    out["share_65plus_change_110_115"] = (out["share_65plus"]
                                          - first["pop_65plus"] / first["pop_total"]).round(4)
    return out


def area_shares(v, path, version, levels):
    liq = gpd.read_file(path).to_crs(CRS_TWD97)
    vv = v[["village_code", "geometry"]].to_crs(CRS_TWD97)
    vv["vill_m2"] = vv.area
    x = gpd.overlay(vv, liq[["level", "geometry"]], how="intersection", keep_geom_type=True)
    x["m2"] = x.area
    t = x.pivot_table(index="village_code", columns="level", values="m2", aggfunc="sum").reindex(v.village_code)
    t = t.fillna(0).div(vv.set_index("village_code")["vill_m2"], axis=0)
    return pd.DataFrame({f"liq_{lv}_share_{version}": t.get(lv, 0).round(4) for lv in levels}, index=v.village_code)


def boreholes(v):
    b = gpd.read_file(STAGED / "hazard" / "liquefaction-boreholes-soil-taipei.geojson")
    g = b.groupby("village_code")["pl"]
    return pd.DataFrame({"borehole_n": g.size(), "borehole_pl_median": g.median().round(2)}).reindex(v.village_code)


def doorplates(v):
    h = pd.read_parquet(STAGED / "base" / "house-number-coordinates.parquet",
                        columns=["village_code", "road", "lane", "alley", "no", "town_code"])
    units = h.groupby("village_code").size()
    blds = h.drop_duplicates(["town_code", "road", "lane", "alley", "no"]).groupby("village_code").size()
    return pd.DataFrame({"doorplate_units": units, "doorplate_buildings": blds}).reindex(v.village_code)


def district_age(v):
    h = pd.read_csv(STAGED / "housing-stats" / "house-tax-housing-overview-by-tax-office.csv",
                    dtype={"town_code": str})
    h = h[h.year_roc == 115].set_index("town_code")
    m = v.set_index("village_code")["town_code"]
    return pd.DataFrame({"town_share_age_30plus": m.map(h["share_age_30plus"]),
                         "town_share_4_6f": m.map(h["share_4_6f"])})


def new_buildings(v):
    f = gpd.read_file(STAGED / "permits" / "building-permit-footprints.geojson")
    keep = ~f["build_type"].isin(["增建", "修建", "改建"])
    fp = f[keep].groupby("village_code")["footprint_m2"].sum()
    up = pd.read_csv(STAGED / "permits" / "use-permits.csv", dtype={"village_code": str})
    up = up[(up.build_type == "新建") & (up.geo_level.between(1, GEO_OK))]
    units = up.groupby("village_code")["units"].sum()
    out = pd.DataFrame({"new2001_footprint_m2": fp, "new2001_units": units}).reindex(v.village_code)
    out["new2001_footprint_m2"] = out["new2001_footprint_m2"].fillna(0).round(0)
    out["new2001_units"] = out["new2001_units"].fillna(0)
    return out


def shrink(k, n, prior):
    return (k + LVR_PRIOR * prior) / (n + LVR_PRIOR)


def lvr(v):
    t = pd.read_csv(STAGED / "housing-stats" / "real-price-registration-lvr.csv", dtype={"village_code": str})
    t = t[t.geo_level.between(1, GEO_OK)].copy()
    t["town_code"] = t["village_code"].str[:8]
    # first sales of new buildings (built <= 2 years before the trade) make up about 29% of
    # the sample and would pull every age share young; the stock indicators drop them
    trade_year = pd.to_datetime(t["trade_date"]).dt.year
    t["new_build"] = t["built_year_ad"] >= trade_year - 2
    newb = t.dropna(subset=["built_year_ad"]).groupby("village_code")["new_build"].agg(["mean", "size"])
    t = t[~t["new_build"]]
    y = t.dropna(subset=["built_year_ad"]).copy()
    y["pre1982"] = y.built_year_ad < 1982
    y["pre1999"] = y.built_year_ad < 1999
    y["age50plus"] = y.built_year_ad <= NOW_YEAR - 50
    s = t.dropna(subset=["structure_class"]).copy()
    s["brick_reinforced"] = s.structure_class == "brick_reinforced"
    s["brick"] = s.structure_class == "brick"
    w = t.dropna(subset=["building_type"]).copy()
    w["walkup"] = w.building_type == "walkup_5_or_less"

    gy, gs, gw = y.groupby("village_code"), s.groupby("village_code"), w.groupby("village_code")
    out = pd.DataFrame({
        "lvr_n_built": gy.size(),
        "lvr_built_year_median": gy["built_year_ad"].median(),
        "lvr_share_pre1982": gy["pre1982"].mean().round(4),
        "lvr_share_pre1999": gy["pre1999"].mean().round(4),
        "lvr_share_age50plus": gy["age50plus"].mean().round(4),
        "lvr_n_structure": gs.size(),
        "lvr_share_brick_reinforced": gs["brick_reinforced"].mean().round(4),
        "lvr_share_brick": gs["brick"].mean().round(4),
        "lvr_share_walkup": gw["walkup"].mean().round(4),
    }).reindex(v.village_code)
    out["lvr_share_newbuild"] = newb["mean"].reindex(v.village_code).round(4)
    out["lvr_n_built"] = out["lvr_n_built"].fillna(0).astype(int)
    out["lvr_n_structure"] = out["lvr_n_structure"].fillna(0).astype(int)
    # shrunk estimates: small samples pulled toward the district share
    town = v.set_index("village_code")["town_code"]
    for col, frame, grp in [("pre1982", y, gy), ("age50plus", y, gy), ("brick_reinforced", s, gs)]:
        prior = town.map(frame.groupby("town_code")[col].mean())
        k = grp[col].sum().reindex(v.village_code).fillna(0)
        n = grp.size().reindex(v.village_code).fillna(0)
        out[f"lvr_share_{col}_est"] = shrink(k, n, prior).round(4)
    return out


def counts(v, path, filt=None, weight=None, name="n"):
    d = pd.read_csv(path, dtype={"village_code": str})
    if "geo_level" in d:
        d = d[d.geo_level.between(1, GEO_OK)]
    if filt is not None:
        d = d[filt(d)]
    s = d.groupby("village_code")[weight].sum() if weight else d.groupby("village_code").size()
    return s.reindex(v.village_code).fillna(0).rename(name)


def road_width(v):
    # each source line is a width marker, not a road centreline (see stage_road_width)
    r = gpd.read_file(STAGED / "hazard" / "road-width-planned.geojson")
    g = r.groupby("village_code")["width_m"]
    out = pd.DataFrame({"road_markers_n": g.size(),
                        "road_markers_lt6m_share": g.apply(lambda s: (s < 6).mean()).round(4)})
    return out.reindex(v.village_code)


def building_stock(v):
    """Village summary of the building table (unit-weighted by doorplate units).

    Shares are over units whose built year (or structure) is known; the known share
    itself is a column, because unknown buildings are mostly small (not random).
    """
    b = pd.read_parquet(MARTS / "building_points.parquet")
    b["w"] = b["doorplate_units"]
    # village shares use buildings with an actual year only, not neighbour ranges (K6 L2)
    b["known"] = b["age_source"].isin(["permit", "sea_sand_list", "lvr"])
    k = b[b.known]
    g_all, g_k = b.groupby("village_code"), k.groupby("village_code")
    wk = g_k["w"].sum()

    def share(mask):
        return (k[mask].groupby("village_code")["w"].sum() / wk).reindex(v.village_code).fillna(0).where(
            wk.reindex(v.village_code) > 0)

    sc = b[b.status_structure != "undetermined"]
    wsc = sc.groupby("village_code")["w"].sum()
    out = pd.DataFrame({
        "bld_age_known_unit_share": (wk / g_all["w"].sum()).reindex(v.village_code),
        "bld_age_known_n": g_k.size().reindex(v.village_code),
        "bld_share_pre_policy_1999": share(k.pre_policy_1999 == True),  # noqa: E712
        "bld_share_pre1982": share(k.code_generation.isin(["g1_pre1974", "g2_1974_1982"])),
        "bld_share_pre1974": share(k.code_generation == "g1_pre1974"),
        "bld_share_brick_reinforced": (sc[sc.structure_class == "brick_reinforced"].groupby("village_code")["w"].sum()
                                       .reindex(wsc.index).fillna(0) / wsc).reindex(v.village_code),
        "soft_story_a_n": b[b.soft_story_candidate == "A"].groupby("village_code").size().reindex(v.village_code),
        "soft_story_b_n": b[b.soft_story_candidate == "B"].groupby("village_code").size().reindex(v.village_code),
        "no_elevator_30plus_n": b[b.no_elevator_30plus == True].groupby("village_code").size()  # noqa: E712
        .reindex(v.village_code),
    })
    for c in ["bld_age_known_n", "soft_story_a_n", "soft_story_b_n", "no_elevator_30plus_n"]:
        out[c] = out[c].fillna(0).astype(int)
    nb = g_all.size().reindex(v.village_code)
    out["soft_story_rate"] = ((out.soft_story_a_n + out.soft_story_b_n) / nb).round(4)
    for c in ["bld_age_known_unit_share", "bld_share_pre_policy_1999", "bld_share_pre1982", "bld_share_pre1974",
              "bld_share_brick_reinforced"]:
        out[c] = out[c].round(4)
    return out


def heritage_sites(v):
    h = gpd.read_file(STAGED / "land" / "cultural-heritage.geojson")
    return h.groupby("village_code").size().reindex(v.village_code).fillna(0).astype(int).rename("heritage_sites_n")


def weilao(v):
    """Active (not lapsed) approvals: district count, and a village estimate.

    Most rows give only a road. The village estimate spreads each case over the
    villages on that road in proportion to their buildings on it (an expected count).
    """
    d = pd.read_csv(STAGED / "renewal" / "dangerous-old-building-rebuild-approved-cases.csv",
                    dtype={"town_code": str, "village_code": str, "list_version": str})
    d = d[d.list_version == d.list_version.max()]      # latest PDF list only
    d = d[~d.lapsed]
    town = v.set_index("village_code")["town_code"]
    town_n = d.groupby("town_code").size()
    from pipelines.address import Geocoder
    gc = Geocoder()
    share = (gc.b.groupby(["town_code", "road", "village_code"]).size()
               .groupby(level=[0, 1]).transform(lambda s: s / s.sum()))
    est = pd.Series(0.0, index=v.village_code)
    for loc, tc in zip(d["location"].str.split(r"\s+").str[0], d["town_code"]):
        p = gc.parse(loc, tc)
        if not p or not p.get("road"):
            continue
        try:
            sub = share.loc[(p["town_code"], p["road"])]
        except KeyError:
            continue
        est = est.add(sub, fill_value=0)
    h = pd.read_csv(STAGED / "housing-stats" / "house-tax-housing-overview-by-tax-office.csv",
                    dtype={"town_code": str})
    old = h[h.year_roc == 115].set_index("town_code")["bld_age_30plus"]
    return pd.DataFrame({
        "weilao_active_est": est.reindex(v.village_code).round(2),
        "town_weilao_active_n": town.map(town_n),
        "town_weilao_per_1k_old_bld": town.map((town_n / old * 1000).round(2)),
    })


def main():
    v = villages()
    idx = v.village_code
    S = STAGED
    parts = [
        population(v),
        area_shares(v, S / "building-hazard" / "soil-liquefaction.geojson", "city2019", ["high", "medium", "low"]),
        area_shares(v, S / "hazard" / "liquefaction-national-gsmma-2026.geojson", "national2026", ["high", "medium", "low"]),
        area_shares(v, S / "hazard" / "liquefaction-geologycloud-taipei-basin.geojson", "geologycloud", ["high", "medium", "low"]),
        boreholes(v),
        doorplates(v),
        district_age(v),
        new_buildings(v),
        lvr(v),
        counts(v, S / "building-hazard" / "fire-access-lanes.csv", weight="village_weight", name="fire_access_lanes"),
        counts(v, S / "hazard" / "narrow-lanes-red-yellow.csv", name="narrow_lanes_n"),
        counts(v, S / "hazard" / "narrow-lanes-red-yellow.csv", filt=lambda d: d.zone == "red", name="narrow_lanes_red_n"),
        counts(v, S / "hazard" / "fire-rescue-difficult-areas.csv", name="fire_rescue_sites_n"),
        road_width(v),
        counts(v, S / "renewal" / "sea-sand-houses-full-list.csv", name="sea_sand_cases_n"),
        counts(v, S / "renewal" / "sea-sand-houses-full-list.csv", weight="units", name="sea_sand_units"),
        counts(v, S / "hazard" / "earthquake-listed-buildings.csv", name="quake_listed_n"),
        weilao(v),
        building_stock(v),
        heritage_sites(v),
    ]
    t = pd.concat([p.reindex(idx) if isinstance(p, pd.DataFrame) else p.reindex(idx).to_frame() for p in parts],
                  axis=1)
    t["pop_density_per_km2"] = (t["pop_total"] / v.set_index("village_code")["area_km2"]).round(0)
    t["new2001_footprint_share_of_land"] = (t["new2001_footprint_m2"]
                                           / (v.set_index("village_code")["area_km2"] * 1e6)).round(4)
    t["new2001_units_share"] = (t["new2001_units"] / t["doorplate_units"]).clip(upper=1).round(4)
    base = v.drop(columns="geometry").set_index("village_code")
    t = base.join(t).reset_index()
    assert len(t) == 456 and t.village_code.is_unique
    MARTS.mkdir(parents=True, exist_ok=True)
    t.to_csv(MARTS / "village_indicators.csv", index=False, encoding="utf-8")
    gj = v[["village_code", "geometry"]].merge(t, on="village_code")
    gj["geometry"] = gj.geometry.to_crs(CRS_TWD97).simplify(5).to_crs(CRS_WGS84)
    gj.to_file(MARTS / "village_indicators.geojson", driver="GeoJSON")
    print(f"rows={len(t)} cols={t.shape[1]}")
    print(t.describe().T[["count", "mean", "min", "max"]].round(3).to_string())


if __name__ == "__main__":
    main()

"""H3: does the village ranking change a lot between the city and the national liquefaction maps?

Also a simple rank sensitivity check: an equal-weight composite of elderly share,
old stock and liquefaction, computed once with each map. No weights are proposed.

Usage:   uv run python -X utf8 research/issue-06/data-patterns/scripts/h3_liquefaction_versions.py
Input:   data/marts/village_indicators.{csv,geojson}
         data/staged/building-hazard/soil-liquefaction.geojson
         data/staged/hazard/liquefaction-national-gsmma-2026.geojson
         data/staged/hazard/liquefaction-boreholes-soil-taipei.geojson
Output:  out/h3_area_crosstab_km2.csv, out/h3_rank_compare.csv, out/h3_maps.png, results.json["h3"]
Network: no
"""

import geopandas as gpd
import matplotlib.pyplot as plt
import pandas as pd

from common import OUT, STAGED, choropleth, mart, mart_geo, save_result, spearman
from pipelines.common import CRS_TWD97

TOP = 46  # top 10% of 456 villages


def score(t, version):
    return t[f"liq_high_share_{version}"] + 0.5 * t[f"liq_medium_share_{version}"]


def topset(s, n=TOP):
    return set(s.sort_values(ascending=False).index[:n])


def main():
    t = mart().set_index("village_code")

    # 1. where do the two maps disagree, in km2
    c = gpd.read_file(STAGED / "building-hazard" / "soil-liquefaction.geojson").to_crs(CRS_TWD97)
    n = gpd.read_file(STAGED / "hazard" / "liquefaction-national-gsmma-2026.geojson").to_crs(CRS_TWD97)
    x = gpd.overlay(c[["level", "geometry"]].rename(columns={"level": "city"}),
                    n[["level", "geometry"]].rename(columns={"level": "national"}), how="union",
                    keep_geom_type=True)
    x["city"] = x["city"].fillna("not mapped")
    x["national"] = x["national"].fillna("not mapped")
    x["km2"] = x.area / 1e6
    ct = x.pivot_table(index="city", columns="national", values="km2", aggfunc="sum").fillna(0).round(2)
    ct.to_csv(OUT / "h3_area_crosstab_km2.csv", encoding="utf-8")
    print(ct)
    city_high = ct.loc["high"].sum()
    both_high = ct.loc["high", "high"] if "high" in ct.columns else 0

    # 2. village rankings
    t["liq_city_score"] = score(t, "city2019")
    t["liq_nat_score"] = score(t, "national2026")
    t["liq_gc_score"] = score(t, "geologycloud")
    r_city, r_nat = t.liq_city_score.rank(ascending=False), t.liq_nat_score.rank(ascending=False)
    t["rank_city"], t["rank_nat"] = r_city, r_nat
    t["rank_shift"] = (r_city - r_nat).abs()
    high_city, high_nat = topset(t.liq_high_share_city2019), topset(t.liq_high_share_national2026)
    sc_city, sc_nat = topset(t.liq_city_score), topset(t.liq_nat_score)

    # 3. boreholes as a third opinion (villages with >= 5 holes)
    bh = t[t.borehole_n >= 5]

    # 4. composite sensitivity (equal weights, percentile ranks)
    pr = lambda s: s.rank(pct=True)  # noqa: E731
    base = pr(t.share_65plus) + pr(t.lvr_share_pre1982_est)
    comp_city = base + pr(t.liq_city_score)
    comp_nat = base + pr(t.liq_nat_score)
    comp_none = base
    cc, cn, c0 = topset(comp_city), topset(comp_nat), topset(comp_none)
    t["composite_rank_city"] = comp_city.rank(ascending=False)
    t["composite_rank_nat"] = comp_nat.rank(ascending=False)
    t["composite_shift"] = (t.composite_rank_city - t.composite_rank_nat).abs()

    cols = ["town_name", "village_name", "liq_high_share_city2019", "liq_high_share_national2026", "liq_city_score",
            "liq_nat_score", "rank_city", "rank_nat", "rank_shift", "composite_rank_city", "composite_rank_nat",
            "composite_shift", "borehole_n", "borehole_pl_median"]
    t.sort_values("rank_shift", ascending=False)[cols].to_csv(OUT / "h3_rank_compare.csv", encoding="utf-8")

    res = {
        "area_city_high_km2": round(city_high, 2),
        "area_city_high_also_national_high_km2": round(both_high, 2),
        "area_city_high_also_national_high_share": round(both_high / city_high, 3),
        "area_national_high_km2": round(ct["high"].sum(), 2),
        "spearman_high_share": spearman(t.liq_high_share_city2019, t.liq_high_share_national2026),
        "spearman_score": spearman(t.liq_city_score, t.liq_nat_score),
        "spearman_score_city_vs_old_national": spearman(t.liq_city_score, t.liq_gc_score),
        "top46_overlap_high_share": len(high_city & high_nat),
        "top46_overlap_score": len(sc_city & sc_nat),
        "villages_rank_shift_gt100": int((t.rank_shift > 100).sum()),
        "villages_high_city_gt50pct_nat_lt10pct": int(((t.liq_high_share_city2019 > 0.5)
                                                       & (t.liq_high_share_national2026 < 0.1)).sum()),
        "villages_high_nat_gt50pct_city_lt10pct": int(((t.liq_high_share_national2026 > 0.5)
                                                       & (t.liq_high_share_city2019 < 0.1)).sum()),
        "borehole_villages_ge5": len(bh),
        "spearman_pl_vs_city_score": spearman(bh.borehole_pl_median, bh.liq_city_score),
        "spearman_pl_vs_nat_score": spearman(bh.borehole_pl_median, bh.liq_nat_score),
        "spearman_pl_vs_old_national_score": spearman(bh.borehole_pl_median, bh.liq_gc_score),
        "composite_top46_overlap_city_vs_nat": len(cc & cn),
        "composite_top46_overlap_city_vs_noliq": len(cc & c0),
        "composite_villages_shift_gt50": int((t.composite_shift > 50).sum()),
        "composite_top46_city_by_town": t.loc[list(cc)].town_name.value_counts().to_dict(),
        "composite_top46_nat_by_town": t.loc[list(cn)].town_name.value_counts().to_dict(),
    }
    save_result("h3", res)
    for k, v in res.items():
        print(k, v)

    g = mart_geo().set_index("village_code")
    g["liq_city_score"], g["liq_nat_score"] = t.liq_city_score, t.liq_nat_score
    g["diff"] = t.liq_nat_score - t.liq_city_score
    fig, ax = plt.subplots(1, 3, figsize=(16, 6.5))
    choropleth(g, "liq_city_score", "城市版（soil.taipei）：高＋0.5×中 面積比", None, cmap="Blues", ax=ax[0])
    choropleth(g, "liq_nat_score", "全國 2026 版：高＋0.5×中 面積比", None, cmap="Blues", ax=ax[1])
    choropleth(g, "diff", "差值（全國－城市）：紅＝全國較高", None, cmap="RdBu_r", ax=ax[2])
    fig.tight_layout()
    fig.savefig(OUT / "h3_maps.png", dpi=100)


if __name__ == "__main__":
    main()

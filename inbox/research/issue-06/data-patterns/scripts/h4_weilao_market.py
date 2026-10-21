"""H4: are approved dangerous-old-building rebuilds concentrated where land is expensive,
and away from where risk is high?

District level is the main test (12 districts; the case list gives only a road).
Village level uses weilao_active_est (expected count spread along the road) as a weak check.

Usage:   uv run python -X utf8 research/issue-06/data-patterns/scripts/h4_weilao_market.py
Input:   data/marts/village_indicators.csv
         data/staged/renewal/dangerous-old-building-rebuild-approved-cases.csv
         data/staged/housing-stats/real-price-registration-lvr.csv
Output:  out/h4_town_table.csv, out/h4_scatter.png, results.json["h4"]
Network: no
"""

import matplotlib.pyplot as plt
import pandas as pd

from common import OUT, STAGED, mart, save_result, spearman


def main():
    t = mart()
    w = pd.read_csv(STAGED / "renewal" / "dangerous-old-building-rebuild-approved-cases.csv",
                    dtype={"town_code": str, "list_version": str})
    w = w[w.list_version == "1150210"]   # the R1 report uses this list version
    lv = pd.read_csv(STAGED / "housing-stats" / "real-price-registration-lvr.csv", dtype={"village_code": str})
    lv = lv[(lv.building_area_m2 > 10) & lv.total_price.gt(0)].copy()
    lv["price_per_m2"] = lv.total_price / lv.building_area_m2
    lv["town_name"] = lv["town_name"].str.strip()
    old = lv[lv.built_year_ad < 1990]

    town = t.groupby("town_name").agg(
        pop=("pop_total", "sum"), pop65=("pop_65plus", "sum"), area_km2=("area_km2", "sum"),
        old30_share=("town_share_age_30plus", "first"))
    town["share_65plus"] = town.pop65 / town["pop"]
    # area-weighted liquefaction shares
    for col in ["liq_high_share_city2019", "liq_high_share_national2026"]:
        town[col] = (t[col] * t.area_km2).groupby(t.town_name).sum() / town.area_km2
    town["pre1982_share_lvr"] = t.groupby("town_name").apply(
        lambda d: (d.lvr_share_pre1982 * d.lvr_n_built).sum() / d.lvr_n_built.sum(), include_groups=False)
    town["price_per_m2_median"] = lv.groupby("town_name")["price_per_m2"].median()
    town["old_price_per_m2_median"] = old.groupby("town_name")["price_per_m2"].median()
    act = w[~w.lapsed]
    town["weilao_all"] = w.groupby("town_name").size()
    town["weilao_active"] = act.groupby("town_name").size()
    town["weilao_lapsed_share"] = (w.groupby("town_name")["lapsed"].mean()).round(3)
    town["weilao_site_m2_median"] = act.groupby("town_name")["site_area_m2"].median()
    h = pd.read_csv(STAGED / "housing-stats" / "house-tax-housing-overview-by-tax-office.csv")
    h = h[h.year_roc == 115].set_index("town_name")
    town["old_bld_30plus"] = h["bld_age_30plus"]
    town["weilao_per_1k_old"] = (town.weilao_active / town.old_bld_30plus * 1000).round(2)
    town = town.sort_values("weilao_per_1k_old", ascending=False)
    town.round(4).to_csv(OUT / "h4_town_table.csv", encoding="utf-8")
    print(town.round(3).to_string())

    y = town.weilao_per_1k_old
    res = {
        "cases_total": len(w), "cases_lapsed": int(w.lapsed.sum()), "cases_active": len(act),
        "spearman_town_rate_vs_price": spearman(y, town.price_per_m2_median),
        "spearman_town_rate_vs_old_price": spearman(y, town.old_price_per_m2_median),
        "spearman_town_rate_vs_65plus": spearman(y, town.share_65plus),
        "spearman_town_rate_vs_old30": spearman(y, town.old30_share),
        "spearman_town_rate_vs_pre1982": spearman(y, town.pre1982_share_lvr),
        "spearman_town_rate_vs_liq_city_high": spearman(y, town.liq_high_share_city2019),
        "spearman_town_rate_vs_liq_nat_high": spearman(y, town.liq_high_share_national2026),
        "approvals_by_year_active": act.approved_year_ad.value_counts().sort_index().to_dict(),
        "lapsed_by_year": w[w.lapsed].approved_year_ad.value_counts().sort_index().to_dict(),
        "site_area_m2_quantiles_active": act.site_area_m2.quantile([0.25, 0.5, 0.75]).round(0).to_dict(),
    }
    # village-level weak check (expected counts per 1k doorplate buildings)
    t["weilao_per_1k_bld"] = t.weilao_active_est / t.doorplate_buildings * 1000
    vp = lv.groupby("village_code")["price_per_m2"].median()
    t["price_med"] = t.village_code.map(vp)
    res.update({
        "village_spearman_rate_vs_price": spearman(t.weilao_per_1k_bld, t.price_med),
        "village_spearman_rate_vs_pre1982_est": spearman(t.weilao_per_1k_bld, t.lvr_share_pre1982_est),
        "village_spearman_rate_vs_65plus": spearman(t.weilao_per_1k_bld, t.share_65plus),
        "village_spearman_rate_vs_liq_city_high": spearman(t.weilao_per_1k_bld, t.liq_high_share_city2019),
        "village_spearman_rate_vs_narrow_lt6m": spearman(t.weilao_per_1k_bld, t.road_markers_lt6m_share),
    })
    save_result("h4", res)
    for k, v in res.items():
        print(k, v)

    fig, ax = plt.subplots(1, 3, figsize=(15, 4.6))
    for a, (x, lab) in zip(ax, [("price_per_m2_median", "交易單價中位數（元/m²，實價登錄）"),
                                ("share_65plus", "65 歲以上比例"),
                                ("pre1982_share_lvr", "1982 年前建成比例（實價登錄）")]):
        a.scatter(town[x], y, color="#b5562b")
        for name, r in town.iterrows():
            a.annotate(name.replace("區", ""), (r[x], r.weilao_per_1k_old), fontsize=8)
        a.set_xlabel(lab)
        a.set_ylabel("有效危老核准案／每千棟 30 年以上建物")
        a.set_title(f"Spearman ρ = {spearman(y, town[x])[0]}")
    fig.tight_layout()
    fig.savefig(OUT / "h4_scatter.png", dpi=100)


if __name__ == "__main__":
    main()

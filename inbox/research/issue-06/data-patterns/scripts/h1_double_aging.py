"""H1: do elderly share, building age and liquefaction overlap at village level?

Usage:   uv run python -X utf8 research/issue-06/data-patterns/scripts/h1_double_aging.py
Input:   data/marts/village_indicators.{csv,geojson}
Output:  out/h1_spearman.csv, out/h1_town_table.csv, out/h1_triple_overlap_villages.csv,
         out/h1_maps.png, results.json["h1"]
Network: no
"""

import matplotlib.pyplot as plt
import pandas as pd

from common import OUT, choropleth, mart, mart_geo, save_result, spearman

FACTORS = {
    "share_65plus": "65+ 比例",
    "share_80plus": "80+ 比例",
    "lvr_share_pre1982_est": "1982 前建成比例（實價，收縮）",
    "lvr_built_year_median": "建成年中位數（實價）",
    "new2001_units_share": "2001 後新建戶數占門牌",
    "liq_high_share_city2019": "液化高（城市版）",
    "liq_high_share_national2026": "液化高（全國 2026）",
}


def main():
    t = mart()
    cols = list(FACTORS)
    rho = pd.DataFrame(index=cols, columns=cols, dtype=float)
    for a in cols:
        for b in cols:
            rho.loc[a, b] = spearman(t[a], t[b])[0]
    rho.to_csv(OUT / "h1_spearman.csv", encoding="utf-8")
    print(rho.round(2).to_string())

    # triple overlap: top quartile on elderly, old stock and city high liquefaction
    q = 0.75
    t["top_elderly"] = t.share_65plus >= t.share_65plus.quantile(q)
    t["top_old"] = t.lvr_share_pre1982_est >= t.lvr_share_pre1982_est.quantile(q)
    t["top_liq"] = t.liq_high_share_city2019 >= t.liq_high_share_city2019.quantile(q)
    t["liq_any_high"] = t.liq_high_share_city2019 > 0.1
    t["triple"] = t.top_elderly & t.top_old & t.top_liq
    t["double_age"] = t.top_elderly & t.top_old
    n_liq_pos = (t.liq_high_share_city2019 > 0).sum()
    expected_triple = len(t) * 0.25 * 0.25 * (t.top_liq.mean())
    triple = t[t.triple].sort_values("share_65plus", ascending=False)
    triple[["town_name", "village_name", "village_code", "share_65plus", "lvr_share_pre1982_est",
            "lvr_n_built", "liq_high_share_city2019", "liq_high_share_national2026"]].to_csv(
        OUT / "h1_triple_overlap_villages.csv", index=False, encoding="utf-8")

    town = t.groupby("town_name").agg(
        villages=("village_code", "size"), pop=("pop_total", "sum"), pop65=("pop_65plus", "sum"),
        age30plus=("town_share_age_30plus", "first"),
        pre1982_median=("lvr_share_pre1982_est", "median"),
        liq_city_high_median=("liq_high_share_city2019", "median"),
        double_age=("double_age", "sum"), triple=("triple", "sum"))
    town["share_65plus"] = (town.pop65 / town["pop"]).round(4)
    town = town.sort_values("triple", ascending=False)
    town.to_csv(OUT / "h1_town_table.csv", encoding="utf-8")
    print(town.to_string())

    g = mart_geo()
    g = g.merge(t[["village_code", "triple", "double_age"]], on="village_code")
    g["overlap"] = g["double_age"].astype(int) + g["triple"].astype(int)
    fig, axes = plt.subplots(1, 4, figsize=(20, 6.5))
    choropleth(g, "share_65plus", "65 歲以上比例（115/9）", None, ax=axes[0])
    choropleth(g, "lvr_share_pre1982_est", "1982 年前建成比例（實價登錄推估）", None, ax=axes[1])
    choropleth(g, "liq_high_share_city2019", "液化高潛勢面積比例（城市版）", None, cmap="Blues", ax=axes[2])
    choropleth(g, "overlap", "0＝無  1＝高齡×老屋  2＝再加液化高", None, cmap="Purples", ax=axes[3], legend=False)
    fig.suptitle("H1 雙老與液化：前 25% 門檻", fontsize=12)
    fig.tight_layout()
    fig.savefig(OUT / "h1_maps.png", dpi=100)

    res = {
        "spearman_65_vs_pre1982": spearman(t.share_65plus, t.lvr_share_pre1982_est),
        "spearman_65_vs_builtyear": spearman(t.share_65plus, t.lvr_built_year_median),
        "spearman_65_vs_new2001": spearman(t.share_65plus, t.new2001_units_share),
        "spearman_65_vs_liq_city_high": spearman(t.share_65plus, t.liq_high_share_city2019),
        "spearman_65_vs_liq_nat_high": spearman(t.share_65plus, t.liq_high_share_national2026),
        "spearman_pre1982_vs_liq_city_high": spearman(t.lvr_share_pre1982_est, t.liq_high_share_city2019),
        "villages_with_city_high_gt0": int(n_liq_pos),
        "double_age_n": int(t.double_age.sum()),
        "double_age_expected_if_independent": round(len(t) / 16, 1),
        "triple_n": int(t.triple.sum()),
        "triple_expected_if_independent": round(expected_triple, 1),
        "triple_by_town": t[t.triple].town_name.value_counts().to_dict(),
        "double_age_by_town": t[t.double_age].town_name.value_counts().to_dict(),
        "thresholds": {"share_65plus": round(t.share_65plus.quantile(q), 4),
                       "pre1982_est": round(t.lvr_share_pre1982_est.quantile(q), 4),
                       "liq_city_high": round(t.liq_high_share_city2019.quantile(q), 4)},
    }
    save_result("h1", res)
    print(res)


if __name__ == "__main__":
    main()

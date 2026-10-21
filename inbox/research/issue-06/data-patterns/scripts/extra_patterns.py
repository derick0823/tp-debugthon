"""Patterns found in the data that PLAN.md did not list.

  1. Where is aging fastest (change of 65+ share, 110/1 -> 115/9)?
  2. 80+ residents and walk-ups without elevators.
  3. Brick buildings: where the pre-1971 cohort remains.
  4. Redevelopment activity (share of first sales of new buildings) vs old stock.

Usage:   uv run python -X utf8 research/issue-06/data-patterns/scripts/extra_patterns.py
Input:   data/marts/village_indicators.{csv,geojson}
Output:  out/extra_town_table.csv, out/extra_maps.png, results.json["extra"]
Network: no
"""

import matplotlib.pyplot as plt
import pandas as pd

from common import OUT, choropleth, mart, mart_geo, save_result, spearman


def main():
    t = mart()
    rows = {}
    for name, d in t.groupby("town_name"):
        rows[name] = {
            "share_65plus": round(d.pop_65plus.sum() / d.pop_total.sum(), 4),
            "share_80plus": round(d.pop_80plus.sum() / d.pop_total.sum(), 4),
            "change_65_110_115_median": round(d.share_65plus_change_110_115.median(), 4),
            "brick_reinforced_est_median": round(d.lvr_share_brick_reinforced_est.median(), 4),
            "walkup_median": round(d.lvr_share_walkup.median(), 4),
            "newbuild_median": round(d.lvr_share_newbuild.median(), 4),
        }
    town = pd.DataFrame(rows).T.sort_values("change_65_110_115_median", ascending=False)
    town.to_csv(OUT / "extra_town_table.csv", encoding="utf-8")
    print(town.to_string())

    t["walkup80"] = t.share_80plus * t.lvr_share_walkup
    top_walk80 = t.sort_values("walkup80", ascending=False).head(15)
    res = {
        "aging_change_city_median": round(t.share_65plus_change_110_115.median(), 4),
        "spearman_change_vs_share65": spearman(t.share_65plus_change_110_115, t.share_65plus),
        "spearman_change_vs_pre1982": spearman(t.share_65plus_change_110_115, t.lvr_share_pre1982_est),
        "spearman_change_vs_new2001": spearman(t.share_65plus_change_110_115, t.new2001_units_share),
        "spearman_80plus_vs_walkup": spearman(t.share_80plus, t.lvr_share_walkup),
        "spearman_65plus_vs_walkup": spearman(t.share_65plus, t.lvr_share_walkup),
        "spearman_80plus_vs_pre1982": spearman(t.share_80plus, t.lvr_share_pre1982_est),
        "top15_80plus_x_walkup": top_walk80[["town_name", "village_name", "share_80plus", "lvr_share_walkup",
                                             "lvr_n_built"]].values.tolist(),
        "brick_reinforced_est_top_town": town.brick_reinforced_est_median.sort_values(ascending=False).head(4).to_dict(),
        "spearman_newbuild_vs_pre1982": spearman(t.lvr_share_newbuild, t.lvr_share_pre1982_est),
        "spearman_newbuild_vs_65plus": spearman(t.lvr_share_newbuild, t.share_65plus),
        "fastest_aging_villages": t.sort_values("share_65plus_change_110_115", ascending=False).head(10)
        [["town_name", "village_name", "share_65plus_change_110_115", "share_65plus"]].values.tolist(),
    }
    save_result("extra", res)
    for k, v in res.items():
        print(k, v)

    g = mart_geo()
    g["walkup80"] = g.share_80plus * g.lvr_share_walkup
    fig, ax = plt.subplots(1, 3, figsize=(16, 6.5))
    choropleth(g, "share_65plus_change_110_115", "65+ 比例增加（110/1→115/9，百分點）", None, cmap="Purples", ax=ax[0])
    choropleth(g, "walkup80", "80+ 比例 × 無電梯公寓比例（實價）", None, cmap="Reds", ax=ax[1])
    choropleth(g, "lvr_share_brick_reinforced_est", "加強磚造比例（實價，收縮推估）", None, cmap="YlOrBr", ax=ax[2])
    fig.tight_layout()
    fig.savefig(OUT / "extra_maps.png", dpi=100)


if __name__ == "__main__":
    main()

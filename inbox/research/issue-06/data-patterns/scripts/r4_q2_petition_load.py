"""R4 Q2: how many petitions reach the building, planning and renewal offices, and how fast they close.

What this can and cannot show: the petition system (陳情系統) covers citizen petitions,
including 1999 hotline cases. It does not include city councillor inquiries (議員質詢、
議員服務案件), which the interviewed planning officer named as the main load. So this
measures one part of the load only.

Usage:   uv run python -X utf8 research/issue-06/data-patterns/scripts/r4_q2_petition_load.py
Input:   data/staged/civic/petition-categories.parquet
Output:  out/r4_q2_agency_monthly.csv, out/r4_q2_subcategory.csv, out/r4_q2_petitions.png,
         results.json["r4_q2"]
Network: no
"""

import matplotlib.pyplot as plt
import pandas as pd

from common import OUT, STAGED, save_result

OFFICES = {"建築管理工程處": "建管處", "都市發展局": "都發局", "都市更新處": "都更處"}
BUILD_MAIN = "都市發展、建管、產業、財稅及地政"


def main():
    d = pd.read_parquet(STAGED / "civic" / "petition-categories.parquet")
    n = d[d.layout == "new"].copy()           # 111/03 onward: agency and close date known
    n["ym"] = n.received.dt.to_period("M")
    n = n[n.ym <= pd.Period("2026-09", "M")]
    months = n.ym.nunique()

    n["office"] = n.agency.map(OFFICES)
    monthly = n.pivot_table(index="ym", columns="office", values="source_month", aggfunc="size").fillna(0)
    monthly["全市"] = n.groupby("ym").size()
    monthly.to_csv(OUT / "r4_q2_agency_monthly.csv", encoding="utf-8")

    off = n[n.office.notna()]
    sub = off.groupby(["office", "sub_category"]).agg(
        cases=("source_month", "size"), median_days=("days_to_close", "median")).reset_index()
    sub = sub.sort_values(["office", "cases"], ascending=[True, False])
    sub.to_csv(OUT / "r4_q2_subcategory.csv", index=False, encoding="utf-8")

    yr = n.groupby([n.received.dt.year, "office"]).size().unstack().fillna(0)
    # full years only for the trend
    yr = yr.loc[[y for y in yr.index if 2023 <= y <= 2025]]
    agency_rank = n.agency.value_counts()

    # long series by category (old + new layouts) for the building main category
    allm = d.copy()
    allm["y"] = allm.received.dt.year
    bm = allm[allm.main_category == BUILD_MAIN].groupby("y").size()

    res = {
        "months_new_layout": int(months),
        "period": f"{n.ym.min()}..{n.ym.max()}",
        "cases_all_new_layout": len(n),
        "cases_by_office": off.office.value_counts().to_dict(),
        "per_month_by_office": (off.office.value_counts() / months).round(0).to_dict(),
        "jianguan_rank_among_agencies": int(list(agency_rank.index).index("建築管理工程處") + 1),
        "jianguan_share_of_all": round((n.agency == "建築管理工程處").mean(), 4),
        "median_days_to_close_by_office": off.groupby("office").days_to_close.median().round(2).to_dict(),
        "median_days_to_close_all": round(n.days_to_close.median(), 2),
        "p90_days_to_close_by_office": off.groupby("office").days_to_close.quantile(0.9).round(1).to_dict(),
        "yearly_by_office_2023_2025": yr.astype(int).to_dict(),
        "top_subcategories": sub.groupby("office").head(3)[["office", "sub_category", "cases"]].values.tolist(),
        "renewal_planning_subcategory_cases": int(n.sub_category.str.contains("更新", na=False).sum()),
        "building_main_category_by_year": {int(k): int(v) for k, v in bm.items() if 2017 <= k <= 2025},
    }
    save_result("r4_q2", res)
    for k, v in res.items():
        print(k, v)

    fig, ax = plt.subplots(1, 2, figsize=(14, 4.6))
    m = monthly.copy()
    m.index = m.index.to_timestamp()
    m[[c for c in ["建管處", "都發局", "都更處"] if c in m]].plot(ax=ax[0])
    ax[0].set_title("每月陳情件數（受理機關，111/03～115/09）")
    ax[0].set_xlabel("")
    s = sub[sub.office == "建管處"].head(6)
    ax[1].barh(s.sub_category.str.slice(0, 18)[::-1], s.cases[::-1], color="#4c78a8")
    ax[1].set_title("建管處陳情的前 6 個次類別（件）")
    fig.tight_layout()
    fig.savefig(OUT / "r4_q2_petitions.png", dpi=100)


if __name__ == "__main__":
    main()

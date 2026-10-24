"""Stage durations of Taipei 168-project renewal cases (designation -> plan -> approval -> rights -> approval).

Purpose: median and quartiles of each review stage, in calendar days, for the renewal MVPs.
Usage:   uv run python -X utf8 research/issue-06/mvp-variants/uro-cases/scripts/stage_durations.py
Input:   research/issue-06/mvp-variants/uro-cases/out/uro-review-cases.csv
Output:  research/issue-06/mvp-variants/uro-cases/out/stage-durations.csv
         research/issue-06/mvp-variants/uro-cases/out/fig-stage-durations.png
Network: no
Notes:   a combined case (business+rights) files and gets approved once, so it has no
         gap between the two plans. That gap is measured per site_group: approval of the
         business-only case -> application of the rights-only case on the same site.
         Only first filings (擬訂) are used; revisions (變更) restart the clock.
"""

from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import pandas as pd  # noqa: E402

plt.rcParams["font.sans-serif"] = ["Microsoft JhengHei", "Noto Sans CJK TC", "PingFang TC", "sans-serif"]
plt.rcParams["axes.unicode_minus"] = False
OUT = Path(__file__).resolve().parents[1] / "out"


def days(a, b):
    return (pd.to_datetime(b, errors="coerce") - pd.to_datetime(a, errors="coerce")).dt.days


def main():
    d = pd.read_csv(OUT / "uro-review-cases.csv", dtype={"case_id": str})
    first = d[d.revision == "擬訂"]
    biz, both, rt = (first[first.plan_type == t] for t in ["business", "business+rights", "rights"])

    stages = [
        ("1 劃定 → 事業計畫申請", "事業計畫（單送＋併送）",
         days(pd.concat([biz, both]).define_date, pd.concat([biz, both]).apply_date_plan)),
        ("2a 事業計畫申請 → 核定", "只有事業計畫", days(biz.apply_date_plan, biz.approve_date_plan)),
        ("2b 事業＋權變併送申請 → 核定", "併送", days(both.apply_date_plan, both.approve_date_plan)),
        ("4 權變申請 → 核定", "只有權變", days(rt.apply_date_rt, rt.approve_date_rt)),
    ]
    # Stage 3: business-only approval -> rights-only application on the same site
    b = biz.dropna(subset=["approve_date_plan"]).groupby("site_group").approve_date_plan.min()
    r = rt.dropna(subset=["apply_date_rt"]).groupby("site_group").apply_date_rt.min()
    pair = pd.concat([b, r], axis=1, join="inner")
    stages.insert(3, ("3 事業計畫核定 → 權變申請", "同基地分送（依 site_group 配對）",
                      days(pair.approve_date_plan, pair.apply_date_rt)))

    rows, data = [], []
    for name, scope, s in stages:
        s = s.dropna()
        neg = int((s < 0).sum())
        s = s[s >= 0]  # negative = dates out of order on the platform
        data.append((name, s / 365.25))
        rows.append({"stage": name, "scope": scope, "n": len(s), "dropped_negative": neg,
                     "p25_days": s.quantile(.25), "median_days": s.median(), "p75_days": s.quantile(.75),
                     "median_years": round(s.median() / 365.25, 2)})
    t = pd.DataFrame(rows).round(1)
    t.to_csv(OUT / "stage-durations.csv", index=False, encoding="utf-8")
    print(t.to_string(index=False))

    fig, ax = plt.subplots(figsize=(8, 4.2), dpi=150)
    labels = [f"{n}\n（n＝{len(s)}，中位 {s.median():.1f} 年）" for n, s in data][::-1]
    ax.boxplot([s for _, s in data][::-1], orientation="horizontal", tick_labels=labels, showfliers=False, widths=0.5,
               medianprops={"color": "#E45756", "linewidth": 2})
    ax.set_xlabel("經過時間（年，日曆天換算；箱子＝中間一半的案，紅線＝中位數）")
    ax.set_title("臺北市都更 168 專案：各階段要多久（只算第一次擬訂）", fontsize=12)
    ax.tick_params(axis="y", labelsize=8)
    ax.spines[["top", "right"]].set_visible(False)
    fig.text(0.01, 0.01, "資料：臺北市都市更新審議服務平台 gis.uro.taipei，2026-10-22 擷取。只含 168 專案，不代表全部都更案。",
             fontsize=7, color="#666")
    fig.tight_layout(rect=(0, 0.04, 1, 1))
    fig.savefig(OUT / "fig-stage-durations.png")


if __name__ == "__main__":
    main()

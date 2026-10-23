"""Summaries of the gis.uro.taipei fact table for report.md.

Purpose: case counts, after/before unit price ratio by district, floor-area
         bonus item usage, burden ratio proxy, and a raw-vs-table spot check.
Usage:   uv run python -X utf8 research/issue-06/mvp-variants/uro-cases/scripts/analyze_uro_cases.py
Input:   research/issue-06/mvp-variants/uro-cases/out/uro-review-cases.csv
         data/raw/extra/renewal/uro-review-cases/<case_id>.json (spot check only)
Output:  research/issue-06/mvp-variants/uro-cases/out/summary-by-district.csv
         research/issue-06/mvp-variants/uro-cases/out/summary-bonus-items.csv
         research/issue-06/mvp-variants/uro-cases/out/fig-burden-ratio.png
         research/issue-06/mvp-variants/uro-cases/out/fig-bonus-items.png
         markdown tables on stdout, pasted into report.md by hand
Network: no
"""

import json
import sys
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import pandas as pd  # noqa: E402

plt.rcParams["font.sans-serif"] = ["Microsoft JhengHei", "Noto Sans CJK TC", "PingFang TC", "sans-serif"]
plt.rcParams["axes.unicode_minus"] = False

ROOT = Path(__file__).resolve().parents[5]
sys.path.insert(0, str(ROOT))
from pipelines.common import RAW  # noqa: E402

OUT = Path(__file__).resolve().parents[1] / "out"
RAW_DIR = RAW / "extra" / "renewal" / "uro-review-cases"
SPOT = ["09608223", "09503233"]  # plus 3 picked below, one per plan type
BONUS = {"dF1_m2": "ΔF1", "dF2_m2": "ΔF2", "dF3_m2": "ΔF3", "dF4_m2": "ΔF4", "dF4_1_m2": "ΔF4-1",
         "dF4_2_m2": "ΔF4-2", "dF4_3_m2": "ΔF4-3", "dF5_m2": "ΔF5", "dF5_1_m2": "ΔF5-1", "dF5_2_m2": "ΔF5-2",
         "dF5_3_m2": "ΔF5-3", "dF5_4_m2": "ΔF5-4", "dF5_5_m2": "ΔF5-5", "dF5_6_m2": "ΔF5-6", "dF6_m2": "ΔF6",
         "far_transfer_m2": "容積移轉"}


def q(s, p):
    return s.quantile(p) if len(s) else float("nan")


def md(df, index=False):
    """Markdown table without the optional tabulate dependency."""
    if index:
        df = df.reset_index()
    cell = lambda v: f"{v:,.3f}" if isinstance(v, float) else str(v)  # noqa: E731
    lines = ["| " + " | ".join(map(str, df.columns)) + " |", "|" + "---|" * len(df.columns)]
    lines += ["| " + " | ".join(cell(v) for v in r) + " |" for r in df.itertuples(index=False)]
    return "\n".join(lines)


def fig_burden(b, ref):
    """Histogram of the burden ratio proxy, with the check case marked."""
    fig, ax = plt.subplots(figsize=(7, 4), dpi=150)
    ax.hist(b * 100, bins=range(0, 85, 5), color="#4C78A8", edgecolor="white")
    ax.axvline(b.median() * 100, color="#333", linestyle="--", linewidth=1)
    top = ax.get_ylim()[1]
    ax.text(62, top * 0.90, f"- - 中位數 {b.median():.0%}", fontsize=10)
    ax.text(62, top * 0.80, f"中間一半的案：{q(b, .25):.0%}～{q(b, .75):.0%}", fontsize=9)
    if ref is not None:
        ax.axvline(ref * 100, color="#E45756", linewidth=1.5)
        ax.text(62, top * 0.70, f"— 核對例 09608223：{ref:.1%}", color="#E45756", fontsize=9)
    ax.set_xlim(0, 85)
    ax.set_xlabel("共同負擔比例（代理值）＝ 實施都市更新費用 ÷ 總銷售金額（%）")
    ax.set_ylabel("案數")
    ax.set_title(f"臺北市都更 168 專案：共同負擔比例分布（n＝{len(b)}）", fontsize=12)
    ax.spines[["top", "right"]].set_visible(False)
    fig.text(0.01, 0.01, "資料：臺北市都市更新審議服務平台 gis.uro.taipei，2026-10-22 擷取。只含 168 專案，不代表全部都更案。",
             fontsize=7, color="#666")
    fig.tight_layout(rect=(0, 0.04, 1, 1))
    fig.savefig(OUT / "fig-burden-ratio.png")
    plt.close(fig)


def fig_bonus(bonus, n):
    """Horizontal bars: share of cases that use each floor-area bonus item."""
    t = bonus[~bonus["item"].isin(["ΔF4", "ΔF5"])].iloc[::-1]  # parents duplicate their sub-items
    fig, ax = plt.subplots(figsize=(7, 5), dpi=150)
    ax.barh(t["item"], t.use_rate * 100, color="#59A14F")
    for y, (r, s) in enumerate(zip(t.use_rate, t.median_share_of_F0_when_used)):
        label = f"{r:.0%}" + (f"（用的案中位 +{s:.0%} F0）" if r > 0 and s == s else "")
        ax.text(r * 100 + 1, y, label, va="center", fontsize=8)
    ax.set_xlim(0, 125)
    ax.set_xlabel("使用這一項的案件比例（%）")
    ax.set_title(f"容積獎勵各項目使用比例（n＝{n} 案有 F0）", fontsize=12)
    ax.spines[["top", "right"]].set_visible(False)
    fig.text(0.01, 0.01, "資料：臺北市都市更新審議服務平台 gis.uro.taipei，2026-10-22 擷取。項目白話說明見 bonus-translator（debug-a0）。",
             fontsize=7, color="#666")
    fig.tight_layout(rect=(0, 0.04, 1, 1))
    fig.savefig(OUT / "fig-bonus-items.png")
    plt.close(fig)


def main():
    d = pd.read_csv(OUT / "uro-review-cases.csv", dtype={"case_id": str, "town_code": str})
    n_bad = int((d.burden_ratio_proxy.notna() & ~d.burden_ratio_ok).sum())
    d.loc[~d.burden_ratio_ok, "burden_ratio_proxy"] = pd.NA  # keep raw value in the CSV, drop it here
    print(f"burden ratio outside 5%-80%, excluded: {n_bad}")
    print("## counts\n")
    c = pd.DataFrame({
        "item": ["cases", "has_cost", "has_far", "has_price_pair", "has_burden_proxy", "fetched_all_6"],
        "n": [len(d), int(d.has_cost.sum()), int(d.has_far.sum()),
              int(d.price_ratio_after_res_to_before_land.notna().sum()), int(d.burden_ratio_proxy.notna().sum()),
              int(d.endpoints_fetched.fillna("").str.split(",").map(len).ge(6).sum())]})
    print(md(c))
    print("\n" + md(pd.crosstab(d.plan_type, d.has_cost, margins=True), index=True))

    # Rights-transformation plans carry the appraised prices; business-only plans may be older estimates
    p = d[d.price_ratio_after_res_to_before_land.notna()].copy()
    rows = []
    for (town, sub) in [("全市", p)] + list(p.groupby("town_name")):
        r = sub.price_ratio_after_res_to_before_land
        rows.append({"town_name": town, "n": len(sub), "ratio_p25": q(r, .25), "ratio_median": r.median(),
                     "ratio_p75": q(r, .75), "land_before_median": sub.land_price_before_per_ping.median(),
                     "res_after_median": sub.res_price_after_per_ping.median(),
                     "burden_proxy_median": sub.burden_ratio_proxy.median(),
                     "price_year_median": sub.price_year.median()})
    by_town = pd.DataFrame(rows)
    by_town.to_csv(OUT / "summary-by-district.csv", index=False, encoding="utf-8")
    print("\n## after residential / before land unit price, by district\n")
    print(md(by_town))

    print("\n## by plan type\n")
    g = p.groupby("plan_type").agg(n=("case_id", "size"),
                                   ratio_median=("price_ratio_after_res_to_before_land", "median"),
                                   burden_proxy_median=("burden_ratio_proxy", "median"))
    print(md(g, index=True))

    f = d[d.has_far == True].copy()  # noqa: E712
    brow = []
    for col, label in BONUS.items():
        v = pd.to_numeric(f[col], errors="coerce").fillna(0)
        used = v > 0
        share = (v[used] / f.loc[used, "far_F0_m2"])
        brow.append({"item": label, "cases_used": int(used.sum()), "use_rate": used.mean() if len(f) else 0,
                     "median_share_of_F0_when_used": share.median()})
    bonus = pd.DataFrame(brow)
    bonus.to_csv(OUT / "summary-bonus-items.csv", index=False, encoding="utf-8")
    print(f"\n## bonus items (cases with F0: {len(f)})\n")
    print(md(bonus))
    print("\nbonus_ratio (F-F0)/F0: p25 {:.3f} median {:.3f} p75 {:.3f}".format(
        q(f.bonus_ratio, .25), f.bonus_ratio.median(), q(f.bonus_ratio, .75)))
    b = d.burden_ratio_proxy.dropna()
    print("burden_ratio_proxy: n {} p10 {:.3f} p25 {:.3f} median {:.3f} p75 {:.3f} p90 {:.3f}".format(
        len(b), q(b, .1), q(b, .25), b.median(), q(b, .75), q(b, .9)))
    ref = d.loc[d.case_id == "09608223", "burden_ratio_proxy"]
    if len(b):
        fig_burden(b, ref.iloc[0] if len(ref) and ref.notna().all() else None)
    if len(f):
        fig_bonus(bonus, len(f))

    print("\n## spot check: raw response vs table\n")
    picks = list(SPOT)
    for t in ["business", "rights", "business+rights"]:
        cand = p[(p.plan_type == t) & ~p.case_id.isin(picks)]
        if len(cand):
            picks.append(cand.sort_values("case_id").iloc[len(cand) // 2].case_id)
    for cid in picks[:5]:
        rec = json.loads((RAW_DIR / f"{cid}.json").read_text(encoding="utf-8"))
        six = json.loads(rec["sixth"])
        six = six[0] if isinstance(six, list) else six
        four = json.loads(rec.get("fourth", "{}") or "{}")
        four = four[0] if isinstance(four, list) and four else four
        row = d[d.case_id == cid].iloc[0]
        print(f"- {cid} {row.case_name}")
        print(f"  raw sixth Renew_Mon1={six.get('Renew_Mon1')} Renew_Mon2={six.get('Renew_Mon2')} "
              f"Urban_Renew_Fee={six.get('Urban_Renew_Fee')} | table {row.land_price_before_per_ping} "
              f"{row.res_price_after_per_ping} {row.cost_total}")
        if isinstance(four, dict) and four:
            print(f"  raw fourth F={four.get('F')} F0={four.get('F0')} | table {row.far_F_m2} {row.far_F0_m2}")


if __name__ == "__main__":
    main()

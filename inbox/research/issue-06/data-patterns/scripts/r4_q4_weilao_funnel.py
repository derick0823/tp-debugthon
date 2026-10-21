"""R4 Q4: dangerous-old-building approvals over time and the approval -> permit -> completion funnel.

Join path:
  approval (list 1151002, lot numbers)
    -> construction permit covering the same lot (town + section + main lot number)
    -> use permit whose original construction permit is that permit (cp_key).
A permit counts only if issued no earlier than 365 days before the approval
(some permits were applied for before the plan was approved; see the permit remarks).
When several permits match, the earliest qualifying one is used; permits whose
remarks mention the act are preferred.

Usage:   uv run python -X utf8 research/issue-06/data-patterns/scripts/r4_q4_weilao_funnel.py
Input:   data/staged/renewal/dangerous-old-building-rebuild-approved-cases.csv
         data/staged/permits/construction-permits.csv, construction-permit-lots.csv
         data/staged/permits/use-permits.csv
         data/marts/village_rankings.csv
Output:  out/r4_q4_cases.csv, out/r4_q4_funnel_by_year.csv, out/r4_q4_funnel_by_town.csv,
         out/r4_q4_funnel.png, results.json["r4_q4"]
Network: no
"""

import matplotlib.pyplot as plt
import pandas as pd

from common import MARTS, OUT, STAGED, save_result
from pipelines.stage.stage_construction_permits import lot_key, parse_lot

LATEST, OLD = "1151002", "1150210"
LIST_DATE = pd.Timestamp("2026-09-30")     # the 1151002 list is "as of 115-09-30"


def main():
    w = pd.read_csv(STAGED / "renewal" / "dangerous-old-building-rebuild-approved-cases.csv",
                    dtype={"list_version": str, "town_code": str})
    cp = pd.read_csv(STAGED / "permits" / "construction-permits.csv", dtype={"cp_key": str, "village_code": str})
    lots = pd.read_csv(STAGED / "permits" / "construction-permit-lots.csv", dtype={"town_code": str})
    up = pd.read_csv(STAGED / "permits" / "use-permits.csv", dtype={"cp_key": str})

    new, old = w[w.list_version == LATEST].copy(), w[w.list_version == OLD].copy()
    new["approved_date"] = pd.to_datetime(new.approved_date)

    # lapse dynamics between the two list versions. The newer list renumbers the
    # cases, so match on lot number + approval date (unique in both lists).
    key = ["land_no", "approved_date"]
    old_k = old.assign(approved_date=pd.to_datetime(old.approved_date)).set_index(key)["lapsed"]
    nk = new.set_index(key)
    in_old = nk.index.isin(old_k.index)
    was_lapsed = pd.Series(nk.index.map(lambda k: old_k.get(k, None)), index=nk.index)
    newly_lapsed = nk[in_old & nk.lapsed.values & (was_lapsed == False).values]  # noqa: E712
    revived = nk[in_old & ~nk.lapsed.values & (was_lapsed == True).values]  # noqa: E712

    # approval -> construction permit
    new["lot"] = [parse_lot(x, t) for x, t in zip(new.land_no, new.town_code)]
    new["lot_key"] = [lot_key(*p[:3]) if p else None for p in new.lot]
    cp["issued_date"] = pd.to_datetime(cp.issued_date)
    m = (new[["case_id", "lot_key", "approved_date"]].dropna()
         .merge(lots[["permit_no", "lot_key"]].drop_duplicates(), on="lot_key")
         .merge(cp[["permit_no", "cp_key", "issued_date", "weilao_remark", "village_code", "geo_level",
                    "build_type"]], on="permit_no"))
    m = m[(m.build_type == "新建") & (m.issued_date >= m.approved_date - pd.Timedelta(days=365))]
    m = m.sort_values(["case_id", "weilao_remark", "issued_date"], ascending=[True, False, True])
    first = m.drop_duplicates("case_id").set_index("case_id")
    new["permit_no"] = new.case_id.map(first.permit_no)
    new["permit_issued"] = new.case_id.map(first.issued_date)
    new["permit_weilao_remark"] = new.case_id.map(first.weilao_remark)
    new["permit_village_code"] = new.case_id.map(first.village_code.where(first.geo_level.between(1, 3)))
    new["days_to_permit"] = (new.permit_issued - new.approved_date).dt.days
    # construction permit -> use permit (completion)
    done = up.dropna(subset=["cp_key"]).sort_values("completed_date").drop_duplicates("cp_key").set_index("cp_key")
    new["cp_key"] = new.case_id.map(first.cp_key)
    new["completed_date"] = pd.to_datetime(new.cp_key.map(done.completed_date))
    new["days_permit_to_done"] = (new.completed_date - new.permit_issued).dt.days
    new["age_days_at_list"] = (LIST_DATE - new.approved_date).dt.days

    act = new[~new.lapsed]
    by_year = new.groupby("approved_year_ad").agg(
        approved=("case_id", "size"), lapsed=("lapsed", "sum"),
        with_permit=("permit_no", lambda s: s.notna().sum()),
        completed=("completed_date", lambda s: s.notna().sum()))
    by_year["active"] = by_year.approved - by_year.lapsed
    by_year["permit_share_of_active"] = (new[~new.lapsed].groupby("approved_year_ad").permit_no.apply(
        lambda s: s.notna().mean())).round(3)
    by_year.to_csv(OUT / "r4_q4_funnel_by_year.csv", encoding="utf-8")
    by_town = new.groupby("town_name").agg(
        approved=("case_id", "size"), lapsed=("lapsed", "sum"),
        with_permit=("permit_no", lambda s: s.notna().sum()),
        completed=("completed_date", lambda s: s.notna().sum()),
        median_days_to_permit=("days_to_permit", "median"),
        median_site_m2=("site_area_m2", "median"))
    by_town["lapsed_share"] = (by_town.lapsed / by_town.approved).round(3)
    by_town["permit_share_of_active"] = ((by_town.with_permit) / (by_town.approved - by_town.lapsed)).round(3)
    by_town = by_town.sort_values("permit_share_of_active")
    by_town.to_csv(OUT / "r4_q4_funnel_by_town.csv", encoding="utf-8")
    new.drop(columns=["lot"]).to_csv(OUT / "r4_q4_cases.csv", index=False, encoding="utf-8")
    print(by_year.to_string())
    print(by_town.to_string())

    # matched permits give a village for some cases: are high-risk villages covered?
    r = pd.read_csv(MARTS / "village_rankings.csv", dtype={"village_code": str})
    stable = set(r[r.share_top46_city2019 >= 0.9].village_code) | set(r[r.share_top46_national2026 >= 0.9].village_code)
    top46 = set(r[r.composite_rank_city2019 <= 46].village_code)
    located = act.dropna(subset=["permit_village_code"])
    res = {
        "list_latest": LATEST, "cases": len(new), "lapsed": int(new.lapsed.sum()), "active": len(act),
        "cases_added_since_old": int((~in_old).sum()),
        "newly_lapsed_since_old": len(newly_lapsed), "lapsed_to_active_since_old": len(revived),
        "lapsed_share_by_approval_year": (new.groupby("approved_year_ad").lapsed.mean().round(3)).to_dict(),
        "lapsed_age_days_median": float(new[new.lapsed].age_days_at_list.median()),
        "active_with_permit": int(act.permit_no.notna().sum()),
        "active_with_permit_share": round(act.permit_no.notna().mean(), 3),
        "active_with_permit_share_approved_2yr_plus": round(
            act[act.age_days_at_list >= 730].permit_no.notna().mean(), 3),
        "lapsed_with_permit": int(new[new.lapsed].permit_no.notna().sum()),
        "permit_match_weilao_remark_share": round(act.permit_weilao_remark.mean(), 3),
        "days_to_permit_quantiles": act.days_to_permit.quantile([0.25, 0.5, 0.75]).round(0).to_dict(),
        "active_completed": int(act.completed_date.notna().sum()),
        "days_permit_to_done_median": float(act.days_permit_to_done.median()),
        "weilao_remark_permits_total": int(cp.weilao_remark.sum()),
        "active_located_to_village": len(located),
        "located_in_composite_top46_city2019": int(located.permit_village_code.isin(top46).sum()),
        "located_in_stable_top46": int(located.permit_village_code.isin(stable).sum()),
        "share_of_villages_in_top46": round(46 / 456, 3),
    }
    save_result("r4_q4", res)
    for k, v in res.items():
        print(k, v)

    fig, ax = plt.subplots(1, 2, figsize=(14, 4.8))
    by_year[["active", "lapsed"]].plot.bar(stacked=True, ax=ax[0], color=["#4c78a8", "#e45756"])
    ax[0].plot(range(len(by_year)), by_year.with_permit, "k.-", label="已取得建照")
    ax[0].set_title(f"危老核准案依核准年（清冊 {LATEST} 版）")
    ax[0].legend(["已取得建照", "有效", "失其效力"])
    ax[0].set_xlabel("核准年")
    t = by_town.sort_values("permit_share_of_active")
    ax[1].barh(t.index, t.permit_share_of_active * 100, color="#4c78a8")
    ax[1].set_title("各區有效核准案中已取得建照的比例（%）")
    fig.tight_layout()
    fig.savefig(OUT / "r4_q4_funnel.png", dpi=100)


if __name__ == "__main__":
    main()

"""R1d part 2: does "12 districts, 1 renewal officer each, ~100+ cases each, ~1,200 in total" add up?

No case-level list of all urban renewal cases is open. Two estimates:
  1. Stock from flow (Little's law): cases in review = applications per year x years in
     review. Applications 109-113: 124, 117, 173, 177, 262 (市政統計週報第 1353 號, via R4-TW).
     The official average review time exists as a statistic but its numbers were not
     found, so it is varied as a scenario.
  2. Lower bound by district: renewal cases that include city-owned land and are still
     "in process" (財政局 progress list, 115/3/31). Only cases with city land are listed.
For comparison: active dangerous-old-building approvals by district (建管處, not 都更處).

Usage:   uv run python -X utf8 research/issue-06/data-patterns/scripts/r1d_workload.py
Input:   data/raw/extra/renewal/urban-renewal-city-land-progress/city-land-urban-renewal-progress-1150331.utf8.csv
         research/issue-06/data-patterns/out/r4_q4_cases.csv
Output:  out/r1d_workload_by_town.csv, results.json["r1d_workload"]
Network: no
"""

import pandas as pd

from common import OUT, save_result
from pipelines.common import RAW

APPS = {2020: 124, 2021: 117, 2022: 173, 2023: 177, 2024: 262}   # ROC 109-113
YEARS_IN_REVIEW = [1.5, 2.5, 3.5, 4.5]
OFFICERS = 12
INTERVIEW_TOTAL, INTERVIEW_PER_OFFICER = 1200, 100


def main():
    rate_recent = sum(APPS[y] for y in (2022, 2023, 2024)) / 3
    rate_last = APPS[2024]
    scen = {f"{w}y": {"stock_at_3yr_avg": round(rate_recent * w), "per_officer_3yr_avg": round(rate_recent * w / OFFICERS),
                      "stock_at_2024_rate": round(rate_last * w), "per_officer_2024_rate": round(rate_last * w / OFFICERS)}
            for w in YEARS_IN_REVIEW}
    need_w_recent = INTERVIEW_TOTAL / rate_recent
    need_w_last = INTERVIEW_TOTAL / rate_last

    p = pd.read_csv(RAW / "extra" / "renewal" / "urban-renewal-city-land-progress"
                    / "city-land-urban-renewal-progress-1150331.utf8.csv")
    p = p[~p["地區別"].str.contains("新北市|桃園市", na=False)]
    p["in_process"] = p["最新辦理情形"].str.contains("程序中|概要", na=False)
    p["approved"] = p["最新辦理情形"].str.contains("核定", na=False)
    town = p.groupby("地區別").agg(city_land_cases=("序號", "size"), in_process=("in_process", "sum"),
                                  approved=("approved", "sum"))
    w = pd.read_csv(OUT / "r4_q4_cases.csv")
    town["weilao_active"] = w[~w.lapsed].groupby("town_name").size()
    town = town.fillna(0).astype(int).sort_values("in_process", ascending=False)
    town.to_csv(OUT / "r1d_workload_by_town.csv", encoding="utf-8")
    print(town.to_string())

    res = {
        "applications_per_year": APPS,
        "rate_2022_2024_avg": round(rate_recent, 1), "rate_2024": rate_last,
        "scenarios": scen,
        "years_in_review_needed_for_1200_at_avg": round(need_w_recent, 1),
        "years_in_review_needed_for_1200_at_2024": round(need_w_last, 1),
        "city_land_cases_taipei": int(len(p)),
        "city_land_in_process": int(p.in_process.sum()),
        "city_land_in_process_per_officer": round(p.in_process.sum() / OFFICERS, 1),
        "city_land_in_process_max_town": town.in_process.idxmax(),
        "city_land_in_process_max": int(town.in_process.max()),
        "weilao_active_per_town_mean": round(town.weilao_active.mean(), 1),
        "weilao_active_max_town": town.weilao_active.idxmax(), "weilao_active_max": int(town.weilao_active.max()),
    }
    save_result("r1d_workload", res)
    for k, v in res.items():
        print(k, v)


if __name__ == "__main__":
    main()

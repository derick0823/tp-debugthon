"""Stage approved dangerous-old-building rebuild cases (危老重建核准) from the PDF lists.

Every PDF list version in the raw folder is parsed and stacked, with `list_version`
(the date in the file name, e.g. 1151002). Use the latest version for counts; the
older version is kept to see which approvals lapsed between the two.

About 1 in 6 rows carry "失其效力" after the location: the approval lapsed.
Those rows are kept with lapsed=True; count only lapsed=False as active approvals.
A likely cause is the 180-day limit to apply for a building permit after approval
(enforcement rules §7) [inference, debug-aa]. A landmark name after a space
(e.g. "三德大飯店") is dropped before geocoding.

The location field usually has only a road name, so a village is a weak estimate
(geo_level 4 = majority village of that road). Use town_code for counts; use
village_code only with geo_level <= 3.

The parser joins wrapped lines, then matches
"<no> <site area> <district> <lot no>地號等土地 <location> <ROC date> <bonus numbers>".
It replaces workspace/archive/2026-10/agent-scripts-issue-06-extra/parse_weilao.py.

Usage:   uv run python -X utf8 -m pipelines.stage.stage_dangerous_old_building_cases
Input:   data/raw/extra/renewal/dangerous-old-building-rebuild-approved-cases/approved-cases-<YYYMMDD>.pdf
         data/staged/base/house-number-coordinates.parquet
Output:  data/staged/renewal/dangerous-old-building-rebuild-approved-cases.csv
         columns: list_version, case_id, town_code, town_name, land_no, location, site_area_m2,
                  approved_date (ISO), approved_year_ad, bonus_pct, bonus_items, lapsed,
                  village_code, x, y (EPSG:3826), geo_level, geo_note
Network: no
"""

import re

import pandas as pd
import pypdf

from pipelines.address import TOWNS, Geocoder, match_report
from pipelines.common import RAW, STAGED

SRC = RAW / "extra" / "renewal" / "dangerous-old-building-rebuild-approved-cases"
OUT = STAGED / "renewal" / "dangerous-old-building-rebuild-approved-cases.csv"
ROW_START = re.compile(r"\n(?!\d{1,4} [\d.]+ \S{2}區 )")
ROW = re.compile(r"^(\d{1,4}) ([\d.]+) (\S{2}區) (\S+?地號等?土地) (.*?)(\d{2,3}/\d{1,2}/\d{1,2})(.*)$")


def roc_date(s):
    try:
        y, m, d = (int(x) for x in str(s).split("/"))
        return pd.Timestamp(y + 1911, m, d)
    except (ValueError, TypeError):
        return pd.NaT


def parse_pdf(path):
    reader = pypdf.PdfReader(path)
    text = "\n".join((p.extract_text() or "") for p in reader.pages)
    text = ROW_START.sub(" ", text)
    rows = []
    for line in text.split("\n"):
        m = ROW.match(line.strip())
        if not m:
            continue
        no, area, dist, lot, loc, date, rest = m.groups()
        nums = rest.split()
        # "失其效力" can fall after the date on wrapped lines; keep it with the location
        tail = " ".join(x for x in nums if not re.fullmatch(r"[\d.]+", x))
        nums = [x for x in nums if re.fullmatch(r"[\d.]+", x)]
        rows.append({"case_id": int(no), "site_area_m2": area, "town_name": dist, "land_no": lot,
                     "location": (loc.strip() + " " + tail).strip(), "approved_roc": date,
                     "bonus_pct": nums[-1] if nums else None, "bonus_items": " ".join(nums[:-1])})
    d = pd.DataFrame(rows).sort_values("case_id")
    ids = set(d.case_id)
    missing = sorted(set(range(1, max(ids) + 1)) - ids)
    print(f"{path.name}: rows={len(d)} max id={max(ids)} missing ids={missing[:10]}")
    return d


def main():
    frames = []
    for p in sorted(SRC.glob("approved-cases-*.pdf")):
        d = parse_pdf(p)
        d["list_version"] = p.stem.split("-")[-1]
        frames.append(d)
    d = pd.concat(frames, ignore_index=True)
    d["town_code"] = d["town_name"].str.strip().map(TOWNS)
    d["site_area_m2"] = pd.to_numeric(d["site_area_m2"], errors="coerce")
    d["bonus_pct"] = pd.to_numeric(d["bonus_pct"], errors="coerce")
    d["approved_date"] = d["approved_roc"].map(roc_date)
    d["approved_year_ad"] = d["approved_date"].dt.year
    d["lapsed"] = d["location"].str.contains("效力", na=False)
    d["_loc"] = d["location"].str.split(r"\s+").str[0]
    d = Geocoder().locate_frame(d, "_loc", "town_code")
    match_report(d, "dangerous-old-building-cases")
    print(d.groupby("list_version").agg(rows=("case_id", "size"), lapsed=("lapsed", "sum")).to_string())
    print(f"unknown town={d.town_code.isna().sum()} bad date={d.approved_date.isna().sum()}")
    d["approved_date"] = d["approved_date"].dt.strftime("%Y-%m-%d")
    out = d[["list_version", "case_id", "town_code", "town_name", "land_no", "location", "site_area_m2",
             "approved_date", "approved_year_ad", "bonus_pct", "bonus_items", "lapsed", "village_code", "x", "y",
             "geo_level", "geo_note"]]
    OUT.parent.mkdir(parents=True, exist_ok=True)
    out.to_csv(OUT, index=False, encoding="utf-8")


if __name__ == "__main__":
    main()

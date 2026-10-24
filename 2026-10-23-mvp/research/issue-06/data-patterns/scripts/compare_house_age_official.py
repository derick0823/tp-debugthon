"""Compare our per-building built-year estimates with two official district-level house-age tables.

Usage:  uv run python -X utf8 research/issue-06/data-patterns/scripts/compare_house_age_official.py
Input:  data/marts/building_points.csv (our estimate; doorplate_units as the unit weight)
        data/raw/extra/housing-stats/segis-house-age-by-town-114q4/030007-house-age-by-town-114q4.zip (tax register, 2025 Q4)
        data/raw/extra/housing-stats/census-2020-taipei-tables/表３８　臺北市住宅之竣工年份.xlsx (2020 census, Nov 2020)
Output: research/issue-06/data-patterns/out/house_age_vs_official.csv, printed markdown table
Method: shares, not counts (official tables count dwellings; we count doorplates, which include non-residential floors).
        Our built year: built_year when present; for lvr_neighbor the midpoint of built_year_min/max; otherwise unknown.
        Tax register ages are as of 2025 Q4: >30 years = built 1995 or earlier, >50 years = built 1975 or earlier.
Network: none.
"""
import csv
import io
import zipfile
from collections import defaultdict
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parents[4]
OUT = ROOT / "research/issue-06/data-patterns/out/house_age_vs_official.csv"
TAX = ROOT / "data/raw/extra/housing-stats/segis-house-age-by-town-114q4/030007-house-age-by-town-114q4.zip"
CENSUS = ROOT / "data/raw/extra/housing-stats/census-2020-taipei-tables/表３８　臺北市住宅之竣工年份.xlsx"


def tax_table():
    z = zipfile.ZipFile(TAX)
    name = [n for n in z.namelist() if n.endswith(".csv")][0]
    rows = list(csv.reader(io.StringIO(z.read(name).decode("utf-8-sig"))))[2:]
    out = {}
    for r in rows:
        if r[1] != "臺北市":
            continue
        n = [float(x) for x in r[4:16]]  # FLD01 total, FLD02 mean age, FLD03..FLD12 age bands
        total = n[0]
        out[r[3]] = {"tax_units": total, "tax_mean_age": n[1],
                     "tax_over30": (n[9] + n[10] + n[11]) / total, "tax_over50": n[11] / total}
    return out


def census_table():
    ws = openpyxl.load_workbook(CENSUS, read_only=True).worksheets[0]
    out = {}
    for r in ws.iter_rows(values_only=True):
        v = [x for x in r if x is not None]
        if len(v) >= 6 and isinstance(v[0], str) and v[0].strip().endswith("區") and isinstance(v[1], (int, float)):
            total, b80, b90 = v[1], v[2], v[3]
            out[v[0].strip()] = {"census_units": total, "census_pre1980": b80 / total, "census_pre1990": (b80 + b90) / total}
    return out


def ours(town_names):
    w = defaultdict(lambda: defaultdict(float))
    with open(ROOT / "data/marts/building_points.csv", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            t = town_names.get(r["town_code"][:8])
            if not t:
                continue
            u = float(r["doorplate_units"] or 1)
            y = r["built_year"] or ""
            if not y and r["built_year_min"] and r["built_year_max"]:
                y = (float(r["built_year_min"]) + float(r["built_year_max"])) / 2
            d = w[t]
            d["units"] += u
            if y == "":
                d["unknown"] += u
                continue
            y = float(y)
            d["known"] += u
            d["le1995"] += u * (y <= 1995)
            d["le1975"] += u * (y <= 1975)
            d["le1980"] += u * (y <= 1980)
            d["le1990"] += u * (y <= 1990)
    out = {}
    for t, d in w.items():
        k = d["known"] or 1
        out[t] = {"our_units": d["units"], "our_unknown": d["unknown"] / d["units"],
                  "our_over30": d["le1995"] / k, "our_over50": d["le1975"] / k,
                  "our_pre1980": d["le1980"] / k, "our_pre1990": d["le1990"] / k}
    return out


def main():
    tax, cen = tax_table(), census_table()
    codes = {}
    z = zipfile.ZipFile(TAX)
    for r in list(csv.reader(io.StringIO(z.read([n for n in z.namelist() if n.endswith(".csv")][0]).decode("utf-8-sig"))))[2:]:
        if r[1] == "臺北市":
            codes[r[2]] = r[3]
    our = ours(codes)
    rows = []
    for t in codes.values():
        rows.append({"town": t, **tax[t], **cen.get(t, {}), **our.get(t, {})})
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0]))
        w.writeheader()
        w.writerows({k: round(v, 4) if isinstance(v, float) else v for k, v in r.items()} for r in rows)
    pct = lambda x: f"{x * 100:.0f}%"  # noqa: E731
    print("| 區 | 稅籍 >30 年 | 我們 >30 年 | 稅籍 >50 年 | 我們 >50 年 | 普查 1990 前 | 我們 1990 前 | 我們建成年不詳 |")
    print("|---|---|---|---|---|---|---|---|")
    for r in rows:
        print(f"| {r['town']} | {pct(r['tax_over30'])} | {pct(r['our_over30'])} | {pct(r['tax_over50'])} | {pct(r['our_over50'])} | "
              f"{pct(r['census_pre1990'])} | {pct(r['our_pre1990'])} | {pct(r['our_unknown'])} |")


if __name__ == "__main__":
    main()

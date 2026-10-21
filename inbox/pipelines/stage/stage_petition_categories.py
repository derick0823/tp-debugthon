"""Stage the Taipei petition system category data (臺北市陳情系統類別資料), all months.

Two source layouts, both written to one table:
  * 105/11 - 111/02: 序號, 案件主類別, 案件子類別, 受理日期, 民國年 (no agency, no close date)
  * 111/03 onward:   案件編號, 案件主類別, 案件次類別, 受理機關, 受理科室, 受理日期, 送達日期, 結案日期
No personal data is in the source (category and agency only).

Usage:   uv run python -X utf8 -m pipelines.stage.stage_petition_categories
Input:   data/raw/civic/petition-categories/<ROC year>/<YYYMM>.csv
Output:  data/staged/civic/petition-categories.parquet
         columns: source_month (YYYMM), layout (old|new), case_id, main_category, sub_category,
                  agency, unit, received (datetime), closed (datetime), days_to_close
Network: no
"""

import io

import pandas as pd

from pipelines.common import RAW, STAGED, read_text

SRC = RAW / "civic" / "petition-categories"
OUT = STAGED / "civic" / "petition-categories.parquet"


def read_month(p):
    text, _ = read_text(p)
    d = pd.read_csv(io.StringIO(text), dtype=str)
    if "案件編號" in d.columns:
        out = pd.DataFrame({
            "layout": "new", "case_id": d["案件編號"], "main_category": d["案件主類別"],
            "sub_category": d["案件次類別"], "agency": d["受理機關"], "unit": d["受理科室"],
            "received": pd.to_datetime(d["受理日期"], format="%Y%m%dT%H%M%S", errors="coerce"),
            "closed": pd.to_datetime(d["結案日期"], format="%Y%m%dT%H%M%S", errors="coerce"),
        })
    else:
        out = pd.DataFrame({
            "layout": "old", "case_id": None, "main_category": d["案件主類別"],
            "sub_category": d["案件子類別"], "agency": None, "unit": None,
            "received": pd.to_datetime(d["受理日期"], format="%Y%m%d", errors="coerce"), "closed": pd.NaT,
        })
    out["source_month"] = p.stem
    return out


def main():
    frames = [read_month(p) for p in sorted(SRC.glob("*/*.csv"))]
    d = pd.concat(frames, ignore_index=True)
    for c in ["main_category", "sub_category", "agency", "unit"]:
        d[c] = d[c].str.strip()
    d["days_to_close"] = ((d["closed"] - d["received"]).dt.total_seconds() / 86400).round(2)
    d = d[["source_month", "layout", "case_id", "main_category", "sub_category", "agency", "unit",
           "received", "closed", "days_to_close"]]
    print(f"rows={len(d)} months={d.source_month.nunique()} layouts={d.layout.value_counts().to_dict()} "
          f"bad received={d.received.isna().sum()}")
    OUT.parent.mkdir(parents=True, exist_ok=True)
    d.to_parquet(OUT, index=False)


if __name__ == "__main__":
    main()

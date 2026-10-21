"""Build one ranked list (CSV + XLSX) and summary counts from the GRB records that fetch_grb.py saved.

Usage (from the repo root):
    uv run python -X utf8 -m pipelines.stage.stage_grb_list
Input:  data/raw/extra/research/grb/{hits.json, details.jsonl}
        data/raw/extra/research/abri/abri_list.csv   (optional; fills the ABRI no-captcha URL column)
        data/manual/grb_keywords.csv
        data/manual/grb_picks.csv                    (optional; human picks, see below)
Output: data/staged/grb/grb_list.csv, grb_list.xlsx, grb_summary.json (replaced on each run)
No network. Needs openpyxl.

Human picks: the columns 要下載 and 已下載 come from data/manual/grb_picks.csv
(columns: GRB系統id, 要下載, 已下載, 備註). Do not edit them in grb_list.xlsx only:
this script rewrites that file. Copy the picks into grb_picks.csv first.

How a row is scored (string match only; a match is a lead, not a judgment):
    text  = title + Chinese keywords + plan abstract + report abstract
    tags  = one 0/1 column per TAGS entry below, matched against text
    score = 4 if the title matches TITLE_CORE (the issue-6 core words)
            + 3 if the title has 臺北/台北, else 1 if the text has it
            + 2 if the text matches the 建物耐震 tag
            + 1 per other topic tag (max 3)
            + 1 if the plan agency is in PRIORITY_AGENCIES
            + 1 per extra search term that found the plan (max 3)
            - 4 if the title matches NOT_BUILDING (bridges, dams, nuclear, ...)
    The title counts most because abstracts often name many topics (lesson of 2026-10-17:
    a first version that scored the abstract tags ranked smart-building and BIM reports on top).
"""
import collections
import csv
import json
import re
import sys
from openpyxl import Workbook
from openpyxl.cell.cell import ILLEGAL_CHARACTERS_RE
from openpyxl.styles import Alignment, Font
from openpyxl.utils import get_column_letter

from pipelines.common import MANUAL, RAW, STAGED

SRC = RAW / "extra" / "research" / "grb"
OUT = STAGED / "grb"
TERMS_CSV = MANUAL / "grb_keywords.csv"
PICKS_CSV = MANUAL / "grb_picks.csv"
XL_MAX = 32000

TAGS = {  # column name -> regex
    "臺北": r"臺北|台北",
    "建物耐震": r"耐震|補強|老舊建築|既有建築|危老|海砂|加強磚造|軟弱層|軟層|非韌性|集合住宅|公寓",
    "法規制度": r"法規|條例|規範|技術規則|建築法|法制|修法|制度|建築管理|公共安全檢查|標章",
    "國外做法": r"日本|美國|國外|各國|紐西蘭|加州|舊金山|洛杉磯|東京|神戶|義大利|土耳其|智利|歐洲|FEMA",
    "模型方法": r"層級分析|AHP|多準則|權重|指標|評分|優先順序|排序|風險地圖|GIS|地理資訊|加權",
    "地盤液化": r"液化|地盤|斷層|場址",
    "救災可及": r"消防|救災|巷道|巷弄|避難|搶救|防火",
    "高齡弱勢": r"高齡|老人|長者|弱勢|獨居|身心障礙",
    "都更重建": r"都市更新|都更|重建|整建",
}
OTHER_TOPICS = [t for t in TAGS if t not in ("臺北", "建物耐震")]
TITLE_CORE = (r"地震|耐震|震災|震害|震後|老舊|老劣化|既有建築|危老|危險建築|海砂|加強磚造|液化|斷層"
              r"|都市更新|都更|重建|整建|防災|救災|消防|搶救|避難|巷|高齡|老人|弱勢|韌性|風險")
NOT_BUILDING = r"港區|港灣|商港|自來水|給水|儲槽|配水池|橋梁|橋樑|隧道|核能|核電|水庫|壩|管線|電力|港灣|鐵路|捷運|邊坡|海堤|河川|水利|農|漁|森林|醫療|疫"
PRIORITY_AGENCIES = r"建築研究所|營建署|國土管理署|災害防救科技中心|[臺台]北[市巿]|地震工程|消防署"

sys.stdout.reconfigure(encoding="utf-8")
OUT.mkdir(parents=True, exist_ok=True)

term_group = {r["term"]: r["group"] for r in csv.DictReader(open(TERMS_CSV, encoding="utf-8"))}
hits = json.loads((SRC / "hits.json").read_text(encoding="utf-8"))
terms_of = collections.defaultdict(list)
for term, ids in hits.items():
    for i in ids:
        terms_of[i].append(term)

recs = {}
for line in open(SRC / "details.jsonl", encoding="utf-8"):
    line = line.strip()
    if not line:
        continue
    try:
        r = json.loads(line)
    except json.JSONDecodeError:  # last line can be half-written while fetch_grb.py runs
        continue
    recs[int(r["id"])] = r


def norm(s):
    s = re.sub(r"<[^>]+>", "", s or "")
    return re.sub(r"[\s「」『』（）()：:、，,．.－—\-_/·]", "", s)


# ABRI items have a PDF without a captcha. Match by normalized title (exact only).
abri = {}
abri_csv = RAW / "extra" / "research" / "abri" / "abri_list.csv"
if abri_csv.exists():
    for a in csv.DictReader(open(abri_csv, encoding="utf-8-sig")):
        abri.setdefault(norm(a["title"]), a["item_url"])

picks = {}
if PICKS_CSV.exists():
    for p in csv.DictReader(open(PICKS_CSV, encoding="utf-8-sig")):
        picks[int(p["GRB系統id"])] = p


def nm(x):
    return (x or {}).get("cname") or ""


def join(xs):
    return "；".join(str(x) for x in (xs or []) if x)


rows = []
for i, r in recs.items():
    rpt = r.get("grb05Report2") or {}
    title = r.get("title") or r.get("pnchDesc") or ""
    kw = r.get("keywordC") or r.get("keyword") or ""
    text = " ".join([title, kw, r.get("abstractC") or "", rpt.get("abstractC") or ""])
    tags = {t: int(bool(re.search(p, text))) for t, p in TAGS.items()}
    agency = r.get("planOrganName") or ""
    excu = r.get("excuOrganName") or ""
    not_building = int(bool(re.search(NOT_BUILDING, title)))
    priority = int(bool(re.search(PRIORITY_AGENCIES, agency + " " + excu)))
    terms = terms_of.get(i, [])
    title_core = int(bool(re.search(TITLE_CORE, title)))
    taipei = 3 if re.search(TAGS["臺北"], title) else tags["臺北"]
    score = (4 * title_core + taipei + 2 * tags["建物耐震"] + min(sum(tags[t] for t in OTHER_TOPICS), 3)
             + priority + min(len(terms) - 1, 3) - 4 * not_building)
    row = {
        "排序分數": score,
        "年度": r.get("planYear") or "",
        "計畫名稱": title,
        "主管機關": agency,
        "執行機構": excu,
        "有全文": "有" if r.get("hasFte") else "無",
        "全文文件數": len(r.get("fteDocIdList") or []),
        "報告頁數": rpt.get("page") or "",
        "詳目網址": f"https://www.grb.gov.tw/search/planDetail?id={i}",
        "建研所免驗證碼網址": abri.get(norm(title), ""),
        "要下載": picks.get(i, {}).get("要下載", ""),
        "已下載": picks.get(i, {}).get("已下載", ""),
        "備註": picks.get(i, {}).get("備註", ""),
        "命中關鍵字數": len(terms),
        "命中關鍵字": "；".join(terms),
        "命中組別": "；".join(sorted({term_group.get(t, "?") for t in terms})),
        **tags,
        "非建物標題": not_building,
        "優先機關": priority,
        "研究方式": nm(r.get("researchType")),
        "計畫主持人": join(r.get("host1NameC")),
        "研究人員": join((r.get("hostNameList") or []) + (r.get("hostOtherNameList") or [])),
        "中文關鍵字": kw,
        "計畫中文摘要": r.get("abstractC") or "",
        "報告中文摘要": rpt.get("abstractC") or "",
        "經費千元": r.get("planAmt") if r.get("planAmt") is not None else "",
        "計畫系統編號": r.get("projkey") or "",
        "GRB系統id": i,
    }
    rows.append(row)
rows.sort(key=lambda x: (-x["排序分數"], -(int(x["年度"]) if x["年度"] else 0)))
for n, row in enumerate(rows, 1):
    row["名次"] = n
cols = ["名次"] + [c for c in rows[0] if c != "名次"]

with open(OUT / "grb_list.csv", "w", encoding="utf-8-sig", newline="") as f:
    w = csv.DictWriter(f, fieldnames=cols)
    w.writeheader()
    w.writerows(rows)

wb = Workbook()
ws = wb.active
ws.title = "GRB第6題"
ws.append(cols)
for c in ws[1]:
    c.font = Font(bold=True)
url_col = cols.index("詳目網址") + 1
for row in rows:
    vals = []
    for c in cols:
        v = row[c]
        if isinstance(v, str):
            v = ILLEGAL_CHARACTERS_RE.sub("", v)
            if len(v) > XL_MAX:
                v = v[:XL_MAX] + "…（截斷，完整內容見 CSV）"
        vals.append(v)
    ws.append(vals)
    cell = ws.cell(row=ws.max_row, column=url_col)
    cell.hyperlink = row["詳目網址"]
    cell.font = Font(color="0563C1", underline="single")
widths = {"計畫名稱": 50, "主管機關": 20, "執行機構": 24, "詳目網址": 14, "命中關鍵字": 24,
          "中文關鍵字": 24, "計畫中文摘要": 60, "報告中文摘要": 60, "計畫主持人": 12}
for i, c in enumerate(cols, 1):
    ws.column_dimensions[get_column_letter(i)].width = widths.get(c, 7)
ws.freeze_panes = "D2"
ws.auto_filter.ref = ws.dimensions
for r_ in ws.iter_rows(min_row=2):
    for c in r_:
        c.alignment = Alignment(vertical="top", wrap_text=False)
wb.save(OUT / "grb_list.xlsx")


def band(y):
    if not y:
        return "未填"
    lo = 82 + (int(y) - 82) // 5 * 5
    return f"{lo}-{min(lo + 4, 115)}"


fte = [r for r in rows if r["有全文"] == "有"]
summary = {
    "records": len(rows),
    "有全文": len(fte),
    "有全文且分數>=6": sum(1 for r in fte if r["排序分數"] >= 6),
    "有全文且分數>=8": sum(1 for r in fte if r["排序分數"] >= 8),
    "有全文且臺北且建物耐震": sum(1 for r in fte if r["臺北"] and r["建物耐震"]),
    "對到建研所(全部)": sum(1 for r in rows if r["建研所免驗證碼網址"]),
    "對到建研所且GRB無全文": sum(1 for r in rows if r["建研所免驗證碼網址"] and r["有全文"] == "無"),
    "有全文x年度五年帶": {k: v for k, v in sorted(collections.Counter(band(r["年度"]) for r in fte).items())},
    "全部x年度五年帶": {k: v for k, v in sorted(collections.Counter(band(r["年度"]) for r in rows).items())},
    "標籤筆數(有全文)": {t: sum(r[t] for r in fte) for t in list(TAGS) + ["非建物標題", "優先機關"]},
    "主管機關前20(有全文)": dict(collections.Counter(r["主管機關"] or "未填" for r in fte).most_common(20)),
    "分數分布(有全文)": dict(sorted(collections.Counter(r["排序分數"] for r in fte).items(), reverse=True)),
}
(OUT / "grb_summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=1), encoding="utf-8")
print(json.dumps(summary, ensure_ascii=False, indent=1))

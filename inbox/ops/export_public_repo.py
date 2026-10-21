"""Export the shareable part of this repo into a clean working copy.

Usage (from repo root):
    uv run python -X utf8 ops/export_public_repo.py <target_dir> [--prefix inbox] [--include-briefs]

Input:  this repo's working tree: code, docs, research, and the issue-06 data listed
        in RAW_DIRS, STAGED_FILES and data/marts/shards_public/.
Output: files copied into <target_dir>/<prefix>/ (target_dir is an existing git clone,
        e.g. the team repo; prefix defaults to "inbox" so the team's own layout is untouched),
        plus a generated README.md, .gitignore and data/DATASETS.md in that folder.
        Files in that folder that match the whitelist but no longer exist here are removed.
        Nothing outside <prefix>/ is written or removed.
Network: none.

Whitelist and exclusions follow ops/backlog/todo/009-github-setup/README.md (plan B),
docs/data-licenses.md sections 3, 4 and 6, and consensus BD10:
- Only open-licensed sources that issue 06 uses go out (raw and staged).
- Internal per-building data never leaves: data/marts/building_points*,
  data/marts/shards/, research/.../prototype/data/, workspace/.
- Known-case address lists (sea sand, earthquake listed) leave only as the
  exact-match flags inside data/marts/shards_public/.
"""
from __future__ import annotations

import argparse
import csv
import datetime as dt
import json
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MB = 1024 * 1024
CODE_MAX = 10 * MB  # ops/CONVENTIONS.md §4a
DATA_MAX = 50 * MB  # GitHub warns above 50 MB and rejects above 100 MB
DATA_PREFIXES = ("data/raw/", "data/staged/", "data/marts/shards_public/")

INCLUDE_DIRS = ["pipelines", "docs", "research", "ops", "data/manual", "data/marts/shards_public"]
INCLUDE_FILES = [
    "pyproject.toml", "uv.lock", ".markdownlint.json", "CLAUDE.md",
    "data/catalog.json", "data/marts/README.md",
    "data/marts/village_indicators.csv", "data/marts/village_indicators.geojson",
    "data/marts/village_rankings.csv", "data/marts/village_rankings.geojson",
    "data/raw/extra/_sources.csv",
]
# Issue-06 raw sources under the open government data licence, whole folders.
RAW_DIRS = [
    "data/raw/base/village-population-by-age",
    "data/raw/building-hazard/building-count",
    "data/raw/building-hazard/fire-access-lanes",
    "data/raw/building-hazard/soil-liquefaction",
    "data/raw/event/open-data-license",
    "data/raw/extra/base/district-boundary-taipei",
    "data/raw/extra/base/elderly-living-alone-stats",
    "data/raw/extra/base/village-boundary-nlsc",
    "data/raw/extra/base/village-boundary-taipei-civil",
    "data/raw/extra/hazard/fire-listed-buildings-by-floor",
    "data/raw/extra/hazard/fire-rescue-difficult-areas",
    "data/raw/extra/hazard/liquefaction-boreholes-soil-taipei",
    "data/raw/extra/hazard/liquefaction-geologycloud-taipei-basin",
    "data/raw/extra/hazard/narrow-lanes-red-yellow",
    "data/raw/extra/hazard/road-width-planned",
    "data/raw/extra/housing-stats/building-floor-area-by-structure",
    "data/raw/extra/housing-stats/house-tax-housing-overview-by-tax-office",
    "data/raw/extra/housing-stats/household-housing-type-by-district",
    "data/raw/extra/housing-stats/use-permit-by-structure-57-94",
    "data/raw/extra/housing-stats/use-permit-by-structure-95-plus",
    "data/raw/extra/land/cadastral-sections-taipei",
    "data/raw/extra/land/cultural-heritage-boch",
    "data/raw/extra/land/cultural-heritage-taipei",
    "data/raw/extra/land/protected-trees-taipei",
    "data/raw/extra/land/zoning-taipei",
    "data/raw/extra/permits/building-permit-footprints",
    "data/raw/extra/permits/construction-permit-summary-115",
    "data/raw/extra/permits/demolition-permit-by-structure",
    "data/raw/extra/permits/use-permit-summary-115",
    "data/raw/extra/renewal/sea-sand-houses-stats",
    "data/raw/extra/renewal/urban-renewal-bonus-stats",
    "data/raw/extra/renewal/urban-renewal-city-land-completed",
    "data/raw/extra/renewal/urban-renewal-city-land-progress",
    "data/raw/extra/renewal/urban-renewal-finance-led",
]
# Issue-06 staged files -> source slugs they come from.
STAGED_FILES = {
    "data/staged/base/house-number-coordinates.parquet": ["house-number-coordinates"],
    "data/staged/base/village-boundary-nlsc.csv": ["village-boundary-nlsc"],
    "data/staged/base/village-boundary-nlsc.geojson": ["village-boundary-nlsc"],
    "data/staged/base/village-population-by-age.csv": ["village-population-by-age"],
    "data/staged/building-hazard/building-count.csv": ["building-count"],
    "data/staged/building-hazard/fire-access-lanes.csv": ["fire-access-lanes"],
    "data/staged/building-hazard/soil-liquefaction.geojson": ["soil-liquefaction"],
    "data/staged/hazard/fire-rescue-difficult-areas.csv": ["fire-rescue-difficult-areas"],
    "data/staged/hazard/liquefaction-boreholes-soil-taipei.geojson": ["liquefaction-boreholes-soil-taipei"],
    "data/staged/hazard/liquefaction-geologycloud-taipei-basin.geojson": ["liquefaction-geologycloud-taipei-basin"],
    "data/staged/hazard/narrow-lanes-red-yellow.csv": ["narrow-lanes-red-yellow"],
    "data/staged/hazard/road-width-planned.geojson": ["road-width-planned"],
    "data/staged/housing-stats/house-tax-housing-overview-by-tax-office.csv": ["house-tax-housing-overview-by-tax-office"],
    "data/staged/housing-stats/real-price-registration-lvr-all.parquet": ["real-price-registration-lvr", "lvr-history"],
    "data/staged/housing-stats/real-price-registration-lvr.csv": ["real-price-registration-lvr"],
    "data/staged/housing-stats/use-permit-by-structure.csv": ["use-permit-by-structure-57-94", "use-permit-by-structure-95-plus"],
    "data/staged/land/cultural-heritage.geojson": ["cultural-heritage-boch"],
    "data/staged/permits/building-permit-footprints.geojson": ["building-permit-footprints"],
    "data/staged/permits/construction-permit-lots.csv": ["construction-permit-summary-115", "construction-permit-summary-historical"],
    "data/staged/permits/construction-permits.csv": ["construction-permit-summary-115", "construction-permit-summary-historical"],
    "data/staged/permits/use-permits.csv": ["use-permit-summary-115", "use-permit-summary-historical"],
}
# Issue-06 sources that stay out of the export: slug -> (reason, what to use instead).
NOT_EXPORTED = {
    "house-number-coordinates": ("原始檔單檔 119 MB，超過 GitHub 單檔上限", "staged 版已放：`data/staged/base/house-number-coordinates.parquet`"),
    "real-price-registration-lvr": ("原始檔 100 MB", "staged 版已放：`data/staged/housing-stats/real-price-registration-lvr*.{csv,parquet}`"),
    "lvr-history": ("原始檔 401 MB、968 個檔", "staged 版已放（同上）；重抓：`pipelines/fetch/fetch_lvr_history.py`"),
    "construction-permit-summary-historical": ("原始檔單檔 87 MB", "staged 版已放：`data/staged/permits/construction-permit*.csv`"),
    "use-permit-summary-historical": ("原始檔單檔 65 MB", "staged 版已放：`data/staged/permits/use-permits.csv`"),
    "earthquake-listed-buildings": ("逐址列管清單。共識 BD10：不提供可瀏覽的清單", "`data/marts/shards_public/` 在精確門牌比對的棟上帶 `quake_listed` 旗標；里層級件數在 `village_indicators`"),
    "sea-sand-houses-list": ("逐址列管清單（市有建物 5 筆）。共識 BD10", "同上，旗標 `sea_sand`"),
    "sea-sand-houses-full-list": ("建管處 PDF，未標開放授權；只能彙總到里（data-licenses §4）", "同上，旗標 `sea_sand`；里層級件數在 `village_indicators`"),
    "dangerous-old-building-rebuild-approved-cases": ("建管處 PDF，未標開放授權；只發布彙總數字（data-licenses §4）", "里層級件數在 `village_indicators`"),
    "liquefaction-national-gsmma-2026": ("授權待確認（data-licenses §4）", "里層級比例 `*_national2026` 在 `village_indicators`，只當對照；官方查詢 https://liquefaction.gsmma.gov.tw"),
    "grb": ("研究報告清單，授權沒查；產品用不到", "研究結論在 `research/issue-06/`"),
    "abri": ("研究報告 PDF，著作權沒查", "同上"),
    "fulltext": ("研究報告全文 PDF（425 MB），著作權沒查", "同上"),
    "active-faults-gsmma-wms": ("WMS 截圖，程式沒有用到", "—"),
}
AGENCY_OVERRIDE = {
    "village-boundary-nlsc": "內政部國土測繪中心",
    "cultural-heritage-boch": "文化部文化資產局",
    "liquefaction-geologycloud-taipei-basin": "經濟部地質調查及礦業管理中心",
    "open-data-license": "國家發展委員會",
}
AGENCY_FULL_NAME = {"建管處": "臺北市建築管理工程處", "都發局": "臺北市政府都市發展局", "開發總隊": "臺北市政府地政局土地開發總隊"}
LICENSE_OVERRIDE = {
    "cultural-heritage-boch": "政府資料開放授權條款-第1版（6246、6965 已查；紀念建築、聚落兩類是推論）",
    "open-data-license": "授權條款本文",
}
EXCLUDE_PREFIXES = [
    "research/issue-06/solutions/prototype/data/",
    "data/marts/building_points", "data/marts/shards/",
    "workspace/",
]
EXCLUDE_PARTS = {"__pycache__", ".venv", ".git"}
BRIEFS_PREFIXES = [
    "research/issue-06/solutions/briefs/",
    "research/issue-06/city-workflow/2026-10-17-interviews.md",
]
# The shared-doc export is already public (anyone with the link can edit), so it always goes out.
BRIEFS_ALWAYS = ("research/issue-06/solutions/briefs/2026-10-18-gdoc-", "research/issue-06/solutions/briefs/gdoc-images/")
# Field names that must not appear in any exported data file.
LIST_FIELDS = ["sea_sand_list_address", "quake_listed_address"]
FORBIDDEN_FIELDS = ["liq_level_national2026", "liq_agreement", *LIST_FIELDS]
LIST_FIELDS_ALLOWED_IN = "data/marts/shards_public/"  # BD10 exact-match flags
DATA_SUFFIXES = {".csv", ".json", ".geojson"}


def wanted(rel: str, include_briefs: bool) -> bool:
    if any(part in EXCLUDE_PARTS for part in Path(rel).parts):
        return False
    if any(rel.startswith(p) for p in EXCLUDE_PREFIXES):
        return False
    if not include_briefs and not rel.startswith(BRIEFS_ALWAYS) and any(rel.startswith(p) for p in BRIEFS_PREFIXES):
        return False
    if rel in INCLUDE_FILES or rel in STAGED_FILES:
        return True
    return any(rel.startswith(d + "/") for d in INCLUDE_DIRS + RAW_DIRS)


def in_scope(rel: str) -> bool:
    """Target paths this script owns, so stale ones may be removed."""
    if rel in INCLUDE_FILES or rel in ("README.md", ".gitignore", "data/DATASETS.md"):
        return True
    return any(rel.startswith(d + "/") for d in INCLUDE_DIRS) or rel.startswith(("data/raw/", "data/staged/"))


INBOX_README = """# inbox：研究組整理的資料與研究

這個資料夾是研究組在賽前整理的東西，從研究 repo 匯出（{date}）。**只是參考資料，不代表隊伍的目錄、架構或分工。**要用哪些、要不要搬出去、怎麼搬，由隊伍決定。

## 裡面有什麼

| 資料夾 | 內容 |
|---|---|
| `data/` | 第 6 題用到的開放資料：原始下載檔、清洗後的表、里層級成品表、公開版門牌分片。索引在 `data/DATASETS.md` |
| `research/issue-06/` | 研究報告、決策紀錄、方案書、原型畫面（`solutions/prototype/`） |
| `pipelines/` | 從原始檔算出成品表的程式 |
| `docs/` | 活動規則、題目、資料授權表、作品說明草稿（`docs/submission/README.md`） |
| `ops/` | 研究 repo 的規範與待辦 |

## 從哪裡開始看

1. `research/issue-06/solutions/handoff/2026-10-21-backend-engineer.md`：5 分鐘的導覽。
2. `data/DATASETS.md`：每份資料是什麼、誰提供、出處怎麼標。

## 要注意

- 這個資料夾會被下一次匯出整份覆蓋。要改哪個檔，請複製到 `inbox/` 外面再改。
- 路徑都相對於 `inbox/`。要跑程式，先 `cd inbox`，再 `uv sync`。
- 沒放進來的資料與原因，見 `data/DATASETS.md` 第 4 節。
"""


def team_gitignore() -> str:
    """Ignore data/raw and data/staged except the exported paths, so a local re-fetch stays out of git."""
    lines = [
        "# Generated by ops/export_public_repo.py in the research repo. Do not edit here.",
        "# Applies to this folder only.",
        "# data/raw and data/staged: only the issue-06 files listed in data/DATASETS.md are tracked.",
        "",
        "# Internal data: never commit",
        "data/marts/building_points*",
        "data/marts/shards/",
        "research/issue-06/solutions/prototype/data/",
        "workspace/",
        "",
        "# Secrets",
        ".env",
        "*.env",
        "",
        "# Python, OS, editor",
        "__pycache__/", "*.pyc", ".venv/", ".DS_Store", "Thumbs.db", ".vscode/",
        "",
        "# Data layers: ignore all, then re-include the exported paths",
    ]
    tree: dict[str, set[str]] = {}
    for p in [d + "/" for d in RAW_DIRS] + list(STAGED_FILES) + ["data/raw/extra/_sources.csv"]:
        parts = p.rstrip("/").split("/")
        for i in range(2, len(parts)):
            last = i + 1 == len(parts)
            child = "/".join(parts[: i + 1]) + ("/" if not last or p.endswith("/") else "")
            tree.setdefault("/".join(parts[:i]), set()).add(child)
    for parent in sorted(tree):
        lines.append(f"{parent}/*")
        lines += [f"!{c}" for c in sorted(tree[parent])]
    return "\n".join(lines) + "\n"


def source_info() -> dict[str, dict]:
    """slug -> title, page, agency, license, folder, from the catalog, _sources.csv and _meta files."""
    info: dict[str, dict] = {}
    for s in json.loads((ROOT / "data/catalog.json").read_text(encoding="utf-8"))["sources"]:
        info[s["slug"]] = {"title": s.get("title", ""), "page": s.get("page_url", "")}
    with open(ROOT / "data/raw/extra/_sources.csv", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            info.setdefault(r["dir"], {}).update(title=r["title"], page=r["dataset_page"], license=r["license"])
    raw = ROOT / "data/raw"
    for d in [p for p in raw.glob("*/*") if p.is_dir()] + [p for p in raw.glob("extra/*/*") if p.is_dir()]:
        rec = info.setdefault(d.name, {})
        rec["folder"] = d.relative_to(ROOT).as_posix()
        for m in sorted(d.glob("_meta*.json")):
            try:
                pl = json.loads(m.read_text(encoding="utf-8")).get("payload", {})
            except (json.JSONDecodeError, AttributeError):
                continue
            rec.setdefault("agency", pl.get("maintainer_organization_name") or pl.get("sub_org_name") or pl.get("org_name") or "")
            rec.setdefault("license", pl.get("license_name", ""))
        rec["agency"] = AGENCY_OVERRIDE.get(d.name) or AGENCY_FULL_NAME.get(rec.get("agency", ""), rec.get("agency", ""))
        if d.name in LICENSE_OVERRIDE:
            rec["license"] = LICENSE_OVERRIDE[d.name]
    for rec in info.values():
        if not str(rec.get("page", "")).startswith("http"):
            rec.pop("page", None)  # a few _sources.csv rows hold notes, not URLs
    return info


def producer(rel: str, code: dict[str, str]) -> str:
    """The stage script whose docstring Output section names this staged file."""
    name = Path(rel).name
    for path, text in sorted(code.items()):
        if not path.startswith("pipelines/stage/"):
            continue
        doc = text.split('"""')[1] if text.count('"""') >= 2 else ""
        out = doc[doc.find("Output"):] if "Output" in doc else ""
        if name in out.split("Network")[0]:
            return f"`{path}`"
    return "—"


def used_by(slug: str, code: dict[str, str]) -> str:
    hits = sorted(rel for rel, text in code.items() if slug in text)
    return "、".join(f"`{h}`" for h in hits[:3]) + ("⋯" if len(hits) > 3 else "") if hits else "—"


def datasets_md() -> str:
    info = source_info()
    code = {p.relative_to(ROOT).as_posix(): p.read_text(encoding="utf-8", errors="ignore")
            for p in (ROOT / "pipelines").rglob("*.py")}
    size = lambda rel: (ROOT / rel).stat().st_size / MB  # noqa: E731
    out = [
        "# 資料索引（第 6 題）",
        "",
        f"> 由 `ops/export_public_repo.py` 產生，{dt.date.today().isoformat()}。每次匯出整份重寫，不要手改。",
        "> 路徑都相對於匯出的資料夾（團隊 repo 的 `inbox/`）。",
        "",
        "## 先看這裡",
        "",
        "1. 最省事的用法：拿 `data/marts/` 的成品表。研究組的原型只讀這一層。欄位字典在 `data/marts/README.md`。",
        "2. 要重算 marts：照 `pipelines/README.md` 跑。原始檔大多已在 `data/raw/`；不在的見第 4 節。",
        "3. 畫面或 README 用到任何一份資料，都要標出處（第 5 節）。沒標出處，等於沒取得授權。",
        "4. 這裡只有第 6 題用到的資料。其他題的原始檔可用 `uv run python -X utf8 -m pipelines.fetch.fetch_raw <slug>` 重抓。",
        "",
        "## 1. 成品表 `data/marts/`",
        "",
        "| 檔案 | 內容 | 公開時的條件 |",
        "|---|---|---|",
        "| `village_indicators.csv`、`.geojson` | 456 里 × 指標（人口、液化、屋齡、救災可及性、已知案件件數） | 全國 2026 版欄位（`*_national2026`）只當對照，畫面預設城市版 |",
        "| `village_rankings.csv`、`.geojson` | 456 里的五因子分級與排名區間 | 同上 |",
        "| `shards_public/<區碼>.json`、`index.json` | 逐門牌分片，12 區，給地址查詢用 | 海砂屋、黃單旗標只在精確門牌比對的棟上有值。不得做成可瀏覽的圖層、清單或地圖點（共識 BD10） |",
        "",
        "## 2. 清洗後 `data/staged/`",
        "",
        "| 檔案 | MB | 來源 slug | 產生程式 |",
        "|---|---:|---|---|",
    ]
    for rel, slugs in STAGED_FILES.items():
        if not (ROOT / rel).exists():
            continue
        out.append(f"| `{rel.removeprefix('data/staged/')}` | {size(rel):.1f} | {'、'.join(slugs)} | {producer(rel, code)} |")
    out += [
        "",
        "## 3. 原始下載檔 `data/raw/`",
        "",
        "原樣保存，不手改。每個資料夾的 `_meta*.json` 是入口網站的 metadata，`_manifest.json` 記錄下載時間與 sha256。",
        "",
        "| 資料夾 | 名稱 | 提供機關 | 授權 | 讀它的程式 |",
        "|---|---|---|---|---|",
    ]
    for d in RAW_DIRS:
        slug = d.rsplit("/", 1)[1]
        r = info.get(slug, {})
        title = f"[{r.get('title', slug)}]({r['page']})" if r.get("page") else r.get("title", slug)
        out.append(f"| `{d.removeprefix('data/raw/')}` | {title} | {r.get('agency') or '—'} | "
                   f"{r.get('license') or '—'} | {used_by(slug, code)} |")
    out += [
        "",
        "## 4. 第 6 題用到、但不在這個 repo 的資料",
        "",
        "| slug | 為什麼不放 | 要用時 |",
        "|---|---|---|",
    ]
    for slug, (why, alt) in NOT_EXPORTED.items():
        page = info.get(slug, {}).get("page")
        name = f"[{slug}]({page})" if page else slug
        out.append(f"| {name} | {why} | {alt} |")
    agencies = sorted({info.get(d.rsplit('/', 1)[1], {}).get("agency") for d in RAW_DIRS} - {None, ""})
    out += [
        "",
        "## 5. 出處標示",
        "",
        "政府資料開放授權條款第 1 版要求標示出處，格式如下（`docs/data-licenses.md` §2）：",
        "",
        "```text",
        "提供機關／單位 [年份] [開放資料釋出名稱與版本號]",
        "此開放資料依政府資料開放授權條款 (Open Government Data License) 進行公眾釋出，",
        "使用者於遵守本條款各項規定之前提下，得利用之。",
        "政府資料開放授權條款：https://data.gov.tw/license",
        "```",
        "",
        "本 repo 原始檔的提供機關：" + "、".join(agencies) + "。",
        "",
        "另外兩份要注意：",
        "",
        "- 文化部文化資產局的紀念建築、聚落兩類，授權和古蹟、歷史建築相同是推論，沒有逐一查證。",
        "- 底圖 OpenStreetMap 要標「© OpenStreetMap contributors」（ODbL）。",
        "",
    ]
    return "\n".join(out)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("target")
    ap.add_argument("--prefix", default="inbox", help="folder inside the target to export into ('' = repo root)")
    ap.add_argument("--include-briefs", action="store_true", help="also copy session briefs and interview notes")
    args = ap.parse_args()
    repo = Path(args.target).resolve()
    if not (repo / ".git").is_dir():
        print(f"target is not a git clone: {repo}", file=sys.stderr)
        return 1
    target = repo / args.prefix if args.prefix else repo

    copied, removed, skipped_big = [], [], []
    keep = set()
    for src in ROOT.rglob("*"):
        if not src.is_file():
            continue
        rel = src.relative_to(ROOT).as_posix()
        if not wanted(rel, args.include_briefs):
            continue
        limit = DATA_MAX if rel.startswith(DATA_PREFIXES) else CODE_MAX
        if src.stat().st_size > limit:
            skipped_big.append(rel)
            continue
        keep.add(rel)
        dst = target / rel
        dst.parent.mkdir(parents=True, exist_ok=True)
        if not dst.exists() or dst.stat().st_size != src.stat().st_size or dst.read_bytes() != src.read_bytes():
            shutil.copy2(src, dst)
            copied.append(rel)

    # Generated files: the folder's own README, .gitignore and data index.
    generated = {
        "README.md": INBOX_README.format(date=dt.date.today().isoformat()).encode("utf-8"),
        ".gitignore": team_gitignore().encode("utf-8"),
        "data/DATASETS.md": datasets_md().encode("utf-8"),
    }
    for rel, body in generated.items():
        dst = target / rel
        dst.parent.mkdir(parents=True, exist_ok=True)
        if not dst.exists() or dst.read_bytes() != body:
            dst.write_bytes(body)
            copied.append(f"{rel} (generated)")
        keep.add(rel)

    # Remove stale exported files (only within areas this script owns).
    for dst in target.rglob("*"):
        if not dst.is_file():
            continue
        rel = dst.relative_to(target).as_posix()
        if any(part in EXCLUDE_PARTS for part in Path(rel).parts):
            continue
        if in_scope(rel) and rel not in keep:
            dst.unlink()
            removed.append(rel)

    # Scan exported data files for internal fields.
    bad = []
    for rel in sorted(keep):
        p = target / rel
        suffix = p.suffix.lower()
        if suffix == ".parquet":
            import pyarrow.parquet as pq
            names = " ".join(pq.read_schema(p).names)
        elif suffix in DATA_SUFFIXES:
            names = p.read_text(encoding="utf-8", errors="ignore")[:200000]
        else:
            continue
        for f in FORBIDDEN_FIELDS:
            if f in LIST_FIELDS and rel.startswith(LIST_FIELDS_ALLOWED_IN):
                continue
            if f in names:
                bad.append((rel, f))
    leaked = [rel for rel in keep if rel.startswith("data/raw/") and any(f"/{slug}/" in rel for slug in NOT_EXPORTED)]
    leaked += [rel for rel in keep if rel.startswith("data/staged/") and rel not in STAGED_FILES]

    print(f"copied/updated {len(copied)} files, removed {len(removed)} stale files, kept {len(keep)} in scope")
    for rel in skipped_big:
        print(f"SKIPPED over size limit: {rel}")
    for rel in removed:
        print(f"removed: {rel}")
    if bad or leaked:
        for rel, f in bad:
            print(f"FORBIDDEN: {rel} contains {f}", file=sys.stderr)
        for rel in leaked:
            print(f"FORBIDDEN: {rel} belongs to a source that must not be exported", file=sys.stderr)
        return 2
    print("scan ok: no internal fields or excluded sources in exported files")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

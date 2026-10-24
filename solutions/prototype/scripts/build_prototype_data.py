"""Build the static data files the issue-06 prototype pages read.

Usage (from the repo root):
    uv run python -X utf8 research/issue-06/solutions/prototype/scripts/build_prototype_data.py

Input  (data/marts/, produced by pipelines/build/):
    village_rankings.geojson   geometry + 5-factor levels, rank intervals, S5 flags
    village_indicators.csv     raw indicator values per village
    building_points.parquet    one row per building (209,350)
    shards/<town_code>.json    c8 internal address shards (build_address_shards.py, not in git);
                               the only source of the sea_sand / quake_listed flag groups

Output (research/issue-06/solutions/prototype/data/, rewritten every run):
    villages.geojson           456 villages, rankings + selected indicators + p_<factor>
    buildings/<town_code>.json 12 shards, column-array format; sea_sand and
                               quake_listed flag groups copied by point_id from c8 shards (BD10)
    towns.json                 town list with shard file names and sizes
    meta.json                  data dates, factor definitions, level shares, disclaimer

Network: none.

List flags (BD10 "reveal only on an exact house-number match"):
    The six list columns (sea_sand, sea_sand_list_address, sea_sand_list_version,
    quake_listed, quake_listed_address, quake_listed_version) are taken from the
    c8 internal shards under data/marts/shards/, keyed by point_id. c8 attaches a
    flag only to buildings matched at geo_level 1 (exact house number) in
    build_building_points.py, so a building with no flag in the shard, or absent
    from the shard, gets null in all six columns here. This replaces the earlier
    string filter ("list address text normalises to exactly the building
    address"), which dropped 133/147 sea-sand and 23/32 yellow-tag buildings
    because list text usually names several house numbers and floors.
    The string filter (filter_exact_list_flags) is kept only as a fallback: it
    runs, with a warning, when data/marts/shards/ does not exist.

Field contract: see ../data/README.md. The address normaliser here must stay
identical to normalizeAddress() in ../assets/common.js.
"""

from __future__ import annotations

import json
import re
import sys
from datetime import date
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[5]
sys.path.insert(0, str(ROOT))
from pipelines.common import MARTS  # noqa: E402

PROTO = ROOT / "research" / "issue-06" / "solutions" / "prototype"
OUT = PROTO / "data"
OUT_BUILDINGS = OUT / "buildings"
C8_SHARDS = MARTS / "shards"  # internal version; shards_public drops liq_level_national2026 only

SHARD_SOFT_LIMIT = 4 * 1024 * 1024  # bytes; above this the reduction rules kick in
COORD_DECIMALS_VILLAGE = 6
COORD_DECIMALS_BUILDING = 5

# ---------------------------------------------------------------------------
# Factor definitions. Keys and field names are the contract with common.js.
# ---------------------------------------------------------------------------

FACTORS = [
    {
        "key": "elderly",
        "label": "高齡",
        "field_raw": "f_elderly",
        "field_level": "lv_elderly",
        "field_pct": "p_elderly",
        "definition": "65 歲以上人口比例",
        "source": "village-population-by-age",
        "data_date": "115 年 9 月",
        "kind": "原始",
        "unit": "ratio",
    },
    {
        "key": "old_stock",
        "label": "老屋存量",
        "field_raw": "f_old_stock",
        "field_level": "lv_old_stock",
        "field_pct": "p_old_stock",
        "definition": "有建成年的戶中，1999 政策線以前的比例（bld_share_pre_policy_1999）。已知棟數少於 20 的里改用所在區中位數",
        "source": "building_points（使照、實價登錄）",
        "data_date": "使照 90～115 年；成交 101S4～115S3",
        "kind": "推估",
        "unit": "ratio",
    },
    {
        "key": "liquefaction",
        "label": "液化",
        "versioned": True,
        "field_raw": "f_liquefaction_{v}",
        "field_level": "lv_liquefaction_{v}",
        "field_pct": "p_liquefaction_{v}",
        "definition": "高潛勢面積比例＋0.5×中潛勢面積比例，分母是整個里面積",
        "source": "soil-liquefaction（城市版）、liquefaction-national-gsmma-2026（全國版）",
        "data_date": "城市版 soil.taipei 2019 版；全國版 2026（115/9/24 更新）",
        "kind": "原始",
        "unit": "ratio",
    },
    {
        "key": "rescue",
        "label": "救災不便",
        "field_raw": "f_rescue",
        "field_level": "lv_rescue",
        "field_pct": "p_rescue",
        "definition": "（窄巷條數的百分位＋計畫道路寬度標註小於 6 m 比例的百分位）÷ 2",
        "source": "narrow-lanes-red-yellow、road-width-planned",
        "data_date": "窄巷 2026-10-17 下載；道路寬度 2021-03 版",
        "kind": "推估",
        "unit": "index",
    },
    {
        "key": "soft_story",
        "label": "一樓軟弱層候選",
        "field_raw": "f_soft_story",
        "field_level": "lv_soft_story",
        "field_pct": "p_soft_story",
        "definition": "（A 型＋B 型候選棟數）÷ 門牌棟數（soft_story_rate）",
        "source": "building_points，規格 gov-reports/soft-story-spec.md",
        "data_date": "門牌 2026-10-02 版；成交 101S4～115S3",
        "kind": "推估",
        "unit": "ratio",
    },
]

LIQ_VERSIONS = {
    "national2026": {"label": "全國 2026 版", "data_date": "2026（115/9/24 更新）", "source": "liquefaction-national-gsmma-2026"},
    "city2019": {"label": "城市版 2019", "data_date": "soil.taipei 2019 版", "source": "soil-liquefaction"},
}
DEFAULT_LIQ_VERSION = "city2019"

# Share of villages in each level, from level 5 (most dangerous) down to 1.
LEVEL_SHARES = {"5": 0.016, "4": 0.056, "3": 0.158, "2": 0.318, "1": 0.452}

# Indicator columns copied from village_indicators.csv into villages.geojson.
INDICATOR_COLUMNS = [
    "area_km2", "pop_total", "pop_65plus", "share_65plus", "pop_80plus", "share_80plus",
    "share_65plus_change_110_115",
    "liq_high_share_city2019", "liq_medium_share_city2019",
    "liq_high_share_national2026", "liq_medium_share_national2026",
    "borehole_n", "borehole_pl_median",
    "doorplate_units", "doorplate_buildings", "new2001_units",
    "town_share_age_30plus",
    "narrow_lanes_n", "narrow_lanes_red_n", "fire_rescue_sites_n", "fire_access_lanes",
    "road_markers_n", "road_markers_lt6m_share",
    "sea_sand_cases_n", "sea_sand_units", "quake_listed_n",
    "weilao_active_est", "town_weilao_active_n", "town_weilao_per_1k_old_bld",
    "bld_age_known_unit_share", "bld_age_known_n",
    "bld_share_pre_policy_1999", "bld_share_pre1982", "bld_share_pre1974", "bld_share_brick_reinforced",
    "soft_story_a_n", "soft_story_b_n", "soft_story_rate", "no_elevator_30plus_n",
    "pop_density_per_km2",
    "lvr_n_built", "lvr_built_year_median", "lvr_share_pre1982_est", "lvr_share_age50plus_est",
    # c8 2026-10-18: listed cultural-heritage sites inside the village (MOC BOCH open data,
    # 566 sites in Taipei with coordinates). Skipped with a warning when the csv lacks it.
    "heritage_sites_n",
]

INTEGER_COLUMNS = {
    "pop_total", "pop_65plus", "pop_80plus", "borehole_n", "doorplate_units", "doorplate_buildings",
    "new2001_units", "narrow_lanes_n", "narrow_lanes_red_n", "fire_rescue_sites_n", "road_markers_n",
    "sea_sand_cases_n", "sea_sand_units", "quake_listed_n", "town_weilao_active_n",
    "bld_age_known_n", "soft_story_a_n", "soft_story_b_n", "no_elevator_30plus_n",
    "lvr_n_built", "lvr_built_year_median", "heritage_sites_n",
}

# Data dates shown in page footers. Text copied from data/marts/README.md.
DATA_DATES = {
    "village_boundary": {"label": "里界", "source": "village-boundary-nlsc", "date": "115/8/17 版"},
    "population": {"label": "人口", "source": "village-population-by-age", "date": "115 年 9 月"},
    "liquefaction_city2019": {"label": "液化（城市版）", "source": "soil-liquefaction", "date": "soil.taipei 2019 版"},
    "liquefaction_national2026": {"label": "液化（全國 2026 版）", "source": "liquefaction-national-gsmma-2026", "date": "2026（115/9/24 更新）"},
    "boreholes": {"label": "液化鑽孔", "source": "liquefaction-boreholes-soil-taipei", "date": "soil.taipei"},
    "house_numbers": {"label": "門牌座標", "source": "house-number-coordinates", "date": "2026-10-02 版"},
    "house_tax": {"label": "房屋稅籍（區層級）", "source": "house-tax-housing-overview-by-tax-office", "date": "115 年度"},
    "use_permits": {"label": "使用執照", "source": "use-permit-summary-historical、use-permit-summary-115", "date": "90～115 年"},
    "real_price_village": {"label": "實價登錄（里層級）", "source": "real-price-registration-lvr", "date": "成交 114S4～115S3"},
    "real_price_building": {"label": "實價登錄（逐棟）", "source": "real-price-registration-lvr、lvr-history", "date": "成交 101S4～115S3"},
    "narrow_lanes": {"label": "狹小巷道", "source": "narrow-lanes-red-yellow", "date": "2026-10-17 下載"},
    "fire_rescue": {"label": "火災搶救困難場所", "source": "fire-rescue-difficult-areas", "date": "2026-10-17 下載"},
    "road_width": {"label": "計畫道路寬度", "source": "road-width-planned", "date": "2021-03 版"},
    "sea_sand": {"label": "海砂屋列管", "source": "sea-sand-houses-full-list", "date": "115/3/25 版"},
    "quake_listed": {"label": "地震黃單", "source": "earthquake-listed-buildings", "date": "115/3/18 版"},
    "weilao": {"label": "危老核准案", "source": "dangerous-old-building-rebuild-approved-cases", "date": "1151002 版（截至 115-09-30）"},
    "heritage": {"label": "文化資產", "source": "cultural-heritage-boch", "date": "2026-10-18 下載"},
}

DISCLAIMER = "本頁是事前排序與推估，不是官方耐震評估。等級是相對於臺北市其他里。資料日期見各欄。"
DATA_NOTE = ("真實資料：人口（115 年 9 月）、液化圖（城市 2019、全國 2026）、使用執照、實價登錄（101S4～115S3）、"
             "消防與窄巷清冊、海砂屋與黃單清冊。推估：建成年（實價登錄、鄰棟）、構造、一樓軟弱層候選、里層級比例。")
PUBLIC_DEFAULT_LIQ_VERSION = "city2019"  # BD9: public site defaults to city2019 until the national licence is confirmed

# Building shard columns, in output order. Columns missing from the parquet are
# skipped, so the shard layout follows whatever the mart currently has.
# quake_listed: consensus BD10 (2026-10-18, revised) treats yellow tags like
# sea-sand houses: the per-building flag ships, pages reveal it only on an exact
# address match. Both flag groups are copied from the c8 internal shards by
# point_id (apply_list_flags_from_c8); see the module docstring. Pages must
# still cope with the columns being absent (set INCLUDE_QUAKE_LISTED = False to
# drop them).
INCLUDE_QUAKE_LISTED = True
# (flag column, list address column, list version column)
LIST_FLAG_GROUPS = [
    ("sea_sand", "sea_sand_list_address", "sea_sand_list_version"),
    ("quake_listed", "quake_listed_address", "quake_listed_version"),
]
BUILDING_FIELDS = [
    "point_id", "address", "addr_norm", "village_code", "lon", "lat", "doorplate_units",
    "on_main_road", "status", "undetermined_reason",
    "built_year", "built_year_min", "built_year_max", "age_source", "age_conf", "code_generation",
    "structure_class", "status_structure", "floors", "lvr_building_type", "no_elevator_30plus",
    "liq_level_city2019", "liq_level_national2026", "liq_agreement",
    "soft_story_candidate", "sea_sand", "sea_sand_list_address", "sea_sand_list_version",
    # c8 2026-10-18: a heritage site point lies within 50 m (boolean; a pre-check, not a
    # preservation boundary). Skipped with a warning when the parquet lacks it.
    "near_heritage_50m",
]
QUAKE_FIELDS = ["quake_listed", "quake_listed_address", "quake_listed_version"]
# Reduction rule (applied to every shard, so all shards share one layout):
# low-cardinality string columns are dictionary-encoded. The shard carries
# {"enums": {col: [values...]}} and each row stores the index into that list
# (null stays null). common.js loadTownBuildings() decodes this.
ENUM_COLUMNS = [
    "village_code", "status", "undetermined_reason", "age_source", "age_conf", "code_generation",
    "structure_class", "status_structure", "lvr_building_type", "liq_level_city2019",
    "liq_level_national2026", "liq_agreement", "soft_story_candidate", "sea_sand",
    "sea_sand_list_version", "quake_listed", "quake_listed_version",
]

# ---------------------------------------------------------------------------
# Address normalisation. Mirror of normalizeAddress() in assets/common.js.
# ---------------------------------------------------------------------------

TOWN_NAMES = ["松山區", "信義區", "大安區", "中山區", "中正區", "大同區",
              "萬華區", "文山區", "南港區", "內湖區", "士林區", "北投區"]
CN_DIGITS = {"〇": 0, "零": 0, "一": 1, "二": 2, "兩": 2, "三": 3, "四": 4,
             "五": 5, "六": 6, "七": 7, "八": 8, "九": 9}
_RE_WS = re.compile(r"[\s　]+")
_RE_FULLWIDTH = re.compile(r"[！-～]")
_RE_CN_NUM = re.compile(r"([〇零一二兩三四五六七八九十百]+)(段|巷|弄|號|樓|層)")
_RE_CN_ZHI = re.compile(r"之([〇零一二兩三四五六七八九十百]+)")
_RE_DASH = re.compile(r"(\d)[\-－—–](\d)")
_RE_FLOOR = re.compile(r"(\d+樓.*|\d+層.*|\d+[Ff].*|[Bb]\d+.*|地下.*)$")
_RE_ZHI_ONLY = re.compile(r"(?<!\d)之(\d+)號")  # 8弄之3號 -> 8弄3號 (no base number)
_RE_ZHI = re.compile(r"之\d+")
_RE_TOWN = re.compile("^(" + "|".join(TOWN_NAMES) + ")")


def cn_to_int(text: str) -> int | None:
    """Chinese numeral (1..999) to int. Returns None when it cannot parse."""
    if not text:
        return None
    hundreds = 0
    if "百" in text:
        h, _, text = text.partition("百")
        if h and h not in CN_DIGITS:
            return None
        hundreds = (CN_DIGITS[h] if h else 1) * 100
        if not text:
            return hundreds
        if len(text) == 1 and text in CN_DIGITS and text not in ("〇", "零"):
            return hundreds + CN_DIGITS[text] * 10  # 一百五 -> 150
        text = text.lstrip("〇零")
        rest = cn_to_int(text) if text else 0
        return None if rest is None else hundreds + rest
    if "十" in text:
        tens, _, ones = text.partition("十")
        t = CN_DIGITS.get(tens, 1) if tens else 1
        o = CN_DIGITS.get(ones, 0) if ones else 0
        if (tens and tens not in CN_DIGITS) or (ones and ones not in CN_DIGITS):
            return None
        return t * 10 + o
    total = 0
    for ch in text:
        if ch not in CN_DIGITS:
            return None
        total = total * 10 + CN_DIGITS[ch]
    return total


def normalize_address(raw: str) -> str:
    """Normalise a Taipei street address to the building_points `address` form.

    Rules (keep in sync with common.js):
      1. remove all whitespace
      2. full-width ASCII to half-width
      3. 台 -> 臺 (same direction as pipelines/address.py and SPEC §3.3)
      4. strip a leading 臺北市 and a leading district name
      5. Chinese numerals before 段/巷/弄/號/樓/層 and after 之 to Arabic digits
      6. a dash between digits -> 之
      7. drop the floor part (N樓..., N層..., NF..., BN..., 地下...)
      8. drop every 之N (sub-numbers are merged into the base door plate)
    """
    s = _RE_WS.sub("", str(raw or ""))
    s = _RE_FULLWIDTH.sub(lambda m: chr(ord(m.group(0)) - 0xFEE0), s)
    s = s.replace("台", "臺")
    if s.startswith("臺北市"):
        s = s[3:]
    s = _RE_TOWN.sub("", s)

    def _num(m):
        n = cn_to_int(m.group(1))
        return (str(n) if n is not None else m.group(1)) + m.group(2)

    s = _RE_CN_NUM.sub(_num, s)
    s = _RE_CN_ZHI.sub(lambda m: "之" + (str(cn_to_int(m.group(1))) if cn_to_int(m.group(1)) is not None else m.group(1)), s)
    s = _RE_DASH.sub(r"\1之\2", s)
    s = _RE_FLOOR.sub("", s)
    s = _RE_ZHI_ONLY.sub(r"\1號", s)
    s = _RE_ZHI.sub("", s)
    return s


_CITY_PREFIXES = ("臺北市", "台北市")


def normalize_list_address(raw: str) -> str:
    """Normalise a list (清冊) address for the exact-match filter.

    The list text may start with 臺北市 and a district name; both are removed
    before the ordinary normaliser runs (which strips them again after 台 -> 臺,
    so the explicit step only matters for odd spellings).
    """
    s = _RE_WS.sub("", str(raw or ""))
    for prefix in _CITY_PREFIXES:
        if s.startswith(prefix):
            s = s[len(prefix):]
            break
    s = _RE_TOWN.sub("", s)
    return normalize_address(s)


def filter_exact_list_flags(df: pd.DataFrame) -> dict:
    """FALLBACK ONLY (used when data/marts/shards/ is missing).

    Earlier BD10 reading for the sea_sand and quake_listed flag groups: a
    building keeps its flag, list address and list version only when the
    normalised list address equals the normalised building address. Otherwise
    all three columns are set to null for that row. Too strict in practice
    (list text names several numbers and floors), kept so the build still runs
    without the c8 shards. Returns per-flag counts
    {flag: {"in_mart": n, "kept": k, "dropped": n - k}}.
    """
    counts = {}
    addr_norm = df["address"].map(normalize_address)
    for flag, addr_col, ver_col in LIST_FLAG_GROUPS:
        if flag not in df.columns:
            continue
        cols = [c for c in (flag, addr_col, ver_col) if c in df.columns]
        has = df[flag].notna()
        if addr_col in df.columns:
            list_norm = df.loc[has, addr_col].map(normalize_list_address)
            keep = has.copy()
            keep.loc[has] = (list_norm == addr_norm.loc[has]).values
        else:
            keep = pd.Series(False, index=df.index)  # no list address, nothing can match
        drop = has & ~keep
        df.loc[drop, cols] = None
        n_in = int(has.sum())
        n_keep = int(keep.sum())
        counts[flag] = {"in_mart": n_in, "kept": n_keep, "dropped": n_in - n_keep}
        print(f"{flag}: {n_in} flagged in mart, {n_keep} kept on exact list-address match, {n_in - n_keep} dropped")
    return counts


LIST_FLAG_COLUMNS = [c for group in LIST_FLAG_GROUPS for c in group]


def _shard_flag_value(col: str, v):
    """c8 shard value -> the form the prototype ships (quake_listed int -> str)."""
    if v is None or v == "":
        return None
    if col == "quake_listed":
        return str(int(v)) if isinstance(v, (int, float)) else str(v)
    return v


def apply_list_flags_from_c8(df: pd.DataFrame) -> dict:
    """BD10: take the six list-flag columns from the c8 internal shards by point_id.

    c8 (pipelines/build/build_address_shards.py) sets sea_sand / quake_listed only
    on buildings matched at geo_level 1, so copying them is the exact-house-number
    rule without re-deriving it here. Every list column is first set to null, then
    filled where the shard record for that point_id carries the flag. A point_id
    missing from the shards, or a record without the flag, stays null.
    Returns {flag: {"in_mart": n, "kept": k, "dropped": n - k, "added": a}} plus
    bookkeeping about the shard files.
    """
    shard_files = sorted(C8_SHARDS.glob("6*.json"))
    if not shard_files:
        raise FileNotFoundError(f"no town shards under {C8_SHARDS}")
    parquet_mtime = (MARTS / "building_points.parquet").stat().st_mtime
    stale = [p.name for p in shard_files if p.stat().st_mtime < parquet_mtime - 1]
    if stale:
        print(f"WARNING c8 shards older than building_points.parquet, rerun build_address_shards: {stale}")

    flags_by_id: dict[str, dict] = {}
    n_records = 0
    for path in shard_files:
        shard = json.loads(path.read_text(encoding="utf-8"))
        for rec in shard["records"]:
            n_records += 1
            vals = {c: _shard_flag_value(c, rec.get(c)) for c in LIST_FLAG_COLUMNS}
            if any(v is not None for v in vals.values()):
                flags_by_id[rec["point_id"]] = vals
    ids_in_df = set(df["point_id"])
    orphan = [pid for pid in flags_by_id if pid not in ids_in_df]
    if orphan:
        print(f"WARNING {len(orphan)} flagged point_ids in c8 shards are not in the parquet: {orphan[:5]}")

    before = {flag: df[flag].notna() if flag in df.columns else pd.Series(False, index=df.index)
              for flag, _, _ in LIST_FLAG_GROUPS}
    for col in LIST_FLAG_COLUMNS:
        df[col] = df["point_id"].map(lambda pid, c=col: flags_by_id.get(pid, {}).get(c))
        df[col] = df[col].astype(object).where(df[col].notna(), None)

    counts = {"source": f"{C8_SHARDS.relative_to(ROOT).as_posix()} ({len(shard_files)} files, {n_records} records)"}
    for flag, _, _ in LIST_FLAG_GROUPS:
        after = df[flag].notna()
        n_in = int(before[flag].sum())
        n_keep = int((before[flag] & after).sum())
        n_added = int((~before[flag] & after).sum())
        counts[flag] = {"in_mart": n_in, "kept": n_keep, "dropped": n_in - n_keep, "added": n_added,
                        "shipped": int(after.sum())}
        print(f"{flag}: {n_in} flagged in mart, {int(after.sum())} shipped from c8 shards "
              f"({n_keep} kept, {n_in - n_keep} dropped, {n_added} added)")
    return counts


def apply_list_flags(df: pd.DataFrame) -> tuple[dict, str]:
    """Pick the flag source: c8 shards when present, else the old string filter."""
    if C8_SHARDS.is_dir() and any(C8_SHARDS.glob("6*.json")):
        rule = ("六欄旗標以 point_id 從 c8 內部分片 data/marts/shards/ 取得；c8 只在 geo_level＝1（精確門牌）"
                "的棟上掛旗標，分片沒有該棟或旗標為空就設空（BD10 精確比對）")
        return apply_list_flags_from_c8(df), rule
    print(f"WARNING {C8_SHARDS} not found; run `uv run python -X utf8 -m pipelines.build.build_address_shards`. "
          "Falling back to the exact list-address string filter (keeps far fewer flags).")
    rule = ("【退回方案】清冊原文地址正規化後等於該棟 address 才保留旗標、清冊地址與版本；不相等三欄都設空"
            "（c8 分片不存在時的字串過濾）")
    return filter_exact_list_flags(df), rule


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def clean(v, integer=False):
    """pandas scalar -> JSON scalar. NaN -> None, numpy -> python."""
    if v is None:
        return None
    if isinstance(v, float) and v != v:
        return None
    if hasattr(v, "item"):
        v = v.item()
    if isinstance(v, float):
        if v != v:
            return None
        if integer:
            return int(round(v))
        return round(v, 4)
    if isinstance(v, str) and v == "":
        return None
    return v


def round_coords(coords, nd):
    if isinstance(coords[0], (int, float)):
        return [round(coords[0], nd), round(coords[1], nd)]
    return [round_coords(c, nd) for c in coords]


def percentile_rank(series: pd.Series) -> pd.Series:
    """Danger percentile in (0, 1]: rank(method='average') / n, NaN -> 0."""
    s = series.fillna(0.0)
    return (s.rank(method="average") / len(s)).round(4)


def level_from_pct(p: float) -> int:
    """Level 1..5 from a danger percentile, using LEVEL_SHARES from the top."""
    cum = 0.0
    for lv in ("5", "4", "3", "2"):
        cum += LEVEL_SHARES[lv]
        if p > 1 - cum + 1e-9:
            return int(lv)
    return 1


def fmt_bytes(n: int) -> str:
    return f"{n / 1024 / 1024:.2f} MB" if n >= 1024 * 1024 else f"{n / 1024:.0f} KB"


def dump(path: Path, obj, compact=False) -> int:
    path.parent.mkdir(parents=True, exist_ok=True)
    if compact:
        text = json.dumps(obj, ensure_ascii=False, separators=(",", ":"))
    else:
        text = json.dumps(obj, ensure_ascii=False, indent=1)
    path.write_text(text, encoding="utf-8")
    return path.stat().st_size


# ---------------------------------------------------------------------------
# villages.geojson
# ---------------------------------------------------------------------------

def build_villages():
    rankings = json.loads((MARTS / "village_rankings.geojson").read_text(encoding="utf-8"))
    ind = pd.read_csv(MARTS / "village_indicators.csv", dtype={"village_code": str, "town_code": str})
    ind = ind.set_index("village_code")

    props = pd.DataFrame([f["properties"] for f in rankings["features"]]).set_index("village_code")
    n = len(props)

    pct = {}
    for fac in FACTORS:
        if fac.get("versioned"):
            for v in LIQ_VERSIONS:
                pct[fac["field_pct"].format(v=v)] = percentile_rank(props[fac["field_raw"].format(v=v)])
        else:
            pct[fac["field_pct"]] = percentile_rank(props[fac["field_raw"]])
    pct = pd.DataFrame(pct)

    # Sanity: our level function should reproduce the marts levels almost everywhere.
    agree = 0
    total = 0
    for fac in FACTORS:
        pairs = []
        if fac.get("versioned"):
            for v in LIQ_VERSIONS:
                pairs.append((fac["field_pct"].format(v=v), fac["field_level"].format(v=v)))
        else:
            pairs.append((fac["field_pct"], fac["field_level"]))
        for p_col, lv_col in pairs:
            ours = pct[p_col].map(level_from_pct)
            agree += int((ours.values == props[lv_col].values).sum())
            total += n
    print(f"level_from_pct agrees with marts lv_* on {agree}/{total} ({agree / total:.1%})")

    indicator_columns = [c for c in INDICATOR_COLUMNS if c in ind.columns]
    for col in INDICATOR_COLUMNS:
        if col not in ind.columns:
            print(f"WARNING indicator column {col!r} not in village_indicators.csv, skipped")

    features = []
    missing = []
    for feat in rankings["features"]:
        p = dict(feat["properties"])
        code = p["village_code"]
        if code not in ind.index:
            missing.append(code)
            continue
        row = ind.loc[code]
        for col in indicator_columns:
            p[col] = clean(row[col], integer=col in INTEGER_COLUMNS)
        for col in pct.columns:
            p[col] = clean(pct.loc[code, col])
        for k, v in list(p.items()):
            if isinstance(v, float):
                p[k] = clean(v)
        features.append({
            "type": "Feature",
            "properties": p,
            "geometry": {
                "type": feat["geometry"]["type"],
                "coordinates": round_coords(feat["geometry"]["coordinates"], COORD_DECIMALS_VILLAGE),
            },
        })
    if missing:
        print(f"WARNING {len(missing)} villages in rankings missing from indicators: {missing[:5]}")

    out = {
        "type": "FeatureCollection",
        "name": "villages",
        "generated": date.today().isoformat(),
        "features": features,
    }
    size = dump(OUT / "villages.geojson", out, compact=True)
    print(f"villages.geojson  {len(features):>7} features  {fmt_bytes(size)}")
    if "heritage_sites_n" in indicator_columns:
        with_heritage = sum(1 for f in features if (f["properties"].get("heritage_sites_n") or 0) > 0)
        total_sites = sum(int(f["properties"].get("heritage_sites_n") or 0) for f in features)
        print(f"heritage_sites_n: {with_heritage}/{len(features)} villages have at least one site, {total_sites} sites in total")
    return features


# ---------------------------------------------------------------------------
# buildings/<town_code>.json
# ---------------------------------------------------------------------------

def build_buildings(village_features):
    df = pd.read_parquet(MARTS / "building_points.parquet")
    wanted = list(BUILDING_FIELDS) + (QUAKE_FIELDS if INCLUDE_QUAKE_LISTED else [])
    columns = [c for c in wanted if c in df.columns or c == "addr_norm"]
    skipped = [c for c in wanted if c not in columns]
    if skipped:
        print(f"WARNING columns not in parquet, skipped: {skipped}")
    if not INCLUDE_QUAKE_LISTED:
        print("quake_listed columns not shipped (INCLUDE_QUAKE_LISTED = False)")
    if "age_source" in df.columns:
        ct = pd.crosstab(df["age_source"], [df["status"], df["built_year"].isna().map({True: "year_null", False: "year_set"})])
        print("age_source x status x built_year:\n" + ct.to_string())

    town_name = {f["properties"]["town_code"]: f["properties"]["town_name"] for f in village_features}

    df["addr_norm"] = df["address"].map(normalize_address)
    same = int((df["addr_norm"] == df["address"]).sum())
    print(f"addr_norm equals address for {same}/{len(df)} rows ({same / len(df):.1%}); "
          f"stored as null when equal")

    df["lon"] = df["lon"].round(COORD_DECIMALS_BUILDING)
    df["lat"] = df["lat"].round(COORD_DECIMALS_BUILDING)

    int_cols = {"doorplate_units", "built_year", "built_year_min", "built_year_max", "floors"}
    bool_cols = {"on_main_road", "no_elevator_30plus", "near_heritage_50m"}
    if "quake_listed" in df.columns:
        # stored as float (921.0) in the mart; ship as the string the labels use
        df["quake_listed"] = df["quake_listed"].map(lambda v: None if v != v else str(int(v)))
    # BD10: list flags come from the c8 shards (geo_level 1 matches), see module docstring.
    list_flag_counts, list_flag_rule = apply_list_flags(df)

    towns = []
    for code, g in df.groupby("town_code", sort=True):
        fields = list(columns)
        enums = {}
        lookup = {}
        for col in ENUM_COLUMNS:
            if col not in fields:
                continue
            vals = sorted(v for v in g[col].dropna().unique() if v != "")
            enums[col] = vals
            lookup[col] = {v: i for i, v in enumerate(vals)}
        addr_i = fields.index("address")
        rows = []
        for rec in g[fields].itertuples(index=False, name=None):
            row = []
            for col, val in zip(fields, rec):
                if col == "addr_norm":
                    row.append(None if val == rec[addr_i] else val)
                elif col in bool_cols:
                    row.append(bool(val) if val is not None and val == val else None)
                elif col in lookup:
                    v = clean(val)
                    row.append(None if v is None else lookup[col][v])
                else:
                    row.append(clean(val, integer=col in int_cols))
            rows.append(row)
        shard = {
            "town_code": code,
            "town_name": town_name.get(code, ""),
            "generated": date.today().isoformat(),
            "columns": fields,
            "enums": enums,
            "items": rows,
        }
        size = dump(OUT_BUILDINGS / f"{code}.json", shard, compact=True)
        flag = "" if size <= SHARD_SOFT_LIMIT else "  (above 4 MB soft limit)"
        print(f"buildings/{code}.json  {len(rows):>7} records  {fmt_bytes(size)}{flag}")
        towns.append({"town_code": code, "town_name": town_name.get(code, ""),
                      "n_buildings": len(rows), "file": f"buildings/{code}.json", "bytes": size,
                      "columns": fields})

    stats = {
        "buildings_total": int(len(df)),
        "with_built_year_buildings_share": round(float((df["status"] != "undetermined").mean()), 4),
        "with_built_year_units_share": round(float(
            df.loc[df["status"] != "undetermined", "doorplate_units"].sum() / df["doorplate_units"].sum()), 4),
        "status_counts": {k: int(v) for k, v in df["status"].value_counts().items()},
        "soft_story_candidates": {k: int(v) for k, v in df["soft_story_candidate"].value_counts().items() if k},
        "sea_sand_buildings": int(df["sea_sand"].notna().sum()),
        "quake_listed_buildings": int(df["quake_listed"].notna().sum()) if "quake_listed" in df.columns else None,
        "quake_listed_shipped": INCLUDE_QUAKE_LISTED,
        "list_flag_filter": {
            "rule": list_flag_rule,
            **list_flag_counts,
        },
        "age_source_counts": {k: int(v) for k, v in df["age_source"].value_counts().items()} if "age_source" in df.columns else None,
        "near_heritage_50m_buildings": int(df["near_heritage_50m"].fillna(False).astype(bool).sum()) if "near_heritage_50m" in df.columns else None,
        "shard_columns": columns,
    }
    if stats["near_heritage_50m_buildings"] is not None:
        print(f"near_heritage_50m: {stats['near_heritage_50m_buildings']} buildings within 50 m of a heritage site")
    return towns, stats


# ---------------------------------------------------------------------------
# towns.json and meta.json
# ---------------------------------------------------------------------------

def build_towns(village_features, towns):
    by_town = {}
    for f in village_features:
        p = f["properties"]
        t = by_town.setdefault(p["town_code"], {"villages_n": 0, "pop_total": 0, "bbox": [999, 999, -999, -999]})
        t["villages_n"] += 1
        t["pop_total"] += p.get("pop_total") or 0
        for ring in f["geometry"]["coordinates"]:
            for x, y in ring:
                b = t["bbox"]
                b[0], b[1], b[2], b[3] = min(b[0], x), min(b[1], y), max(b[2], x), max(b[3], y)
    out = []
    for t in towns:
        extra = by_town.get(t["town_code"], {})
        bbox = [round(v, 5) for v in extra.get("bbox", [None] * 4)]
        out.append({
            "town_code": t["town_code"],
            "town_name": t["town_name"],
            "n_villages": extra.get("villages_n", 0),
            "pop_total": extra.get("pop_total", 0),
            "n_buildings": t["n_buildings"],
            "file": t["file"],
            "bytes": t["bytes"],
            "columns": t["columns"],
            "bbox": bbox,
            "center": [round((bbox[0] + bbox[2]) / 2, 5), round((bbox[1] + bbox[3]) / 2, 5)],
        })
    size = dump(OUT / "towns.json", out)
    print(f"towns.json  {len(out):>7} towns  {fmt_bytes(size)}")
    return out


def build_meta(village_features, towns, stats):
    n = len(village_features)
    s5 = sum(1 for f in village_features if f["properties"].get("s5_candidate"))
    hidden = {v: sum(1 for f in village_features if f["properties"].get(f"hidden_by_composite_{v}"))
              for v in LIQ_VERSIONS}
    stable = {v: sum(1 for f in village_features if (f["properties"].get(f"share_top46_{v}") or 0) >= 0.9)
              for v in LIQ_VERSIONS}
    has_heritage_col = any("heritage_sites_n" in f["properties"] for f in village_features)
    heritage_villages = (sum(1 for f in village_features if (f["properties"].get("heritage_sites_n") or 0) > 0)
                         if has_heritage_col else None)
    heritage_sites = (sum(int(f["properties"].get("heritage_sites_n") or 0) for f in village_features)
                      if has_heritage_col else None)
    meta = {
        "generated": date.today().isoformat(),
        "title": "臺北市老屋耐震優先順序 賽前原型",
        "disclaimer": DISCLAIMER,
        "data_note": DATA_NOTE,
        "relative_note": "相對於臺北市其他里",
        "composite_note": "等權合成，僅供對照",
        "estimate_note": "推估",
        "factors": FACTORS,
        "liq_versions": LIQ_VERSIONS,
        "default_liq_version": DEFAULT_LIQ_VERSION,
        "public_default_liq_version": PUBLIC_DEFAULT_LIQ_VERSION,
        "level_shares": LEVEL_SHARES,
        "level_note": "每個因子轉成百分位，再按固定比例分 5 級（最危險的 1.6% 為 5 級，再來 5.6%、15.8%、31.8%、45.2%）。比例取自東京地域危險度。",
        "rank_interval_note": "權重從平坦 Dirichlet 分布抽 2,000 次（種子 20261018），記錄每個里排名的第 5、50、95 百分位，以及排進前 46 名（前 10%）的比例。",
        "counts": {
            "villages": n,
            "towns": len(towns),
            "s5_candidates": s5,
            "hidden_by_composite": hidden,
            "stable_top46": stable,
            "heritage_villages": heritage_villages,
            "heritage_sites_total": heritage_sites,
            **stats,
        },
        "data_dates": DATA_DATES,
        "sources_readme": "data/marts/README.md",
    }
    size = dump(OUT / "meta.json", meta)
    print(f"meta.json  {fmt_bytes(size)}")


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    OUT_BUILDINGS.mkdir(parents=True, exist_ok=True)
    for old in OUT_BUILDINGS.glob("*.json"):
        old.unlink()
    villages = build_villages()
    towns, stats = build_buildings(villages)
    towns = build_towns(villages, towns)
    build_meta(villages, towns, stats)
    print("done")


if __name__ == "__main__":
    main()

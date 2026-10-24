/*
 * common.js  Shared constants and helpers for the issue-06 prototype pages.
 * Plain ES2020, no modules. Load with <script src="assets/common.js"></script>
 * before the page script. Everything below is a top-level const or function,
 * so pages can call them directly; the same set is also bundled on window.Common.
 *
 * Data files (built by scripts/build_prototype_data.py, see data/README.md):
 *   data/villages.geojson        456 villages, rankings + indicators + p_<factor>
 *   data/buildings/<town>.json   per-town building shards (column arrays + enums)
 *   data/towns.json              12 towns, shard file names and sizes
 *   data/meta.json               data dates, factor definitions, disclaimer
 *
 * ---- Constants ----------------------------------------------------------
 *   DATA_BASE               'data/'  relative path prefix for all data files
 *   LEAFLET_VENDOR          {js, css} local Leaflet 1.9.4 under assets/vendor/
 *   LEAFLET_CDN             {js, css} cdnjs fallback when the vendor copy is missing
 *   TILE_LAYERS             {light, dark} OpenStreetMap standard tile URL + attribution (labels: null)
 *   TAIPEI_CENTER           [lat, lon]   Leaflet order
 *   TAIPEI_BOUNDS           [[s, w], [n, e]]
 *   FACTORS                 the five factors: key, label, field templates, definition, date
 *   FACTOR_KEYS             ['elderly','old_stock','liquefaction','rescue','soft_story']
 *   LIQ_VERSIONS            {national2026, city2019}: label, data_date
 *   DEFAULT_LIQ_VERSION     'national2026'
 *   LEVEL_SHARES            share of villages per level, 5 -> 1
 *   LEVEL_LABELS            {1..5: '1 級' ...}
 *   LEVEL_NAMES             {1..5: '相對最低' ... '相對最高'}
 *   LEVEL_COLORS            {light: [,c1..c5], dark: [,c1..c5]} hex, index = level
 *   LABELS                  {status, reason, code_generation, liq, agreement, factor,
 *                            age_source, age_conf, structure, soft_story, sea_sand,
 *                            quake_listed, building_type, level, level_name, liq_version}
 *                           every table below, keyed as SPEC §4 / §9 name them
 *   STATUS_LABELS           confirmed / estimated / undetermined -> 中文
 *   UNDETERMINED_REASON_LABELS, CODE_GENERATIONS (detail), CODE_GENERATION_LABELS (SPEC §9 text),
 *   AGE_SOURCE_LABELS, AGE_CONF_LABELS, STRUCTURE_LABELS,
 *   LIQ_LEVEL_LABELS, LIQ_AGREEMENT_LABELS, SOFT_STORY_LABELS, SEA_SAND_LABELS,
 *   QUAKE_LISTED_LABELS, BUILDING_TYPE_LABELS    value -> 中文 label tables
 *   SEA_SAND_OFFICIAL_URL   official sea-sand list page (SPEC §6.2 row 5)
 *   DISCLAIMER              footer line 1, required on every page (SPEC §8)
 *   DATA_NOTE               footer line 2 (SPEC §8)
 *   RELATIVE_NOTE           '相對於臺北市其他里'
 *   COMPOSITE_NOTE          '等權合成，僅供對照'
 *   ESTIMATE_NOTE           '推估'
 *   LIQ_SCALE_NOTE          '區域尺度，不是這棟的鑑定。'
 *   SOFT_STORY_NOTE         '這是候選，不是判定。'
 *
 * ---- Data loading -------------------------------------------------------
 *   loadJSON(url)                    fetch + parse, cached per url -> Promise<any>
 *   loadVillages()                   -> Promise<GeoJSON FeatureCollection>
 *   loadTowns()                      -> Promise<Array<town>>
 *   loadMeta()                       -> Promise<meta>
 *   loadTownBuildings(townCode)      -> Promise<Array<building object>> (decoded)
 *   loadTown(townCode)               same as loadTownBuildings (SPEC §4 name)
 *   decodeShard(shard)               {columns, enums, items} -> array of objects
 *   indexVillages(geojson)           -> Map<village_code, feature>
 *   villagesByTown(geojson)          -> Map<town_code, feature[]>
 *
 * ---- Address ------------------------------------------------------------
 *   normalizeAddress(text)           mirror of the Python normaliser (see data/README.md)
 *   parseAddress(text)               -> {town_name|null, addr_norm}
 *   searchBuildings(records, query, limit) -> {exact: [...], similar: [...]}
 *   buildingSearchKey(rec)           addr_norm ?? address
 *
 * ---- Levels and scores --------------------------------------------------
 *   factorField(key, kind, liqVersion)   kind 'f' | 'lv' | 'p' -> property name
 *   percentileToLevel(p)             danger percentile (0..1) -> level 1..5
 *   levelColor(level, mode)          -> hex (mode defaults to current theme)
 *   levelClass(level)                -> 'lv-3'
 *   levelLabel(level)                -> '3 級（中等）'
 *   villageFactorLevels(props, liqVersion)  -> [{key,label,level,p,value,definition,data_date,kind}]
 *   weightedComposite(props, weights, liqVersion)  -> 0..1 weighted mean of p_<factor>
 *   computeWeighted(props, weights, liqVersion)    same (SPEC §4 name)
 *   rankByWeights(features, weights, liqVersion)   -> [{village_code, score, rank}] sorted
 *   rankAll(features, weights, liqVersion)         same (SPEC §4 name)
 *   hiddenFactors(props, liqVersion) -> [factor keys] from hidden_factors_<version>
 *   isStableTop(props, liqVersion, threshold=0.9)  share_top46 >= threshold
 *
 * ---- Formatting and markup ---------------------------------------------
 *   formatPercent(x, digits=1), formatNumber(n), formatYear(y), rocYear(y)
 *   fmtPct(x, digits=1), fmtInt(n)   same as formatPercent / formatNumber (SPEC §4 names)
 *   formatValue(key, value)          factor raw value -> text with unit
 *   escapeHtml(s)
 *   badgeHtml(text, kind)            kind: '' | 'confirmed' | 'estimated' | 'undetermined' | 'warn' | 'info'
 *   statusBadgeHtml(status)          status badge from STATUS_LABELS
 *   estimateTagHtml()                small '推估' tag
 *   levelChipHtml(level)             colored 5-level chip with label
 *   renderFooter(container, meta, dateKeys)  disclaimer + data dates footer
 *
 * ---- Misc ---------------------------------------------------------------
 *   themeMode()                      'light' | 'dark' from data-theme or prefers-color-scheme
 *   onThemeChange(fn)                call fn(mode) when the theme flips
 *   setTheme(mode)                   set <html data-theme> and remember it in localStorage
 *   initThemeToggle()                restore the remembered theme and add the 深色／淺色 button to .page-nav
 *   liqShareNote(props, liqVersion)  '高潛勢比例高於全市 X% 的里' from p_liquefaction_<version>, '' when absent
 *   loadLeaflet()                    -> Promise<L>, vendor first then CDN
 *   debounce(fn, ms)
 */

'use strict';

/* ---------------------------------------------------------------- paths */

const DATA_BASE = 'data/';

const LEAFLET_VENDOR = {
  js: 'assets/vendor/leaflet.js',
  css: 'assets/vendor/leaflet.css',
};

const LEAFLET_CDN = {
  js: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js',
  css: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.css',
};

// OpenStreetMap standard tiles for every mode (SPEC §6.2 row 9). The dark page
// dims the tiles with CSS (.map-stage.is-dark) instead of using a dark basemap.
const OSM_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const TILE_LAYERS = {
  light: { url: OSM_TILE_URL, attribution: OSM_ATTRIBUTION, maxZoom: 19 },
  dark: { url: OSM_TILE_URL, attribution: OSM_ATTRIBUTION, maxZoom: 19 },
  labels: null,
};

const TAIPEI_CENTER = [25.05, 121.55];
const TAIPEI_BOUNDS = [[24.95, 121.45], [25.22, 121.67]];

/* -------------------------------------------------------------- factors */

const FACTORS = [
  {
    key: 'elderly',
    label: '高齡',
    short: '高齡',
    definition: '65 歲以上人口比例',
    data_date: '115 年 9 月',
    kind: '原始',
    unit: 'ratio',
  },
  {
    key: 'old_stock',
    label: '1999 年前老屋存量',
    short: '老屋',
    definition: '有建成年的戶中，1999 政策線以前的比例。已知棟數少於 20 的里改用所在區中位數',
    data_date: '使照 90～115 年；成交 101S4～115S3',
    kind: '推估',
    unit: 'ratio',
  },
  {
    key: 'liquefaction',
    label: '液化',
    short: '液化',
    versioned: true,
    definition: '高潛勢面積比例＋0.5×中潛勢面積比例，分母是整個里面積',
    data_date: '城市版 2019；全國版 2026（115/9/24）',
    kind: '原始',
    unit: 'ratio',
  },
  {
    key: 'rescue',
    label: '救災不便',
    short: '救災',
    definition: '（窄巷條數的百分位＋計畫道路寬度標註小於 6 m 比例的百分位）÷ 2',
    data_date: '窄巷 2026-10-17；道路寬度 2021-03',
    kind: '推估',
    unit: 'index',
  },
  {
    key: 'soft_story',
    label: '一樓軟弱層候選',
    short: '一樓軟弱層候選',
    definition: '（A 型＋B 型候選棟數）÷ 門牌棟數',
    data_date: '門牌 2026-10-02；成交 101S4～115S3',
    kind: '推估',
    unit: 'ratio',
  },
];

const FACTOR_KEYS = FACTORS.map((f) => f.key);

const LIQ_VERSIONS = {
  national2026: { key: 'national2026', label: '全國 2026 版', data_date: '2026（115/9/24 更新）' },
  city2019: { key: 'city2019', label: '城市版 2019', data_date: 'soil.taipei 2019 版' },
};

const DEFAULT_LIQ_VERSION = 'city2019';

/* --------------------------------------------------------------- levels */

// Share of villages in each level, from the most dangerous (5) downwards.
const LEVEL_SHARES = { 5: 0.016, 4: 0.056, 3: 0.158, 2: 0.318, 1: 0.452 };

const LEVEL_LABELS = { 1: '1 級', 2: '2 級', 3: '3 級', 4: '4 級', 5: '5 級' };
const LEVEL_NAMES = { 1: '相對最低', 2: '相對偏低', 3: '中等', 4: '相對偏高', 5: '相對最高' };

// One-hue ordinal ramp, validated with the dataviz validator (--ordinal) on
// surfaces #f9faf8 (light) and #17191c (dark). Index = level, [0] unused.
const LEVEL_COLORS = {
  light: ['', '#e9a27f', '#dc8058', '#c95d3a', '#a53a1e', '#6e1f0e'],
  dark: ['', '#8f3b1f', '#b25232', '#d06d47', '#e88e69', '#f7b899'],
};

/* ---------------------------------------------------------------- labels */

const STATUS_LABELS = {
  confirmed: '已確認',
  estimated: '推估',
  undetermined: '未判定',
};

const UNDETERMINED_REASON_LABELS = {
  no_sale_since_2012_no_permit: '2012 年後沒有成交紀錄，也沒有 2001 年後的使用執照',
  sale_without_built_year: '有成交紀錄，但沒有填建成年',
};

// Short sentences from SPEC §9. `text` is what the cards print.
const CODE_GENERATIONS = {
  g1_pre1974: { label: 'g1', years: '1974 年以前', text: '1974 年以前：當時建築法規尚無地震力規定' },
  g2_1974_1982: { label: 'g2', years: '1974～1982 年', text: '1974～1982：第一版耐震規定' },
  g3_1982_1989: { label: 'g3', years: '1982～1989 年', text: '1982～1989' },
  g4_1989_1997: { label: 'g4', years: '1989～1997 年', text: '1989～1997' },
  g5_1997_1999: { label: 'g5', years: '1997～1999 年', text: '1997～1999：921 前最後一版' },
  g6_2000_plus: { label: 'g6', years: '2000 年以後', text: '2000 年以後：921 後規範' },
};
const CODE_GENERATION_LABELS = Object.fromEntries(
  Object.entries(CODE_GENERATIONS).map(([k, v]) => [k, v.text]));

const AGE_SOURCE_LABELS = {
  permit: '使用執照',
  sea_sand_list: '海砂屋清冊',
  lvr: '實價登錄',
  lvr_neighbor: '鄰棟實價登錄',
  none: '無',
};

const AGE_CONF_LABELS = {
  high: '高',
  medium: '中',
  low: '低',
  none: '無',
};

const STRUCTURE_LABELS = {
  rc: '鋼筋混凝土（RC）',
  src_steel: '鋼骨或鋼骨鋼筋混凝土',
  brick_reinforced: '加強磚造',
  brick: '磚造',
  wood: '木造',
  other: '其他',
};

const LIQ_LEVEL_LABELS = {
  high: '高',
  medium: '中',
  low: '低',
  none: '無潛勢',
  not_mapped: '未繪製（山區）',
};

const LIQ_AGREEMENT_LABELS = {
  both_high: '兩版都判高',
  one_high: '只有一版判高',
  neither_high: '兩版都不是高',
  undetermined: '未判定（山區，沒有圖）',
};

const SOFT_STORY_LABELS = {
  A: '一樓軟弱層候選 A 型（連棟騎樓街屋）',
  B: '一樓軟弱層候選 B 型（底層開放中高樓）',
};

const SEA_SAND_LABELS = {
  rebuild: '須拆除重建',
  retrofit: '可加勁補強',
};

const QUAKE_LISTED_LABELS = {
  '921': '921 地震黃單',
  '331': '331 地震黃單',
  '403': '403 地震黃單',
};

const SEA_SAND_OFFICIAL_URL = 'https://cmo.gov.taipei/cp.aspx?n=4B7B63655A6565E9';

const BUILDING_TYPE_LABELS = {
  walkup_5_or_less: '公寓（5 樓含以下無電梯）',
  midrise_elevator: '華廈（10 層含以下有電梯）',
  tower_11plus: '住宅大樓（11 層含以上有電梯）',
  townhouse: '透天厝',
  shop: '店面',
  office: '辦公商業大樓',
  factory: '廠辦',
  other: '其他',
};

const DISCLAIMER = '本頁是事前排序與推估，不是官方耐震評估。等級是相對於臺北市其他里。資料日期見各欄。';
const DATA_NOTE = '真實資料：人口（115 年 9 月）、液化圖（城市 2019、全國 2026）、使用執照、實價登錄（101S4～115S3）、消防與窄巷清冊、海砂屋與黃單清冊。推估：建成年（實價登錄、鄰棟）、構造、一樓軟弱層候選、里層級比例。';
const RELATIVE_NOTE = '相對於臺北市其他里';
const COMPOSITE_NOTE = '等權合成，僅供對照';
const ESTIMATE_NOTE = '推估';
const LIQ_SCALE_NOTE = '區域尺度，不是這棟的鑑定。';
const SOFT_STORY_NOTE = '這是候選，不是判定。';

// One object with every label table, keyed the way SPEC §4 and §9 name them.
const LABELS = {
  status: STATUS_LABELS,
  reason: UNDETERMINED_REASON_LABELS,
  code_generation: CODE_GENERATION_LABELS,
  code_generation_detail: CODE_GENERATIONS,
  liq: LIQ_LEVEL_LABELS,
  agreement: LIQ_AGREEMENT_LABELS,
  factor: Object.fromEntries(FACTORS.map((f) => [f.key, f.label])),
  age_source: AGE_SOURCE_LABELS,
  age_conf: AGE_CONF_LABELS,
  structure: STRUCTURE_LABELS,
  soft_story: SOFT_STORY_LABELS,
  sea_sand: SEA_SAND_LABELS,
  quake_listed: QUAKE_LISTED_LABELS,
  building_type: BUILDING_TYPE_LABELS,
  level: LEVEL_LABELS,
  level_name: LEVEL_NAMES,
  liq_version: Object.fromEntries(Object.entries(LIQ_VERSIONS).map(([k, v]) => [k, v.label])),
};

/* ----------------------------------------------------------- data loading */

const _jsonCache = new Map();

function loadJSON(url) {
  if (!_jsonCache.has(url)) {
    const p = fetch(url).then((r) => {
      if (!r.ok) throw new Error(`讀取失敗 ${url}（HTTP ${r.status}）`);
      return r.json();
    });
    p.catch(() => _jsonCache.delete(url));
    _jsonCache.set(url, p);
  }
  return _jsonCache.get(url);
}

function loadVillages() {
  return loadJSON(DATA_BASE + 'villages.geojson');
}

function loadTowns() {
  return loadJSON(DATA_BASE + 'towns.json');
}

function loadMeta() {
  return loadJSON(DATA_BASE + 'meta.json');
}

const _shardCache = new Map();

function loadTownBuildings(townCode) {
  if (!_shardCache.has(townCode)) {
    const p = loadJSON(`${DATA_BASE}buildings/${townCode}.json`).then(decodeShard);
    p.catch(() => _shardCache.delete(townCode));
    _shardCache.set(townCode, p);
  }
  return _shardCache.get(townCode);
}

function loadTown(townCode) {
  return loadTownBuildings(townCode);
}

function decodeShard(shard) {
  const fields = shard.columns || shard.fields;
  const items = shard.items || shard.records;
  const enums = shard.enums || {};
  const enumIdx = fields.map((f) => (enums[f] ? enums[f] : null));
  const addrIdx = fields.indexOf('address');
  const normIdx = fields.indexOf('addr_norm');
  const out = new Array(items.length);
  for (let r = 0; r < items.length; r++) {
    const row = items[r];
    const obj = { town_code: shard.town_code, town_name: shard.town_name };
    for (let i = 0; i < fields.length; i++) {
      let v = row[i];
      if (v !== null && enumIdx[i]) v = enumIdx[i][v];
      obj[fields[i]] = v;
    }
    if (normIdx >= 0 && obj.addr_norm === null) obj.addr_norm = row[addrIdx];
    out[r] = obj;
  }
  return out;
}

function indexVillages(geojson) {
  const m = new Map();
  for (const f of geojson.features) m.set(f.properties.village_code, f);
  return m;
}

function villagesByTown(geojson) {
  const m = new Map();
  for (const f of geojson.features) {
    const t = f.properties.town_code;
    if (!m.has(t)) m.set(t, []);
    m.get(t).push(f);
  }
  return m;
}

/* -------------------------------------------------------------- address */

const TOWN_NAMES = ['松山區', '信義區', '大安區', '中山區', '中正區', '大同區',
  '萬華區', '文山區', '南港區', '內湖區', '士林區', '北投區'];

const CN_DIGITS = { '〇': 0, '零': 0, '一': 1, '二': 2, '兩': 2, '三': 3, '四': 4,
  '五': 5, '六': 6, '七': 7, '八': 8, '九': 9 };

const _RE_WS = /[\s　]+/g;
const _RE_FULLWIDTH = /[！-～]/g;
const _RE_CN_NUM = /([〇零一二兩三四五六七八九十百]+)(段|巷|弄|號|樓|層)/g;
const _RE_CN_ZHI = /之([〇零一二兩三四五六七八九十百]+)/g;
const _RE_DASH = /(\d)[\-－—–](\d)/g;
const _RE_FLOOR = /(\d+樓.*|\d+層.*|\d+[Ff].*|[Bb]\d+.*|地下.*)$/;
const _RE_ZHI_ONLY = /(^|\D)之(\d+)號/g;  // 8弄之3號 -> 8弄3號 (no base number)
const _RE_ZHI = /之\d+/g;
const _RE_TOWN = new RegExp('^(' + TOWN_NAMES.join('|') + ')');

// Chinese numeral (1..999) to int, null when it cannot parse. Mirror of Python cn_to_int().
function cnToInt(text) {
  if (!text) return null;
  if (text.includes('百')) {
    const idx = text.indexOf('百');
    const h = text.slice(0, idx);
    let rest = text.slice(idx + 1);
    if (h && !(h in CN_DIGITS)) return null;
    const hundreds = (h ? CN_DIGITS[h] : 1) * 100;
    if (!rest) return hundreds;
    if (rest.length === 1 && rest in CN_DIGITS && rest !== '〇' && rest !== '零') return hundreds + CN_DIGITS[rest] * 10;
    rest = rest.replace(/^[〇零]+/, '');
    const r = rest ? cnToInt(rest) : 0;
    return r === null ? null : hundreds + r;
  }
  if (text.includes('十')) {
    const [tens, ones] = text.split('十');
    if ((tens && !(tens in CN_DIGITS)) || (ones && !(ones in CN_DIGITS))) return null;
    const t = tens ? CN_DIGITS[tens] : 1;
    const o = ones ? CN_DIGITS[ones] : 0;
    return t * 10 + o;
  }
  let total = 0;
  for (const ch of text) {
    if (!(ch in CN_DIGITS)) return null;
    total = total * 10 + CN_DIGITS[ch];
  }
  return total;
}

// Mirror of normalize_address() in scripts/build_prototype_data.py. Keep in sync.
// Rules: strip whitespace; full-width ASCII to half-width; 台 -> 臺; drop a leading
// 臺北市 and district; Chinese numerals to digits; dash between digits -> 之;
// drop floors (N樓, N層, NF, BN, 地下); drop every 之N (merged into the base door plate).
function normalizeAddress(raw) {
  let s = String(raw || '').replace(_RE_WS, '');
  s = s.replace(_RE_FULLWIDTH, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0));
  s = s.replace(/台/g, '臺');
  if (s.startsWith('臺北市')) s = s.slice(3);
  s = s.replace(_RE_TOWN, '');
  s = s.replace(_RE_CN_NUM, (m, num, unit) => {
    const n = cnToInt(num);
    return (n === null ? num : String(n)) + unit;
  });
  s = s.replace(_RE_CN_ZHI, (m, num) => {
    const n = cnToInt(num);
    return '之' + (n === null ? num : String(n));
  });
  s = s.replace(_RE_DASH, '$1之$2');
  s = s.replace(_RE_FLOOR, '');
  s = s.replace(_RE_ZHI_ONLY, '$1$2號');
  s = s.replace(_RE_ZHI, '');
  return s;
}

function parseAddress(raw) {
  let s = String(raw || '').replace(_RE_WS, '');
  s = s.replace(_RE_FULLWIDTH, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0));
  s = s.replace(/台/g, '臺');
  if (s.startsWith('臺北市')) s = s.slice(3);
  const m = s.match(_RE_TOWN);
  return { town_name: m ? m[1] : null, addr_norm: normalizeAddress(s) };
}

function buildingSearchKey(rec) {
  return rec.addr_norm || rec.address;
}

function searchBuildings(records, query, limit = 20) {
  const q = normalizeAddress(query);
  const exact = [];
  const similar = [];
  if (!q) return { exact, similar, query: q };
  const qNoHao = q.replace(/號$/, '');
  for (const rec of records) {
    const key = buildingSearchKey(rec);
    if (key === q) {
      exact.push(rec);
    } else if (similar.length < limit && (key.startsWith(qNoHao) || key.includes(q))) {
      similar.push(rec);
    }
  }
  similar.sort((a, b) => buildingSearchKey(a).localeCompare(buildingSearchKey(b), 'zh-Hant'));
  return { exact, similar: similar.slice(0, limit), query: q };
}

/* -------------------------------------------------------- levels, scores */

function factorField(key, kind, liqVersion) {
  const v = liqVersion || DEFAULT_LIQ_VERSION;
  const prefix = kind === 'lv' ? 'lv_' : kind === 'p' ? 'p_' : 'f_';
  return key === 'liquefaction' ? `${prefix}liquefaction_${v}` : `${prefix}${key}`;
}

function percentileToLevel(p) {
  if (p === null || p === undefined || Number.isNaN(p)) return null;
  let cum = 0;
  for (const lv of [5, 4, 3, 2]) {
    cum += LEVEL_SHARES[lv];
    if (p > 1 - cum + 1e-9) return lv;
  }
  return 1;
}

function levelColor(level, mode) {
  const m = mode || themeMode();
  const lv = Math.min(5, Math.max(1, Number(level) || 1));
  return LEVEL_COLORS[m][lv];
}

function levelClass(level) {
  const lv = Math.min(5, Math.max(1, Number(level) || 1));
  return `lv-${lv}`;
}

function levelLabel(level) {
  const lv = Number(level);
  if (!lv) return '無資料';
  return `${LEVEL_LABELS[lv]}（${LEVEL_NAMES[lv]}）`;
}

function villageFactorLevels(props, liqVersion) {
  const v = liqVersion || DEFAULT_LIQ_VERSION;
  return FACTORS.map((f) => {
    const label = f.versioned ? `${f.label}（${LIQ_VERSIONS[v].label}）` : f.label;
    const date = f.versioned ? LIQ_VERSIONS[v].data_date : f.data_date;
    return {
      key: f.key,
      label,
      short: f.short,
      level: props[factorField(f.key, 'lv', v)],
      p: props[factorField(f.key, 'p', v)],
      value: props[factorField(f.key, 'f', v)],
      definition: f.definition,
      data_date: date,
      kind: f.kind,
      unit: f.unit,
    };
  });
}

function weightedComposite(props, weights, liqVersion) {
  const v = liqVersion || DEFAULT_LIQ_VERSION;
  let sum = 0;
  let wsum = 0;
  for (const key of FACTOR_KEYS) {
    const w = weights && weights[key] !== undefined ? Number(weights[key]) : 1;
    if (w <= 0) continue;
    const p = props[factorField(key, 'p', v)];
    if (p === null || p === undefined) continue;
    sum += w * p;
    wsum += w;
  }
  return wsum > 0 ? sum / wsum : 0;
}

// SPEC §4 names: computeWeighted / rankAll are the same functions.
function computeWeighted(props, weights, liqVersion) {
  return weightedComposite(props, weights, liqVersion);
}

function rankAll(features, weights, liqVersion) {
  return rankByWeights(features, weights, liqVersion);
}

function rankByWeights(features, weights, liqVersion) {
  const rows = features.map((f) => ({
    village_code: f.properties.village_code,
    village_name: f.properties.village_name,
    town_name: f.properties.town_name,
    score: weightedComposite(f.properties, weights, liqVersion),
  }));
  rows.sort((a, b) => b.score - a.score);
  rows.forEach((r, i) => { r.rank = i + 1; });
  return rows;
}

function hiddenFactors(props, liqVersion) {
  const v = liqVersion || DEFAULT_LIQ_VERSION;
  const s = props[`hidden_factors_${v}`];
  if (!s) return [];
  return String(s).split(/[;,]/).map((x) => x.trim()).filter(Boolean);
}

function isStableTop(props, liqVersion, threshold = 0.9) {
  const v = liqVersion || DEFAULT_LIQ_VERSION;
  const s = props[`share_top46_${v}`];
  return s !== null && s !== undefined && s >= threshold;
}

/* ----------------------------------------------------------- formatting */

function formatPercent(x, digits = 1) {
  if (x === null || x === undefined || Number.isNaN(Number(x))) return '無資料';
  return `${(Number(x) * 100).toFixed(digits)}%`;
}

function formatNumber(n) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '無資料';
  return Number(n).toLocaleString('zh-Hant-TW');
}

// SPEC §4 names.
function fmtPct(x, digits = 1) {
  return formatPercent(x, digits);
}

function fmtInt(n) {
  return formatNumber(n);
}

function rocYear(y) {
  const n = Number(y);
  return Number.isFinite(n) ? n - 1911 : null;
}

function formatYear(y) {
  const n = Number(y);
  if (!Number.isFinite(n)) return '未判定';
  return `${n} 年（民國 ${n - 1911} 年）`;
}

function formatValue(key, value) {
  if (value === null || value === undefined) return '無資料';
  const f = FACTORS.find((x) => x.key === key);
  if (f && f.unit === 'ratio') return formatPercent(value, 1);
  if (f && f.unit === 'index') return `指數 ${Number(value).toFixed(2)}`;
  return String(value);
}

function escapeHtml(s) {
  return String(s === null || s === undefined ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function badgeHtml(text, kind = '') {
  const cls = kind ? ` badge-${kind}` : '';
  return `<span class="badge${cls}">${escapeHtml(text)}</span>`;
}

function statusBadgeHtml(status) {
  const key = STATUS_LABELS[status] ? status : 'undetermined';
  return badgeHtml(STATUS_LABELS[key], key);
}

function estimateTagHtml() {
  return `<span class="tag tag-estimate">${ESTIMATE_NOTE}</span>`;
}

function levelChipHtml(level) {
  const lv = Number(level);
  if (!lv) return `<span class="level-chip lv-none">無資料</span>`;
  return `<span class="level-chip ${levelClass(lv)}"><span class="level-chip-num">${lv}</span>${escapeHtml(LEVEL_NAMES[lv])}</span>`;
}

function renderFooter(container, meta, dateKeys) {
  const el = typeof container === 'string' ? document.querySelector(container) : container;
  if (!el) return;
  const dates = (meta && meta.data_dates) || {};
  const keys = dateKeys && dateKeys.length ? dateKeys : Object.keys(dates);
  const items = keys.filter((k) => dates[k]).map((k) =>
    `<li><span class="footer-date-label">${escapeHtml(dates[k].label)}</span>` +
    `<span class="footer-date-value">${escapeHtml(dates[k].date)}</span></li>`).join('');
  const gen = meta && meta.generated ? `資料檔產生日 ${escapeHtml(meta.generated)}。` : '';
  el.classList.add('footer-disclaimer');
  el.innerHTML =
    `<p class="footer-main">${escapeHtml((meta && meta.disclaimer) || DISCLAIMER)}</p>` +
    `<p class="footer-data-note">${escapeHtml((meta && meta.data_note) || DATA_NOTE)}</p>` +
    (items ? `<ul class="footer-dates">${items}</ul>` : '') +
    `<p class="footer-meta">${gen}欄位定義見 data/marts/README.md。等級與排名區間的算法見 meta.json。</p>`;
}

/* ----------------------------------------------------------------- misc */

function themeMode() {
  const forced = document.documentElement.getAttribute('data-theme');
  if (forced === 'dark' || forced === 'light') return forced;
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function onThemeChange(fn) {
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => fn(themeMode()));
  }
  new MutationObserver(() => fn(themeMode()))
    .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
}

const THEME_STORAGE_KEY = 'issue06-prototype-theme';

function setTheme(mode) {
  const m = mode === 'dark' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', m);
  try { window.localStorage.setItem(THEME_STORAGE_KEY, m); } catch (e) { /* storage unavailable */ }
  document.querySelectorAll('.theme-toggle').forEach((b) => {
    b.setAttribute('aria-pressed', m === 'dark' ? 'true' : 'false');
    b.textContent = '深色／淺色';
    b.title = m === 'dark' ? '目前深色，點一下切換成淺色' : '目前淺色，點一下切換成深色';
  });
}

// Restores the remembered theme (default: whatever <html data-theme> says, light
// when unset) and appends a small 深色／淺色 button to every .page-nav.
function initThemeToggle() {
  let saved = null;
  try { saved = window.localStorage.getItem(THEME_STORAGE_KEY); } catch (e) { saved = null; }
  const current = document.documentElement.getAttribute('data-theme');
  const mode = saved === 'dark' || saved === 'light' ? saved : (current === 'dark' ? 'dark' : 'light');
  document.querySelectorAll('.page-nav').forEach((nav) => {
    if (nav.querySelector('.theme-toggle')) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'theme-toggle';
    btn.setAttribute('aria-label', '切換深色或淺色');
    btn.addEventListener('click', () => setTheme(themeMode() === 'dark' ? 'light' : 'dark'));
    nav.appendChild(btn);
  });
  setTheme(mode);
}

// SPEC item 6: the gap between a village's liquefaction share and its level.
// X = round(p_liquefaction_<version> * 100); empty string when the field is missing.
function liqShareNote(props, liqVersion) {
  const v = liqVersion || DEFAULT_LIQ_VERSION;
  const p = props ? props[`p_liquefaction_${v}`] : null;
  if (p === null || p === undefined || Number.isNaN(Number(p))) return '';
  return `高潛勢比例高於全市 ${Math.round(Number(p) * 100)}% 的里`;
}

let _leafletPromise = null;

function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  if (_leafletPromise) return _leafletPromise;
  const addCss = (href) => {
    if (document.querySelector(`link[href="${href}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
  };
  const addJs = (src) => new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => resolve(window.L);
    s.onerror = () => reject(new Error(`無法載入 ${src}`));
    document.head.appendChild(s);
  });
  _leafletPromise = fetch(LEAFLET_VENDOR.js, { method: 'HEAD' })
    .then((r) => (r.ok ? LEAFLET_VENDOR : LEAFLET_CDN))
    .catch(() => LEAFLET_CDN)
    .then((src) => { addCss(src.css); return addJs(src.js); })
    .catch(() => { addCss(LEAFLET_CDN.css); return addJs(LEAFLET_CDN.js); });
  return _leafletPromise;
}

function debounce(fn, ms = 200) {
  let t = null;
  return function debounced(...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), ms);
  };
}

/* --------------------------------------------------------------- bundle */

window.Common = {
  DATA_BASE, LEAFLET_VENDOR, LEAFLET_CDN, TILE_LAYERS, TAIPEI_CENTER, TAIPEI_BOUNDS,
  FACTORS, FACTOR_KEYS, LIQ_VERSIONS, DEFAULT_LIQ_VERSION,
  LEVEL_SHARES, LEVEL_LABELS, LEVEL_NAMES, LEVEL_COLORS,
  LABELS, STATUS_LABELS, UNDETERMINED_REASON_LABELS, CODE_GENERATIONS, CODE_GENERATION_LABELS,
  AGE_SOURCE_LABELS, AGE_CONF_LABELS, STRUCTURE_LABELS,
  LIQ_LEVEL_LABELS, LIQ_AGREEMENT_LABELS, SOFT_STORY_LABELS, SEA_SAND_LABELS, QUAKE_LISTED_LABELS,
  BUILDING_TYPE_LABELS, SEA_SAND_OFFICIAL_URL,
  DISCLAIMER, DATA_NOTE, RELATIVE_NOTE, COMPOSITE_NOTE, ESTIMATE_NOTE, LIQ_SCALE_NOTE, SOFT_STORY_NOTE,
  TOWN_NAMES,
  loadJSON, loadVillages, loadTowns, loadMeta, loadTownBuildings, loadTown, decodeShard,
  indexVillages, villagesByTown,
  normalizeAddress, parseAddress, searchBuildings, buildingSearchKey,
  factorField, percentileToLevel, levelColor, levelClass, levelLabel,
  villageFactorLevels, weightedComposite, computeWeighted, rankByWeights, rankAll,
  hiddenFactors, isStableTop,
  formatPercent, fmtPct, formatNumber, fmtInt, formatYear, rocYear, formatValue, escapeHtml,
  badgeHtml, statusBadgeHtml, estimateTagHtml, levelChipHtml, renderFooter,
  themeMode, onThemeChange, setTheme, initThemeToggle, liqShareNote, loadLeaflet, debounce,
};

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initThemeToggle);
else initThemeToggle();

/*
 * report.js  Engine for the "健檢報告" (health report) prototype.
 *
 *   import { buildReport } from "./lib/report.js";
 *   const r = await buildReport({ addr: "信義路2段86巷40號", age: 50, elder: 1 });
 *
 * Returns a plain data object (no DOM). Field list: ../CONTRACT.md.
 *
 * Data is read from the sibling prototypes (relative URLs, nothing copied):
 *   ../renewal-calculator/data/towns/<town>.json   building points + flags (address match)
 *   ../renewal-calculator/data/prices.json          village and town names
 *   ../priority-ranking/data/villages.geojson       five-factor percentiles, ranks, top-46 share
 *   ../rescue-drill-map/data/*                      village map, lanes, heritage, shelters, hydrants
 *   ../bonus-translator/{bonus-items.csv,data/*}    bonus blocks per case, "我的里" fields
 *
 * The logic is moved from each prototype's app.js, not reinvented:
 *   address normalisation  renewal-calculator/assets/calc.js normalizeAddress, searchBuildings
 *   ranking                priority-ranking/app.js score, rerank (ties share the better rank), sentence
 *   rescue bars, checklist rescue-drill-map/app.js renderCard, shelterCheck, hydrantCheck, levels
 *   bonus blocks, my village bonus-translator/app.js leaves, renderVillage, silverCard
 * Subsidy wording: ops/handoff/2026-10-24-day2-plan.md section 1 (shared facts).
 */

const DEFAULT_BASE = new URL("../../", import.meta.url); // .../mvp-variants/
const NOW_YEAR = new Date().getFullYear();
const LAG_YEARS = 2; // pipelines/build/build_building_points.py: applied for permit ~ built year - 2
// pipelines/build/build_building_points.py GENERATIONS: (label, last assumed application year)
const GENERATIONS = [
  ["g1_pre1974", 1973, "1974 年以前的規範（沒有地震力規定）"],
  ["g2_1974_1982", 1981, "1974～1982 年的耐震規範"],
  ["g3_1982_1989", 1988, "1982～1989 年的耐震規範"],
  ["g4_1989_1997", 1996, "1989～1997 年的耐震規範"],
  ["g5_1997_1999", 1999, "1997～1999 年的耐震規範"],
  ["g6_2000_plus", 9999, "1999 年政策線以後的規範"],
];
export function generationOf(builtYear) {
  if (builtYear == null) return null;
  const app = builtYear - LAG_YEARS;
  const g = GENERATIONS.find(([, last]) => app <= last);
  return g ? g[0] : null;
}
export function generationLabel(code) {
  const g = GENERATIONS.find(([c]) => c === code);
  return g ? g[2] : null;
}
const TOWN_CODES = ["63000010", "63000020", "63000030", "63000040", "63000050", "63000060",
  "63000070", "63000080", "63000090", "63000100", "63000110", "63000120"];
export const DEFAULT_WEIGHTS = [1, 1, 3, 3, 1];
const TOP_N = 46;

export const DISCLAIMER = "這是推估與白話整理，不是官方評估或鑑定。";

/* ------------------------------------------------------------ loading */

function makeLoader(base, fetchFn) {
  const cache = new Map();
  const get = (path, kind = "json") => {
    const key = kind + ":" + path;
    if (!cache.has(key)) {
      const p = fetchFn(new URL(path, base).href).then((r) => {
        if (!r.ok) throw new Error(`讀取失敗 ${path}（HTTP ${r.status}）`);
        return kind === "text" ? r.text() : r.json();
      });
      p.catch(() => cache.delete(key));
      cache.set(key, p);
    }
    return cache.get(key);
  };
  return get;
}

const loaders = new Map(); // base href -> loader, so repeated calls reuse downloads
function loaderFor(opts) {
  const base = opts.base ? new URL(opts.base, globalThis.location?.href) : DEFAULT_BASE;
  const fetchFn = opts.fetch || globalThis.fetch.bind(globalThis);
  const k = base.href;
  if (!loaders.has(k) || opts.fetch) loaders.set(k, makeLoader(base, fetchFn));
  return loaders.get(k);
}

/* ------------------------------------------------------------ address (renewal-calculator/assets/calc.js) */

const TOWN_NAMES = ["松山區", "信義區", "大安區", "中山區", "中正區", "大同區",
  "萬華區", "文山區", "南港區", "內湖區", "士林區", "北投區"];
const CN_DIGITS = { "〇": 0, "零": 0, "一": 1, "二": 2, "兩": 2, "三": 3, "四": 4,
  "五": 5, "六": 6, "七": 7, "八": 8, "九": 9 };
const _RE_WS = /[\s　]+/g;
const _RE_FULLWIDTH = /[！-～]/g;
const _RE_CN_NUM = /([〇零一二兩三四五六七八九十百]+)(段|巷|弄|號|樓|層)/g;
const _RE_CN_ZHI = /之([〇零一二兩三四五六七八九十百]+)/g;
const _RE_DASH = /(\d)[\-－—–](\d)/g;
const _RE_FLOOR = /(\d+樓.*|\d+層.*|\d+[Ff].*|[Bb]\d+.*|地下.*)$/;
const _RE_ZHI_ONLY = /(^|\D)之(\d+)號/g;
const _RE_ZHI = /之\d+/g;
const _RE_TOWN = new RegExp("^(" + TOWN_NAMES.join("|") + ")");

function cnToInt(text) {
  if (!text) return null;
  if (text.includes("百")) {
    const idx = text.indexOf("百");
    const h = text.slice(0, idx);
    let rest = text.slice(idx + 1);
    if (h && !(h in CN_DIGITS)) return null;
    const hundreds = (h ? CN_DIGITS[h] : 1) * 100;
    if (!rest) return hundreds;
    if (rest.length === 1 && rest in CN_DIGITS && rest !== "〇" && rest !== "零") return hundreds + CN_DIGITS[rest] * 10;
    rest = rest.replace(/^[〇零]+/, "");
    const r = rest ? cnToInt(rest) : 0;
    return r === null ? null : hundreds + r;
  }
  if (text.includes("十")) {
    const [tens, ones] = text.split("十");
    if ((tens && !(tens in CN_DIGITS)) || (ones && !(ones in CN_DIGITS))) return null;
    return (tens ? CN_DIGITS[tens] : 1) * 10 + (ones ? CN_DIGITS[ones] : 0);
  }
  let total = 0;
  for (const ch of text) {
    if (!(ch in CN_DIGITS)) return null;
    total = total * 10 + CN_DIGITS[ch];
  }
  return total;
}

function cleanPrefix(raw) {
  let s = String(raw || "").replace(_RE_WS, "");
  s = s.replace(_RE_FULLWIDTH, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0));
  s = s.replace(/台/g, "臺");
  if (s.startsWith("臺北市")) s = s.slice(3);
  return s;
}

export function normalizeAddress(raw) {
  let s = cleanPrefix(raw).replace(_RE_TOWN, "");
  s = s.replace(_RE_CN_NUM, (m, num, unit) => {
    const n = cnToInt(num);
    return (n === null ? num : String(n)) + unit;
  });
  s = s.replace(_RE_CN_ZHI, (m, num) => {
    const n = cnToInt(num);
    return "之" + (n === null ? num : String(n));
  });
  s = s.replace(_RE_DASH, "$1之$2");
  s = s.replace(_RE_FLOOR, "");
  s = s.replace(_RE_ZHI_ONLY, "$1$2號");
  s = s.replace(_RE_ZHI, "");
  return s;
}

function searchBuildings(records, q, limit = 12) {
  const exact = [];
  const similar = [];
  if (!q) return { exact, similar };
  const qNoHao = q.replace(/號$/, "");
  for (const rec of records) {
    if (rec.addr_norm === q) exact.push(rec);
    else if (similar.length < 200 && (rec.addr_norm.startsWith(qNoHao) || rec.addr_norm.includes(q))) similar.push(rec);
  }
  similar.sort((a, b) => a.addr_norm.localeCompare(b.addr_norm, "zh-Hant", { numeric: true }));
  return { exact, similar: similar.slice(0, limit) };
}

const townRecords = new Map(); // shard promise -> records (decoded once)
async function loadTown(get, code) {
  const shard = await get(`renewal-calculator/data/towns/${code}.json`);
  if (!townRecords.has(shard)) {
    const f = shard.fields;
    townRecords.set(shard, shard.records.map((row) => {
      const o = { town_code: shard.town_code };
      f.forEach((k, i) => { o[k] = row[i]; });
      o.addr_norm = normalizeAddress(o.address);
      return o;
    }));
  }
  return townRecords.get(shard);
}

/* ------------------------------------------------------------ building facts */

const AGE_SOURCE_LABELS = {
  permit: "使用執照", sea_sand_list: "海砂屋清冊", lvr: "實價登錄", lvr_neighbor: "鄰棟推估", none: "—",
};
const STRUCTURE_LABELS = {
  rc: "鋼筋混凝土", src_steel: "鋼骨或鋼骨鋼筋混凝土", brick_reinforced: "加強磚造", brick: "磚造", wood: "木造", other: "其他",
};
const TYPE_LABELS = {
  walkup_5_or_less: "公寓（5 樓以下無電梯）", midrise_elevator: "電梯華廈", tower_11plus: "住宅大樓",
  townhouse: "透天厝", studio: "套房", shop: "店面", office: "辦公",
};
const LIQ_LABELS = { high: "高", medium: "中", low: "低", not_mapped: "不在潛勢圖範圍" };
const SOFT_LABELS = {
  A: "A 型候選：連棟騎樓街屋（一樓牆少、靠柱子撐）",
  B: "B 型候選：底層開放的中高樓",
};

function builtYearOf(rec) {
  if (!rec) return null;
  if (rec.built_year) return rec.built_year;
  if (rec.built_year_min && rec.built_year_max) return Math.round((rec.built_year_min + rec.built_year_max) / 2);
  return null;
}

function buildingOf(rec, ageUser) {
  const by = builtYearOf(rec);
  const confirmed = rec.age_source === "permit" || rec.age_source === "sea_sand_list";
  const userYear = ageUser == null ? null : NOW_YEAR - ageUser;
  const userPre = userYear == null ? null : userYear - LAG_YEARS <= 1999;
  const pre = rec.pre_policy_1999 == null ? userPre : rec.pre_policy_1999;
  return {
    address: rec.address,
    point_id: rec.point_id,
    town_code: rec.town_code,
    village_code: rec.village_code,
    built_year: by,
    built_year_range: rec.built_year ? null : (rec.built_year_min ? [rec.built_year_min, rec.built_year_max] : null),
    built_year_confirmed: confirmed,
    age_estimated: by == null ? null : NOW_YEAR - by,
    age_user: ageUser,
    age_gap: by == null || ageUser == null ? null : ageUser - (NOW_YEAR - by),
    age_source: rec.age_source,
    age_source_label: AGE_SOURCE_LABELS[rec.age_source] || "—",
    age_conf: rec.age_conf || "",
    status: rec.status,
    pre1999: pre,
    pre1999_basis: rec.pre_policy_1999 != null ? "data" : (userPre != null ? "user_age" : "unknown"),
    code_generation: rec.code_generation,
    // added in round 2
    code_generation_label: generationLabel(rec.code_generation),
    code_generation_user: generationOf(userYear),
    code_generation_user_label: generationLabel(generationOf(userYear)),
    code_generation_match: userYear == null || !rec.code_generation ? null : generationOf(userYear) === rec.code_generation,
    pre1999_user: userPre,
    floors: rec.floors,
    has_elevator: rec.lvr_has_elevator,
    building_type: rec.lvr_building_type,
    building_type_label: TYPE_LABELS[rec.lvr_building_type] || null,
    structure: rec.structure_class,
    structure_label: STRUCTURE_LABELS[rec.structure_class] || null,
    units: rec.doorplate_units,
    no_elevator_30plus: rec.no_elevator_30plus === true,
    soft_story_candidate: rec.soft_story_candidate || null,
    soft_story_label: SOFT_LABELS[rec.soft_story_candidate] || null,
    liq_level: rec.liq_level_city2019,
    liq_label: LIQ_LABELS[rec.liq_level_city2019] || "—",
    near_heritage_50m: rec.near_heritage_50m === true,
    heritage_n_50m: rec.heritage_n_50m || 0,
    // Listing flags: present only because this object exists only for an exact doorplate match.
    flags: {
      sea_sand: rec.sea_sand ? {
        kind: rec.sea_sand, kind_label: rec.sea_sand === "rebuild" ? "須拆除重建" : "可加勁補強",
        list_address: rec.sea_sand_list_address, list_version: rec.sea_sand_list_version,
      } : null,
      quake_listed: rec.quake_listed ? {
        event: rec.quake_listed, list_address: rec.quake_listed_address, list_version: rec.quake_listed_version,
      } : null,
    },
  };
}

/* ------------------------------------------------------------ ranking (priority-ranking/app.js) */

export const FACTORS = [
  { k: "elderly", name: "高齡", hint: "65 歲以上比例" },
  { k: "old_stock", name: "老屋", hint: "1999 前建造（推估）" },
  { k: "liquefaction", name: "液化", hint: "城市版 2019" },
  { k: "rescue", name: "救災", hint: "窄巷、6 m 以下道路" },
  { k: "soft_story", name: "軟弱層", hint: "一樓軟弱層候選" },
];
const LEVEL_TOP = { 5: "1.6%", 4: "7%", 3: "23%" };

function rerank(V, weights) {
  const sw = weights.reduce((a, b) => a + b, 0);
  const w = sw > 0 ? weights : [1, 1, 1, 1, 1];
  const s = sw > 0 ? sw : 5;
  const scored = V.map((v) => ({ v, score: FACTORS.reduce((a, f, i) => a + w[i] * v["p_" + f.k], 0) / s }));
  const order = scored.slice().sort((a, b) => b.score - a.score);
  const rank = new Map();
  order.forEach((x, i) => {
    const r = i > 0 && Math.abs(x.score - order[i - 1].score) < 1e-9 ? rank.get(order[i - 1].v.village_code) : i + 1;
    rank.set(x.v.village_code, r);
  });
  return { rank, score: new Map(scored.map((x) => [x.v.village_code, x.score])) };
}

function sentence(v) {
  const hi = FACTORS.map((f) => ({ f, lv: v["lv_" + f.k] }))
    .filter((x) => x.lv >= 3)
    .sort((a, b) => b.lv - a.lv)
    .slice(0, 3);
  const s1 = hi.length
    ? hi.map((x) => `${x.f.name}在全市最高的 ${LEVEL_TOP[x.lv]}（${x.lv} 級）`).join("，") + "。"
    : "5 個因子都不在全市前 23%，名次來自多個中等因子相加。";
  let s2;
  if (v.top46 >= 0.9) s2 = "不論權重怎麼調，它幾乎都在前 46 名。";
  else if (v.top46 >= 0.5) s2 = "權重改變時，它常在前 46 名，但不穩定。";
  else if (v.top46 > 0) s2 = "只有特定權重會把它排進前 46 名。";
  else s2 = "隨機權重 2,000 次，它都沒有進前 46 名。";
  if (v.hidden && v.top46 < 0.5) {
    const names = v.hidden_f.split(";").map((k) => FACTORS.find((f) => f.k === k).name).join("、");
    s2 = `等權總分會把它的${names}問題藏起來，提高${names}的權重就看得到。`;
  }
  return [s1, s2];
}

function rankingOf(prGeo, code, weights) {
  const V = prGeo.features.map((f) => f.properties);
  const v = V.find((x) => x.village_code === code);
  if (!v) return null;
  const { rank, score } = rerank(V, weights);
  return {
    weights: weights.slice(),
    n_villages: V.length,
    rank: rank.get(code),
    rank_equal: v.rank_eq,
    score: score.get(code),
    levels: Object.fromEntries(FACTORS.map((f) => [f.k, v["lv_" + f.k]])),
    top_k: TOP_N,
    top_k_share: v.top46,
    rank_range: { p05: v.r05, p50: v.r50, p95: v.r95 },
    sentence: sentence(v),
    numbers: {
      share_65plus: v.share_65plus,
      bld_share_pre_policy_1999: v.bld_share_pre_policy_1999,
      bld_age_known_n: v.bld_age_known_n,
      liq_high_share_city2019: v.liq_high_share_city2019,
      liq_medium_share_city2019: v.liq_medium_share_city2019,
      lanes_n: v.lanes_n,
      road_markers_lt6m_share: v.road_markers_lt6m_share,
      soft_n: v.soft_n,
      doorplate_buildings: v.doorplate_buildings,
    },
  };
}

/* ------------------------------------------------------------ rescue (rescue-drill-map/app.js) */

const n0 = (x) => (x == null || isNaN(x) ? 0 : +x);
const fmtPct = (x) => (x == null || isNaN(x)) ? "—" : (x * 100).toFixed(x >= 0.1 ? 0 : 1) + "%";
const fmtInt = (x) => (x == null || isNaN(x)) ? "—" : Math.round(x).toLocaleString("zh-Hant");
const LVNAME = ["", "低", "偏低", "中", "偏高", "高"];
const shortName = (n) => n.replace(/^臺北市(立)?(\S{2}區)?/, "").replace("國民小學", "國小").replace("國民中學", "國中").replace("高級中學", "高中");

function rescueOf(rd, code) {
  const P = rd.villages.features.map((f) => f.properties);
  P.forEach((p) => {
    if (p.lanes_total == null) {
      p.lanes_total = n0(p.narrow_lanes_n) + n0(p.fire_access_lanes);
      p.soft_total = n0(p.soft_story_a_n) + n0(p.soft_story_b_n);
    }
  });
  const MAX = {};
  ["lanes_total", "liq_high_share_city2019", "share_80plus", "heritage_sites_n", "bld_share_pre_policy_1999", "soft_total"]
    .forEach((k) => (MAX[k] = Math.max(...P.map((p) => n0(p[k]))) || 1));
  const feat = rd.villages.features.find((f) => f.properties.village_code === code);
  if (!feat) return null;
  const p = feat.properties;
  const med80 = (() => { const b = P.map((x) => n0(x.share_80plus)).sort((x, y) => x - y); return b[Math.floor(b.length / 2)]; })();
  const lv = (k) => ({ level: p[k], label: LVNAME[p[k]] || "—" });
  const lanes = rd.lanes.features.filter((x) => x.properties.village_code === code);
  const heritage = rd.heritage.features.filter((x) => x.properties.village_code === code);
  return {
    s5_candidate: !!p.s5_candidate,
    s5_reason: p.s5_reason || null,
    pop_total: p.pop_total,
    pop_80plus: p.pop_80plus,
    share_80plus: p.share_80plus,
    share_80plus_city_median: med80,
    bars: [
      { k: "lanes", label: "列管窄巷", value: p.lanes_total, unit: "條", text: fmtInt(p.lanes_total) + " 條", ratio: p.lanes_total / MAX.lanes_total, sub: `紅黃區 ${fmtInt(p.narrow_lanes_n)}＋消防通道 ${fmtInt(p.fire_access_lanes)}` },
      { k: "liq", label: "液化高潛勢", value: p.liq_high_share_city2019, unit: "share", text: fmtPct(p.liq_high_share_city2019), ratio: n0(p.liq_high_share_city2019) / MAX.liq_high_share_city2019, sub: "占里面積，城市版 2019" },
      { k: "old", label: "1999 前老屋", value: p.bld_share_pre_policy_1999, unit: "share", text: fmtPct(p.bld_share_pre_policy_1999), ratio: n0(p.bld_share_pre_policy_1999) / MAX.bld_share_pre_policy_1999, sub: "占有年份的戶；推估", estimated: true },
      { k: "heritage", label: "文資點", value: n0(p.heritage_sites_n), unit: "處", text: fmtInt(p.heritage_sites_n) + " 處", ratio: n0(p.heritage_sites_n) / MAX.heritage_sites_n, sub: "" },
      { k: "soft", label: "軟弱層候選", value: p.soft_total, unit: "棟", text: fmtInt(p.soft_total) + " 棟", ratio: p.soft_total / MAX.soft_total, sub: `A 型 ${fmtInt(p.soft_story_a_n)}／B 型 ${fmtInt(p.soft_story_b_n)}；候選`, estimated: true },
    ],
    levels: {
      elderly: lv("lv_elderly"), old_stock: lv("lv_old_stock"), liquefaction: lv("lv_liquefaction_city2019"),
      rescue: lv("lv_rescue"), soft_story: lv("lv_soft_story"),
    },
    map: {
      village: feat,
      lanes: { type: "FeatureCollection", features: lanes },
      fire_access_lanes: rd.fireLanes[code] || [],
      heritage: { type: "FeatureCollection", features: heritage },
    },
    _p: p,
  };
}

function checklistOf(rescue, x, townName, elder) {
  const p = rescue._p;
  const out = [];
  const add = (id, icon, title, detail, elderRelated) => out.push({ id, icon, title, detail, elder_related: !!elderRelated });
  if (p.lanes_total > 0) add("lanes", "🚒", `確認 ${fmtInt(p.lanes_total)} 條窄巷的消防車停車點`, "和分隊一條一條走，記水帶要拉多遠。");
  if (x && x.hyd) {
    const h = x.hyd;
    add("hydrant", "🚰", `量窄巷到消防栓：最遠一條約 ${h.far_m} m（${h.far_name}）`,
      `本里 ${h.n} 條紅黃區窄巷都算了，中位數約 ${h.median_m} m。直線距離、巷子位置用門牌中心，是推估，不是水帶實際拉的路線；消防通道清冊沒有座標，沒有算。消防栓：臺北自來水事業處清冊 115-09-15 版。`);
  }
  if (n0(p.liq_high_share_city2019) >= 0.25) add("liq", "🔥", "加入液化情境：路面沉陷、管線中斷", `里面積 ${fmtPct(p.liq_high_share_city2019)} 在高潛勢區。`);
  if (n0(p.pop_80plus) > 0) add("elder80", "👵", `列出要協助的 80 歲以上住戶（約 ${fmtInt(p.pop_80plus)} 人）`, "和鄰長分工。名冊不公開，由里辦公處保管。", true);
  if (n0(p.heritage_sites_n) > 0) add("heritage", "🏛️", `避難路線避開 ${fmtInt(p.heritage_sites_n)} 處文資建物`, "文資通常不能重建，先補強與演練。");
  if (p.soft_total > 0) add("soft", "🏢", `先走 ${fmtInt(p.soft_total)} 棟軟弱層候選路段`, "候選是從公開資料推估，不是判定。只算 1999 年以前的建物；新建街屋也可能有一樓軟弱層（研究裡有兩棟新建案例）。");
  if (x) {
    const main = x.sh.filter((s) => s.eq === "是"), backup = x.sh.filter((s) => s.eq === "備用");
    const head = x.sh.length ? `確認震後去哪裡：${main.length} 處主要、${backup.length} 處備用收容所` : "確認震後去哪裡：本里沒有列到震災收容所";
    const list = x.sh.map((s) => `${shortName(s.name)}（${s.eq === "是" ? "主要" : "備用"}${s.cap ? `，約 ${fmtInt(s.cap)} 人` : ""}${s.weak ? "，消防署標適合避難弱者" : ""}${s.acc ? "" : "，無障礙設施：否"}${s.limit ? "，" + s.limit : ""}${s.work ? "，備考有改建或拆除說明" : ""}）`);
    out.push({
      id: "shelter", icon: "🏫", title: head, elder_related: true,
      detail: `${x.sh_town_all ? `另有 ${x.sh_town_all} 處服務${townName}全區。` : ""}消防署標「適合避難弱者」且含震災的收容所：里內 ${x.weak_v} 處、${townName} ${x.weak_t} 處（依經緯度落點）。演練時確認這幾處誰開門、輪椅能不能進。教育局一覽表 115-02-24 版、消防署資料 2026-10-23 下載。`,
      shelters: list,
    });
  }
  add("apply", "📋", "申請耐震初評補助與社區防災演練",
    "里辦公處向市府申請。初評每棟最高補助 1.2 萬元（3,000 m² 以上 1.5 萬元）。初評後可申請弱層補強補助：集合住宅每棟最高 450 萬元、透天每件最高 50 萬元，補助至多 85%（1,500 萬元只限 113 年 4 月 3 日花蓮地震的專案）。行政流程可能超過一年。");
  if (elder) {
    // Stable partition: elder-related items first, others keep the rescue-drill-map order.
    return [...out.filter((c) => c.elder_related), ...out.filter((c) => !c.elder_related)];
  }
  return out;
}

/* ------------------------------------------------------------ bonus blocks (bonus-translator/app.js) */

const OLD_TREE = [
  ["ΔF1", []], ["ΔF2", []], ["ΔF3", []],
  ["ΔF4", ["ΔF4-1", "ΔF4-2", "ΔF4-3"]],
  ["ΔF5", ["ΔF5-1", "ΔF5-2", "ΔF5-3", "ΔF5-4", "ΔF5-5", "ΔF5-6", "ΔF5-7"]],
  ["ΔF6", []],
];
export const BONUS_COLOR = {
  "ΔF1": "#8c6d46", "ΔF2": "#a98b5f", "ΔF3": "#3f7cac",
  "ΔF4": "#5d9a48", "ΔF4-1": "#4f8f3a", "ΔF4-2": "#76ad55", "ΔF4-3": "#9cc47c",
  "ΔF5": "#d4892f", "ΔF5-1": "#d4892f", "ΔF5-2": "#e6b04f", "ΔF5-3": "#b0611f",
  "ΔF5-4": "#8a4f1c", "ΔF5-5": "#efc27a", "ΔF5-6": "#2f9a8a", "ΔF5-7": "#c9a227",
  "ΔF6": "#8e5a9c",
};

function parseCSV(text) {
  const rows = []; let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else cell += c;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  const head = rows.shift();
  return rows.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ""])));
}

function leavesOf(c, ITEMS) {
  const FIELD = (code) => ITEMS[code]?.platform_field || code.replace("Δ", "").replace("-", "_");
  const val = (code) => { const v = c.old?.[FIELD(code)]; return v ? Number(v) : 0; };
  const out = [];
  OLD_TREE.forEach(([p, kids]) => {
    const kv = kids.map((k) => [k, val(k)]).filter(([, v]) => v > 0);
    const pv = val(p);
    if (kv.length) {
      out.push(...kv);
      const rest = pv - kv.reduce((s, [, v]) => s + v, 0);
      if (rest > 1) out.push([p, rest]);
    } else if (pv > 0) out.push([p, pv]);
  });
  return out;
}

// Average composition over the cases of this village (else district, else city).
// Each case's blocks are taken as share of its own F0, then averaged (cases without an item count 0).
function bonusOf(cases, ITEMS, usage, village) {
  let scope = "village";
  let list = cases.filter((c) => String(c.village_codes || "").split(";").includes(String(village.village_code)));
  if (!list.length) { scope = "town"; list = cases.filter((c) => c.town_name === village.town_name); }
  if (!list.length) { scope = "city"; list = cases; }
  const sum = {}, used = {};
  let gainSum = 0;
  list.forEach((c) => {
    const F0 = Number(c.old.F0) || 0, F = Number(c.old.F) || 0;
    if (!F0) return;
    gainSum += (F - F0) / F0;
    leavesOf(c, ITEMS).forEach(([k, v]) => { sum[k] = (sum[k] || 0) + v / F0; used[k] = (used[k] || 0) + 1; });
  });
  const n = list.length;
  const order = OLD_TREE.flatMap(([p, kids]) => [...kids, p]);
  const blocks = Object.keys(sum).sort((a, b) => order.indexOf(a) - order.indexOf(b)).map((k) => ({
    code: k, short: ITEMS[k]?.short || k, icon: ITEMS[k]?.icon || "", plain: ITEMS[k]?.plain || "",
    color: BONUS_COLOR[k] || "#6f7f8f",
    mean_pct_of_F0: sum[k] / n, used_share: used[k] / n,
  }));
  return {
    scope, scope_label: scope === "village" ? village.village_name : scope === "town" ? village.town_name : "全臺北",
    n_cases: n,
    case_ids: list.map((c) => c.case_id),
    gain_mean: n ? gainSum / n : null,
    gain_city_median: usage ? usage.gain_median : null,
    cap_multiple: 1.5,
    blocks,
  };
}

const N = (x) => (x === "" || x == null ? null : Number(x));
const isTrue = (x) => x === true || String(x).toLowerCase() === "true";
const LEVEL_TEXT = { 5: "全市最高的約 7 個里", 4: "全市前 7%", 3: "全市前 23%", 2: "全市中間", 1: "全市較低的一半" };
const HIDDEN_NAMES = { elderly: "高齡", old_stock: "老房子", liquefaction: "液化", rescue: "救災不便", soft_story: "一樓軟弱層候選" };

function myVillageOf(bv, vmeta) {
  const share = N(bv.share_top46_city2019) || 0;
  const uroKnown = (vmeta.uro_rows_with_village || 0) >= 100 && bv.uro_sites != null;
  const top = N(bv.silver_top_pct);
  return {
    top10_share: share,
    top10_text: share > 0 && share < 0.01 ? "<1%" : (share * 100).toFixed(0) + "%",
    levels: {
      elderly: N(bv.lv_elderly), old_stock: N(bv.lv_old_stock), liquefaction: N(bv.lv_liquefaction_city2019),
      rescue: N(bv.lv_rescue), soft_story: N(bv.lv_soft_story),
    },
    level_text: LEVEL_TEXT,
    hidden_factors: isTrue(bv.hidden_by_composite_city2019)
      ? String(bv.hidden_factors_city2019 || "").split(/[;,|]/).map((x) => HIDDEN_NAMES[x.trim()] || x.trim()).filter(Boolean)
      : [],
    s5_candidate: isTrue(bv.s5_candidate),
    silver: bv.silver_share == null ? null : {
      share: N(bv.silver_share), rank: N(bv.silver_rank), top_pct: top,
      top_text: top * 100 < 1 ? "前 1%" : "前 " + Math.ceil(top * 100) + "%",
      n: N(bv.silver_n), total: N(bv.silver_total),
    },
    facts: {
      heritage_sites_n: N(bv.heritage_sites_n) || 0,
      weilao_active_est: N(bv.weilao_active_est) || 0,
      sea_sand_cases_n: N(bv.sea_sand_cases_n) || 0,
      quake_listed_n: N(bv.quake_listed_n) || 0,
      uro_sites: uroKnown ? N(bv.uro_sites) : null,
      uro_sites_approved: uroKnown ? N(bv.uro_sites_approved) : null,
    },
    pop_total: N(bv.pop_total),
    share_65plus: N(bv.share_65plus),
  };
}

/* ------------------------------------------------------------ actions */

const WHO = {
  cmo_seismic: { who: "臺北市建築管理工程處（使用科）", url: "https://cmo.gov.taipei/cp.aspx?n=023341AF71C3812D" },
  ncree: { who: "私有建築物耐震弱層補強資訊網；建管處使用科", url: "https://privatebuilding.ncree.org.tw/" },
  cmo_listed: { who: "臺北市建築管理工程處「列管建築物」", url: "https://cmo.gov.taipei/cp.aspx?n=4B7B63655A6565E9" },
  uro_elevator: { who: "臺北市都市更新處（電梯補助專區）", url: "https://uro.gov.taipei/News_Content.aspx?n=9CAC69257CFAC70E&s=E06839FCF0BC62E8&sms=1635F69C7777535B" },
  village_office: { who: "本里里辦公處", url: null },
  liq: { who: "經濟部地質調查及礦業管理中心（液化潛勢查詢）", url: "https://liquefaction.gsmma.gov.tw" },
  damage: { who: "結構技師（各技師公會）或臺北市建築管理工程處", url: "https://cmo.gov.taipei/cp.aspx?n=023341AF71C3812D" },
  weilao: { who: "建管處「危老重建」頁的危老重建推動師（免費）", url: "https://cmo.gov.taipei/cp.aspx?n=023341AF71C3812D" },
};

// Rules for picking the actions are the team's own, not an official standard.
function actionsOf({ building, rescue, ranking, myVillage, elder, ageUser, shelter, opt = {} }) {
  const A = [];
  const add = (o) => A.push(o);
  const pre = building ? building.pre1999 : (ageUser != null ? NOW_YEAR - ageUser - LAG_YEARS <= 1999 : null);
  const oldVillage = myVillage && myVillage.levels.old_stock >= 4;
  const flags = building && building.flags;

  if (flags && (flags.sea_sand || flags.quake_listed)) {
    add({
      id: "listed", priority: 0,
      title: flags.sea_sand ? "這棟在海砂屋列管清冊上：先確認列管狀態與處理方式" : "這棟在地震受損列管清冊上：先確認列管狀態",
      why: flags.sea_sand ? `這個門牌對到 ${flags.sea_sand.list_version} 版清冊（${flags.sea_sand.kind_label}）。` : `這個門牌對到 ${flags.quake_listed.list_version} 版清冊（${flags.quake_listed.event} 地震受損列管）。`,
      subsidy: flags.sea_sand ? "海砂屋：鑑定依面積補 30～145 萬元；拆除每戶 20 萬元；補強每戶 10 萬元；重建容積放寬 30%。" : "貼黃單的建物可申請臺北市補強補助（補 50%，每案最高 1,200 萬元）。",
      next: WHO.cmo_listed, source: "下一步卡片表 第 3、9 張（renewal-calculator/assets/nextsteps.js）",
    });
  }
  if (pre === true || (pre == null && oldVillage)) {
    add({
      id: "initial_eval", priority: 1,
      title: "整棟申請耐震初評",
      why: pre === true
        ? `${building && building.pre1999_basis === "data" ? "推估" : "依你填的屋齡"}這棟是 1999 年以前申請建造，用的是 921 以前的耐震規定。`
        : "這棟查不到年份，但這個里的老屋等級偏高（相對於臺北其他里）。",
      subsidy: "耐震初評：臺北市每棟最高補助 1.2 萬元（3,000 m² 以上 1.5 萬元），另補審查費 1,000 元。初評有疑慮再做詳評：補評估費 30%，每棟最高 40 萬元。",
      next: WHO.cmo_seismic, source: "day2-plan 共用事實；臺北市危老辦法 §9",
    });
  }
  if (building && (building.soft_story_candidate || (pre === true && building.floors >= 3))) {
    add({
      id: "soft_story", priority: building.soft_story_candidate ? 1.5 : 3,
      title: "初評後評估一樓弱層補強",
      why: building.soft_story_candidate
        ? `這棟是一樓軟弱層${building.soft_story_candidate} 型候選（從公開資料推估，不是判定）。`
        : `${building.floors} 層、1999 年以前的建物，一樓常是最弱的一層。`,
      subsidy: opt.type === "house"
        ? "耐震弱層補強補助（一般方案）：透天每件最高 50 萬元，補助至多 85%。1,500 萬元只限 113 年 4 月 3 日花蓮震災的專案作業規定，不是一般上限。"
        : opt.type === "apt" || opt.type === "building"
          ? "耐震弱層補強補助（一般方案）：集合住宅每棟最高 450 萬元，補助至多 85%。1,500 萬元只限 113 年 4 月 3 日花蓮震災的專案作業規定，不是一般上限。"
          : "耐震弱層補強補助（一般方案）：集合住宅每棟最高 450 萬元、透天每件最高 50 萬元，補助至多 85%。1,500 萬元只限 113 年 4 月 3 日花蓮震災的專案作業規定，不是一般上限。",
      next: WHO.ncree, source: "day2-plan 共用事實；GRB 16583227 p.78～79",
    });
  }
  if (elder) {
    // Elevator subsidy: nextsteps.js order 10 (renewal-calculator/assets/nextsteps.js, checked 2026-10-24).
    // No elevator subsidy for a townhouse (type=house): the card is for apartment buildings.
    if ((!building || building.has_elevator !== true) && opt.type !== "house") {
      add({
        id: "elevator", priority: 2,
        title: "家有長者：問公寓加裝電梯補助",
        why: building && building.has_elevator === false
          ? `這棟${building.floors ? ` ${building.floors} 層、` : ""}推估沒有電梯（實價登錄）。`
          : "查不到這棟有沒有電梯；沒有的話可以問。",
        subsidy: "公寓加裝電梯：一般補 50%，每座最高 300 萬元；戶內有 65 歲以上長者補 80%，每座最高 480 萬元。條件：屋齡 20 年以上、住宅使用達全棟一半以上、已領增設電梯建築許可，由管委會或過半住戶推派代表申請。",
        next: WHO.uro_elevator, source: "下一步卡片表 第 10 張（renewal-calculator/assets/nextsteps.js order 10）",
      });
    }
    add({
      id: "elder", priority: 2.5,
      title: "家有長者：確認震後去哪裡、誰來幫忙",
      why: `這個里約有 ${fmtInt(rescue ? rescue.pop_80plus : null)} 位 80 歲以上住戶。${rescue && rescue.share_80plus >= rescue.share_80plus_city_median ? "比例在全市中位數以上。" : ""}${shelter ? `最近的「適合避難弱者」收容所是${shelter.name}，${shelter.from === "home" ? "離你家" : "離里的中心"}直線約 ${shelter.distance_m.toLocaleString("zh-TW")} m。` : ""}演練時確認收容所輪椅能不能進。`,
      subsidy: "協助名冊由里辦公處保管，不公開。",
      next: WHO.village_office, source: "rescue-drill-map 檢核表",
    });
  }
  if (opt.crack === 1) {
    add({
      id: "visible_damage", priority: 0.5,
      title: "看到裂縫、鋼筋外露或漏水：請結構技師或建管處來看",
      why: "你說看到裂縫、鋼筋外露或漏水。斜向裂縫、鋼筋生鏽露出要請專業的人判斷，不要自己補起來就算了。",
      subsidy: "技師鑑定費用依報價；可以一起問耐震初評補助（臺北市每棟最高 1.2 萬元，3,000 m² 以上 1.5 萬元，另補審查費 1,000 元）。",
      next: WHO.damage, source: "你填的資料；day2-plan 共用事實",
    });
  }
  const liqHigh = (building && building.liq_level === "high") || (rescue && n0(rescue._p.liq_high_share_city2019) >= 0.25);
  if (liqHigh) {
    add({
      id: "liquefaction", priority: 3,
      title: "查最新液化潛勢，做液化自主檢查",
      why: building && building.liq_level === "high" ? "這棟落在液化高潛勢區（城市版 2019，區域尺度）。" : `這個里 ${fmtPct(rescue._p.liq_high_share_city2019)} 的面積在液化高潛勢區。`,
      subsidy: "免費查詢。",
      next: WHO.liq, source: "下一步卡片表 第 15、16 張",
    });
  }
  if (building && (building.no_elevator_30plus || (pre === true && (building.age_estimated ?? 0) >= 30))) {
    add({
      id: "weilao", priority: 4,
      title: "問免費顧問：這棟能不能走危老或都更",
      why: "屋齡 30 年以上、沒有電梯的老公寓，可能符合危老重建條件。下面「容積獎勵」一節是過去都更案的平均組成。",
      subsidy: "危老重建：容積最多 1.3 倍基準容積；地價稅、房屋稅減免。顧問免費。",
      next: WHO.weilao, source: "下一步卡片表 第 1、5 張",
    });
  }
  if (ranking && ranking.rank <= TOP_N && !A.some((a) => a.id === "initial_eval")) {
    add({
      id: "village_drill", priority: 3.5,
      title: "請里辦公處申請社區防災演練",
      why: `這個里在預設權重下排全市第 ${ranking.rank} 名（相對於臺北其他里）。`,
      subsidy: "由區公所或消防局協助，費用另洽。",
      next: WHO.village_office, source: "rescue-drill-map 檢核表",
    });
  }
  // Fallbacks so there are always at least three.
  const fallback = [
    () => ({ id: "liquefaction", priority: 5, title: "查最新液化潛勢", why: "液化潛勢圖有更新，先查你家這一格。", subsidy: "免費查詢。", next: WHO.liq, source: "下一步卡片表 第 15 張" }),
    () => ({ id: "initial_eval", priority: 5, title: "了解耐震初評", why: building && building.pre1999 === false ? "推估是 1999 年以後申請建造，優先順序較低；有裂縫或改過一樓再問。" : "先知道自己這棟的耐震分數。", subsidy: "耐震初評：臺北市每棟最高補助 1.2 萬元（3,000 m² 以上 1.5 萬元），另補審查費 1,000 元。", next: WHO.cmo_seismic, source: "day2-plan 共用事實" }),
    () => ({ id: "village_drill", priority: 6, title: "參加里的防災演練", why: "確認震後去哪裡、窄巷消防車進不進得來。", subsidy: "由區公所或消防局協助，費用另洽。", next: WHO.village_office, source: "rescue-drill-map 檢核表" }),
  ];
  for (const f of fallback) {
    if (A.length >= 3) break;
    const o = f();
    if (!A.some((a) => a.id === o.id)) A.push(o);
  }
  return A.sort((a, b) => a.priority - b.priority).slice(0, 5);
}

/* ------------------------------------------------------------ round 2: coordinates, age rank, nearest shelter */

// Coordinates are not in the renewal-calculator shards; solutions/prototype/data/buildings/<town>.json
// (built from data/marts/building_points) has lon/lat by point_id. Path is relative to mvp-variants/.
async function homeOf(get, building, villageFeature) {
  if (building) {
    try {
      const shard = await get(`../solutions/prototype/data/buildings/${building.town_code}.json`);
      const cols = shard.columns || shard.fields;
      const iId = cols.indexOf("point_id"), iLon = cols.indexOf("lon"), iLat = cols.indexOf("lat");
      const row = (shard.items || shard.records).find((r) => r[iId] === building.point_id);
      if (row && row[iLon] != null && row[iLat] != null) {
        return { lon: row[iLon], lat: row[iLat], source: "building_points", label: "你家（門牌座標）" };
      }
    } catch (e) { /* fall through to the village centre */ }
  }
  const c = villageFeature ? centroidOf(villageFeature.geometry) : null;
  return c ? { lon: c[0], lat: c[1], source: "village_center", label: "里的中心（約略，不是你家）" } : null;
}

// Area-weighted centroid of the largest outer ring (good enough for a village polygon).
function centroidOf(geom) {
  if (!geom) return null;
  const polys = geom.type === "Polygon" ? [geom.coordinates] : geom.type === "MultiPolygon" ? geom.coordinates : [];
  let best = null, bestA = 0;
  for (const poly of polys) {
    const ring = poly[0];
    let a = 0, cx = 0, cy = 0;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const f = ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
      a += f; cx += (ring[j][0] + ring[i][0]) * f; cy += (ring[j][1] + ring[i][1]) * f;
    }
    if (Math.abs(a) > bestA) { bestA = Math.abs(a); best = [cx / (3 * a), cy / (3 * a)]; }
  }
  return best;
}

function haversineM(lon1, lat1, lon2, lat2) {
  const R = 6371008.8, rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad, dLon = (lon2 - lon1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function nearestShelterOf(home, sh) {
  if (!home || !sh || !sh.items.length) return null;
  let best = null;
  for (const x of sh.items) {
    const d = haversineM(home.lon, home.lat, x.lon, x.lat);
    if (!best || d < best.d) best = { x, d };
  }
  return {
    name: best.x.name, lon: best.x.lon, lat: best.x.lat, cap: best.x.cap,
    distance_m: Math.round(best.d / 10) * 10,
    from: home.source === "building_points" ? "home" : "village_center",
    n_sites: sh.items.length,
    note: "直線距離，不是步行路線；消防署標「適合避難弱者」且災害類別含震災的收容所。",
    source: sh.meta.source,
  };
}

// "你家比本里幾 % 的房子老": among buildings of this village with an actual built year
// (not neighbour ranges), the share built strictly later than this one.
async function ageRankOf(get, vcode, builtYearEst, builtYearUser) {
  if (!vcode || (builtYearEst == null && builtYearUser == null)) return null;
  let recs;
  try { recs = await loadTown(get, vcode.slice(0, 8)); } catch (e) { return null; }
  const years = recs.filter((r) => r.village_code === vcode && r.built_year).map((r) => r.built_year);
  if (!years.length) return null;
  const share = (y) => (y == null ? null : years.filter((x) => x > y).length / years.length);
  return {
    village_code: vcode,
    n_known: years.length,
    older_than_share_estimated: share(builtYearEst),
    older_than_share_user: share(builtYearUser),
    note: "只算本里有實際建成年（使用執照、實價登錄、清冊）的房子，不含鄰棟推估。",
  };
}

/* ------------------------------------------------------------ round 3: plain-language layer for residents */

// Verdict: moved from print.js verdictOf (same order of rules). Team rule, not an official standard.
export const VERDICT_LABELS = { red: "建議盡快處理", yellow: "建議找人檢查", green: "目前沒有明顯警訊" };
function verdictOf({ building: b, actions, ranking, myVillage, opt = {} }) {
  const ids = new Set(actions.map((x) => x.id));
  const v = (level, line) => ({ level, label: VERDICT_LABELS[level], line });
  if (b && (b.flags.sea_sand || b.flags.quake_listed)) {
    return v("red", b.flags.sea_sand ? "這個門牌在海砂屋列管清冊上。" : "這個門牌在地震受損列管清冊上。");
  }
  // Coordinator rule (2026-10-24): visible damage reported by the resident is at least yellow.
  if (opt.crack === 1) return v("yellow", "你說看到裂縫或鋼筋外露，建議請人來看。");
  if (b && (ids.has("initial_eval") || ids.has("soft_story"))) {
    if (b.soft_story_candidate) return v("yellow", "一樓比較空，建議整棟請人做耐震檢查。");
    if (b.pre1999) return v("yellow", "用 921 前的耐震規定蓋的，建議請人檢查。");
    return v("yellow", "公開資料顯示這棟值得請人做耐震檢查。");
  }
  if (ranking && ranking.rank <= ranking.top_k) return v("yellow", "你住的里比臺北多數的里更需要先準備。");
  if (!b && myVillage && myVillage.levels.old_stock >= 4) return v("yellow", "你住的里老房子很多，建議請人檢查。");
  return v("green", b ? "公開資料看不出要優先處理的事。" : "你住的里在臺北不算前段，仍要準備。");
}

// Risks for residents: title <= 12 chars, plain <= 30 chars, no jargon. Levels are the team's own cut-offs.
function risksOf({ building: b, rescueP, elder, shelter, myVillage }) {
  const R = [];
  const add = (o) => R.push(o);
  const BP = "逐棟表 building_points（renewal-calculator/data/towns）";

  // 1. age and seismic code
  if (b && b.pre1999 != null) {
    add({ id: "age_code", icon: "📅", title: "房子的年紀", level: b.pre1999 ? "high" : "low",
      plain: b.pre1999 ? "蓋的時候用的是 921 地震前的耐震規定" : "蓋的時候已經用 921 地震後的耐震規定",
      detail: `${b.built_year ? `約 ${b.built_year} 年建（${b.age_source_label}）` : "建造年查不到，依你填的屋齡"}；${b.code_generation_label || b.code_generation_user_label || ""}。以申請建造日（建成年減 2 年）對 1999 年判斷。`,
      basis: b.pre1999_basis === "user_age" ? "user" : (b.built_year_confirmed ? "data" : "estimate"), source: BP });
  } else if (!b) {
    add({ id: "age_code", icon: "📅", title: "房子的年紀", level: "unknown", plain: "沒有對上門牌，查不到這棟的年紀",
      detail: "輸入完整門牌（含號），或填屋齡。", basis: "estimate", source: BP });
  } else {
    add({ id: "age_code", icon: "📅", title: "房子的年紀", level: "unknown", plain: "查不到這棟是哪一年蓋的",
      detail: "門牌對上了，但沒有使用執照或成交紀錄可推估；可以填屋齡。", basis: "estimate", source: BP });
  }

  // 2. open ground floor (soft story)
  if (b) {
    add({ id: "ground_floor", icon: "🏪", title: "一樓的牆夠不夠", level: b.soft_story_candidate ? "high" : "low",
      plain: b.soft_story_candidate ? "一樓比較空，地震時容易先壞" : "公開資料看不出一樓特別空",
      detail: b.soft_story_candidate ? `${b.soft_story_label}。從公開資料推估，不是判定。` : "只篩 1999 年以前的建物；這是推估，不是判定。",
      basis: "estimate", source: BP });
  } else {
    add({ id: "ground_floor", icon: "🏪", title: "一樓的牆夠不夠", level: "unknown", plain: "沒有對上門牌，查不到",
      detail: "要確切門牌才能看這一棟。", basis: "estimate", source: BP });
  }

  // 3. soil (liquefaction)
  const LIQ = { high: ["high", "地震時地下的土可能變軟"], medium: ["mid", "地震時地下的土有一點可能變軟"], low: ["low", "地下的土變軟的機會比較低"] };
  const LIQ_SRC = "臺北市土壤液化潛勢圖城市版 2019";
  if (b && LIQ[b.liq_level]) {
    add({ id: "soil", icon: "💧", title: "地下的土壤", level: LIQ[b.liq_level][0], plain: LIQ[b.liq_level][1],
      detail: `這棟在土壤液化潛勢「${b.liq_label}」的範圍（城市版 2019，區域尺度，不是這塊地的鑽探）。`, basis: "data", source: LIQ_SRC });
  } else if (rescueP) {
    const sh = n0(rescueP.liq_high_share_city2019);
    const lv = sh >= 0.25 ? "high" : sh > 0 ? "mid" : "low";
    add({ id: "soil", icon: "💧", title: "地下的土壤", level: lv,
      plain: lv === "high" ? "里裡很多地方，地震時土可能變軟" : lv === "mid" ? "里裡有些地方，地震時土可能變軟" : "里裡土壤變軟的機會比較低",
      detail: `里面積 ${fmtPct(sh)} 在液化高潛勢區（城市版 2019）。沒有這一棟的資料，用里的比例。`, basis: "data", source: LIQ_SRC });
  } else {
    add({ id: "soil", icon: "💧", title: "地下的土壤", level: "unknown", plain: "查不到", detail: "", basis: "data", source: LIQ_SRC });
  }

  // 4. elders and elevator
  const ME = "你填的資料";
  if (elder == null) {
    add({ id: "elder_lift", icon: "👵", title: "長輩上下樓", level: "unknown", plain: "你還沒填家裡有沒有長輩", detail: "填了之後會看電梯與避難處。", basis: "user", source: ME });
  } else if (elder === 0) {
    add({ id: "elder_lift", icon: "👵", title: "長輩上下樓", level: "low", plain: "你填家裡沒有長輩", detail: "", basis: "user", source: ME });
  } else if (b && b.has_elevator === false) {
    add({ id: "elder_lift", icon: "👵", title: "長輩上下樓", level: "high", plain: "家有長輩又沒有電梯，逃生比較慢",
      detail: `${b.floors ? b.floors + " 層、" : ""}實價登錄推估沒有電梯。加裝電梯有補助，見建議。`, basis: "user", source: `${ME}；實價登錄` });
  } else if (b && b.has_elevator === true) {
    add({ id: "elder_lift", icon: "👵", title: "長輩上下樓", level: "low", plain: "有電梯，但停電時一樣要走樓梯", detail: "實價登錄推估有電梯。", basis: "user", source: `${ME}；實價登錄` });
  } else {
    add({ id: "elder_lift", icon: "👵", title: "長輩上下樓", level: "unknown", plain: "家有長輩，但查不到有沒有電梯", detail: "", basis: "user", source: ME });
  }

  // 5-6. listing flags: only for an exact doorplate
  const QS = "臺北市建管處地震列管建築物清冊", SS = "臺北市建管處海砂屋列管清冊";
  if (b) {
    const q = b.flags.quake_listed, ss = b.flags.sea_sand;
    add({ id: "quake_listed", icon: "⚠️", title: "地震受損列管", level: q ? "high" : "low",
      plain: q ? "這個門牌在政府的地震受損清冊上" : "這個門牌不在地震受損清冊上",
      detail: q ? `${q.event} 地震受損列管，${q.list_version} 版清冊。列管狀態以建管處為準。` : "對 921、331、403 地震列管建築物清冊（115.3.18 版）。", basis: "data", source: QS });
    add({ id: "sea_sand", icon: "🧱", title: "海砂屋", level: ss ? "high" : "low",
      plain: ss ? `這個門牌在海砂屋清冊上（${ss.kind_label}）` : "這個門牌不在海砂屋清冊上",
      detail: ss ? `${ss.list_version} 版清冊。` : "對海砂屋完整列管清冊（115.3.25 版）。", basis: "data", source: SS });
  } else {
    add({ id: "quake_listed", icon: "⚠️", title: "地震受損列管", level: "unknown", plain: "要確切門牌才查得到", detail: "列管清冊只對確切門牌，不提供清單。", basis: "data", source: QS });
    add({ id: "sea_sand", icon: "🧱", title: "海砂屋", level: "unknown", plain: "要確切門牌才查得到", detail: "列管清冊只對確切門牌，不提供清單。", basis: "data", source: SS });
  }

  // 7. narrow lanes (village level)
  const LS = "消防局狹小巷道清冊、消防通道清冊";
  if (rescueP) {
    const lanes = n0(rescueP.narrow_lanes_n) + n0(rescueP.fire_access_lanes);
    const lv = rescueP.lv_rescue >= 4 ? "high" : rescueP.lv_rescue === 3 ? "mid" : "low";
    add({ id: "fire_lane", icon: "🚒", title: "消防車進不進得來", level: lv,
      plain: lv === "high" ? "里裡窄巷多，消防車比較難進來" : lv === "mid" ? "里裡有些窄巷，消防車可能要繞路" : "里裡窄巷不多，消防車比較好進來",
      detail: `消防局列管窄巷 ${fmtInt(lanes)} 條（紅黃區＋消防通道）；救災等級「${LVNAME[rescueP.lv_rescue] || "—"}」，相對於臺北其他里。`, basis: "data", source: LS });
  } else {
    add({ id: "fire_lane", icon: "🚒", title: "消防車進不進得來", level: "unknown", plain: "查不到", detail: "", basis: "data", source: LS });
  }

  // 8. nearest shelter for vulnerable people
  const SH = "內政部消防署避難收容處所（適合避難弱者、含震災）";
  if (shelter) {
    const d = shelter.distance_m;
    const lv = d <= 500 ? "low" : d <= 1000 ? "mid" : "high";
    add({ id: "shelter", icon: "🏫", title: "最近的避難處", level: lv,
      plain: `能照顧長輩的避難處，直線約 ${d.toLocaleString("zh-TW")} 公尺`,
      detail: `${shelter.name}${shelter.cap ? `，約 ${shelter.cap} 人` : ""}。${shelter.from === "home" ? "從你家量" : "從里的中心量（沒有你家座標）"}；直線距離，不是步行路線。`,
      basis: shelter.from === "home" ? "data" : "estimate", source: SH });
  } else {
    add({ id: "shelter", icon: "🏫", title: "最近的避難處", level: "unknown", plain: "查不到", detail: "", basis: "data", source: SH });
  }
  return R;
}

// Stable short id for a future backend: HR-YYYYMMDD-XXXX, XXXX = FNV-1a of key|date (local date).
function reportIdOf(key, now) {
  const d = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  let h = 0x811c9dc5;
  for (const ch of `${key}|${d}`) { h ^= ch.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
  return `HR-${d}-${(h >>> 16).toString(16).toUpperCase().padStart(4, "0")}`;
}

// One sentence instead of the rank: the village's most prominent axis (highest city percentile).
const PLAIN_AXES = [
  ["p_elderly", "65 歲以上的長輩"], ["p_old_stock", "老房子"], ["p_liquefaction", "地震時土可能變軟的地方"],
  ["p_rescue", "窄巷"], ["p_soft_story", "一樓比較空的房子"],
];
function plainVillageOf(prGeo, code) {
  const v = prGeo.features.map((f) => f.properties).find((x) => x.village_code === code);
  if (!v) return null;
  const [k, what] = PLAIN_AXES.slice().sort((a, b) => n0(v[b[0]]) - n0(v[a[0]]))[0];
  const p = n0(v[k]);
  if (p < 0.5) return "你住的里，五項風險都在臺北的中間以下。";
  const share = p >= 0.95 ? "9 成以上" : `${Math.floor(p * 10)} 成`;
  return `你住的里，${what}比臺北 ${share}的里多。`;
}

// Resident identity comes only from opts.user (a logged-in front end), never from the URL.
function userOf(u) {
  if (!u || typeof u !== "object" || u.name == null) return null;
  return { name: String(u.name), id: u.id == null ? null : String(u.id) };
}

/* ------------------------------------------------------------ round 4: optional inputs, action tags, medical */

export const OPTIONAL_KEYS = ["type", "units", "floor", "ground", "own", "mc", "crack"];
const TYPE_LABELS_USER = { apt: "公寓", house: "透天", building: "大樓" };
const GROUND_LABELS = { shop: "店面", parking: "停車空間", arcade: "騎樓", home: "住家" };

function cleanOptional(input = {}) {
  const int = (x, min, max) => {
    if (x === "" || x == null || isNaN(Number(x))) return null;
    const n = Math.round(Number(x));
    return n < min || n > max ? null : n;
  };
  const oneOf = (x, list) => (list.includes(String(x)) ? String(x) : null);
  const bit = (x) => (x === "" || x == null ? null : (String(x) === "1" || x === true ? 1 : String(x) === "0" || x === false ? 0 : null));
  return {
    type: oneOf(input.type, ["apt", "house", "building"]),
    units: int(input.units, 1, 5000),
    floor: int(input.floor, -5, 120),
    ground: oneOf(input.ground, ["shop", "parking", "arcade", "home"]),
    own: oneOf(input.own, ["owner", "renter"]),
    mc: bit(input.mc),
    crack: bit(input.crack),
  };
}

/** URL query -> { input, opts } for buildReport. Never reads a name: user identity only comes from opts.user. */
export function parseQuery(search) {
  const q = new URLSearchParams(search || "");
  const input = { addr: q.get("addr") || "", age: q.get("age") ?? "", elder: q.get("elder") ?? "" };
  OPTIONAL_KEYS.forEach((k) => { if (q.has(k)) input[k] = q.get(k); });
  const opts = {};
  if (q.get("v")) opts.village_code = q.get("v");
  if (q.get("t")) opts.town_code = q.get("t");
  const m = String(globalThis.location?.hash || "").match(/w=([\d.,]+)/);
  if (m) {
    const w = m[1].split(",").map(Number);
    if (w.length === 5 && w.every((x) => x >= 0 && x <= 4)) opts.weights = w;
  }
  return { input, opts };
}

// Initial assessment subsidy (day2-plan shared facts): 12,000 per building (15,000 from 3,000 m²) + 1,000 review fee.
function perHouseholdOf(units, unitsBasis) {
  if (!units) return null;
  const r = (x) => Math.round(x / units / 100) * 100;
  return { units, units_basis: unitsBasis, amount: r(13000), amount_large: r(16000) };
}

// Only actions about the building itself get the landlord prefix (coordinator decision, 2026-10-24).
const RENTER_ACTIONS = new Set(["initial_eval", "soft_story", "elevator", "visible_damage", "weilao", "listed"]);
const ACTION_TAGS = {
  listed: ["先問列管狀態", null],
  initial_eval: ["請人來看耐震", "每棟補 1.2 萬"],
  soft_story: ["補強一樓", "最多補 450 萬"],
  elevator: ["申請加裝電梯", "最多補 480 萬"],
  elder: ["確認避難去處", "免費"],
  liquefaction: ["查地下的土", "免費"],
  weilao: ["問能不能重建", "免費"],
  village_drill: ["參加防災演練", "費用另洽"],
  visible_damage: ["請技師來看裂縫", "費用另洽"],
};

// Adds plain_title, money_tag and the optional-input notes to each action (fields only added, none renamed).
function decorateActions(A, opt, ph, building) {
  return A.map((a) => {
    const [pt, tag] = ACTION_TAGS[a.id] || [a.title.slice(0, 12), "費用另洽"];
    let money = tag;
    if (a.id === "listed") money = building && building.flags.sea_sand ? "鑑定最多補 145 萬" : "最多補 1,200 萬";
    if (a.id === "soft_story" && opt.type === "house") money = "最多補 50 萬";
    if (a.id === "initial_eval" && ph) money = `每戶約 ${ph.amount.toLocaleString("zh-TW")} 元`;
    const o = { ...a, plain_title: pt, money_tag: money, notes: [] };
    if (a.id === "initial_eval" && ph) {
      o.per_household = ph;
      o.subsidy += ` 市府補助平均到每戶約 ${ph.amount.toLocaleString("zh-TW")} 元（全棟 ${ph.units} 戶${ph.units_basis === "user" ? "，你填的" : "，用門牌數推估"}；3,000 m² 以上的大樓約 ${ph.amount_large.toLocaleString("zh-TW")} 元）。`;
    }
    if (opt.mc === 0 && (a.id === "elevator" || a.id === "initial_eval")) {
      o.notes.push("沒有管委會：要先推派住戶代表");
      o.why += " 沒有管委會：要先推派住戶代表。";
    }
    if (opt.own === "renter" && RENTER_ACTIONS.has(a.id)) {
      o.next = { ...a.next, who: `先跟房東說：${a.next.who}` };
    }
    return o;
  });
}

const MEDICAL_KINDS = ["er_hospital", "hospital", "clinic", "aed"];
function nearbyMedicalOf(home, med) {
  if (!med || !Array.isArray(med.items)) return null;
  const out = {};
  for (const k of MEDICAL_KINDS) {
    let best = null;
    if (home) {
      for (const x of med.items) {
        if (x.kind !== k || x.lon == null || x.lat == null) continue;
        const d = haversineM(home.lon, home.lat, Number(x.lon), Number(x.lat));
        if (!best || d < best.d) best = { x, d };
      }
    }
    out[k] = best ? {
      name: best.x.name, distance_m: Math.round(best.d / 10) * 10, lon: Number(best.x.lon), lat: Number(best.x.lat),
      district: best.x.district ?? null, from: home.source === "building_points" ? "home" : "village_center",
    } : null;
  }
  return out;
}

// Extra risks appended after the fixed eight: visible_damage, then medical.
function extraRisksOf(opt, medical) {
  const R = [];
  if (opt.crack === 1) {
    R.push({ id: "visible_damage", icon: "🔍", title: "看得到的損傷", level: "high", plain: "你說看到裂縫、鋼筋外露或漏水",
      detail: "牆或柱有斜向裂縫、鋼筋露出生鏽、長期漏水，都要請結構技師或建管處來看。這是你填的，不是我們的推估。", basis: "user", source: "你填的資料" });
  } else if (opt.crack === 0) {
    R.push({ id: "visible_damage", icon: "🔍", title: "看得到的損傷", level: "low", plain: "你說沒看到裂縫、鋼筋外露或漏水",
      detail: "沒看到不代表沒有；地震後再檢查一次。", basis: "user", source: "你填的資料" });
  } else {
    R.push({ id: "visible_damage", icon: "🔍", title: "看得到的損傷", level: "unknown", plain: "你還沒填有沒有看到裂縫或漏水",
      detail: "", basis: "user", source: "你填的資料" });
  }
  const er = medical && medical.er_hospital;
  if (er) {
    const d = er.distance_m;
    const lv = d <= 2000 ? "low" : d <= 5000 ? "mid" : "high";
    const dist = d >= 1000 ? `${(d / 1000).toFixed(1)} 公里` : `${d.toLocaleString("zh-TW")} 公尺`;
    R.push({ id: "medical", icon: "🏥", title: "最近的急救醫院", level: lv, plain: `最近的急救責任醫院，直線約 ${dist}`,
      detail: `${er.name}。${er.from === "home" ? "從你家量" : "從里的中心量（沒有你家座標）"}；直線距離，不是車程。`,
      basis: er.from === "home" ? "data" : "estimate", source: "health-report/data/medical.json" });
  } else {
    R.push({ id: "medical", icon: "🏥", title: "最近的急救醫院", level: "unknown", plain: "查不到", detail: "醫療資料還沒產生或讀不到。", basis: "data", source: "health-report/data/medical.json" });
  }
  return R;
}

// Optional inputs that change the fixed risks (ground floor, elder and floor). Returns a new array.
function adjustRisks(risks, opt, building, elder) {
  const rank = { unknown: -1, low: 0, mid: 1, high: 2 };
  return risks.map((r) => {
    if (r.id === "ground_floor" && opt.ground) {
      const g = GROUND_LABELS[opt.ground];
      if (opt.ground === "home") {
        return { ...r, level: "low", basis: "user", plain: "你說一樓是住家",
          detail: `你填一樓是住家。${building && building.soft_story_candidate ? "公開資料推估這棟是一樓軟弱層候選，可以請人確認。" : ""}` };
      }
      const level = rank[r.level] >= rank.mid ? r.level : "mid";
      return { ...r, level, basis: "user", plain: `你說一樓是${g}，牆可能比較少`,
        detail: `一樓做${g}的房子，牆常比樓上少，地震時一樓較容易先壞。${r.detail}` };
    }
    if (r.id === "elder_lift" && elder === 1 && opt.floor != null) {
      const noLift = !(building && building.has_elevator === true);
      if (opt.floor <= 1) return { ...r, level: "low", plain: "住一樓，長輩逃生比較方便", detail: `你填住 ${opt.floor} 樓。${r.detail}` };
      if (noLift && opt.floor >= 3) return { ...r, level: "high", plain: `住 ${opt.floor} 樓又沒有電梯，長輩逃生比較慢`, detail: `你填住 ${opt.floor} 樓。${r.detail}` };
      if (noLift) return { ...r, level: "mid", plain: "住 2 樓、沒有電梯，長輩要人扶", detail: `你填住 2 樓。${r.detail}` };
    }
    return r;
  });
}

/* ------------------------------------------------------------ main */

function cleanInput({ addr, age, elder } = {}) {
  const a = addr == null ? "" : String(addr).trim();
  const ag = age === "" || age == null || isNaN(Number(age)) ? null : Math.max(0, Math.round(Number(age)));
  const el = elder === "" || elder == null ? null : (String(elder) === "1" || elder === true ? 1 : 0);
  return { addr: a || null, age: ag, elder: el };
}

/**
 * @param {{addr?:string, age?:number|string, elder?:0|1|string}} input
 * @param {{base?:string|URL, fetch?:Function, village_code?:string, town_code?:string, weights?:number[]}} [opts]
 */
export async function buildReport(input, opts = {}) {
  const get = loaderFor(opts);
  const inp = cleanInput(input);
  const opt = cleanOptional(input || {});
  const weights = Array.isArray(opts.weights) && opts.weights.length === 5 ? opts.weights.map(Number) : DEFAULT_WEIGHTS;
  const missing = ["addr", "age", "elder"].filter((k) => inp[k] == null);
  const warnings = [];

  const [prices, prGeo, rdVillages, rdLanes, rdFire, rdHer, rdMeta, rdExtra, itemsCsv, bCases, bVillages, bUsage, prMeta] = await Promise.all([
    get("renewal-calculator/data/prices.json"),
    get("priority-ranking/data/villages.geojson"),
    get("rescue-drill-map/data/villages.geojson"),
    get("rescue-drill-map/data/narrow_lanes.geojson"),
    get("rescue-drill-map/data/fire_access_lanes.json"),
    get("rescue-drill-map/data/heritage.geojson"),
    get("rescue-drill-map/data/meta.json"),
    get("rescue-drill-map/data/drill_extra.json").catch(() => null),
    get("bonus-translator/bonus-items.csv", "text"),
    get("bonus-translator/data/cases.json"),
    get("bonus-translator/data/villages.json"),
    get("bonus-translator/data/bonus-usage.json").catch(() => null),
    get("priority-ranking/data/meta.json"),
  ]);

  // 1. address -> building (exact doorplate only) -> village
  const address = { query: inp.addr, normalized: null, match: "none", town_code: null, suggestions: [], ambiguous: [] };
  let rec = null;
  if (inp.addr) {
    const q = normalizeAddress(inp.addr);
    address.normalized = q;
    const m = cleanPrefix(inp.addr).match(_RE_TOWN);
    const hint = m ? Object.entries(prices.town_names).find(([, n]) => n === m[1])?.[0] : (opts.town_code || null);
    const towns = hint ? [hint] : TOWN_CODES;
    const results = await Promise.all(towns.map(async (t) => {
      try { return [t, searchBuildings(await loadTown(get, t), q)]; } catch (e) { warnings.push(e.message); return [t, { exact: [], similar: [] }]; }
    }));
    const exact = results.flatMap(([, r]) => r.exact);
    if (exact.length) {
      rec = exact[0];
      address.match = "exact";
      if (new Set(exact.map((r) => r.town_code)).size > 1) {
        address.ambiguous = exact.map((r) => ({ town_code: r.town_code, town_name: prices.town_names[r.town_code], address: r.address, village_code: r.village_code }));
        warnings.push("同一個門牌在不只一個區出現，先用第一筆；可在門牌前加區名。");
      }
    } else {
      const sim = results.flatMap(([t, r]) => r.similar.map((s) => ({ town_code: t, town_name: prices.town_names[t], address: s.address, village_code: s.village_code })));
      address.suggestions = sim.slice(0, 12);
      address.match = sim.length ? "similar" : "none";
    }
    if (rec) address.town_code = rec.town_code;
  }
  const building = rec ? buildingOf(rec, inp.age) : null;

  let vcode = building ? building.village_code : (opts.village_code || null);
  const bvAll = bVillages.villages;
  let bv = vcode ? bvAll.find((x) => String(x.village_code) === String(vcode)) : null;
  if (vcode && !bv) { warnings.push(`找不到里代碼 ${vcode}`); vcode = null; }

  const report = {
    version: 1,
    generated_at: new Date().toISOString(),
    input: inp,
    missing,
    weights,
    address,
    building,
    age: {
      user: inp.age,
      estimated: building ? building.age_estimated : null,
      estimated_source: building ? building.age_source_label : null,
      built_year_user: inp.age == null ? null : NOW_YEAR - inp.age,
      built_year_estimated: building ? building.built_year : null,
      // added in round 2
      code_generation_user: inp.age == null ? null : generationOf(NOW_YEAR - inp.age),
      code_generation_user_label: inp.age == null ? null : generationLabel(generationOf(NOW_YEAR - inp.age)),
      code_generation_estimated: building ? building.code_generation : null,
      code_generation_estimated_label: building ? generationLabel(building.code_generation) : null,
      pre1999_user: inp.age == null ? null : NOW_YEAR - inp.age - LAG_YEARS <= 1999,
    },
    village: null,
    ranking: null,
    rescue: null,
    checklist: [],
    bonus: null,
    my_village: null,
    actions: [],
    sources: [],
    disclaimer: DISCLAIMER,
    warnings,
    needs_village: !vcode,
    // added in round 2 (null when there is no village)
    home: null,
    nearest_weak_shelter: null,
    age_rank: null,
    // added in round 4 (optional inputs, medical)
    input_optional: opt,
    missing_optional: OPTIONAL_KEYS.filter((k) => opt[k] == null),
    nearby_medical: null,
    // added in round 3 (plain-language layer)
    verdict: null,
    risks: [],
    user: userOf(opts.user),
    report_id: null,
    plain_village: null,
  };

  if (vcode) {
    report.village = {
      village_code: bv.village_code, village_name: bv.village_name,
      town_code: String(bv.town_code), town_name: bv.town_name,
      pop_total: N(bv.pop_total), area_km2: N(bv.area_km2),
    };
    report.ranking = rankingOf(prGeo, vcode, weights);
    const rd = { villages: rdVillages, lanes: rdLanes, fireLanes: rdFire, heritage: rdHer };
    const rescue = rescueOf(rd, vcode);
    const x = rdExtra && rdExtra.v[vcode];
    report.checklist = rescue ? checklistOf(rescue, x, bv.town_name, inp.elder === 1) : [];
    report.checklist_note = inp.elder === 1 ? "家裡有長者，所以長者相關的項目排在前面。" : null;
    const ITEMS = {};
    parseCSV(itemsCsv).filter((r) => r.framework === "old").forEach((r) => { ITEMS[r.code] = r; });
    report.bonus = bonusOf(bCases.cases, ITEMS, bUsage, bv);
    report.my_village = myVillageOf(bv, bVillages.meta || {});
    const vfeat = rdVillages.features.find((f) => f.properties.village_code === vcode);
    const [home, shelters, medical, ageRank] = await Promise.all([
      homeOf(get, building, vfeat),
      get("health-report/data/shelters_weak.json").catch(() => null),
      get("health-report/data/medical.json").catch(() => null),
      ageRankOf(get, vcode, building && building.built_year_range == null ? building.built_year : null, inp.age == null ? null : NOW_YEAR - inp.age),
    ]);
    report.home = home;
    report.nearest_weak_shelter = nearestShelterOf(home, shelters);
    report.age_rank = ageRank;
    report.nearby_medical = nearbyMedicalOf(home, medical);
    if (!shelters) warnings.push("讀不到 health-report/data/shelters_weak.json，請跑 scripts/build_shelters.py。");
    report.actions = actionsOf({ building, rescue, ranking: report.ranking, myVillage: report.my_village, elder: inp.elder === 1, ageUser: inp.age, shelter: report.nearest_weak_shelter, opt });
    const unitsUsed = opt.units ?? (building && building.units) ?? null;
    report.actions = decorateActions(report.actions, opt, perHouseholdOf(unitsUsed, opt.units != null ? "user" : "estimate"), building);
    report.verdict = verdictOf({ building, actions: report.actions, ranking: report.ranking, myVillage: report.my_village, opt });
    report.risks = risksOf({ building, rescueP: rescue ? rescue._p : null, elder: inp.elder, shelter: report.nearest_weak_shelter, myVillage: report.my_village });
    report.risks = [...adjustRisks(report.risks, opt, building, inp.elder), ...extraRisksOf(opt, report.nearby_medical)];
    report.plain_village = plainVillageOf(prGeo, vcode);
    if (rescue) { delete rescue._p; }
    report.rescue = rescue;
  }

  report.report_id = reportIdOf(building ? building.town_code + address.normalized : (vcode || inp.addr || "none"), opts.now ? new Date(opts.now) : new Date());
  report.sources = [
    { part: "老屋健檢", text: "逐棟表 data/marts/building_points（使用執照 90～115 年、實價登錄 101S4～115S3、海砂屋清冊 115.3.25、地震列管 115.3.18 版），經 renewal-calculator/data/towns/。建成年除使用執照與清冊外都是推估。" },
    { part: "我的里在全市的位置", text: `data/marts/village_rankings（城市版 2019），經 priority-ranking/data/。資料產生於 ${prMeta.generated || "—"}。` },
    { part: "救災地圖與檢核表", text: `${rdMeta.sources.villages}；窄巷：${rdMeta.sources.narrow_lanes}；文資：${rdMeta.sources.heritage}；液化：${rdMeta.sources.liquefaction}。${rdExtra ? `收容所：${rdExtra.meta.shelters_edu}；${rdExtra.meta.shelters_nfa}。消防栓：${rdExtra.meta.hydrants}。` : ""}` },
    { part: "容積獎勵與我的里", text: "都市更新審議服務平台（debug-e3），每基地最新一版且 F＞F0 的 147 個基地；里的指標 data/marts/village_indicators.csv、village_rankings.csv；銀髮安居：內政部統計處，113 年，村里別（比例與排序是推算）。" },
    { part: "你家座標與最近的收容所", text: "門牌座標：solutions/prototype/data/buildings（由 data/marts/building_points 產生）；對不到時用里界的中心。收容所：health-report/data/shelters_weak.json（內政部消防署避難收容處所，2026-10-23 下載，依 shelterId 去重，適合避難弱者且含震災；容量依名稱對教育局一覽表 115-02-24 版）。只有名稱、座標、容量，不含聯絡人。" },
    { part: "補助數字", text: "ops/handoff/2026-10-24-day2-plan.md 第 1 節共用事實；下一步卡片表（renewal-calculator/assets/nextsteps.js，2026-10-24 查核版）。" },
  ];
  return report;
}

/** Village list for the picker when the address does not match: [{village_code, village_name, town_code, town_name}] */
export async function listVillages(opts = {}) {
  const get = loaderFor(opts);
  const j = await get("bonus-translator/data/villages.json");
  return j.villages.map((v) => ({ village_code: String(v.village_code), village_name: v.village_name, town_code: String(v.town_code), town_name: v.town_name }));
}

/*
 * calc.js  Renewal calculator (MVP variant A, "我家都更划不划算").
 *
 * Flow: pick a district -> type an address -> match a building in data/towns/<code>.json
 * -> pick a unit price from a fallback ladder -> apply the user's bonus and burden
 * sliders -> draw it: two houses sized by floor area (hero), bars for floor area and
 * money, a diverging "flip" chart for the two after-price sources, a dot grid for
 * consent, and icon cards from nextsteps.js. Moving parts animate with CSS transitions.
 *
 * Data comes from scripts/build_calc_data.py (data/ is not in git).
 */

'use strict';

// Collected for test/check.html (headless self-check); harmless in normal use.
window.__errors = [];
window.addEventListener('error', (e) => window.__errors.push(String(e.message)));
window.addEventListener('unhandledrejection', (e) => window.__errors.push(String(e.reason)));

const DATA = 'data/';
const PING_M2 = 3.30579;
const M2_PER_UNIT = 29.0;  // G3: median land share per unit, old walk-ups (data-patterns/g3-consent-threshold.md)
const TODAY = new Date();

const TYPE_LABELS = {
  walkup: '公寓（5 樓以下無電梯）', midrise: '電梯華廈', tower: '住宅大樓', townhouse: '透天厝',
};
const DECADE_LABELS = {
  pre1974: '1974 年以前', '1974-1981': '1974～1981', '1982-1989': '1982～1989',
  '1990-1998': '1990～1998', '1999-2009': '1999～2009', '2010plus': '2010 以後',
};
const RAW_TYPE_TO_GROUP = {
  walkup_5_or_less: 'walkup', midrise_elevator: 'midrise', tower_11plus: 'tower',
  townhouse: 'townhouse', studio: 'midrise',
};
const AGE_SOURCE_LABELS = {
  permit: '使用執照', sea_sand_list: '海砂屋清冊', lvr: '實價登錄', lvr_neighbor: '鄰棟推估', none: '—',
};
const STRUCTURE_LABELS = {
  rc: '鋼筋混凝土', src_steel: '鋼骨或鋼骨鋼筋混凝土', brick_reinforced: '加強磚造', brick: '磚造', wood: '木造', other: '其他',
};

const state = {
  prices: null,
  meta: null,
  towns: new Map(),   // town_code -> Promise<records[]>
  rec: null,          // matched building
  townCode: null,
};

const $ = (id) => document.getElementById(id);

/* ------------------------------------------------------------ loading */

function loadJSON(url) {
  return fetch(url).then((r) => {
    if (!r.ok) throw new Error(`讀取失敗 ${url}（HTTP ${r.status}）`);
    return r.json();
  });
}

function loadTown(code) {
  if (!state.towns.has(code)) {
    const p = loadJSON(`${DATA}towns/${code}.json`).then((shard) => {
      const f = shard.fields;
      return shard.records.map((row) => {
        const o = { town_code: shard.town_code };
        f.forEach((k, i) => { o[k] = row[i]; });
        o.addr_norm = normalizeAddress(o.address);
        return o;
      });
    });
    p.catch(() => state.towns.delete(code));
    state.towns.set(code, p);
  }
  return state.towns.get(code);
}

/* ------------------------------------------------------------ address
 * Copied from solutions/prototype/assets/common.js (normalizeAddress and helpers),
 * which mirrors normalize_address() in the prototype build script. Keep in sync. */

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
const _RE_ZHI_ONLY = /(^|\D)之(\d+)號/g;
const _RE_ZHI = /之\d+/g;
const _RE_TOWN = new RegExp('^(' + TOWN_NAMES.join('|') + ')');

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
  let s = String(raw || '').replace(_RE_WS, '');
  s = s.replace(_RE_FULLWIDTH, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0));
  s = s.replace(/台/g, '臺');
  if (s.startsWith('臺北市')) s = s.slice(3);
  return s;
}

function normalizeAddress(raw) {
  let s = cleanPrefix(raw).replace(_RE_TOWN, '');
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

function searchBuildings(records, query, limit = 12) {
  const q = normalizeAddress(query);
  const exact = [];
  const similar = [];
  if (!q) return { exact, similar };
  const qNoHao = q.replace(/號$/, '');
  for (const rec of records) {
    if (rec.addr_norm === q) exact.push(rec);
    else if (similar.length < 200 && (rec.addr_norm.startsWith(qNoHao) || rec.addr_norm.includes(q))) similar.push(rec);
  }
  similar.sort((a, b) => a.addr_norm.localeCompare(b.addr_norm, 'zh-Hant', { numeric: true }));
  return { exact, similar: similar.slice(0, limit) };
}

/* ------------------------------------------------------------ formatting */

function wan(ntd) {
  if (ntd === null || ntd === undefined || Number.isNaN(ntd)) return '—';
  const w = ntd / 1e4;
  if (Math.abs(w) >= 10000) return `${(w / 10000).toFixed(2)} 億元`;
  return `${Math.round(w).toLocaleString('zh-TW')} 萬元`;
}
function wanPerPing(ntd) {
  return ntd ? `${(ntd / 1e4).toFixed(1)} 萬元/坪` : '—';
}
function pct(x) { return `${Math.round(x * 100)}%`; }
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ------------------------------------------------------------ building facts */

function builtYearOf(rec) {
  if (!rec) return null;
  if (rec.built_year) return rec.built_year;
  if (rec.built_year_min && rec.built_year_max) return Math.round((rec.built_year_min + rec.built_year_max) / 2);
  return null;
}

function decadeOf(year) {
  if (!year) return null;
  if (year <= 1974) return 'pre1974';
  if (year <= 1982) return '1974-1981';
  if (year <= 1990) return '1982-1989';
  if (year <= 1999) return '1990-1998';
  if (year <= 2010) return '1999-2009';
  return '2010plus';
}

function typeOf(rec) {
  if (rec.lvr_building_type && RAW_TYPE_TO_GROUP[rec.lvr_building_type]) return RAW_TYPE_TO_GROUP[rec.lvr_building_type];
  const fl = rec.floors;
  if (fl && fl >= 11) return 'tower';
  if (fl && fl >= 6) return 'midrise';
  return 'walkup';
}

const ICONS = {
  calendar: '<path d="M4 6h16v14H4zM4 10h16M8 3v4M16 3v4"/>',
  layers: '<path d="M12 3 2 8l10 5 10-5-10-5zM2 13l10 5 10-5M2 18l10 5 10-5"/>',
  lift: '<path d="M5 3h14v18H5zM12 3v18M8 9l1.5-2L11 9M13 15l1.5 2 1.5-2"/>',
  wall: '<path d="M3 5h18v14H3zM3 10h18M3 14h18M9 5v5M15 10v4M9 14v5"/>',
  people: '<circle cx="8" cy="8" r="3"/><circle cx="16" cy="8" r="3"/><path d="M2 20c0-3 3-5 6-5s6 2 6 5M12 20c0-3 2-5 4-5s6 2 6 5"/>',
  receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6"/>',
  chat: '<path d="M4 5h16v11H9l-5 4z"/>',
  clipboard: '<path d="M8 4h8v3H8zM6 6H5v15h14V6h-1M9 12h6M9 16h4"/>',
  shield: '<path d="M12 3 4 6v6c0 5 4 8 8 9 4-1 8-4 8-9V6z"/><path d="M9 12l2 2 4-4"/>',
  crane: '<path d="M4 21V6h12M4 6l6-3M16 6v5M14 11h4v3h-4zM2 21h10M8 21v-6h4v6"/>',
  hall: '<path d="M3 9 12 4l9 5M5 10v8M9 10v8M15 10v8M19 10v8M3 20h18"/>',
  alert: '<path d="M12 3 2 20h20zM12 10v4M12 17v.5"/>',
  person: '<circle cx="12" cy="6" r="3"/><path d="M12 9v6M9 21l3-6 3 6M8 12h8"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3"/>',
  wave: '<path d="M2 12c3-3 5 3 8 0s5 3 8 0 3-1 4 0M2 17c3-3 5 3 8 0s5 3 8 0 3-1 4 0"/>',
};
const svgIcon = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg>`;
const CARD_ICONS = {
  1: 'chat', 2: 'clipboard', 3: 'shield', 4: 'shield', 5: 'crane', 6: 'crane', 7: 'hall', 8: 'hall',
  9: 'alert', 10: 'lift', 11: 'wall', 12: 'person', 13: 'person', 14: 'person', 15: 'wave', 16: 'wave', 17: 'key',
};

function chip(icon, text, est) {
  return `<span class="chip${est ? ' est' : ''}">${svgIcon(icon)}${text}</span>`;
}

function renderBuilding(rec) {
  const p = state.prices;
  const vname = p.village_names[rec.village_code] || rec.village_code;
  const confirmed = rec.age_source === 'permit' || rec.age_source === 'sea_sand_list';
  let year;
  if (rec.built_year) year = chip('calendar', `${rec.built_year} 年建${confirmed ? '' : '（推估）'}`, !confirmed);
  else if (rec.built_year_min) year = chip('calendar', `${rec.built_year_min}～${rec.built_year_max} 年（鄰棟推估）`, true);
  else year = chip('calendar', '建成年判不出來', true);
  const lift = rec.lvr_has_elevator === false ? chip('lift', '沒有電梯') : rec.lvr_has_elevator === true ? chip('lift', '有電梯') : '';
  $('chips').innerHTML = [
    chip('people', `${esc(vname)}`),
    year,
    rec.floors ? chip('layers', `${rec.floors} 層`) : '',
    lift,
    rec.structure_class ? chip('wall', STRUCTURE_LABELS[rec.structure_class] || '') : '',
    rec.doorplate_units ? chip('people', `約 ${rec.doorplate_units} 戶`) : '',
    chip('receipt', rec.pn ? `近 3 年成交 ${rec.pn} 筆` : '近 3 年少於 2 筆成交'),
  ].join('');
  const flags = [];
  if (rec.sea_sand) {
    flags.push(`<p class="flag"><b>已確認：市府列管海砂屋</b>（${rec.sea_sand === 'rebuild' ? '須拆除重建' : '可加勁補強'}）。清冊原文：${esc(rec.sea_sand_list_address)}，${esc(rec.sea_sand_list_version)} 版。<a href="https://cmo.gov.taipei/cp.aspx?n=4B7B63655A6565E9" target="_blank" rel="noopener">建管處列管頁</a></p>`);
  }
  if (rec.quake_listed) {
    flags.push(`<p class="flag"><b>已確認：${esc(rec.quake_listed)} 地震受損列管（黃單）</b>。清冊原文：${esc(rec.quake_listed_address)}，${esc(rec.quake_listed_version)} 版。列管狀態以建管處為準。</p>`);
  }
  $('flags').innerHTML = flags.join('');
  $('bldg-src').innerHTML = `地址：${esc(p.town_names[rec.town_code] || '')}${esc(rec.address)}。建成年來源：${AGE_SOURCE_LABELS[rec.age_source] || '—'}。資料：逐棟表 data/marts/building_points（使用執照 90～115 年、實價登錄 101S4～115S3）。黃色＝推估，不是官方認定。門牌數（每層一筆）當作戶數的近似。`;
  $('bldg').hidden = false;
  document.querySelector('.steps a[href="#s1"]').classList.add('done');
}

/* ------------------------------------------------------------ unit price ladder */

function beforePrice(rec, type, decade) {
  const p = state.prices;
  const town = rec ? rec.town_code : state.townCode;
  if (rec && rec.pn >= 2 && rec.pp) {
    return { med: rec.pp, n: rec.pn, level: '同棟', note: `這棟近 3 年 ${rec.pn} 筆成交的中位數（最近 ${rec.plt}）`, land: rec.pl, unit: rec.pu };
  }
  const steps = [];
  if (rec) {
    const v = rec.village_code;
    const vn = p.village_names[v] || v;
    steps.push([p.village_type_decade[`${v}|${type}|${decade}`], `同里（${vn}）、同型態、同年代`]);
    steps.push([p.village_type[`${v}|${type}`], `同里（${vn}）、同型態，不分年代`]);
  }
  const tn = p.town_names[town] || town;
  steps.push([p.town_type_decade[`${town}|${type}|${decade}`], `同區（${tn}）、同型態、同年代`]);
  steps.push([p.town_type[`${town}|${type}`], `同區（${tn}）、同型態，不分年代`]);
  steps.push([p.town_all[town], `同區（${tn}）全部老屋`]);
  for (const [s, label] of steps) {
    if (s && s.n >= 5) {
      return { med: s.med, p25: s.p25, p75: s.p75, n: s.n, level: label, note: `${label}近 3 年 ${s.n} 筆成交的中位數`, land: s.land_ping, unit: s.unit_ping };
    }
  }
  return null;
}

function newbuildPrice(town) {
  return state.prices.town_newbuild[town] || null;
}

function pickCards(rec, ctx) {
  const by = builtYearOf(rec);
  const old1999 = !by || by <= 1999;
  const age = by ? TODAY.getFullYear() - by : null;
  const picks = [];
  const add = (order, why) => { if (!picks.some((p) => p.order === order)) picks.push({ order, why }); };
  if (rec && (rec.sea_sand || rec.quake_listed)) {
    add(8, '這棟在市府列管清冊上');
    if (rec.sea_sand) add(9, '這棟是列管海砂屋');
  }
  add(1, '先問清楚自己能走哪條路，不用錢');
  if (rec && rec.sea_sand === 'rebuild') {
    // Listed for demolition: retrofit and lift subsidies do not apply; go straight to rebuild routes.
    add(5, '列管須拆除重建的海砂屋，重建是主要的路');
    add(6, '基地 1,000 m² 以上時');
    add(17, '重建 3～5 年要找地方住');
    if (ctx.elderly) { add(12, '家裡有 65 歲以上的人'); add(13, '低收、中低收長輩'); }
    return picks;
  }
  if (old1999) {
    add(2, by ? `建成 ${by} 年，1999 年底以前申請建照的建物可以做` : '建成年判不出來；1999 年以前的建物可以做');
    add(3, '初評結果需要補強時');
    add(4, '一樓是騎樓、店面等弱層時');
  }
  const noLift = rec ? (rec.lvr_has_elevator === false || (ctx.type === 'walkup')) : ctx.type === 'walkup';
  if (noLift && (!rec || !rec.floors || rec.floors <= 6) && (age === null || age >= 20)) add(10, '6 樓以下、沒有電梯、屋齡 20 年以上');
  add(11, '不拆房子，修外牆、補強、加電梯');
  if (ctx.verdict === 'good') {
    add(5, '試算看起來划算，而且基地小、戶數少時');
    add(6, '基地 1,000 m² 以上');
    add(17, '重建 3～5 年要找地方住');
  }
  if (ctx.elderly) { add(12, '家裡有 65 歲以上的人'); add(13, '低收、中低收長輩'); }
  const laterWhy = ctx.verdict === 'mid' ? '坪數變少但總值較高；要不要重建，可以先問' : '試算不划算，但假設可能和實際不同，仍可以先問';
  if (ctx.verdict !== 'good') [5, 6].forEach((o) => add(o, laterWhy));
  return picks;
}


/* ------------------------------------------------------------ consent */

const ROUTES = [
  { key: 'weilao', label: '危老', pct: 100, need: (n) => n, rule: '全體所有權人', law: '危老條例 §5' },
  { key: 'urgent', label: '都更・迅行劃定', pct: 51, need: (n) => Math.floor(n / 2) + 1, rule: '人數、面積都超過 1/2', law: '都更條例 §37 第 1 項第 2 款第 1 目' },
  { key: 'public', label: '都更・公劃', pct: 76, need: (n) => Math.floor(n * 3 / 4) + 1, rule: '人數、面積都超過 3/4', law: '同條第 2 款第 2 目' },
  { key: 'self', label: '都更・自劃', pct: 81, need: (n) => Math.floor(n * 4 / 5) + 1, rule: '人數、面積都超過 4/5', law: '同條第 3 款' },
  { key: 'r7599', label: '7599', pct: 75, need: (n) => Math.ceil(n * 0.75), rule: '75% 以上有意願（意願門檻，不是法定同意）', law: '臺北市 7599 計畫（113-01-02）' },
];
let routeKey = 'weilao';
const SHARE_CHIPS = [[null, '不知道'], [0.3, '不到一半'], [0.6, '過半'], [0.78, '約 3/4'], [0.85, '8 成以上'], [1, '全部']];

// 100 people = how many in 100 must agree; the meter = the user's own guess against that line.
function drawConsentPicture(r) {
  const K = window.Kit;
  if (!K) return;
  K.people($('people'), r.pct, { color: 'var(--new)', label: `每 100 戶要 ${r.pct} 戶同意` });
  const share = answers.consent_share_est;
  K.meter($('share-meter'), share == null ? 0 : share * 100, r.pct, 100, `門檻 ${r.pct}%`);
  edgeLabel($('share-meter'), r.pct);
}

// Keep a meter's threshold label inside the card when the line sits near either end.
function edgeLabel(el, t) {
  const u = el.querySelector('u');
  if (!u) return;
  u.classList.toggle('end', t > 80);
  u.classList.toggle('start', t < 20);
}

function renderShareChips() {
  $('share-chips').innerHTML = SHARE_CHIPS.map(([v, l], k) =>
    `<label><input type="radio" name="q-consent_share_est" data-k="${k}"${(answers.consent_share_est ?? null) === v ? ' checked' : ''}><span>${l}</span></label>`).join('');
  $('share-chips').querySelectorAll('input').forEach((el) => el.addEventListener('change', () => {
    const v = SHARE_CHIPS[Number(el.dataset.k)][0];
    if (v === null) delete answers.consent_share_est; else answers.consent_share_est = v;
    compute();
  }));
}

function householdEstimate(rec) {
  const siteIn = parseFloat($('site').value);
  if (siteIn > 0) return { n: Math.max(1, Math.round(siteIn / M2_PER_UNIT)), site: siteIn, how: 'site' };
  if (rec && rec.doorplate_units) return { n: rec.doorplate_units, site: rec.doorplate_units * M2_PER_UNIT, how: 'doorplate' };
  return null;
}

function renderConsent(rec) {
  const est = householdEstimate(rec);
  const r = ROUTES.find((x) => x.key === routeKey);
  drawConsentPicture(r);
  if (!est) {
    $('consent-say').innerHTML = `走${r.label}，每 100 戶要 <b>${r.pct} 戶</b>同意。查到地址就算得出你那棟要幾戶。`;
    return;
  }
  const { n, site, how } = est;
  const need = Math.min(n, r.need(n));
  $('consent-say').innerHTML = `<span class="big-n">${need} / ${n} 戶</span>走${r.label}，每 100 戶要 ${r.pct} 戶同意。`;
  const p95 = Math.pow(0.95, n);
  $('consent-src').innerHTML = `
    <p>${how === 'site' ? `戶數＝基地 ${site.toLocaleString('zh-TW')} m² ÷ 每戶土地持分 ${M2_PER_UNIT} m²【推論，G3 用 56,348 筆 1965～1990 年公寓單戶成交校準】。` : `沒填基地面積，只算這一棟：門牌 ${n} 筆當作 ${n} 戶【推估】。重建基地通常不只一棟。`}</p>
    <p>門檻：${ROUTES.map((x) => `${x.label}＝${x.rule}（${x.law}）`).join('；')}【文件：city-workflow/n1-parameters.md 第 15～17、22 列】。</p>
    <p>${site >= 1000 ? '基地估計達 1,000 m²，防災型都更的面積條件可能符合。' : '基地估計不到 1,000 m²，防災型都更要和鄰地合併。'}${site >= 2000 ? '' : '7599 要基地 2,000 m² 以上。'}</p>
    <p>示意：每戶各自 95% 機率同意時，${n} 戶全部同意的機率約 ${pct(p95)}【推論，不是實測】。</p>`;
}

/* ------------------------------------------------------------ next-step cards */

function renderCards(rec, ctx) {
  const all = window.NEXT_STEPS || [];
  const fix = (s) => esc(s).replace(/【待確認】/g, '（請洽窗口確認）');
  $('cards').innerHTML = pickCards(rec, ctx).map(({ order, why }) => {
    const c = all.find((x) => x.order === order);
    if (!c) return '';
    const money = ctx.elderly && c.elderly !== '同左' ? c.elderly : (c.general === '—' ? c.elderly : c.general);
    let soon = '';
    if (c.deadline_date) {
      const days = Math.round((new Date(c.deadline_date) - TODAY) / 86400000);
      if (days >= 0 && days <= 60) soon = '<span class="tag">快截止</span>';
    }
    const link = c.entry_url ? `<a href="${esc(c.entry_url)}" target="_blank" rel="noopener">${fix(c.entry_text)}</a>` : fix(c.entry_text);
    return `<article class="nc">
      <div class="ic">${svgIcon(CARD_ICONS[order])}</div>
      <div><h3>${esc(c.title)}${soon}</h3><p class="money">${fix(money)}</p></div>
      <details><summary class="src">${esc(why)}・看條件</summary>
        <p>${fix(c.what)}</p>
        <p>誰可以申請：${fix(c.who)}</p>
        <p>截止：${fix(c.deadline)}</p>
        <p>去哪裡：${link}</p>
        <p class="src">${esc(c.source)}。資料日期 ${window.NEXT_STEPS_DATA_DATE}，以主管機關公告為準。</p>
      </details>
    </article>`;
  }).join('');
}

/* ------------------------------------------------------------ alternatives decision tree
 * debug-6a's consent-simulator/decision-tree/decision-tree.json, copied to data/ by the build.
 * Reading rules are in that folder's alternatives.md §2: first matching branch wins; collect
 * option_ids, follow next; dedupe, sort by card_order (null last); drop excluded_when
 * matches (a null variable never excludes). Blank data-layer values count as null. */

// Questions shown as big chips. Others go under "更多題目". Number inputs get custom chips.
const MAIN_QS = ['user_goal', 'in_renewal_area', 'can_afford_cost_share'];  // consent_share_est lives in step 4
const MORE_QS = ['can_merge_neighbors', 'seismic_score_r', 'owns_other_home_nnkt', 'has_management_committee',
  'low_income', 'ltc_need_level_2plus', 'suspect_sea_sand', 'heritage_status'];
const NUMBER_CHIPS = {
  consent_share_est: [[0.3, '不到一半'], [0.6, '過半'], [0.78, '約 3/4'], [0.85, '8 成以上'], [1, '全部']],
};
const SHORT_LABELS = {
  user_goal: '你想做什麼？', consent_share_est: '估計幾成鄰居願意？', in_renewal_area: '在劃定的更新地區嗎？',
  can_afford_cost_share: '要自己出的錢，付得起嗎？',
};
const SHORT_VALUES = {
  user_goal: { rebuild: '想重建', retrofit_only: '只補強或修繕', know_risk: '先看風險', unsure: '還不確定' },
  in_renewal_area: { rapid_designated: '迅行劃定', public_designated: '公劃', none: '都不是' },
};
// "unknown" values mean the same as our "不知道" chip (null), so they are not shown twice.
const enumValues = (inp) => inp.values.filter((x) => x.value !== 'unknown');
const answers = {};  // input id -> value chosen by the user (absent = not answered)

function blankToNull(v) {
  return v === undefined || v === '' ? null : v;
}

function treeValues(rec) {
  const tree = state.tree;
  const v = {};
  for (const inp of tree.inputs) {
    let val = null;
    if (rec && inp.source_field) val = blankToNull(rec[inp.source_field]);
    if (inp.id in answers) val = answers[inp.id];
    v[inp.id] = val;
  }
  const site = parseFloat($('site').value);
  if (!('site_area_m2' in answers)) v.site_area_m2 = site > 0 ? site : null;
  if (!('owner_age_65plus' in answers)) v.owner_age_65plus = $('elderly').checked ? true : null;
  return v;
}

function matchWhen(w, val) {
  const has = val !== null && val !== undefined;
  switch (w.op) {
    case 'eq': return has && val === w.value;
    case 'in': return has && (w.values || []).includes(val);
    case 'gt': return has && val > w.value;
    case 'gte': return has && val >= w.value;
    case 'lt': return has && val < w.value;
    case 'lte': return has && val <= w.value;
    case 'is_null': return !has;
    case 'else': return true;
    default: return false;
  }
}

function walkTree(vals) {
  const tree = state.tree;
  const byId = new Map(tree.nodes.map((n) => [n.id, n]));
  const path = [];
  const ids = [];
  let id = tree.nodes[0].id;
  for (let guard = 0; id && guard < 100; guard++) {
    const n = byId.get(id);
    if (!n) break;
    const val = vals[n.input_id] ?? null;
    const b = n.branches.find((x) => matchWhen(x.when, val));
    if (!b) break;
    path.push({ n, b, val });
    (b.option_ids || []).forEach((o) => { if (!ids.includes(o)) ids.push(o); });
    id = b.next;
  }
  const byOpt = new Map(tree.options.map((o) => [o.id, o]));
  const opts = ids.map((i, k) => ({ o: byOpt.get(i), k })).filter((x) => x.o);
  opts.sort((a, b) => (a.o.card_order ?? 999) - (b.o.card_order ?? 999) || a.k - b.k);
  const shown = [];
  const off = [];
  for (const { o } of opts) {
    const hit = (o.excluded_when || []).find((e) => {
      const val = vals[e.input_id];
      return val !== null && val !== undefined && matchWhen(e, val);
    });
    if (hit) off.push({ o, reason: hit.reason }); else shown.push(o);
  }
  return { path, shown, off };
}

const OPTION_ICON_RULES = [
  [/consult|engineer/, 'chat'], [/assessment/, 'clipboard'], [/retrofit|weak_story|soft_story/, 'shield'],
  [/elevator/, 'lift'], [/renovation|maintenance|longevity/, 'wall'], [/sea_sand/, 'alert'],
  [/575|7599|rapid_designation|self_renewal|resolution/, 'hall'], [/weilao|renewal|disaster|art65/, 'crane'],
  [/ltc|elder/, 'person'], [/liquefaction/, 'wave'], [/relocation/, 'key'], [/heritage/, 'hall'],
];
function optionIcon(id) {
  const r = OPTION_ICON_RULES.find(([re]) => re.test(id));
  return r ? r[1] : 'clipboard';
}

function renderQuestions() {
  const tree = state.tree;
  const byId = new Map(tree.inputs.map((i) => [i.id, i]));
  const group = (id) => {
    const inp = byId.get(id);
    if (!inp) return '';
    const label = SHORT_LABELS[id] || inp.label;
    let choices;
    if (NUMBER_CHIPS[id]) choices = NUMBER_CHIPS[id];
    else if (inp.type === 'enum') choices = enumValues(inp).map((x) => [x.value, (SHORT_VALUES[id] || {})[x.value] || x.label]);
    else if (inp.type === 'bool') choices = [[true, '是'], [false, '不是']];
    else {
      return `<div class="q"><div class="ql">${esc(label)}</div><input type="number" data-q="${id}" inputmode="decimal" placeholder="不知道可留空"></div>`;
    }
    const cur = id in answers ? answers[id] : undefined;
    const chips = [[null, '不知道'], ...choices].map(([v, l], k) =>
      `<label><input type="radio" name="q-${id}" data-q="${id}" data-k="${k}"${(cur === undefined && v === null) || cur === v ? ' checked' : ''}><span>${esc(l)}</span></label>`).join('');
    return `<div class="q"><div class="ql">${esc(label)}</div><div class="seg" role="radiogroup" aria-label="${esc(label)}">${chips}</div></div>`;
  };
  $('qs').innerHTML = MAIN_QS.map(group).join('');
  $('qs-more').innerHTML = MORE_QS.map(group).join('');
  const valuesFor = (id) => {
    const inp = byId.get(id);
    if (NUMBER_CHIPS[id]) return [null, ...NUMBER_CHIPS[id].map((c) => c[0])];
    if (inp.type === 'enum') return [null, ...enumValues(inp).map((x) => x.value)];
    return [null, true, false];
  };
  document.querySelectorAll('#qs input, #qs-more input').forEach((el) => {
    const id = el.dataset.q;
    el.addEventListener(el.type === 'number' ? 'input' : 'change', () => {
      let v;
      if (el.type === 'number') v = el.value === '' ? null : parseFloat(el.value);
      else v = valuesFor(id)[Number(el.dataset.k)];
      if (v === null) delete answers[id]; else answers[id] = v;
      compute();
    });
  });
}

function renderAlternatives(rec, ctx) {
  if (!state.tree) { renderCards(rec, ctx); return; }
  const { path, shown, off } = walkTree(treeValues(rec));
  const fix = (s) => (s === null || s === undefined ? '請洽窗口確認' : esc(s).replace(/【待確認】/g, '（請洽窗口確認）'));
  const cardHtml = shown.map((o) => {
    let soon = '';
    if (o.deadline_date) {
      const days = Math.round((new Date(o.deadline_date) - TODAY) / 86400000);
      if (days >= 0 && days <= 60) soon = '<span class="tag">快截止</span>';
    }
    const list = (arr) => (arr && arr.length ? `<ul>${arr.map((x) => `<li>${fix(x)}</li>`).join('')}</ul>` : '');
    return `<article class="nc">
      <div class="ic">${svgIcon(optionIcon(o.id))}</div>
      <div><h3>${esc(o.name)}${soon}</h3><p class="money">${fix(o.amount)}</p></div>
      <details><summary class="src">為什麼適合・看條件</summary>
        ${o.why_fits ? `<p><b>${esc(o.why_fits)}</b></p>` : ''}
        <p>${fix(o.what)}</p>
        <p>誰可以申請：${fix(o.who_can_apply)}</p>
        <p>期限：${fix(o.deadline_or_period)}</p>
        ${list(o.caveats)}${o.pending && o.pending.length ? `<p class="src">請洽窗口確認：${o.pending.map(esc).join('；')}</p>` : ''}
        <p class="src">法源：${o.legal_basis ? esc(o.legal_basis) : '—'}。${esc(o.evidence || '')}出處：${(o.source || []).map((s) => esc(`${s.path} ${s.section}`)).join('；')}</p>
      </details>
    </article>`;
  });
  // Six cards up front; the rest fold away so the page stays short.
  const FIRST = 6;
  $('cards').innerHTML = cardHtml.slice(0, FIRST).join('')
    + (cardHtml.length > FIRST ? `<details class="more"><summary>還有 ${cardHtml.length - FIRST} 條路</summary><div class="cards">${cardHtml.slice(FIRST).join('')}</div></details>` : '');
  $('cards-out-box').hidden = off.length === 0;
  $('cards-out-sum').textContent = `不適用的路（${off.length}）`;
  $('cards-out').innerHTML = off.map(({ o, reason }) => `<p>${esc(o.name)}：${esc(reason)}</p>`).join('');
  $('tree-path-box').hidden = false;
  $('tree-path').innerHTML = path.map(({ n, b, val }) => {
    const ans = b.label || (val === null ? '不知道' : String(val));
    return `<li>${esc(n.question)} → ${esc(ans)}${b.note ? `<br>${esc(b.note)}` : ''}</li>`;
  }).join('');
}

/* ------------------------------------------------------------ formula flow (怎麼算的)
 * One card per step, operators between them. Card inputs mirror the main inputs (data-link):
 * moving one sets the main input and fires its input event, so there is one source of truth. */

const FLOW = [
  { id: 'now', name: '現在的家', link: { id: 'ping', type: 'number', step: 0.1 }, unit: '萬元' },
  { op: '→' },
  { id: 'floor', name: '容積獎勵', link: { id: 'bonus', min: 0, max: 100, step: 1 }, unit: '坪' },
  { op: '×' },
  { id: 'share', name: '扣共同負擔', link: { id: 'burden', min: 15, max: 65, step: 1 }, unit: '坪' },
  { op: '×' },
  { id: 'value', name: '新房每坪', link: { id: 'after', min: 40, max: 250, step: 0.1 }, unit: '萬元' },
  { op: '−' },
  { id: 'relo', name: '中繼期間', link: { id: 'relo-years', min: 1, max: 5, step: 0.1 }, link2: { id: 'relo-rent', min: 0.5, max: 6, step: 0.1 }, unit: '萬元' },
  { op: '=' },
  { id: 'diff', name: '差額', unit: '萬元', result: true },
];

function buildFlow() {
  const input = (l) => (l.type === 'number'
    ? `<input type="number" data-link="${l.id}" step="${l.step}" aria-label="${l.id}">`
    : `<input type="range" data-link="${l.id}" min="${l.min}" max="${l.max}" step="${l.step}" aria-label="${l.id}">`);
  $('flow').innerHTML = FLOW.map((c) => (c.op
    ? `<div class="op" aria-hidden="true">${c.op}</div>`
    : `<div class="fc${c.result ? ' result' : ''}" data-card="${c.id}">
        <div class="pn">${c.name}</div>
        <div class="pv"><span class="num">—</span><small>${c.unit}</small></div>
        <div class="eq"></div>
        ${c.link ? input(c.link) : ''}${c.link2 ? input(c.link2) : ''}
        <div class="ev"></div>
      </div>`)).join('');
  $('flow').querySelectorAll('input[data-link]').forEach((el) => el.addEventListener('input', () => {
    const t = $(el.dataset.link);
    t.value = el.value;
    t.dispatchEvent(new Event('input'));
  }));
}

function renderFlow(x, bp, before, share, afterVal, relo, diff) {
  const box = $('flow');
  if (!box.children.length) buildFlow();
  box.querySelectorAll('input[data-link]').forEach((el) => {
    if (el !== document.activeElement) el.value = $(el.dataset.link).value;
  });
  const floor = x.landMode ? x.land * x.far * (1 + x.bonus) * x.gross : x.ping * (1 + x.bonus);
  const w = (v) => (v === null ? null : v / 1e4);
  const cards = {
    now: [w(before), `${x.ping} 坪 × ${bp ? wanPerPing(bp.med) : '—'}`, bp ? `【推估】${esc(bp.level)} ${bp.n} 筆成交` : '這區資料不夠'],
    floor: [floor, x.landMode ? `持分 ${x.land} × ${pct(x.far)} × (1＋${pct(x.bonus)}) × ${x.gross}` : `${x.ping} 坪 × (1＋${pct(x.bonus)})`, '【文件】防災型都更危險建物獎勵 30%'],
    share: [share, `× (1－${pct(x.burden)})`, $('burden-src').textContent.includes('實測') ? '【實測】都更案實施費用÷總銷售（代理值）' : '【待確認】示意值'],
    value: [w(afterVal), `${share.toFixed(1)} 坪 × ${wanPerPing(x.afterPpp)}`, document.querySelector('input[name="after-src"]:checked').value === 'uro' ? '【實測】都更案核定單價中位數' : '【推估】同區新成屋成交，非該案核定值'],
    relo: [w(relo), x.reloPaid ? '實施者付安置費' : `${x.reloRent} 萬 × 12 × ${x.reloYears.toFixed(1)} 年＋搬家 ${x.reloMove} 萬`, '【推論】房租照附近行情改'],
    diff: [w(diff), '分回價值 － 現在 － 中繼', '這是推估，以實施者計畫書與市府核定為準'],
  };
  for (const [id, [v, eq, ev]] of Object.entries(cards)) {
    const card = box.querySelector(`[data-card="${id}"]`);
    const num = card.querySelector('.num');
    const isPing = id === 'floor' || id === 'share';
    const fmt = (n) => (isPing ? n.toFixed(1) : `${n < 0 ? '－' : id === 'diff' ? '＋' : ''}${Math.round(Math.abs(n)).toLocaleString('zh-TW')}`);
    if (v === null) num.textContent = '—';
    else if (window.Kit) Kit.count(num, v, { fmt, dur: 450 });  // design-kit 9ed35cc: newer call cancels older
    else num.textContent = fmt(v);
    if (id === 'diff') card.querySelector('.pv').className = `pv ${v === null ? '' : v >= 0 ? 'pos' : 'neg'}`;
    card.querySelector('.eq').textContent = eq;
    card.querySelector('.ev').innerHTML = ev;
  }
}

/* ------------------------------------------------------------ drawing helpers */

function bar(label, value, max, cls, text, range, mark) {
  const w = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  const r = range && max > 0
    ? `<span class="range" style="left:${(range[0] / max) * 100}%;width:${((range[1] - range[0]) / max) * 100}%"></span>` : '';
  const m = mark && max > 0 ? `<span class="mark" style="left:${(mark / max) * 100}%" title="打平線"></span>` : '';
  return `<div class="bar"><span class="lab">${label}</span><div class="track"><span class="fill ${cls}" style="width:${w}%"></span>${r}${m}</div><span class="val">${text}</span></div>`;
}

// Bars are re-rendered as strings, so keep the old nodes and only move widths: that is what animates.
function patchBars(id, html) {
  const box = $(id);
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  if (box.children.length !== tmp.children.length) { box.innerHTML = html; return; }
  [...tmp.children].forEach((nu, i) => {
    const old = box.children[i];
    const oldParts = old.querySelectorAll('.fill,.range,.mark');
    const newParts = nu.querySelectorAll('.fill,.range,.mark');
    if (oldParts.length !== newParts.length) { old.replaceWith(nu); return; }
    newParts.forEach((p, j) => { oldParts[j].className = p.className; oldParts[j].setAttribute('style', p.getAttribute('style')); });
    old.querySelector('.val').innerHTML = nu.querySelector('.val').innerHTML;
    old.querySelector('.val').className = nu.querySelector('.val').className;
    old.querySelector('.lab').innerHTML = nu.querySelector('.lab').innerHTML;
  });
}

function diverging(label, value, max, text) {
  const w = max > 0 ? Math.min(50, (Math.abs(value) / max) * 50) : 0;
  const pos = value >= 0;
  const left = pos ? 50 : 50 - w;
  return `<div class="dv"><span class="lab">${label}</span><div class="axis"><span class="fill ${pos ? 'pos' : 'neg'}" style="left:${left}%;width:${w}%"></span></div><span class="val ${pos ? 'pos' : 'neg'}">${text}</span></div>`;
}

function signed(ntd) {
  return `${ntd >= 0 ? '＋' : '－'}${wan(Math.abs(ntd))}`;
}

/* ------------------------------------------------------------ calculation */

function readInputs() {
  return {
    type: $('btype').value,
    decade: $('decade').value,
    ping: parseFloat($('ping').value) || 0,
    bonus: parseInt($('bonus').value, 10) / 100,
    burden: parseInt($('burden').value, 10) / 100,
    afterPpp: parseFloat($('after').value) * 1e4,
    landMode: $('mode-land').checked,
    land: parseFloat($('land').value) || 0,
    far: parseFloat($('far').value),
    gross: parseFloat($('gross').value) || 1.6,
    elderly: $('elderly').checked,
    reloYears: parseFloat($('relo-years').value),
    reloRent: parseFloat($('relo-rent').value),   // 萬元/月
    reloMove: parseFloat($('relo-move').value),   // 萬元, both moves
    reloPaid: $('relo-paid').checked,
  };
}

function sharePingOf(x) {
  return x.landMode
    ? x.land * x.far * (1 + x.bonus) * x.gross * (1 - x.burden)
    : x.ping * (1 + x.bonus) * (1 - x.burden);
}

function compute() {
  const rec = state.rec;
  const x = readInputs();
  $('bonus-out').textContent = pct(x.bonus);
  $('burden-out').textContent = pct(x.burden);
  $('after-out').textContent = wanPerPing(x.afterPpp);
  $('relo-years-out').textContent = `${x.reloYears.toFixed(1)} 年`;
  $('relo-rent-out').textContent = `${x.reloRent.toFixed(1)} 萬元`;
  $('relo-move-out').textContent = `${x.reloMove} 萬元`;

  const bp = beforePrice(rec, x.type, x.decade);
  const before = bp ? bp.med * x.ping : null;
  const share = sharePingOf(x);
  const afterVal = share * x.afterPpp;
  const rentTotal = x.reloRent * 1e4 * 12 * x.reloYears;
  const relo = x.reloPaid ? 0 : rentTotal + x.reloMove * 1e4;
  const diff = before === null ? null : afterVal - before - relo;
  const ratio = x.ping > 0 ? share / x.ping : 0;

  // hero: house area ~ floor area, so scale the side by sqrt
  const maxP = Math.max(x.ping, share, 1);
  const sNow = Math.max(0.2, Math.sqrt(x.ping / maxP));
  const sNew = Math.max(0.2, Math.sqrt(share / maxP));
  $('house-now').style.transform = `scale(${sNow.toFixed(3)})`;
  $('house-new').style.transform = `scale(${sNew.toFixed(3)})`;
  $('h-now-ping').textContent = `${x.ping} 坪`;
  $('h-new-ping').textContent = `${share.toFixed(1)} 坪`;
  $('h-now-val').textContent = before === null ? '—' : `約 ${wan(before)}`;
  $('h-new-val').textContent = `約 ${wan(afterVal)}`;

  let verdict;
  const v = $('verdict');
  if (diff === null) {
    verdict = 'mid';
    v.innerHTML = '<span class="t">這區資料不夠，算不出現在的市價。請換地址或型態。</span>';
  } else {
    verdict = ratio >= 1 && diff > 0 ? 'good' : diff > 0 ? 'mid' : 'bad';
    const say = verdict === 'good' ? '坪數不變少，價值也多。下一步看鄰居同不同意。'
      : verdict === 'mid' ? `價值多，但房子變小（${Math.round(ratio * 100)}%）。`
      : '照這組假設會虧。先看第 5 段不拆房子的路。';
    v.innerHTML = `<span class="big">${signed(diff)}</span><span class="t">${say}</span>`;
  }
  v.className = `verdict ${verdict}`;
  renderAfford(rec, relo);

  // section 3: floor area
  const base = x.landMode ? x.land * x.far * x.gross * (1 - x.burden) : x.ping * (1 - x.burden);
  const beBonus = base > 0 ? x.ping / base - 1 : null;
  const pMax = Math.max(x.ping, share) * 1.08;
  patchBars('ping-bars',
    bar('現在', x.ping, pMax, 'now', `${x.ping} 坪`)
    + bar('分回', share, pMax, 'new', `${share.toFixed(1)} 坪`, null, x.ping));
  if (window.Kit && beBonus !== null) {
    const t = Math.max(0, Math.min(100, beBonus * 100));
    Kit.meter($('bonus-meter'), x.bonus * 100, t, 100, beBonus > 1 ? '打平要超過 100%' : beBonus <= 0 ? '不用獎勵就打平' : `打平 ${pct(beBonus)}`);
    edgeLabel($('bonus-meter'), t);
  }
  const k = Math.round(x.burden * 100);
  const grid = $('burden-grid');
  if (grid.children.length !== 100) grid.innerHTML = Array.from({ length: 100 }, (_, i) => `<span style="--i:${i}"></span>`).join('');
  [...grid.children].forEach((c, i) => c.classList.toggle('burden', i >= 100 - k));
  $('burden-say').innerHTML = `100 坪裡，<b>${k} 坪</b><span class="sw burden" aria-hidden="true"></span>折給建商，${100 - k} 坪<span class="sw share" aria-hidden="true"></span>分回。`;

  // section 3: money
  const range = bp && bp.p25 ? [bp.p25 * x.ping, bp.p75 * x.ping] : null;
  const mMax = Math.max(before || 0, range ? range[1] : 0, afterVal) * 1.05;
  patchBars('money-bars',
    bar('現在', before || 0, mMax, 'now', before === null ? '—' : wan(before), range)
    + bar('分回', afterVal, mMax, 'new', wan(afterVal)));

  // section 3: the flip chart, same household under the two after-price sources
  renderFlip(rec, x, before, share, relo);
  const rMax = Math.max(rentTotal, x.reloMove * 1e4, 1) * 1.05;
  patchBars('relo-bars',
    bar('房租', x.reloPaid ? 0 : rentTotal, rMax, 'now', x.reloPaid ? '實施者付' : wan(rentTotal))
    + bar('搬家', x.reloPaid ? 0 : x.reloMove * 1e4, rMax, 'now', x.reloPaid ? '實施者付' : wan(x.reloMove * 1e4)));
  renderFlow(x, bp, before, share, afterVal, relo, diff);

  $('calc-src').innerHTML = `
    <p>現在的價值＝${x.ping} 坪 × ${bp ? wanPerPing(bp.med) : '—'}。${bp ? esc(bp.note) : ''}${bp && bp.p25 ? `；中間一半 ${wanPerPing(bp.p25)}～${wanPerPing(bp.p75)}` : ''}。實價登錄扣車位、排除親友交易與新成屋【推估，成交 2023-10～${esc(state.meta.trade_date_max)}】。${rec && (rec.sea_sand || rec.quake_listed) && bp && bp.level !== '同棟' ? '<b>這棟在列管清冊上，借用的鄰近行情可能高估它【推論】。</b>' : ''}</p>
    <p>分回坪數＝${x.landMode ? `${x.land} 坪持分 × ${pct(x.far)} × (1＋${pct(x.bonus)}) × ${x.gross} × (1－${pct(x.burden)})` : `${x.ping} 坪 × (1＋${pct(x.bonus)}) × (1－${pct(x.burden)})`}＝${share.toFixed(1)} 坪。${x.landMode ? '' : '這是任務書的粗版公式，假設現在坪數約等於基準容積；老公寓常超過，所以可能高估【推論】。'}</p>
    <p>分回價值＝${share.toFixed(1)} 坪 × ${wanPerPing(x.afterPpp)}。差額沒扣重建 3～5 年的租屋、搬家、稅費與找補。</p>
    <p>「現在」長條上的細線，是同類成交中間一半的範圍；「分回」長條上的直線，是現在的坪數（打平線）。</p>
    <p>「換個新房價格算算看」：同一戶、同樣的獎勵與負擔，只換新房每坪的數字。新成屋多在條件較好的基地，可能偏高；都更案的估價年份較舊。實際的數字要問實施者拿該案的估價。</p>`;

  renderConsent(rec);
  renderAlternatives(rec, { type: x.type, verdict, elderly: x.elderly });
}

/* One line next to the result: the village's average income per tax unit (財政部財政資訊中心,
 * built into prices.json "income"), and the self-pay as years of that income. Self-pay here is
 * the cash the household pays itself during rebuilding (rent + moving); 0 when the implementer pays.
 * Falls back to the district when no building is matched. */
function renderAfford(rec, selfPay) {
  const el = $('afford');
  const inc = state.prices && state.prices.income;
  const town = rec ? rec.town_code : state.townCode;
  const v = inc && rec ? inc.village[rec.village_code] : null;
  const hit = v || (inc ? inc.town[town] : null);
  if (!el || !hit || !(hit.avg > 0)) { if (el) el.hidden = true; return; }
  const where = v ? `這個里（${esc(state.prices.village_names[rec.village_code] || '')}）` : `這個區（${esc(state.prices.town_names[town] || '')}）`;
  let s = `${where}的平均所得約 <b>${Math.round(hit.avg / 1e4).toLocaleString('zh-TW')} 萬元／年</b>`;
  if (selfPay > 0) {
    const y = selfPay / hit.avg;
    s += `，自備款約是 <b>${y < 0.1 ? '不到 0.1' : y.toFixed(1)} 年所得</b>`;
  }
  el.innerHTML = `${s}。<span class="src">【推估】每個納稅單位的平均所得，是平均不是中位數，少數高所得會拉高它。${selfPay > 0 ? `自備款＝重建期間自己付的房租與搬家（${wan(selfPay)}），不含找補與稅費。` : ''}財政部財政資訊中心 ${inc.year} 年度綜稅所得村里統計。</span>`;
  el.hidden = false;
}

function renderFlip(rec, x, before, share, relo) {
  const town = rec ? rec.town_code : state.townCode;
  const nb = newbuildPrice(town);
  const uro = uroFor(town);
  if (before === null || !nb || !uro) {
    $('flip').innerHTML = '';
    $('flip-say').textContent = uro ? '' : '都更案資料還沒產生，跑 build 後會出現。';
    return;
  }
  // Round like the slider (0.1 萬元/坪) so these bars match the hero when that source is active.
  const r10 = (v) => Math.round(v / 1e3) * 1e3;
  const d1 = share * r10(nb.med) - before - relo;
  const d2 = share * r10(uro.res_after) - before - relo;
  const max = Math.max(Math.abs(d1), Math.abs(d2)) * 1.05;
  patchBars('flip',
    diverging(`同區新成屋<br><small>${wanPerPing(nb.med)}</small>`, d1, max, `${signed(d1)} <small>${nb.n} 筆，近 3 年</small>`)
    + diverging(`都更案核定<br><small>${wanPerPing(uro.res_after)}</small>`, d2, max, `${signed(d2)} <small>${esc(uro.scope)} ${uro.n} 案，${uro.year_min}～${uro.year_max} 年估價</small>`));
  $('flip-say').textContent = Math.sign(d1) !== Math.sign(d2)
    ? '只換新房價格，賺就變成虧。'
    : '只換新房價格，差額就差很多。';
}

// debug-e3's renewal review cases (168 專案). District value when it has >= 3 sites, else the city.
function uroFor(town) {
  const u = state.prices.uro_district || {};
  const tn = state.prices.town_names[town] || '';
  if (u[tn] && u[tn].n >= 3 && u[tn].res_after) return { ...u[tn], scope: tn };
  if (u['全市'] && u['全市'].res_after) return { ...u['全市'], scope: '全市' };
  return null;
}

// Burden default: debug-e3's 168 專案 "實施費用 ÷ 總銷售金額" median, district when it has >= 10 sites.
// Until the user moves the slider; after that we never overwrite their value.
function burdenFor(town) {
  const u = state.prices.uro_district || {};
  const tn = state.prices.town_names[town] || '';
  if (u[tn] && u[tn].burden_n >= 10 && u[tn].burden != null) return { ...u[tn], scope: tn };
  if (u['全市'] && u['全市'].burden_n >= 5 && u['全市'].burden != null) return { ...u['全市'], scope: '全市' };
  return null;
}

function setBurdenDefault() {
  const b = burdenFor(state.rec ? state.rec.town_code : state.townCode);
  if (!b) {
    if (!state.burdenTouched) $('burden').value = 40;
    $('burden-src').innerHTML = '預設 40% 是<b>示意值</b>，都更案資料不夠【待確認】。';
    return;
  }
  if (!state.burdenTouched) $('burden').value = Math.round(b.burden * 100);
  $('burden-src').innerHTML = `預設 ${pct(b.burden)}：都更 168 專案${esc(b.scope)} ${b.burden_n} 個基地的「實施費用 ÷ 總銷售金額」中位數，中間一半 ${pct(b.burden_p25)}～${pct(b.burden_p75)}【實測 debug-e3，代理值，不等於核定的共同負擔比例】。你拉過滑桿以後，換地址也不會蓋掉你的值。`;
}

function setAfterDefault() {
  const town = state.rec ? state.rec.town_code : state.townCode;
  const nb = newbuildPrice(town);
  const tn = state.prices.town_names[town] || '';
  const uro = uroFor(town);
  const radio = document.querySelector('input[name="after-src"][value="uro"]');
  radio.disabled = !uro;
  setBurdenDefault();
  if (uro && document.querySelector('input[name="after-src"]:checked').value === 'uro') {
    $('after').value = (uro.res_after / 1e4).toFixed(1);
    $('after-src').innerHTML = `${wanPerPing(uro.res_after)}：都更 168 專案${esc(uro.scope)} ${uro.n} 個基地的「更新後住宅樓層平均單價」中位數，中間一半 ${wanPerPing(uro.res_p25)}～${wanPerPing(uro.res_p75)}【實測 debug-e3，${esc(state.prices.uro_district._source.modified)} 版】。估價年份 ${uro.year_min}～${uro.year_max}（中位 ${uro.price_year}），比現在的行情舊；平台不顯示估價基準日。`;
    return;
  }
  if (nb) {
    $('after').value = (nb.med / 1e4).toFixed(1);
    $('after-src').innerHTML = `${wanPerPing(nb.med)}：<b>以同區新成屋成交推估，非該案核定值</b>。${esc(tn)}近 3 年建成 2 年內成交的電梯華廈與大樓，扣車位後的中位數，${nb.n} 筆【推估】。新成屋多在條件較好的基地，可能偏高。`;
  }
}

function setDefaultsFromPrice() {
  const bp = beforePrice(state.rec, $('btype').value, $('decade').value);
  if (!bp) return;
  if (bp.unit) $('ping').value = bp.unit;
  if (bp.land) $('land').value = bp.land;
}

/* ------------------------------------------------------------ quest bar (design-kit/quest.js)
 * Three steps, each marked done only when the user really did it: an address matched,
 * a slider moved, the results section seen (half in view). The last one throws confetti. */

function questDone(step) {
  if (window.Quest) Quest.done(step);
}

function initQuest() {
  if (!window.Quest) return;
  Quest.init({ page: 'a', role: '住戶', steps: ['找到你家', '調假設', '看結果'] });
  if (!('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) { questDone('看結果'); io.disconnect(); }
  }, { threshold: 0.5 });
  io.observe($('s3'));
}

/* ------------------------------------------------------------ events */

async function onSearch() {
  const raw = $('addr').value.trim();
  const m = cleanPrefix(raw).match(_RE_TOWN);
  if (m) {
    const code = Object.entries(state.prices.town_names).find(([, n]) => n === m[1]);
    if (code) $('town').value = code[0];
  }
  state.townCode = $('town').value;
  const sug = $('suggest');
  sug.hidden = true;
  if (!raw) return;
  setStatus('讀取這一區的門牌…');
  let records;
  try {
    records = await loadTown(state.townCode);
  } catch (err) {
    setStatus(`讀不到門牌資料（${err.message}）。請先跑 scripts/build_calc_data.py。`, true);
    return;
  }
  const { exact, similar } = searchBuildings(records, raw);
  if (!exact.length && state.rec) {
    // Do not keep showing the previous building under a new, unmatched address.
    state.rec = null;
    $('bldg').hidden = true;
    document.querySelector('.steps a[href="#s1"]').classList.remove('done');
    setAfterDefault();
    compute();
  }
  if (exact.length) {
    pickBuilding(exact[0]);
    setStatus('找到了。');
    return;
  }
  if (similar.length) {
    sug.innerHTML = similar.map((r, i) => `<li><button type="button" data-i="${i}">${esc(r.address)}</button></li>`).join('');
    sug.hidden = false;
    sug.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
      pickBuilding(similar[Number(b.dataset.i)]);
      sug.hidden = true;
      setStatus('找到了。');
    }));
    setStatus(`沒有完全一樣的門牌，挑一個相近的：`);
    return;
  }
  setStatus('找不到這個門牌，同一條路可能跨好幾區。先用全區行情算。', true);
}

function pickBuilding(rec) {
  state.rec = rec;
  state.townCode = rec.town_code;
  $('town').value = rec.town_code;
  $('addr').value = rec.address;
  $('btype').value = typeOf(rec);
  const d = decadeOf(builtYearOf(rec));
  if (d) $('decade').value = d;
  renderBuilding(rec);
  questDone('找到你家');
  setDefaultsFromPrice();
  setAfterDefault();
  compute();
  history.replaceState(null, '', `?${new URLSearchParams({ t: rec.town_code, q: rec.address })}`);
}

function setStatus(msg, err) {
  const s = $('status');
  s.textContent = msg;
  s.className = err ? 'status err' : 'status';
}

function renderMethod() {
  const m = state.meta;
  const w = m.old_walkup_pre1990;
  $('method').innerHTML = `
    <ol>
      <li>現在的每坪單價依序找：這棟近 3 年至少 2 筆 → 同里同型態同年代 → 同里同型態 → 同區同型態同年代 → 同區同型態 → 同區全部，每層至少 5 筆。</li>
      <li>實價登錄扣掉車位價與車位面積；排除親友、特殊關係、預售屋、僅車位、具都更效益、毛胚、凶宅、法拍等交易；只留住家用與住商用；排除建成 2 年內成交的新成屋。2023-10-01～${esc(m.trade_date_max)} 共 ${m.sales_recent_old.toLocaleString('zh-TW')} 筆【實測】。</li>
      <li>對照：全市 1990 年以前的公寓 ${w.n.toLocaleString('zh-TW')} 筆，每坪中位數 ${wanPerPing(w.med)}，單戶 ${w.unit_ping} 坪、土地持分 ${w.land_ping} 坪【實測】。</li>
      <li>同意戶數＝基地面積 ÷ 29 m²【實測，data-patterns/g3-consent-threshold.md】。</li>
    </ol>
    <p><b>已知偏誤</b>：實價登錄只有成交過的房子，沒賣過的只能借同里行情。中位數不等於你家。新成屋單價可能偏高；都更案的估價有舊有新。共同負擔用都更案的「實施費用 ÷ 總銷售金額」代理，不等於核定比例。</p>
    <p>資料：實價登錄（內政部 101S4～115S3）、逐棟表 building_points（R1）、都更 168 專案（debug-e3）、下一步卡片（R2b，2026-10-18）。程式：research/issue-06/mvp-variants/renewal-calculator/。</p>`;
  $('foot-data').textContent = `資料產生日 ${m.generated}。實價登錄成交至 ${m.trade_date_max}。這不是估價報告，也不是官方耐震評估。`;
}

function renderRoutes() {
  $('routes').innerHTML = ROUTES.map((r) => `<label><input type="radio" name="route" value="${r.key}"${r.key === routeKey ? ' checked' : ''}><span>${r.label}</span></label>`).join('');
  $('routes').querySelectorAll('input').forEach((i) => i.addEventListener('change', () => { routeKey = i.value; renderConsent(state.rec); }));
}

async function init() {
  try {
    [state.prices, state.meta, state.tree] = await Promise.all([
      loadJSON(`${DATA}prices.json`),
      loadJSON(`${DATA}meta.json`),
      // Optional: without the tree, section 5 falls back to the next-step-card rules.
      loadJSON(`${DATA}decision-tree.json`).catch(() => null),
    ]);
  } catch (err) {
    setStatus(`讀不到資料（${err.message}）。請先跑 scripts/build_calc_data.py，並用 http 伺服器開這頁。`, true);
    return;
  }
  const sel = $('town');
  const codes = Object.keys(state.prices.town_names).sort();
  sel.innerHTML = codes.map((c) => `<option value="${c}">${esc(state.prices.town_names[c])}</option>`).join('');
  sel.value = '63000030';
  state.townCode = sel.value;

  renderRoutes();
  renderShareChips();
  if (state.tree) {
    renderQuestions();
    $('tree-disclaimer').textContent = state.tree.disclaimer;
  } else {
    $('qs').innerHTML = '';
    $('qs-more-box').hidden = true;
  }
  $('go').addEventListener('click', onSearch);
  $('addr').addEventListener('keydown', (e) => { if (e.key === 'Enter') onSearch(); });
  $('town').addEventListener('change', () => {
    state.townCode = $('town').value;
    if (!state.rec || state.rec.town_code !== state.townCode) {
      state.rec = null;
      $('bldg').hidden = true;
      setDefaultsFromPrice();
      setAfterDefault();
      compute();
    }
  });
  document.querySelectorAll('input[name="after-src"]').forEach((r) => r.addEventListener('change', () => { setAfterDefault(); compute(); }));
  for (const id of ['btype', 'decade']) {
    $(id).addEventListener('change', () => { setDefaultsFromPrice(); compute(); });
  }
  for (const id of ['ping', 'bonus', 'burden', 'after', 'mode-land', 'land', 'far', 'gross', 'elderly', 'site',
    'relo-years', 'relo-rent', 'relo-move', 'relo-paid']) {
    $(id).addEventListener('input', compute);
  }
  $('burden').addEventListener('input', () => { state.burdenTouched = true; });
  for (const id of ['bonus', 'burden', 'after']) {
    $(id).addEventListener('input', () => {
      document.querySelector('.steps a[href="#s2"]').classList.add('done');
      questDone('調假設');
    }, { once: true });
  }

  renderMethod();
  initQuest();
  setDefaultsFromPrice();
  setAfterDefault();
  compute();

  const q = new URLSearchParams(location.search);
  if (q.get('t')) $('town').value = q.get('t');
  if (q.get('q')) {
    $('addr').value = q.get('q');
    onSearch();
  }
}

init();

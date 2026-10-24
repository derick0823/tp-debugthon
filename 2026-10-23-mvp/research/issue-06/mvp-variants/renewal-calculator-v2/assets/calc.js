/*
 * calc.js  Renewal calculator v2 ("都更試算機").
 *
 * Key changes from v1 ("我家都更划不划算"):
 * 1. Address is brought in via URL parameters (?addr=... or ?t=...&q=...), with a prominent
 *    required parameter input for floor area (權狀坪數) right at the top.
 * 2. Presents the exciting Trial Calculation Results (試算結果: asset value jump & new home upgrade)
 *    FIRST, followed by the Living Cost Tradeoff (生活代價: construction period rent & moving cost vs gain).
 * 3. Removes non-monetary / discouraging sections (consent household counts, 35 alternative routes,
 *    and the negative flip chart).
 *
 * Shares static data from ../renewal-calculator/data/.
 */

'use strict';

window.__errors = [];
window.addEventListener('error', (e) => window.__errors.push(String(e.message)));
window.addEventListener('unhandledrejection', (e) => window.__errors.push(String(e.reason)));

const DATA = '../renewal-calculator/data/';
const DEFAULT_TOWN = '63000030';
const DEFAULT_ADDR = '信義路2段86巷40號';

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
  townCode: DEFAULT_TOWN,
  burdenTouched: false,
  pingFromUrl: null,
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

/* ------------------------------------------------------------ address */

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
};
const svgIcon = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg>`;

function chip(icon, text, est) {
  return `<span class="chip${est ? ' est' : ''}">${svgIcon(icon)}${text}</span>`;
}

function updateAddressBanner(rec) {
  const p = state.prices;
  const tName = p.town_names[rec ? rec.town_code : state.townCode] || '';
  const addrText = rec ? rec.address : ($('addr').value.trim() || '全區平均行情試算');
  $('addr-display').textContent = `臺北市${tName}${addrText}`;
}

function renderBuilding(rec) {
  const p = state.prices;
  updateAddressBanner(rec);
  const vname = p.village_names[rec.village_code] || rec.village_code;
  const confirmed = rec.age_source === 'permit' || rec.age_source === 'sea_sand_list';
  let year;
  if (rec.built_year) year = chip('calendar', `${rec.built_year} 年建${confirmed ? '' : '（推估）'}`, !confirmed);
  else if (rec.built_year_min) year = chip('calendar', `${rec.built_year_min}～${rec.built_year_max} 年（鄰棟推估）`, true);
  else year = chip('calendar', '建成年判不出來', true);
  const lift = rec.lvr_has_elevator === false ? chip('lift', '現況無電梯') : rec.lvr_has_elevator === true ? chip('lift', '現況有電梯') : '';
  // Note: Omit household count (doorplate_units) since consent info is excluded.
  $('chips').innerHTML = [
    chip('people', `${esc(vname)}`),
    year,
    rec.floors ? chip('layers', `現況 ${rec.floors} 層樓`) : '',
    lift,
    rec.structure_class ? chip('wall', STRUCTURE_LABELS[rec.structure_class] || '') : '',
    chip('receipt', rec.pn ? `同棟近 3 年成交 ${rec.pn} 筆` : '以同里／同區近 3 年實價登錄推估'),
  ].join('');
  const flags = [];
  if (rec.sea_sand) {
    flags.push(`<p class="flag"><b>已確認：市府列管海砂屋</b>（${rec.sea_sand === 'rebuild' ? '須拆除重建，具專案容積獎勵資格' : '可加勁補強'}）。清冊原文：${esc(rec.sea_sand_list_address)}，${esc(rec.sea_sand_list_version)} 版。<a href="https://cmo.gov.taipei/cp.aspx?n=4B7B63655A6565E9" target="_blank" rel="noopener">建管處列管頁</a></p>`);
  }
  if (rec.quake_listed) {
    flags.push(`<p class="flag"><b>已確認：${esc(rec.quake_listed)} 地震受損列管（黃單）</b>。清冊原文：${esc(rec.quake_listed_address)}，${esc(rec.quake_listed_version)} 版。</p>`);
  }
  $('flags').innerHTML = flags.join('');
  $('bldg-src').innerHTML = `地址：臺北市${esc(p.town_names[rec.town_code] || '')}${esc(rec.address)}。建成年來源：${AGE_SOURCE_LABELS[rec.age_source] || '—'}。資料：逐棟表 data/marts/building_points（使用執照 90～115 年、實價登錄 101S4～115S3）。黃色標籤＝推估。`;
  $('bldg').hidden = false;
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

function edgeLabel(el, t) {
  const u = el.querySelector('u');
  if (!u) return;
  u.classList.toggle('end', t > 80);
  u.classList.toggle('start', t < 20);
}

/* ------------------------------------------------------------ formula flow (怎麼算的) */

const FLOW = [
  { id: 'now', name: '現在的老家', link: { id: 'ping', type: 'number', step: 0.1 }, unit: '萬元' },
  { op: '→' },
  { id: 'floor', name: '容積獎勵後', link: { id: 'bonus', min: 0, max: 100, step: 1 }, unit: '坪' },
  { op: '×' },
  { id: 'share', name: '扣共同負擔分回', link: { id: 'burden', min: 15, max: 65, step: 1 }, unit: '坪' },
  { op: '×' },
  { id: 'value', name: '新房總價值', link: { id: 'after', min: 40, max: 250, step: 0.1 }, unit: '萬元' },
  { op: '−' },
  { id: 'relo', name: '過渡期生活代價', link: { id: 'relo-years', min: 1, max: 5, step: 0.1 }, link2: { id: 'relo-rent', min: 0.5, max: 6, step: 0.1 }, unit: '萬元' },
  { op: '=' },
  { id: 'diff', name: '最終淨增值', unit: '萬元', result: true },
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

function renderFlow(x, bp, before, share, afterVal, relo, netDiff) {
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
    share: [share, `× (1－${pct(x.burden)})`, $('burden-src').textContent.includes('實測') ? '【實測】都更案實施費用÷總銷售' : '【待確認】示意值'],
    value: [w(afterVal), `${share.toFixed(1)} 坪 × ${wanPerPing(x.afterPpp)}`, document.querySelector('input[name="after-src"]:checked').value === 'uro' ? '【實測】都更案核定單價中位數' : '【推估】同區新成屋成交中位數'],
    relo: [w(relo), x.reloPaid ? '實施者補貼安置費（0 元）' : `${x.reloRent} 萬 × 12 × ${x.reloYears.toFixed(1)} 年＋搬家 ${x.reloMove} 萬`, '【推論】可依附近租屋行情調整'],
    diff: [w(netDiff), '新房總價值 － 現在市價 － 生活代價', '公開資料推估，以實施者計畫書為準'],
  };
  for (const [id, [v, eq, ev]] of Object.entries(cards)) {
    const card = box.querySelector(`[data-card="${id}"]`);
    const num = card.querySelector('.num');
    const isPing = id === 'floor' || id === 'share';
    const fmt = (n) => (isPing ? n.toFixed(1) : `${n < 0 ? '－' : id === 'diff' ? '＋' : ''}${Math.round(Math.abs(n)).toLocaleString('zh-TW')}`);
    if (v === null) num.textContent = '—';
    else if (window.Kit) Kit.count(num, v, { fmt, dur: 450 });
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
  const m = mark && max > 0 ? `<span class="mark" style="left:${(mark / max) * 100}%" title="原坪數打平線"></span>` : '';
  return `<div class="bar"><span class="lab">${label}</span><div class="track"><span class="fill ${cls}" style="width:${w}%"></span>${r}${m}</div><span class="val">${text}</span></div>`;
}

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

function syncQuickPingButtons(ping) {
  document.querySelectorAll('.ping-quick button').forEach((b) => {
    b.classList.toggle('active', Math.abs(parseFloat(b.dataset.ping) - ping) < 0.05);
  });
}

function compute() {
  const rec = state.rec;
  const x = readInputs();
  syncQuickPingButtons(x.ping);

  $('bonus-out').textContent = pct(x.bonus);
  $('burden-out').textContent = pct(x.burden);
  $('after-out').textContent = wanPerPing(x.afterPpp);
  $('relo-years-out').textContent = `${x.reloYears.toFixed(1)} 年`;
  $('relo-rent-out').textContent = `${x.reloRent.toFixed(1)} 萬元／月`;
  $('relo-move-out').textContent = `${x.reloMove} 萬元`;

  const bp = beforePrice(rec, x.type, x.decade);
  const before = bp ? bp.med * x.ping : null;
  const share = sharePingOf(x);
  const afterVal = share * x.afterPpp;

  // Stage 1: Gross asset value gain (before temporary relocation living cost)
  const grossDiff = before === null ? null : afterVal - before;

  // Stage 2: Living cost during construction
  const rentTotal = x.reloRent * 1e4 * 12 * x.reloYears;
  const moveTotal = x.reloMove * 1e4;
  const relo = x.reloPaid ? 0 : rentTotal + moveTotal;
  const netDiff = grossDiff === null ? null : grossDiff - relo;
  const ratio = x.ping > 0 ? share / x.ping : 0;

  // Hero SVG houses scaling
  const maxP = Math.max(x.ping, share, 1);
  const sNow = Math.max(0.2, Math.sqrt(x.ping / maxP));
  const sNew = Math.max(0.2, Math.sqrt(share / maxP));
  $('house-now').style.transform = `scale(${sNow.toFixed(3)})`;
  $('house-new').style.transform = `scale(${sNew.toFixed(3)})`;
  $('h-now-val').textContent = before === null ? '—' : `約 ${wan(before)}`;
  $('h-new-val').textContent = `約 ${wan(afterVal)}`;
  $('h-now-ping').textContent = `權狀 ${x.ping} 坪（單價約 ${bp ? wanPerPing(bp.med) : '—'}）`;
  $('h-new-ping').textContent = `分回約 ${share.toFixed(1)} 坪（新成屋約 ${wanPerPing(x.afterPpp)}）`;

  // Section 1 Verdict: Positive & Exciting framing whenever grossDiff > 0
  const v = $('verdict');
  if (grossDiff === null) {
    v.className = 'verdict mid';
    v.innerHTML = '<span class="t">這區資料不夠，算不出現在的市價。請換個地址或調整建物型態。</span>';
  } else if (grossDiff > 0) {
    v.className = 'verdict good';
    const pingNote = ratio >= 1
      ? `不僅換住全新電梯耐震大樓，分回權狀坪數更達 <b>${share.toFixed(1)} 坪</b>（比原本還多！），房屋總身價直接從 ${wan(before)} 躍升至 ${wan(afterVal)}。`
      : `老屋升級全新電梯耐震宅！分回權狀約 <b>${share.toFixed(1)} 坪</b>（原坪數的 ${Math.round(ratio * 100)}%），因新房單價躍升至 ${wanPerPing(x.afterPpp)}，房屋總身價從 ${wan(before)} 大幅增值至 ${wan(afterVal)}！`;
    v.innerHTML = `
      <div class="verdict-head">
        <span class="tag-label">🎉 都更後房屋身價預計增值</span>
        <span class="big">${signed(grossDiff)}</span>
      </div>
      <span class="t">${pingNote}</span>`;
  } else {
    v.className = 'verdict mid';
    v.innerHTML = `
      <div class="verdict-head">
        <span class="tag-label">預估帳面價值差額</span>
        <span class="big">${signed(grossDiff)}</span>
      </div>
      <span class="t">在目前保守假設下帳面尚未打平。許多老公寓土地持分高，建議展開下方「⚙️ 展開微調進階參數」勾選<b>改用土地持分算</b>或調高容積獎勵試算看看！</span>`;
  }

  // Section 1 Bars: Value first, then Ping
  const range = bp && bp.p25 ? [bp.p25 * x.ping, bp.p75 * x.ping] : null;
  const mMax = Math.max(before || 0, range ? range[1] : 0, afterVal) * 1.05;
  patchBars('money-bars',
    bar('現在市價', before || 0, mMax, 'now', before === null ? '—' : `${wan(before)} <small>（每坪 ${bp ? wanPerPing(bp.med) : '—'}）</small>`, range)
    + bar('更新後', afterVal, mMax, 'gain', `${wan(afterVal)} <small>（每坪 ${wanPerPing(x.afterPpp)}）</small>`));

  const base = x.landMode ? x.land * x.far * x.gross * (1 - x.burden) : x.ping * (1 - x.burden);
  const beBonus = base > 0 ? x.ping / base - 1 : null;
  const pMax = Math.max(x.ping, share) * 1.08;
  patchBars('ping-bars',
    bar('現在坪數', x.ping, pMax, 'now', `${x.ping} 坪`)
    + bar('分回新房', share, pMax, 'new', `${share.toFixed(1)} 坪 <small>（約原坪數 ${Math.round(ratio * 100)}%）</small>`, null, x.ping));

  if (window.Kit && beBonus !== null) {
    const t = Math.max(0, Math.min(100, beBonus * 100));
    Kit.meter($('bonus-meter'), x.bonus * 100, t, 100, beBonus > 1 ? '打平要超過 100%' : beBonus <= 0 ? '不用獎勵就打平' : `坪數打平門檻 ${pct(beBonus)}`);
    edgeLabel($('bonus-meter'), t);
  }
  const k = Math.round(x.burden * 100);
  const grid = $('burden-grid');
  if (grid.children.length !== 100) grid.innerHTML = Array.from({ length: 100 }, (_, i) => `<span style="--i:${i}"></span>`).join('');
  [...grid.children].forEach((c, i) => c.classList.toggle('burden', i >= 100 - k));
  $('burden-say').innerHTML = `100 坪裡，<b>${k} 坪</b><span class="sw burden" aria-hidden="true"></span>折抵工程費給實施者，<b>${100 - k} 坪</b><span class="sw share" aria-hidden="true"></span>由住戶分回。`;

  // Section 2: Living Cost Tradeoff (生活代價)
  const cmpMax = Math.max(relo, Math.max(0, grossDiff || 0), 1) * 1.05;
  patchBars('relo-compare-bars',
    bar('生活代價', relo, cmpMax, 'now', x.reloPaid ? '0 萬元 <small>（實施者補貼拆遷安置費）</small>' : `${wan(relo)} <small>（${x.reloYears.toFixed(1)} 年房租＋搬家）</small>`)
    + bar('資產增值', Math.max(0, grossDiff || 0), cmpMax, 'gain', grossDiff === null ? '—' : `${signed(grossDiff)} <small>（更新前後房屋差價）</small>`));

  const netBox = $('relo-net-box');
  if (netDiff === null) {
    netBox.className = 'relo-net-box';
    $('net-val').textContent = '—';
    $('net-sub').textContent = '';
  } else {
    netBox.className = `relo-net-box${netDiff >= 0 ? '' : ' neg'}`;
    $('net-val').textContent = signed(netDiff);
    if (x.reloPaid && netDiff > 0) {
      $('net-sub').innerHTML = `實施者補貼拆遷安置費，過渡期免自掏房租與搬家費，<b>完整淨享 ${wan(netDiff)} 身價成長與全新電梯好宅！</b>`;
    } else if (netDiff > 0) {
      $('net-sub').innerHTML = `短暫搬出去住 ${x.reloYears.toFixed(1)} 年、付出約 ${wan(relo)} 的生活代價，就能換取 ${wan(grossDiff)} 的房價躍升，<b>扣除生活代價後依然淨賺 ${wan(netDiff)}！</b>`;
    } else {
      $('net-sub').innerHTML = `扣除 ${x.reloYears.toFixed(1)} 年過渡期生活代價 ${wan(relo)} 後的淨差額。若都更案由實施者補貼拆遷安置費（勾選下方選項），即可省下這筆過渡期開銷。`;
    }
  }

  const rMax = Math.max(rentTotal, moveTotal, 1) * 1.05;
  patchBars('relo-bars',
    bar('期間房租', x.reloPaid ? 0 : rentTotal, rMax, 'now', x.reloPaid ? '實施者補貼（0 元）' : `${wan(rentTotal)} <small>（每月 ${x.reloRent.toFixed(1)} 萬 × ${Math.round(x.reloYears * 12)} 個月）</small>`)
    + bar('搬家安頓', x.reloPaid ? 0 : moveTotal, rMax, 'now', x.reloPaid ? '實施者補貼（0 元）' : `${wan(moveTotal)} <small>（搬出＋搬回兩趟）</small>`));

  renderAfford(rec, relo);
  renderFlow(x, bp, before, share, afterVal, relo, netDiff);

  $('calc-src').innerHTML = `
    <p>更新前價值＝${x.ping} 坪 × ${bp ? wanPerPing(bp.med) : '—'}。${bp ? esc(bp.note) : ''}${bp && bp.p25 ? `；中間一半 ${wanPerPing(bp.p25)}～${wanPerPing(bp.p75)}` : ''}。實價登錄扣車位、排除親友交易與新成屋【推估，成交 2023-10～${esc(state.meta.trade_date_max)}】。${rec && (rec.sea_sand || rec.quake_listed) && bp && bp.level !== '同棟' ? '<b>這棟在列管清冊上，借用的鄰近行情可能高估更新前市價【推論】。</b>' : ''}</p>
    <p>分回坪數＝${x.landMode ? `${x.land} 坪持分 × ${pct(x.far)} × (1＋${pct(x.bonus)}) × ${x.gross} × (1－${pct(x.burden)})` : `${x.ping} 坪 × (1＋${pct(x.bonus)}) × (1－${pct(x.burden)})`}＝${share.toFixed(1)} 坪。${x.landMode ? '' : '簡單算法假設現在坪數約等於基準容積；可於進階設定切換為土地持分算法。'}</p>
    <p>更新後價值＝${share.toFixed(1)} 坪 × ${wanPerPing(x.afterPpp)}＝${wan(afterVal)}。第 1 節先呈現未扣過渡期租屋與搬家費的房屋身價增值（${grossDiff === null ? '—' : signed(grossDiff)}），第 2 節再扣除施工期間生活代價（${wan(relo)}），得出最終淨收穫（${netDiff === null ? '—' : signed(netDiff)}）。</p>`;
}

function renderAfford(rec, selfPay) {
  const el = $('afford');
  const inc = state.prices && state.prices.income;
  const town = rec ? rec.town_code : state.townCode;
  const v = inc && rec ? inc.village[rec.village_code] : null;
  const hit = v || (inc ? inc.town[town] : null);
  if (!el || !hit || !(hit.avg > 0)) { if (el) el.hidden = true; return; }
  const where = v ? `這個里（${esc(state.prices.village_names[rec.village_code] || '')}）` : `這個區（${esc(state.prices.town_names[town] || '')}）`;
  let s = `📊 <b>地方負擔力參考</b>：${where}的平均家庭所得約 <b>${Math.round(hit.avg / 1e4).toLocaleString('zh-TW')} 萬元／年</b>`;
  if (selfPay > 0) {
    const y = selfPay / hit.avg;
    s += `，施工過渡期自備生活費（${wan(selfPay)}）約相當於 <b>${y < 0.1 ? '不到 0.1' : y.toFixed(1)} 年所得</b>`;
  } else {
    s += `；勾選實施者補貼拆遷安置費時，施工期自備生活費為 <b>0 元</b>`;
  }
  el.innerHTML = `${s}。<span class="src">【推估】財政部財政資訊中心 ${inc.year} 年度綜稅所得村里統計（每納稅單位平均所得）。</span>`;
  el.hidden = false;
}

function uroFor(town) {
  const u = state.prices.uro_district || {};
  const tn = state.prices.town_names[town] || '';
  if (u[tn] && u[tn].n >= 3 && u[tn].res_after) return { ...u[tn], scope: tn };
  if (u['全市'] && u['全市'].res_after) return { ...u['全市'], scope: '全市' };
  return null;
}

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
  $('burden-src').innerHTML = `預設 ${pct(b.burden)}：都更 168 專案${esc(b.scope)} ${b.burden_n} 個基地的「實施費用 ÷ 總銷售金額」中位數（中間一半 ${pct(b.burden_p25)}～${pct(b.burden_p75)}）【實測 debug-e3】。`;
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
    $('after-src').innerHTML = `${wanPerPing(uro.res_after)}：都更 168 專案${esc(uro.scope)} ${uro.n} 個基地「更新後住宅樓層平均單價」中位數（估價年份 ${uro.year_min}～${uro.year_max}，較現在行情保守）。`;
    return;
  }
  if (nb) {
    $('after').value = (nb.med / 1e4).toFixed(1);
    $('after-src').innerHTML = `${wanPerPing(nb.med)}：<b>以${esc(tn)}近 3 年新成屋成交中位數推估</b>（建成 2 年內電梯華廈與大樓，扣車位後共 ${nb.n} 筆）。`;
  }
}

function setDefaultsFromPrice(keepUserPing = false) {
  const bp = beforePrice(state.rec, $('btype').value, $('decade').value);
  if (!bp) return;
  if (!keepUserPing && bp.unit) {
    $('ping').value = bp.unit;
    $('ping-hint').textContent = `已自動帶入${state.rec && state.rec.pn >= 2 ? '這棟' : '同里同型態'}成交中位數 ${bp.unit} 坪，可直接修改`;
  }
  if (bp.land) $('land').value = bp.land;
}

/* ------------------------------------------------------------ quest bar */

function questDone(step) {
  if (window.Quest) Quest.done(step);
}

function initQuest() {
  if (!window.Quest) return;
  Quest.init({ page: 'a2', role: '住戶', steps: ['確認地址與坪數', '看身價增值', '評估生活代價'] });
  if (!('IntersectionObserver' in window)) return;
  const io1 = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) { questDone('看身價增值'); io1.disconnect(); }
  }, { threshold: 0.4 });
  io1.observe($('s-result'));
  const io2 = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) { questDone('評估生活代價'); io2.disconnect(); }
  }, { threshold: 0.4 });
  io2.observe($('s-cost'));
}

/* ------------------------------------------------------------ events & URL params */

function detectTownFromRawAddress(raw) {
  const cleaned = cleanPrefix(raw);
  const m = cleaned.match(_RE_TOWN);
  if (m) {
    const found = Object.entries(state.prices.town_names).find(([, n]) => n === m[1]);
    if (found) return found[0];
  }
  return null;
}

async function onSearch(keepUrlPing = false) {
  const raw = $('addr').value.trim();
  const detectedCode = detectTownFromRawAddress(raw);
  if (detectedCode) {
    $('town').value = detectedCode;
  }
  state.townCode = $('town').value;
  const sug = $('suggest');
  sug.hidden = true;
  if (!raw) {
    updateAddressBanner(null);
    return;
  }
  setStatus('正在比對門牌與實價資料…');
  let records;
  try {
    records = await loadTown(state.townCode);
  } catch (err) {
    setStatus(`讀不到門牌資料（${err.message}）。`, true);
    return;
  }
  const { exact, similar } = searchBuildings(records, raw);
  if (!exact.length && state.rec) {
    state.rec = null;
    $('bldg').hidden = true;
    updateAddressBanner(null);
    setAfterDefault();
    compute();
  }
  if (exact.length) {
    pickBuilding(exact[0], keepUrlPing);
    setStatus('已套用門牌資料。');
    $('addr-drawer').hidden = true;
    $('toggle-addr').setAttribute('aria-expanded', 'false');
    $('toggle-addr').textContent = '換個地址';
    return;
  }
  if (similar.length) {
    $('addr-drawer').hidden = false;
    $('toggle-addr').setAttribute('aria-expanded', 'true');
    $('toggle-addr').textContent = '收起地址搜尋';
    sug.innerHTML = similar.map((r, i) => `<li><button type="button" data-i="${i}">${esc(r.address)}</button></li>`).join('');
    sug.hidden = false;
    sug.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
      pickBuilding(similar[Number(b.dataset.i)], keepUrlPing);
      sug.hidden = true;
      setStatus('已套用門牌資料。');
      $('addr-drawer').hidden = true;
      $('toggle-addr').setAttribute('aria-expanded', 'false');
      $('toggle-addr').textContent = '換個地址';
    }));
    setStatus('沒有完全相同的門牌，請點選相近門牌：');
    return;
  }
  updateAddressBanner(null);
  setStatus('找不到完全相符的門牌，目前先以本區行情試算。', true);
}

function syncUrlState() {
  const tName = state.prices.town_names[state.townCode] || '';
  const addrStr = state.rec ? state.rec.address : $('addr').value.trim();
  const params = new URLSearchParams();
  if (addrStr) {
    params.set('addr', `${tName}${addrStr}`);
    params.set('t', state.townCode);
    params.set('q', addrStr);
  }
  if ($('ping').value) {
    params.set('ping', $('ping').value);
  }
  history.replaceState(null, '', `?${params.toString()}`);
}

function pickBuilding(rec, keepUrlPing = false) {
  state.rec = rec;
  state.townCode = rec.town_code;
  $('town').value = rec.town_code;
  $('addr').value = rec.address;
  $('btype').value = typeOf(rec);
  const d = decadeOf(builtYearOf(rec));
  if (d) $('decade').value = d;
  renderBuilding(rec);
  questDone('確認地址與坪數');
  setDefaultsFromPrice(keepUrlPing);
  if (keepUrlPing && state.pingFromUrl) {
    $('ping').value = state.pingFromUrl;
    $('ping-hint').textContent = `已帶入網址指定的 ${state.pingFromUrl} 坪，可直接修改`;
  }
  setAfterDefault();
  compute();
  syncUrlState();
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
      <li>更新前每坪單價依序找：同棟近 3 年至少 2 筆 → 同里同型態同年代 → 同里同型態 → 同區同型態同年代 → 同區同型態 → 同區全部老屋，每層至少 5 筆。</li>
      <li>實價登錄扣掉車位價與車位面積；排除親友、特殊關係、預售屋、僅車位、具都更效益、毛胚、凶宅、法拍等交易；只留住家用與住商用；排除建成 2 年內成交的新成屋。2023-10-01～${esc(m.trade_date_max)} 共 ${m.sales_recent_old.toLocaleString('zh-TW')} 筆【實測】。</li>
      <li>全市 1990 年以前無電梯公寓共 ${w.n.toLocaleString('zh-TW')} 筆成交，每坪中位數 ${wanPerPing(w.med)}，單戶權狀中位數 ${w.unit_ping} 坪、土地持分中位數 ${w.land_ping} 坪【實測】。</li>
      <li>共同負擔比例預設採用都更 168 專案各區基地「實施費用 ÷ 總銷售金額」中位數；更新後單價預設採用同區近 3 年新成屋成交中位數（可於進階設定切換為都更案核定單價）。</li>
    </ol>
    <p><b>已知限制</b>：實價登錄僅涵蓋有成交紀錄的房屋，未成交者借用同里或同區行情；新成屋單價受基地條件影響可能較高；試算未計入契稅、土增稅與個別選配找補。</p>`;
  $('foot-data').textContent = `資料產生日 ${m.generated}。實價登錄成交統計至 ${m.trade_date_max}。本工具為市政黑客松設計原型，非正式不動產估價報告。`;
}

async function init() {
  try {
    [state.prices, state.meta] = await Promise.all([
      loadJSON(`${DATA}prices.json`),
      loadJSON(`${DATA}meta.json`),
    ]);
  } catch (err) {
    setStatus(`讀不到資料（${err.message}）。請確認以 HTTP 伺服器開啟本頁。`, true);
    return;
  }

  const sel = $('town');
  const codes = Object.keys(state.prices.town_names).sort();
  sel.innerHTML = codes.map((c) => `<option value="${c}">${esc(state.prices.town_names[c])}</option>`).join('');
  sel.value = DEFAULT_TOWN;
  state.townCode = sel.value;

  // Toggle address drawer
  $('toggle-addr').addEventListener('click', () => {
    const drawer = $('addr-drawer');
    const willOpen = drawer.hidden;
    drawer.hidden = !willOpen;
    $('toggle-addr').setAttribute('aria-expanded', String(willOpen));
    $('toggle-addr').textContent = willOpen ? '收起地址搜尋' : '換個地址';
    if (willOpen) $('addr').focus();
  });

  $('go').addEventListener('click', () => onSearch(false));
  $('addr').addEventListener('keydown', (e) => { if (e.key === 'Enter') onSearch(false); });
  $('town').addEventListener('change', () => {
    state.townCode = $('town').value;
    if (!state.rec || state.rec.town_code !== state.townCode) {
      state.rec = null;
      $('bldg').hidden = true;
      updateAddressBanner(null);
      setDefaultsFromPrice(false);
      setAfterDefault();
      compute();
    }
  });

  // Quick ping buttons
  document.querySelectorAll('.ping-quick button').forEach((btn) => {
    btn.addEventListener('click', () => {
      $('ping').value = btn.dataset.ping;
      $('ping-hint').textContent = `已手動選擇 ${btn.dataset.ping} 坪`;
      questDone('確認地址與坪數');
      compute();
      syncUrlState();
    });
  });

  $('ping').addEventListener('input', () => {
    $('ping-hint').textContent = '已依你輸入的權狀坪數即時重算';
    questDone('確認地址與坪數');
    compute();
    syncUrlState();
  });

  document.querySelectorAll('input[name="after-src"]').forEach((r) => r.addEventListener('change', () => { setAfterDefault(); compute(); }));
  for (const id of ['btype', 'decade']) {
    $(id).addEventListener('change', () => { setDefaultsFromPrice(true); compute(); });
  }
  for (const id of ['bonus', 'burden', 'after', 'mode-land', 'land', 'far', 'gross',
    'relo-years', 'relo-rent', 'relo-move', 'relo-paid']) {
    $(id).addEventListener('input', compute);
  }
  $('burden').addEventListener('input', () => { state.burdenTouched = true; });

  renderMethod();
  initQuest();
  setDefaultsFromPrice(false);
  setAfterDefault();
  compute();

  // Parse URL parameters (?addr= or ?address= or ?t=&q=, plus optional ?ping=)
  const q = new URLSearchParams(location.search);
  const urlPing = parseFloat(q.get('ping'));
  if (urlPing > 0) {
    state.pingFromUrl = urlPing;
    $('ping').value = urlPing;
  }

  const rawAddrParam = q.get('addr') || q.get('address') || q.get('q');
  const rawTownParam = q.get('t');

  if (rawTownParam && state.prices.town_names[rawTownParam]) {
    $('town').value = rawTownParam;
    state.townCode = rawTownParam;
  }
  if (rawAddrParam) {
    const detectedTown = detectTownFromRawAddress(rawAddrParam);
    if (detectedTown && !rawTownParam) {
      $('town').value = detectedTown;
      state.townCode = detectedTown;
    }
    const strippedAddr = cleanPrefix(rawAddrParam).replace(_RE_TOWN, '');
    $('addr').value = strippedAddr || rawAddrParam;
    await onSearch(Boolean(state.pingFromUrl));
  } else {
    // Default showcase address when entering without URL params
    $('town').value = DEFAULT_TOWN;
    state.townCode = DEFAULT_TOWN;
    $('addr').value = DEFAULT_ADDR;
    await onSearch(Boolean(state.pingFromUrl));
  }
}

init();

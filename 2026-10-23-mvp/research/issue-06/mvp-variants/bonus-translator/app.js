// Bonus blocks + citizen village brief. Static, no dependencies.
// Data: bonus-items.csv, data/cases.json, data/villages.json (this folder).
// Fallback for villages: data/marts/*.csv when the server root is the repo root.
"use strict";

const MARTS = "../../../../data/marts/";
const SVGNS = "http://www.w3.org/2000/svg";

// One colour per leaf item, so stacked blocks stay distinct.
const COLOR = {
  "ΔF1": "#8c6d46", "ΔF2": "#a98b5f", "ΔF3": "#3f7cac",
  "ΔF4": "#5d9a48", "ΔF4-1": "#4f8f3a", "ΔF4-2": "#76ad55", "ΔF4-3": "#9cc47c",
  "ΔF5": "#d4892f", "ΔF5-1": "#d4892f", "ΔF5-2": "#e6b04f", "ΔF5-3": "#b0611f",
  "ΔF5-4": "#8a4f1c", "ΔF5-5": "#efc27a", "ΔF5-6": "#2f9a8a", "ΔF5-7": "#c9a227",
  "ΔF6": "#8e5a9c",
};
const OLD_TREE = [
  ["ΔF1", []], ["ΔF2", []], ["ΔF3", []],
  ["ΔF4", ["ΔF4-1", "ΔF4-2", "ΔF4-3"]],
  ["ΔF5", ["ΔF5-1", "ΔF5-2", "ΔF5-3", "ΔF5-4", "ΔF5-5", "ΔF5-6", "ΔF5-7"]],
  ["ΔF6", []],
];

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt = (n, d = 0) => (n == null || isNaN(n) ? "—" : Number(n).toLocaleString("zh-TW", { minimumFractionDigits: d, maximumFractionDigits: d }));
const pct = (x, d = 1) => (x == null || isNaN(x) ? "—" : (x * 100).toFixed(d) + "%");
const near = (a, b, tol = 0.0006) => Math.abs(a - b) <= tol;
const N = (x) => (x === "" || x == null ? null : Number(x));
const isTrue = (x) => x === true || String(x).toLowerCase() === "true";
// Quest bar from design-kit/quest.js (optional: the page works without it).
const questDone = (step) => { if (window.Quest) Quest.done(step); };
let taps = 0;
function tapBlock(code) { showInfo(code); if (++taps === 3) questDone("點 3 塊積木"); }
// Run fn after the next paint; the timeout covers background tabs and headless runs
// where animation frames may not fire. fn must be safe to run twice.
const afterPaint = (fn) => { requestAnimationFrame(() => requestAnimationFrame(fn)); setTimeout(fn, 80); };


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

async function getText(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(url + " → HTTP " + r.status);
  return r.text();
}

function el(tag, attrs = {}, parent) {
  const e = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (parent) parent.appendChild(e);
  return e;
}

/* ---------------- tabs ---------------- */
function initTabs() {
  const tabs = [["#tab-bonus", "#panel-bonus"], ["#tab-village", "#panel-village"]];
  const show = (idx) => {
    tabs.forEach(([t, p], i) => {
      $(t).setAttribute("aria-selected", String(i === idx));
      $(p).hidden = i !== idx;
    });
    try { localStorage.setItem("bt-tab", String(idx)); } catch (e) { /* storage blocked */ }
    if (idx === 1) { loadVillages(); questDone("看我的里"); }
  };
  tabs.forEach(([t], i) => $(t).addEventListener("click", () => show(i)));
  const qs = new URLSearchParams(location.search);
  let start = 0;
  if (location.hash === "#village" || (qs.has("v") && !qs.has("case"))) start = 1;
  else if (qs.has("case") || location.hash === "#bonus") start = 0;
  else { try { start = Number(localStorage.getItem("bt-tab") || 0); } catch (e) { start = 0; } }
  show(start === 1 ? 1 : 0);
}

/* ---------------- tab 1: bonus blocks ---------------- */
let ITEMS = {};
let CASES = [];
let USAGE = null;
let current = null;
let selected = null;

const FIELD = (code) => ITEMS[code]?.platform_field || code.replace("Δ", "").replace("-", "_");
const val = (c, code) => { const v = c.old?.[FIELD(code)]; return v ? Number(v) : 0; };

async function initBonus() {
  try {
    const [csv, cases] = await Promise.all([getText("bonus-items.csv"), getText("data/cases.json")]);
    parseCSV(csv).filter((r) => r.framework === "old").forEach((r) => { ITEMS[r.code] = r; });
    CASES = JSON.parse(cases).cases;
  } catch (e) {
    $("#hero").innerHTML = `<span class="error">資料載入失敗：${esc(e.message)}</span>`;
    return;
  }
  try { USAGE = JSON.parse(await getText("data/bonus-usage.json")); } catch (e) { USAGE = null; }
  // Group the case list by district so a long list stays usable.
  const sel = $("#case-select");
  const towns = [...new Set(CASES.map((c) => c.town_name || "其他"))];
  sel.innerHTML = towns.map((t) => `<optgroup label="${esc(t)}">${
    CASES.map((c, i) => [c, i]).filter(([c]) => (c.town_name || "其他") === t)
      .map(([c, i]) => `<option value="${i}">${esc(c.case_id)}｜${esc(c.village_names || "")}</option>`).join("")
  }</optgroup>`).join("") + `<option value="paste">✍ 自己貼數字</option>`;
  const want = new URLSearchParams(location.search).get("case");
  let def = CASES.findIndex((c) => c.case_id === want);
  if (def < 0) def = Math.max(0, CASES.findIndex((c) => c.case_id === "09608223"));
  sel.value = String(def);
  sel.addEventListener("change", () => {
    if (sel.value === "paste") { document.querySelectorAll("details.more")[1].open = true; return; }
    render(CASES[Number(sel.value)]);
  });
  buildPasteForm();
  render(CASES[def]);
}

function buildPasteForm() {
  const codes = ["F0", ...OLD_TREE.flatMap(([p, kids]) => (kids.length ? kids : [p]))];
  $("#paste-form").innerHTML = codes.map((code) =>
    `<label>${esc(ITEMS[code]?.icon || "")} ${esc(code)}<input type="number" step="0.01" min="0" inputmode="decimal" data-code="${esc(code)}"></label>`).join("");
  $("#paste-apply").addEventListener("click", () => {
    const old = {};
    document.querySelectorAll("#paste-form input").forEach((inp) => { old[FIELD(inp.dataset.code)] = inp.value === "" ? 0 : Number(inp.value); });
    old.F4 = (old.F4_1 || 0) + (old.F4_2 || 0) + (old.F4_3 || 0);
    old.F5 = ["F5_1", "F5_2", "F5_3", "F5_4", "F5_5", "F5_6", "F5_7"].reduce((s, k) => s + (old[k] || 0), 0);
    old.F = old.F0 + ["F1", "F2", "F3", "F4", "F5", "F6"].reduce((s, k) => s + (old[k] || 0), 0);
    $("#case-select").value = "paste";
    render({ case_id: "自訂", old, pasted: true, cap_label: "1.5" });
  });
}

// Leaf blocks bottom-up. A parent without child values is drawn as one block.
function leaves(c) {
  const out = [];
  OLD_TREE.forEach(([p, kids]) => {
    const kv = kids.map((k) => [k, val(c, k)]).filter(([, v]) => v > 0);
    const pv = val(c, p);
    if (kv.length) {
      out.push(...kv);
      const rest = pv - kv.reduce((s, [, v]) => s + v, 0);
      if (rest > 1) out.push([p, rest]);
    } else if (pv > 0) out.push([p, pv]);
  });
  return out;
}

// Recompute an item from other public fields of the same case.
function checks(c, code) {
  const F0 = c.old.F0, v = val(c, code), r = v / F0, out = [];
  if (!v || !F0) return out;
  if (code === "ΔF3") {
    const self = /自行劃定/.test(c.define_way || "");
    const table = self ? [[0.07, "事業概要核准後 1 年內送件"], [0.06, "2 年內送件"], [0.05, "其他期限內"]]
                       : [[0.10, "劃定公告後 1 年內申請"], [0.08, "2 年內申請"], [0.06, "其他期限內"]];
    const hit = table.find(([p]) => near(r, p));
    if (hit) out.push(["ok", `✓ 對得上：${self ? "自行劃定" : "市府劃定"}、${hit[1]}＝${(hit[0] * 100).toFixed(0)}%`]);
    else out.push(["warn", `${pct(r, 2)} 不在這個級距裡，可能適用其他版本`]);
  }
  if (code === "ΔF5-3" && c.sidewalk_area_m2) {
    out.push(near(v, c.sidewalk_area_m2, 0.01) ? ["ok", `✓ 對得上：人行步道面積也是 ${fmt(c.sidewalk_area_m2, 2)} ㎡`]
                                               : ["warn", `人行步道面積登記 ${fmt(c.sidewalk_area_m2, 2)} ㎡，和獎勵不同`]);
  }
  if (code === "ΔF5-5" && c.base_area_m2) {
    const a = c.base_area_m2; let p = null;
    if (a >= 8000) p = 0.12 + Math.floor((a - 8000) / 100) * 0.003;
    else if (a >= 5000) p = 0.06 + Math.floor((a - 5000) / 100) * 0.002;
    else if (a >= 3000) p = 0.03 + Math.floor((a - 3000) / 100) * 0.001;
    if (p != null) out.push(near(r, Math.min(p, 0.15)) ? ["ok", `✓ 對得上：基地 ${fmt(a)} ㎡ 套級距＝${pct(p)}`]
                                                       : ["warn", `基地 ${fmt(a)} ㎡ 套級距＝${pct(p)}，和 ${pct(r, 2)} 不同`]);
  }
  if (code === "ΔF5-6") {
    const lv = [[0.06, "銀級"], [0.08, "黃金級"], [0.10, "鑽石級"]].find(([p]) => near(r, p));
    if (lv) out.push(["ok", `✓ 對得上：綠建築${lv[1]}＝${pct(r, 0)}`]);
  }
  if (code === "ΔF5-1" && c.law_volume_rate) {
    const cap = c.law_volume_rate > 400 ? 0.06 : 0.10;
    out.push([r <= cap + 0.0005 ? "ok" : "warn", `${r <= cap + 0.0005 ? "✓ 在上限內" : "超過上限"}：容積率 ${fmt(c.law_volume_rate)}% 的上限是 ${pct(cap, 0)}`]);
  }
  return out;
}

function render(c) {
  current = c;
  fillPasteForm(c);
  const F0 = Number(c.old.F0) || 0, F = Number(c.old.F) || 0;
  const blocks = leaves(c);
  const gain = F0 ? (F - F0) / F0 : 0;
  $("#hero").innerHTML = F0 ? `
    <div class="n up"><b>+${pct(gain)}</b><span>${blocks.length} 塊獎勵積木${USAGE ? `<br>全臺北中位數 +${pct(USAGE.gain_median)}` : ""}</span></div>
    <div class="n"><b>${fmt(F)}</b><span>獎勵後（㎡）</span></div>`
    : `<p class="hint">請先輸入法定容積 F0。</p>`;
  drawTower(c, F0, F, blocks);
  drawUsage(blocks.map(([k]) => k));
  const biggest = blocks.slice().sort((a, b) => b[1] - a[1])[0];
  showInfo(biggest ? biggest[0] : null);

  const skipped = OLD_TREE.filter(([p, kids]) => !val(c, p) && !kids.some((k) => val(c, k)))
    .map(([p]) => `<span class="chip" title="${esc(ITEMS[p]?.legal_name)}">${esc(ITEMS[p]?.icon)} ${esc(ITEMS[p]?.short)}</span>`);
  $("#skipped").innerHTML = skipped.length ? `本案沒拿：${skipped.join("")}` : "";

  $("#case-meta").innerHTML = c.pasted ? `<p class="meta">使用者自己輸入的數字。</p>` : `
    <p class="meta">${esc(c.case_name)}</p>
    <p class="meta">${esc(c.town_name)} ${esc(c.village_names)}｜${esc(c.zoning || "")}｜基地 ${fmt(c.base_area_m2)} ㎡｜法定容積率 ${fmt(c.law_volume_rate)}%</p>
    <p class="meta">${esc(c.progress || "")}｜報核 ${esc(c.plan_app_date || "—")}${c.approve_date ? `｜核定 ${esc(c.approve_date)}` : ""}｜實施者 ${esc(c.implementer || "—")}</p>
    ${c.live_units ? `<p class="meta">更新後 ${fmt(c.live_units)} 戶、最高 ${fmt(c.max_floors)} 層。</p>` : ""}
    ${c.volume_transfer_m2 ? `<p class="meta">🔁 另有容積移轉 ${fmt(c.volume_transfer_m2, 2)} ㎡。它是買來的容積，不是獎勵，所以不畫成積木。</p>` : ""}
    <p class="ev">來源：${esc(c.source)}【實測】</p>`;
}

// How often each item is used across Taipei sites; the current case's items are in colour.
function drawUsage(have) {
  const box = $("#usage");
  if (!USAGE) { box.hidden = true; return; }
  box.hidden = false;
  $("#usage-title").textContent = `在 ${USAGE.n_sites} 個有容積獎勵的都更基地中，各項被用到的比例`;
  const rows = USAGE.items.filter((x) => x.sites > 0).sort((a, b) => b.share - a.share);
  $("#usage-bars").innerHTML = rows.map((x) => {
    const it = ITEMS[x.code] || {}, mine = have.includes(x.code);
    return `<div class="ur${mine ? " mine" : ""}" title="${esc(it.legal_name)}">
      <span class="ul">${esc(it.icon || "")} ${esc(it.short || x.code)}${mine ? " ●" : ""}</span>
      <span class="ub"><i style="background:${mine ? COLOR[x.code] || "var(--accent)" : "var(--line)"}" data-w="${x.share * 100}"></i></span>
      <span class="uv">${Math.round(x.share * 100)}%</span></div>`;
  }).join("");
  $("#usage-method").textContent = `${USAGE.method} 共 ${USAGE.n_rows} 案，其中 ${USAGE.rows_F_equals_F0} 案 F＝F0 不算。● 是本案有拿的。資料：都市更新審議服務平台（debug-e3）。`;
  afterPaint(() => document.querySelectorAll("#usage-bars i").forEach((i) => { i.style.width = i.dataset.w + "%"; }));
}

function fillPasteForm(c) {
  document.querySelectorAll("#paste-form input").forEach((inp) => {
    const v = c.old?.[FIELD(inp.dataset.code)];
    inp.value = v ? v : "";
  });
}

function drawTower(c, F0, F, blocks) {
  const svg = $("#tower");
  svg.replaceChildren();
  svg.classList.remove("built");
  if (!F0) return;
  const W = 440, ground = 440, top = 40, x0 = 10, bw = 118, lx = 150;
  const capMul = !c.cap_label || /1\.5/.test(c.cap_label) ? 1.5 : null;
  const capV = capMul ? F0 * capMul : 0;
  const s = (ground - top) / Math.max(F, capV, 1);

  const defs = el("defs", {}, svg);
  const pat = el("pattern", { id: "win", width: 22, height: 18, patternUnits: "userSpaceOnUse", x: x0 + 6, y: 4 }, defs);
  el("rect", { x: 4, y: 4, width: 10, height: 8, rx: 1, fill: "var(--base-win)" }, pat);

  // Base block (F0).
  const hb = F0 * s, yb = ground - hb;
  const gb = el("g", { role: "button", tabindex: 0, "data-code": "F0", "aria-label": `法定容積 ${fmt(F0)} 平方公尺` }, svg);
  el("rect", { class: "blk", x: x0, y: yb, width: bw, height: hb, fill: "var(--base)", rx: 2 }, gb);
  el("rect", { class: "blk", x: x0, y: yb, width: bw, height: hb, fill: "url(#win)" }, gb);
  const t1 = el("text", { class: "lab", x: x0 + bw / 2, y: yb + hb / 2 - 8, "text-anchor": "middle", "font-weight": 700 }, gb);
  t1.textContent = "法定容積";
  const t2 = el("text", { class: "lab", x: x0 + bw / 2, y: yb + hb / 2 + 20, "text-anchor": "middle" }, gb);
  t2.textContent = `${fmt(F0)} ㎡`;

  // Bonus blocks stacked on top, labels on the right with leader lines.
  let y = yb;
  const labels = [];
  blocks.forEach(([code, v], i) => {
    const h = Math.max(v * s, 2), yt = y - h;
    const g = el("g", { role: "button", tabindex: 0, "data-code": code, "aria-label": `${ITEMS[code]?.short || code} ${fmt(v)} 平方公尺` }, svg);
    const r = el("rect", { class: "blk", x: x0, y: yt, width: bw, height: h, fill: COLOR[code] || "#6f7f8f" }, g);
    r.style.transitionDelay = `${0.25 + i * 0.18}s`;
    labels.push({ code, v, want: yt + h / 2, g, i });
    y = yt;
  });
  // Spread labels so they do not overlap (bottom to top).
  let prev = ground + 20;
  labels.forEach((L) => { L.y = Math.min(L.want, prev - 30); prev = L.y; });
  const lift = labels.length ? Math.max(0, 24 - labels[labels.length - 1].y) : 0;
  labels.forEach((L) => {
    L.y += lift;
    el("polyline", { class: "lead lab", points: `${x0 + bw},${L.want} ${lx - 6},${L.y} ${lx - 2},${L.y}`, fill: "none" }, L.g);
    const t = el("text", { class: "lab", x: lx, y: L.y + 4 }, L.g);
    t.textContent = `${ITEMS[L.code]?.icon || ""} ${ITEMS[L.code]?.short || L.code} +${pct(L.v / F0)}`;
    t.style.transitionDelay = `${0.4 + L.i * 0.18}s`;
    L.g.querySelector("polyline").style.transitionDelay = t.style.transitionDelay;
  });

  // Cap line and total.
  if (capV) {
    const yc = ground - capV * s;
    el("line", { class: "cap", x1: 8, x2: W - 8, y1: yc, y2: yc }, svg);
    const tc = el("text", { class: "muted", x: 8, y: yc - 6 }, svg);
    tc.textContent = `上限 ${capMul} 倍`;
  }
  el("line", { class: "ground", x1: 8, x2: W - 8, y1: ground, y2: ground }, svg);

  svg.querySelectorAll("g[role=button]").forEach((g) => {
    g.addEventListener("click", () => tapBlock(g.dataset.code));
    g.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); tapBlock(g.dataset.code); } });
  });
  afterPaint(() => svg.classList.add("built"));
}

function showInfo(code) {
  selected = code;
  document.querySelectorAll("#tower .blk").forEach((r) => r.classList.remove("sel"));
  const g = document.querySelector(`#tower g[data-code="${CSS.escape(code || "")}"]`);
  if (g) {
    g.querySelector(".blk").classList.add("sel");
    document.querySelectorAll("#tower g.pop").forEach((x) => x.classList.remove("pop"));
    if (code !== "F0") { void g.getBBox(); g.classList.add("pop"); }
  }
  const box = $("#block-info");
  if (!code) { box.innerHTML = `<p class="hint">本案沒有獎勵容積。</p>`; return; }
  const it = ITEMS[code] || {};
  const F0 = Number(current.old.F0);
  const v = code === "F0" ? F0 : (leaves(current).find(([k]) => k === code) || [code, val(current, code)])[1];
  const ck = code === "F0" ? [] : checks(current, code);
  box.innerHTML = `
    <div class="head">
      <span class="ico" style="background:${code === "F0" ? "var(--base)" : COLOR[code] || "#6f7f8f"}">${esc(it.icon || "")}</span>
      <div><div class="ttl">${esc(it.short || code)}</div>
      <div class="big">${code === "F0" ? fmt(v) + " ㎡" : "+" + pct(v / F0)}</div>
      <div class="num">${esc(code)}｜${fmt(v, 2)} ㎡</div></div>
    </div>
    <p>${esc(it.plain || "")}</p>
    ${ck.map(([k, t]) => `<div class="check ${k}">${esc(t)}</div>`).join("")}
    <details><summary>條件、上限、法源</summary>
      <dl>
        <dt>法定名稱</dt><dd>${esc(it.legal_name || "—")}</dd>
        <dt>條件</dt><dd>${esc(it.condition || "—")}</dd>
        <dt>上限</dt><dd>${esc(it.amount_cap || "—")}</dd>
        <dt>法源</dt><dd>${esc(it.legal_basis || "—")}${it.source_url ? `｜<a href="${esc(it.source_url)}" target="_blank" rel="noopener">原文</a>` : ""}</dd>
        <dt>證據等級</dt><dd class="ev">${esc(it.evidence || "")}</dd>
      </dl>
    </details>`;
}

/* ---------------- tab 2: village brief ---------------- */
let VILLAGES = null;
let VMETA = {};
let openFactor = null;

const FACTORS = [
  { k: "lv_elderly", icon: "👵", name: "高齡" },
  { k: "lv_old_stock", icon: "🏚", name: "老房子" },
  { k: "lv_liquefaction_city2019", icon: "🌊", name: "液化" },
  { k: "lv_rescue", icon: "🚒", name: "救災不便" },
  { k: "lv_soft_story", icon: "🏪", name: "一樓軟弱層候選" },
];
const LEVEL_TEXT = { 5: "全市最高的約 7 個里", 4: "全市前 7%", 3: "全市前 23%", 2: "全市中間", 1: "全市較低的一半" };

async function loadVillages() {
  if (VILLAGES) return;
  VILLAGES = [];
  const out = $("#village-out");
  out.innerHTML = `<p class="hint">載入中⋯</p>`;
  try {
    const j = JSON.parse(await getText("data/villages.json"));
    VILLAGES = j.villages; VMETA = j.meta || {};
  } catch (e1) {
    try {
      const [ind, rk] = await Promise.all([getText(MARTS + "village_indicators.csv"), getText(MARTS + "village_rankings.csv")]);
      const rmap = new Map(parseCSV(rk).map((r) => [r.village_code, r]));
      VILLAGES = parseCSV(ind).map((r) => ({ ...r, ...(rmap.get(r.village_code) || {}) }));
    } catch (e2) {
      out.innerHTML = `<p class="error">讀不到里的資料。請先跑 scripts/build_page_data.py（見 README）。</p>`;
      return;
    }
  }
  const towns = [...new Map(VILLAGES.map((v) => [String(v.town_code), v.town_name])).entries()].sort();
  const tSel = $("#town-select"), vSel = $("#village-select");
  tSel.innerHTML = towns.map(([c, n]) => `<option value="${esc(c)}">${esc(n)}</option>`).join("");
  const fillV = () => {
    const vs = VILLAGES.filter((v) => String(v.town_code) === tSel.value).sort((a, b) => a.village_name.localeCompare(b.village_name, "zh-Hant"));
    vSel.innerHTML = vs.map((v) => `<option value="${esc(v.village_code)}">${esc(v.village_name)}</option>`).join("");
  };
  tSel.addEventListener("change", () => { fillV(); openFactor = null; renderVillage(vSel.value); });
  vSel.addEventListener("change", () => { openFactor = null; renderVillage(vSel.value); });
  const want = new URLSearchParams(location.search).get("v");
  const start = VILLAGES.find((v) => String(v.village_code) === want) || VILLAGES.find((v) => v.village_name === "黎忠里") || VILLAGES[0];
  tSel.value = String(start.town_code); fillV(); vSel.value = String(start.village_code);
  renderVillage(vSel.value);
}

function factorText(v, k) {
  const lv = Number(v[k]);
  const hi = lv >= 4;
  switch (k) {
    case "lv_elderly":
      return [`每 100 人有 ${Math.round(N(v.share_65plus) * 100)} 人是 65 歲以上。`, hi ? "地震時需要鄰居幫忙的家比較多。" : "",
        "里人口統計，115 年 9 月。"];
    case "lv_old_stock":
      return [`約 ${pct(N(v.f_old_stock), 0)} 的房子是 1999 年以前申請建造（推估）。`, hi ? "用的是 921 以前的耐震規定，值得先做耐震初評。" : "",
        `依 ${fmt(N(v.bld_age_known_n))} 棟查得到年份的房子推估（實價登錄、使用執照、海砂屋清冊）。以申請建造日為準（推定：建成年減 2 年）。政府各制度用的日期不同：安檢用申請建造、公安申報用領得建照、住宅補助用取得建照、快篩用興建，所以不能直接拿使用執照年份對線。`];
    case "lv_liquefaction_city2019":
      return [`里面積有 ${pct(N(v.liq_high_share_city2019), 0)} 在液化高潛勢區、${pct(N(v.liq_medium_share_city2019), 0)} 在中潛勢區。`, hi ? "大地震時地面可能變軟，房子可能下陷。" : "",
        "臺北市液化潛勢圖 2019 版。這是區域尺度，不是單棟鑑定。"];
    case "lv_rescue": {
      const lanes = (N(v.narrow_lanes_n) || 0) + (N(v.fire_access_lanes) || 0);
      return [`列管窄巷（紅黃區＋消防通道）${fmt(lanes, lanes % 1 ? 1 : 0)} 條。`, hi ? "消防車和救護車可能比較難開進來。" : "",
        `計畫道路寬度標註小於 6 公尺的占 ${pct(N(v.road_markers_lt6m_share), 0)}。消防通道跨里時按里數分攤，所以可能有小數。`];
    }
    case "lv_soft_story": {
      const a = N(v.soft_story_a_n) || 0, b = N(v.soft_story_b_n) || 0;
      return [`一樓軟弱層候選 ${a + b} 棟。這是候選，不是判定。`, hi ? "一樓牆少、靠柱子撐的房子，地震時一樓較容易先壞。" : "",
        `A 型（連棟騎樓街屋）${a} 棟、B 型（底層開放的中高樓）${b} 棟。`];
    }
  }
  return ["", "", ""];
}

function renderVillage(code) {
  const v = VILLAGES.find((x) => String(x.village_code) === String(code));
  if (!v) return;
  const share = N(v.share_top46_city2019) || 0;
  const C = 2 * Math.PI * 38;
  const shareTxt = share > 0 && share < 0.01 ? "<1%" : pct(share, 0);
  if (!openFactor) openFactor = FACTORS.slice().sort((a, b) => Number(v[b.k]) - Number(v[a.k]))[0].k;

  const alerts = [];
  if (isTrue(v.hidden_by_composite_city2019)) {
    alerts.push(`<div class="alert"><span class="ai">🔍</span><div><p>${esc(hiddenNames(v.hidden_factors_city2019))}偏高，但總分不高，容易被忽略。</p></div></div>`);
  }
  if (isTrue(v.s5_candidate)) {
    alerts.push(`<div class="alert"><span class="ai">🚒</span><div><p>救災可及性候選：窄巷、液化、長輩多三件事同時成立。</p>
      <details><summary>市府清單的理由</summary>${esc(v.s5_reason)}（窄巷＝紅黃區＋消防通道）</details></div></div>`);
  }

  const cases = (CASES || []).filter((c) => String(c.village_codes || "").split(";").includes(String(v.village_code)));
  const uroKnown = (VMETA.uro_rows_with_village || 0) >= 100 && v.uro_sites != null;
  const facts = [
    ["🏛", fmt(N(v.heritage_sites_n) || 0), "文化資產（處）"],
    ["🏗", "約 " + fmt(N(v.weilao_active_est) || 0, 1), "危老核准案（推估）"],
    ["🧱", fmt(N(v.sea_sand_cases_n) || 0), "海砂屋列管（案）"],
    ["⚠", fmt(N(v.quake_listed_n) || 0), "地震列管黃單（筆）"],
    ["📋", uroKnown ? fmt(v.uro_sites) : "整理中", uroKnown && v.uro_sites ? `都更基地（核定 ${fmt(v.uro_sites_approved)}）` : "都更基地（處）"],
  ];

  $("#village-out").innerHTML = `
    <div class="vhead">
      <svg class="gauge" viewBox="0 0 92 92" role="img" aria-label="前 10% 的比例 ${shareTxt}">
        <circle class="track" cx="46" cy="46" r="38" fill="none" stroke-width="10"/>
        <circle class="fill" cx="46" cy="46" r="38" fill="none" stroke-width="10" stroke-linecap="round"
          stroke-dasharray="${C}" stroke-dashoffset="${C}" transform="rotate(-90 46 46)"/>
        <text x="46" y="55" text-anchor="middle">${shareTxt}</text>
      </svg>
      <div>
        <h2>${esc(v.town_name)} ${esc(v.village_name)}</h2>
        <p>2000 種算法裡，這個里有 ${shareTxt} 排進全市前 10%。</p>
        <p class="hint">人口 ${fmt(N(v.pop_total))}｜這是和其他里比的相對排序。</p>
      </div>
    </div>
    ${alerts.join("")}
    <div class="tiles" role="group" aria-label="五件事的等級">
      ${FACTORS.map((f) => `<button type="button" class="tile l${Number(v[f.k]) || 1}" data-k="${f.k}" aria-pressed="${f.k === openFactor}">
        <span class="ti">${f.icon}</span><span class="tl">${Number(v[f.k]) || "—"}<small>級</small></span><span class="tn">${esc(f.name)}</span></button>`).join("")}
    </div>
    <div class="legend"><span>1</span>${[1, 2, 3, 4, 5].map((i) => `<i style="background:var(--lv${i})"></i>`).join("")}<span>5＝全市最高約 7 個里</span></div>
    <div id="finfo" class="finfo"></div>
    ${silverCard(v)}
    <div class="facts">${facts.map(([i, n, l]) => `<div class="fact"><div class="fi">${i}</div><div class="fn">${esc(n)}</div><div class="fl">${esc(l)}</div></div>`).join("")}</div>
    ${cases.length ? `<p>📋 本里的都更案：${cases.map((c) => `<a href="?case=${esc(c.case_id)}" data-case="${esc(c.case_id)}">${esc(c.case_id)} 看積木</a>`).join("、")}</p>` : ""}
    <div class="links">
      <a href="../../solutions/prototype/index.html?t=${esc(v.town_code)}">🔎 查我家那一棟</a>
      <a href="../../solutions/prototype/brief.html?v=${esc(v.village_code)}">🖨 承辦人版</a>
    </div>
    <details class="more"><summary>📋 資料來源</summary>
      <p class="meta">里的指標：data/marts/village_indicators.csv、village_rankings.csv（2026-10-18）。文資：文化部文資局。危老：清冊 1151002 版，依門牌比例分攤。海砂屋：115.3.25 清冊。黃單：115.3.18 版。</p>
      <p class="meta">銀髮安居：內政部統計處銀髮安居資料（住宅狀況），113 年，村里別。原檔是分類人數，不是現成指數；比例與排序是本頁依分類人數推算。</p>
      <p class="meta">都更審議：都市更新審議服務平台（debug-e3）。目前 ${fmt(VMETA.uro_rows_with_village || 0)}／${fmt(VMETA.uro_rows || 0)} 案有里別，所以還不能算每里的案數。</p>
    </details>`;

  showFactor(v, openFactor);
  document.querySelectorAll(".tile").forEach((b) => b.addEventListener("click", () => { openFactor = b.dataset.k; showFactor(v, openFactor); }));
  document.querySelectorAll("#village-out a[data-case]").forEach((a) => a.addEventListener("click", (e) => {
    e.preventDefault();
    const i = CASES.findIndex((c) => c.case_id === a.dataset.case);
    if (i >= 0) { $("#case-select").value = String(i); $("#tab-bonus").click(); render(CASES[i]); }
  }));
  afterPaint(() => {
    $(".tiles").classList.add("shown");
    const f = $(".gauge .fill");
    if (f) f.setAttribute("stroke-dashoffset", String(C * (1 - share)));
  });
}

// Silver-housing cell: share of people (MOI silver-housing data, 113Y) living in 30+ year old walk-ups, 2-5F.
function silverCard(v) {
  if (v.silver_share == null) return "";
  const top = N(v.silver_top_pct) * 100;
  const topTxt = top < 1 ? "前 1%" : "前 " + Math.ceil(top) + "%";
  return `<div class="finfo silver">
    <p><strong>🏚 銀髮住宅狀況：${topTxt}</strong>（456 里中第 ${fmt(v.silver_rank)} 名，相對於臺北其他里）</p>
    <p>銀髮安居資料裡，約 ${pct(N(v.silver_share), 0)} 的人住在 30 年以上、沒電梯的 2～5 樓公寓。</p>
    <details><summary>數字與來源</summary><p class="meta">出處：內政部統計處 銀髮安居資料，113 年。原檔是各類住宅的人數（${fmt(v.silver_n)}／${fmt(v.silver_total)} 人），不是現成指數；比例與排序是本頁推算。人數少的里，比例容易大起大落。</p></details></div>`;
}

function showFactor(v, k) {
  document.querySelectorAll(".tile").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.k === k)));
  const f = FACTORS.find((x) => x.k === k);
  const [fact, meaning, detail] = factorText(v, k);
  const lv = Number(v[k]);
  $("#finfo").innerHTML = `<p><strong>${f.icon} ${esc(f.name)}：${lv} 級（${esc(LEVEL_TEXT[lv] || "")}）</strong></p>
    <p>${esc(fact)}${meaning ? " " + esc(meaning) : ""}</p>
    <details><summary>數字與來源</summary><p class="meta">${esc(detail)}</p></details>`;
}

function hiddenNames(s) {
  const map = { elderly: "高齡", old_stock: "老房子", liquefaction: "液化", rescue: "救災不便", soft_story: "一樓軟弱層候選" };
  return String(s || "").split(/[;,|]/).map((x) => map[x.trim()] || x.trim()).filter(Boolean).join("、");
}

/* ---------------- boot ---------------- */
if (window.Quest) Quest.init({ page: "b", role: "住戶", steps: ["點 3 塊積木", "看我的里"] });
initBonus().then(initTabs);

// Integrated online health report (index.html). URL params: ?addr=&age=&elder= (plus v=, t=, #w=) and the
// optional profile type=&units=&floor=&ground=&own=&mc=&crack=. Every number and sentence comes from
// lib/report.js (verdict, risks, actions[].plain_title / money_tag, nearby_medical, plain_village). The page adds
// no rules. The resident's name never comes from the URL (report.user, else a demo name).
import { buildReport, parseQuery, OPTIONAL_KEYS } from "./lib/report.js";

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt = (n) => (n == null || isNaN(n) ? "—" : Number(n).toLocaleString("zh-TW"));
const pct = (x) => (x == null || isNaN(x) ? "—" : Math.round(x * 100) + "%");
const dist = (m) => (m == null ? "—" : m >= 1000 ? `${(m / 1000).toFixed(1)} 公里` : `${fmt(m)} 公尺`);
const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const SVGNS = "http://www.w3.org/2000/svg";

window.__errors = [];
window.addEventListener("error", (e) => window.__errors.push(String(e.message)));
window.addEventListener("unhandledrejection", (e) => window.__errors.push(String(e.reason)));

const OPTIONAL = OPTIONAL_KEYS;
let R = null, mini = null, miniLayers = [], firstRun = true, runSeq = 0;

/* ---------------- params ---------------- */
// URL -> flat params, parsed by the engine's parseQuery (the page only keeps strings for the form).
function readParams() {
  const { input, opts } = parseQuery(location.search);
  const p = { addr: input.addr, age: input.age, elder: input.elder, v: opts.village_code || "", t: opts.town_code || "", w: opts.weights || null };
  OPTIONAL.forEach((k) => { p[k] = input[k] ?? ""; });
  return p;
}
function queryOf(p) {
  const q = new URLSearchParams();
  ["addr", "age", "elder", "v", "t", ...OPTIONAL].forEach((k) => { if (p[k] !== "" && p[k] != null) q.set(k, p[k]); });
  return "?" + q.toString() + (p.w ? "#w=" + p.w.join(",") : "");
}
function fillForm(p) {
  const f = $("#form");
  f.addr.value = p.addr; f.age.value = p.age;
  ["type", "units", "floor", "ground"].forEach((k) => { f[k].value = p[k]; });
  ["elder", "own", "mc"].forEach((k) => f.querySelectorAll(`input[name="${k}"]`).forEach((x) => { x.checked = x.value === String(p[k]); }));
  f.crack.checked = String(p.crack) === "1";
}
function formParams() {
  const f = $("#form"), cur = readParams();
  const radio = (k) => { const x = f.querySelector(`input[name="${k}"]:checked`); return x ? x.value : ""; };
  // crack: unticked keeps "not filled" unless the URL already said 0
  const crack = f.crack.checked ? "1" : (cur.crack === "0" ? "0" : "");
  return { ...cur, addr: f.addr.value.trim(), age: f.age.value.trim(), elder: radio("elder"), type: f.type.value, units: f.units.value.trim(),
    floor: f.floor.value.trim(), ground: f.ground.value, own: radio("own"), mc: radio("mc"), crack, v: f.addr.value.trim() !== cur.addr ? "" : cur.v };
}

/* ---------------- levels ---------------- */
const LV = { red: { cls: "red", word: "要注意" }, amber: { cls: "amber", word: "留意" }, green: { cls: "green", word: "還好" }, gray: { cls: "gray", word: "查不到" } };
function lvOf(x) {
  const s = String(x ?? "").toLowerCase();
  if (s === "red" || s === "high") return LV.red;
  if (s === "yellow" || s === "amber" || s === "mid" || s === "medium") return LV.amber;
  if (s === "green" || s === "low") return LV.green;
  return LV.gray;
}
const BASIS = { data: "官方資料", estimate: "我們推估", user: "你填的資料" };

// Where each risk sits on the picture. ring = the round mini map.
function slotOf(id) {
  if (id === "quake_listed" || id === "sea_sand") return "flag";
  if (id === "shelter" || id === "medical") return "ring";
  return { age_code: "age", ground_floor: "soft", soil: "liq", elder_lift: "elev", fire_lane: "lane", visible_damage: "crack" }[id] || null;
}

/* ---------------- house picture (same drawing as visual.html) ---------------- */
function el(tag, attrs, parent) {
  const n = document.createElementNS(SVGNS, tag);
  Object.entries(attrs || {}).forEach(([k, v]) => n.setAttribute(k, v));
  if (parent) parent.appendChild(n);
  return n;
}
let SLOTS = {};
function drawHouse(floors, soil) {
  const svg = $("#house");
  [...svg.querySelectorAll(":scope > :not(title)")].forEach((n) => n.remove());
  const n = Math.max(2, Math.min(5, floors || 4)), G = 420, FH = 58, X0 = 170, X1 = 440, top = G - n * FH;
  const g = el("g", {}, svg);
  const wet = soil === "red" || soil === "amber";
  el("rect", { x: 0, y: G, width: 600, height: 120, fill: "#d9c2a3" }, g);
  el("rect", { x: 0, y: G + 38, width: 600, height: 82, fill: soil === "red" ? "#b9d3ee" : soil === "amber" ? "#cfdcea" : "#cdb08c" }, g);
  for (let i = 0; i < 6; i++) el("path", { d: `M${20 + i * 100} ${G + 70} q 20 -10 40 0 t 40 0`, fill: "none", stroke: wet ? "#2b6cb0" : "#a8875f", "stroke-width": 3, "stroke-linecap": "round", opacity: 0.7 }, g);
  el("rect", { x: X0 - 12, y: G, width: X1 - X0 + 24, height: 22, fill: "#9aa3ad" }, g);
  el("line", { x1: 0, y1: G, x2: 600, y2: G, class: "ln draw" }, g);
  el("rect", { x: 0, y: G - 150, width: 34, height: 150, fill: "#e3e6ea", stroke: "#2a2f36", "stroke-width": 2 }, g);
  el("rect", { x: 34, y: G - 4, width: 126, height: 8, fill: "#c9ced4" }, g);
  el("rect", { x: X0, y: top, width: X1 - X0, height: n * FH, fill: "#fffaf2" }, g);
  el("path", { d: `M${X0} ${G} V${top} H${X1} V${G}`, class: "ln draw" }, g);
  el("path", { d: `M${X0 - 16} ${top} L${(X0 + X1) / 2} ${top - 58} L${X1 + 16} ${top} Z`, fill: "#e9a47e", class: "ln draw" }, g);
  for (let i = 1; i < n; i++) el("line", { x1: X0, y1: G - i * FH, x2: X1, y2: G - i * FH, class: "ln draw", "stroke-width": 2 }, g);
  for (let i = 1; i < n; i++) for (let j = 0; j < 3; j++) el("rect", { x: X0 + 20 + j * 62, y: G - (i + 1) * FH + 14, width: 40, height: 28, rx: 3, fill: "#bfe0f5", stroke: "#2a2f36", "stroke-width": 2 }, g);
  [X0 + 6, X0 + 90, X0 + 170].forEach((x) => el("rect", { x, y: G - FH + 4, width: 10, height: FH - 4, fill: "#2a2f36" }, g));
  el("rect", { x: X0 + 26, y: G - 26, width: 52, height: 22, rx: 4, fill: "#8aa0b3" }, g);
  el("rect", { x: X1 - 70, y: top, width: 70, height: n * FH, fill: "#f1ece4", stroke: "#2a2f36", "stroke-width": 2 }, g);
  for (let i = 0; i < n; i++) el("path", { d: `M${X1 - 64} ${G - i * FH - 6} l 12 -10 l 12 -10 l 12 -10 l 12 -10 l 12 -10`, fill: "none", stroke: "#6b6258", "stroke-width": 3 }, g);
  SLOTS = { age: [X1 + 50, top - 30], soft: [X0 + 130, G - FH / 2 - 6], liq: [(X0 + X1) / 2, G + 78], elev: [X1 - 35, top + FH * 1.5], lane: [92, G - 46], crack: [X0 - 30, top + FH * 1.2] };
}
function drawDots(risks) {
  const svg = $("#house");
  svg.querySelectorAll(".dot").forEach((n) => n.remove());
  risks.forEach((rk) => {
    const s = SLOTS[slotOf(rk.id)];
    if (!s) return;
    const lv = lvOf(rk.level);
    const g = el("g", { class: "dot", tabindex: 0, role: "button", "data-id": rk.id, "aria-label": `${rk.title}：${lv.word}` }, svg);
    el("circle", { cx: s[0], cy: s[1], r: 26, class: "ring lv-" + lv.cls }, g);
    el("circle", { cx: s[0], cy: s[1], r: 26, class: "core lv-" + lv.cls }, g);
    const t = el("text", { x: s[0], y: s[1] + 8, "text-anchor": "middle" }, g);
    t.textContent = rk.icon || "●";
    const go = () => select(rk.id, "dot");
    g.addEventListener("click", go);
    g.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } });
  });
}

// Light up a risk on the picture and its card. from = "card" (scroll the picture into view on phones) or "dot".
function select(id, from) {
  document.querySelectorAll("#house .dot").forEach((d) => d.classList.toggle("sel", d.dataset.id === id));
  document.querySelectorAll("#risks .risk").forEach((c) => c.classList.toggle("sel", c.dataset.id === id));
  document.querySelectorAll("#flags button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.id === id)));
  $(".mapring").classList.toggle("sel", slotOf(id) === "ring");
  const target = from === "card" ? (slotOf(id) === "ring" ? $(".ringbox") : $(".house")) : document.querySelector(`#risks .risk[data-id="${id}"]`);
  if (target && from) {
    const r = target.getBoundingClientRect();
    if (r.top < 0 || r.bottom > window.innerHeight) target.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" });
  }
}

/* ---------------- render ---------------- */
function renderMeta(r) {
  const b = r.building, v = r.village, a = r.age;
  const d = new Date(r.generated_at || Date.now());
  const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const user = r.user && r.user.name ? esc(r.user.name) : `王小明（示範）<span class="sub">登入後自動帶入</span>`;
  const addr = !v ? esc(r.input.addr || "（還沒填門牌）") : b ? esc(`臺北市${v.town_name}${b.address}`) : `${esc(v.town_name + v.village_name)}<span class="sub">${r.input.addr ? "門牌沒有完全對上，先看里的部分" : "只看里的部分"}</span>`;
  const age = a.user != null
    ? `你填 ${a.user} 年<span class="sub">我們推估 ${a.estimated != null ? a.estimated + " 年" : "判不出來"}</span>`
    : `未填<span class="sub">我們推估 ${a.estimated != null ? a.estimated + " 年" : "判不出來"}</span>`;
  const elder = r.input.elder == null ? "未填" : r.input.elder ? "有" : "沒有";
  const rows = [["報告編號", esc(r.report_id || "—"), "rid"], ["日期", ymd], ["受檢人", user], ["門牌", addr, "wide"], ["屋齡", age], ["家中長者", elder]];
  $("#meta").innerHTML = rows.map(([k, x, c]) => `<div${c ? ` class="${c}"` : ""}><dt>${k}</dt><dd>${x}</dd></div>`).join("");
}

function renderVerdict(r) {
  const v = r.verdict;
  if (!v) { $("#verdict").hidden = true; return; }
  const lv = lvOf(v.level);
  $("#verdict").hidden = false;
  $("#verdict").className = "verdict " + lv.cls;
  $("#verdict").innerHTML = `<div class="lamp" aria-hidden="true">${{ red: "!", amber: "!", green: "✓", gray: "?" }[lv.cls]}</div>
    <div><p class="k">總評</p><p class="l">${esc(v.label)}</p><p>${esc(v.line)}</p></div>`;
}

function renderRisks(r) {
  const list = r.risks || [];
  $("#risks").innerHTML = list.map((x) => {
    const lv = lvOf(x.level);
    const more = [x.detail, x.basis ? `依據：${BASIS[x.basis] || x.basis}` : "", x.source ? `出處：${x.source}` : ""].filter(Boolean);
    return `<div class="risk ${lv.cls}" data-id="${esc(x.id)}" tabindex="0" role="button" aria-label="${esc(x.title)}：${lv.word}，在圖上標出">
      <div class="top"><span class="ic" aria-hidden="true">${esc(x.icon || "•")}</span><span class="lamp"><i></i>${lv.word}</span></div>
      <p class="t">${esc(x.title)}</p><p class="p">${esc(x.plain)}</p>
      ${more.length ? `<details><summary>細節</summary>${more.map((m) => `<p>${esc(m)}</p>`).join("")}</details>` : ""}</div>`;
  }).join("");
  $("#risks").querySelectorAll(".risk").forEach((c) => {
    const go = (e) => { if (e.target.closest("details")) return; select(c.dataset.id, "card"); };
    c.addEventListener("click", go);
    c.addEventListener("keydown", (e) => { if ((e.key === "Enter" || e.key === " ") && e.target === c) { e.preventDefault(); go(e); } });
  });
  const flags = list.filter((x) => slotOf(x.id) === "flag");
  $("#flags").innerHTML = flags.map((x) => { const lv = lvOf(x.level); return `<button type="button" class="${lv.cls}" data-id="${esc(x.id)}" aria-pressed="false"><span aria-hidden="true">${esc(x.icon || "")}</span>${esc(x.title)}：<b>${lv.cls === "red" ? "有列管" : lv.cls === "green" ? "沒有列管" : "查不到"}</b></button>`; }).join("");
  $("#flags").querySelectorAll("button").forEach((b) => b.addEventListener("click", () => select(b.dataset.id, "dot")));
}

const ACT_ICON = { listed: "📋", initial_eval: "🩺", soft_story: "🧱", elevator: "🛗", elder: "👵", liquefaction: "💧", weilao: "🏗️", village_drill: "🚒", visible_damage: "🔍" };
function actCard(a, i) {
  return `<div class="act" data-id="${esc(a.id)}">
    <div class="num">${i != null ? `<b>${i + 1}</b>` : ""}<span aria-hidden="true">${ACT_ICON[a.id] || "📌"}</span></div>
    <p class="t">${esc(a.plain_title || a.title)}</p>
    ${a.money_tag ? `<span class="money">💰 ${esc(a.money_tag)}</span>` : ""}
    ${(a.notes || []).length ? `<ul class="notes">${a.notes.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>` : ""}
    <p class="who">找誰：${a.next.url ? `<a href="${esc(a.next.url)}" target="_blank" rel="noopener">${esc(a.next.who)}</a>` : esc(a.next.who)}</p>
    <details><summary>為什麼、補多少</summary><p>${esc(a.title)}。${esc(a.why)}</p><p>補助：${esc(a.subsidy)}</p><p class="fine">出處：${esc(a.source)}</p></details></div>`;
}
function renderActions(r) {
  const top = r.actions.slice(0, 3), rest = r.actions.slice(3);
  $("#acts").innerHTML = top.map((a, i) => actCard(a, i)).join("");
  $("#acts-more").innerHTML = rest.length ? `<details><summary>還有 ${rest.length} 件可以做</summary><div class="acts">${rest.map((a) => actCard(a)).join("")}</div></details>` : "";
}

function renderNear(r) {
  const s = r.nearest_weak_shelter, M = r.nearby_medical, from = r.home && r.home.source === "building_points" ? "你家" : "里的中心";
  const rows = [];
  if (s) rows.push(["♿", "最近的收容所（適合長輩、身障者）", s.name, s.distance_m, s.cap ? `約可收 ${fmt(s.cap)} 人` : ""]);
  if (M) {
    [["er_hospital", "🚑", "急救責任醫院"], ["hospital", "🏥", "醫院"], ["clinic", "🩺", "診所"], ["aed", "❤️", "AED（自動體外心臟電擊器）"]].forEach(([k, ic, lab]) => {
      const x = M[k];
      if (x) rows.push([ic, lab, x.name, x.distance_m, x.district || ""]);
    });
  }
  $("#s-near").hidden = !rows.length;
  $("#near").innerHTML = rows.map(([ic, lab, name, d, x]) => `<li><span class="ic" aria-hidden="true">${ic}</span>
    <span><span class="k">${esc(lab)}</span><span class="n">${esc(name)}</span>${x ? `<span class="x">${esc(x)}</span>` : ""}</span>
    <span class="d">直線約 ${dist(d)}</span></li>`).join("") +
    (rows.length ? `<li class="note" style="display:block;border:0;padding:0 4px"><span class="fine">從${from}量的直線距離，不是步行或車程路線。</span></li>` : "");
}

function renderMini(r) {
  const h = r.home, s = r.nearest_weak_shelter, M = r.nearby_medical || {};
  if (!s) { $("#shelter-line").textContent = "找不到附近的收容所資料。"; }
  else $("#shelter-line").innerHTML = `${h && h.source === "building_points" ? "走到" : "從里中心走到"} ${esc(s.name)}，直線約 ${dist(s.distance_m)}<small>適合長輩、身障者避難的收容所；直線不是步行路線</small>`;
  if (!window.L || !h) return;
  if (!mini) {
    mini = L.map("minimap", { zoomControl: false, attributionControl: false, scrollWheelZoom: false });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(mini);
  }
  miniLayers.forEach((l) => mini.removeLayer(l));
  const b = L.latLngBounds([[h.lat, h.lon], [h.lat, h.lon]]);
  if (s) b.extend([s.lat, s.lon]);
  const aed = M.aed, er = M.er_hospital;
  if (aed && aed.distance_m <= 1500) b.extend([aed.lat, aed.lon]);
  // set a view before adding vector layers (Leaflet clips polylines against the renderer bounds of a map with a view)
  mini.invalidateSize();
  mini.fitBounds(b, { padding: [50, 50], maxZoom: 17 });
  const pin = (ll, cls, txt) => L.marker(ll, { icon: L.divIcon({ className: "pin-label " + cls, html: `<span>${txt}</span>`, iconSize: [0, 0], iconAnchor: [0, 0] }), keyboard: false });
  const dot = (ll, c) => L.circleMarker(ll, { radius: 8, color: "#fff", weight: 2, fillColor: c, fillOpacity: 1 });
  miniLayers = [];
  if (s) miniLayers.push(L.polyline([[h.lat, h.lon], [s.lat, s.lon]], { color: "#3f8f5a", weight: 4, dashArray: "6 7" }), dot([s.lat, s.lon], "#3f8f5a"), pin([s.lat, s.lon], "shel-pin", "♿ " + esc(s.name)));
  if (aed && aed.distance_m <= 1500) miniLayers.push(dot([aed.lat, aed.lon], "#c8372d"), pin([aed.lat, aed.lon], "med-pin", "❤️ AED"));
  if (er && er.distance_m <= 1500) miniLayers.push(dot([er.lat, er.lon], "#c8372d"), pin([er.lat, er.lon], "med-pin", "🚑 " + esc(er.name)));
  miniLayers.push(dot([h.lat, h.lon], "#211d1d"), pin([h.lat, h.lon], "home-pin", h.source === "building_points" ? "🏠 你家" : "📍 里中心"));
  miniLayers.forEach((l) => l.addTo(mini));
  setTimeout(() => { mini.invalidateSize(); mini.fitBounds(b, { padding: [50, 50], maxZoom: 17 }); }, 60);
}

const TILE_LV = (n) => (n >= 4 ? "高" : n === 3 ? "偏高" : n === 2 ? "中" : "低");
function renderVillage(r) {
  const k = r.ranking, M = r.my_village, v = r.village;
  const leader = k ? `<ul>
      <li>排序（權重 ${k.weights.join("、")}，依序是高齡、老屋、液化、救災、軟弱層）：全市 ${k.n_villages} 里中第 ${k.rank} 名；五項同等重要時第 ${k.rank_equal} 名。</li>
      <li>隨機換權重 2,000 次，排進前 ${k.top_k} 名的比例 ${pct(k.top_k_share)}；名次大多落在 ${k.rank_range.p05}～${k.rank_range.p95} 名。</li>
      ${M ? `<li>2000 種算法裡排進全市前 10% 的比例：${esc(M.top10_text)}。</li>` : ""}
      <li>五項等級（1～5，5 是全市最高的約 7 個里）：高齡 ${k.levels.elderly}、老屋 ${k.levels.old_stock}、液化 ${k.levels.liquefaction}、救災 ${k.levels.rescue}、軟弱層 ${k.levels.soft_story}。</li>
      ${M && M.silver ? `<li>銀髮住宅狀況：456 里中第 ${fmt(M.silver.rank)} 名，約 ${pct(M.silver.share)} 的人住在 30 年以上、沒電梯的 2～5 樓公寓（內政部統計處，113 年；推算）。</li>` : ""}
      ${M ? `<li>本里文化資產 ${fmt(M.facts.heritage_sites_n)} 處；海砂屋列管 ${fmt(M.facts.sea_sand_cases_n)} 案；地震列管 ${fmt(M.facts.quake_listed_n)} 筆。</li>` : ""}
      <li><a href="../priority-ranking/#w=${k.weights.join(",")}">在排序頁調權重 →</a></li></ul>` : "<p>沒有這個里的排名資料。</p>";
  $("#village").innerHTML = `<p class="v-name">📍 ${esc(v.town_name)} ${esc(v.village_name)}</p>
    ${r.plain_village ? `<p class="v-plain">${esc(r.plain_village)}</p>` : ""}
    <details><summary>給里長看：排名與數字</summary>${leader}</details>`;
}

function renderFoot(r) {
  $("#disc").innerHTML = `<b>${esc(r.disclaimer)}</b>里的比較都是相對於臺北其他里；房子的年紀、電梯、一樓狀況是從公開資料推估。要知道房子真正的耐震能力，請找建築師或技師評估。`;
  $("#src").innerHTML = (r.sources || []).map((s) => `<li><b>${esc(s.part)}</b>：${esc(s.text)}</li>`).join("");
}

function renderExtraState(r) {
  const miss = r.missing || [];
  const box = $("#extra");
  box.classList.toggle("need", miss.length > 0);
  const filled = OPTIONAL.length - (r.missing_optional || OPTIONAL).length;
  $("#extra-hint").textContent = miss.length ? `還缺：${miss.map((k) => ({ addr: "門牌", age: "屋齡", elder: "家中長者" }[k])).join("、")}，在這裡補` : filled ? `已補 ${filled} 項，可以再改` : "填了會讓報告更貼近你家";
  if (miss.length && firstRun) box.open = true;
  $("#form").addr.closest("label").classList.toggle("need-field", miss.includes("addr"));
  $("#form").age.closest("label").classList.toggle("need-field", miss.includes("age"));
  $("#form").querySelector(".req .radios").classList.toggle("need-field", miss.includes("elder"));
}

/* ---------------- run ---------------- */
const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));
async function run(p) {
  const seq = ++runSeq;
  const animate = firstRun && !reduced;
  if (animate) { document.body.classList.add("working"); drawHouse(4, null); }
  const input = { addr: p.addr, age: p.age, elder: p.elder };
  OPTIONAL.forEach((k) => { if (p[k] !== "") input[k] = p[k]; });
  let r;
  try {
    [r] = await Promise.all([buildReport(input, { village_code: p.v || undefined, town_code: p.t || undefined, weights: p.w || undefined }), animate ? sleep(1000) : null]);
  } catch (e) {
    document.body.classList.remove("working");
    $("#status").hidden = false; $("#status").className = "status err";
    $("#status").textContent = `資料讀不到（${e.message}）。請用 http 伺服器開這頁。`;
    return;
  }
  if (seq !== runSeq) return; // a newer edit is already running
  window.__report = r;
  R = r;
  document.body.classList.remove("working");
  const qs = queryOf(p);
  $("#btn-print").href = "print.html" + qs;
  $("#to-v1").href = "v1.html" + qs;
  $("#to-map").href = "map.html" + qs;
  const msg = [];
  if (p.addr && r.address.match !== "exact") msg.push(r.address.match === "similar" ? "門牌沒有完全對上，先看里的部分（可在「補充資料」改門牌，前面加區名）。" : "找不到這個門牌，可在「補充資料」改門牌，前面加區名。");
  if (!r.village) msg.push("輸入門牌，才能產生報告。");
  msg.push(...(r.warnings || []));
  $("#status").hidden = !msg.length;
  $("#status").className = "status" + (p.addr && r.address.match !== "exact" ? " err" : "");
  $("#status").textContent = msg.join(" ");
  renderMeta(r);
  renderExtraState(r);
  firstRun = false;
  if (!r.village) { document.querySelectorAll(".cover, .sec").forEach((x) => { x.hidden = !x.contains($("#extra")); }); $("#extra").open = true; return; }
  document.querySelectorAll(".cover, .sec").forEach((x) => { x.hidden = false; });
  const soil = (r.risks || []).find((x) => x.id === "soil");
  drawHouse(r.building ? r.building.floors : 4, soil ? lvOf(soil.level).cls : null);
  renderRisks(r);
  drawDots(r.risks || []);
  renderVerdict(r);
  renderMini(r);
  renderActions(r);
  renderNear(r);
  renderVillage(r);
  renderFoot(r);
  const first = [...(r.risks || [])].filter((x) => SLOTS[slotOf(x.id)]).sort((a, b) => ({ red: 3, amber: 2, green: 1, gray: 0 }[lvOf(b.level).cls] - { red: 3, amber: 2, green: 1, gray: 0 }[lvOf(a.level).cls]))[0];
  if (first) select(first.id, null);
  document.title = `臺北市老屋健檢報告｜${r.village.town_name}${r.village.village_name}`;
  document.body.dataset.ready = "1";
}

// Supplementary panel: any change updates the URL and recomputes (no animation).
let tmr = null;
function onEdit(e) {
  const p = formParams();
  history.replaceState(null, "", queryOf(p));
  clearTimeout(tmr);
  tmr = setTimeout(() => run(p), e && e.type === "input" && e.target.type !== "radio" && e.target.type !== "checkbox" ? 600 : 0);
}
$("#form").addEventListener("change", onEdit);
$("#form").addEventListener("input", (e) => { if (e.target.name === "units" || e.target.name === "floor" || e.target.name === "age") onEdit(e); });
$("#form").addEventListener("submit", (e) => { e.preventDefault(); onEdit(); });
$(".mapring").addEventListener("click", () => { const rk = R && (R.risks || []).find((x) => x.id === "shelter"); if (rk) select(rk.id, "dot"); });

const p0 = readParams();
fillForm(p0);
run(p0);

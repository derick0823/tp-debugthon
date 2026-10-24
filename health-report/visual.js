// Health report v5: one-picture visual report (visual.html). Same URL params as index.html
// (?addr=&age=&elder=, plus v=, t=). All numbers come from lib/report.js. The resident's name is never
// read from the URL: it comes from report.user (login), otherwise a demo name is shown.
// Engine fields verdict / risks / user / report_id / plain_village are used when present; until the engine
// ships them, local fallbacks below derive the same shape from fields that already exist.
import { buildReport } from "./lib/report.js";

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt = (n) => (n == null || isNaN(n) ? "—" : Number(n).toLocaleString("zh-TW"));
const pct = (x) => (x == null || isNaN(x) ? "—" : Math.round(x * 100) + "%");
const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const SVGNS = "http://www.w3.org/2000/svg";

window.__errors = [];
window.addEventListener("error", (e) => window.__errors.push(String(e.message)));
window.addEventListener("unhandledrejection", (e) => window.__errors.push(String(e.reason)));

let R = null, mini = null, miniLayers = [], selected = null;

/* ---------------- params ---------------- */
function readParams() {
  const q = new URLSearchParams(location.search);
  return { addr: q.get("addr") || "", age: q.get("age") ?? "", elder: q.get("elder") ?? "", v: q.get("v") || "", t: q.get("t") || "" };
}
function queryOf(p) {
  const q = new URLSearchParams();
  ["addr", "age", "elder", "v", "t"].forEach((k) => { if (p[k] !== "" && p[k] != null) q.set(k, p[k]); });
  return "?" + q.toString();
}

/* ---------------- levels and plain words ---------------- */
const LV = {
  red: { label: "紅燈：要注意", short: "要注意", color: "var(--lv-red)" },
  yellow: { label: "黃燈：留意", short: "留意", color: "var(--lv-yellow)" },
  green: { label: "綠燈：還好", short: "還好", color: "var(--lv-green)" },
  gray: { label: "資料不足", short: "資料不足", color: "var(--lv-gray)" },
};
function normLevel(x) {
  const s = String(x ?? "").toLowerCase();
  if (/red|high|danger|^3$|bad/.test(s)) return "red";
  if (/yellow|amber|medium|mid|warn|^2$/.test(s)) return "yellow";
  if (/green|low|ok|good|^1$/.test(s)) return "green";
  return "gray";
}
const RANK = { red: 3, yellow: 2, green: 1, gray: 0 };
// Formal terms stay only in brackets.
const PLAIN = [
  [/一樓軟弱層候選|軟弱層候選|一樓軟弱層|軟弱層/, "一樓比較空（軟弱層）"],
  [/液化潛勢|液化/, "地下的土可能變軟（液化）"],
  [/耐震規範世代|耐震規範/, "耐震規定"],
];
const plainify = (t) => { let s = String(t ?? ""); PLAIN.forEach(([re, to]) => { if (!s.includes(to)) s = s.replace(re, to); }); return s; };
const BASIS = { data: "官方資料", estimate: "我們推估", user: "你自己填的" };

// Which spot of the house a risk belongs to.
function slotOf(id) {
  const s = String(id);
  if (/quake_listed|sea_sand/.test(s)) return "flag";
  if (/shelter/.test(s)) return "shelter";
  if (/ground|soft/.test(s)) return "soft";
  if (/soil|liq/.test(s)) return "liq";
  if (/elev|stair|elder/.test(s)) return "elev";
  if (/lane|alley|fire|rescue|access/.test(s)) return "lane";
  if (/age|year|code|seis|quake|pre1999|old/.test(s)) return "age";
  return null;
}

/* ---------------- local fallbacks (until the engine ships the v5 fields) ---------------- */
function localRisks(r) {
  const b = r.building, a = r.age, X = r.rescue, P = X ? X._p || {} : {};
  const lanesBar = X && X.bars.find((x) => x.k === "lanes"), liqBar = X && X.bars.find((x) => x.k === "liq"), softBar = X && X.bars.find((x) => x.k === "soft");
  const out = [];
  // age + seismic rule
  {
    let level = "gray", plain = "我們判斷不出這棟幾年蓋的。";
    const pre = b && b.pre1999 != null ? b.pre1999 : (a.user != null ? a.built_year_user - 2 <= 1999 : null);
    const yrs = a.user ?? a.estimated;
    if (pre === true) { level = "red"; plain = `房子約 ${yrs} 年，1999 年以前申請蓋的，用的是 921 地震以前的耐震規定。`; }
    else if (pre === false) { level = "green"; plain = `房子約 ${yrs} 年，用的是 921 地震以後的耐震規定。`; }
    out.push({ id: "age", icon: "📅", title: "房子年紀與耐震規定", level, plain,
      detail: b ? `建造年 ${b.built_year ?? "判不出來"}（${b.age_source_label}）。申請建造日以建成年減 2 年推估。` : "沒有對上確切門牌，用你填的屋齡判斷。",
      basis: "推估", source: "使用執照、實價登錄（renewal-calculator 逐棟表）" });
  }
  // soft first floor
  {
    let level = "gray", plain = `沒有對上這一棟。這個里有 ${softBar ? softBar.text : "—"}一樓比較空的房子（推估）。`;
    if (b) {
      level = b.soft_story_candidate ? "yellow" : "green";
      plain = b.soft_story_candidate ? "一樓可能比較空（店面、停車），地震時一樓容易先壞。這是推估，要請人來看。" : "從公開資料看，一樓沒有比較空的跡象。";
    }
    out.push({ id: "soft_story", icon: "🧱", title: "一樓比較空", level, plain,
      detail: b ? `${b.soft_story_label || "不是候選"}。從公開資料推估，不是判定。` : "逐棟資料要確切門牌才有。", basis: "推估（候選）", source: "building_points 逐棟表" });
  }
  // liquefaction
  {
    let level = "gray", plain = "";
    if (b && b.liq_level && b.liq_level !== "not_mapped") {
      level = b.liq_level === "high" ? "red" : b.liq_level === "medium" ? "yellow" : "green";
      plain = level === "red" ? "這一帶地下的土，大地震時可能變軟，房子會歪或下陷。" : level === "yellow" ? "這一帶地下的土，大地震時有一點機會變軟。" : "這一帶地下的土比較不會變軟。";
    } else if (P.liq_high_share_city2019 != null) {
      const s = P.liq_high_share_city2019;
      level = s >= 0.25 ? "red" : s > 0 ? "yellow" : "green";
      plain = `這個里有 ${liqBar ? liqBar.text : pct(s)} 的面積，大地震時地下的土可能變軟。`;
    }
    out.push({ id: "liquefaction", icon: "💧", title: "地下的土可能變軟", level, plain: plain || "沒有資料。",
      detail: "臺北市土壤液化潛勢圖（城市版 2019），區域尺度，不是這一棟的鑑定。", basis: "官方圖資（區域尺度）", source: "data.taipei 土壤液化潛勢圖" });
  }
  // elder without elevator
  {
    const e = r.input.elder, el = b ? b.has_elevator : null;
    let level = "gray", plain = "還沒填家裡有沒有長者。";
    if (e === 1) { level = el === true ? "green" : el === false ? "red" : "yellow"; plain = el === true ? "家有長者，這棟有電梯。" : el === false ? `家有長者，這棟 ${b && b.floors ? b.floors + " 層" : ""}推估沒有電梯，上下樓與避難比較辛苦。` : "家有長者，但不確定這棟有沒有電梯。"; }
    else if (e === 0) { level = "green"; plain = "家裡沒有 65 歲以上長者。"; }
    out.push({ id: "elevator", icon: "🛗", title: "家有長者沒電梯", level, plain,
      detail: "電梯有無來自實價登錄，是推估。", basis: "推估", source: "實價登錄" });
  }
  // narrow lanes
  if (X) {
    const n = P.lanes_total ?? (lanesBar ? lanesBar.value : 0);
    out.push({ id: "lanes", icon: "🚒", title: "巷子窄，消防車難進", level: n > 0 ? "yellow" : "green",
      plain: n > 0 ? `這個里有 ${lanesBar ? lanesBar.text : n + " 條"}消防局列管的窄巷，火災時消防車不好進。` : "這個里沒有消防局列管的窄巷。",
      detail: lanesBar ? lanesBar.sub + "。窄巷位置是該巷門牌中心（推估）。" : "", basis: "官方清冊", source: "消防局狹小巷道清冊、消防通道清冊" });
  }
  return out;
}
function localVerdict(risks) {
  const reds = risks.filter((x) => x.level === "red").length, yellows = risks.filter((x) => x.level === "yellow").length;
  if (reds >= 2) return { level: "red", label: "建議盡快請人來檢查", line: `有 ${reds} 個紅燈。先從下面第 1 步開始。` };
  if (reds || yellows) return { level: "yellow", label: "有幾個地方要留意", line: `${reds ? reds + " 個紅燈、" : ""}${yellows} 個黃燈。點圖上的圓點看原因。` };
  return { level: "green", label: "目前看起來還好", line: "沒有紅燈或黃燈。還是建議參加里的防災演練。" };
}
function localPlainVillage(r) {
  const v = r.village, X = r.rescue;
  if (!X) return "";
  const lanes = X.bars.find((x) => x.k === "lanes"), liq = X.bars.find((x) => x.k === "liq");
  const k = Math.round((X.share_80plus || 0) * 100);
  return `${v.town_name}${v.village_name}：${lanes && lanes.value > 0 ? `有 ${lanes.text}窄巷消防車不好進` : "沒有列管窄巷"}；${liq ? liq.text : "—"} 的面積地下的土可能變軟；每 100 人約有 ${k} 位 80 歲以上長輩。`;
}

/* ---------------- house drawing ---------------- */
function el(tag, attrs, parent) {
  const n = document.createElementNS(SVGNS, tag);
  Object.entries(attrs || {}).forEach(([k, v]) => n.setAttribute(k, v));
  if (parent) parent.appendChild(n);
  return n;
}
let SLOTS = {};
function drawHouse(floors, liqLevel) {
  const svg = $("#house");
  [...svg.querySelectorAll(":scope > :not(title)")].forEach((n) => n.remove());
  const n = Math.max(2, Math.min(5, floors || 4)), G = 420, FH = 58, X0 = 170, X1 = 440, top = G - n * FH;
  const g = el("g", {}, svg);
  // soil and foundation
  el("rect", { x: 0, y: G, width: 600, height: 120, fill: "#d9c2a3" }, g);
  el("rect", { x: 0, y: G + 38, width: 600, height: 82, fill: liqLevel === "red" ? "#b9d3ee" : liqLevel === "yellow" ? "#cfdcea" : "#cdb08c" }, g);
  for (let i = 0; i < 6; i++) el("path", { d: `M${20 + i * 100} ${G + 70} q 20 -10 40 0 t 40 0`, fill: "none", stroke: liqLevel === "red" || liqLevel === "yellow" ? "#2b6cb0" : "#a8875f", "stroke-width": 3, "stroke-linecap": "round", opacity: 0.7 }, g);
  el("rect", { x: X0 - 12, y: G, width: X1 - X0 + 24, height: 22, fill: "#9aa3ad" }, g);
  el("line", { x1: 0, y1: G, x2: 600, y2: G, class: "ln draw" }, g);
  // alley on the left with a neighbour wall
  el("rect", { x: 0, y: G - 150, width: 34, height: 150, fill: "#e3e6ea", stroke: "#2a2f36", "stroke-width": 2 }, g);
  el("rect", { x: 34, y: G - 4, width: 126, height: 8, fill: "#c9ced4" }, g);
  // body
  el("rect", { x: X0, y: top, width: X1 - X0, height: n * FH, fill: "#fffaf2" }, g);
  el("path", { d: `M${X0} ${G} V${top} H${X1} V${G}`, class: "ln draw" }, g);
  el("path", { d: `M${X0 - 16} ${top} L${(X0 + X1) / 2} ${top - 58} L${X1 + 16} ${top} Z`, fill: "#e9a47e", class: "ln draw" }, g);
  for (let i = 1; i < n; i++) el("line", { x1: X0, y1: G - i * FH, x2: X1, y2: G - i * FH, class: "ln draw", "stroke-width": 2 }, g);
  // windows on upper floors
  for (let i = 1; i < n; i++) for (let j = 0; j < 3; j++) el("rect", { x: X0 + 20 + j * 62, y: G - (i + 1) * FH + 14, width: 40, height: 28, rx: 3, fill: "#bfe0f5", stroke: "#2a2f36", "stroke-width": 2 }, g);
  // ground floor: open front with thin columns
  [X0 + 6, X0 + 90, X0 + 170].forEach((x) => el("rect", { x, y: G - FH + 4, width: 10, height: FH - 4, fill: "#2a2f36" }, g));
  el("rect", { x: X0 + 26, y: G - 26, width: 52, height: 22, rx: 4, fill: "#8aa0b3" }, g); // parked scooter / car block
  // stair / lift shaft on the right
  el("rect", { x: X1 - 70, y: top, width: 70, height: n * FH, fill: "#f1ece4", stroke: "#2a2f36", "stroke-width": 2 }, g);
  for (let i = 0; i < n; i++) el("path", { d: `M${X1 - 64} ${G - i * FH - 6} l 12 -10 l 12 -10 l 12 -10 l 12 -10 l 12 -10`, fill: "none", stroke: "#6b6258", "stroke-width": 3 }, g);
  SLOTS = { age: [X1 + 50, top - 30], soft: [X0 + 130, G - FH / 2 - 6], liq: [(X0 + X1) / 2, G + 78], elev: [X1 - 35, top + FH * 1.5], lane: [92, G - 46] };
  return g;
}
function drawDots(risks) {
  const svg = $("#house");
  svg.querySelectorAll(".dot").forEach((n) => n.remove());
  risks.forEach((rk) => {
    const s = SLOTS[slotOf(rk.id)];
    if (!s) return;
    const g = el("g", { class: "dot", tabindex: 0, role: "button", "data-id": rk.id, "aria-label": `${rk.title}：${LV[rk.level].short}` }, svg);
    el("circle", { cx: s[0], cy: s[1], r: 26, class: "ring lv-" + rk.level }, g);
    el("circle", { cx: s[0], cy: s[1], r: 26, class: "core lv-" + rk.level }, g);
    const t = el("text", { x: s[0], y: s[1] + 8, "text-anchor": "middle" }, g);
    t.textContent = rk.icon || "●";
    g.addEventListener("click", () => select(rk.id));
    g.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); select(rk.id); } });
  });
}

/* ---------------- render ---------------- */
function risksOf(r) {
  const raw = Array.isArray(r.risks) && r.risks.length ? r.risks : localRisks(r);
  return raw.map((x) => ({ ...x, level: normLevel(x.level), title: plainify(x.title), plain: plainify(x.plain) }));
}
function select(id) {
  selected = id;
  const rk = R.__risks.find((x) => x.id === id);
  if (!rk) return;
  document.querySelectorAll("#house .dot").forEach((d) => d.classList.toggle("sel", d.dataset.id === id));
  document.querySelectorAll("#dots-legend button, #flags button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.id === id)));
  $(".mapring").classList.toggle("sel", slotOf(id) === "shelter");
  $("#detail").innerHTML = `<div class="dt"><span aria-hidden="true">${esc(rk.icon || "")}</span>${esc(rk.title)} <span class="tag lv-${rk.level}">${esc(LV[rk.level].short)}</span></div>
    <p>${esc(rk.plain)}</p>
    ${rk.detail || rk.basis || rk.source ? `<details><summary>細節與出處</summary>${rk.detail ? `<p>${esc(rk.detail)}</p>` : ""}${rk.basis ? `<p>依據：${esc(BASIS[rk.basis] || rk.basis)}</p>` : ""}${rk.source ? `<p>資料：${esc(rk.source)}</p>` : ""}</details>` : ""}`;
}

function renderHeader(r) {
  const d = new Date(r.generated_at || Date.now());
  const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  $("#rdate").textContent = ymd;
  $("#rid").textContent = r.report_id || `TPE-${(r.village ? r.village.village_code : "00000").slice(-5)}-${ymd.replace(/-/g, "")}`;
  $("#m-user").innerHTML = r.user && r.user.name ? esc(r.user.name) : `王小明（示範）<span class="demo-note">登入後自動帶入</span>`;
  const b = r.building, v = r.village;
  $("#m-addr").textContent = b ? `臺北市${v.town_name}${b.address}` : r.input.addr ? `${r.input.addr}（沒有完全對上）` : `${v.town_name}${v.village_name}（只看里）`;
  const a = r.age;
  $("#m-age").innerHTML = a.user != null ? `${a.user} 年${a.estimated != null ? `<span class="demo-note">我們推估 ${a.estimated} 年</span>` : ""}` : a.estimated != null ? `約 ${a.estimated} 年<span class="demo-note">推估</span>` : "未填";
  $("#m-elder").textContent = r.input.elder == null ? "未填" : r.input.elder ? "有" : "沒有";
}

function renderSide(r) {
  const V = r.verdict && r.verdict.label ? { ...r.verdict, level: normLevel(r.verdict.level) } : localVerdict(r.__risks);
  $("#verdict").className = "verdict lv-" + V.level;
  $("#verdict").innerHTML = `<div class="vl"><i aria-hidden="true"></i>${esc(plainify(V.label))}</div><p>${esc(plainify(V.line || ""))}</p>`;
  $("#village").textContent = plainify(r.plain_village || localPlainVillage(r));
  $("#dots-legend").innerHTML = r.__risks.filter((rk) => slotOf(rk.id) !== "flag").map((rk) => `<button type="button" data-id="${esc(rk.id)}" aria-pressed="false"><i style="background:${LV[rk.level].color}"></i>${esc(rk.icon || "")} ${esc(rk.title)}</button>`).join("");
  $("#dots-legend").querySelectorAll("button").forEach((b) => b.addEventListener("click", () => select(b.dataset.id)));
  const flags = r.__risks.filter((x) => slotOf(x.id) === "flag");
  $("#flags").innerHTML = flags.map((rk) => `<button type="button" class="flag lv-${rk.level}" data-id="${esc(rk.id)}"><span aria-hidden="true">${esc(rk.icon || "")}</span>${esc(rk.title)}：<b>${esc(rk.level === "red" ? "有列管" : rk.level === "green" ? "沒有列管" : "查不到")}</b></button>`).join("");
  $("#flags").querySelectorAll("button").forEach((b) => b.addEventListener("click", () => select(b.dataset.id)));
  const first = [...r.__risks].sort((x, y) => RANK[y.level] - RANK[x.level])[0];
  if (first) select(first.id);
}

function renderMini(r) {
  const h = r.home, s = r.nearest_weak_shelter;
  if (!s) { $("#shelter-line").textContent = "找不到附近的收容所資料。"; return; }
  $("#shelter-line").innerHTML = `${h && h.source === "building_points" ? "走到" : "從里中心走到"} ${esc(s.name)}，直線約 ${fmt(s.distance_m)} 公尺<small>適合長者、身障者避難的收容所；直線不是步行路線${s.cap ? `；約可收 ${fmt(s.cap)} 人` : ""}</small>`;
  if (!window.L || !h) return;
  if (!mini) {
    mini = L.map("minimap", { zoomControl: false, attributionControl: false, scrollWheelZoom: false });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(mini);
  }
  miniLayers.forEach((l) => mini.removeLayer(l));
  const b = L.latLngBounds([h.lat, h.lon], [s.lat, s.lon]);
  // set a view before adding the polyline (Leaflet clips against the renderer bounds of a map with a view)
  mini.invalidateSize();
  mini.fitBounds(b, { padding: [50, 50], maxZoom: 17 });
  const pin = (ll, cls, txt) => L.marker(ll, { icon: L.divIcon({ className: "pin-label " + cls, html: `<span>${txt}</span>`, iconSize: [0, 0], iconAnchor: [0, 0] }), keyboard: false });
  miniLayers = [
    L.polyline([[h.lat, h.lon], [s.lat, s.lon]], { color: "#2f855a", weight: 4, dashArray: "6 7" }),
    L.circleMarker([s.lat, s.lon], { radius: 8, color: "#fff", weight: 2, fillColor: "#2f855a", fillOpacity: 1 }),
    L.circleMarker([h.lat, h.lon], { radius: 8, color: "#fff", weight: 2, fillColor: "#211d1d", fillOpacity: 1 }),
    pin([s.lat, s.lon], "shel-pin", "♿ " + esc(s.name)),
    pin([h.lat, h.lon], "home-pin", h.source === "building_points" ? "🏠 你家" : "📍 里中心"),
  ];
  miniLayers.forEach((l) => l.addTo(mini));
  setTimeout(() => { mini.invalidateSize(); mini.fitBounds(b, { padding: [50, 50], maxZoom: 17 }); }, 60);
}
function bindMiniSelect() {
  const ring = $(".mapring");
  const go = () => { const rk = R && R.__risks.find((x) => slotOf(x.id) === "shelter"); if (rk) select(rk.id); };
  ring.addEventListener("click", go);
  ring.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } });
}
bindMiniSelect();

// Plain step titles for the ids whose engine title uses formal terms; others go through plainify().
const STEP_TITLE = { liquefaction: "查你家地下的土會不會變軟（液化）", soft_story: "請人看一樓結構，補強（軟弱層補強）" };
const STEP_ICON = { listed: "🚨", initial_eval: "🩺", soft_story: "🧱", elevator: "🛗", elder: "👵", liquefaction: "💧", weilao: "🏗️", village_drill: "🚒" };
// Money tag from the engine's subsidy sentence (numbers are not re-typed here).
function moneyTag(a, elder) {
  const t = String(a.subsidy || "");
  const all = [...t.matchAll(/最高(?:補助)?\s*([\d,.]+)\s*萬/g)].map((m) => m[1]);
  if (all.length) return `最多補 ${a.id === "elevator" && elder ? all[all.length - 1] : all[0]} 萬`;
  const any = t.match(/([\d,.]+)\s*萬元/);
  if (any) return `最多補 ${any[1]} 萬`;
  if (/免費/.test(t)) return "免費";
  return "";
}
function renderSteps(r) {
  $("#steps").innerHTML = r.actions.slice(0, 3).map((a, i) => {
    const m = moneyTag(a, r.input.elder === 1);
    return `<li data-id="${esc(a.id)}"><div class="num"><b>${i + 1}</b><span aria-hidden="true">${STEP_ICON[a.id] || "📋"}</span></div>
      <p class="t">${esc(STEP_TITLE[a.id] || plainify(a.title))}</p>
      ${m ? `<span class="money">💰 ${esc(m)}</span>` : ""}
      <p class="who">找：${a.next.url ? `<a href="${esc(a.next.url)}" target="_blank" rel="noopener">${esc(a.next.who)}</a>` : esc(a.next.who)}</p>
      <details><summary>為什麼、補多少</summary><p>${esc(plainify(a.why))}</p><p>${esc(a.subsidy)}</p><p>出處：${esc(a.source)}</p></details></li>`;
  }).join("");
}

/* ---------------- run ---------------- */
const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));
async function run(p) {
  if (!reduced) document.body.classList.add("working");
  drawHouse(4, null);
  const wait = reduced ? Promise.resolve() : sleep(1000);
  let r;
  try {
    [r] = await Promise.all([buildReport({ addr: p.addr, age: p.age, elder: p.elder }, { village_code: p.v || undefined, town_code: p.t || undefined }), wait]);
  } catch (e) {
    document.body.classList.remove("working");
    $("#status").textContent = `資料讀不到（${e.message}）。請用 http 伺服器開這頁。`; $("#status").className = "status err";
    return;
  }
  window.__report = r;
  R = r;
  document.body.classList.remove("working");
  $("#to-sheet").href = "./" + queryOf(p);
  $("#in-addr").value = p.addr; $("#in-age").value = p.age;
  document.querySelectorAll('input[name="elder"]').forEach((x) => { x.checked = x.value === String(p.elder); });
  const msg = [];
  if (p.addr && r.address.match !== "exact") msg.push("門牌沒有完全對上，先看里的部分。");
  if (!r.village) msg.push("找不到這個門牌，請在「換一個地址」加上區名。");
  msg.push(...(r.warnings || []));
  $("#status").textContent = msg.join(" ");
  $("#status").className = "status" + (p.addr && r.address.match !== "exact" ? " err" : "");
  if (!r.village) return;
  r.__risks = risksOf(r);
  const liq = r.__risks.find((x) => slotOf(x.id) === "liq");
  drawHouse(r.building ? r.building.floors : 4, liq ? liq.level : null);
  drawDots(r.__risks);
  renderHeader(r);
  renderSide(r);
  renderMini(r);
  renderSteps(r);
  $("#sources").innerHTML = (r.sources || []).map((s) => `<li><b>${esc(s.part)}</b>：${esc(s.text)}</li>`).join("");
  document.body.dataset.ready = "1";
}

$("#form").addEventListener("submit", (e) => {
  e.preventDefault();
  const el2 = document.querySelector('input[name="elder"]:checked');
  const p = { ...readParams(), addr: $("#in-addr").value.trim(), age: $("#in-age").value.trim(), elder: el2 ? el2.value : "", v: "" };
  history.replaceState(null, "", queryOf(p));
  run(p);
});
run(readParams());

// Health report page v1 ("健檢單"). Reads ?addr=&age=&elder= (plus optional v, t, the round-4 optional
// inputs, #p=<page> and #w=1,1,3,3,1), calls lib/report.js, and draws four pages:
// 1 score and highlights, 2 this building, 3 around your home, 4 what to do next + my village.
// All numbers come from the engine.
import { buildReport, listVillages, parseQuery, DEFAULT_WEIGHTS, FACTORS, OPTIONAL_KEYS } from "./lib/report.js";

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pct = (x, d = 0) => (x == null || isNaN(x) ? "—" : (x * 100).toFixed(d) + "%");
const fmt = (n, d = 0) => (n == null || isNaN(n) ? "—" : Number(n).toLocaleString("zh-TW", { minimumFractionDigits: d, maximumFractionDigits: d }));
const afterPaint = (fn) => { requestAnimationFrame(() => requestAnimationFrame(fn)); setTimeout(fn, 80); };

window.__errors = [];
window.addEventListener("error", (e) => window.__errors.push(String(e.message)));
window.addEventListener("unhandledrejection", (e) => window.__errors.push(String(e.reason)));

let map = null, mapLayers = [], mapBounds = null, pendingMap = null;
let villages = null;
const PAGES = [[1, "分數與重點"], [2, "這棟房子"], [3, "你家附近"], [4, "接下來可以做的事"]];
let page = 1;
let lastReport = null;
// embed=1: the team app owns the input, so the input card, the compact bar and the big header are hidden.
const EMBED = new URLSearchParams(location.search).get("embed") === "1";
if (EMBED) document.body.dataset.embed = "1";

function hashPage() {
  const m = location.hash.match(/p=(\d)/);
  const qp = new URLSearchParams(location.search).get("p");
  const n = m ? Number(m[1]) : (qp ? Number(qp) : 1);
  return n >= 1 && n <= PAGES.length ? n : 1;
}

function readParams() {
  const q = new URLSearchParams(location.search);
  const m = location.hash.match(/w=([\d.,]+)/);
  let w = DEFAULT_WEIGHTS;
  if (m) {
    const x = m[1].split(",").map(Number);
    if (x.length === 5 && x.every((v) => v >= 0 && v <= 4)) w = x;
  }
  const opt = {};
  OPTIONAL_KEYS.forEach((k) => { if (q.get(k)) opt[k] = q.get(k); });
  return { addr: q.get("addr") || "", age: q.get("age") ?? "", elder: q.get("elder") ?? "", v: q.get("v") || "", t: q.get("t") || "", w, opt };
}

// Blank URL: prefill the demo values so one click produces a report.
const DEMO = { addr: "信義路2段86巷40號", age: "50", elder: "1" };

function fillForm(p) {
  if (!p.addr && !p.v && p.age === "" && p.elder === "") p = { ...p, ...DEMO };
  $("#in-addr").value = p.addr;
  $("#in-age").value = p.age === "unknown" ? "" : p.age;
  $("#in-age-unknown").checked = p.age === "" && !!(p.addr || p.v);
  document.querySelectorAll('input[name="elder"]').forEach((r) => { r.checked = r.value === String(p.elder); });
  OPTIONAL_KEYS.forEach((k) => { const el = $(`#form [name="${k}"]`); if (el) el.value = p.opt[k] ?? ""; });
  $("#more").open = Object.keys(p.opt).length > 0;
}

function formParams() {
  const el = document.querySelector('input[name="elder"]:checked');
  const p = readParams();
  const opt = {};
  OPTIONAL_KEYS.forEach((k) => { const x = $(`#form [name="${k}"]`); if (x && x.value !== "") opt[k] = x.value; });
  const age = $("#in-age-unknown").checked ? "" : $("#in-age").value.trim();
  return { addr: $("#in-addr").value.trim(), age, elder: el ? el.value : "", v: $("#vpick").hidden ? "" : $("#in-village").value, t: p.t, w: p.w, opt };
}

function writeUrl(p) {
  const q = new URLSearchParams();
  if (p.addr) q.set("addr", p.addr);
  if (p.age !== "") q.set("age", p.age);
  if (p.elder !== "") q.set("elder", p.elder);
  if (p.v) q.set("v", p.v);
  if (p.t) q.set("t", p.t);
  OPTIONAL_KEYS.forEach((k) => { if (p.opt[k] != null && p.opt[k] !== "") q.set(k, p.opt[k]); });
  if (EMBED) q.set("embed", "1");
  history.replaceState(null, "", "?" + q.toString() + hashOf(page, p.w));
}

function hashOf(n, w) {
  const parts = [];
  if (n > 1) parts.push("p=" + n);
  if (w && w.join(",") !== DEFAULT_WEIGHTS.join(",")) parts.push("w=" + w.join(","));
  return parts.length ? "#" + parts.join("&") : "";
}

/* ---------------- modes: input card / working animation / report ---------------- */
function setMode(mode) {
  if (EMBED && mode === "input") mode = "embedwait";
  $("#embedwait").hidden = mode !== "embedwait";
  $("#inputcard").hidden = mode !== "input";
  $("#loading").hidden = mode !== "loading";
  $("#report").hidden = mode !== "report";
  $("#bar").hidden = mode !== "report" || EMBED;
  document.body.dataset.mode = mode;
  if (mode === "input") setTimeout(() => $("#in-addr").focus({ preventScroll: true }), 0);
  window.scrollTo(0, 0);
}

function renderBar(r) {
  const b = r.building, v = r.village;
  $("#bar-addr").textContent = b ? `📍 ${(v.town_name || "") + b.address}` : `📍 ${v.town_name} ${v.village_name}`;
  $("#bar-age").textContent = r.input.age == null ? "屋齡：不知道" : `屋齡 ${r.input.age} 年`;
  $("#bar-elder").textContent = r.input.elder == null ? "長者：未填" : r.input.elder ? "👵 有長者" : "沒有長者";
}

function status(msg, err) { const s = $("#status"); s.textContent = msg; s.className = err ? "status err" : "status"; }

async function showVillagePicker(code) {
  if (!villages) villages = await listVillages();
  const towns = [...new Map(villages.map((v) => [v.town_code, v.town_name])).entries()].sort();
  const tSel = $("#in-town"), vSel = $("#in-village");
  if (!tSel.options.length) {
    tSel.innerHTML = towns.map(([c, n]) => `<option value="${c}">${esc(n)}</option>`).join("");
    tSel.addEventListener("change", () => fillV());
  }
  const fillV = (want) => {
    const vs = villages.filter((v) => v.town_code === tSel.value).sort((a, b) => a.village_name.localeCompare(b.village_name, "zh-Hant"));
    vSel.innerHTML = vs.map((v) => `<option value="${v.village_code}">${esc(v.village_name)}</option>`).join("");
    if (want) vSel.value = want;
  };
  const cur = villages.find((v) => v.village_code === code);
  if (cur) tSel.value = cur.town_code;
  fillV(cur && cur.village_code);
  $("#vpick").hidden = false;
}

async function run(p, toPage = 1) {
  setMode("loading");
  status("");
  const t0 = Date.now();
  let r;
  try {
    const input = { ...p.opt, addr: p.addr, age: p.age, elder: p.elder };
    r = await buildReport(input, { village_code: p.v || undefined, town_code: p.t || undefined, weights: p.w });
  } catch (e) {
    setMode("input");
    status(`資料讀不到（${e.message}）。請先產生各原型的 data/（見 README），並用 http 伺服器開這頁。`, true);
    return;
  }
  const wait = 1000 - (Date.now() - t0); // keep the working animation about one second
  if (wait > 0) await new Promise((res) => setTimeout(res, wait));
  window.__report = r;
  // missing inputs: highlight and keep the form open
  document.querySelectorAll(".form .need").forEach((x) => x.classList.remove("need"));
  if (r.missing.includes("age")) $(".f-age").classList.add("need");
  if (r.missing.includes("elder")) $(".f-elder").classList.add("need");
  const sug = $("#suggest");
  sug.hidden = true;
  if (r.address.match === "similar") {
    sug.innerHTML = `<p class="hint" style="width:100%;margin:0">沒有完全一樣的門牌，挑一個相近的：</p>` +
      r.address.suggestions.map((s) => `<button type="button" data-a="${esc(s.town_name + s.address)}">${esc(s.town_name)} ${esc(s.address)}</button>`).join("");
    sug.hidden = false;
    sug.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => { $("#in-addr").value = b.dataset.a; submit(); }));
  }
  if (r.needs_village || (!r.building && r.village)) await showVillagePicker(r.village && r.village.village_code);
  else $("#vpick").hidden = true;

  const msgs = [];
  if (p.addr && r.address.match !== "exact") msgs.push(r.address.match === "similar" ? "門牌沒有完全對上。" : "找不到這個門牌（同一條路可能跨好幾區，可以在前面加區名）。");
  if (r.needs_village) msgs.push(p.addr ? "也可以直接選里，先看里的部分。" : "輸入門牌，或選你住的里。");
  if (r.missing.includes("age") || r.missing.includes("elder")) msgs.push("屋齡、有無長者可以補填，報告會跟著改。");
  msgs.push(...r.warnings);
  status(msgs.join(" "), !!(p.addr && r.address.match !== "exact"));
  if (!r.village) { setMode("input"); return; }
  setMode("report");
  lastReport = r;
  renderBar(r);
  renderLinks(r);
  renderP1(r);
  renderNear(r);
  renderHead(r);
  renderBuilding(r);
  renderRank(r);
  renderBars(r);
  pendingMap = r; // Leaflet needs a visible container: drawn when page 3 is shown
  renderChecklist(r);
  renderBonus(r);
  renderActions(r);
  $("#sources").innerHTML = r.sources.map((s) => `<li><b>${esc(s.part)}</b>：${esc(s.text)}</li>`).join("");
  showPage(toPage, false);
  document.body.dataset.ready = "1";
}

/* ---------------- links out: calculator, print, id line ---------------- */
// renewal-calculator reads ?t=<town_code>&q=<address> (assets/calc.js init); without an exact doorplate
// it opens on the village's district only.
function renderLinks(r) {
  const q = new URLSearchParams();
  if (r.building) {
    q.set("t", r.building.town_code);
    const fullAddr = (r.village && !r.building.address.startsWith(r.village.town_name) ? r.village.town_name : "") + r.building.address;
    q.set("addr", fullAddr);
  } else if (r.input && r.input.addr) {
    if (r.village) q.set("t", r.village.town_code);
    q.set("addr", r.input.addr);
  } else if (r.village) {
    q.set("t", r.village.town_code);
  }
  $("#go-calc").href = "../renewal-calculator-v2/" + (q.toString() ? "?" + q.toString() : "");
  const pq = new URLSearchParams(location.search);
  pq.delete("embed");
  $("#go-print").href = "print.html" + (pq.toString() ? "?" + pq.toString() : "");
  const who = r.user ? r.user.name : "王小明（示範）";
  $("#idline").textContent = `報告編號 ${r.report_id}｜受檢人 ${who}`;
  $("#idline").hidden = false;
}

/* ---------------- pages ---------------- */
function buildNav() {
  $("#dots").innerHTML = PAGES.map(([n, name]) => `<button type="button" data-p="${n}" aria-label="第 ${n} 頁：${name}"><i></i><span>${name}</span></button>`).join("");
  $("#dots").querySelectorAll("button").forEach((b) => b.addEventListener("click", () => showPage(Number(b.dataset.p), true)));
  $("#prev").addEventListener("click", () => showPage(page - 1, true));
  $("#next").addEventListener("click", () => showPage(page + 1, true));
  window.addEventListener("hashchange", () => { if (hashPage() !== page) showPage(hashPage(), true); });
}

function showPage(n, scroll) {
  page = Math.max(1, Math.min(PAGES.length, n));
  document.querySelectorAll(".page").forEach((el) => { el.hidden = Number(el.dataset.p) !== page; });
  document.querySelectorAll("#dots button").forEach((b) => b.setAttribute("aria-current", String(Number(b.dataset.p) === page)));
  $("#prev").disabled = page === 1;
  $("#prev").style.visibility = page === 1 ? "hidden" : "visible";
  const last = page === PAGES.length;
  $("#next").hidden = last;
  $("#go-calc").hidden = !last;
  $("#pager2").hidden = !last;
  if (!last) $("#next").textContent = `下一頁：${PAGES[page][1]} →`;
  history.replaceState(null, "", location.pathname + location.search + hashOf(page, readParams().w));
  document.body.dataset.page = String(page);
  if (page === 3) {
    if (pendingMap) { renderMap(pendingMap); pendingMap = null; }
    else if (map) setTimeout(() => { map.invalidateSize(); if (mapBounds) map.fitBounds(mapBounds, { padding: [24, 24], maxZoom: 17 }); }, 30);
  }
  if (scroll) window.scrollTo({ top: 0, behavior: "instant" in document.documentElement.style ? "instant" : "auto" });
}

/* ---------------- page 1: score and highlights ---------------- */
const GRADE_COLOR = { good: "#4f9a68", watch: "#df7e2c", check: "#a52f2f" };
const LEVEL_WORD = { high: "要注意", mid: "留意" };
function renderP1(r) {
  const S = r.score, k = r.ranking, ar = r.age_rank;
  const C = 2 * Math.PI * 52;
  const color = S ? GRADE_COLOR[S.grade] : "#999";
  // Shown as a risk score (100 - engine score): higher means act sooner, as the pitch says.
  const risk = S ? 100 - S.value : null;
  const ring = S ? `<svg class="ring" viewBox="0 0 128 128" role="img" aria-label="風險分數 ${risk} 分，${S.label}">
      <circle cx="64" cy="64" r="52" fill="none" stroke="var(--track)" stroke-width="14"/>
      <circle class="arc" cx="64" cy="64" r="52" fill="none" stroke="${color}" stroke-width="14" stroke-linecap="round"
        stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - risk / 100)}" transform="rotate(-90 64 64)"/>
      <text x="64" y="70" text-anchor="middle" class="rv">${risk}</text><text x="64" y="92" text-anchor="middle" class="ru">風險分</text></svg>` : "";
  const arShare = ar ? (ar.older_than_share_estimated ?? ar.older_than_share_user) : null;
  const topPct = k ? Math.max(1, Math.ceil((k.rank / k.n_villages) * 100)) : null;
  const red = r.risks.filter((x) => x.level === "high").concat(r.risks.filter((x) => x.level === "mid")).slice(0, 3);
  const a = r.actions[0];
  $("#p1").innerHTML = `
    <div class="card scorecard">
      <div class="scorehead">${ring}
        <div class="sg"><b style="color:${color}">${esc(S ? S.label : "—")}</b>
          <span>${esc(r.verdict ? r.verdict.line : "")}</span>
          <span class="small muted">風險分數滿分 100，分數越高，越需要盡快改善。${esc(S ? S.note : "")}${S && S.unknown_n ? `；有 ${S.unknown_n} 項查不到，沒有算進去` : ""}。</span></div>
      </div>
      <div class="stats">
        <div class="stat"><b>${arShare == null ? "—" : pct(arShare)}</b><span>${arShare == null ? "查不到本里房子的年紀比較" : `你家比本里 ${pct(arShare)} 的房子老`}</span></div>
        <div class="stat"><b>第 ${k ? k.rank : "—"} 名</b><span>你的里在全市 ${k ? k.n_villages : 456} 里${topPct ? `，前 ${topPct}%` : ""}</span></div>
      </div>
      ${r.plain_village ? `<p class="pv">${esc(r.plain_village)}</p>` : ""}
    </div>
    <div class="card">
      <h2>先注意這 ${red.length || ""} 件事</h2>
      ${red.length ? `<ul class="toprisk">${red.map((x) => `<li class="lv-${x.level}"><span class="ic" aria-hidden="true">${x.icon}</span>
        <span><b>${esc(x.title)}</b><span class="tag">${LEVEL_WORD[x.level]}</span><br>${esc(x.plain)}</span></li>`).join("")}</ul>`
        : `<p>公開資料看不出明顯的紅、黃風險。</p>`}
      <p class="small"><button type="button" class="linkbtn" data-go="2">看這棟房子的細節 →</button></p>
    </div>
    ${a ? `<div class="card actioncard">
      <p class="eyebrow">最重要的一件事</p>
      <h2>${esc(a.plain_title || a.title)}</h2>
      <p class="money">💰 ${esc(a.money_tag || "")}</p>
      <p>${esc(a.why)}</p>
      <p class="who">找：${a.next.url ? `<a href="${esc(a.next.url)}" target="_blank" rel="noopener">${esc(a.next.who)}</a>` : esc(a.next.who)}</p>
      <p class="small"><button type="button" class="linkbtn" data-go="4">看全部 ${r.actions.length} 件可以做的事 →</button></p>
    </div>` : ""}`;
  $("#p1").querySelectorAll("[data-go]").forEach((b) => b.addEventListener("click", () => showPage(Number(b.dataset.go), true)));
}

/* ---------------- page 3: shelter and medical ---------------- */
const MED = [["er_hospital", "🏥", "急救責任醫院"], ["hospital", "🏨", "醫院"], ["clinic", "🩺", "診所"], ["aed", "❤️", "AED"]];
function renderNear(r) {
  const s = r.nearest_weak_shelter, m = r.nearby_medical;
  const from = (x) => (x.from === "home" ? "離你家" : "離里的中心");
  const dist = (d) => (d >= 1000 ? `${(d / 1000).toFixed(1)} 公里` : `${fmt(d)} 公尺`);
  const rows = [];
  if (s) rows.push(`<li><span class="ic" aria-hidden="true">♿</span><span><b>能照顧長輩的收容所</b><br>${esc(s.name)}，${from(s)}直線約 <b>${dist(s.distance_m)}</b>${s.cap ? `，約 ${fmt(s.cap)} 人` : ""}</span></li>`);
  if (m) MED.forEach(([key, ic, name]) => { const x = m[key]; if (x) rows.push(`<li><span class="ic" aria-hidden="true">${ic}</span><span><b>最近的${name}</b><br>${esc(x.name)}，${from(x)}直線約 <b>${dist(x.distance_m)}</b></span></li>`); });
  $("#near").innerHTML = rows.length ? `<ul class="nearlist">${rows.join("")}</ul><p class="small muted">都是直線距離，不是走路或開車的路線。</p>` : "<p>查不到收容所與醫院資料。</p>";
}

/* ---------------- 1. header ---------------- */
function renderHead(r) {
  const b = r.building, v = r.village, a = r.age;
  const est = a.estimated == null
    ? `<div class="age none"><b>判不出來</b><span>我們推估的屋齡</span></div>`
    : `<div class="age est"><b>${a.estimated}<small style="font-size:20px"> 年</small></b><span>我們推估（${esc(a.estimated_source)}，${a.built_year_estimated} 年建）</span></div>`;
  const usr = a.user == null
    ? `<div class="age none"><b>未填</b><span>你填的屋齡</span></div>`
    : `<div class="age"><b>${a.user}<small style="font-size:20px"> 年</small></b><span>你填的（約 ${a.built_year_user} 年建）</span></div>`;
  let gap = "";
  if (b && b.age_gap != null && Math.abs(b.age_gap) >= 3) gap = `<p class="gap">⚠ 兩個屋齡差 ${Math.abs(b.age_gap)} 年。以使用執照為準；我們的推估${b.built_year_confirmed ? "來自官方清冊" : "可能不準"}。</p>`;
  const elder = r.input.elder == null ? `<span class="pill">👵 有無長者：未填</span>` : r.input.elder ? `<span class="pill warn">👵 家裡有長者</span>` : `<span class="pill">家裡沒有長者</span>`;
  const pre = b && b.pre1999 != null ? (b.pre1999 ? `<span class="pill warn">📐 1999 年以前申請建造（推估）</span>` : `<span class="pill ok">📐 1999 年以後申請建造（推估）</span>`) : "";
  const gu = a.code_generation_user_label, ge = a.code_generation_estimated_label;
  let gen = "";
  if (gu || ge) {
    const same = gu && ge && a.code_generation_user === a.code_generation_estimated;
    gen = `<div class="gens"><div><span class="muted">照你填的屋齡</span><b>${esc(gu || "—")}</b></div><div><span class="muted">照我們推估</span><b>${esc(ge || "—")}</b></div></div>
      ${gu && ge ? `<p class="gap">${same ? "✓ 兩個屋齡落在同一代耐震規範。" : "⚠ 兩個屋齡落在不同代的耐震規範，以使用執照為準。"}</p>` : ""}`;
  }
  $("#s-head").innerHTML = `
    <p class="addr">${b ? esc((v.town_name || "") + b.address) : esc(r.input.addr || "（沒有門牌）")}</p>
    <p class="vill">${esc(v.town_name)} ${esc(v.village_name)}${b ? "" : "（只看里的部分）"}</p>
    <div class="ages">${usr}${est}</div>${gap}${gen}
    <div class="pills">${elder}${pre}</div>`;
}

/* ---------------- 2. this building ---------------- */
function renderBuilding(r) {
  const b = r.building;
  if (!b) {
    $("#bldg").innerHTML = `<p class="nobldg">沒有對上確切門牌，所以這一節不顯示逐棟資料與列管旗標。輸入完整門牌（含號）再試一次。</p>`;
    return;
  }
  const yr = b.built_year ? `${b.built_year} 年${b.built_year_range ? `（${b.built_year_range[0]}～${b.built_year_range[1]}）` : ""}` : "判不出來";
  const cells = [
    ["📅", yr, `建造年（${b.age_source_label}）`, !b.built_year_confirmed],
    ["📐", b.pre1999 == null ? "判不出來" : b.pre1999 ? "1999 前" : "1999 後", "耐震規範：申請建造日（建成年減 2 年）", true, b.pre1999 === true],
    ["🏢", b.floors ? `${b.floors} 層` : "—", b.building_type_label || "樓層"],
    ["🛗", b.has_elevator === true ? "有電梯" : b.has_elevator === false ? "沒有電梯" : "不確定", "電梯（實價登錄）", b.has_elevator != null],
    ["🧱", b.soft_story_candidate ? `${b.soft_story_candidate} 型` : "不是候選", b.soft_story_label || "一樓軟弱層", false, !!b.soft_story_candidate, !!b.soft_story_candidate],
    ["💧", b.liq_label, "液化潛勢（城市版 2019，區域尺度）", false, b.liq_level === "high"],
    ["👥", b.units ? `約 ${b.units} 戶` : "—", "門牌數當戶數近似"],
    ["🏗", b.structure_label || "—", "構造"],
  ];
  const flags = [];
  if (b.flags.sea_sand) flags.push(`<p class="flag"><b>已確認：市府列管海砂屋</b>（${esc(b.flags.sea_sand.kind_label)}）。清冊原文：${esc(b.flags.sea_sand.list_address)}，${esc(b.flags.sea_sand.list_version)} 版。</p>`);
  if (b.flags.quake_listed) flags.push(`<p class="flag"><b>已確認：${esc(b.flags.quake_listed.event)} 地震受損列管（黃單）</b>。清冊原文：${esc(b.flags.quake_listed.list_address)}，${esc(b.flags.quake_listed.list_version)} 版。列管狀態以建管處為準。</p>`);
  const ar = r.age_rank;
  const arShare = ar ? (ar.older_than_share_estimated ?? ar.older_than_share_user) : null;
  const arBasis = ar && ar.older_than_share_estimated != null ? "照我們推估的建造年" : "照你填的屋齡";
  const ageRank = arShare == null ? "" : `<div class="agerank"><b>${pct(arShare)}</b><span>你家比本里 ${pct(arShare)} 的房子老<br><span class="small muted">${arBasis}；本里 ${fmt(ar.n_known)} 棟有實際建成年，不含鄰棟推估</span></span></div>`;
  $("#bldg").innerHTML = `${ageRank}<div class="facts-grid">${cells.map(([ic, v, k, est, bad, cand]) =>
    `<div class="fc${est ? " est" : ""}${cand ? " cand" : ""}${bad ? " bad" : ""}"><span class="ic" aria-hidden="true">${ic}</span><span class="v">${esc(v)}</span><span class="k">${esc(k)}</span></div>`).join("")}</div>
    ${flags.join("")}
    ${b.near_heritage_50m ? `<p class="hint">50 公尺內有 ${b.heritage_n_50m} 處文資建物。</p>` : ""}
    <details><summary>這些怎麼來</summary><p class="small">逐棟表 building_points：使用執照 90～115 年、實價登錄 101S4～115S3、海砂屋與地震列管清冊。黃色標籤＝推估或候選，不是官方認定。海砂屋、黃單只在輸入確切門牌時顯示。</p></details>`;
}

/* ---------------- 3. ranking ---------------- */
function lvChip(lv, name, cls = "chip5") {
  return `<div class="${cls}${lv >= 4 ? " dark" : ""}" style="background:var(--l${lv || 1})"><b>${lv ?? "—"}</b>${esc(name)}</div>`;
}
function renderRank(r) {
  const k = r.ranking;
  if (!k) { $("#rank").innerHTML = "<p>沒有這個里的排名資料。</p>"; return; }
  $("#rank").innerHTML = `
    <div class="rbig"><b>第 ${k.rank} 名</b><span>／${k.n_villages} 里，前 ${Math.max(1, Math.ceil((k.rank / k.n_villages) * 100))}%（權重 ${k.weights.join("、")}）</span></div>
    <p class="muted">等權時第 ${k.rank_equal} 名。名次越前面越該先處理，相對於臺北其他里。</p>
    <div class="chips5" aria-label="5 因子等級，5 級最高">${FACTORS.map((f) => lvChip(k.levels[f.k], f.name)).join("")}</div>
    <p>${esc(k.sentence[0])}</p>
    <div class="stab"><span>排進前 ${k.top_k} 名</span><span class="bar"><i style="width:0"></i></span><b>${pct(k.top_k_share)}</b></div>
    <p class="muted small">${esc(k.sentence[1])}隨機權重名次 ${k.rank_range.p05}～${k.rank_range.p95}（中位 ${k.rank_range.p50}）。</p>
    <p class="small"><a href="../priority-ranking/#w=${k.weights.join(",")}">在排序頁調權重 →</a></p>`;
  afterPaint(() => { const i = $("#rank .stab i"); if (i) i.style.width = pct(k.top_k_share); });
}

/* ---------------- 4. rescue map ---------------- */
const BAR_STYLE = { lanes: ["🚒", "var(--red)"], liq: ["💧", "var(--blue)"], old: ["🏚️", "var(--amber)"], heritage: ["🏛️", "var(--purple)"], soft: ["🏢", "#8a949e"] };
function renderBars(r) {
  const R = r.rescue;
  if (!R) return;
  const LV = [["👵", "高齡", "elderly"], ["🏚️", "老屋", "old_stock"], ["💧", "液化", "liquefaction"], ["🚒", "救災", "rescue"], ["🏢", "軟弱層", "soft_story"]];
  $("#bars").innerHTML = `${R.s5_candidate ? `<p class="pill warn">救災可及性候選里</p>` : ""}
    ${R.bars.map((b) => `<div class="brow"><span class="ic" aria-hidden="true">${BAR_STYLE[b.k][0]}</span>
      <div><div class="bk"><span>${esc(b.label)}</span><b>${esc(b.text)}</b></div>
      <div class="bar"><i style="width:${(Math.max(0, Math.min(1, b.ratio)) * 100).toFixed(1)}%;background:${BAR_STYLE[b.k][1]}"></i></div>
      ${b.sub ? `<div class="bs">${esc(b.sub)}</div>` : ""}</div></div>`).join("")}
    <div class="lvs">${LV.map(([ic, nm, k]) => { const l = R.levels[k]; return `<div class="lvc"><div class="lvb"><i style="height:${(l.level || 0) * 20}%;background:var(--l${l.level || 1})"></i></div><div>${ic} ${nm}</div><div class="lvt">${esc(l.label)}</div></div>`; }).join("")}</div>
    <p class="bs">長條是本里相對全市最高里的比例。</p>`;
}

function renderMap(r) {
  const R = r.rescue;
  if (!R) return;
  if (!window.L) { $("#map").textContent = "地圖套件載入失敗。"; return; }
  if (!map) {
    map = L.map("map", { zoomControl: true, scrollWheelZoom: false });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(map);
  }
  mapLayers.forEach((l) => map.removeLayer(l));
  const vl = L.geoJSON(R.map.village, { style: { color: "#111", weight: 3, fillColor: "#db6a41", fillOpacity: 0.08, dashArray: "6 4" } }).addTo(map);
  const ll = L.geoJSON(R.map.lanes, {
    pointToLayer: (x, p) => L.circleMarker(p, { radius: 8, color: "#fff", fillColor: x.properties.zone === "red" ? "#c0392b" : "#d08a00", fillOpacity: 0.95, weight: 1.5 }),
    onEachFeature: (x, l) => l.bindTooltip(`🚒 ${x.properties.lane_name}（${x.properties.zone === "red" ? "紅區" : "黃區"}，寬 ${x.properties.width_m} m）`),
  }).addTo(map);
  const hl = L.geoJSON(R.map.heritage, {
    pointToLayer: (x, p) => L.circleMarker(p, { radius: 7, color: "#fff", fillColor: "#6b46c1", fillOpacity: 0.95, weight: 1.5 }),
    onEachFeature: (x, l) => l.bindTooltip(`🏛️ ${x.properties.case_name}`),
  }).addTo(map);
  mapLayers = [vl, ll, hl];
  const h = r.home, s = r.nearest_weak_shelter;
  const bounds = L.latLngBounds(vl.getBounds().getSouthWest(), vl.getBounds().getNorthEast());
  if (h) bounds.extend([h.lat, h.lon]);
  if (s) bounds.extend([s.lat, s.lon]);
  // Set a view before adding the polyline: its clipping needs the renderer bounds of a map with a view.
  map.fitBounds(bounds, { padding: [24, 24], maxZoom: 17 });
  if (h) {
    const isHome = h.source === "building_points";
    const icon = L.divIcon({ className: "home-pin", html: `<span>${isHome ? "🏠 你家" : "📍 里中心"}</span>`, iconSize: [0, 0], iconAnchor: [0, 0] });
    mapLayers.push(L.marker([h.lat, h.lon], { icon, keyboard: false, title: h.label }).addTo(map));
  }
  if (s) {
    const icon = L.divIcon({ className: "shel-pin", html: `<span>♿ ${esc(s.name)}</span>`, iconSize: [0, 0], iconAnchor: [0, 0] });
    mapLayers.push(L.marker([s.lat, s.lon], { icon, keyboard: false, title: s.name }).addTo(map));
    if (h) mapLayers.push(L.polyline([[h.lat, h.lon], [s.lat, s.lon]], { color: "#2f6f8f", weight: 2, dashArray: "4 6" }).bindTooltip(`直線約 ${fmt(s.distance_m)} m`).addTo(map));
  }
  mapBounds = bounds;
  setTimeout(() => { map.invalidateSize(); map.fitBounds(bounds, { padding: [24, 24], maxZoom: 17 }); }, 50);
}

/* ---------------- 5. checklist ---------------- */
function renderChecklist(r) {
  $("#check-note").hidden = !r.checklist_note;
  $("#check-note").textContent = r.checklist_note || "";
  $("#check").innerHTML = r.checklist.map((c, i) => `<li><label for="ck${i}"><input type="checkbox" id="ck${i}"><span class="ic" aria-hidden="true">${c.icon}</span>
    <span>${esc(c.title)}${r.input.elder === 1 && c.elder_related ? `<span class="eld">長者</span>` : ""}</span></label>
    <details><summary>細節</summary>${c.shelters && c.shelters.length ? `<ul>${c.shelters.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>` : ""}${esc(c.detail)}</details></li>`).join("");
}

/* ---------------- 6. bonus + my village ---------------- */
function towerSvg(B) {
  const W = 360, ground = 300, top = 24, x0 = 10, bw = 110, lx = 140;
  const F0 = 1, F = 1 + B.blocks.reduce((s, b) => s + b.mean_pct_of_F0, 0), cap = B.cap_multiple;
  const s = (ground - top) / Math.max(F, cap);
  let y = ground - F0 * s;
  let out = `<rect x="${x0}" y="${y}" width="${bw}" height="${F0 * s}" fill="#c9b8a8" rx="2"/><text x="${x0 + bw / 2}" y="${y + F0 * s / 2}" text-anchor="middle" font-weight="700">法定容積</text>`;
  let prev = ground + 20;
  B.blocks.forEach((b) => {
    const h = Math.max(b.mean_pct_of_F0 * s, 2), yt = y - h;
    const ly = Math.min(yt + h / 2, prev - 24); prev = ly;
    out += `<rect x="${x0}" y="${yt}" width="${bw}" height="${h}" fill="${b.color}"><title>${esc(b.short)}</title></rect>
      <polyline points="${x0 + bw},${yt + h / 2} ${lx - 6},${ly} ${lx - 2},${ly}" fill="none" stroke="var(--muted)"/>
      <text x="${lx}" y="${ly + 5}">${esc(b.icon)} ${esc(b.short)} +${pct(b.mean_pct_of_F0, 1)}</text>`;
    y = yt;
  });
  const yc = ground - cap * s;
  out += `<line x1="4" x2="${x0 + bw + 6}" y1="${yc}" y2="${yc}" stroke="var(--red)" stroke-width="2" stroke-dasharray="5 4"/>
    <line x1="6" x2="${W - 6}" y1="${ground}" y2="${ground}" stroke="var(--ink)"/>`;
  // The cap line only spans the block column, and is named in the caption, so it never crosses a label.
  return `<svg class="tower" viewBox="0 0 ${W} ${ground + 10}" role="img" aria-label="平均獎勵組成">${out}</svg>
    <p class="small muted">紅色虛線＝上限：法定容積的 ${cap} 倍。</p>`;
}
function renderBonus(r) {
  const B = r.bonus, M = r.my_village;
  const scope = B.scope === "village" ? `本里（${esc(B.scope_label)}）` : B.scope === "town" ? `本區（${esc(B.scope_label)}）` : "全臺北";
  $("#blocks").innerHTML = `<h3>獎勵積木：${scope}過去 ${B.n_cases} 個都更基地的平均</h3>
    <div class="bhead"><b>+${pct(B.gain_mean)}</b><span class="muted">平均拿到的容積獎勵${B.gain_city_median != null ? `；全臺北中位數 +${pct(B.gain_city_median)}` : ""}</span></div>
    ${towerSvg(B)}
    <details><summary>每塊是什麼</summary><ul class="small">${B.blocks.map((b) => `<li>${esc(b.icon)} <b>${esc(b.short)}</b>（${b.code}）：${esc(b.plain)} ${B.n_cases > 1 ? `${pct(b.used_share)} 的基地有拿。` : ""}</li>`).join("")}</ul>
    <p class="small muted">每個基地的獎勵先除以它自己的法定容積，再取平均；沒拿那一項的基地算 0。容積移轉是買來的，不算獎勵。<a href="../bonus-translator/">看單一案件的積木 →</a></p></details>`;
  const C = 2 * Math.PI * 38;
  const VF = [["elderly", "👵", "高齡"], ["old_stock", "🏚", "老房子"], ["liquefaction", "🌊", "液化"], ["rescue", "🚒", "救災不便"], ["soft_story", "🏪", "軟弱層"]];
  const f = M.facts;
  $("#myv").innerHTML = `<h3>${esc(r.village.town_name)} ${esc(r.village.village_name)}</h3>
    <div class="vhead"><svg class="gauge" viewBox="0 0 92 92" role="img" aria-label="排進全市前 10% 的比例 ${M.top10_text}">
      <circle class="track" cx="46" cy="46" r="38" fill="none" stroke-width="10"/>
      <circle class="fill" cx="46" cy="46" r="38" fill="none" stroke-width="10" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - M.top10_share)}" transform="rotate(-90 46 46)"/>
      <text x="46" y="54" text-anchor="middle">${esc(M.top10_text)}</text></svg>
      <p>2000 種算法裡，這個里有 ${esc(M.top10_text)} 排進全市前 10%。</p></div>
    ${M.hidden_factors.length ? `<p class="silver">🔍 ${esc(M.hidden_factors.join("、"))}偏高，但總分不高，容易被忽略。</p>` : ""}
    <div class="tiles">${VF.map(([k, ic, nm]) => `<div class="tile${M.levels[k] >= 4 ? " dark" : ""}" style="background:var(--l${M.levels[k] || 1})"><span>${ic}</span><span class="tl">${M.levels[k] ?? "—"}</span>${nm}</div>`).join("")}</div>
    <p class="small muted">5 級＝全市最高約 7 個里。</p>
    ${M.silver ? `<div class="silver"><b>🏚 銀髮住宅狀況：${esc(M.silver.top_text)}</b>（456 里中第 ${fmt(M.silver.rank)} 名）<br>約 ${pct(M.silver.share)} 的人住在 30 年以上、沒電梯的 2～5 樓公寓。<span class="small muted">內政部統計處銀髮安居，113 年；比例與排序是推算。</span></div>` : ""}
    <div class="vfacts">
      <div class="vf"><span class="n">${fmt(f.heritage_sites_n)}</span><span class="l">🏛 文資（處）</span></div>
      <div class="vf"><span class="n">約 ${fmt(f.weilao_active_est, 1)}</span><span class="l">🏗 危老核准（推估）</span></div>
      <div class="vf"><span class="n">${fmt(f.sea_sand_cases_n)}</span><span class="l">🧱 海砂屋列管（案）</span></div>
      <div class="vf"><span class="n">${fmt(f.quake_listed_n)}</span><span class="l">⚠ 地震列管（筆）</span></div>
      <div class="vf"><span class="n">${f.uro_sites == null ? "整理中" : fmt(f.uro_sites)}</span><span class="l">📋 都更基地${f.uro_sites ? `（核定 ${fmt(f.uro_sites_approved)}）` : ""}</span></div>
    </div>`;
}

/* ---------------- 7. actions ---------------- */
function renderActions(r) {
  $("#actions").innerHTML = r.actions.map((a) => `<li><span class="t">${esc(a.plain_title || a.title)}<span class="mtag">${esc(a.money_tag || "")}</span></span>
    <span class="sub">${esc(a.title)}</span>
    <span>${esc(a.why)}</span>${a.notes && a.notes.length ? `<span class="note2">${a.notes.map(esc).join("；")}</span>` : ""}
    <div class="money">💰 ${esc(a.subsidy)}</div>
    <span class="who">下一步找：${a.next.url ? `<a href="${esc(a.next.url)}" target="_blank" rel="noopener">${esc(a.next.who)}</a>` : esc(a.next.who)}</span>
    <details><summary>出處</summary><span class="small">${esc(a.source)}</span></details></li>`).join("");
}

function submit() {
  const p = formParams();
  if (!p.addr && !p.v) { status("請先填門牌。", true); $("#in-addr").focus(); return; }
  page = 1;
  writeUrl(p);
  run(p, 1);
}

$("#form").addEventListener("submit", (e) => { e.preventDefault(); submit(); });
$("#in-age-unknown").addEventListener("change", (e) => { if (e.target.checked) $("#in-age").value = ""; });
$("#in-age").addEventListener("input", () => { if ($("#in-age").value) $("#in-age-unknown").checked = false; });
$("#in-village").addEventListener("change", () => { $("#in-addr").value = ""; });
$("#edit").addEventListener("click", () => { fillForm(readParams()); setMode("input"); });

buildNav();
page = hashPage();
const p0 = readParams();
fillForm(p0);
// The front-end teammate links here with the parameters already set: skip the input card.
if (p0.addr || p0.v) run(p0, page);
else { setMode("input"); document.body.dataset.ready = "1"; }

// Health report, map-first layout (map.html). Same URL params as index.html: ?addr=&age=&elder=
// (plus v=<village_code>, t=<town_code>, #w=1,1,3,3,1). All numbers come from lib/report.js; the only
// extra file read here is the liquefaction polygon layer from ../rescue-drill-map/data/ (map drawing only).
// Clicking a checklist item flies the map to the matching layer and highlights it.
import { buildReport, listVillages, DEFAULT_WEIGHTS, FACTORS } from "./lib/report.js";

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pct = (x, d = 0) => (x == null || isNaN(x) ? "—" : (x * 100).toFixed(d) + "%");
const fmt = (n, d = 0) => (n == null || isNaN(n) ? "—" : Number(n).toLocaleString("zh-TW", { minimumFractionDigits: d, maximumFractionDigits: d }));
const narrow = () => window.matchMedia("(max-width: 980px)").matches;

window.__errors = [];
window.addEventListener("error", (e) => window.__errors.push(String(e.message)));
window.addEventListener("unhandledrejection", (e) => window.__errors.push(String(e.reason)));

const LIQ_URL = "../rescue-drill-map/data/liq_high_city2019.geojson";
const SHELTER_URL = "data/shelters_weak.json"; // same file the engine uses for nearest_weak_shelter
const NEAR_M = 1000; // shelters drawn on the map: within this straight-line distance of home
let liqAll = null; // fetched once
let shelAll = null; // fetched once
let villages = null;
let map = null;
let L_ = {};      // current layers: vil, lanes, liq, her
let R = null;     // current report
let current = null;

/* ---------------- params (same as app.js) ---------------- */
function readParams() {
  const q = new URLSearchParams(location.search);
  const m = location.hash.match(/w=([\d.,]+)/);
  let w = DEFAULT_WEIGHTS;
  if (m) {
    const x = m[1].split(",").map(Number);
    if (x.length === 5 && x.every((v) => v >= 0 && v <= 4)) w = x;
  }
  return { addr: q.get("addr") || "", age: q.get("age") ?? "", elder: q.get("elder") ?? "", v: q.get("v") || "", t: q.get("t") || "", w };
}
function fillForm(p) {
  $("#in-addr").value = p.addr;
  $("#in-age").value = p.age;
  document.querySelectorAll('input[name="elder"]').forEach((r) => { r.checked = r.value === String(p.elder); });
}
function formParams() {
  const el = document.querySelector('input[name="elder"]:checked');
  const p = readParams();
  return { addr: $("#in-addr").value.trim(), age: $("#in-age").value.trim(), elder: el ? el.value : "", v: $("#vpick").hidden ? "" : $("#in-village").value, t: p.t, w: p.w };
}
function queryOf(p) {
  const q = new URLSearchParams();
  if (p.addr) q.set("addr", p.addr);
  if (p.age !== "") q.set("age", p.age);
  if (p.elder !== "") q.set("elder", p.elder);
  if (p.v) q.set("v", p.v);
  if (p.t) q.set("t", p.t);
  return "?" + q.toString() + (p.w.join(",") !== DEFAULT_WEIGHTS.join(",") ? "#w=" + p.w.join(",") : "");
}
function status(msg, err) { const s = $("#status"); s.textContent = msg; s.className = err ? "status err" : "status"; }

async function showVillagePicker(code) {
  if (!villages) villages = await listVillages();
  const towns = [...new Map(villages.map((v) => [v.town_code, v.town_name])).entries()].sort();
  const tSel = $("#in-town"), vSel = $("#in-village");
  const fillV = (want) => {
    const vs = villages.filter((v) => v.town_code === tSel.value).sort((a, b) => a.village_name.localeCompare(b.village_name, "zh-Hant"));
    vSel.innerHTML = vs.map((v) => `<option value="${v.village_code}">${esc(v.village_name)}</option>`).join("");
    if (want) vSel.value = want;
  };
  if (!tSel.options.length) {
    tSel.innerHTML = towns.map(([c, n]) => `<option value="${c}">${esc(n)}</option>`).join("");
    tSel.addEventListener("change", () => fillV());
  }
  const cur = villages.find((v) => v.village_code === code);
  if (cur) tSel.value = cur.town_code;
  fillV(cur && cur.village_code);
  $("#vpick").hidden = false;
}

/* ---------------- run ---------------- */
async function run(p) {
  status("整理中⋯（第一次要讀全市門牌，約幾秒）");
  let r;
  try {
    [r] = await Promise.all([
      buildReport({ addr: p.addr, age: p.age, elder: p.elder }, { village_code: p.v || undefined, town_code: p.t || undefined, weights: p.w }),
      liqAll ? null : fetch(LIQ_URL).then((x) => (x.ok ? x.json() : null)).then((j) => { liqAll = j; }).catch(() => { liqAll = null; }),
      shelAll ? null : fetch(SHELTER_URL).then((x) => (x.ok ? x.json() : null)).then((j) => { shelAll = j; }).catch(() => { shelAll = null; }),
    ]);
  } catch (e) {
    status(`資料讀不到（${e.message}）。請先產生各原型的 data/（見 README），並用 http 伺服器開這頁。`, true);
    return;
  }
  window.__report = r;
  R = r;
  $("#to-sheet").href = "./" + queryOf(p);
  document.querySelectorAll(".form .need").forEach((x) => x.classList.remove("need"));
  if (r.missing.includes("age")) $(".f-age").classList.add("need");
  if (r.missing.includes("elder")) $(".f-elder").classList.add("need");
  const sug = $("#suggest");
  sug.hidden = true;
  if (r.address.match === "similar") {
    sug.innerHTML = `<span class="hint">沒有完全一樣的門牌，挑一個相近的：</span>` +
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
  if (!r.village) { $("#main").hidden = true; return; }
  $("#main").hidden = false;
  renderHead(r);
  renderBuilding(r);
  renderRank(r);
  renderChecklist(r);
  renderActions(r);
  renderBonus(r);
  renderMap(r);
  $("#sources").innerHTML = r.sources.map((s) => `<li><b>${esc(s.part)}</b>：${esc(s.text)}</li>`).join("");
  document.body.dataset.ready = "1";
}

/* ---------------- left: hero, building, ranking ---------------- */
function renderHead(r) {
  const b = r.building, v = r.village, a = r.age;
  const est = a.estimated == null
    ? `<div class="age none"><b>判不出來</b><span>我們推估的屋齡</span></div>`
    : `<div class="age est"><b>${a.estimated}<small> 年</small></b><span>我們推估（${esc(a.estimated_source)}，${a.built_year_estimated} 年建）</span></div>`;
  const usr = a.user == null
    ? `<div class="age none"><b>未填</b><span>你填的屋齡</span></div>`
    : `<div class="age"><b>${a.user}<small> 年</small></b><span>你填的（約 ${a.built_year_user} 年建）</span></div>`;
  let gap = "";
  if (b && b.age_gap != null && Math.abs(b.age_gap) >= 3) gap = `<p class="gap">⚠ 兩個屋齡差 ${Math.abs(b.age_gap)} 年。以使用執照為準；我們的推估${b.built_year_confirmed ? "來自官方清冊" : "可能不準"}。</p>`;
  const elder = r.input.elder == null ? `<span class="pill">👵 有無長者：未填</span>` : r.input.elder ? `<span class="pill warn">👵 家裡有長者</span>` : `<span class="pill">家裡沒有長者</span>`;
  const pre = b && b.pre1999 != null ? (b.pre1999 ? `<span class="pill warn">📐 1999 前申請建造（推估）</span>` : `<span class="pill ok">📐 1999 後申請建造（推估）</span>`) : "";
  $("#s-head").innerHTML = `
    <p class="addr">${b ? esc((v.town_name || "") + b.address) : esc(r.input.addr || "（沒有門牌）")}</p>
    <p class="vill">${esc(v.town_name)} ${esc(v.village_name)}${b ? "" : "（只看里的部分）"}</p>
    <div class="ages">${usr}${est}</div>${gap}
    <div class="pills">${elder}${pre}</div>
    ${r.nearest_weak_shelter ? (() => { const s = r.nearest_weak_shelter; return `<p class="nshel">♿ 最近的適合避難弱者收容所：<b>${esc(s.name)}</b>，${s.from === "home" ? "離你家" : "離里的中心"}直線約 <b>${fmt(s.distance_m)} m</b>${s.cap ? `，約 ${fmt(s.cap)} 人` : ""}（推估，不是步行路線）</p>`; })() : ""}`;
}

function renderBuilding(r) {
  const b = r.building;
  if (!b) {
    $("#bldg").innerHTML = `<p class="nobldg">沒有對上確切門牌，這一節不顯示逐棟資料與列管旗標。輸入完整門牌（含號）再試一次。</p>`;
    return;
  }
  const yr = b.built_year ? `${b.built_year} 年${b.built_year_range ? `（${b.built_year_range[0]}～${b.built_year_range[1]}）` : ""}` : "判不出來";
  const cells = [
    [yr, `📅 建造年（${b.age_source_label}）`, !b.built_year_confirmed],
    [b.pre1999 == null ? "判不出來" : b.pre1999 ? "1999 前" : "1999 後", "📐 耐震規範（申請建造日）", true, b.pre1999 === true],
    [b.floors ? `${b.floors} 層` : "—", `🏢 ${b.building_type_label || "樓層"}`],
    [b.has_elevator === true ? "有電梯" : b.has_elevator === false ? "沒有電梯" : "不確定", "🛗 電梯（實價登錄）", b.has_elevator != null],
    [b.soft_story_candidate ? `${b.soft_story_candidate} 型候選` : "不是候選", "🧱 一樓軟弱層", !!b.soft_story_candidate, !!b.soft_story_candidate],
    [b.liq_label, "💧 液化潛勢（區域尺度）", false, b.liq_level === "high"],
    [b.units ? `約 ${b.units} 戶` : "—", "👥 門牌數當戶數"],
    [b.structure_label || "—", "🏗 構造"],
  ];
  const flags = [];
  if (b.flags.sea_sand) flags.push(`<p class="flag"><b>已確認：市府列管海砂屋</b>（${esc(b.flags.sea_sand.kind_label)}）。清冊原文：${esc(b.flags.sea_sand.list_address)}，${esc(b.flags.sea_sand.list_version)} 版。</p>`);
  if (b.flags.quake_listed) flags.push(`<p class="flag"><b>已確認：${esc(b.flags.quake_listed.event)} 地震受損列管（黃單）</b>。清冊原文：${esc(b.flags.quake_listed.list_address)}，${esc(b.flags.quake_listed.list_version)} 版。列管狀態以建管處為準。</p>`);
  $("#bldg").innerHTML = `<div class="facts">${cells.map(([v, k, est, bad]) =>
    `<div class="fc${est ? " est" : ""}${bad ? " bad" : ""}"><span class="v">${esc(v)}</span><span class="k">${esc(k)}</span></div>`).join("")}</div>
    ${flags.join("")}
    ${b.near_heritage_50m ? `<p class="hint">50 公尺內有 ${b.heritage_n_50m} 處文資建物。</p>` : ""}
    <p class="hint small">黃底＝推估或候選，不是官方認定。</p>`;
}

function renderRank(r) {
  const k = r.ranking, M = r.my_village;
  if (!k) { $("#rank").innerHTML = "<p>沒有這個里的排名資料。</p>"; return; }
  $("#rank").innerHTML = `
    <p class="rbig"><b>第 ${k.rank} 名</b><span>／${k.n_villages} 里</span></p>
    <p class="muted rank-p">權重 ${k.weights.join("、")}；等權時第 ${k.rank_equal} 名。名次越前面越該先處理，相對於臺北其他里。</p>
    <div class="chips5" aria-label="5 因子等級，5 級最高">${FACTORS.map((f) => `<div class="chip5${k.levels[f.k] >= 4 ? " dark" : ""}" style="background:var(--l${k.levels[f.k] || 1})"><b>${k.levels[f.k] ?? "—"}</b>${esc(f.name)}</div>`).join("")}</div>
    <p class="rank-p">${esc(k.sentence[0])}</p>
    <div class="stab"><span>前 ${k.top_k} 名</span><span class="bar"><i style="width:${pct(k.top_k_share)}"></i></span><b>${pct(k.top_k_share)}</b></div>
    <p class="muted rank-p">${esc(k.sentence[1])}隨機權重名次 ${k.rank_range.p05}～${k.rank_range.p95}（中位 ${k.rank_range.p50}）。</p>
    ${M ? `<p class="rank-p">2000 種算法裡，這個里有 <b>${esc(M.top10_text)}</b> 排進全市前 10%。</p>` : ""}
    <p class="small"><a href="../priority-ranking/#w=${k.weights.join(",")}">在排序頁調權重 →</a></p>`;
}

/* ---------------- right: checklist, actions ---------------- */
// checklist id -> map layer to fly to
const CHECK_LAYER = { lanes: "lanes", hydrant: "lanes", liq: "liq", elder80: "vil", heritage: "her", soft: "vil", shelter: "shelter", apply: "vil" };
const LAYER_NAME = { vil: "里界", lanes: "窄巷", liq: "液化高潛勢", her: "文資點", fire: "消防通道", shelter: "收容所" };

function renderChecklist(r) {
  $("#check-note").hidden = !r.checklist_note;
  $("#check-note").textContent = r.checklist_note || "";
  $("#check").innerHTML = r.checklist.map((c, i) => `<li data-id="${esc(c.id)}">
    <label class="cb" for="ck${i}"><input type="checkbox" id="ck${i}" aria-label="做完了：${esc(c.title)}"></label>
    <button type="button" class="go" data-i="${i}"><span class="ic" aria-hidden="true">${c.icon}</span>
      <span>${esc(c.title)}${r.input.elder === 1 && c.elder_related ? `<span class="eld">長者</span>` : ""}</span>
      <span class="pin">📍 看地圖：${LAYER_NAME[CHECK_LAYER[c.id] || "vil"]}</span></button></li>`).join("");
  $("#check").querySelectorAll("button.go").forEach((b) => b.addEventListener("click", () => {
    const c = R.checklist[+b.dataset.i];
    focus(CHECK_LAYER[c.id] || "vil", c, true);
  }));
}

function renderActions(r) {
  $("#actions").innerHTML = r.actions.map((a) => `<li><span class="t">${esc(a.title)}</span>
    <span class="why">${esc(a.why)}</span>
    <div class="money">💰 ${esc(a.subsidy)}</div>
    <span class="who">下一步找：${a.next.url ? `<a href="${esc(a.next.url)}" target="_blank" rel="noopener">${esc(a.next.who)}</a>` : esc(a.next.who)}</span>
    <details><summary>出處</summary><span class="small">${esc(a.source)}</span></details></li>`).join("");
}

/* ---------------- bottom strip: bonus blocks ---------------- */
function renderBonus(r) {
  const B = r.bonus;
  if (!B) { $("#s-bonus").hidden = true; return; }
  $("#s-bonus").hidden = false;
  const scope = B.scope === "village" ? `本里（${esc(B.scope_label)}）` : B.scope === "town" ? `本區（${esc(B.scope_label)}）` : "全臺北";
  const F = 1 + B.blocks.reduce((s, b) => s + b.mean_pct_of_F0, 0);
  const span = Math.max(F, B.cap_multiple) * 1.02;
  const w = (x) => (x / span * 100).toFixed(2) + "%";
  $("#s-bonus").innerHTML = `
    <div><h2>🧱 容積獎勵積木</h2><div class="big">+${pct(B.gain_mean)}</div>
      <span class="muted">${scope}過去 ${B.n_cases} 個都更基地的平均</span></div>
    <div class="bwrap">
      <div class="stack" role="img" aria-label="法定容積加上平均獎勵組成，上限 ${B.cap_multiple} 倍">
        <span class="f0" style="width:${w(1)}">法定容積</span>
        ${B.blocks.map((b) => `<span style="width:${w(b.mean_pct_of_F0)};background:${b.color}" title="${esc(b.short)} +${pct(b.mean_pct_of_F0, 1)}"></span>`).join("")}
        <i class="capline" style="left:${w(B.cap_multiple)}"><span class="caplab">上限 ${B.cap_multiple} 倍</span></i>
      </div>
      <ul class="bkeys">${B.blocks.map((b) => `<li><i style="background:${b.color}"></i>${esc(b.icon)} ${esc(b.short)} +${pct(b.mean_pct_of_F0, 1)}</li>`).join("")}</ul>
    </div>
    <p class="sline small muted">${B.gain_city_median != null ? `全臺北中位數 +${pct(B.gain_city_median)}。` : ""}每個基地的獎勵先除以它自己的法定容積再平均，沒拿那一項算 0。容積移轉是買來的，不算獎勵。<a href="../bonus-translator/">看單一案件的積木 →</a></p>`;
}

/* ---------------- center: map ---------------- */
const STY = {
  vil: { normal: { color: "#111", weight: 3, fillColor: "#db6a41", fillOpacity: 0.06, dashArray: "6 4" },
    dim: { color: "#111", weight: 2, fillOpacity: 0.02, dashArray: "6 4" },
    hi: { color: "#db6a41", weight: 6, fillColor: "#db6a41", fillOpacity: 0.14, dashArray: null } },
  liq: { normal: { color: "#2b6cb0", weight: 0.5, fillColor: "#2b6cb0", fillOpacity: 0.22 },
    dim: { color: "#2b6cb0", weight: 0, fillColor: "#2b6cb0", fillOpacity: 0.07 },
    hi: { color: "#1a4a80", weight: 2, fillColor: "#2b6cb0", fillOpacity: 0.5 } },
  pt: { normal: { radius: 8, weight: 1.5, color: "#fff", fillOpacity: 0.95, opacity: 1 },
    dim: { radius: 5, weight: 1, color: "#fff", fillOpacity: 0.3, opacity: 0.4 },
    hi: { radius: 12, weight: 3, color: "#111", fillOpacity: 1, opacity: 1 } },
};

function bboxIntersects(feature, vb) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const walk = (c) => { if (typeof c[0] === "number") { minX = Math.min(minX, c[0]); maxX = Math.max(maxX, c[0]); minY = Math.min(minY, c[1]); maxY = Math.max(maxY, c[1]); } else c.forEach(walk); };
  walk(feature.geometry.coordinates);
  return !(maxX < vb.getWest() || minX > vb.getEast() || maxY < vb.getSouth() || minY > vb.getNorth());
}

function renderMap(r) {
  const M = r.rescue && r.rescue.map;
  if (!M) return;
  if (!window.L) { $("#map").textContent = "地圖套件載入失敗。"; return; }
  if (!map) {
    map = L.map("map", { zoomControl: true, scrollWheelZoom: true });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(map);
  }
  Object.values(L_).forEach((l) => l && map.removeLayer(l));
  L_ = {};
  L_.vil = L.geoJSON(M.village, { style: STY.vil.normal, interactive: false });
  const vb = L_.vil.getBounds();
  L_.liq = liqAll ? L.geoJSON({ type: "FeatureCollection", features: liqAll.features.filter((f) => bboxIntersects(f, vb.pad(0.2))) },
    { style: STY.liq.normal, interactive: false }) : null;
  L_.lanes = L.geoJSON(M.lanes, {
    pointToLayer: (x, p) => L.circleMarker(p, { ...STY.pt.normal, fillColor: x.properties.zone === "red" ? "#c0392b" : "#d08a00" }),
    onEachFeature: (x, l) => l.bindTooltip(`🚒 ${esc(x.properties.lane_name)}（${x.properties.zone === "red" ? "紅區" : "黃區"}，寬 ${x.properties.width_m} m）`),
  });
  L_.her = L.geoJSON(M.heritage, {
    pointToLayer: (x, p) => L.circleMarker(p, { ...STY.pt.normal, radius: 7, fillColor: "#6b46c1" }),
    onEachFeature: (x, l) => l.bindTooltip(`🏛️ ${esc(x.properties.case_name)}`),
  });
  // home pin, nearest shelter with a dashed line, and weak-friendly shelters near home
  const h = r.home, s = r.nearest_weak_shelter;
  if (h) {
    const isHome = h.source === "building_points";
    L_.home = L.marker([h.lat, h.lon], { icon: L.divIcon({ className: "pin-label home-pin", html: `<span>${isHome ? "🏠 你家" : "📍 里中心"}</span>`, iconSize: [0, 0], iconAnchor: [0, 0] }), keyboard: false, title: h.label, zIndexOffset: 1000 });
  }
  const center = h ? [h.lon, h.lat] : [vb.getCenter().lng, vb.getCenter().lat];
  const isNearest = (x) => s && x.name === s.name && x.lon === s.lon && x.lat === s.lat;
  const near = shelAll ? shelAll.items.filter((x) => distM(center[0], center[1], x.lon, x.lat) <= NEAR_M || isNearest(x)) : [];
  L_.shel = L.layerGroup(near.map((x) => {
    const m = L.circleMarker([x.lat, x.lon], { ...STY.pt.normal, fillColor: "#2f855a" });
    m.bindTooltip(`♿ ${esc(x.name)}${x.cap ? `（約 ${fmt(x.cap)} 人）` : ""}，${isNearest(x) ? "最近一處，" : ""}直線約 ${fmt(Math.round(distM(center[0], center[1], x.lon, x.lat) / 10) * 10)} m`);
    return m;
  }));
  if (s) {
    L_.nearPin = L.marker([s.lat, s.lon], { icon: L.divIcon({ className: "pin-label shel-pin", html: `<span>♿ ${esc(s.name)}</span>`, iconSize: [0, 0], iconAnchor: [0, 0] }), keyboard: false, title: s.name, zIndexOffset: 900 });
    if (h) L_.near = L.polyline([[h.lat, h.lon], [s.lat, s.lon]], { color: "#2f855a", weight: 3, dashArray: "6 6" }).bindTooltip(`直線約 ${fmt(s.distance_m)} m（不是步行路線）`);
  }
  homeBounds = L.latLngBounds(vb.getSouthWest(), vb.getNorthEast());
  if (h) homeBounds.extend([h.lat, h.lon]);
  if (s) homeBounds.extend([s.lat, s.lon]);
  // Give the map a view BEFORE adding vector layers: Leaflet's Polyline._clipPoints reads the renderer's
  // _bounds, which is undefined on a map without a view ("Cannot read properties of undefined (reading 'min')").
  map.invalidateSize();
  map.fitBounds(homeBounds, { padding: [24, 24], maxZoom: 17 });
  ["liq", "vil", "near", "shel", "lanes", "her", "nearPin", "home"].forEach((k) => L_[k] && L_[k].addTo(map));
  renderLegend(r);
  renderBars(r);
  current = null;
  setTimeout(() => { map.invalidateSize(); map.fitBounds(homeBounds, { padding: [24, 24], maxZoom: 17 }); }, 50);
  setFocusText(null);
}
let homeBounds = null;
function distM(lon1, lat1, lon2, lat2) {
  const R = 6371008.8, rad = Math.PI / 180, dLat = (lat2 - lat1) * rad, dLon = (lon2 - lon1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function renderLegend(r) {
  const M = r.rescue.map;
  const chips = [
    ["vil", `<i class="sq" style="border:2px dashed #111"></i>里界`],
    ["lanes", `<i style="background:#c0392b"></i>窄巷 ${M.lanes.features.length}`],
    ["liq", `<i class="sq" style="background:#2b6cb066;border:1px solid #2b6cb0"></i>液化高潛勢`],
    ["her", `<i style="background:#6b46c1"></i>文資 ${M.heritage.features.length}`],
    ["fire", `🚒 消防通道 ${M.fire_access_lanes.length}（無座標）`, true],
    ["shelter", `<i style="background:#2f855a"></i>♿ 弱者收容所 ${L_.shel ? L_.shel.getLayers().length : 0}`],
  ];
  $("#legend").innerHTML = chips.map(([k, h, nc]) => `<button type="button" data-k="${k}" aria-pressed="false"${nc ? ` class="nocoord"` : ""}>${h}</button>`).join("") +
    `<button type="button" data-k="" aria-pressed="false">↺ 全部</button>`;
  $("#legend").querySelectorAll("button").forEach((b) => b.addEventListener("click", () => focus(b.dataset.k || null, null, false)));
}

// The five rescue bars (same numbers as index.html). A bar with a map layer focuses that layer.
const BAR_STYLE = { lanes: ["🚒", "#c0392b", "lanes"], liq: ["💧", "#2b6cb0", "liq"], old: ["🏚️", "#d08a00", "vil"], heritage: ["🏛️", "#6b46c1", "her"], soft: ["🏢", "#8a949e", "vil"] };
function renderBars(r) {
  const X = r.rescue;
  $("#bars").innerHTML = X.bars.map((b) => `<button type="button" class="ibar" data-k="${BAR_STYLE[b.k][2]}">
      <span class="bk"><span>${BAR_STYLE[b.k][0]} ${esc(b.label)}</span><b>${esc(b.text)}</b></span>
      <span class="bar"><i style="width:${(Math.max(0, Math.min(1, b.ratio)) * 100).toFixed(1)}%;background:${BAR_STYLE[b.k][1]}"></i></span>
      ${b.sub ? `<span class="bs">${esc(b.sub)}</span>` : ""}</button>`).join("") +
    `<p class="lvn">${X.s5_candidate ? "<b>救災可及性候選里。</b>" : ""}長條是本里相對全市最高里的比例。</p>`;
  $("#bars").querySelectorAll("button.ibar").forEach((b) => b.addEventListener("click", () => focus(b.dataset.k, null, false)));
}

function styleAll(key) {
  // the no-coordinate layer (fire access lanes) highlights the village boundary instead
  const k2 = key === "fire" ? "vil" : key;
  const m = (k) => (k2 == null ? "normal" : k === k2 ? "hi" : "dim");
  if (L_.vil) L_.vil.setStyle(STY.vil[m("vil") === "dim" ? "normal" : m("vil")]);
  if (L_.liq) L_.liq.setStyle(STY.liq[m("liq")]);
  [["lanes", L_.lanes], ["her", L_.her], ["shelter", L_.shel]].forEach(([k, g]) => g && g.eachLayer((l) => {
    const s = STY.pt[m(k)];
    l.setStyle({ weight: s.weight, color: s.color, fillOpacity: s.fillOpacity, opacity: s.opacity });
    l.setRadius(k === "her" && m(k) === "normal" ? 7 : s.radius);
    const el = l.getElement && l.getElement();
    if (el) el.classList.toggle("hl-pulse", m(k) === "hi");
  }));
  if (L_.vil) L_.vil.eachLayer((l) => { const el = l.getElement && l.getElement(); if (el) el.classList.toggle("hl-pulse", m("vil") === "hi"); });
  if (L_.near) L_.near.setStyle({ weight: k2 === "shelter" ? 5 : 3, opacity: k2 == null || k2 === "shelter" ? 1 : 0.4 });
  const front = { lanes: L_.lanes, her: L_.her, shelter: L_.shel }[k2];
  if (front) front.eachLayer((l) => l.bringToFront());
}

// Focus a layer. item = checklist entry (optional) for the explanation text.
function focus(key, item, fromCheck) {
  current = key;
  [L_.lanes, L_.her, L_.shel].forEach((g) => g && g.eachLayer((l) => l.closeTooltip && l.closeTooltip()));
  styleAll(key);
  // hydrant item: enlarge the farthest lane (its name is in the title)
  if (item && item.id === "hydrant" && L_.lanes) {
    L_.lanes.eachLayer((l) => { if (item.title.includes(l.feature.properties.lane_name)) { l.setRadius(15); l.bringToFront(); l.openTooltip(); } });
  }
  document.querySelectorAll("#legend button").forEach((b) => b.setAttribute("aria-pressed", String((b.dataset.k || null) === key)));
  document.querySelectorAll("#check li").forEach((li) => li.setAttribute("aria-current", String(!!item && li.dataset.id === item.id)));
  let b = L_.vil && L_.vil.getBounds();
  if (key === "lanes" && L_.lanes && L_.lanes.getLayers().length) b = L_.lanes.getBounds().extend(b.getCenter());
  if (key === "her" && L_.her && L_.her.getLayers().length) b = L_.her.getBounds().extend(b.getCenter());
  if (key === "shelter" && homeBounds) {
    b = L.latLngBounds(homeBounds.getSouthWest(), homeBounds.getNorthEast());
    // frame home and the three nearest drawn shelters, so the labels stay readable
    const c = homeBounds.getCenter(), hp = R.home ? L.latLng(R.home.lat, R.home.lon) : c;
    if (L_.shel) L_.shel.getLayers().map((l) => l.getLatLng()).sort((x, y) => hp.distanceTo(x) - hp.distanceTo(y)).slice(0, 3).forEach((ll) => b.extend(ll));
  }
  if (b && b.isValid()) {
    if (b.getNorthEast().equals(b.getSouthWest())) map.flyTo(b.getCenter(), 17, { duration: 0.7 });
    else map.flyToBounds(b, { padding: [40, 40], maxZoom: 17, duration: 0.7 });
  }
  setFocusText(key, item);
  if (fromCheck && narrow()) {
    const top = $(".mapbox").getBoundingClientRect().top;
    if (top < 0 || top > window.innerHeight * 0.5) $(".mapbox").scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function setFocusText(key, item) {
  const r = R, X = r.rescue, M = X.map;
  const bar = (k) => X.bars.find((b) => b.k === k) || {};
  const sh = (r.checklist.find((c) => c.id === "shelter") || {}).shelters || [];
  const S = r.nearest_weak_shelter, nShel = L_.shel ? L_.shel.getLayers().length : 0;
  const laneNames = M.lanes.features.map((f) => f.properties);
  const fireList = M.fire_access_lanes.length ? `<details><summary>消防通道清冊 ${M.fire_access_lanes.length} 條（無座標，不在地圖上）</summary><ul>${M.fire_access_lanes.map((x) => `<li>${esc(x.lane_name)}：${esc(x.criteria)}（${esc(x.fire_unit)}）</li>`).join("")}</ul></details>` : "";
  const T = {
    null: `<b>🗺 ${esc(r.village.town_name)} ${esc(r.village.village_name)}</b><br>${r.home ? (r.home.source === "building_points" ? "🏠 是你家（門牌座標）；" : "📍 是里的中心（約略，不是你家）；") : ""}黑虛線是里界；紅黃點是列管窄巷，紫點是文資，綠點是適合避難弱者的收容所，藍色是液化高潛勢區。點右邊的檢核項目，或上面的圖層，地圖會跳過去。${X.s5_candidate ? "<br>這個里是救災可及性候選里。" : ""}`,
    vil: `<b>🗺 里界：${esc(r.village.town_name)} ${esc(r.village.village_name)}</b><br>人口 ${fmt(r.village.pop_total)} 人，80 歲以上約 ${fmt(X.pop_80plus)} 人（${pct(X.share_80plus)}；全市中位數 ${pct(X.share_80plus_city_median)}）。`,
    lanes: `<b>🚒 列管窄巷 ${esc(bar("lanes").text)}</b>（${esc(bar("lanes").sub)}）<br>地圖上 ${laneNames.length} 個點是紅黃區窄巷，位置是該巷門牌中心（推估）。${laneNames.length ? `<ul>${laneNames.slice(0, 8).map((x) => `<li>${esc(x.lane_name)}：${x.zone === "red" ? "紅區" : "黃區"}，寬 ${x.width_m} m</li>`).join("")}${laneNames.length > 8 ? `<li>還有 ${laneNames.length - 8} 條</li>` : ""}</ul>` : ""}${fireList}`,
    liq: `<b>💧 液化高潛勢占里面積 ${esc(bar("liq").text)}</b><br>城市版 2019，區域尺度，不是這一棟的鑑定。${r.building ? `這一棟的液化潛勢：${esc(r.building.liq_label)}。` : ""}${liqAll ? "" : "<br><span class='nc'>液化圖層沒讀到。</span>"}`,
    her: `<b>🏛️ 文資點 ${esc(bar("heritage").text)}</b><br>文化部文資局開放資料的代表點，不是保存範圍。${r.building && r.building.near_heritage_50m ? `這一棟 50 公尺內有 ${r.building.heritage_n_50m} 處。` : ""}`,
    fire: `<b>🚒 消防通道</b><br><span class="nc">消防通道清冊沒有座標，地圖畫不出來，先列在這裡。</span>${fireList || "<br>本里沒有列到消防通道。"}`,
    shelter: `<b>♿ 適合避難弱者的收容所</b><br>地圖上綠點是${r.home && r.home.source === "building_points" ? "你家" : "里中心"}直線 ${fmt(NEAR_M)} m 內的 ${nShel} 處（消防署標「適合避難弱者」且含震災）。${S ? `最近一處是 <b>${esc(S.name)}</b>，直線約 ${fmt(S.distance_m)} m${S.cap ? `，約 ${fmt(S.cap)} 人` : ""}，綠虛線連到它；直線不是步行路線。` : ""}${shelAll ? "" : "<br><span class='nc'>收容所圖層沒讀到。</span>"}
      ${sh.length ? `<details><summary>教育局一覽表：服務本里的震災收容所 ${sh.length} 處（沒有座標，不在地圖上）</summary><ul>${sh.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></details>` : ""}`,
  };
  let h = T[key] ?? T.null;
  if (item) {
    h = `<b>${item.icon} ${esc(item.title)}</b><br>${esc(item.detail)}` +
      (item.id === "elder80" || item.id === "soft" || item.id === "apply"
        ? `<br><span class="nc">${item.id === "elder80" ? "住戶沒有位置資料（名冊不公開），地圖框出整個里。" : item.id === "soft" ? `軟弱層候選 ${esc(bar("soft").text)}；逐棟位置沒有放進這頁的資料，地圖框出整個里。` : "地圖框出整個里。"}</span>`
        : `<hr style="border:0;border-top:1px solid var(--line)">${T[key] ?? ""}`);
  }
  $("#focus").innerHTML = h;
}

/* ---------------- form ---------------- */
function submit() {
  const p = formParams();
  history.replaceState(null, "", queryOf(p));
  run(p);
}
$("#form").addEventListener("submit", (e) => { e.preventDefault(); submit(); });
document.querySelectorAll('input[name="elder"]').forEach((r) => r.addEventListener("change", submit));
$("#in-village").addEventListener("change", () => { $("#in-addr").value = ""; submit(); });

const p0 = readParams();
fillForm(p0);
run(p0);

// Health report page ("健檢單"). Reads ?addr=&age=&elder= (plus optional v=<village_code>, t=<town_code>,
// #w=1,1,3,3,1), calls lib/report.js, and draws the sections. All numbers come from the engine.
import { buildReport, listVillages, DEFAULT_WEIGHTS, FACTORS } from "./lib/report.js";

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pct = (x, d = 0) => (x == null || isNaN(x) ? "—" : (x * 100).toFixed(d) + "%");
const fmt = (n, d = 0) => (n == null || isNaN(n) ? "—" : Number(n).toLocaleString("zh-TW", { minimumFractionDigits: d, maximumFractionDigits: d }));
const afterPaint = (fn) => { requestAnimationFrame(() => requestAnimationFrame(fn)); setTimeout(fn, 80); };

window.__errors = [];
window.addEventListener("error", (e) => window.__errors.push(String(e.message)));
window.addEventListener("unhandledrejection", (e) => window.__errors.push(String(e.reason)));

let map = null, mapLayers = [];
let villages = null;

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

function writeUrl(p) {
  const q = new URLSearchParams();
  if (p.addr) q.set("addr", p.addr);
  if (p.age !== "") q.set("age", p.age);
  if (p.elder !== "") q.set("elder", p.elder);
  if (p.v) q.set("v", p.v);
  if (p.t) q.set("t", p.t);
  history.replaceState(null, "", "?" + q.toString() + (p.w.join(",") !== DEFAULT_WEIGHTS.join(",") ? "#w=" + p.w.join(",") : ""));
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

async function run(p) {
  status("整理中⋯（第一次要讀全市門牌，約幾秒）");
  let r;
  try {
    r = await buildReport({ addr: p.addr, age: p.age, elder: p.elder }, { village_code: p.v || undefined, town_code: p.t || undefined, weights: p.w });
  } catch (e) {
    status(`資料讀不到（${e.message}）。請先產生各原型的 data/（見 README），並用 http 伺服器開這頁。`, true);
    return;
  }
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
  if (!r.village) { $("#report").hidden = true; $("#s-head").hidden = true; return; }
  $("#report").hidden = false;
  $("#s-head").hidden = false;
  renderHead(r);
  renderBuilding(r);
  renderRank(r);
  renderMap(r);
  renderChecklist(r);
  renderBonus(r);
  renderActions(r);
  $("#sources").innerHTML = r.sources.map((s) => `<li><b>${esc(s.part)}</b>：${esc(s.text)}</li>`).join("");
  document.body.dataset.ready = "1";
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
    <div class="rbig"><b>第 ${k.rank} 名</b><span>／${k.n_villages} 里（權重 ${k.weights.join("、")}）</span></div>
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
function renderMap(r) {
  const R = r.rescue;
  if (!R) return;
  const LV = [["👵", "高齡", "elderly"], ["🏚️", "老屋", "old_stock"], ["💧", "液化", "liquefaction"], ["🚒", "救災", "rescue"], ["🏢", "軟弱層", "soft_story"]];
  $("#bars").innerHTML = `${R.s5_candidate ? `<p class="pill warn">救災可及性候選里</p>` : ""}
    ${R.bars.map((b) => `<div class="brow"><span class="ic" aria-hidden="true">${BAR_STYLE[b.k][0]}</span>
      <div><div class="bk"><span>${esc(b.label)}</span><b>${esc(b.text)}</b></div>
      <div class="bar"><i style="width:${(Math.max(0, Math.min(1, b.ratio)) * 100).toFixed(1)}%;background:${BAR_STYLE[b.k][1]}"></i></div>
      ${b.sub ? `<div class="bs">${esc(b.sub)}</div>` : ""}</div></div>`).join("")}
    <div class="lvs">${LV.map(([ic, nm, k]) => { const l = R.levels[k]; return `<div class="lvc"><div class="lvb"><i style="height:${(l.level || 0) * 20}%;background:var(--l${l.level || 1})"></i></div><div>${ic} ${nm}</div><div class="lvt">${esc(l.label)}</div></div>`; }).join("")}</div>
    <p class="bs">長條是本里相對全市最高里的比例。</p>
    ${r.nearest_weak_shelter ? (() => { const s = r.nearest_weak_shelter; return `<div class="nshel"><span class="ic" aria-hidden="true">♿</span><div><b>最近的適合避難弱者收容所</b><br>${esc(s.name)}：${s.from === "home" ? "離你家" : "離里的中心"}直線約 <b>${fmt(s.distance_m)} m</b>${s.cap ? `，約 ${fmt(s.cap)} 人` : ""}<div class="bs">${esc(s.note)}</div></div></div>`; })() : ""}`;
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
  $("#myv").innerHTML = `<h3>我的里</h3>
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
  $("#actions").innerHTML = r.actions.map((a) => `<li><span class="t">${esc(a.title)}</span>
    <span>${esc(a.why)}</span>
    <div class="money">💰 ${esc(a.subsidy)}</div>
    <span class="who">下一步找：${a.next.url ? `<a href="${esc(a.next.url)}" target="_blank" rel="noopener">${esc(a.next.who)}</a>` : esc(a.next.who)}</span>
    <details><summary>出處</summary><span class="small">${esc(a.source)}</span></details></li>`).join("");
}

function submit() {
  const p = formParams();
  writeUrl(p);
  run(p);
}

$("#form").addEventListener("submit", (e) => { e.preventDefault(); submit(); });
document.querySelectorAll('input[name="elder"]').forEach((r) => r.addEventListener("change", submit));
$("#in-village").addEventListener("change", () => { $("#in-addr").value = ""; submit(); });

const p0 = readParams();
fillForm(p0);
run(p0);

// Consent progress board (variant E). Static, no dependencies.
// State lives in localStorage only. No names: households are "3F-2" style ids.
"use strict";

// Threshold rules: copied from renewal-calculator/assets/calc.js ROUTES (debug-34),
// which cites city-workflow/n1-parameters.md rows 15-17 and 22. Keep the two in sync.
const ROUTES = [
  { key: "weilao", label: "危老", need: (n) => n, rule: "全體所有權人", law: "危老條例 §5" },
  { key: "urgent", label: "都更・迅行劃定", need: (n) => Math.floor(n / 2) + 1, rule: "人數、面積都超過 1/2", law: "都更條例 §37 第 1 項第 2 款第 1 目" },
  { key: "public", label: "都更・公劃", need: (n) => Math.floor(n * 3 / 4) + 1, rule: "人數、面積都超過 3/4", law: "同條第 2 款第 2 目" },
  { key: "self", label: "都更・自劃", need: (n) => Math.floor(n * 4 / 5) + 1, rule: "人數、面積都超過 4/5", law: "同條第 3 款" },
  { key: "r7599", label: "7599", need: (n) => Math.ceil(n * 0.75), rule: "75% 以上有意願（意願門檻，不是法定同意）", law: "臺北市 7599 計畫（113-01-02）" },
];
const TOWNS = [
  ["63000010", "松山區"], ["63000020", "信義區"], ["63000030", "大安區"], ["63000040", "中山區"],
  ["63000050", "中正區"], ["63000060", "大同區"], ["63000070", "萬華區"], ["63000080", "文山區"],
  ["63000090", "南港區"], ["63000100", "內湖區"], ["63000110", "士林區"], ["63000120", "北投區"],
];
const TOWN_DATA = "../renewal-calculator/data/towns/";  // debug-34's per-district building files
const SIM = "../consent-simulator/index.html";
const STATUS = {
  s: { icon: "✅", label: "已簽" },
  c: { icon: "💬", label: "聯絡中" },
  g: { icon: "⬜", label: "未聯絡" },
  r: { icon: "✋", label: "拒絕" },
};
const MAIL_AFTER_DAYS = 14;  // contacted but no answer for this long -> send registered mail

// Process line for this building. Station codes and names follow debug-cc's rules-map
// (mvp-variants/rules-map/, anchors #U1..#U8, #W1..#W7). Who acts at each station also follows
// rules-map (debug-cc, 2026-10-23); [待確認] marks what it could not source.
const LINES = {
  U: [
    ["U1", "事業概要", "都市更新處"],
    ["U2", "事業計畫", "都市更新處"],
    ["U3", "公聽會", "實施者辦；都更處公開展覽"],
    ["U4", "權利變換", "實施者擬；都更處受理"],
    ["U5", "審議", "都市更新及爭議處理審議會"],
    ["U6", "核定", "臺北市政府"],
    ["U7", "拆遷與中繼", "實施者拆遷；不自行拆遷的，主管機關可代為拆除（都更條例 §57）"],
    ["U8", "完工", "建管處（建照、使照）；產權登記機關【待確認】"],
  ],
  W: [
    ["W1", "耐震評估", "評估機構（起造人委託）"],
    ["W2", "重建計畫申請", "起造人送件（全體同意，危老條例 §5）；建管處受理"],
    ["W3", "審查", "建管處"],
    ["W4", "核准", "建管處"],
    ["W5", "建照", "建管處"],
    ["W6", "拆除與施工", "起造人"],
    ["W7", "完工", "建管處（使照）；產權登記機關【待確認】"],
  ],
};
const lineOf = (b) => (b.route === "weilao" ? "W" : "U");

// Per-household timeline. "where": unit field or board field. Legal notes read 2026-10-22/23.
const STEPS = [
  { k: "contact", icon: "📞", label: "第一次聯絡", where: "u.contacted",
    law: "法律沒有規定格式。記下日期，才算得出何時該寄存證信函。", basis: "【推論】" },
  { k: "briefing", icon: "🗣", label: "說明會", where: "u.briefing",
    law: "擬訂事業計畫期間要辦公聽會；公開展覽時，任何人都能用書面提意見。", basis: "都更條例 §32 第 2～4 項【文件】" },
  { k: "mail", icon: "✉", label: "存證信函／掛號", where: "u.mailed",
    law: "法律沒有要求一定要寄。存證信函由郵局留副本，能證明哪一天寄了什麼內容。", basis: "【推論】" },
  { k: "sign", icon: "✍", label: "簽署同意書", where: "u.signed",
    law: "同意書的案名、簽章、日期有缺漏，市府不計入同意比率。", basis: "北市撤銷同意作業要點第五點（115-08-07）【文件】" },
  { k: "file", icon: "📮", label: "送件（報核）", where: "b.filedOn",
    law: "實施者報核時，同意比率要達到 §37 第 1 項的門檻。報核前要撤銷，書面通知送達實施者就生效。", basis: "都更條例 §37 第 1 項；同要點第七點【文件】" },
  { k: "revoke", icon: "⏳", label: "撤銷期限（公開展覽期滿）", where: "b.displayEnd",
    law: "同意比率以公開展覽期滿時為準。期滿前，若分配比率比簽約時低，可以撤銷同意。", basis: "都更條例 §37 第 4 項【文件】" },
];

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
// Local calendar date (not UTC), so a late-night entry gets the right day.
const ymd = (t) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const today = () => ymd(Date.now());
const daysSince = (d) => (d ? Math.floor((Date.now() - new Date(d + "T00:00:00").getTime()) / 86400000) : null);
// Run fn after the next paint; the timeout covers background tabs and headless runs
// where animation frames may not fire. fn must be safe to run twice.
const afterPaint = (fn) => { requestAnimationFrame(() => requestAnimationFrame(fn)); setTimeout(fn, 80); };


let board = null;     // { id, name, n, floors, route, units: [{id, floor, st, contacted, mailed}] }
// Quest bar from design-kit/quest.js (optional: the page works without it).
const questDone = (step) => { if (window.Quest && !readOnly) Quest.done(step); };
const needNow = () => (ROUTES.find((r) => r.key === board.route) || ROUTES[3]).need(board.n);
const signedNow = () => board.units.filter((u) => u.st === "s").length;
let readOnly = false;
let selected = null;

/* ---------- storage ---------- */
function save() {
  if (readOnly || !board) return;
  try {
    localStorage.setItem("ct:" + board.id, JSON.stringify(board));
    localStorage.setItem("ct:last", board.id);
  } catch (e) { /* storage blocked: the board still works for this visit */ }
}
function load(id) {
  try { const s = localStorage.getItem("ct:" + id); return s ? JSON.parse(s) : null; } catch (e) { return null; }
}

/* ---------- board ---------- */
function makeUnits(n, floors) {
  const per = Math.ceil(n / floors), units = [];
  for (let f = 1, k = 0; f <= floors && k < n; f++) {
    for (let j = 1; j <= per && k < n; j++, k++) units.push({ id: `${f}F-${j}`, floor: f, st: "g", contacted: "", briefing: "", mailed: "", signed: "" });
  }
  return units;
}

function newBoard(id, name, n, floors) {
  n = Math.max(2, Math.min(400, Math.round(n)));
  floors = Math.max(1, Math.min(40, Math.round(floors || Math.min(5, n))));
  if (floors > n) floors = n;
  return { id, name, n, floors, route: "self", stage: "U2", filedOn: "", displayEnd: "", units: makeUnits(n, floors) };
}

// Synthetic demo: a 5-floor walk-up, 10 households. Not real people.
function demoBoard() {
  const b = newBoard("demo", "示範：5 層公寓 10 戶（合成資料）", 10, 5);
  const d = (k) => ymd(Date.now() - k * 86400000);
  const plan = [["s", 30], ["s", 25], ["c", 20], ["s", 18], ["r", 16], ["s", 12], ["c", 21], ["s", 9], ["g", 0], ["c", 3]];
  b.units.forEach((u, i) => { u.st = plan[i][0]; u.contacted = plan[i][1] ? d(plan[i][1]) : ""; });
  b.units[6].mailed = d(5);
  b.units.forEach((u) => {
    if (u.st !== "g") u.briefing = d(10);
    if (u.st === "s") u.signed = d(Math.max(1, Math.floor(plan[b.units.indexOf(u)][1] / 2)));
  });
  b.stage = "U3"; b.filedOn = d(8); b.displayEnd = d(-22);
  return b;
}

/* ---------- render ---------- */
function counts() {
  const c = { s: 0, c: 0, g: 0, r: 0 };
  board.units.forEach((u) => { c[u.st]++; });
  return c;
}

function render() {
  const n = board.n, c = counts();
  const route = ROUTES.find((r) => r.key === board.route) || ROUTES[3];
  const need = route.need(n), short = Math.max(0, need - c.s);
  const possible = n - c.r;

  $("#n-signed").textContent = c.s;
  $("#n-total").textContent = n;
  $("#n-short").textContent = short === 0 ? "✓" : possible < need ? "✗" : short;
  $("#n-short-lab").textContent = short === 0 ? `已過 ${route.label}` : possible < need ? `${route.label} 過不了` : `還差（${route.label}）`;
  const box = $("#n-short").parentElement;
  box.classList.toggle("ok", short === 0);
  box.classList.toggle("no", short > 0 && possible < need);
  document.title = `${c.s}/${n} 已簽｜同意書進度板`;

  drawLine();
  drawBuilding();
  drawMeter(c, need, route);
  drawNext(c, need, route);
  if (selected) drawUnitCard(selected);

  const q = `?n_total=${n}&n_signed=${c.s}&n_refused=${c.r}#sim`;
  $("#btn-sim").href = SIM + q;
}

function drawBuilding() {
  const el = $("#bldg");
  const per = Math.ceil(board.n / board.floors);
  const byFloor = [];
  board.units.forEach((u) => { (byFloor[u.floor] = byFloor[u.floor] || []).push(u); });
  const showText = per <= 8;
  let i = 0;
  const floorsHtml = [];
  for (let f = board.floors; f >= 1; f--) {
    const us = byFloor[f] || [];
    floorsHtml.push(`<div class="floor"><span class="fl">${f}F</span><div class="units" style="grid-template-columns:repeat(${per},minmax(0,1fr))">${
      us.map((u) => `<button type="button" class="u ${u.st}${u.id === selected ? " sel" : ""}" style="--i:${i++}" data-id="${esc(u.id)}"
        aria-label="${esc(u.id)} ${STATUS[u.st].label}${u.mailed ? "，已寄掛號" : ""}">${showText ? `<span class="t">${esc(u.id.split("-")[1])}</span>` : ""}${u.mailed ? `<span class="m">✉</span>` : ""}</button>`).join("")
    }</div></div>`);
  }
  const fresh = !el.querySelector(".floors") || el.dataset.key !== `${board.id}:${board.n}:${board.floors}`;
  if (fresh) {
    el.dataset.key = `${board.id}:${board.n}:${board.floors}`;
    el.innerHTML = `<div class="roof"></div><div class="floors">${floorsHtml.join("")}</div><div class="ground"></div>`;
    el.classList.remove("shown");
    afterPaint(() => el.classList.add("shown"));
  } else {
    // Update classes in place so the colour change animates.
    board.units.forEach((u) => {
      const b = el.querySelector(`.u[data-id="${CSS.escape(u.id)}"]`);
      if (!b) return;
      b.className = `u ${u.st}${u.id === selected ? " sel" : ""}`;
      b.setAttribute("aria-label", `${u.id} ${STATUS[u.st].label}${u.mailed ? "，已寄掛號" : ""}`);
      const m = b.querySelector(".m");
      if (u.mailed && !m) b.insertAdjacentHTML("beforeend", `<span class="m">✉</span>`);
      if (!u.mailed && m) m.remove();
    });
  }
  el.querySelectorAll(".u").forEach((b) => { b.onclick = () => { selected = b.dataset.id; render(); $("#unit-card").scrollIntoView({ block: "nearest", behavior: "smooth" }); }; });
}

function drawMeter(c, need, route) {
  const n = board.n, m = $("#meter");
  // One tick per distinct threshold. The chosen route gets its name below the bar;
  // other ticks show only the number above, and only when there is room.
  const vals = [...new Set(ROUTES.map((r) => r.need(n)))].sort((a, b) => a - b);
  let lastPos = -100;
  m.innerHTML = `<i></i><em>${c.s} / ${n}</em>` + vals.map((v) => {
    const pos = (v / n) * 100;
    const edge = pos > 75 ? " end" : pos < 25 ? " start" : "";
    if (v === need) return `<u class="on lo${edge}" style="left:${pos}%" data-label="${esc(route.label)} ${v}"></u>`;
    const room = pos - lastPos >= 8;
    if (room) lastPos = pos;
    return `<u style="left:${pos}%" data-label="${room ? v : ""}"></u>`;
  }).join("");
  m.classList.toggle("pass", c.s >= need);
  m.setAttribute("aria-label", `已簽 ${c.s} 戶，${route.label} 要 ${need} 戶`);
  afterPaint(() => { m.querySelector("i").style.width = `${(c.s / n) * 100}%`; });

  $("#routes").innerHTML = ROUTES.map((r) => {
    const v = r.need(n), ok = c.s >= v;
    return `<button type="button" role="radio" aria-checked="${r.key === board.route}" data-k="${r.key}">${esc(r.label)} ${ok ? `<span class="ok">✓</span>` : `差 ${v - c.s}`}</button>`;
  }).join("");
  $("#routes").querySelectorAll("button").forEach((b) => {
    b.onclick = () => { board.route = b.dataset.k; save(); render(); };
  });
}

function drawNext(c, need, route) {
  const items = [];
  const n = board.n;
  if (c.s >= need) {
    items.push(["🎉", `已過「${route.label}」門檻（要 ${need} 戶，已簽 ${c.s} 戶）。下一步請專業者確認面積比例也過。`]);
  } else if (n - c.r < need) {
    const alt = ROUTES.filter((r) => n - c.r >= r.need(n) && r.key !== route.key).map((r) => r.label);
    items.push(["⛔", `有 ${c.r} 戶拒絕，「${route.label}」最多只能到 ${n - c.r} 戶，過不了。${alt.length ? `門檻較低的路：${alt.join("、")}。` : "先回頭和拒絕的戶談。"}`]);
  } else {
    items.push(["🎯", `「${route.label}」還差 ${need - c.s} 戶。`]);
  }
  const g = board.units.filter((u) => u.st === "g");
  if (g.length) items.push(["📞", `還有 ${g.length} 戶沒聯絡：<span class="units-list">${g.slice(0, 12).map((u) => esc(u.id)).join("、")}${g.length > 12 ? "⋯" : ""}</span>。先拜訪或打電話。`]);
  const late = board.units.filter((u) => u.st === "c" && !u.mailed && daysSince(u.contacted) >= MAIL_AFTER_DAYS);
  if (late.length) items.push(["✉", `${late.length} 戶聯絡超過 ${MAIL_AFTER_DAYS} 天沒回：<span class="units-list">${late.slice(0, 12).map((u) => esc(u.id)).join("、")}</span>。寄掛號信。`]);
  const wait = board.units.filter((u) => u.st === "c" && u.mailed);
  if (wait.length) items.push(["⏳", `${wait.length} 戶已寄掛號，等回覆：<span class="units-list">${wait.map((u) => esc(u.id)).join("、")}</span>。`]);
  const noDate = board.units.filter((u) => u.st === "c" && !u.contacted);
  if (noDate.length) items.push(["📅", `${noDate.length} 戶聯絡中但沒填日期。補上日期，才算得出何時該寄掛號。`]);
  if (c.r) items.push(["🤝", `${c.r} 戶拒絕。可以請他們看「丟進模擬器」，比較不同說明方式的結果。`]);
  $("#next").innerHTML = items.map(([i, t]) => `<li><span class="ni">${i}</span><p>${t}</p></li>`).join("");
}

function drawLine() {
  const L = LINES[lineOf(board)];
  // Fall back to the first station for display only; keep board.stage so that switching
  // between the renewal and weilao routes does not lose the saved station.
  const cur = Math.max(0, L.findIndex(([k]) => k === board.stage));
  const box = $("#line");
  box.innerHTML = `<ol class="stations">${L.map(([k, name], i) =>
    `<li class="${i < cur ? "done" : i === cur ? "now" : ""}"><button type="button" data-k="${k}" ${readOnly ? "disabled" : ""}
      aria-label="${k} ${esc(name)}${i === cur ? "，目前這一站" : ""}"><i></i><span>${esc(name)}</span></button></li>`).join("")}</ol>`;
  const [k, name, who] = L[cur];
  $("#line-now").innerHTML = `目前：<b>${esc(name)}</b>｜誰負責：${esc(who)}｜<a href="../rules-map/#${k}">看這一站的法規 →</a>`;
  box.querySelectorAll("button").forEach((b) => { b.onclick = () => { board.stage = b.dataset.k; save(); render(); }; });
  // Keep the current station in view on narrow screens (horizontal scroll inside the card only).
  const nowLi = box.querySelector("li.now");
  if (nowLi) box.scrollLeft = Math.max(0, nowLi.offsetLeft - box.clientWidth / 2 + nowLi.offsetWidth / 2);
  const f = $("#b-filed"), e = $("#b-display");
  f.value = board.filedOn || ""; e.value = board.displayEnd || "";
  f.disabled = e.disabled = readOnly;
  f.onchange = () => { board.filedOn = f.value; save(); render(); };
  e.onchange = () => { board.displayEnd = e.value; save(); render(); };
}

function stepValue(u, st) {
  const [o, key] = st.where.split(".");
  return (o === "u" ? u : board)[key] || "";
}

function timelineHTML(u) {
  return `<ol class="tl">${STEPS.map((st) => {
    const v = stepValue(u, st);
    let on = !!v, note = v ? v : "未填";
    if (st.k === "revoke" && v) {
      const left = -daysSince(v);
      on = left < 0;
      note = left < 0 ? `${v}（已過，同意比率定案）` : `${v}（還有 ${left} 天）`;
    }
    const own = st.where.startsWith("u.");
    return `<li class="${on ? "on" : ""}"><span class="ti">${st.icon}</span><div>
      <div class="th"><b>${esc(st.label)}</b>
        ${own && !readOnly ? `<input type="date" data-f="${st.where.slice(2)}" value="${esc(v)}" aria-label="${esc(st.label)}日期">` : `<span class="td">${esc(note)}</span>`}</div>
      <p>${esc(st.law)}</p><p class="basis">${esc(st.basis)}</p></div></li>`;
  }).join("")}</ol>`;
}

function drawUnitCard(id) {
  const u = board.units.find((x) => x.id === id);
  const card = $("#unit-card");
  if (!u) { card.hidden = true; return; }
  card.hidden = false;
  const dis = readOnly ? "disabled" : "";
  card.innerHTML = `
    <div class="uh"><span class="uid">${esc(u.id)}</span><button type="button" id="u-next">下一戶 →</button></div>
    <div class="st" role="radiogroup" aria-label="狀態">
      ${Object.entries(STATUS).map(([k, s]) => `<button type="button" role="radio" data-st="${k}" aria-pressed="${u.st === k}" ${dis}><b>${s.icon}</b>${s.label}</button>`).join("")}
    </div>
    ${timelineHTML(u)}`;
  card.querySelectorAll(".st button").forEach((b) => b.onclick = () => {
    const before = signedNow();
    u.st = b.dataset.st;
    questDone("改一戶狀態");
    if (before < needNow() && signedNow() >= needNow()) {
      questDone("過門檻");
      if (window.Quest) { Quest.confetti(); Quest.toast(`🎉 過了「${(ROUTES.find((r) => r.key === board.route) || ROUTES[3]).label}」門檻`); }
    }
    if (u.st !== "g" && !u.contacted) u.contacted = today();
    if (u.st === "s" && !u.signed) u.signed = today();
    save(); render();
  });
  card.querySelectorAll(".tl input[data-f]").forEach((inp) => { inp.onchange = () => {
    u[inp.dataset.f] = inp.value;
    if (inp.dataset.f === "mailed" && inp.value) questDone("寄一封掛號");
    save(); render();
  }; });
  $("#u-next").onclick = () => {
    const i = board.units.indexOf(u);
    selected = board.units[(i + 1) % board.units.length].id;
    render();
  };
}

function drawLaw() {
  const n = board.n;
  $("#law").innerHTML = `<table class="law"><tr><th>路</th><th>門檻</th><th>${n} 戶要幾戶</th><th>法源</th></tr>${
    ROUTES.map((r) => `<tr><td>${esc(r.label)}</td><td>${esc(r.rule)}</td><td>${r.need(n)}</td><td>${esc(r.law)}</td></tr>`).join("")
  }</table><p class="small">門檻規則和試算器（變體 A，debug-34）用同一份，出處是 city-workflow/n1-parameters.md 第 15～17、22 列【文件】。「超過 3/4」取「戶數×3/4 的整數部分＋1」。</p>`;
}

// Add one household on the top floor (a unit the address data missed, e.g. a split unit).
function addUnit() {
  if (readOnly) return;
  const f = board.floors, onTop = board.units.filter((u) => u.floor === f);
  const id = `${f}F-${onTop.length + 1}`;
  board.units.push({ id, floor: f, st: "g", contacted: "", briefing: "", mailed: "", signed: "" });
  board.n = board.units.length;
  selected = id;
  questDone("加一戶");
  save(); drawLaw(); render();
}

/* ---------- export and share ---------- */
function exportCSV() {
  const rows = [["unit_id", "floor", "status", "status_label", "contacted_on", "briefing_on", "certified_mail_on", "signed_on", "board_stage", "filed_on", "display_end_on"]];
  board.units.forEach((u) => rows.push([u.id, u.floor, u.st, STATUS[u.st].label, u.contacted, u.briefing || "", u.mailed, u.signed || "", board.stage, board.filedOn || "", board.displayEnd || ""]));
  const csv = "﻿" + rows.map((r) => r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(",")).join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  a.download = `consent-board-${board.id}-${today()}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function shareLink() {
  const s = board.units.map((u) => u.st + (u.mailed ? "m" : "")).join(".");
  const url = `${location.origin}${location.pathname}#ro=1&n=${board.n}&f=${board.floors}&r=${board.route}&st=${board.stage}&s=${s}`;
  const out = $("#share-out");
  out.hidden = false;
  out.innerHTML = `這個連結只帶每一戶的狀態，不帶日期：<br><a href="${esc(url)}">${esc(url)}</a>`;
  try { navigator.clipboard.writeText(url); out.insertAdjacentHTML("beforeend", "<br>已複製。"); } catch (e) { /* clipboard blocked */ }
}

function fromHash() {
  const h = new URLSearchParams(location.hash.slice(1));
  if (h.get("ro") !== "1") return null;
  const n = parseInt(h.get("n"), 10), f = parseInt(h.get("f"), 10);
  const codes = String(h.get("s") || "").split(".");
  if (!(n > 1) || codes.length !== n) return null;
  const b = newBoard("shared", "分享的進度", n, f);
  b.route = ROUTES.some((r) => r.key === h.get("r")) ? h.get("r") : "self";
  b.stage = /^[UW][1-8]$/.test(h.get("st") || "") ? h.get("st") : "";
  b.units.forEach((u, i) => { u.st = "scgr".includes(codes[i][0]) ? codes[i][0] : "g"; u.mailed = codes[i].includes("m") ? "1" : ""; });
  return b;
}

/* ---------- setup: address lookup via debug-34's town files ---------- */
let townRecs = null;
async function loadTown(code) {
  $("#addr-msg").textContent = "載入這一區的門牌⋯";
  townRecs = null;
  try {
    const r = await fetch(`${TOWN_DATA}${code}.json`);
    if (!r.ok) throw new Error("HTTP " + r.status);
    const j = await r.json();
    const fi = Object.fromEntries(j.fields.map((f, i) => [f, i]));
    townRecs = j.records.map((x) => ({ address: x[fi.address], id: x[fi.point_id], units: x[fi.doorplate_units], floors: x[fi.floors] }));
    $("#addr-msg").textContent = `這一區有 ${townRecs.length.toLocaleString("zh-TW")} 棟。打地址的一部分。`;
  } catch (e) {
    $("#addr-msg").textContent = "讀不到門牌資料（要先跑試算器的資料腳本）。可以直接填戶數。";
  }
}
const norm = (s) => String(s || "").replace(/[０-９]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 65248)).replace(/\s/g, "").replace(/台/g, "臺").replace(/[－—]/g, "-").replace(/之/g, "之");
function suggest() {
  if (!townRecs) return;
  const q = norm($("#addr").value);
  if (q.length < 2) return;
  const hits = townRecs.filter((r) => norm(r.address).includes(q)).slice(0, 20);
  $("#addr-list").innerHTML = hits.map((r) => `<option value="${esc(r.address)}">${r.units} 戶</option>`).join("");
  const exact = townRecs.find((r) => norm(r.address) === q);
  if (exact) {
    $("#n-in").value = exact.units;
    $("#f-in").value = exact.floors || Math.min(5, exact.units);
    $("#addr-msg").textContent = `找到：門牌 ${exact.units} 筆【推估當作 ${exact.units} 戶】${exact.floors ? `、${exact.floors} 層` : "，樓層數不明，先填 5"}。`;
  }
}

function initSetup() {
  $("#town").innerHTML = `<option value="">—</option>` + TOWNS.map(([c, n]) => `<option value="${c}">${n}</option>`).join("");
  $("#town").onchange = () => { if ($("#town").value) loadTown($("#town").value); };
  $("#addr").oninput = suggest;
  $("#btn-make").onclick = () => {
    const n = parseInt($("#n-in").value, 10);
    if (!(n >= 2)) { $("#addr-msg").textContent = "請填 2 戶以上。"; return; }
    const f = parseInt($("#f-in").value, 10) || Math.min(5, n);
    const addr = $("#addr").value.trim();
    const hit = townRecs && townRecs.find((r) => norm(r.address) === norm(addr));
    const id = hit ? hit.id : `n${n}f${f}`;
    readOnly = false;
    board = load(id) || newBoard(id, hit ? hit.address : `${n} 戶`, n, f);
    selected = null;
    save(); drawLaw(); render();
    $("#setup").open = false;
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  $("#btn-reset").onclick = () => {
    if (!board || readOnly) return;
    if (!confirm(`清空「${board.name}」的所有紀錄？`)) return;
    board = board.id === "demo" ? demoBoard() : newBoard(board.id, board.name, board.n, board.floors);
    selected = null; save(); render();
  };
}

/* ---------- boot ---------- */
function boot() {
  const shared = fromHash();
  if (shared) {
    board = shared; readOnly = true;
    $("#ro-banner").hidden = false;
    document.querySelectorAll("#btn-csv, #btn-share, #setup, #btn-reset, #btn-add").forEach((x) => { x.hidden = true; });
  } else {
    let last = null;
    try { last = localStorage.getItem("ct:last"); } catch (e) { last = null; }
    board = (last && load(last)) || load("demo") || demoBoard();
    if (board.id === "demo") selected = "1F-1";  // show one household timeline on first view
  }
  initSetup();
  $("#btn-csv").onclick = exportCSV;
  $("#btn-add").onclick = addUnit;
  if (window.Quest && !readOnly) Quest.init({ page: "e", role: "推動小組", steps: ["加一戶", "改一戶狀態", "寄一封掛號", "過門檻"] });
  $("#btn-share").onclick = shareLink;
  drawLaw();
  render();
}
boot();

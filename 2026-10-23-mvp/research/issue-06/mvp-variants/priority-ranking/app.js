// MVP variant 0: re-weight the five factors and re-rank 456 villages in the browser.
// Score = sum(w * percentile) / sum(w); equal weights reproduce composite_equal_city2019.
(function () {
  "use strict";

  const FACTORS = [
    { k: "elderly", name: "高齡", hint: "65 歲以上比例" },
    { k: "old_stock", name: "老屋", hint: "1999 前建造（推估）" },
    { k: "liquefaction", name: "液化", hint: "城市版 2019" },
    { k: "rescue", name: "救災", hint: "窄巷、6 m 以下道路" },
    { k: "soft_story", name: "軟弱層", hint: "一樓軟弱層候選" },
  ];
  const PRESETS = [
    { label: "等權", w: [1, 1, 1, 1, 1] },
    { label: "高齡優先", w: [3, 1, 1, 1, 1] },
    { label: "建物優先", w: [1, 3, 1, 1, 3] },
    { label: "地盤與救災", w: [1, 1, 3, 3, 1] },
  ];
  // share of villages at or above each level (fixed Tokyo shares, cumulative)
  const LEVEL_TOP = { 5: "1.6%", 4: "7%", 3: "23%" };
  const TOP_N = 46, SHOW = 20, AXIS_MAX = 250;
  const CLASSES = [
    { max: 20, label: "第 1～20 名", v: "--c1" },
    { max: 46, label: "第 21～46 名（前 10%）", v: "--c2" },
    { max: 120, label: "第 47～120 名", v: "--c3" },
    { max: 250, label: "第 121～250 名", v: "--c4" },
    { max: Infinity, label: "第 251～456 名", v: "--c5" },
  ];

  const $ = (s) => document.querySelector(s);
  // quest bar from design-kit/quest.js; the page works without it
  const quest = (step) => window.Quest && window.Quest.done(step);
  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  const pct = (x, d = 0) => (x * 100).toFixed(d) + "%";
  const ax = (r) => ((Math.min(r, AXIS_MAX) - 1) / (AXIS_MAX - 1)) * 100;

  // city-led renewal tab: four fixed conditions, not the sliders
  const CONDS = [
    { k: "c_risk", name: "風險" },
    { k: "c_price", name: "房價低" },
    { k: "c_elderly", name: "高齡" },
    { k: "c_market", name: "市場沒動" },
  ];
  const R_CLASSES = [
    { test: (v) => v.c_n === 4, label: "4 項都符合：公辦候選", v: "--c1" },
    { test: (v) => v.c_risk && v.c_n === 3, label: "風險高，差 1 項", v: "--c3" },
    { test: (v) => v.c_risk, label: "風險高（等權前 120 名）", v: "--c4" },
    { test: () => true, label: "其他", v: "--c5" },
  ];
  let tab = "check", TH = {};
  let V = [], byCode = {}, layers = {}, rowEls = {}, weights = [1, 1, 1, 1, 1], selected = null, map;

  function readHash() {
    if (/tab=renew/.test(location.hash)) tab = "renew";
    const m = location.hash.match(/w=([\d.,]+)/);
    if (!m) return;
    const w = m[1].split(",").map(Number);
    if (w.length === 5 && w.every((x) => x >= 0 && x <= 4)) weights = w;
  }

  function buildSliders() {
    const box = $("#weights");
    FACTORS.forEach((f, i) => {
      const d = document.createElement("div");
      d.className = "w";
      d.innerHTML = `<label for="w_${f.k}">${f.name}<output id="o_${f.k}"></output></label>
        <input id="w_${f.k}" type="range" min="0" max="4" step="0.5" value="${weights[i]}">
        <small>${f.hint}</small>`;
      box.appendChild(d);
      d.querySelector("input").addEventListener("input", (e) => {
        weights[i] = Number(e.target.value);
        update();
        quest("拉一支權重");
      });
    });
    const p = document.createElement("div");
    p.className = "presets";
    PRESETS.forEach((ps) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = ps.label;
      b.addEventListener("click", () => {
        weights = ps.w.slice();
        FACTORS.forEach((f, i) => ($("#w_" + f.k).value = weights[i]));
        update();
        quest("拉一支權重");
      });
      p.appendChild(b);
    });
    box.appendChild(p);
  }

  function score(v) {
    const sw = weights.reduce((a, b) => a + b, 0);
    const w = sw > 0 ? weights : [1, 1, 1, 1, 1];
    const s = sw > 0 ? sw : 5;
    return FACTORS.reduce((a, f, i) => a + w[i] * v["p_" + f.k], 0) / s;
  }

  function classOf(rank) {
    return CLASSES.find((c) => rank <= c.max);
  }

  function rerank() {
    V.forEach((v) => (v.score = score(v)));
    const order = V.slice().sort((a, b) => b.score - a.score);
    order.forEach((v, i) => {
      // method "min": ties share the better rank
      v.rank = i > 0 && Math.abs(v.score - order[i - 1].score) < 1e-9 ? order[i - 1].rank : i + 1;
    });
    return order;
  }

  function update() {
    FACTORS.forEach((f, i) => ($("#o_" + f.k).textContent = "×" + weights[i]));
    document.querySelectorAll(".presets button").forEach((b, i) =>
      b.setAttribute("aria-pressed", String(PRESETS[i].w.every((x, j) => x === weights[j]))));
    history.replaceState(null, "", "#w=" + weights.join(",") + (tab === "renew" ? "&tab=renew" : ""));
    const order = rerank();
    const same = order.slice(0, TOP_N).filter((v) => v.rank_eq <= TOP_N).length;
    $("#kSame").textContent = same;
    paintMap();
    paintRows(order);
    if (selected) renderCard(selected);
  }

  function paintMap() {
    if (tab === "renew") {
      const rc = R_CLASSES.map((c) => css(c.v));
      V.forEach((v) => {
        const i = R_CLASSES.findIndex((c) => c.test(v));
        layers[v.village_code].setStyle({ fillColor: rc[i], fillOpacity: i === R_CLASSES.length - 1 ? 0.15 : 0.85 });
      });
      return;
    }
    const colors = CLASSES.map((c) => css(c.v));
    V.forEach((v) => {
      const i = CLASSES.indexOf(classOf(v.rank));
      layers[v.village_code].setStyle({ fillColor: colors[i], fillOpacity: i === CLASSES.length - 1 ? 0.3 : 0.82 });
    });
  }

  function paintRows(order) {
    const rows = $("#rows");
    const rh = parseFloat(getComputedStyle(rows).getPropertyValue("--rh")) || 34;
    const top = order.slice(0, SHOW);
    const shown = new Set(top.map((v) => v.village_code));
    const maxS = top[0].score, base = order[TOP_N - 1].score;
    Object.keys(rowEls).forEach((code) => {
      if (!shown.has(code)) {
        rowEls[code].style.opacity = 0;
        rowEls[code].style.transform = `translateY(${SHOW * rh}px)`;
        rowEls[code].tabIndex = -1;
      }
    });
    top.forEach((v, i) => {
      let el = rowEls[v.village_code];
      if (!el) {
        el = makeRow(v);
        el.style.transform = `translateY(${SHOW * rh}px)`;
        el.style.opacity = 0;
        rows.appendChild(el);
        rowEls[v.village_code] = el;
        el.getBoundingClientRect(); // start the transition from the bottom
      }
      el.tabIndex = 0;
      el.style.opacity = 1;
      el.style.transform = `translateY(${i * rh}px)`;
      el.querySelector(".n").textContent = v.rank;
      const bar = el.querySelector(".sbar");
      bar.style.width = Math.max(2, ((v.score - base) / (maxS - base)) * 100).toFixed(1) + "%";
      bar.style.background = css(classOf(v.rank).v);
      el.querySelector(".dot").style.left = ax(v.rank) + "%";
      el.setAttribute("aria-current", String(selected === v.village_code));
    });
  }

  function makeRow(v) {
    const el = document.createElement("button");
    el.type = "button";
    el.className = "row";
    const open = v.r95 > AXIS_MAX ? " open" : "";
    el.title = `${v.town_name}${v.village_name}：隨機權重下名次 ${v.r05}～${v.r95}，中位 ${v.r50}`;
    el.innerHTML = `<span class="n"></span>
      <span class="nm">${v.village_name}<small>${v.town_name}</small></span>
      <span class="viz"><i class="sbar"></i></span>
      <span class="viz rk"><i class="l46" style="left:${ax(TOP_N)}%"></i>
        <i class="whisk${open}" style="left:${ax(v.r05)}%;width:${ax(v.r95) - ax(v.r05)}%"></i>
        <i class="dot"></i></span>`;
    el.addEventListener("click", () => { select(v.village_code, true); quest("點一個里"); });
    return el;
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

  const wan = (x) => (x / 1e4).toFixed(1);

  function whyCityLed(v) {
    const price = v.price == null ? "沒有足夠成交" : `每坪 ${wan(v.price)} 萬`;
    const wl = v.weilao_active_est < 0.1 ? "不到 0.1" : "約 " + v.weilao_active_est.toFixed(1);
    const market = `危老${wl} 件、近一年新成屋成交 ${pct(v.lvr_share_newbuild || 0)}`;
    if (!v.c_risk) return [`等權排第 ${v.rank_eq} 名，不在前 ${TH.risk_top} 名。`, "先不列公辦候選。"];
    if (v.c_n === 4) return [`風險排全市第 ${v.rank_eq} 名，但${price}、${market}，建商不會自己來。`,
      `65 歲以上占 ${pct(v.share_65plus)}，住戶自己湊同意書也難，所以需要市府主導。`];
    if (v.c_n === 3) {
      if (!v.c_market) return [`風險高、房價低、住戶老，但民間已經在動：${market}。`, "市府先輔導民間危老與都更，不必公辦。"];
      if (!v.c_price) return [`風險高、住戶老、市場沒動，但${price}，不在全市後 1/3。`, "房價還撐得住，民間可能還有誘因。"];
      if (!v.c_elderly) return [`風險高、房價低、市場沒動，但 65 歲以上 ${pct(v.share_65plus)}，不在全市前 1/3。`, "住戶自己整合的機會較大。"];
    }
    return [`風險排第 ${v.rank_eq} 名，4 項只符合 ${v.c_n} 項。`, "民間或住戶自己還有路。"];
  }

  function renderRenewCard(v, card) {
    const fmt = {
      c_risk: `等權第 ${v.rank_eq} 名（門檻：前 ${TH.risk_top} 名）`,
      c_price: v.price == null ? "沒有足夠成交" : `每坪 ${wan(v.price)} 萬（門檻 ≤ ${wan(TH.price_p33)} 萬，${v.price_n} 筆）`,
      c_elderly: `65 歲以上 ${pct(v.share_65plus, 1)}（門檻 ≥ ${pct(TH.elderly_p67, 1)}）`,
      c_market: `危老 ${v.weilao_active_est.toFixed(2)} 件（門檻 < ${TH.weilao_median}）；新成屋 ${pct(v.lvr_share_newbuild || 0)}`,
    };
    const [s1, s2] = whyCityLed(v);
    card.innerHTML = `<button class="close" type="button" aria-label="關閉">×</button>
      <h3>${v.town_name} ${v.village_name}</h3>
      <div class="big"><b>${v.c_n}／4 項</b><span class="muted">${v.c_n === 4 ? "公辦都更候選" : "符合"}</span></div>
      <ul class="conds">${CONDS.map((c) => `<li><span class="${v[c.k] ? "yes" : "no"}">${v[c.k] ? "●" : "○"}</span><b>${c.name}</b><span>${fmt[c.k]}</span></li>`).join("")}</ul>
      <p>${s1}</p>
      <p class="muted" style="font-size:15px">${s2}</p>
      <p class="muted" style="font-size:14px">都更處 168 專案案件：${v.uro_cases ? +v.uro_cases.toFixed(2) : 0} 件（不是全部都更案）</p>`;
    card.hidden = false;
    card.querySelector(".close").addEventListener("click", () => select(null));
  }

  function renderCard(code) {
    const v = byCode[code];
    if (tab === "renew") return renderRenewCard(v, $("#card"));
    const card = $("#card");
    const chips = FACTORS.map((f) => {
      const lv = v["lv_" + f.k];
      return `<div class="chip${lv >= 4 ? " dark" : ""}" style="background:var(--l${lv})" title="${f.hint}"><b>${lv}</b>${f.name}</div>`;
    }).join("");
    const [s1, s2] = sentence(v);
    card.innerHTML = `<button class="close" type="button" aria-label="關閉">×</button>
      <h3>${v.town_name} ${v.village_name}</h3>
      <div class="big"><b>第 ${v.rank} 名</b><span class="muted">等權時第 ${v.rank_eq} 名</span></div>
      <div class="chips" aria-label="5 因子等級，5 級最危險">${chips}</div>
      <p>${s1}</p>
      <div class="stab"><span>排進前 46 名</span><span class="bar"><i></i></span><b>${pct(v.top46)}</b></div>
      <p class="muted" style="font-size:15px">${s2}</p>
      <details><summary>數字</summary><ul style="margin:4px 0;padding-left:20px;font-size:15px">
        <li>65 歲以上 ${pct(v.share_65plus, 1)}【原始】</li>
        <li>1999 前建造 ${v.bld_share_pre_policy_1999 == null ? "無資料" : pct(v.bld_share_pre_policy_1999)}（已知屋齡 ${v.bld_age_known_n ?? 0} 棟）【推估】</li>
        <li>液化高潛勢 ${pct(v.liq_high_share_city2019)}、中潛勢 ${pct(v.liq_medium_share_city2019)}（城市版 2019）</li>
        <li>窄巷與消防通道 ${v.lanes_n} 條；6 m 以下道路標註 ${v.road_markers_lt6m_share == null ? "無資料" : pct(v.road_markers_lt6m_share)}</li>
        <li>一樓軟弱層候選 ${v.soft_n} 棟／${v.doorplate_buildings} 棟【候選】</li>
        <li>隨機權重名次：${v.r05}～${v.r95}（中位 ${v.r50}）</li>
      </ul></details>`;
    card.hidden = false;
    card.querySelector(".close").addEventListener("click", () => select(null));
    requestAnimationFrame(() => (card.querySelector(".stab i").style.width = pct(v.top46)));
  }

  function select(code, pan) {
    if (selected && layers[selected]) layers[selected].setStyle({ weight: 0.6, color: css("--line") });
    selected = code;
    Object.entries(rowEls).forEach(([c, el]) => el.setAttribute("aria-current", String(c === code)));
    document.querySelectorAll(".rrow").forEach((el) => el.setAttribute("aria-current", String(el.dataset.code === code)));
    if (!code) {
      $("#card").hidden = true;
      return;
    }
    const lyr = layers[code];
    lyr.setStyle({ weight: 3, color: css("--ink") });
    lyr.bringToFront();
    if (pan && !map.getBounds().contains(lyr.getBounds())) map.fitBounds(lyr.getBounds(), { maxZoom: 14 });
    renderCard(code);
  }

  function buildLegend() {
    const list = tab === "renew" ? R_CLASSES : CLASSES;
    $("#legend").innerHTML = list.map((c) => `<div><i style="background:var(${c.v})"></i>${c.label}</div>`).join("");
    const t = $("#ticks");
    t.innerHTML = [1, TOP_N, 100, 200].map((r) => `<span class="t${r}" style="left:${ax(r)}%">${r}</span>`).join("") +
      `<span style="left:100%;transform:translateX(-100%)">${AXIS_MAX}+</span>`;
  }

  function buildStable() {
    const s = V.filter((v) => v.top46 >= 0.75).sort((a, b) => b.top46 - a.top46);
    $("#stable").innerHTML = s.map((v) =>
      `<div><b>${v.village_name}</b> <span class="muted">${v.town_name}</span><br>前 46 名 ${pct(v.top46)}</div>`).join("");
    $("#kStable").textContent = V.filter((v) => v.top46 >= 0.9).length;
  }

  const OFFICIAL = { 2025: 0.2, 2035: 0.5, 2045: 0.65 };
  function buildAging(meta) {
    $("#kElder").textContent = pct(meta.elderly_share_city, 1);
    $("#aKnown").textContent = meta.aging.known_buildings.toLocaleString();
    const box = $("#aging");
    box.innerHTML = Object.entries(meta.aging.years).map(([y, a]) =>
      `<div class="ag"><span class="y">${y}</span>
        <span class="tr" title="題目原文：${pct(OFFICIAL[y])}"><i style="--w:${pct(a.buildings, 1)}"></i><u style="left:${pct(OFFICIAL[y])}"></u></span>
        <b>${pct(a.buildings)}</b></div>`).join("");
    const go = () => box.classList.add("go");
    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver((es) => es.some((e) => e.isIntersecting) && (go(), io.disconnect()));
      io.observe(box);
    } else go();
  }

  function buildRenew(meta) {
    TH = meta.renewal;
    $("#kCand").textContent = TH.candidates;
    $("#kShort").textContent = TH.one_short;
    $("#uroCases").textContent = TH.uro_cases_total;
    $("#uroVillages").textContent = TH.uro_villages;
    const val = { risk_top: TH.risk_top, price_p33: wan(TH.price_p33), elderly_p67: pct(TH.elderly_p67, 1), weilao_median: TH.weilao_median };
    document.querySelectorAll("[data-th]").forEach((el) => (el.textContent = val[el.dataset.th]));
    const list = V.filter((v) => v.c_risk && v.c_n >= 3).sort((a, b) => b.c_n - a.c_n || a.rank_eq - b.rank_eq);
    const row = (v) => `<button type="button" class="rrow${v.c_n === 4 ? " full" : ""}" data-code="${v.village_code}">
      <span class="nm">${v.village_name}<small>${v.town_name}</small></span>
      ${CONDS.map((c) => `<i class="ck${v[c.k] ? " on" : ""}" title="${c.name}"></i>`).join("")}</button>`;
    $("#rlist").innerHTML =
      `<div class="rgroup">4 項都符合（${TH.candidates}）</div>` + list.filter((v) => v.c_n === 4).map(row).join("") +
      `<div class="rgroup">差 1 項（${TH.one_short}）</div>` + list.filter((v) => v.c_n === 3).map(row).join("");
    document.querySelectorAll(".rrow").forEach((el) => el.addEventListener("click", () => { select(el.dataset.code, true); quest("點一個里"); }));
  }

  // market gap: share of buildings vs share of 危老 / 都更 cases, top level (4-5) of each house-side factor
  function buildGap(meta) {
    const G = meta.market_gap;
    if (!G) return;
    const top = (g) => g.levels.find((l) => l.level === "4-5");
    const tops = G.groups.map((g) => ({ g, t: top(g) }));
    const max = Math.ceil(Math.max(...tops.flatMap(({ t }) => [t.bld_share, t.weilao_share, t.uro_share])) * 20) / 20;
    const x = (s) => ((s / max) * 100).toFixed(2) + "%";
    const cityRate = G.cases_per_1k_bld_city;
    const bar = (label, s, color, ref) => `<div class="gb"><span>${label}</span>
      <svg role="img" aria-label="${label} ${pct(s, 1)}"><rect width="100%" height="20" rx="5" fill="var(--track)"></rect>
      <rect width="${x(s)}" height="20" rx="5" fill="var(${color})"></rect>
      ${ref == null ? "" : `<line x1="${x(ref)}" x2="${x(ref)}" y1="-3" y2="23" stroke="var(--ink)" stroke-width="2" stroke-dasharray="3 2"></line>`}</svg>
      <b>${pct(s, 1)}</b></div>`;
    $("#gap").innerHTML = tops.map(({ g, t }) => `<div class="gapg">
      <h3>${g.name}最高的 ${t.villages} 個里<small>等級 4～5</small></h3>
      ${bar("房子棟數", t.bld_share, "--muted")}
      ${bar("危老案", t.weilao_share, "--c3", t.bld_share)}
      ${bar("都更案", t.uro_share, "--c1", t.bld_share)}
      <p>每千棟分到 ${t.cases_per_1k_bld.toFixed(1)} 件（全市 ${cityRate.toFixed(1)} 件）</p></div>`).join("");
    const o = tops[0].t, others = tops.slice(1).filter(({ t }) => t.cases_share > t.bld_share);
    $("#gapLead").innerHTML = `${tops[0].g.name}比例最高的 <b>${o.villages}</b> 個里，有全市 ${pct(o.bld_share, 1)} 的房子，` +
      `只分到 <b>${pct(o.cases_share, 1)}</b> 的危老與都更案。` +
      (others.length ? `${others.map(({ g }) => g.name).join("、")}最高的里沒有這個落差，分到的案比房子占比多。` : "");
    $("#gapWl").textContent = G.weilao_period;
    $("#gapWlN").textContent = Math.round(G.weilao_total).toLocaleString();
    $("#gapUro").textContent = G.uro_period;
    $("#gapUroN").textContent = Math.round(G.uro_total);
  }

  function setTab(t) {
    tab = t;
    document.body.dataset.tab = t;
    document.querySelectorAll(".tabs button").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.tab === t)));
    buildLegend();
    sizeRows();
    update();
    if (t === "renew" && map) {
      const pts = V.filter((v) => v.c_risk && v.c_n >= 3).map((v) => layers[v.village_code].getBounds());
      if (pts.length) map.fitBounds(pts.reduce((b, x) => b.extend(x), L.latLngBounds(pts[0].getSouthWest(), pts[0].getNorthEast())), { padding: [30, 30] });
    }
    const first = t === "renew" ? V.filter((v) => v.c_n === 4).sort((a, b) => a.rank_eq - b.rank_eq)[0] : rerank()[0];
    select(first ? first.village_code : null, false);
  }

  function sizeRows() {
    const rows = $("#rows");
    const h = rows.clientHeight;
    const rh = window.innerWidth <= 1100 ? 36 : Math.max(22, Math.min(44, Math.floor(h / SHOW)));
    rows.style.setProperty("--rh", rh + "px");
  }

  function downloadCsv() {
    const head = ["rank", "village_code", "town_name", "village_name", "score", "rank_equal_weight",
      "rank_p05", "rank_p50", "rank_p95", "share_top46"].concat(FACTORS.map((f) => "lv_" + f.k));
    const lines = rerank().map((v) => [v.rank, v.village_code, v.town_name, v.village_name, v.score.toFixed(4),
      v.rank_eq, v.r05, v.r50, v.r95, v.top46].concat(FACTORS.map((f) => v["lv_" + f.k])).join(","));
    const use = "# 給市府排程用，不是逐棟鑑定（相對於臺北其他里；老屋、軟弱層為推估）/ for city scheduling, not a building-by-building assessment";
    const note = `# weights ${FACTORS.map((f, i) => f.k + "=" + weights[i]).join(" ")}; relative to other Taipei villages; old_stock and soft_story are estimates`;
    const blob = new Blob(["﻿" + [use, note, head.join(",")].concat(lines).join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `village-priority-${weights.join("-")}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    quest("下載 CSV");
  }

  async function init() {
    const wantMore = location.hash.includes("more");
    readHash();
    buildSliders();
    buildLegend();
    const [gj, meta] = await Promise.all([
      fetch("data/villages.geojson").then((r) => r.json()),
      fetch("data/meta.json").then((r) => r.json()),
    ]);
    V = gj.features.map((f) => f.properties);
    V.forEach((v) => (byCode[v.village_code] = v));
    buildStable();
    buildAging(meta);
    buildRenew(meta);
    buildGap(meta);
    document.querySelectorAll(".tabs button").forEach((b) => b.addEventListener("click", () => {
      setTab(b.dataset.tab);
      if (b.dataset.tab === "renew") quest("看公辦分頁");
    }));
    $("#csv").addEventListener("click", downloadCsv);
    $("#foot").textContent += ` 本頁資料產生於 ${meta.generated}。`;

    map = L.map("map", { zoomSnap: 0.25, attributionControl: true });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(map);
    const g = L.geoJSON(gj, {
      style: () => ({ weight: 0.6, color: css("--line"), fillOpacity: 0.78, fillColor: css("--c5") }),
      onEachFeature: (f, lyr) => {
        layers[f.properties.village_code] = lyr;
        lyr.on("click", () => { select(f.properties.village_code, false); quest("點一個里"); });
        lyr.bindTooltip(() => {
          const v = byCode[f.properties.village_code];
          return `${v.town_name}${v.village_name}：` + (tab === "renew" ? `符合 ${v.c_n}／4 項` : `第 ${v.rank} 名`);
        }, { sticky: true });
      },
    }).addTo(map);
    // open on the basin, where the front of the list sits; the mountain villages stay one zoom out
    const basin = L.latLngBounds(V.filter((v) => v.rank_eq <= 150).map((v) => layers[v.village_code].getBounds().getCenter()));
    map.fitBounds(basin.isValid() ? basin : g.getBounds(), { padding: [20, 20] });

    window.addEventListener("resize", () => { sizeRows(); update(); });
    setTab(tab);
    if (wantMore) $("#more").scrollIntoView();
    if (/gap/.test(location.hash)) setTimeout(() => $("#gapTitle").scrollIntoView(), 300);
  }

  init().catch((e) => {
    console.error(e);
    $("#rows").textContent = "資料讀不到：請先跑 scripts/build_data.py。";
  });
})();

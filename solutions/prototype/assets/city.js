/*
 * city.js  Government entry page (city.html) plus the village text helpers
 * that brief.html reuses. Plain ES2020, no modules. Load after common.js.
 *
 * The page only runs when #city-app exists; brief.html loads this file for
 * the shared helpers on window.CityShared and runs its own brief.js.
 *
 * Shared helpers (window.CityShared):
 *   SHORT_LABELS                  factor key -> short label (always the full
 *                                 '一樓軟弱層候選' for soft_story, SPEC §9)
 *   factorSentence(key, props, v) the one-line number text for a factor (SPEC §6.2 row 6)
 *   factorRowsHtml(props, v, opts) five factor rows + composite row for a panel
 *   rankBarHtml(props, v, opts)   1..456 rank-interval bar (p05..p95 band, p50, equal rank)
 *   shareTop46Sentence(props, v)  '這個里在 X% 的權重組合下都排進全市前 46 名（前 10%）。'
 *   hiddenHtml(props, v)          '被總分藏起來' block
 *   s5Html(props)                 S5 candidate block
 *   knownCasesHtml(props)         village-level known cases sentence (SPEC §6.2 row 7)
 *   weightedLevels(features, weights, v) -> Map<village_code, {rank, score, level}>
 *   pctChange(x)                  ratio difference -> '+3.9 個百分點'
 */

'use strict';

(function () {
  const N_VILLAGES_FALLBACK = 456;
  const TOP_N = 46;

  const SHORT_LABELS = {
    elderly: '高齡',
    old_stock: '老屋',
    liquefaction: '液化',
    rescue: '救災',
    soft_story: '一樓軟弱層候選',
  };

  /* ------------------------------------------------------- text helpers */

  function num(x) {
    return x === null || x === undefined ? null : Number(x);
  }

  function pctChange(x) {
    if (x === null || x === undefined || Number.isNaN(Number(x))) return '無資料';
    const pp = Number(x) * 100;
    const sign = pp > 0 ? '+' : '';
    return `${sign}${pp.toFixed(1)} 個百分點`;
  }

  function fmtEst(x, digits = 1) {
    if (x === null || x === undefined || Number.isNaN(Number(x))) return '無資料';
    return Number(x).toFixed(digits);
  }

  // SPEC §6.2 row 6 and §7.3: one sentence of numbers per factor.
  function factorSentence(key, props, v) {
    const ver = v || DEFAULT_LIQ_VERSION;
    switch (key) {
      case 'elderly':
        return `65 歲以上 ${fmtPct(props.share_65plus)}（${fmtInt(props.pop_65plus)} 人）`;
      case 'old_stock': {
        const n = num(props.bld_age_known_n) || 0;
        let s = `1999 年前 ${fmtPct(props.bld_share_pre_policy_1999)}（樣本 ${fmtInt(n)} 棟）`;
        if (n < 20) s += '；樣本不足 20 棟，排名改用所在區中位數';
        return s;
      }
      case 'liquefaction':
        return `高潛勢占里面積 ${fmtPct(props[`liq_high_share_${ver}`])}，中潛勢 ${fmtPct(props[`liq_medium_share_${ver}`])}`;
      case 'rescue':
        return `列管窄巷 ${fmtInt(props.narrow_lanes_n)} 條（紅區 ${fmtInt(props.narrow_lanes_red_n)}）、寬度 <6 m 標註 ${fmtPct(props.road_markers_lt6m_share)}`;
      case 'soft_story': {
        const a = num(props.soft_story_a_n) || 0;
        const b = num(props.soft_story_b_n) || 0;
        return `${fmtInt(a + b)} 棟（A 型 ${fmtInt(a)}、B 型 ${fmtInt(b)}），占門牌棟數 ${fmtPct(props.soft_story_rate)}`;
      }
      default:
        return '';
    }
  }

  function kindTag(kind) {
    return kind === '推估' ? estimateTagHtml() : `<span class="tag">原始</span>`;
  }

  // Five factor rows followed by the composite row. The composite is never
  // shown alone: it sits under the five with the fixed '等權合成，僅供對照' tag.
  function factorRowsHtml(props, v, opts = {}) {
    const ver = v || DEFAULT_LIQ_VERSION;
    const rows = villageFactorLevels(props, ver).map((f) => {
      const lv = f.level;
      return `<li class="factor-row ${lv ? levelClass(lv) : 'lv-none'}">
        <span class="factor-bar" aria-hidden="true"></span>
        <div class="factor-body">
          <div class="factor-top">
            <span class="factor-name">${escapeHtml(f.label)} ${kindTag(f.kind)}</span>
            ${levelChipHtml(lv)}
          </div>
          <div class="factor-num">${escapeHtml(factorSentence(f.key, props, ver))}${f.key === 'liquefaction' && liqShareNote(props, ver) ? `<br><span class="muted">${escapeHtml(liqShareNote(props, ver))}</span>` : ''}</div>
          ${opts.dates ? `<div class="factor-date">資料日期 ${escapeHtml(f.data_date)}</div>` : ''}
        </div>
      </li>`;
    });
    const clv = props[`composite_level_${ver}`];
    const crank = props[`composite_rank_${ver}`];
    rows.push(`<li class="factor-row is-composite ${clv ? levelClass(clv) : 'lv-none'}">
      <span class="factor-bar" aria-hidden="true"></span>
      <div class="factor-body">
        <div class="factor-top">
          <span class="factor-name">等權合成 <span class="tag">${escapeHtml(COMPOSITE_NOTE)}</span></span>
          ${levelChipHtml(clv)}
        </div>
        <div class="factor-num">五個百分位的平均；等權排名第 ${fmtInt(crank)}／${fmtInt(opts.n || N_VILLAGES_FALLBACK)}</div>
      </div>
    </li>`);
    return `<ul class="factor-rows">${rows.join('')}</ul>`;
  }

  // Rank interval bar. Left is rank 1 (most dangerous). opts.weighted = {rank}
  // adds a triangle for the current slider ranking.
  function rankBarHtml(props, v, opts = {}) {
    const ver = v || DEFAULT_LIQ_VERSION;
    const n = opts.n || N_VILLAGES_FALLBACK;
    const p05 = num(props[`rank_p05_${ver}`]);
    const p50 = num(props[`rank_p50_${ver}`]);
    const p95 = num(props[`rank_p95_${ver}`]);
    const eq = num(props[`composite_rank_${ver}`]);
    const pos = (r) => `${(((r - 1) / (n - 1)) * 100).toFixed(2)}%`;
    if (p05 === null || p95 === null) return '<p class="panel-line muted">沒有排名區間資料。</p>';
    const ticks = [1, TOP_N, 100, 200, 300, n];
    const weighted = opts.weighted && Number.isFinite(opts.weighted.rank)
      ? `<span class="rank-weighted" style="left:${pos(opts.weighted.rank)}" title="滑桿加權排名第 ${opts.weighted.rank}"></span>`
      : '';
    return `<div class="rank-bar" role="img" aria-label="排名區間第 ${p05} 到第 ${p95} 名，中位數第 ${p50} 名，等權排名第 ${eq} 名">
      <div class="rank-track">
        <span class="rank-line"></span>
        <span class="rank-band" style="left:${pos(p05)};width:calc(${pos(p95)} - ${pos(p05)})" title="p05～p95：第 ${p05}～${p95} 名"></span>
        ${eq !== null ? `<span class="rank-equal" style="left:${pos(eq)}" title="等權排名第 ${eq}"></span>` : ''}
        ${p50 !== null ? `<span class="rank-p50" style="left:${pos(p50)}" title="中位數排名第 ${p50}"></span>` : ''}
        ${weighted}
      </div>
      <div class="rank-axis">${ticks.map((t) => `<span class="${t === TOP_N ? 'rank-top46' : ''}" style="left:${pos(t)}">${t}</span>`).join('')}</div>
      <div class="rank-legend">
        <span class="k"><i class="k-band"></i>第 5～95 百分位 ${p05}～${p95}</span>
        <span class="k"><i class="k-p50"></i>中位數 ${p50}</span>
        ${eq !== null ? `<span class="k"><i class="k-equal"></i>等權 ${eq}</span>` : ''}
        ${weighted ? `<span class="k"><i class="k-weighted"></i>滑桿加權 ${opts.weighted.rank}</span>` : ''}
      </div>
    </div>`;
  }

  function shareTop46Sentence(props, v) {
    const ver = v || DEFAULT_LIQ_VERSION;
    const s = num(props[`share_top46_${ver}`]);
    if (s === null) return '沒有權重敏感度資料。';
    return `這個里在 ${fmtPct(s, 1)} 的權重組合下都排進全市前 ${TOP_N} 名（前 10%）。`;
  }

  function hiddenHtml(props, v) {
    const ver = v || DEFAULT_LIQ_VERSION;
    const hidden = !!props[`hidden_by_composite_${ver}`];
    if (!hidden) return `<p class="panel-line">否。沒有因子在 4～5 級卻被等權合成壓到 1～2 級。</p>`;
    const keys = hiddenFactors(props, ver);
    const clv = props[`composite_level_${ver}`];
    const items = keys.map((k) => {
      const lv = props[factorField(k, 'lv', ver)];
      const label = k === 'liquefaction' ? `液化（${LIQ_VERSIONS[ver].label}）` : (LABELS.factor[k] || k);
      return `<li class="${levelClass(lv)}"><span class="lv-swatch"></span>${escapeHtml(label)} ${lv ? `${lv} 級` : ''}</li>`;
    }).join('');
    return `<p class="panel-line"><b>是。</b>下列因子在 4～5 級，等權合成卻只有 ${clv ? `${clv} 級` : '低級'}：</p>
      <ul class="hidden-list">${items}</ul>`;
  }

  function s5Html(props) {
    if (!props.s5_candidate) {
      return `<p class="panel-line">否。候選條件是三項同時成立：有窄巷或道路寬度標註 &lt;6 m 比例在前 10%；任一版液化高潛勢比例 ≥25%；80 歲以上比例在中位數以上。</p>`;
    }
    return `<p class="panel-line"><b>是。</b>${escapeHtml(props.s5_reason || '')}</p>
      <p class="panel-line muted">80 歲以上 ${fmtPct(props.share_80plus)}（${fmtInt(props.pop_80plus)} 人）；搶救困難場所 ${fmtInt(props.fire_rescue_sites_n)} 處（參考，不進排名）。</p>`;
  }

  // heritage_sites_n (c8 2026-10-18, 文化部文資局開放資料). Text for the table column
  // and the known-cases sentence; null when the column is absent.
  function heritageCount(props) {
    const n = num(props.heritage_sites_n);
    return n === null || Number.isNaN(n) ? null : n;
  }

  function heritageCellHtml(props) {
    const n = heritageCount(props);
    return `<td class="num">${n === null ? '<span class="muted">無資料</span>' : fmtInt(n)}</td>`;
  }

  function knownCasesHtml(props) {
    const sea = fmtInt(props.sea_sand_cases_n);
    const seaUnits = fmtInt(props.sea_sand_units);
    const quake = fmtInt(props.quake_listed_n);
    const weilao = fmtEst(props.weilao_active_est, 1);
    const heritage = heritageCount(props);
    const heritageText = heritage === null ? '' : `、文化資產 <b>${fmtInt(heritage)}</b> 處`;
    return `<p class="panel-line">本里海砂屋列管 <b>${sea}</b> 案（${seaUnits} 戶）、地震黃單 <b>${quake}</b> 筆、有效危老核准案約 <b>${weilao}</b> 件（依路段分攤的期望值）${estimateTagHtml()}${heritageText}。</p>
      <p class="panel-line muted">案數以清冊地址比對落里，屬推估；海砂屋 115/3/25 版、黃單 115/3/18 版、危老 1151002 版${heritage === null ? '' : '；文化資產為文化部文資局開放資料（2026-10-18 下載）'}。所在區有效危老核准案 ${fmtInt(props.town_weilao_active_n)} 件（區層級，同區各里相同）。</p>`;
  }

  // Slider ranking: rank with common.js rankAll(), then map rank to a level
  // with the same fixed shares the marts use (percentileToLevel).
  function weightedLevels(features, weights, v) {
    const rows = rankAll(features, weights, v);
    const n = rows.length;
    const out = new Map();
    for (const r of rows) {
      const p = 1 - r.rank / n + 0.5 / n;
      out.set(r.village_code, { rank: r.rank, score: r.score, level: percentileToLevel(p) });
    }
    return out;
  }

  function levelDotsHtml(props, v) {
    const ver = v || DEFAULT_LIQ_VERSION;
    const dots = villageFactorLevels(props, ver).map((f) =>
      `<span class="dot ${f.level ? levelClass(f.level) : 'lv-none'}" title="${escapeHtml(f.label)} ${f.level ? `${f.level} 級` : '無資料'}"></span>`);
    return `<span class="lv-dots" aria-label="五因子等級">${dots.join('')}</span>`;
  }

  function miniChipHtml(level) {
    if (!level) return '<span class="muted">無</span>';
    return `<span class="mini-chip ${levelClass(level)}"><span class="lv-swatch"></span>${level} 級</span>`;
  }

  window.CityShared = {
    SHORT_LABELS, TOP_N,
    factorSentence, factorRowsHtml, rankBarHtml, shareTop46Sentence,
    hiddenHtml, s5Html, knownCasesHtml, heritageCount, weightedLevels, levelDotsHtml, miniChipHtml, pctChange, fmtEst,
  };

  /* ============================================================ page */

  const app = document.getElementById('city-app');
  if (!app) return;

  const VIEWS = FACTORS.map((f) => ({ key: f.key, label: f.label, kind: 'factor', versioned: !!f.versioned }))
    .concat([
      { key: 'composite', label: '等權合成', kind: 'composite', note: '僅供對照' },
      { key: 'weighted', label: '滑桿加權', kind: 'weighted' },
    ]);

  const EQUAL_WEIGHT = 20;

  const state = {
    view: 'elderly',
    version: DEFAULT_LIQ_VERSION,
    weights: Object.fromEntries(FACTOR_KEYS.map((k) => [k, EQUAL_WEIGHT])),
    showStable: true,
    selected: null,
    tab: 'stable',
  };

  let villages = null;
  let meta = null;
  let byCode = new Map();
  let nVillages = N_VILLAGES_FALLBACK;
  let weighted = new Map();
  let map = null;
  let geoLayer = null;
  let layersByCode = new Map();
  let baseLayer = null;
  let labelLayer = null;

  const $ = (sel, root = document) => root.querySelector(sel);

  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  /* ------------------------------------------------------ controls */

  function renderViewList() {
    const ul = $('#view-list');
    const parts = [];
    for (const vw of VIEWS) {
      if (vw.kind === 'composite') parts.push('<li class="view-sep" role="presentation"></li>');
      const label = vw.versioned ? `${vw.label}（${LIQ_VERSIONS[state.version].label}）` : vw.label;
      const tag = vw.note ? `<span class="tag view-tag">${escapeHtml(vw.note)}</span>` : (vw.kind === 'weighted' ? '<span class="tag view-tag">即時重算，僅供對照</span>' : '');
      parts.push(`<li><label class="${state.view === vw.key ? 'is-active' : ''}">
        <input type="radio" name="view" value="${vw.key}" ${state.view === vw.key ? 'checked' : ''}>
        <span>${escapeHtml(label)}</span>${tag}</label></li>`);
    }
    ul.innerHTML = parts.join('');
    ul.querySelectorAll('input[name="view"]').forEach((el) => {
      el.addEventListener('change', () => {
        state.view = el.value;
        ul.querySelectorAll('label').forEach((l) => l.classList.toggle('is-active', l.contains(el)));
        $('#weights').classList.toggle('is-muted', state.view !== 'weighted');
        restyleMap();
        renderLegend();
        renderPanel();
      });
    });
    $('#weights').classList.toggle('is-muted', state.view !== 'weighted');
  }

  function renderVersionButtons() {
    const box = $('#version-seg');
    box.querySelectorAll('button').forEach((b) => {
      b.setAttribute('aria-pressed', b.dataset.version === state.version ? 'true' : 'false');
    });
  }

  function setVersion(v) {
    if (!LIQ_VERSIONS[v] || v === state.version) return;
    state.version = v;
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('liq', v);
      history.replaceState(null, '', url);
    } catch (e) { /* ignore */ }
    renderVersionButtons();
    renderViewList();
    recomputeWeighted();
    restyleMap();
    renderLegend();
    renderKpis();
    renderPanel();
    renderTabs();
  }

  function renderWeights() {
    const box = $('#weights');
    const total = FACTOR_KEYS.reduce((s, k) => s + state.weights[k], 0);
    box.innerHTML = FACTOR_KEYS.map((k) => {
      const f = FACTORS.find((x) => x.key === k);
      const label = f.versioned ? `${f.label}（${LIQ_VERSIONS[state.version].label}）` : f.label;
      const share = total > 0 ? Math.round((state.weights[k] / total) * 100) : 0;
      return `<div class="slider">
        <div class="slider-label"><span>${escapeHtml(label)}</span><span>占 <b data-share="${k}">${share}</b>%</span></div>
        <input type="range" min="0" max="100" step="1" value="${state.weights[k]}" data-weight="${k}" aria-label="${escapeHtml(label)}權重">
        <span class="slider-value"><b data-value="${k}">${state.weights[k]}</b></span>
      </div>`;
    }).join('');
    box.querySelectorAll('input[type="range"]').forEach((el) => {
      el.addEventListener('input', () => {
        state.weights[el.dataset.weight] = Number(el.value);
        updateWeightReadout();
        onWeightsChanged();
      });
    });
  }

  function updateWeightReadout() {
    const total = FACTOR_KEYS.reduce((s, k) => s + state.weights[k], 0);
    for (const k of FACTOR_KEYS) {
      const v = $(`[data-value="${k}"]`);
      const s = $(`[data-share="${k}"]`);
      if (v) v.textContent = state.weights[k];
      if (s) s.textContent = total > 0 ? Math.round((state.weights[k] / total) * 100) : 0;
    }
    const warn = $('#weights-warn');
    if (warn) warn.hidden = total > 0;
  }

  const onWeightsChanged = debounce(() => {
    recomputeWeighted();
    if (state.view !== 'weighted') {
      state.view = 'weighted';
      renderViewList();
    }
    restyleMap();
    renderLegend();
    renderPanel();
  }, 40);

  function resetWeights() {
    for (const k of FACTOR_KEYS) state.weights[k] = EQUAL_WEIGHT;
    renderWeights();
    updateWeightReadout();
    recomputeWeighted();
    restyleMap();
    renderLegend();
    renderPanel();
  }

  function recomputeWeighted() {
    const total = FACTOR_KEYS.reduce((s, k) => s + state.weights[k], 0);
    const w = total > 0 ? state.weights : Object.fromEntries(FACTOR_KEYS.map((k) => [k, 1]));
    weighted = weightedLevels(villages.features, w, state.version);
  }

  /* ------------------------------------------------------ levels */

  function currentView() {
    return VIEWS.find((v) => v.key === state.view) || VIEWS[0];
  }

  function levelFor(props) {
    const vw = currentView();
    if (vw.kind === 'factor') return props[factorField(vw.key, 'lv', state.version)] || null;
    if (vw.kind === 'composite') return props[`composite_level_${state.version}`] || null;
    const w = weighted.get(props.village_code);
    return w ? w.level : null;
  }

  function viewTitle() {
    const vw = currentView();
    if (vw.kind === 'factor') return vw.versioned ? `${vw.label}（${LIQ_VERSIONS[state.version].label}）` : vw.label;
    if (vw.kind === 'composite') return `等權合成（${LIQ_VERSIONS[state.version].label}液化）`;
    return `滑桿加權（${LIQ_VERSIONS[state.version].label}液化）`;
  }

  /* ------------------------------------------------------ map */

  // Basemap from common.js TILE_LAYERS (OpenStreetMap standard tiles, SPEC §6.2
  // row 9). Dark mode dims the tiles with CSS (.is-dark on the stage).
  function tileFor(mode) {
    const stage = $('#map-stage');
    if (stage) stage.classList.toggle('is-dark', mode === 'dark');
    const t = TILE_LAYERS[mode] || TILE_LAYERS.light;
    return L.tileLayer(t.url, { attribution: t.attribution, maxZoom: t.maxZoom });
  }

  function labelsFor() {
    return null;
  }

  function styleFor(feature) {
    const props = feature.properties;
    const lv = levelFor(props);
    const selected = props.village_code === state.selected;
    const stable = state.showStable && isStableTop(props, state.version, 0.9);
    const dark = themeMode() === 'dark';
    return {
      fillColor: lv ? levelColor(lv) : cssVar('--lv-none') || '#cfd4d1',
      fillOpacity: lv ? 0.8 : 0.5,
      color: selected ? cssVar('--accent') : stable ? (dark ? '#f2f2f2' : '#111111') : (dark ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.7)'),
      weight: selected ? 3.5 : stable ? 2.2 : 0.7,
      opacity: 1,
    };
  }

  function restyleMap() {
    if (!geoLayer) return;
    geoLayer.setStyle(styleFor);
    const sel = layersByCode.get(state.selected);
    if (sel) sel.bringToFront();
  }

  function tooltipHtml(layer) {
    const p = layer.feature.properties;
    const lv = levelFor(p);
    const w = weighted.get(p.village_code);
    const vw = currentView();
    const line = vw.kind === 'factor'
      ? factorSentence(vw.key, p, state.version)
      : vw.kind === 'composite'
        ? `等權排名第 ${fmtInt(p[`composite_rank_${state.version}`])}（僅供對照）`
        : `滑桿加權排名第 ${w ? w.rank : '?'}`;
    return `<b>${escapeHtml(p.town_name)} ${escapeHtml(p.village_name)}</b><br>
      ${escapeHtml(viewTitle())}：${lv ? `${lv} 級（${LEVEL_NAMES[lv]}）` : '無資料'}<br>
      <span class="muted">${escapeHtml(line)}</span><br>
      <span class="muted">進前 46 名的比例 ${fmtPct(p[`share_top46_${state.version}`], 0)}</span>`;
  }

  async function initMap() {
    const stage = $('#map-stage');
    const el = $('#city-map');
    try {
      await loadLeaflet();
    } catch (err) {
      el.innerHTML = `<div class="map-fallback">地圖程式庫載不進來（${escapeHtml(err.message)}）。右欄與下方清單仍可使用。</div>`;
      return;
    }
    map = L.map(el, { zoomSnap: 0.5, preferCanvas: false });
    map.createPane('labels');
    map.getPane('labels').style.zIndex = 450;
    map.getPane('labels').style.pointerEvents = 'none';
    const mode = themeMode();
    baseLayer = tileFor(mode).addTo(map);
    labelLayer = labelsFor(mode);
    map.fitBounds(TAIPEI_BOUNDS);

    geoLayer = L.geoJSON(villages, {
      style: styleFor,
      onEachFeature: (feature, layer) => {
        layersByCode.set(feature.properties.village_code, layer);
        layer.bindTooltip(tooltipHtml, { sticky: true, className: 'village-tip', direction: 'top', opacity: 1 });
        layer.on('mouseover', () => {
          if (feature.properties.village_code !== state.selected) layer.setStyle({ weight: 2.5, color: cssVar('--focus') });
          layer.bringToFront();
        });
        layer.on('mouseout', () => {
          layer.setStyle(styleFor(feature));
          const sel = layersByCode.get(state.selected);
          if (sel) sel.bringToFront();
        });
        layer.on('click', () => selectVillage(feature.properties.village_code, { fly: false }));
      },
    }).addTo(map);

    onThemeChange((m) => {
      if (baseLayer) map.removeLayer(baseLayer);
      if (labelLayer) map.removeLayer(labelLayer);
      baseLayer = tileFor(m).addTo(map);
      labelLayer = labelsFor(m);
      restyleMap();
      renderLegend();
    });

    const status = $('#map-status');
    if (status) status.hidden = true;
    stage.classList.add('is-ready');
  }

  function renderLegend() {
    const box = $('#map-legend');
    if (!box) return;
    const vw = currentView();
    const rows = [5, 4, 3, 2, 1].map((lv) =>
      `<div class="legend-row ${levelClass(lv)}"><span class="lv-swatch"></span><span class="n">${lv}</span><span>${LEVEL_NAMES[lv]}</span></div>`).join('');
    const note = vw.kind === 'composite'
      ? `${COMPOSITE_NOTE}。五個因子的百分位平均。`
      : vw.kind === 'weighted'
        ? '依左欄滑桿的加權和重新排名，再按固定比例分 5 級。'
        : '';
    box.innerHTML = `<div class="legend-title">${escapeHtml(viewTitle())}${vw.kind !== 'factor' ? `<span class="tag">${vw.kind === 'composite' ? '僅供對照' : '即時重算，僅供對照'}</span>` : ''}</div>
      <div class="legend-rows">${rows}
        <div class="legend-row lv-none"><span class="lv-swatch"></span><span class="n"></span><span>無資料</span></div>
        ${state.showStable ? `<div class="legend-row"><span class="legend-outline"></span><span class="n"></span><span>穩定前段</span></div>` : ''}
      </div>
      <div class="legend-note">等級${RELATIVE_NOTE}；5 級＝最危險的 1.6%，1 級＝其餘 45.2%。${escapeHtml(note)}${state.showStable ? ' 粗框＝≥90% 權重組合都進前 46 名。' : ''}</div>`;
  }

  /* ------------------------------------------------------ selection */

  function selectVillage(code, opts = {}) {
    const f = byCode.get(code);
    if (!f) return;
    state.selected = code;
    restyleMap();
    renderPanel();
    highlightRows();
    if (map && opts.fly !== false) {
      const layer = layersByCode.get(code);
      if (layer) map.fitBounds(layer.getBounds(), { maxZoom: 15, padding: [24, 24] });
    }
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('v', code);
      url.searchParams.set('liq', state.version);
      history.replaceState(null, '', url);
    } catch (e) { /* ignore */ }
  }

  function highlightRows() {
    document.querySelectorAll('.city-lists tbody tr').forEach((tr) => {
      tr.classList.toggle('is-selected', tr.dataset.code === state.selected);
    });
  }

  /* ------------------------------------------------------ right panel */

  function renderPanel() {
    const box = $('#panel');
    const f = byCode.get(state.selected);
    if (!f) {
      box.innerHTML = `<p class="panel-empty">點地圖上的里，或從下方清單選一列，這裡會顯示該里的五因子、排名區間與已知案件。</p>
        <p class="panel-empty muted">目前視圖：${escapeHtml(viewTitle())}。等級${RELATIVE_NOTE}。</p>`;
      return;
    }
    const p = f.properties;
    const v = state.version;
    const w = weighted.get(p.village_code);
    const stable = isStableTop(p, v, 0.9);
    const stableHalf = isStableTop(p, v, 0.5);
    const hidden = !!p[`hidden_by_composite_${v}`];

    box.innerHTML = `
      <div class="panel-head">
        <span class="town">${escapeHtml(p.town_name)} ・ 里代碼 ${escapeHtml(p.village_code)}</span>
        <h3>${escapeHtml(p.village_name)}</h3>
        <span class="pop">人口 ${fmtInt(p.pop_total)} 人，65 歲以上 ${fmtPct(p.share_65plus)}，80 歲以上 ${fmtPct(p.share_80plus)}；面積 ${fmtEst(p.area_km2, 2)} km²，門牌 ${fmtInt(p.doorplate_buildings)} 棟</span>
        <div class="row" style="gap:6px;margin-top:6px">
          ${stable ? badgeHtml('穩定前段', 'warn') : stableHalf ? badgeHtml('半數權重組合進前 46', 'estimated') : ''}
          ${hidden ? badgeHtml('被總分藏起來', 'info') : ''}
          ${p.s5_candidate ? badgeHtml('救災可及性候選 S5', 'warn') : ''}
        </div>
      </div>

      <section class="panel-section">
        <h4>五因子 <span class="tag">${RELATIVE_NOTE}</span></h4>
        ${factorRowsHtml(p, v, { n: nVillages })}
      </section>

      <section class="panel-section">
        <h4>排名區間 <span class="muted">2,000 組隨機權重，1 最危險</span></h4>
        ${rankBarHtml(p, v, { n: nVillages, weighted: state.view === 'weighted' && w ? { rank: w.rank } : null })}
        <p class="rank-text">等權排名第 <b>${fmtInt(p[`composite_rank_${v}`])}</b>${state.view === 'weighted' && w ? `，目前滑桿加權排名第 <b>${w.rank}</b>` : ''}。</p>
        <p class="rank-text">${escapeHtml(shareTop46Sentence(p, v))}</p>
      </section>

      <section class="panel-section">
        <h4>被總分藏起來</h4>
        ${hiddenHtml(p, v)}
      </section>

      <section class="panel-section">
        <h4>救災可及性候選 S5</h4>
        ${s5Html(p)}
      </section>

      <section class="panel-section">
        <h4>里層級已知案件 <span class="muted">筆數，不給門牌</span></h4>
        ${knownCasesHtml(p)}
      </section>

      <div class="panel-actions">
        <a class="btn btn-primary" href="brief.html?v=${encodeURIComponent(p.village_code)}&liq=${encodeURIComponent(v)}" target="_blank" rel="noopener">一頁里況說明</a>
        <button type="button" class="btn" id="btn-zoom">放大到這個里</button>
      </div>`;

    const zoom = $('#btn-zoom');
    if (zoom) zoom.addEventListener('click', () => {
      const layer = layersByCode.get(p.village_code);
      if (map && layer) map.fitBounds(layer.getBounds(), { maxZoom: 15, padding: [24, 24] });
    });
  }

  /* ------------------------------------------------------ KPIs */

  function counts() {
    const v = state.version;
    const P = villages.features.map((f) => f.properties);
    return {
      stable: P.filter((p) => isStableTop(p, v, 0.9)).length,
      half: P.filter((p) => isStableTop(p, v, 0.5)).length,
      hidden: P.filter((p) => !!p[`hidden_by_composite_${v}`]).length,
      s5: P.filter((p) => !!p.s5_candidate).length,
    };
  }

  function renderKpis() {
    const c = counts();
    const box = $('#kpis');
    const tiles = [
      { tab: 'stable', label: '穩定前段', value: c.stable, unit: '里', note: `≥90% 權重組合都進前 46；≥50% 有 ${c.half} 里（${LIQ_VERSIONS[state.version].label}液化）` },
      { tab: 'hidden', label: '被總分藏起來', value: c.hidden, unit: '里', note: '至少一個因子 4～5 級，等權合成只有 1～2 級' },
      { tab: 's5', label: '救災可及性候選 S5', value: c.s5, unit: '里', note: '窄巷或窄路、液化高、80 歲以上多，三項同時成立' },
      { tab: 'aging', label: '高齡化最快', value: 20, unit: '里', note: '65 歲以上比例 110/1 到 115/9 上升最多的前 20' },
    ];
    box.innerHTML = tiles.map((t) => `<button type="button" class="kpi-tile" data-tab="${t.tab}" aria-pressed="${state.tab === t.tab}">
      <span class="kpi-label">${escapeHtml(t.label)}</span>
      <span class="kpi-value">${t.value}<small>${t.unit}／${nVillages}</small></span>
      <span class="kpi-note">${escapeHtml(t.note)}</span>
    </button>`).join('');
    box.querySelectorAll('.kpi-tile').forEach((b) => b.addEventListener('click', () => {
      setTab(b.dataset.tab);
      $('#city-lists').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }));
  }

  /* ------------------------------------------------------ tabs */

  const TABS = [
    { key: 'stable', label: '穩定前段' },
    { key: 'hidden', label: '被總分藏起來' },
    { key: 's5', label: '救災可及性候選 S5' },
    { key: 'aging', label: '高齡化最快' },
  ];

  function setTab(key) {
    state.tab = key;
    document.querySelectorAll('#tabs [role="tab"]').forEach((b) => {
      const on = b.dataset.tab === key;
      b.setAttribute('aria-selected', on ? 'true' : 'false');
      b.tabIndex = on ? 0 : -1;
    });
    document.querySelectorAll('.tab-panel').forEach((pnl) => { pnl.hidden = pnl.dataset.tab !== key; });
    document.querySelectorAll('.kpi-tile').forEach((b) => b.setAttribute('aria-pressed', b.dataset.tab === key ? 'true' : 'false'));
  }

  function rowBase(p) {
    return `<td class="tname">${escapeHtml(p.town_name)}</td><td class="vname">${escapeHtml(p.village_name)}</td>`;
  }

  function shareCell(s) {
    const pct = s === null || s === undefined ? 0 : Math.round(Number(s) * 100);
    return `<td class="num"><span class="share-bar" aria-hidden="true"><i style="width:${pct}%"></i></span>${fmtPct(s, 1)}</td>`;
  }

  function stableTableHtml(rows, v) {
    if (!rows.length) return '<p class="muted small">這一版沒有符合的里。</p>';
    return `<div class="table-wrap"><table class="table">
      <thead><tr><th>區</th><th>里</th><th class="num">進前 46 名的比例</th><th class="num">等權排名</th><th class="num">排名區間 p05～p95</th><th>五因子等級</th><th class="num">文資</th><th>備註</th></tr></thead>
      <tbody>${rows.map((p) => `<tr data-code="${p.village_code}" tabindex="0">${rowBase(p)}
        ${shareCell(p[`share_top46_${v}`])}
        <td class="num">${fmtInt(p[`composite_rank_${v}`])}</td>
        <td class="num">${fmtInt(p[`rank_p05_${v}`])}～${fmtInt(p[`rank_p95_${v}`])}</td>
        <td>${levelDotsHtml(p, v)}</td>
        ${heritageCellHtml(p)}
        <td>${p.s5_candidate ? badgeHtml('S5', 'warn') : ''} ${p[`hidden_by_composite_${v}`] ? badgeHtml('被藏', 'info') : ''}</td>
      </tr>`).join('')}</tbody></table></div>`;
  }

  function renderTabs() {
    const v = state.version;
    const P = villages.features.map((f) => f.properties);
    const byShare = (a, b) => (b[`share_top46_${v}`] || 0) - (a[`share_top46_${v}`] || 0) || (a[`composite_rank_${v}`] || 0) - (b[`composite_rank_${v}`] || 0);

    // 1 stable
    const stable = P.filter((p) => isStableTop(p, v, 0.9)).sort(byShare);
    const half = P.filter((p) => isStableTop(p, v, 0.5) && !isStableTop(p, v, 0.9)).sort(byShare);
    $('[data-tab="stable"].tab-panel').innerHTML = `
      <p class="tab-intro">不論五個因子的權重怎麼抽，這些里幾乎都排進全市前 ${TOP_N} 名（前 10%）。排名區間用 2,000 組隨機權重預先算好；液化用${escapeHtml(LIQ_VERSIONS[v].label)}。</p>
      <p class="tab-sub">≥90% 的權重組合都進前 46（${stable.length} 里）</p>
      ${stableTableHtml(stable, v)}
      <p class="tab-sub">另列：50%～90% 的權重組合進前 46（${half.length} 里）</p>
      ${stableTableHtml(half, v)}
      <p class="tab-sub muted small">文資＝里內登錄文化資產處數（文化部文資局開放資料，2026-10-18 下載）。</p>`;

    // 2 hidden
    const hidden = P.filter((p) => !!p[`hidden_by_composite_${v}`]).sort((a, b) => {
      const ma = Math.max(...hiddenFactors(a, v).map((k) => a[factorField(k, 'lv', v)] || 0));
      const mb = Math.max(...hiddenFactors(b, v).map((k) => b[factorField(k, 'lv', v)] || 0));
      return mb - ma || (a[`composite_rank_${v}`] || 0) - (b[`composite_rank_${v}`] || 0);
    });
    $('[data-tab="hidden"].tab-panel').innerHTML = `
      <p class="tab-intro">至少一個因子在 4～5 級，等權合成卻只有 1～2 級。這 ${hidden.length} 個里是「只看總分就會漏掉」的例子，也是不用單一總分的理由。</p>
      <div class="table-wrap"><table class="table">
        <thead><tr><th>區</th><th>里</th><th>被藏起來的因子</th><th>等權合成</th><th class="num">等權排名</th><th>五因子等級</th></tr></thead>
        <tbody>${hidden.map((p) => `<tr data-code="${p.village_code}" tabindex="0">${rowBase(p)}
          <td>${hiddenFactors(p, v).map((k) => {
            const lv = p[factorField(k, 'lv', v)];
            const label = k === 'liquefaction' ? '液化' : SHORT_LABELS[k] || k;
            return `<span class="mini-chip ${levelClass(lv)}"><span class="lv-swatch"></span>${escapeHtml(label)} ${lv} 級</span>`;
          }).join('　')}</td>
          <td>${miniChipHtml(p[`composite_level_${v}`])} <span class="muted small">僅供對照</span></td>
          <td class="num">${fmtInt(p[`composite_rank_${v}`])}</td>
          <td>${levelDotsHtml(p, v)}</td>
        </tr>`).join('')}</tbody></table></div>`;

    // 3 S5
    const s5 = P.filter((p) => !!p.s5_candidate).sort((a, b) => (b.share_80plus || 0) - (a.share_80plus || 0));
    $('[data-tab="s5"].tab-panel').innerHTML = `
      <p class="tab-intro">救災進不去又最需要救的里：有窄巷或道路寬度標註 &lt;6 m 比例在前 10%，任一版液化高潛勢比例 ≥25%，80 歲以上比例在中位數以上。三項同時成立才列入，共 ${s5.length} 里，附理由。</p>
      <div class="table-wrap"><table class="table">
        <thead><tr><th>區</th><th>里</th><th>理由</th><th class="num">80 歲以上</th><th class="num">窄巷</th><th class="num">液化高（城市／全國）</th><th>救災等級</th><th>液化等級</th><th class="num">文資</th></tr></thead>
        <tbody>${s5.map((p) => `<tr data-code="${p.village_code}" tabindex="0">${rowBase(p)}
          <td class="reason">${escapeHtml(p.s5_reason || '')}</td>
          <td class="num">${fmtPct(p.share_80plus)}</td>
          <td class="num">${fmtInt(p.narrow_lanes_n)} 條</td>
          <td class="num">${fmtPct(p.liq_high_share_city2019, 0)}／${fmtPct(p.liq_high_share_national2026, 0)}</td>
          <td>${miniChipHtml(p.lv_rescue)}</td>
          <td>${miniChipHtml(p[`lv_liquefaction_${v}`])}</td>
          ${heritageCellHtml(p)}
        </tr>`).join('')}</tbody></table></div>
      <p class="tab-sub muted small">文資＝里內登錄文化資產處數（文化部文資局開放資料，2026-10-18 下載）。</p>`;

    // 4 aging
    const aging = P.slice().sort((a, b) => (b.share_65plus_change_110_115 || -9) - (a.share_65plus_change_110_115 || -9)).slice(0, 20);
    $('[data-tab="aging"].tab-panel').innerHTML = `
      <p class="tab-intro">65 歲以上比例從 110 年 1 月到 115 年 9 月上升最多的 20 個里，並列 1999 年前老屋存量比例（${ESTIMATE_NOTE}：有建成年的戶中，1999 政策線以前的比例）。老屋多又快速高齡化的里，是下一波「雙老」。</p>
      <div class="table-wrap"><table class="table">
        <thead><tr><th>區</th><th>里</th><th class="num">65 歲以上比例變化</th><th class="num">65 歲以上（115/9）</th><th class="num">1999 年前老屋比例</th><th class="num">樣本棟數</th><th>高齡等級</th><th>老屋等級</th><th>五因子等級</th></tr></thead>
        <tbody>${aging.map((p) => `<tr data-code="${p.village_code}" tabindex="0">${rowBase(p)}
          <td class="num">${escapeHtml(pctChange(p.share_65plus_change_110_115))}</td>
          <td class="num">${fmtPct(p.share_65plus)}</td>
          <td class="num">${fmtPct(p.bld_share_pre_policy_1999)} ${estimateTagHtml()}</td>
          <td class="num">${fmtInt(p.bld_age_known_n)}</td>
          <td>${miniChipHtml(p.lv_elderly)}</td>
          <td>${miniChipHtml(p.lv_old_stock)}</td>
          <td>${levelDotsHtml(p, v)}</td>
        </tr>`).join('')}</tbody></table></div>`;

    // tab counts
    const c = { stable: stable.length, hidden: hidden.length, s5: s5.length, aging: aging.length };
    document.querySelectorAll('#tabs [role="tab"]').forEach((b) => {
      const cnt = b.querySelector('.count');
      if (cnt) cnt.textContent = c[b.dataset.tab];
    });
    highlightRows();
  }

  function bindTabs() {
    const tabs = $('#tabs');
    tabs.innerHTML = TABS.map((t) => `<button type="button" role="tab" data-tab="${t.key}" aria-selected="${state.tab === t.key}" aria-controls="tab-${t.key}">${t.label}<span class="count"></span></button>`).join('');
    tabs.querySelectorAll('[role="tab"]').forEach((b) => b.addEventListener('click', () => setTab(b.dataset.tab)));
    tabs.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const idx = TABS.findIndex((t) => t.key === state.tab);
      const next = TABS[(idx + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length];
      setTab(next.key);
      tabs.querySelector(`[data-tab="${next.key}"]`).focus();
    });
    const lists = $('#city-lists');
    lists.addEventListener('click', (e) => {
      const tr = e.target.closest('tr[data-code]');
      if (tr) selectVillage(tr.dataset.code, { fly: true });
    });
    lists.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const tr = e.target.closest('tr[data-code]');
      if (tr) { e.preventDefault(); selectVillage(tr.dataset.code, { fly: true }); }
    });
    setTab(state.tab);
  }

  /* ------------------------------------------------------ init */

  async function init() {
    const status = $('#map-status');
    try {
      [villages, meta] = await Promise.all([loadVillages(), loadMeta()]);
    } catch (err) {
      app.insertAdjacentHTML('afterbegin', `<div class="callout callout-warn">資料載不進來：${escapeHtml(err.message)}。請從 prototype 目錄用 http 伺服器開啟（例如 python -X utf8 -m http.server）。</div>`);
      if (status) status.textContent = '資料載入失敗';
      return;
    }
    byCode = indexVillages(villages);
    nVillages = villages.features.length || N_VILLAGES_FALLBACK;

    const params = new URLSearchParams(window.location.search);
    const liq = params.get('liq');
    if (liq && LIQ_VERSIONS[liq]) state.version = liq;

    renderVersionButtons();
    $('#version-seg').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => setVersion(b.dataset.version)));
    renderViewList();
    renderWeights();
    updateWeightReadout();
    $('#btn-reset').addEventListener('click', resetWeights);
    const stableToggle = $('#toggle-stable');
    stableToggle.checked = state.showStable;
    stableToggle.addEventListener('change', () => { state.showStable = stableToggle.checked; restyleMap(); renderLegend(); });

    recomputeWeighted();
    renderKpis();
    bindTabs();
    renderTabs();
    renderPanel();
    renderFooter('#footer', meta);

    const genEl = $('#generated');
    if (genEl && meta.generated) genEl.textContent = `資料檔產生日 ${meta.generated}`;

    await initMap();
    renderLegend();

    const pre = params.get('v');
    // Keep the city overview on first load; the selected village is outlined.
    if (pre && byCode.has(pre)) selectVillage(pre, { fly: false });
  }

  init();
})();

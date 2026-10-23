/*
 * app.js  UI for variant D: tabs, consent simulator views, portrait cards, decision tree.
 * Data globals: window.ConsentSim (sim.js), window.PORTRAITS, window.DECISION_TREE.
 */
(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const el = (tag, attrs, html) => {
    const e = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => e.setAttribute(k, v));
    if (html != null) e.innerHTML = html;
    return e;
  };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ---------------------------------------------------------------- tabs
  const openTab = (name) => {
    document.querySelectorAll('nav.tabs button').forEach((x) => x.setAttribute('aria-selected', String(x.dataset.tab === name)));
    document.querySelectorAll('section.panel').forEach((p) => p.classList.toggle('active', p.id === 'tab-' + name));
  };
  document.querySelectorAll('nav.tabs button').forEach((b) => {
    b.addEventListener('click', () => { openTab(b.dataset.tab); history.replaceState(null, '', location.search + '#' + b.dataset.tab); });
  });
  if (['sim', 'people', 'tree'].includes(location.hash.slice(1))) openTab(location.hash.slice(1));

  // ---------------------------------------------------------------- simulator
  const S = window.ConsentSim;
  const B0 = S.calibrate();
  const RUNS = 2000;
  const PERSON = '<svg viewBox="0 0 20 28" aria-hidden="true"><circle cx="10" cy="6" r="5"/><path d="M2 27c0-7 3-13 8-13s8 6 8 13z"/></svg>';

  const people = $('#people');
  for (let i = 0; i < 100; i++) people.insertAdjacentHTML('beforeend', PERSON);
  const peopleEls = Array.from(people.children);
  peopleEls.forEach((p, i) => p.style.setProperty('--d', (i * 0.008).toFixed(3) + 's'));

  // Starting state from the consent progress board (variant E): ?n_total=&n_signed=&n_refused=
  const qs = new URLSearchParams(location.search);
  const board = (() => {
    const t = parseInt(qs.get('n_total'), 10);
    if (!(t > 0)) return null;
    const sg = Math.max(0, Math.min(t, parseInt(qs.get('n_signed'), 10) || 0));
    const rf = Math.max(0, Math.min(t - sg, parseInt(qs.get('n_refused'), 10) || 0));
    return { n: t, preSigned: sg, preRefused: rf };
  })();
  if (board) {
    if (board.n > Number($('#n').max)) $('#n').max = board.n;
    if (board.n < Number($('#n').min)) $('#n').min = board.n;
    const bb = $('#board-banner');
    bb.hidden = false;
    bb.textContent = `📋 從同意書進度板帶入：${board.n} 戶，已簽 ${board.preSigned}、已拒絕 ${board.preRefused}。下面算的是接下來的機會。`;
  }

  const ctl = {
    n: { el: $('#n'), fmt: (v) => v + ' 戶' },
    elderly: { el: $('#elderly'), fmt: (v) => Math.round(v * 100) + '%' },
    shops: { el: $('#shops'), fmt: (v) => v + ' 間' },
    transparency: { el: $('#transparency'), fmt: (v) => Math.round(v * 100) + '%' },
  };
  const flags = ['manager', 'riskInfo', 'damaged'];

  function readState() {
    const s = { ...S.DEFAULTS };
    Object.keys(ctl).forEach((k) => { s[k] = Number(ctl[k].el.value); });
    flags.forEach((k) => { s[k] = $('#' + k).checked; });
    if (board && s.n === board.n) { s.preSigned = board.preSigned; s.preRefused = board.preRefused; }
    return s;
  }
  function setState(s) {
    Object.keys(ctl).forEach((k) => { ctl[k].el.value = s[k]; });
    flags.forEach((k) => { $('#' + k).checked = !!s[k]; });
  }

  const baseRes = S.simulate(S.DEFAULTS, B0, RUNS);
  let ruleIdx = 0;
  const rulePick = $('#rulepick');
  S.RULES.forEach((r, j) => {
    const b = el('button', { type: 'button', class: 'chip', role: 'radio', 'aria-checked': String(j === ruleIdx) },
      `${r.label.replace('都更・', '')}<small>${r.short}</small>`);
    b.addEventListener('click', () => {
      ruleIdx = j;
      userActed = true;
      lastWin = null;  // switching the rule is not an improvement; do not celebrate it
      rulePick.querySelectorAll('button').forEach((x, k) => x.setAttribute('aria-checked', String(k === j)));
      render();
    });
    rulePick.appendChild(b);
  });
  // Index of the person who has to sign for the rule to pass (">" rules need one more).
  const thresholdCell = (r) => (r.strict ? Math.floor(r.need * 100) : Math.ceil(r.need * 100) - 1);
  const HOUSE = '<svg viewBox="0 0 24 24"><path d="M12 3 2 11h3v10h5v-6h4v6h5V11h3z"/></svg>';
  const housesBox = $('#houses');
  for (let i = 0; i < 10; i++) housesBox.insertAdjacentHTML('beforeend', HOUSE);
  let lastLit = null;
  let lastWin = null;
  // Quest bar (design-kit/quest.js). Steps complete only on real user actions.
  const Q = window.Quest;
  const QS = { n: '拉一次戶數', clear: '講清楚拉到 100%', mgr: '派個案經理', tree: '看替代方案' };
  if (Q) Q.init({ page: 'd', role: '市府協調員', steps: Object.values(QS) });
  const quest = (k) => { if (Q) Q.done(QS[k]); };
  let userActed = false;
  const rulesBox = $('#rules');
  S.RULES.forEach((r) => {
    rulesBox.insertAdjacentHTML('beforeend',
      `<div class="rule"><div class="rname">${r.label}<small>${r.short}・${r.law}</small></div>
       <div class="bar"><div class="fill" data-rule="${r.id}"></div><div class="ghost" data-ghost="${r.id}"></div></div>
       <div class="rval" data-val="${r.id}"></div></div>`);
  });

  const LEVERS = [
    { ico: '🏚️', label: '現在的做法', mod: {} },
    { ico: '⚠️', label: '告訴住戶「你家危險」', mod: { riskInfo: true } },
    { ico: '🧮', label: '分回、暫住都算清楚', mod: { transparency: 0.9 } },
    { ico: '🧑‍💼', label: '派個案經理', mod: { manager: true } },
    { ico: '✨', label: '算清楚＋個案經理', mod: { transparency: 0.9, manager: true } },
  ];
  const leverBox = $('#levers');
  LEVERS.forEach((l, i) => leverBox.insertAdjacentHTML('beforeend',
    `<div class="lever"><span class="ico">${l.ico}</span><span>${l.label}</span>
     <div class="bar"><div class="fill" data-lever="${i}"></div></div><span class="rval" data-lever-val="${i}"></span></div>`));

  function drawCurve(s) {
    const svg = $('#curve');
    const W = 560, H = 240, L = 40, R = 130, T = 10, Bm = 30;
    const xs = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1];
    const series = S.RULES.map(() => []);
    xs.forEach((t) => {
      const r = S.simulate({ ...s, transparency: t }, B0, 600, 4242);
      r.p.forEach((p, j) => series[j].push(p));
    });
    const X = (t) => L + t * (W - L - R);
    const Y = (p) => T + (1 - p) * (H - T - Bm);
    const colors = ['#a52f2f', '#df7e2c', '#4f9a68', '#ad4d2a'];
    let g = `<line class="axis" x1="${L}" y1="${Y(0)}" x2="${W - R}" y2="${Y(0)}"/><line class="axis" x1="${L}" y1="${Y(1)}" x2="${L}" y2="${Y(0)}"/>`;
    [0, 0.5, 1].forEach((p) => { g += `<text x="${L - 6}" y="${Y(p) + 4}" text-anchor="end">${Math.round(p * 100)}</text>`; });
    g += `<text x="${L}" y="${H - 8}">簽了再說</text><text x="${W - R}" y="${H - 8}" text-anchor="end">全部算清楚</text>`;
    g += `<line class="now" x1="${X(s.transparency)}" y1="${Y(1)}" x2="${X(s.transparency)}" y2="${Y(0)}"/>`;
    series.forEach((pts, j) => {
      const d = pts.map((p, i) => (i ? 'L' : 'M') + X(xs[i]).toFixed(1) + ' ' + Y(p).toFixed(1)).join(' ');
      g += `<path d="${d}" fill="none" stroke="${colors[j]}" stroke-width="3"/>`;
      g += `<text x="${W - R + 6}" y="${Y(pts[pts.length - 1]) + 4}" style="fill:${colors[j]};font-weight:700">${S.RULES[j].short}</text>`;
    });
    g += `<text x="${L + 4}" y="${T + 10}">100 棟裡成功的棟數</text>`;
    svg.innerHTML = g;
  }

  function countTo(node, to) {
    const from = Number(node.textContent) || 0;
    // First paint shows the final number; only later changes count up (frozen frames stay correct).
    if (!node.dataset.ready || from === to || matchMedia('(prefers-reduced-motion: reduce)').matches) { node.dataset.ready = '1'; node.textContent = to; return; }
    const t0 = performance.now(), dur = 500;
    const step = (t) => {
      const k = Math.min(1, (t - t0) / dur);
      node.textContent = Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3)));
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function render() {
    const s = readState();
    Object.keys(ctl).forEach((k) => { $('#' + k + '-out').textContent = ctl[k].fmt(s[k]); });
    const res = S.simulate(s, B0, RUNS);
    const lit = Math.round(res.meanShare * 100);
    peopleEls.forEach((p, i) => p.classList.toggle('on', i < lit));
    countTo($('#signed-n'), lit);
    const rule = S.RULES[ruleIdx];
    const th = thresholdCell(rule);
    peopleEls.forEach((p, i) => p.classList.toggle('th', i === th));
    const passes = lit > th;
    people.classList.toggle('pass', passes);
    $('#pass-line').innerHTML = passes ? `✅ 平均過了「${rule.short}」` : `⛔ 平均還差 ${th + 1 - lit} 戶才到「${rule.short}」`;
    const pw = Math.round(res.p[ruleIdx] * 100);
    countTo($('#win-n'), pw);
    $('#win-label').textContent = `／100 棟能過${rule.label.replace('都更・', '')}`;
    Array.from(housesBox.children).forEach((h, i) => {
      const f = Math.max(0, Math.min(1, pw / 10 - i));
      h.style.setProperty('--f', f.toFixed(2));
      h.classList.toggle('on', f > 0);
    });
    if (lastLit != null && lit !== lastLit) {
      const d = $('#delta');
      d.textContent = (lit > lastLit ? '＋' : '−') + Math.abs(lit - lastLit);
      d.classList.remove('flash');
      void d.offsetWidth;
      d.classList.add('flash');
    }
    lastLit = lit;
    // Celebrate when the chosen rule crosses 30 of 100 buildings because of the user.
    if (Q && userActed && lastWin != null && lastWin < 30 && pw >= 30) {
      const gain = pw - Math.round(baseRes.p[ruleIdx] * 100);
      Q.confetti();
      Q.toast(gain > 0 ? `🎉 你讓 ${gain} 棟多過門檻` : `🎉 ${pw} 棟過門檻`);
    }
    lastWin = pw;
    S.RULES.forEach((r, j) => {
      const v = res.p[j];
      document.querySelector(`[data-rule="${r.id}"]`).style.width = (v * 100).toFixed(1) + '%';
      document.querySelector(`[data-ghost="${r.id}"]`).style.left = (baseRes.p[j] * 100).toFixed(1) + '%';
      const diff = Math.round(v * 100) - Math.round(baseRes.p[j] * 100);
      document.querySelector(`[data-val="${r.id}"]`).innerHTML =
        `${Math.round(v * 100)} 棟<small>${diff === 0 ? '同基準' : (diff > 0 ? '+' : '') + diff + ' 棟'}</small>`;
    });
    LEVERS.forEach((l, i) => {
      // Keep the building, reset what the city does, then apply one lever.
      const gov = { transparency: S.DEFAULTS.transparency, manager: false, riskInfo: false };
      const p = S.simulate({ ...s, ...gov, ...l.mod }, B0, RUNS, 31337).p[0];
      document.querySelector(`[data-lever="${i}"]`).style.width = (p * 100).toFixed(1) + '%';
      document.querySelector(`[data-lever-val="${i}"]`).textContent = Math.round(p * 100) + ' 棟';
    });
    drawCurve(s);
  }

  let pending = null;
  const schedule = () => { clearTimeout(pending); pending = setTimeout(render, 60); };
  Object.values(ctl).forEach((c) => c.el.addEventListener('input', () => { userActed = true; schedule(); }));
  flags.forEach((k) => $('#' + k).addEventListener('change', () => { userActed = true; schedule(); }));
  $('#n').addEventListener('change', () => quest('n'));
  $('#transparency').addEventListener('input', (e) => { if (Number(e.target.value) >= 1) quest('clear'); });
  $('#manager').addEventListener('change', (e) => { if (e.target.checked) quest('mgr'); });
  const START = board ? { ...S.DEFAULTS, n: board.n } : S.DEFAULTS;
  $('#reset').addEventListener('click', () => { setState(START); render(); });

  $('#params').innerHTML = '<tr><td><b>參數</b></td><td><b>值</b></td><td><b>出處</b></td></tr>' +
    Object.entries(S.PARAMS).map(([k, p]) =>
      `<tr><td>${k}</td><td>${Array.isArray(p.v) ? p.v.join(' / ') : (typeof p.v === 'number' ? +p.v.toFixed(3) : p.v)}</td><td>${esc(p.src)}</td></tr>`).join('') +
    `<tr><td>b0</td><td>${B0.toFixed(3)}</td><td>由校準得出</td></tr>`;

  setState(START);
  render();

  // ---------------------------------------------------------------- portraits
  const PD = window.PORTRAITS || { archetypes: [], items: [] };
  const TENURE_GROUP = (t) => t.startsWith('一樓店家') ? '店家' : t === '租客' ? '租客'
    : t.includes('出租') || t.includes('不同住') ? '不住這裡的屋主' : '住在這裡的屋主';
  const AVATAR = (p) => p.tenure.startsWith('一樓店家') ? '🏪' : p.tenure === '租客' ? '🔑'
    : (p.age >= 75 ? '👵' : p.age >= 65 ? '🧓' : p.lives_here ? '🏠' : '💼');
  const filt = { arch: 'all', tenure: 'all' };
  let showAll = false;

  function chipRow(box, items, key) {
    box.innerHTML = '';
    items.forEach(([v, label]) => {
      const c = el('button', { class: 'chip', type: 'button', 'aria-pressed': String(filt[key] === v) }, esc(label));
      c.addEventListener('click', () => { filt[key] = v; showAll = false; renderPeople(); });
      box.appendChild(c);
    });
  }

  function dots(level) {
    let h = '';
    for (let i = 1; i <= 5; i++) h += `<span class="d ${i === level ? 'lv' + level : ''}"></span>`;
    return h;
  }

  function renderPeople() {
    const items = PD.items.filter((x) => !x.check && x.run === 1);
    chipRow($('#arch-chips'), [['all', '全部五棟']].concat(PD.archetypes.map((a) => [a.id, `${a.id} ${a.town_name}${a.village_name}・${a.built_year} 年・${a.units} 戶`])), 'arch');
    chipRow($('#tenure-chips'), [['all', '所有身分'], ['住在這裡的屋主', '🏠 住在這裡的屋主'], ['不住這裡的屋主', '💼 不住這裡的屋主'], ['租客', '🔑 租客'], ['店家', '🏪 一樓店家']], 'tenure');
    const shown = items.filter((x) => (filt.arch === 'all' || x.p.archetype_id === filt.arch) && (filt.tenure === 'all' || TENURE_GROUP(x.p.tenure) === filt.tenure));

    const groups = ['住在這裡的屋主', '不住這裡的屋主', '租客', '店家'];
    const col = (v) => `var(--r${v})`;
    $('#movers').textContent = shown.filter((x) => x.p.is_owner && x.r.reaction_a.support_level <= 3 && x.r.reaction_b.support_level >= 4).length;
    let h = '';
    groups.forEach((g) => {
      const xs = shown.filter((x) => TENURE_GROUP(x.p.tenure) === g);
      if (!xs.length) return;
      const bar = (key, lbl) => {
        const cnt = [0, 0, 0, 0, 0, 0];
        xs.forEach((x) => { cnt[x.r[key].support_level]++; });
        const top = cnt.indexOf(Math.max(...cnt));
        const segs = [1, 2, 3, 4, 5].filter((v) => cnt[v]).map((v) =>
          `<span style="flex:${cnt[v]};background:${col(v)}" title="${cnt[v]} 人">${v === top ? cnt[v] + ' 人' : ''}</span>`).join('');
        return `<div class="srow"><span class="lbl2">${lbl}</span><div class="sbar">${segs}</div></div>`;
      };
      h += `<div class="sgroup"><b>${g}</b> <span class="muted">${xs.length} 人</span>${bar('reaction_a', '建商版')}${bar('reaction_b', '市府版')}</div>`;
    });
    $('#shift').innerHTML = h || '<p class="muted">結果還沒產生。</p>';
    $('#shift-legend').innerHTML = [1, 2, 3, 4, 5].map((v) => `<span><i style="display:inline-block;width:16px;height:16px;border-radius:50%;vertical-align:-2px;background:${col(v)}"></i> ${['', '堅決反對', '傾向反對', '觀望', '傾向支持', '馬上簽'][v]}</span>`).join('');

    const grid = $('#pgrid');
    grid.innerHTML = '';
    document.querySelectorAll('.more-btn').forEach((b) => b.remove());
    const perGroup = {};
    const visible = showAll ? shown : shown.filter((x) => {
      const g = TENURE_GROUP(x.p.tenure);
      perGroup[g] = (perGroup[g] || 0) + 1;
      return perGroup[g] <= 2;
    });
    visible.forEach((x) => {
      const p = x.p, r = x.r;
      const card = el('article', { class: 'pcard' });
      card.innerHTML = `
        <div class="who"><div class="avatar">${AVATAR(p)}</div><div>
          <div class="one">${esc(r.portrait.one_line)}</div>
          <div class="meta">${esc(p.archetype_id)}・${esc(p.floor_label)}・${esc(p.tenure)}・${p.age} 歲</div></div></div>
        <div class="quote a">「${esc(r.reaction_a.quote)}」</div>
        <div class="dots">建商版 ${dots(r.reaction_a.support_level)}</div>
        <div class="dots">市府版 ${dots(r.reaction_b.support_level)}</div>
        <span class="action">${esc(r.likely_action)}</span>
        <details><summary>聽完市府版、還有什麼</summary>
          <div class="quote b">「${esc(r.reaction_b.quote)}」</div>
          <div class="tags">${(r.top_concerns || []).slice(0, 3).map((c) => `<span class="tag">${esc(c)}</span>`).join('')}</div>
          <p><b>家對他的意義：</b>${esc(r.portrait.what_home_means)}</p>
          <p><b>錢：</b>${esc(r.portrait.money)}</p>
          <p><b>聽誰的：</b>${esc(r.portrait.who_they_listen_to)}</p>
          <p><b>絕對不行：</b>${esc(r.dealbreaker)}</p>
          <p><b>會改變心意，如果：</b>${esc(r.would_change_mind_if)}</p>
          <p><b>可能誤會：</b>${esc(r.reaction_a.misunderstanding)}</p>
        </details>`;
      grid.appendChild(card);
    });
    if (!showAll && shown.length > visible.length) {
      const more = el('button', { type: 'button', class: 'chip more-btn' }, `再看 ${shown.length - visible.length} 位`);
      more.addEventListener('click', () => { showAll = true; renderPeople(); });
      grid.after(more);
    }
  }
  renderPeople();

  // ---------------------------------------------------------------- social housing bars
  const SH = window.SOCIAL_HOUSING;
  if (SH && SH.by_town) {
    const rows = SH.by_town.filter((r) => r.in_taipei);
    const sites = rows.reduce((a, r) => a + r.sites, 0), hh = rows.reduce((a, r) => a + r.households, 0);
    const max = Math.max(...rows.map((r) => r.households));
    $('#shbars').innerHTML = rows.map((r) =>
      `<div class="shrow"><span>${esc(r.town)}</span>
        <div class="bar"><div class="fill" style="width:${(r.households / max * 100).toFixed(1)}%"></div></div>
        <b>${r.households ? r.households.toLocaleString() + ' 戶' : '—'}</b></div>`).join('')
      + `<p class="muted">臺北市內共 ${sites} 處、${hh.toLocaleString()} 戶；市府在新北另有 2 處未列入【實測，${esc(SH.source)}】</p>`;
  }

  // ---------------------------------------------------------------- decision tree
  const DT = window.DECISION_TREE;
  const treeBox = $('#tree');
  if (!DT || !DT.nodes || !DT.nodes.length) {
    treeBox.innerHTML = '<div class="card muted">決策樹資料還沒產生。</div>';
  } else {
    const nodes = Object.fromEntries(DT.nodes.map((n) => [n.id, n]));
    const opts = Object.fromEntries((DT.options || []).map((o) => [o.id, o]));
    const path = [];
    const first = DT.nodes[0].id;

    const showOptions = (ids) => {
      const wrap = $('#tree-opts-wrap');
      const box = $('#tree-opts');
      box.innerHTML = '';
      (ids || []).forEach((id) => {
        const o = opts[id];
        if (!o) return;
        box.insertAdjacentHTML('beforeend', `<div class="opt"><h3>${esc(o.name)}</h3>
          <div>${esc(o.why_fits || o.what || '')}</div>
          <details><summary>誰能申請、多少錢</summary><div class="facts">
            <p><b>是什麼：</b>${esc(o.what)}</p><p><b>誰能申請：</b>${esc(o.who_can_apply)}</p>
            <p><b>金額：</b>${esc(o.amount == null ? '待確認' : o.amount)}</p>
            <p><b>期限：</b>${esc(o.deadline_or_period == null ? '待確認' : o.deadline_or_period)}</p>
            <p><b>法源：</b>${esc(o.legal_basis || '待確認')}</p>${(o.caveats || []).length ? '<p><b>注意：</b>' + o.caveats.map(esc).join('；') + '</p>' : ''}<p><b>出處：</b>${(Array.isArray(o.source) ? o.source : [o.source]).map((x) => esc(x && x.path ? x.path + ' ' + (x.section || '') : x)).join('；')} ${esc(o.evidence || '')}</p></div></details></div>`);
      });
      wrap.hidden = !(ids && ids.length);
    };

    const icon = (t) => {
      if (/^不知道|判不出|^還不確定|^沒回答|沒帶值/.test(t)) return '❓';
      if (/^(沒有|不是|不行|不到|不懷疑|付不起)/.test(t)) return '❌';
      const map = [[/古蹟|歷史建築|列冊/, '🏛️'], [/中、低/, '🟡'], [/^高$/, '🔴'], [/風險/, '🔍'], [/補強/, '🔧'],
        [/重建/, '🏗️'], [/%|過半|3\/4|4\/5/, '✍️'], [/m²/, '📐'], [/層/, '🏢'], [/年|g1/, '📅'], [/R|ID/, '📊'],
        [/列管/, '📋'], [/懷疑/, '🧂'], [/劃定|更新地區/, '🗺️'], [/付得起/, '💰'], [/候選/, '⚠️'], [/921|331|403/, '🌏']];
      for (const [re, ic] of map) if (re.test(t)) return ic;
      return /^(是|有|可以)/.test(t) ? '✅' : '➡️';
    };
    // Longest question chain from the first node, for "question k of about N".
    // Memoised: each node is solved once (enumerating every path took ~9 s on load).
    const memo = {};
    const longest = (id, stack = new Set()) => {
      if (!id || !nodes[id] || stack.has(id)) return 0;
      if (memo[id] != null) return memo[id];
      stack.add(id);
      const m = Math.max(0, ...nodes[id].branches.map((b) => longest(b.next, stack)));
      stack.delete(id);
      return (memo[id] = 1 + m);
    };
    const maxQ = longest(first);

    const draw = () => {
      treeBox.innerHTML = '';
      let id = first;
      const collected = [];
      for (let depth = 0; id && depth < 30; depth++) {
        const n = nodes[id];
        if (!n) break;
        const picked = path[depth];
        const box = el('div', { class: 'tnode' + (picked == null ? ' current' : '') });
        box.innerHTML = `<div class="q">${esc(n.question)}</div><div class="branches"></div>`;
        n.branches.forEach((b, bi) => {
          const lab = b.label || (b.when && b.when.value) || '其他';
        const btn = el('button', { type: 'button', class: picked === bi ? 'picked' : '' }, `<span class="ic">${icon(lab)}</span><span>${esc(lab)}</span>`);
          btn.addEventListener('click', () => { path.length = depth; path[depth] = bi; draw(); if (window.Quest) window.Quest.done('看替代方案'); });
          box.querySelector('.branches').appendChild(btn);
        });
        treeBox.appendChild(box);
        if (picked == null) break;
        const br = n.branches[picked];
        (br.option_ids || []).forEach((o) => { if (!collected.includes(o)) collected.push(o); });
        id = br.next || null;
        if (id) treeBox.appendChild(el('div', { class: 'arrow', 'aria-hidden': 'true' }, '↓'));
      }
      const asked = treeBox.querySelectorAll('.tnode').length;
      const done = path.length >= asked && treeBox.querySelector('.tnode.current') == null;
      $('#tprog').innerHTML = `<div class="tbar"><i style="width:${Math.min(100, (asked / maxQ) * 100).toFixed(0)}%"></i></div>`
        + `<span>${done ? '✅ 走完了，看下面的路' : `第 ${asked} 題`}</span>`;
      showOptions(collected);
    };
    draw();
  }
})();

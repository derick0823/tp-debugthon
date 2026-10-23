// design-kit/kit.js — tiny helpers for kit.css parts. No packages. Call again with new
// values to animate (CSS transitions do the motion). Each helper is independent.
(function () {
  const raf = f => requestAnimationFrame(() => requestAnimationFrame(f));
  // First draw lands on the final value with no transition (static state = true value,
  // also safe for screenshots where rAF/CSS animation is frozen). Later calls animate.
  function paint(el, f) {
    if (el.dataset.drawn) return raf(f);
    el.dataset.drawn = 1; el.classList.add('k-now'); f(); void el.offsetWidth; el.classList.remove('k-now');
  }
  const PERSON = '<svg viewBox="0 0 20 30" aria-hidden="true"><circle cx="10" cy="5" r="4.5" fill="currentColor"/>' +
    '<path d="M3 30V17a7 7 0 0 1 14 0v13z" fill="currentColor"/></svg>';

  // 100 people, first n highlighted. opts.color sets the highlight color.
  function people(el, n, opts = {}) {
    if (el.children.length !== 100) {
      el.innerHTML = Array.from({ length: 100 }, (_, i) => PERSON.replace('<svg', `<svg style="--i:${i}"`)).join('');
      el.setAttribute('role', 'img');
    }
    if (opts.color) el.style.setProperty('--k-on', opts.color);
    const k = Math.round(Math.max(0, Math.min(100, n)));
    paint(el, () => [...el.children].forEach((s, i) => s.classList.toggle('on', i < k)));
    el.setAttribute('aria-label', opts.label || `每 100 人有 ${k} 人`);
  }

  // One bar: value v on a 0..max scale. Element must contain <i>; optional <b> shows text.
  function bar(el, v, max = 100, text) {
    paint(el, () => { el.querySelector('i').style.width = Math.max(0, Math.min(100, v / max * 100)) + '%'; });
    const b = el.querySelector('b'); if (b) b.textContent = text ?? v;
  }

  // Meter with threshold line t (same scale as v). Turns green when v >= t.
  function meter(el, v, t, max = 100, label = '門檻') {
    let u = el.querySelector('u');
    if (!el.querySelector('i')) el.insertAdjacentHTML('afterbegin', '<i></i>');
    if (!u) { u = document.createElement('u'); el.appendChild(u); }
    u.style.left = (t / max * 100) + '%'; u.dataset.label = label;
    el.classList.toggle('pass', v >= t);
    paint(el, () => { el.querySelector('i').style.width = Math.min(100, v / max * 100) + '%'; });
  }

  // Stacked blocks. items: [{label, v, color, base}] bottom first. opts: {max, cap, capLabel, onPick}
  function stack(el, items, opts = {}) {
    const sum = items.reduce((a, x) => a + x.v, 0);
    const max = opts.max || Math.max(sum, opts.cap || 0) * 1.05;
    if (!el.querySelector('.col') || el.dataset.n !== String(items.length)) {
      el.dataset.n = items.length;
      el.innerHTML = '<div class="col">' + items.map((x, i) =>
        `<div class="blk${x.base ? ' base' : ''}" data-i="${i}" style="--k-c:${x.color || ''}" title="${x.label}"></div>`).join('') +
        '</div><div class="keys">' + items.map(x => `<div style="--k-c:${x.color || 'var(--muted)'}"><i></i>${x.label}</div>`).join('') + '</div>';
      el.addEventListener('click', e => {
        const t = e.target.closest('.blk,.keys div'); if (!t) return;
        const k = t.classList.contains('blk') ? +t.dataset.i : [...t.parentNode.children].indexOf(t);
        el.querySelectorAll('.blk').forEach((x, i) => x.classList.toggle('sel', i === k));
        el.querySelectorAll('.keys div').forEach((x, i) => x.classList.toggle('sel', i === k));
        el._pick && el._pick(k);
      });
    }
    el._pick = opts.onPick;
    items.forEach((x, i) => { el.querySelectorAll('.keys div')[i].lastChild.textContent = x.label; });
    const col = el.querySelector('.col');
    let cap = col.querySelector('.cap');
    if (opts.cap) {
      if (!cap) { cap = document.createElement('div'); cap.className = 'cap'; col.appendChild(cap); }
      cap.style.bottom = (opts.cap / max * 100) + '%'; cap.innerHTML = `<span>${opts.capLabel || '上限'}</span>`;
    } else if (cap) cap.remove();
    const set = () => items.forEach((x, i) => { col.querySelectorAll('.blk')[i].style.height = (x.v / max * 100) + '%'; });
    paint(el, set);
  }

  // Two houses sized by floor area (area ~ drawn area, so scale = sqrt). opts: {labels, colors}
  function houses(el, a, b, opts = {}) {
    const [la, lb] = opts.labels || ['現在的家', '分回的家'];
    const [ca, cb] = opts.colors || ['var(--muted)', 'var(--accent)'];
    const shape = c => `<svg viewBox="0 0 100 100"><g class="h"><path d="M8 42 50 6l42 36z" fill="${c}"/>` +
      `<rect x="18" y="40" width="64" height="58" fill="${c}" opacity=".85"/>` +
      `<rect x="28" y="52" width="16" height="14" fill="var(--bg)"/><rect x="56" y="52" width="16" height="14" fill="var(--bg)"/>` +
      `<rect x="42" y="74" width="16" height="24" fill="var(--bg)"/></g></svg>`;
    if (!el.querySelector('svg')) {
      el.innerHTML = `<div>${shape(ca)}<span class="k-num" data-v="a"></span><div>${la}</div></div>` +
        `<div class="arrow" aria-hidden="true">→</div>` +
        `<div>${shape(cb)}<span class="k-num" data-v="b"></span><div>${lb}</div></div>`;
    }
    const m = Math.max(a, b), g = el.querySelectorAll('.h');
    paint(el, () => { g[0].style.transform = `scale(${Math.sqrt(a / m)})`; g[1].style.transform = `scale(${Math.sqrt(b / m)})`; });
    const f = opts.fmt || (x => x.toFixed(1) + '<small>坪</small>');
    el.querySelector('[data-v=a]').innerHTML = f(a);
    el.querySelector('[data-v=b]').innerHTML = f(b);
  }

  // Count a number up/down to `to`. opts: {dur ms, fmt}
  function count(el, to, opts = {}) {
    const fmt = opts.fmt || (x => Math.round(x).toLocaleString('zh-TW'));
    const first = !('v' in el.dataset), from = el._shown ?? parseFloat(el.dataset.v || 0);
    const t0 = performance.now(), dur = opts.dur ?? 600;
    const token = el._tok = (el._tok || 0) + 1; // a newer call stops older loops
    const show = x => { el._shown = x; el.textContent = fmt(x); };
    el.dataset.v = to;
    if (first || matchMedia('(prefers-reduced-motion: reduce)').matches) return show(to);
    const step = () => {
      if (el._tok !== token) return;
      const p = Math.max(0, Math.min(1, (performance.now() - t0) / dur)); // rAF timestamp can predate t0
      show(from + (to - from) * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    setTimeout(() => { if (el._tok === token) show(to); }, dur + 100); // land even if rAF is throttled
  }

  // Steps: mark step k (1-based) as current, earlier ones done.
  function steps(ol, k) { [...ol.children].forEach((li, i) => { li.classList.toggle('done', i < k - 1); li.classList.toggle('now', i === k - 1); }); }

  window.Kit = { people, bar, meter, stack, houses, count, steps };
})();

/* Premium layer: signature dishes, live stats, scroll reveals, header state. */
(() => {
  'use strict';
  const ui = window.MusashiUI;
  if (!ui) return;
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const hi = item => item.largeImage || (window.MUSASHI_HIRES || {})[item.name] || item.image;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const motionOff = () => reduced.matches || document.body.classList.contains('no-motion');
  document.documentElement.classList.add('js');

  /* Signature dishes — chosen from the selected venue; nothing invented. */
  const wishes = [
    {re:/^Рамен з рваною телятиною/i, kanji:'麺', note:'Рамен'},
    {re:/^Ґьодза з куркою/i, kanji:'餃', note:'Ґьодза'},
    {re:/^Рамен креветковий/i, kanji:'海', note:'Рамен'},
    {re:/^Цукемен/i, kanji:'つ', note:'Цукемен'},
    {re:/^Бао з лососем|^Бао/i, kanji:'包', note:'Бао'},
    {re:/^Місо рамен/i, kanji:'味', note:'Рамен'},
    {re:/^Філадельфія/i, kanji:'巻', note:'Роли'},
    {re:/^Рамен з куркою Абурі/i, kanji:'炙', note:'Рамен'}
  ];
  function renderSignature() {
    const grid = $('#signature-grid');
    if (!grid) return;
    const rows = ui.rows().filter(r => r.item.image && r.sectionTitle.startsWith('ОСНОВНЕ'));
    const picked = [], used = new Set();
    for (const w of wishes) {
      const row = rows.find(r => w.re.test(r.item.name) && !used.has(hi(r.item)));
      if (row) { picked.push({row, w}); used.add(hi(row.item)); }
      if (picked.length === 5) break;
    }
    for (const row of rows) {
      if (picked.length >= 5) break;
      if (/РАМЕН|ҐЬОДЗА|БАО|РОЛИ/i.test(row.categoryTitle) && !used.has(hi(row.item))) { picked.push({row, w:{kanji:'味', note:row.categoryTitle}}); used.add(hi(row.item)); }
    }
    grid.innerHTML = picked.map(({row, w}, i) => `<button class="sig-card reveal" data-sig="${i}" aria-label="${esc(row.item.name)} — ${esc(row.item.price)}">
      <span class="sig-photo"><img src="${esc(hi(row.item))}" alt="${esc(row.item.name)}" loading="lazy" decoding="async"></span>
      <span class="sig-kanji" lang="ja" aria-hidden="true">${w.kanji}</span>
      <span class="sig-info"><small>${String(i + 1).padStart(2, '0')} · ${esc(w.note)}</small><strong>${esc(row.item.name)}</strong><em>${esc(row.item.price || '')}</em></span>
      <span class="sig-arrow" aria-hidden="true">→</span></button>`).join('');
    grid.onclick = e => {
      const b = e.target.closest('[data-sig]');
      const p = b && picked[+b.dataset.sig];
      if (p) ui.openDish(p.row.si, p.row.ci, p.row.ii);
    };
    observe(grid.querySelectorAll('.reveal'));
  }

  /* Stats derived from the data snapshot. */
  function renderStats() {
    const venues = window.MUSASHI.venues;
    const names = new Set();
    venues.forEach(v => v.sections.forEach(s => s.categories.forEach(c => c.items.forEach(i => names.add(i.name.trim().toLowerCase())))));
    const opens = venues.map(v => (v.hours || '').slice(0, 5)).filter(Boolean).sort();
    const set = (k, v) => { const el = document.querySelector(`[data-stat="${k}"]`); if (el) el.dataset.target = v; };
    set('venues', String(venues.length));
    set('dishes', String(Math.floor(names.size / 10) * 10) + '+');
    set('open', opens[0] || '10:00');
    document.querySelectorAll('[data-stat]').forEach(el => { el.textContent = el.dataset.target; });
  }
  function countUp(el) {
    const target = el.dataset.target || el.textContent;
    const m = /^(\d+)(.*)$/.exec(target);
    if (!m || motionOff()) { el.textContent = target; return; }
    const end = +m[1], tail = m[2], t0 = performance.now(), dur = 1400;
    const step = t => {
      const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 4);
      el.textContent = Math.round(end * e) + tail;
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  /* Reveal on scroll — content is visible without JS and with reduced motion. */
  let io;
  function observe(nodes) {
    if (!io) { nodes.forEach(n => n.classList.add('is-in')); return; }
    nodes.forEach(n => io.observe(n));
  }
  if ('IntersectionObserver' in window) {
    io = new IntersectionObserver(entries => {
      for (const en of entries) {
        if (!en.isIntersecting) continue;
        en.target.classList.add('is-in');
        en.target.querySelectorAll?.('[data-stat]').forEach(countUp);
        io.unobserve(en.target);
      }
    }, {threshold: .12, rootMargin: '0px 0px -6% 0px'});
  }

  /* Header becomes solid after the hero. */
  const header = $('.site-header');
  const onScroll = () => header.classList.toggle('is-solid', scrollY > 40);
  addEventListener('scroll', onScroll, {passive: true});
  onScroll();

  /* Auto-reveal major blocks. */
  document.querySelectorAll('.cooking-copy, .cooking-art, .pour-copy, .menu-tools, .location-row, .finale > *, .bar-selection').forEach(n => n.classList.add('reveal'));
  renderStats();
  observe(document.querySelectorAll('.reveal'));
  renderSignature();
  document.addEventListener('musashi:venue', renderSignature);
})();

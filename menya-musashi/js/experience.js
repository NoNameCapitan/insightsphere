/* Menya Musashi — Network edition experience layer.
   Preloader · branch personalisation · cinematic hero · steam canvas ·
   scroll-driven ritual · horizontal gallery · bar & pour · Kyiv map · cursor. */
(() => {
  'use strict';
  const ui = window.MusashiUI;
  if (!ui) return;
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const hi = item => item.largeImage || (window.MUSASHI_HIRES || {})[item.name] || item.image;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const fine = matchMedia('(pointer: fine)');
  const off = () => reduced.matches || document.body.classList.contains('no-motion');
  const G = window.gsap, ST = window.ScrollTrigger;
  const hasGsap = !!(G && ST);
  if (hasGsap) G.registerPlugin(ST);
  document.documentElement.classList.add('js');
  const isEmbed = new URLSearchParams(location.search).has('embed');
  if (isEmbed) document.documentElement.classList.add('is-embed');

  /* ---------- Branch personalisation ---------- */
  let profile, heroRow;
  const foodRows = () => ui.rows().filter(r => r.item.image && r.sectionTitle.startsWith('ОСНОВНЕ'));
  function findDish(patterns) {
    const rows = foodRows();
    for (const p of patterns || []) {
      let re; try { re = new RegExp(p, 'i'); } catch { continue; }
      const row = rows.find(r => re.test(r.item.name));
      if (row) return row;
    }
    return rows.find(r => /РАМЕН/i.test(r.categoryTitle)) || rows[0];
  }
  function shade(hex, amt) {
    const n = parseInt(hex.slice(1).replace(/^(.)(.)(.)$/, '$1$1$2$2$3$3'), 16);
    const c = [n >> 16, n >> 8 & 255, n & 255].map(v => Math.max(0, Math.min(255, Math.round(v + (amt > 0 ? (255 - v) * amt : v * amt)))));
    return '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
  }
  function applyProfile(animate) {
    const venue = ui.getVenue();
    profile = window.musashiProfile(venue);
    const root = document.documentElement.style;
    root.setProperty('--accent', profile.accent);
    root.setProperty('--accent-2', shade(profile.accent, .25));
    root.setProperty('--accent-glow', profile.accent + '33');
    const [l1, l2] = profile.headline;
    const setText = () => {
      $('#hero-l1').textContent = l1; $('#hero-l2').textContent = l2;
      $('#hero-tagline').textContent = profile.tagline + ' · ' + venue.name;
      $('#branch-district').textContent = profile.district || venue.subtitle || 'Київ';
    };
    if (animate && hasGsap && !off()) {
      G.timeline().to('.stage-copy .word, #hero-tagline', {yPercent: 110, opacity: 0, duration: .35, ease: 'power2.in', stagger: .04})
        .add(setText).fromTo('.stage-copy .word, #hero-tagline', {yPercent: 110, opacity: 0}, {yPercent: 0, opacity: 1, duration: .8, ease: 'expo.out', stagger: .07});
    } else setText();
    updateOpen();
    heroRow = findDish(profile.heroDish);
    if (heroRow) {
      const img = $('#hero-dish-img'), src = hi(heroRow.item);
      const swap = () => { img.src = src; img.alt = heroRow.item.name; };
      if (animate && hasGsap && !off()) G.timeline().to('.bowl-photo', {scale: .7, rotate: -25, opacity: 0, duration: .4, ease: 'power2.in'}).add(swap).to('.bowl-photo', {scale: 1, rotate: 0, opacity: 1, duration: 1.1, ease: 'elastic.out(1,.75)'});
      else swap();
      $('#hero-dish-name').textContent = heroRow.item.name;
      $('#hero-dish-price').textContent = heroRow.item.price || '';
      $('#hero-dish-kind').textContent = 'Фірмова страва · ' + (profile.short || 'філія');
      $('#hero-bowl').setAttribute('aria-label', 'Відкрити страву: ' + heroRow.item.name);
      $('#ritual-bowl-img').src = src;
      $('#ritual-final').textContent = `${heroRow.item.name} — ${heroRow.item.price}. Справжнє фото з меню філії.`;
    }
    $('#ring-text').textContent = `ФІРМОВА СТРАВА · ${(profile.short || '').toUpperCase()} · ${profile.kanji || '麺'} · ФІРМОВА СТРАВА · ${(profile.short || '').toUpperCase()} · ${profile.kanji || '麺'} ·`;
    $('#finale-branch').textContent = 'Вечеря чекає · ' + venue.name;
    document.title = `Menya Musashi ${profile.short || ''} — ${l1} ${l2}`.replace(/\s+/g, ' ');
    renderGallery(); renderBar(false); updatePour(); drawMap();
  }
  function updateOpen() {
    const st = window.musashiOpenState(ui.getVenue().hours);
    const badge = $('#branch-badge');
    badge.dataset.open = String(st.open);
    $('#branch-open').textContent = st.soon ? st.text + ' · ' + st.soon : st.text;
  }
  setInterval(updateOpen, 60000);
  $('#hero-bowl').addEventListener('click', () => heroRow && ui.openDish(heroRow.si, heroRow.ci, heroRow.ii));
  $('#ritual-dish').addEventListener('click', () => heroRow && ui.openDish(heroRow.si, heroRow.ci, heroRow.ii));

  /* ---------- Gallery ---------- */
  const galleryWish = [/^Рамен з рваною телятиною/i, /^Ґьодза з куркою/i, /^Рамен креветковий/i, /^Цукемен/i, /^Бао/i, /^Місо рамен/i, /^Філадельфія/i, /^Окономіякі/i, /^Мітараші данго|^Таякі/i];
  let galleryRows = [];
  function renderGallery() {
    const rows = foodRows(), used = new Set(), picked = [];
    for (const re of galleryWish) {
      const r = rows.find(x => re.test(x.item.name) && !used.has(hi(x.item)));
      if (r) { picked.push(r); used.add(hi(r.item)); }
      if (picked.length === 7) break;
    }
    for (const r of rows) { if (picked.length >= 7) break; if (!used.has(hi(r.item)) && /РАМЕН|ҐЬОДЗА|БАО|РОЛИ|ЦУКЕМЕН/i.test(r.categoryTitle)) { picked.push(r); used.add(hi(r.item)); } }
    galleryRows = picked;
    $('#sig-total').textContent = String(picked.length).padStart(2, '0');
    $('#sig-track').innerHTML = picked.map((r, i) => `<button class="g-card" data-g="${i}" type="button" aria-label="${esc(r.item.name)} — ${esc(r.item.price)}">
      <span class="g-photo"><img src="${esc(hi(r.item))}" alt="${esc(r.item.name)}" loading="lazy" decoding="async"></span>
      <span class="g-no">${String(i + 1).padStart(2, '0')}</span>
      <span class="g-info"><small>${esc(r.categoryTitle.trim())}</small><strong>${esc(r.item.name)}</strong><span><em>${esc(r.item.price || '')}</em><i aria-hidden="true">→</i></span></span>
    </button>`).join('') + `<a class="g-card g-more" href="#menu"><span>Усе меню філії</span><b>${ui.rows().length}</b><small>позицій</small><i aria-hidden="true">↓</i></a>`;
    if (hasGsap) ST.refresh();
  }
  $('#sig-track').addEventListener('click', e => {
    const b = e.target.closest('[data-g]'); const r = b && galleryRows[+b.dataset.g];
    if (r) ui.openDish(r.si, r.ci, r.ii);
  });

  /* ---------- Bar ---------- */
  let barKind = 'alcohol', barRows = [], barSections = {};
  const isSoftRow = r => /^БАР Б\/А/.test(r.sectionTitle) || (/^БАР/.test(r.sectionTitle) && /Б\/А|ЛИМОНАД|НАПОЇ|ЧАЙ|TEA|КАВА|ФРЕШ/i.test(r.categoryTitle));
  function renderBar(animate = true) {
    const sections = ui.getVenue().sections;
    barSections = {alcohol: sections.findIndex(s => s.title.startsWith('БАР') && !s.title.startsWith('БАР Б/А')), soft: sections.findIndex(s => s.title.startsWith('БАР Б/А'))};
    if (barSections.soft < 0) barSections.soft = ui.rows().find(isSoftRow)?.si ?? -1;
    $$('[data-bar]').forEach(b => b.disabled = barSections[b.dataset.bar] < 0);
    if (barSections[barKind] < 0) barKind = barSections.soft >= 0 ? 'soft' : 'alcohol';
    const si = barSections[barKind];
    const rows = ui.rows().filter(r => r.si === si && r.item.image && isSoftRow(r) === (barKind === 'soft'));
    const pref = barKind === 'alcohol' ? rows.filter(r => /КОКТЕЙЛ|COCKTAIL|SIGNATURE/i.test(r.categoryTitle)) : rows.filter(r => /Лимонад|Хайбол|Матча|matcha/i.test(r.item.name));
    barRows = [...pref, ...rows.filter(r => !pref.includes(r))].slice(0, 3);
    $$('[data-bar]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.bar === barKind)));
    $('#bar-venue').textContent = ui.getVenue().name;
    $('#bar-menu').innerHTML = `${barSections.alcohol === barSections.soft ? 'Меню бару Torisho' : barKind === 'alcohol' ? 'Усе барне меню' : 'Усі безалкогольні напої'} <span>→</span>`;
    $('#bar-selection').innerHTML = barRows.map((r, i) => `<button class="bar-card" data-bar-dish="${i}" aria-label="${esc(r.item.name)} — ${esc(r.item.price)}"><span class="bar-photo"><img src="${esc(hi(r.item))}" alt="${esc(r.item.name)}" loading="lazy"><b>${barKind === 'alcohol' ? 'BAR / 18+' : 'БЕЗ АЛКОГОЛЮ'}</b></span><span class="bar-caption"><span>${esc(r.item.name)}</span><strong>${esc(r.item.price)}</strong></span></button>`).join('') || '<p>Добірку напоїв дивись у меню цієї філії.</p>';
    if (animate && hasGsap && !off()) G.from('.bar-card', {y: 60, opacity: 0, duration: .9, ease: 'expo.out', stagger: .08});
  }
  $$('[data-bar]').forEach(b => b.addEventListener('click', () => { barKind = b.dataset.bar; renderBar(); }));
  $('#bar-selection').addEventListener('click', e => { const b = e.target.closest('[data-bar-dish]'); const r = b && barRows[+b.dataset.barDish]; if (r) ui.openDish(r.si, r.ci, r.ii); });
  $('#bar-menu').addEventListener('click', () => { ui.selectSection(barSections[barKind]); $('#menu').scrollIntoView({behavior: off() ? 'instant' : 'smooth'}); });

  /* ---------- Pour ---------- */
  const pour = $('#pour'), hold = $('#pour-hold'), pstatus = $('#pour-status');
  let pourRow, fill = 0, holding = false, automatic = false, pf, prevT, pressedAt = 0, clickUntil = 0;
  const running = () => holding || automatic;
  function paint() {
    pour.style.setProperty('--fill', fill.toFixed(4)); pour.classList.toggle('pour-complete', fill >= 1);
    $('#pour-button-label').innerHTML = fill >= 1 ? 'Готово<br>✓' : running() ? 'Наливаємо…' : fill > 0 ? 'Продовжити<br>наливати' : 'Утримуй<br>і наливай';
  }
  function stopPour() { holding = false; automatic = false; cancelAnimationFrame(pf); prevT = undefined; pour.classList.remove('pouring'); pstatus.textContent = fill >= 1 ? 'Смачного!' : fill > 0 ? 'Продовжимо?' : 'Келих чекає'; paint(); }
  function tick(t) { if (!running() || document.hidden || pour.hidden) { stopPour(); return; } if (prevT !== undefined) fill = Math.min(1, fill + Math.max(0, t - prevT) / 2400); prevT = t; paint(); if (fill >= 1) { stopPour(); return; } pf = requestAnimationFrame(tick); }
  function beginPour(auto) { if (fill >= 1) { fill = 0; paint(); } if (off()) { fill = 1; paint(); stopPour(); return; } automatic = auto; holding = !auto; prevT = undefined; cancelAnimationFrame(pf); pour.classList.add('pouring'); pstatus.textContent = 'Наповнюємо…'; pf = requestAnimationFrame(tick); }
  hold.addEventListener('pointerdown', e => { if (e.button !== 0) return; pressedAt = performance.now(); clickUntil = pressedAt + 10000; hold.setPointerCapture(e.pointerId); beginPour(false); });
  hold.addEventListener('pointerup', e => { if (!pressedAt) return; const tap = performance.now() - pressedAt < 230; pressedAt = 0; clickUntil = performance.now() + 500; holding = false; if (tap && fill < 1 && !off()) automatic = true; else stopPour(); if (hold.hasPointerCapture(e.pointerId)) hold.releasePointerCapture(e.pointerId); });
  hold.addEventListener('pointercancel', () => { pressedAt = 0; stopPour(); });
  hold.addEventListener('click', () => { if (performance.now() < clickUntil) return; beginPour(true); });
  $('#pour-reset').addEventListener('click', () => { stopPour(); fill = 0; paint(); });
  $('#pour-dish').addEventListener('click', () => pourRow && ui.openDish(pourRow.si, pourRow.ci, pourRow.ii));
  function updatePour() {
    stopPour(); fill = 0; paint();
    pourRow = ui.rows().find(r => /Лимонад манго.?маракуйя/i.test(r.item.name));
    pour.hidden = !pourRow;
    if (pourRow) { $('#pour-caption').textContent = pourRow.item.name + ' · ' + pourRow.item.price; $('#pour-dish').textContent = 'Дивитися напій · ' + pourRow.item.price + ' →'; }
    if (hasGsap) ST.refresh();
  }

  /* ---------- Kyiv map ---------- */
  const SVGNS = 'http://www.w3.org/2000/svg';
  const box = {minLat: 50.37, maxLat: 50.53, minLng: 30.34, maxLng: 30.64};
  const proj = (lat, lng) => [40 + (lng - box.minLng) / (box.maxLng - box.minLng) * 520, 30 + (box.maxLat - lat) / (box.maxLat - box.minLat) * 500];
  const river = [[50.535, 30.515], [50.50, 30.53], [50.475, 30.545], [50.455, 30.565], [50.43, 30.575], [50.405, 30.575], [50.385, 30.59], [50.365, 30.6]];
  let mapBuilt = false;
  function drawMap() {
    const svg = $('#kyiv-map'); if (!svg) return;
    const list = window.MUSASHI_BRANCHES.list, current = ui.getVenue().key;
    if (!mapBuilt) {
      const pts = river.map(([a, b]) => proj(a, b));
      const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
      svg.innerHTML = `<defs><radialGradient id="mapGlow"><stop offset="0" stop-color="var(--accent)" stop-opacity=".35"/><stop offset="1" stop-color="var(--accent)" stop-opacity="0"/></radialGradient>
        <pattern id="grid" width="28" height="28" patternUnits="userSpaceOnUse"><path d="M28 0H0V28" fill="none" stroke="rgba(242,235,223,.05)"/></pattern></defs>
        <rect width="600" height="560" fill="url(#grid)"/>
        <path class="map-river" d="${d}"/><path class="map-river thin" d="${d}" transform="translate(14 4)"/>
        <text class="map-label" x="${proj(50.47, 30.585)[0]}" y="${proj(50.47, 30.585)[1]}">Дніпро</text>
        <text class="map-label" x="${proj(50.52, 30.36)[0]}" y="${proj(50.525, 30.36)[1]}">Правий берег</text>
        <text class="map-label" x="${proj(50.43, 30.6)[0]}" y="${proj(50.435, 30.6)[1]}">Лівий берег</text>
        <g id="map-links"></g><g id="map-pins"></g>`;
      mapBuilt = true;
    }
    const venues = window.MUSASHI.venues, cur = list[current];
    const [cx, cy] = cur ? proj(cur.lat, cur.lng) : [300, 280];
    svg.querySelector('#map-links').innerHTML = venues.filter(v => v.key !== current && list[v.key]).map(v => { const [x, y] = proj(list[v.key].lat, list[v.key].lng); return `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}"/>`; }).join('');
    svg.querySelector('#map-pins').innerHTML = venues.map((v, i) => {
      const b = list[v.key]; if (!b) return '';
      const [x, y] = proj(b.lat, b.lng), on = v.key === current, st = window.musashiOpenState(v.hours);
      return `<g class="pin${on ? ' is-on' : ''}${st.open ? ' is-open' : ''}" data-key="${esc(v.key)}" transform="translate(${x.toFixed(1)} ${y.toFixed(1)})" tabindex="0" role="button" aria-label="${esc(b.short + ' — ' + v.name)}">
        ${on ? '<circle r="46" fill="url(#mapGlow)"/>' : ''}<circle class="pin-hit" r="20" fill="transparent"/><circle class="pin-pulse" r="10"/><circle class="pin-dot" r="${on ? 8 : 5}"/>
        <text x="${b.left ? -12 : 12}" y="-10" class="pin-no" text-anchor="${b.left ? 'end' : 'start'}">${String(i + 1).padStart(2, '0')}</text><text x="${b.left ? -12 : 12}" y="6" class="pin-name" text-anchor="${b.left ? 'end' : 'start'}">${esc(b.short)}</text></g>`;
    }).join('');
    $$('.location-row').forEach((row, i) => row.classList.toggle('is-current', venues[i] && venues[i].key === current));
  }
  function goVenue(key) { const s = $('#venue-top'); s.value = key; s.dispatchEvent(new Event('change')); }
  $('#kyiv-map').addEventListener('click', e => { const p = e.target.closest('.pin'); if (p) goVenue(p.dataset.key); });
  $('#kyiv-map').addEventListener('keydown', e => { const p = e.target.closest('.pin'); if (p && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); goVenue(p.dataset.key); } });

  /* ---------- Steam canvas ---------- */
  const canvas = $('#steam'), ctx = canvas.getContext('2d');
  let parts = [], steamOn = false, sf;
  function sizeSteam() { const r = canvas.getBoundingClientRect(), d = Math.min(devicePixelRatio || 1, 2); canvas.width = r.width * d; canvas.height = r.height * d; ctx.setTransform(d, 0, 0, d, 0, 0); }
  function spawn(w, h) { return {x: w * (.32 + Math.random() * .36), y: h * .62, r: 14 + Math.random() * 26, vy: .35 + Math.random() * .55, vx: (Math.random() - .5) * .25, life: 0, max: 160 + Math.random() * 120, s: Math.random() * 6.28}; }
  function steamLoop() {
    if (!steamOn) return;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    ctx.clearRect(0, 0, w, h);
    if (parts.length < 38) parts.push(spawn(w, h));
    ctx.globalCompositeOperation = 'lighter';
    for (const p of parts) {
      p.life++; p.y -= p.vy; p.s += .02; p.x += p.vx + Math.sin(p.s) * .35; p.r += .18;
      const a = Math.sin(Math.PI * p.life / p.max) * .075;
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
      g.addColorStop(0, `rgba(255,246,230,${a})`); g.addColorStop(1, 'rgba(255,246,230,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.29); ctx.fill();
    }
    parts = parts.filter(p => p.life < p.max);
    sf = requestAnimationFrame(steamLoop);
  }
  function setSteam(v) { v = v && !off() && !document.hidden; if (v === steamOn) return; steamOn = v; cancelAnimationFrame(sf); if (v) { sizeSteam(); steamLoop(); } else ctx.clearRect(0, 0, canvas.width, canvas.height); }
  addEventListener('resize', () => steamOn && sizeSteam(), {passive: true});
  if ('IntersectionObserver' in window) new IntersectionObserver(en => setSteam(en[0].isIntersecting), {threshold: .05}).observe($('#cover'));

  /* ---------- Header, cursor, magnetic ---------- */
  const header = $('.site-header');
  addEventListener('scroll', () => header.classList.toggle('is-solid', scrollY > 40), {passive: true});
  const cursor = $('.cursor');
  if (fine.matches && hasGsap) {
    document.documentElement.classList.add('has-cursor');
    const xTo = G.quickTo(cursor, 'x', {duration: .35, ease: 'power3'}), yTo = G.quickTo(cursor, 'y', {duration: .35, ease: 'power3'});
    addEventListener('pointermove', e => { xTo(e.clientX); yTo(e.clientY); }, {passive: true});
    document.addEventListener('pointerover', e => {
      const t = e.target.closest('a,button,select,input,.pin,[data-g]');
      cursor.classList.toggle('is-link', !!t);
      cursor.classList.toggle('is-view', !!e.target.closest('.g-card,.dish-card,.stage-bowl,.bar-card'));
    });
    $$('.magnetic').forEach(el => {
      const mx = G.quickTo(el, 'x', {duration: .5, ease: 'elastic.out(1,.4)'}), my = G.quickTo(el, 'y', {duration: .5, ease: 'elastic.out(1,.4)'});
      el.addEventListener('pointermove', e => { if (off()) return; const r = el.getBoundingClientRect(); mx((e.clientX - r.left - r.width / 2) * .28); my((e.clientY - r.top - r.height / 2) * .38); });
      el.addEventListener('pointerleave', () => { mx(0); my(0); });
    });
  }

  /* ---------- Scroll choreography ---------- */
  const chef = $('#chef'), chapters = $$('.chapter'), kanji = ['一', '二', '三'];
  let chapterNow = -1;
  function setFrame(f) { f = Math.max(0, Math.min(7, f)); chef.style.backgroundPosition = `${(f % 4) * 33.333}% ${f < 4 ? 0 : 100}%`; }
  function setChapter(c) {
    if (c === chapterNow) return; chapterNow = c;
    chapters.forEach((li, i) => li.classList.toggle('is-on', i === c));
    $('#ritual-kanji').textContent = kanji[c];
    $('#story').dataset.step = String(c);
  }
  function buildScroll() {
    if (!hasGsap || off()) { setChapter(0); setFrame(0); return; }
    const mm = G.matchMedia();
    // Hero parallax on scroll
    G.to('.layer-torii', {yPercent: 12, scale: 1.08, ease: 'none', scrollTrigger: {trigger: '#cover', start: 'top top', end: 'bottom top', scrub: true}});
    G.to('.layer-ronin', {yPercent: -10, ease: 'none', scrollTrigger: {trigger: '#cover', start: 'top top', end: 'bottom top', scrub: true}});
    G.to('.stage-bowl', {yPercent: 18, rotate: 14, ease: 'none', scrollTrigger: {trigger: '#cover', start: 'top top', end: 'bottom top', scrub: true}});
    G.to('.stage-copy', {yPercent: -18, opacity: .2, ease: 'none', scrollTrigger: {trigger: '#cover', start: 'top top', end: 'bottom top', scrub: true}});
    // Ritual: chef driven by scroll
    const ritualUpdate = self => {
        const p = self.progress; $('#ritual-bar').style.transform = `scaleX(${p})`;
        setChapter(p < .3 ? 0 : p < .66 ? 1 : 2);
        setFrame(p < .66 ? Math.floor(p / .66 * 8) : 7);
        $('#story').style.setProperty('--serve', Math.max(0, Math.min(1, (p - .66) / .2)).toFixed(3));
      };
    mm.add('(min-width: 901px)', () => { const t = ST.create({trigger: '#story', start: 'top top', end: '+=220%', pin: '.ritual-pin', scrub: true, anticipatePin: 1, onUpdate: ritualUpdate}); return () => t.kill(); });
    mm.add('(max-width: 900px)', () => { const t = ST.create({trigger: '.ritual-art', start: 'top 75%', end: 'bottom 15%', scrub: true, onUpdate: ritualUpdate}); return () => t.kill(); });
    // Gallery: horizontal on wide screens, native swipe on phones
    mm.add('(min-width: 901px)', () => {
      const track = $('#sig-track');
      const dist = () => Math.max(0, track.scrollWidth - innerWidth + 80);
      const tw = G.to(track, {x: () => -dist(), ease: 'none', scrollTrigger: {trigger: '#signature', start: 'top top', end: () => '+=' + dist(), pin: '.gallery-pin', scrub: .6, invalidateOnRefresh: true,
        onUpdate: self => { const n = Math.min(galleryRows.length, 1 + Math.floor(self.progress * galleryRows.length)); $('#sig-index').textContent = String(n).padStart(2, '0'); }}});
      return () => tw.scrollTrigger && tw.scrollTrigger.kill();
    });
    // Headings & blocks
    $$('main h2:not(#hero-title)').forEach(h => G.from(h, {yPercent: 40, opacity: 0, duration: 1.2, ease: 'expo.out', scrollTrigger: {trigger: h, start: 'top 88%'}}));
    G.utils.toArray('.eyebrow, .section-lede, .menu-tools, .bar-copy > p, .finale-actions').forEach(el => G.from(el, {y: 30, opacity: 0, duration: 1, ease: 'power3.out', scrollTrigger: {trigger: el, start: 'top 92%'}}));
    ST.batch('.location-row', {start: 'top 92%', onEnter: els => G.from(els, {x: -40, opacity: 0, duration: .9, ease: 'expo.out', stagger: .06})});
    G.from('.kyiv-map', {clipPath: 'inset(0 0 100% 0)', duration: 1.6, ease: 'expo.inOut', scrollTrigger: {trigger: '.kyiv-map', start: 'top 80%'}});
    G.to('.footer-word', {backgroundPositionX: '100%', ease: 'none', scrollTrigger: {trigger: 'footer', start: 'top bottom', end: 'bottom bottom', scrub: true}});
    G.from('.finale-kanji', {scale: .6, opacity: 0, rotate: -12, duration: 2, ease: 'expo.out', scrollTrigger: {trigger: '.finale', start: 'top 70%'}});
  }

  /* Hero pointer depth */
  if (hasGsap && fine.matches) {
    const tx = G.quickTo('.layer-torii', 'x', {duration: 1.2, ease: 'power3'}), rx = G.quickTo('.layer-ronin', 'x', {duration: .9, ease: 'power3'}), bx = G.quickTo('.bowl-photo', 'x', {duration: .8, ease: 'power3'}), by = G.quickTo('.bowl-photo', 'y', {duration: .8, ease: 'power3'});
    $('#cover').addEventListener('pointermove', e => { if (off()) return; const x = e.clientX / innerWidth - .5, y = e.clientY / innerHeight - .5; tx(x * -18); rx(x * 34); bx(x * 16); by(y * 12); });
  }

  /* ---------- Intro ---------- */
  function heroIntro() {
    if (!hasGsap || off()) return;
    G.timeline({defaults: {ease: 'expo.out'}})
      .from('.layer-torii', {scale: 1.25, opacity: 0, duration: 2.2}, 0)
      .from('.layer-ronin', {xPercent: 18, opacity: 0, filter: 'blur(10px)', duration: 1.8}, .2)
      .from('.stage-copy .word', {yPercent: 115, duration: 1.4, stagger: .12}, .35)
      .from('.branch-badge, #hero-tagline, .stage-controls', {y: 30, opacity: 0, duration: 1.1, stagger: .08}, .6)
      .from('.stage-bowl', {scale: .55, rotate: -40, opacity: 0, duration: 1.8, ease: 'elastic.out(1,.7)'}, .5)
      .from('.bowl-ring', {rotate: -180, opacity: 0, duration: 2}, .7)
      .from('.site-header .brand, .site-header nav', {y: -30, opacity: 0, duration: 1, stagger: .06}, .4);
  }
  function preloader(done) {
    const el = $('#preloader');
    let seen = false; try { seen = sessionStorage.getItem('musashi-pre') === '1'; } catch {}
    if (seen || off() || !hasGsap || isEmbed) { el.remove(); done(); return; }
    try { sessionStorage.setItem('musashi-pre', '1'); } catch {}
    document.documentElement.classList.add('is-loading');
    const num = {v: 0};
    const tl = G.timeline({onComplete: () => { el.remove(); document.documentElement.classList.remove('is-loading'); }});
    tl.from('.seal-draw circle', {strokeDashoffset: 560, duration: 1.1, ease: 'power2.inOut', stagger: .1}, 0)
      .from('.pre-kanji', {opacity: 0, scale: 1.3, filter: 'blur(12px)', duration: 1, ease: 'expo.out'}, .15)
      .to(num, {v: 100, duration: 1.1, ease: 'power2.inOut', onUpdate: () => { $('#pre-num').textContent = String(Math.round(num.v)).padStart(2, '0'); }}, 0)
      .to('.seal-draw, .pre-kanji, .pre-count', {opacity: 0, scale: .92, duration: .35, ease: 'power2.in'}, 1.2)
      .to('.pre-curtain.a', {yPercent: -100, duration: 1, ease: 'expo.inOut'}, 1.3)
      .to('.pre-curtain.b', {yPercent: 100, duration: 1, ease: 'expo.inOut'}, 1.3)
      .add(done, 1.45);
    el.addEventListener('click', () => tl.progress(1), {once: true});
  }

  /* ---------- Wire up ---------- */
  document.addEventListener('musashi:venue', () => applyProfile(true));
  document.addEventListener('musashi:motion', () => {
    if (off()) { setSteam(false); if (hasGsap) { ST.getAll().forEach(t => t.kill(true)); G.set('main *, .stage *', {clearProps: 'transform,opacity,filter,clipPath'}); } setChapter(0); setFrame(0); }
    else location.reload();
  });
  document.addEventListener('visibilitychange', () => setSteam(!document.hidden && $('#cover').getBoundingClientRect().bottom > 0));
  applyProfile(false);
  preloader(() => { heroIntro(); setSteam(true); });
  buildScroll();
  addEventListener('load', () => hasGsap && ST.refresh());

  /* Live preview bridge for Network Studio */
  addEventListener('message', e => {
    const d = e.data || {}; if (d.type !== 'musashi:preview') return;
    const u = new URL(location.href);
    ['accent', 'dish', 'headline'].forEach(k => d[k] ? u.searchParams.set(k, d[k]) : u.searchParams.delete(k));
    history.replaceState(null, '', u);
    if (d.venue && d.venue !== ui.getVenue().key) goVenue(d.venue); else applyProfile(true);
  });
})();

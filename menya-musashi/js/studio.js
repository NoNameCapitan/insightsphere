/* Musashi Network Studio — configurator, fleet, QR, widget, contract. */
(() => {
  'use strict';
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const venues = window.MUSASHI.venues, B = window.MUSASHI_BRANCHES;
  const hi = i => i.largeImage || (window.MUSASHI_HIRES || {})[i.name] || i.image;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const G = window.gsap, ST = window.ScrollTrigger;
  if (G && ST) G.registerPlugin(ST);
  const prof = v => Object.assign({}, B.defaults, B.list[v.key] || {});
  const foodRows = v => v.sections.filter(s => s.title.startsWith('ОСНОВНЕ')).flatMap(s => s.categories.flatMap(c => c.items.filter(i => i.image).map(i => ({i, c: c.title}))));
  function heroOf(v) {
    const rows = foodRows(v);
    for (const p of prof(v).heroDish || []) { const re = new RegExp(p, 'i'); const r = rows.find(x => re.test(x.i.name)); if (r) return r.i; }
    return rows[0] && rows[0].i;
  }
  const siteUrl = (params) => { const u = new URL('index.html', location.href); Object.entries(params).forEach(([k, v]) => v && u.searchParams.set(k, v)); return u.href; };
  const toast = msg => { const t = $('#toast'); t.textContent = msg; t.classList.add('visible'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('visible'), 2000); };

  /* ---------- State ---------- */
  const SW = ['#ff6a00', '#e64a2e', '#f39a2b', '#ff8a3d', '#2fa58a', '#c9a96a', '#d8343f'];
  let st = {};
  function resetState(key) {
    const v = venues.find(x => x.key === key) || venues[0], p = prof(v), h = heroOf(v);
    st = {key: v.key, accent: p.accent, dish: h ? h.name : '', h1a: p.headline[0], h1b: p.headline[1], device: st.device || 'desktop'};
  }
  function overrides() {
    const v = venues.find(x => x.key === st.key), p = prof(v), h = heroOf(v);
    const o = {venue: p.slug || v.key};
    if (st.accent.toLowerCase() !== p.accent.toLowerCase()) o.accent = st.accent.slice(1);
    if (h && st.dish !== h.name) o.dish = st.dish;
    if (st.h1a !== p.headline[0] || st.h1b !== p.headline[1]) o.headline = st.h1a + '|' + st.h1b;
    return o;
  }

  /* ---------- Panel ---------- */
  function renderBranches() {
    $('#branch-list').innerHTML = venues.map((v, i) => {
      const p = prof(v), o = window.musashiOpenState(v.hours);
      return `<button type="button" role="radio" aria-checked="${v.key === st.key}" data-key="${esc(v.key)}" style="--c:${esc(p.accent)}"><i class="${o.open ? 'on' : ''}"></i><b>${String(i + 1).padStart(2, '0')}</b><span>${esc(p.short)}<small>${esc(p.district)}</small></span></button>`;
    }).join('');
  }
  function renderSwatches() {
    $('#swatches').innerHTML = SW.map(c => `<button type="button" role="radio" aria-checked="${c === st.accent.toLowerCase()}" data-c="${c}" style="--c:${c}" aria-label="Колір ${c}"></button>`).join('') + `<label class="custom" title="Свій колір"><input type="color" id="custom-color" value="${esc(st.accent)}" aria-label="Свій колір"><span>+</span></label>`;
  }
  function renderDishes() {
    const v = venues.find(x => x.key === st.key), seen = new Set();
    $('#dish-select').innerHTML = foodRows(v).filter(r => /РАМЕН|ҐЬОДЗА|БАО|ЦУКЕМЕН|РОЛИ|ЛОКШИНА|ОКОНОМ/i.test(r.c) && !seen.has(r.i.name) && seen.add(r.i.name)).map(r => `<option ${r.i.name === st.dish ? 'selected' : ''}>${esc(r.i.name)}</option>`).join('');
  }
  function syncInputs() { $('#h1a').value = st.h1a; $('#h1b').value = st.h1b; }
  function outputs() {
    const o = overrides(), link = siteUrl(o), v = venues.find(x => x.key === st.key), p = prof(v);
    $('#share-link').value = link;
    $('#url-pill').textContent = 'musashi.kyiv/' + (p.slug || v.key);
    $('#open-live').href = link;
    const cfg = {slug: p.slug, venueKey: v.key, name: v.name, district: p.district, accent: st.accent, headline: [st.h1a, st.h1b], heroDish: st.dish, tagline: p.tagline, hours: v.hours, orderUrl: v.url, coords: [p.lat, p.lng]};
    $('#json-out').textContent = JSON.stringify(cfg, null, 2);
    $('#qr').innerHTML = qrSvg(link, st.accent);
    document.documentElement.style.setProperty('--accent', st.accent);
  }
  function qrSvg(text, color) {
    if (!window.qrcode) return '';
    const q = window.qrcode(0, 'M'); q.addData(text); q.make();
    return q.createSvgTag({cellSize: 4, margin: 2, scalable: true}).replace(/fill="black"/g, `fill="#0d100f"`).replace('<svg ', '<svg role="img" aria-label="QR-код посилання на сайт філії" ');
  }
  let pt;
  function push(full) {
    renderSwatches(); outputs();
    clearTimeout(pt);
    pt = setTimeout(() => {
      const o = overrides();
      $('#preview').contentWindow?.postMessage({type: 'musashi:preview', venue: st.key, accent: o.accent || '', dish: o.dish || '', headline: o.headline || ''}, '*');
    }, full ? 0 : 160);
  }
  $('#branch-list').addEventListener('click', e => { const b = e.target.closest('[data-key]'); if (!b) return; resetState(b.dataset.key); renderBranches(); renderDishes(); syncInputs(); push(true); });
  $('#swatches').addEventListener('click', e => { const b = e.target.closest('[data-c]'); if (b) { st.accent = b.dataset.c; push(); } });
  $('#swatches').addEventListener('input', e => { if (e.target.id === 'custom-color') { st.accent = e.target.value; outputs(); push(); } });
  $('#dish-select').addEventListener('change', e => { st.dish = e.target.value; push(); });
  $('#h1a').addEventListener('input', e => { st.h1a = e.target.value; push(); });
  $('#h1b').addEventListener('input', e => { st.h1b = e.target.value; push(); });
  $('#reset').addEventListener('click', () => { resetState(st.key); renderDishes(); syncInputs(); push(true); toast('Профіль філії відновлено'); });

  /* ---------- Device frame scaling ---------- */
  const dims = {desktop: [1440, 900], mobile: [390, 844]};
  function fit() {
    const [w, h] = dims[st.device], wrap = $('#frame-wrap'), avail = wrap.clientWidth - 2;
    const scale = st.device === 'desktop' ? avail / w : Math.min(1, 560 / h, avail / w);
    const f = $('#preview'); f.style.width = w + 'px'; f.style.height = h + 'px';
    $('#frame-scale').style.cssText = `width:${w * scale}px;height:${h * scale}px`;
    f.style.transform = `scale(${scale})`;
    wrap.dataset.device = st.device;
  }
  $$('[data-device]').forEach(b => b.addEventListener('click', () => { st.device = b.dataset.device; $$('[data-device]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); fit(); }));
  addEventListener('resize', fit, {passive: true});
  $('#preview').addEventListener('load', () => push(true));

  /* ---------- Copy / download ---------- */
  document.addEventListener('click', async e => {
    const b = e.target.closest('[data-copy]'); if (!b) return;
    const el = $(b.dataset.copy), txt = el.value ?? el.textContent;
    try { await navigator.clipboard.writeText(txt); } catch { const t = document.createElement('textarea'); t.value = txt; document.body.append(t); t.select(); document.execCommand('copy'); t.remove(); }
    toast('Скопійовано');
  });
  const download = (name, text, type) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], {type})); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); };
  $('#json-download').addEventListener('click', () => download(`musashi-${prof(venues.find(x => x.key === st.key)).slug}.json`, $('#json-out').textContent, 'application/json'));
  $('#qr-download').addEventListener('click', () => download(`musashi-${prof(venues.find(x => x.key === st.key)).slug}-qr.svg`, $('#qr').innerHTML, 'image/svg+xml'));

  /* ---------- Hero wall & fleet ---------- */
  const heroes = venues.map(v => ({v, p: prof(v), h: heroOf(v)}));
  const wallImgs = [...new Set(venues.flatMap(v => foodRows(v).filter(r => !/TO GO|FROZEN|комбо|Бульйон|сет$/i.test(r.i.name + ' ' + r.c)).map(r => hi(r.i))).filter(s => /extra-|feature-/.test(s)))].slice(0, 18);
  $('#hero-wall').innerHTML = [0, 1, 2].map(c => `<div class="wall-col c${c}">${[...wallImgs.slice(c * 6, c * 6 + 6), ...wallImgs.slice(c * 6, c * 6 + 6)].map(s => `<img src="${esc(s)}" alt="" loading="lazy">`).join('')}</div>`).join('');
  $('#fleet-grid').innerHTML = heroes.map(({v, p, h}, i) => {
    const o = window.musashiOpenState(v.hours), link = siteUrl({venue: p.slug});
    return `<article class="fleet-card" style="--c:${esc(p.accent)}">
      <div class="fc-photo"><img src="${esc(h ? hi(h) : 'assets/ramen-cover.webp')}" alt="${esc(h ? h.name : '')}" loading="lazy"><span class="fc-kanji" lang="ja">${esc(p.kanji || '麺')}</span><span class="fc-no">${String(i + 1).padStart(2, '0')}</span></div>
      <div class="fc-body"><p class="fc-status ${o.open ? 'on' : ''}"><i></i>${esc(o.text)}</p><h3>${esc(p.short)}</h3><p class="fc-addr">${esc(v.name)} · ${esc(p.district)}</p><p class="fc-dish">${esc(h ? h.name : '')}</p>
      <div class="fc-actions"><a class="chip" href="${esc(link)}" target="_blank" rel="noopener">Сайт філії ↗</a><button class="chip ghost" type="button" data-tune="${esc(v.key)}">Налаштувати</button></div><code>musashi.kyiv/${esc(p.slug)}</code></div>
      <div class="fc-qr" aria-hidden="true">${qrSvg(link, p.accent)}</div>
    </article>`;
  }).join('');
  $('#fleet-grid').addEventListener('click', e => { const b = e.target.closest('[data-tune]'); if (!b) return; resetState(b.dataset.tune); renderBranches(); renderDishes(); syncInputs(); push(true); $('#studio').scrollIntoView({behavior: reduced ? 'auto' : 'smooth'}); });

  /* ---------- Contract & widget ---------- */
  const v0 = venues.find(x => x.key === 'torisho') || venues[0];
  $('#contract').textContent = JSON.stringify({branch: {slug: 'torisho', name: v0.name, hours: v0.hours, orderUrl: v0.url, accent: '#e64a2e'}, menu: [{section: 'Кухня', category: 'Рамен', name: 'Рамен з рваною телятиною', price: 359, photo: 'https://…/ramen.webp', options: [{title: 'розмір', items: [['L - 400 г', 359], ['XL - 700 г', 459]]}], available: true}], updatedAt: '2026-11-06T12:00:00+02:00'}, null, 2);
  const widgetBase = new URL('.', location.href).href;
  function widgetCode(key) { return `<div data-musashi-widget data-venue="${key}"></div>\n<script src="${widgetBase}js/embed.js" async></script>`; }
  $('#widget-code').textContent = widgetCode('podil');
  $('#widget-venues').innerHTML = heroes.map(({v, p}) => `<button class="chip ${v.key === '19' ? 'is-on' : ''}" type="button" data-w="${esc(p.slug)}">${esc(p.short)}</button>`).join('');
  $('#widget-venues').addEventListener('click', e => {
    const b = e.target.closest('[data-w]'); if (!b) return;
    $$('#widget-venues .chip').forEach(x => x.classList.toggle('is-on', x === b));
    const el = $('#widget-live'); el.setAttribute('data-venue', b.dataset.w); window.MusashiWidget.render(el);
    $('#widget-code').textContent = widgetCode(b.dataset.w);
  });

  /* ---------- Motion ---------- */
  const header = $('.site-header');
  addEventListener('scroll', () => header.classList.toggle('is-solid', scrollY > 40), {passive: true});
  if (G && ST && !reduced) {
    G.from('.s-hero h1 .ln > *', {yPercent: 110, duration: 1.4, ease: 'expo.out', stagger: .12, delay: .1});
    G.from('.s-lede, .s-kpis > div, .s-hero .eyebrow', {y: 30, opacity: 0, duration: 1, ease: 'power3.out', stagger: .07, delay: .4});
    G.from('.s-hero-wall', {opacity: 0, scale: 1.08, duration: 2, ease: 'expo.out'});
    $$('[data-count]').forEach(el => { const n = {v: 0}, end = +el.dataset.count; G.to(n, {v: end, duration: 2, ease: 'power3.out', delay: .6, onUpdate: () => { el.textContent = Math.round(n.v).toLocaleString('uk-UA'); }}); });
    $$('main section h2').forEach(h => G.from(h, {yPercent: 40, opacity: 0, duration: 1.2, ease: 'expo.out', scrollTrigger: {trigger: h, start: 'top 88%'}}));
    ST.batch('.fleet-card', {start: 'top 90%', onEnter: els => G.from(els, {y: 60, opacity: 0, duration: 1, ease: 'expo.out', stagger: .08})});
    G.from('.arch-diagram', {clipPath: 'inset(0 100% 0 0)', duration: 1.8, ease: 'expo.inOut', scrollTrigger: {trigger: '.arch-diagram', start: 'top 80%'}});
    ST.batch('.arch-cards article, .timeline li', {start: 'top 90%', onEnter: els => G.from(els, {y: 40, opacity: 0, duration: .9, ease: 'power3.out', stagger: .1})});
  } else document.documentElement.classList.add('no-anim');

  /* ---------- Init ---------- */
  resetState(new URLSearchParams(location.search).get('venue') || '19');
  renderBranches(); renderDishes(); syncInputs(); outputs(); fit();
})();

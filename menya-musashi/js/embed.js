/* Menya Musashi embeddable branch widget.
   Usage on any page (partner site, Google Business, hotel concierge, etc.):
   <div data-musashi-widget data-venue="torisho"></div>
   <script src="https://YOUR-DOMAIN/js/embed.js" async></script>
   Renders inside Shadow DOM, so host styles never leak in or out. */
(function () {
  'use strict';
  var me = document.currentScript || [].slice.call(document.scripts).filter(function (s) { return /embed\.js/.test(s.src); }).pop();
  var base = me ? me.src.replace(/js\/embed\.js.*$/, '') : '';
  function load(src, cb) { var s = document.createElement('script'); s.src = src; s.onload = cb; document.head.appendChild(s); }
  function ready(cb) {
    var need = [];
    if (!window.MUSASHI) need.push('js/data.js');
    if (!window.MUSASHI_HIRES) need.push('js/hires.js');
    if (!window.MUSASHI_BRANCHES) need.push('js/branches.js');
    (function next() { if (!need.length) return cb(); load(base + need.shift(), next); })();
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]; }); }
  var css = ':host{all:initial;display:block;font-family:Golos,"Helvetica Neue",Arial,sans-serif;color:#f2ebdf}' +
    '.w{position:relative;overflow:hidden;border-radius:22px;background:#131716;border:1px solid rgba(242,235,223,.14);max-width:440px;box-shadow:0 30px 60px rgba(0,0,0,.35)}' +
    '.top{display:flex;align-items:center;gap:12px;padding:16px 18px;border-bottom:1px solid rgba(242,235,223,.1)}' +
    '.top img{width:38px;height:38px;border-radius:50%}' +
    '.top b{display:block;font:600 18px/1.1 Georgia,serif;letter-spacing:.06em}.top small{font-size:11px;color:#9c9a90}' +
    '.st{margin-left:auto;font-size:11px;padding:5px 10px;border-radius:99px;border:1px solid rgba(242,235,223,.18);white-space:nowrap}.st.o{color:#4ade80;border-color:rgba(74,222,128,.4)}.st.c{color:#f87171}' +
    '.list{display:grid;gap:10px;padding:14px}' +
    '.d{display:grid;grid-template-columns:64px 1fr auto;gap:12px;align-items:center;text-decoration:none;color:inherit;padding:6px;border-radius:14px;transition:background .3s}' +
    '.d:hover{background:rgba(242,235,223,.06)}.d img{width:64px;height:52px;border-radius:10px;object-fit:cover}' +
    '.d span{font:600 16px/1.15 Georgia,serif}.d em{font-style:normal;font-size:13px;color:var(--a)}' +
    '.go{display:flex;justify-content:space-between;align-items:center;margin:4px 14px 14px;padding:14px 18px;border-radius:99px;background:var(--a);color:#140b04;text-decoration:none;font-weight:600;font-size:14px}' +
    '.f{font-size:10px;color:#777a72;padding:0 18px 14px}';
  function render(host) {
    var key = host.getAttribute('data-venue') || '19', list = window.MUSASHI_BRANCHES.list;
    var k = Object.keys(list).filter(function (x) { return x === key || list[x].slug === key; })[0] || '19';
    var v = window.MUSASHI.venues.filter(function (x) { return x.key === k; })[0] || window.MUSASHI.venues[0];
    var b = list[v.key] || {}, accent = host.getAttribute('data-accent') || b.accent || '#ff6a00';
    var rows = [];
    v.sections.forEach(function (s) { if (/^ОСНОВНЕ/.test(s.title)) s.categories.forEach(function (c) { c.items.forEach(function (i) { if (i.image && /РАМЕН|ҐЬОДЗА|БАО|ЦУКЕМЕН/i.test(c.title)) rows.push(i); }); }); });
    var seen = {}, picks = rows.filter(function (i) { var im = (window.MUSASHI_HIRES || {})[i.name] || i.image; if (seen[im]) return false; seen[im] = 1; return true; }).slice(0, +(host.getAttribute('data-count') || 3));
    var st = window.musashiOpenState(v.hours);
    var root = host.shadowRoot || host.attachShadow({mode: 'open'});
    root.innerHTML = '<style>' + css + '</style><div class="w" style="--a:' + esc(accent) + '"><div class="top"><img src="' + base + 'assets/logo.png" alt=""><div><b>MUSASHI</b><small>' + esc((b.short || '') + ' · ' + v.name) + '</small></div><span class="st ' + (st.open ? 'o' : 'c') + '">' + esc(st.text) + '</span></div><div class="list">' +
      picks.map(function (i) { return '<a class="d" target="_blank" rel="noopener" href="' + esc(v.url + '/' + (i.url || '')) + '"><img src="' + base + esc((window.MUSASHI_HIRES || {})[i.name] || i.image) + '" alt=""><span>' + esc(i.name) + '</span><em>' + esc(i.price) + '</em></a>'; }).join('') +
      '</div><a class="go" target="_blank" rel="noopener" href="' + esc(v.url) + '">Замовити у філії <span>↗</span></a><div class="f">Неофіційна концепція · ціни зі знімка меню 06.11.2026</div></div>';
  }
  function boot() { ready(function () { [].forEach.call(document.querySelectorAll('[data-musashi-widget]'), render); }); }
  window.MusashiWidget = {render: function (el) { ready(function () { render(el); }); }};
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();

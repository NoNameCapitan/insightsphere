/* Branch network config — one codebase, a personal edition per location.
   Each key matches a venue key in data.js. Everything here can be overridden
   per link: ?venue=torisho&accent=e64a2e&dish=Бао&headline=Вечір%20у%20Torisho */
window.MUSASHI_BRANCHES = {
  defaults: {
    accent: '#ff6a00',
    headline: ['Смак', 'з характером.'],
    heroDish: ['^Рамен з рваною телятиною', '^Рамен креветковий', '^Рамен', '^Ґьодза'],
    tagline: 'Японський рамен-хаус · Київ'
  },
  list: {
    '19':      {slug: 'podil',      short: 'Поділ',        district: 'Поділ',           lat: 50.4669, lng: 30.5128, accent: '#ff6a00', tagline: 'Рамен-хаус на Подолі',            heroDish: ['^Рамен з рваною телятиною'], kanji: '麺'},
    '3':       {slug: 'lypky',      short: 'Лютеранська',  district: 'Центр · Липки',   lat: 50.4442, lng: 30.5262, accent: '#f39a2b', tagline: 'У серці Липок',                   heroDish: ['^Рамен креветковий'], kanji: '味'},
    'torisho': {slug: 'torisho',    short: 'Torisho',      district: 'Руставелі',       lat: 50.4382, lng: 30.5168, accent: '#e64a2e', tagline: 'Ramen Shop & Izakaya Bar',        heroDish: ['^Місо рамен', '^Рамен з рваною телятиною'], kanji: '鳥', headline: ['Рамен', 'та ізакая.'], torisho: true, left: true},
    '100':     {slug: 'holosiiv',   short: 'Васильківська',district: 'Голосіїв',        lat: 50.3832, lng: 30.4744, accent: '#ff7a33', tagline: 'Рамен-хаус у Голосієві',          heroDish: ['^Цукемен', '^Рамен з рваною телятиною'], kanji: '火'},
    '1-e':     {slug: 'bazhana',    short: 'Бажана',       district: 'Лівий берег',     lat: 50.4012, lng: 30.6106, accent: '#ff6a00', tagline: 'Рамен на лівому березі',          heroDish: ['^Рамен креветковий'], kanji: '海'},
    '1b':      {slug: 'obolon',     short: 'Dream Town',   district: 'Оболонь',         lat: 50.5106, lng: 30.4985, accent: '#2fa58a', tagline: 'Рамен у Dream Town',              heroDish: ['^Ґьодза з куркою', '^Рамен'], kanji: '川'},
    '6d':      {slug: 'lavina',     short: 'Lavina Mall',  district: 'Берковець',       lat: 50.4932, lng: 30.3611, accent: '#ff8a3d', tagline: 'Рамен у Lavina Mall',             heroDish: ['^Рамен з рваною телятиною'], kanji: '道'},
    '47':      {slug: 'vynohradar', short: 'Європ. Союзу', district: 'Виноградар',      lat: 50.5152, lng: 30.4226, accent: '#ff6a00', tagline: 'Рамен-хаус на Виноградарі',       heroDish: ['^Бао', '^Рамен креветковий'], kanji: '包'},
    '26':      {slug: 'beresteiskyi', short: 'Берестейський', district: 'Шулявка',      lat: 50.4523, lng: 30.4652, accent: '#f0642a', tagline: 'Рамен на Берестейському',         heroDish: ['^Рамен креветковий'], kanji: '武', left: true}
  }
};

/* Resolve the effective branch profile for a venue key + URL overrides. */
window.musashiProfile = function (venue) {
  const cfg = window.MUSASHI_BRANCHES, b = Object.assign({}, cfg.defaults, cfg.list[venue.key] || {});
  const q = new URLSearchParams(location.search);
  const hex = (q.get('accent') || '').replace(/[^0-9a-f]/gi, '');
  if (hex.length === 6 || hex.length === 3) b.accent = '#' + hex;
  if (q.get('headline')) { const h = q.get('headline').slice(0, 60).split('|'); b.headline = [h[0], h[1] || '']; }
  if (q.get('dish')) b.heroDish = ['^' + q.get('dish').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')].concat(b.heroDish || []);
  b.venue = venue;
  return b;
};

/* Live open/closed status in Kyiv time from "HH:MM–HH:MM". */
window.musashiOpenState = function (hours) {
  const m = /(\d{1,2}):(\d{2})\D+(\d{1,2}):(\d{2})/.exec(hours || '');
  if (!m) return {open: null, text: hours || ''};
  const parts = new Intl.DateTimeFormat('en-GB', {timeZone: 'Europe/Kyiv', hour: '2-digit', minute: '2-digit', hour12: false}).formatToParts(new Date());
  const now = (+parts.find(p => p.type === 'hour').value % 24) * 60 + +parts.find(p => p.type === 'minute').value;
  const a = +m[1] * 60 + +m[2], z = +m[3] * 60 + +m[4];
  const open = now >= a && now < z;
  const left = open ? z - now : (now < a ? a - now : 24 * 60 - now + a);
  const fmt = n => n >= 60 ? `${Math.floor(n / 60)} год ${n % 60 ? (n % 60) + ' хв' : ''}`.trim() : `${n} хв`;
  return {open, text: open ? `Відкрито · до ${m[3]}:${m[4]}` : `Зачинено · відкриється о ${m[1]}:${m[2]}`, soon: open && left <= 60 ? `Кухня ще ${fmt(left)}` : ''};
};

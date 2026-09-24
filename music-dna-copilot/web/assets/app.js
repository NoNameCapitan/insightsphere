// Music DNA Copilot 3.0 — web app (vanilla ES modules, no build step, no dependencies)
//
// Product loop: connect → unified DNA → intent → capsule → listen → react → DNA learns.
// Every number on screen comes from /api/v3; missing data renders as an empty state.

/* ------------------------------------------------------------------ utils */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const n = (v) => (v == null ? "—" : Number(v).toLocaleString());
const pct = (v) => (v == null ? "—" : `${Math.round(v * 100)}%`);
const cap1 = (s) => String(s || "").charAt(0).toUpperCase() + String(s || "").slice(1);
function ago(iso) {
  if (!iso) return "never";
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  if (s < 86400 * 30) return `${Math.round(s / 86400)} days ago`;
  return new Date(iso).toLocaleDateString();
}
const date = (iso) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—");

/* ------------------------------------------------------------------ icons */
const P = {
  home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 9.5V20h13V9.5"/>',
  dna: '<circle cx="12" cy="12" r="2.5"/><circle cx="12" cy="12" r="6.5" opacity=".7"/><circle cx="12" cy="12" r="10" stroke-dasharray="2 3" opacity=".6"/><circle cx="18.5" cy="7" r="1.4"/>',
  capsule: '<rect x="4" y="3.5" width="16" height="17" rx="8"/><path d="M4 12h16"/><circle cx="12" cy="8" r="1.2"/>',
  history: '<path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v4h4"/><path d="M12 8v4.5l3 2"/>',
  sources: '<ellipse cx="12" cy="6" rx="7.5" ry="2.8"/><path d="M4.5 6v6c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8V6"/><path d="M4.5 12v6c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8v-6"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6"/>',
  check: '<path d="M5 12.5l4.2 4L19 7"/>',
  love: '<path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.4a4.3 4.3 0 0 1 7.5 2.4C19.5 15.4 12 20 12 20z"/>',
  save: '<path d="M6 3.5h12v17l-6-4-6 4z"/>',
  replay: '<path d="M4 12a8 8 0 1 0 2.3-5.6"/><path d="M4 4.5v4h4"/>',
  skip: '<path d="M5 5l9 7-9 7z"/><path d="M18 5v14"/>',
  no: '<circle cx="12" cy="12" r="8.5"/><path d="M6 6l12 12"/>',
  listened: '<path d="M4 13a8 8 0 0 1 16 0"/><rect x="3" y="13" width="4" height="7" rx="1.5"/><rect x="17" y="13" width="4" height="7" rx="1.5"/>',
  external: '<path d="M14 4h6v6"/><path d="M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>',
  focus: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>',
  energy: '<path d="M13 2.5 5 13.5h6l-1 8 8-11h-6z"/>',
  chill: '<path d="M4 15c3-4 6-4 8 0s5 4 8 0"/><path d="M4 10c3-4 6-4 8 0s5 4 8 0" opacity=".6"/>',
  night_drive: '<path d="M19 14.5A7.5 7.5 0 1 1 9.5 5a6 6 0 0 0 9.5 9.5z"/>',
  workout: '<path d="M3 12h3M18 12h3M6 8v8M18 8v8M9 10v4M15 10v4M9 12h6"/>',
  deep_listen: '<path d="M4 14a8 8 0 0 1 16 0"/><path d="M8 14a4 4 0 0 1 8 0"/><circle cx="12" cy="14" r="1"/>',
  discover: '<circle cx="12" cy="12" r="8.5"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
  surprise: '<path d="M12 3l2.2 5.8L20 11l-5.8 2.2L12 19l-2.2-5.8L4 11l5.8-2.2z"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  up: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  down: '<path d="M12 5v14M6 13l6 6 6-6"/>',
  sync: '<path d="M20 11a8 8 0 0 0-14.3-4.3L4 8.5"/><path d="M4 4.5v4h4"/><path d="M4 13a8 8 0 0 0 14.3 4.3L20 15.5"/><path d="M20 19.5v-4h-4"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/>',
  empty: '<rect x="3.5" y="5" width="17" height="14" rx="3"/><path d="M3.5 13h5l1.5 2h4l1.5-2h5"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
};
const icon = (name, cls = "") => `<svg class="i ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ""}</svg>`;

/* ------------------------------------------------------------------ API */
class ApiError extends Error {
  constructor(err, status) { super(err?.message || "Request failed"); this.err = err || {}; this.status = status; }
}
async function api(path, { method = "GET", body, form } = {}) {
  const headers = { "X-MusicDNA-Client": "3" };
  let payload;
  if (form) payload = form;
  else if (body !== undefined) { headers["Content-Type"] = "application/json"; payload = JSON.stringify(body); }
  let res;
  try {
    res = await fetch(`/api/v3/${path}`, { method, headers, body: payload });
  } catch (e) {
    throw new ApiError({ code: "OFFLINE", title: "Can't reach the app", message: "The local Music DNA server isn't responding. Is it still running?" }, 0);
  }
  let data = {};
  try { data = await res.json(); } catch { /* non-JSON */ }
  if (!res.ok || data.ok === false) throw new ApiError(data.error || { code: "INTERNAL", title: "Something went wrong", message: `The app answered with status ${res.status}.` }, res.status);
  return data;
}
async function streamBuild(body, onLine) {
  const res = await fetch("/api/v3/dna/build", {
    method: "POST", headers: { "X-MusicDNA-Client": "3", "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  if (!res.ok) {
    let data = {}; try { data = await res.json(); } catch { /* */ }
    throw new ApiError(data.error, res.status);
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
      if (line) onLine(JSON.parse(line));
    }
  }
  if (buf.trim()) onLine(JSON.parse(buf));
}

/* ------------------------------------------------------------------ app state */
const S = { state: null, settings: {}, vizModule: null, capsule: null, expanded: new Set(), revealing: new Set(), tier: "common", intent: null, custom: "" };
async function refresh() {
  const st = await api("state");
  S.state = st; S.settings = st.settings || {};
  applyMotion();
  return st;
}
function applyMotion() {
  const m = S.settings.motion || "system";
  if (m === "system") document.documentElement.removeAttribute("data-motion");
  else document.documentElement.dataset.motion = m;
}
const advanced = () => !!S.settings.advanced_mode;
// Each render creates a fresh .page element; views bind listeners to it so
// handlers never accumulate across navigations.
const root = () => $("#main > .page");
async function viz() {
  if (!S.vizModule) S.vizModule = await import("./dna-viz.js");
  return S.vizModule;
}

/* ------------------------------------------------------------------ feedback UI */
function toast(msg, kind = "") {
  const el = document.createElement("div");
  el.className = `toast ${kind}`;
  el.textContent = msg;
  $("#toasts").append(el);
  setTimeout(() => el.remove(), kind === "error" ? 7000 : 4200);
}
function errorBlock(e, extra = "") {
  const err = e instanceof ApiError ? e.err : { title: "Something went wrong", message: String(e?.message || e) };
  return `<div class="notice error" role="alert"><div><b>${esc(err.title || "Something went wrong")}</b><p>${esc(err.message || "")}</p>
    ${advanced() && err.detail ? `<div class="detail">${esc(err.code || "")}: ${esc(err.detail)}</div>` : ""}${extra}</div></div>`;
}
function showError(e) {
  const err = e instanceof ApiError ? e.err : { title: "Something went wrong", message: String(e?.message || e) };
  toast(`${err.title}${err.message ? ` — ${err.message}` : ""}`, "error");
}
function confirmDialog(title, text, okLabel = "Confirm") {
  const d = $("#confirm");
  $("#confirm-title").textContent = title;
  $("#confirm-text").textContent = text;
  $("#confirm-ok").textContent = okLabel;
  d.returnValue = "cancel";
  d.showModal();
  return new Promise((resolve) => d.addEventListener("close", () => resolve(d.returnValue === "ok"), { once: true }));
}
function empty(iconName, title, text, action = "") {
  return `<div class="empty">${icon(iconName, "ic")}<h2>${esc(title)}</h2><p>${esc(text)}</p>${action}</div>`;
}

/* ------------------------------------------------------------------ navigation */
const NAV = [
  ["home", "#/", "Home"], ["dna", "#/dna", "DNA"], ["capsule", "#/capsules", "Capsules"],
  ["history", "#/history", "History"], ["sources", "#/sources", "Sources"], ["settings", "#/settings", "Settings"],
];
function renderNav(active) {
  const item = ([ic, href, label], i) => `<a href="${href}" ${active === href ? 'aria-current="page"' : ""}>${icon(ic)}<span>${label}</span></a>`;
  $("#nav").innerHTML = NAV.map(item).join("");
  $("#bottom-nav").innerHTML = NAV.slice(0, 5).map(item).join("");
  $("#topbar-settings").innerHTML = icon("settings");
  $("#topbar-settings").toggleAttribute("aria-current", active === "#/settings");
}

const ROUTES = [
  [/^\/?$/, viewHome, "#/"],
  [/^\/welcome(?:\/(\w+))?$/, viewWelcome, null],
  [/^\/dna$/, viewDNA, "#/dna"],
  [/^\/capsules$/, viewCapsules, "#/capsules"],
  [/^\/capsule\/([\w-]+)$/, viewCapsule, "#/capsules"],
  [/^\/history$/, viewHistory, "#/history"],
  [/^\/sources$/, viewSources, "#/sources"],
  [/^\/settings$/, viewSettings, "#/settings"],
  [/^\/settings\/privacy$/, viewPrivacy, "#/settings"],
  [/^\/settings\/advanced(?:\/(\w+))?$/, viewAdvanced, "#/settings"],
];
let renderToken = 0;
async function route() {
  const token = ++renderToken;
  const [path, qs] = (location.hash.slice(1) || "/").split("?");
  const params = new URLSearchParams(qs || "");
  const main = $("#main");
  let match = null, fn = viewNotFound, active = null;
  for (const [re, f, a] of ROUTES) { const m = path.match(re); if (m) { match = m; fn = f; active = a; break; } }
  renderNav(active);
  document.body.classList.toggle("is-onboarding", fn === viewWelcome);
  try {
    if (!S.state) await refresh();
    if (fn !== viewWelcome && !S.state.onboarding_completed && !S.state.has_dna && path !== "/settings" && !path.startsWith("/settings/")) {
      location.replace("#/welcome");
      return;
    }
    const html = await fn(match, params);
    if (token !== renderToken) return;
    if (typeof html === "string") {
      main.innerHTML = `<div class="page">${html}</div>`;
    }
    const h1 = $("h1", main);
    document.title = h1 ? `${h1.textContent.trim()} · Music DNA` : "Music DNA";
    if (fn.after) await fn.after(match, params);
    if (!route.first) main.focus({ preventScroll: true });
    route.first = false;
    window.scrollTo({ top: 0 });
  } catch (e) {
    if (token !== renderToken) return;
    main.innerHTML = `<div class="page"><h1>Something went wrong</h1><div class="stack">${errorBlock(e)}<a class="btn" href="#/">Back home</a></div></div>`;
  }
}
route.first = true;

/* ------------------------------------------------------------------ shared blocks */
function demoNotice() {
  if (!S.state?.dna?.demo) return "";
  return `<div class="notice demo"><span class="badge demo">Demo</span><div><b>You're exploring demo data</b>
    <p>This DNA comes from a built-in sample library, not your listening. <a href="#/sources">Connect a real source</a> to replace it.</p></div></div>`;
}
function statLine(dna) {
  const s = dna.stats;
  const span = s.history_span?.text;
  return `<div class="signal-line">
    <span><b>${n(s.raw_events)}</b> listening events</span>
    <span><b>${n(s.unique_tracks)}</b> unique tracks</span>
    <span><b>${n(s.artists)}</b> artists</span>
    <span><b>${s.source_count}</b> source${s.source_count === 1 ? "" : "s"}</span>
    ${span ? `<span><b>${esc(span)}</b> of history</span>` : ""}
  </div>`;
}
function coreNow(dna, session) {
  const core = (dna.top_genres || (dna.genres || []).map((g) => g.name)).slice(0, 5);
  const s = session || {};
  const now = s.events
    ? `<div class="chips">${(s.rising || []).map((g) => `<span class="chip up">↑ ${esc(g)}</span>`).join("")}${(s.cooling || []).map((g) => `<span class="chip down">↓ ${esc(g)}</span>`).join("")}${!(s.rising || []).length && !(s.cooling || []).length ? '<span class="chip dim">Mixed reactions so far</span>' : ""}</div>
       <p class="faint">From ${s.events} reaction${s.events === 1 ? "" : "s"} in the last ${s.window_hours} hours${s.intent ? ` · mostly ${esc(cap1(s.intent.replace("_", " ")))}` : ""}.</p>`
    : `<p class="faint">Nothing yet this session. React to a few tracks and this updates right away.</p>`;
  return `<div class="core-now">
    <div><h3>${icon("dna")} Your core DNA</h3><p>Long-term preferences built from ${n(dna.stats?.raw_events)} listening events. Changes slowly.</p>
      <div class="chips">${core.map((g) => `<span class="chip">${esc(g)}</span>`).join("")}</div></div>
    <div class="now"><h3>${icon("energy")} Right now</h3><p>Short-term session taste. Nudges the next capsule, fades within hours, never rewrites your core.</p>${now}</div>
  </div>`;
}
function tierPicker() {
  const tiers = S.state.tiers;
  return `<div class="tier-picker" role="radiogroup" aria-label="Capsule type">${Object.entries(tiers).map(([k, t]) =>
    `<button type="button" class="tier-opt" role="radio" data-tier="${k}" aria-checked="${S.tier === k}" data-act="tier" data-value="${k}">
      <span class="row"><span class="tier-dot"></span><b>${esc(t.label)}</b><span class="faint mono">${k === "mystery" ? `${t.size} · hidden` : `${t.size} tracks`}</span></span>
      <small>${esc(t.tagline)}</small></button>`).join("")}</div>`;
}
function intentGrid() {
  return `<div class="intent-grid" role="group" aria-label="What do you need right now?">${Object.entries(S.state.intents).map(([k, label]) =>
    `<button type="button" class="intent" data-act="intent" data-value="${k}" aria-pressed="${S.intent === k}">${icon(k)}<b>${esc(label)}</b></button>`).join("")}</div>
    <form class="custom-intent" data-form="custom"><label class="sr-only" for="custom-intent">Or describe your own moment</label>
      <input class="input" id="custom-intent" name="custom" maxlength="80" placeholder="Or describe it: “rainy sunday reading”" value="${esc(S.custom)}"></form>`;
}
function bindPicker(root) {
  root.addEventListener("click", (ev) => {
    const b = ev.target.closest("[data-act]");
    if (!b) return;
    if (b.dataset.act === "tier") {
      S.tier = b.dataset.value;
      $$(".tier-opt", root).forEach((x) => x.setAttribute("aria-checked", String(x.dataset.value === S.tier)));
    } else if (b.dataset.act === "intent") {
      S.intent = S.intent === b.dataset.value ? null : b.dataset.value;
      S.custom = "";
      const ci = $("#custom-intent", root); if (ci) ci.value = "";
      $$(".intent", root).forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.value === S.intent)));
    } else if (b.dataset.act === "open-capsule") {
      openCapsule(b);
    }
  });
  const ci = $("#custom-intent", root);
  if (ci) {
    ci.addEventListener("input", () => {
      S.custom = ci.value;
      if (S.custom) { S.intent = null; $$(".intent", root).forEach((x) => x.setAttribute("aria-pressed", "false")); }
    });
    $('[data-form="custom"]', root).addEventListener("submit", (ev) => { ev.preventDefault(); openCapsule($('[data-act="open-capsule"]', root)); });
  }
}
async function openCapsule(btn) {
  if (btn) { btn.disabled = true; btn.innerHTML = `<span class="pulse-dot" aria-hidden="true"></span> Opening…`; }
  try {
    const body = { tier: S.tier, intent: S.intent || "surprise" };
    if (S.custom.trim()) body.custom_intent = S.custom.trim();
    const { capsule } = await api("capsules", { method: "POST", body });
    S.capsule = capsule; S.expanded = new Set(); S.justOpened = true;
    await refresh();
    location.hash = `#/capsule/${capsule.capsule_id}`;
  } catch (e) {
    showError(e);
    if (btn) { btn.disabled = false; btn.textContent = "Open capsule"; }
  }
}

/* ------------------------------------------------------------------ onboarding */
async function viewWelcome(m) {
  const step = (m && m[1]) || "start";
  const dots = (i) => `<div class="steps-dots" aria-hidden="true">${[1, 2, 3, 4].map((k) => `<i class="${k <= i ? "on" : ""}"></i>`).join("")}</div>`;
  if (step === "start") {
    return `<section class="onboard onboard-hero" aria-labelledby="ob-title">
      <div>${dots(1)}<p class="eyebrow">Music DNA Copilot 3.0</p>
        <h1 id="ob-title">Your music<br>has a DNA.</h1>
        <p class="lead">Connect the places where you listen. Music DNA combines them into one evolving taste profile, and it stays on this computer.</p>
        <div class="row"><a class="btn btn-primary btn-lg" href="#/welcome/sources">Build my Music DNA ${icon("arrow")}</a>
        ${S.state.has_dna ? `<a class="btn btn-ghost" href="#/">Skip to my DNA</a>` : ""}</div>
        <p class="faint" style="margin-top:18px">No account needed · Spotify, Apple Music, Last.fm, YouTube Music and more</p>
      </div>
      <div class="hero-viz" id="ob-viz" aria-hidden="true"></div>
    </section>`;
  }
  if (step === "sources") {
    const src = await api("sources");
    const active = src.active_count;
    return `<section class="onboard">
      ${dots(2)}<div class="page-head"><div><h1>Where do you listen?</h1>
      <p>Connect a live service or import an export file. Add as many as you like; every source makes the DNA sharper.</p></div></div>
      <div id="ob-sources">${providerGrid(src.cards, true)}</div>
      <div class="card" style="margin-top:18px"><div class="row"><div class="spacer">
        <b>${active ? `${active} source${active === 1 ? "" : "s"} ready` : "No sources yet"}</b>
        <p class="muted">${active ? "Build your DNA now, or add more first." : "No data handy? You can explore with a clearly-labelled demo library instead."}</p></div>
        ${!active ? `<button class="btn" data-act="demo">Explore with demo data</button>` : ""}
        <button class="btn btn-primary" data-act="analyze" ${active ? "" : "disabled"}>Build my DNA ${icon("arrow")}</button></div></div>
    </section>`;
  }
  if (step === "analysis") {
    return `<section class="onboard analysis" aria-labelledby="an-title">${dots(3)}
      <h1 id="an-title">Reading your music</h1><p class="muted">Each step below is the real work happening on your computer.</p>
      <ol id="an-steps" aria-live="polite"></ol><div class="pending" id="an-pending"><span class="pulse-dot" aria-hidden="true"></span><span>Working…</span></div>
      <div id="an-error"></div></section>`;
  }
  if (step === "reveal") {
    const st = await refresh();
    const d = st.dna;
    if (!d) { location.replace("#/welcome/sources"); return ""; }
    return `<section class="onboard reveal" aria-labelledby="rv-title">${dots(4)}
      <div class="hero-dna"><div class="hero-viz" id="rv-viz"></div>
      <div class="hero-copy"><p class="eyebrow">Your Music DNA</p><h1 id="rv-title" class="state-words">${d.state_words.map((w) => `<span>${esc(w)}</span>`).join("")}</h1>
        ${statLine(d)}
        ${revealFacts(d)}
        <div class="row"><button class="btn btn-signal btn-lg" data-act="first-capsule">Open my first capsule ${icon("arrow")}</button>
        <a class="btn btn-ghost" href="#/dna" data-act="finish-onboarding">Explore my DNA</a></div>
      </div></div>${demoNotice()}</section>`;
  }
  return viewNotFound();
}
function revealFacts(d) {
  const disc = d.discovery, fam = d.familiarity;
  const tend = (x, hi, lo) => (x && x.status === "ok" ? (x.value >= 0.55 ? hi : x.value <= 0.3 ? lo : "Balanced") : "Not enough data yet");
  return `<dl class="kv">
    <dt>Top genres</dt><dd>${esc(d.top_genres.slice(0, 4).join(", ") || "Not enough data")}</dd>
    <dt>Microgenres</dt><dd>${esc(d.microgenres.slice(0, 4).join(", ") || "None detected yet")}</dd>
    <dt>Artists</dt><dd>${esc(d.top_artists.slice(0, 4).join(", ") || "—")}</dd>
    <dt>Discovery</dt><dd>${esc(tend(disc, "Explorer", "Loyal to favourites"))}</dd>
    <dt>Familiarity</dt><dd>${esc(fam && fam.status === "ok" ? `${pct(fam.value)} of plays are repeats` : "Not enough data yet")}</dd>
    <dt>Coverage</dt><dd>${esc(d.coverage.level || "—")}${d.coverage.reasons?.length ? ` <span class="faint">(${esc(d.coverage.reasons.join(", "))})</span>` : ""}</dd>
  </dl>`;
}
viewWelcome.after = async (m) => {
  const step = (m && m[1]) || "start";
  const main = root();
  if (step === "start") {
    const el = $("#ob-viz");
    if (el) (await viz()).renderDNA(el, DEMO_SHAPE, { compact: true, illustration: true, label: "Illustration of a taste map" });
  }
  if (step === "sources") {
    bindSources(main, true);
    main.addEventListener("click", async (ev) => {
      const b = ev.target.closest("[data-act]");
      if (!b) return;
      if (b.dataset.act === "demo") {
        await api("demo", { method: "POST", body: { enable: true } }); location.hash = "#/welcome/analysis";
      } else if (b.dataset.act === "analyze") {
        await api("demo", { method: "POST", body: { enable: false } }); location.hash = "#/welcome/analysis";
      }
    });
  }
  if (step === "analysis") {
    await runAnalysis({ onDone: () => { location.hash = "#/welcome/reveal"; } });
  }
  if (step === "reveal") {
    const el = $("#rv-viz");
    const { dna } = await api("dna");
    (await viz()).renderDNA(el, dna, { compact: true });
    main.addEventListener("click", async (ev) => {
      const b = ev.target.closest("[data-act]");
      if (!b) return;
      if (b.dataset.act === "first-capsule") {
        await api("onboarding/complete", { method: "POST", body: {} });
        S.tier = "common"; S.intent = "surprise";
        openCapsule(b);
      } else if (b.dataset.act === "finish-onboarding") {
        await api("onboarding/complete", { method: "POST", body: {} }); await refresh();
      }
    });
  }
};
async function runAnalysis({ onDone, demo } = {}) {
  const list = $("#an-steps"), pending = $("#an-pending"), errBox = $("#an-error");
  try {
    await streamBuild(demo === undefined ? {} : { demo }, (step) => {
      if (step.step === "error") throw new ApiError(step.error, 500);
      if (step.step === "done") return;
      const li = document.createElement("li");
      li.innerHTML = `<span class="ic">${icon("check")}</span><span><b>${esc(step.label)}</b><small>${esc(step.detail)}</small></span><span class="ms">${step.ms} ms</span>`;
      list.append(li);
    });
    pending.remove();
    await refresh();
    const btn = document.createElement("div");
    btn.innerHTML = `<button class="btn btn-primary btn-lg" style="margin-top:22px">Reveal my DNA ${icon("arrow")}</button>`;
    list.after(btn);
    btn.querySelector("button").addEventListener("click", onDone);
    btn.querySelector("button").focus();
  } catch (e) {
    pending.remove();
    errBox.innerHTML = `<div style="margin-top:18px">${errorBlock(e)}</div><a class="btn" style="margin-top:12px" href="#/sources">Check your sources</a>`;
  }
}
// Illustrative shape for the welcome screen only (aria-hidden, no numbers shown as facts).
const DEMO_SHAPE = {
  generated_at: "illustration", stats: { raw_events: 0 },
  families: [{ id: "a", label: "", affinity: 1, genres: [] }, { id: "b", label: "", affinity: .7, genres: [] }, { id: "c", label: "", affinity: .55, genres: [] },
    { id: "d", label: "", affinity: .4, genres: [] }, { id: "e", label: "", affinity: .3, genres: [] }, { id: "f", label: "", affinity: .2, genres: [] }],
  genres: ["a", "a", "a", "b", "b", "c", "c", "d", "e", "f"].map((f, i) => ({ name: `g${i}`, family: f, affinity: 1 - i * 0.08, kind: i % 3 ? "subgenre" : "microgenre" })),
  artists: ["a", "a", "b", "b", "c", "d", "e", "f", "a", "c"].map((f, i) => ({ name: "", family: f, affinity: 1 - i * .08, plays: 0 })),
};

/* ------------------------------------------------------------------ home */
async function viewHome() {
  const st = await refresh();
  if (!st.has_dna) {
    return `<h1>Music DNA</h1><div style="margin-top:18px">${empty("sources", "No sources connected",
      "Connect or import at least one music source to build your DNA.", `<a class="btn btn-primary" href="#/sources">Connect a source</a>`)}</div>`;
  }
  const d = st.dna;
  const act = st.active_capsule;
  return `
  ${demoNotice()}
  ${st.dna_stale ? `<div class="notice warn" style="margin-bottom:16px"><div><b>Your sources changed</b><p>No sources are connected any more. Your DNA still reflects older data. <a href="#/sources">Review sources</a></p></div></div>` : ""}
  <section class="card hero-dna" aria-labelledby="home-title" style="margin-top:${d.demo ? 16 : 0}px">
    <div class="hero-viz" id="home-viz"><div class="skeleton" style="height:100%"></div></div>
    <div class="hero-copy">
      <p class="eyebrow">Your Music DNA · updated ${esc(ago(d.generated_at))}</p>
      <h1 id="home-title" class="state-words" aria-label="Current musical state: ${esc(d.state_words.join(", "))}">${d.state_words.map((w) => `<span>${esc(w)}</span>`).join("")}</h1>
      ${statLine(d)}
      <div class="row"><a class="btn btn-sm" href="#/dna">Explore DNA</a><a class="btn btn-sm btn-ghost" href="#/sources">${icon("sync")} Sync services</a></div>
    </div>
  </section>
  ${act ? `<div class="notice" style="margin-top:16px" data-tier="${esc(act.tier)}"><span class="tier-dot" style="margin-top:6px"></span><div class="spacer"><b>${esc(act.tier_label)} capsule in progress</b><p>Pick up where you left off.</p></div><a class="btn btn-sm" href="#/capsule/${esc(act.capsule_id)}">Resume</a></div>` : ""}
  <section class="card" aria-labelledby="need-title" style="margin-top:16px" id="picker">
    <div class="card-head"><h2 id="need-title">What do you need right now?</h2><span class="faint">Optional: skip it for a surprise</span></div>
    ${intentGrid()}
    <hr class="divider">
    <div class="card-head"><h3>Capsule</h3></div>
    ${tierPicker()}
    <div class="cta-bar"><button class="btn btn-signal btn-lg" data-act="open-capsule">${icon("capsule")} Open capsule</button>
      <span class="faint">Built from your DNA${st.session?.events ? " and this session's reactions" : ""}.</span></div>
  </section>
  <section class="card" style="margin-top:16px" aria-labelledby="cn-title"><h2 id="cn-title" class="sr-only">Core DNA and right now</h2>${coreNow(d, st.session)}</section>
  <section class="card" style="margin-top:16px" aria-labelledby="ch-title"><div class="card-head"><h2 id="ch-title">What your DNA learned lately</h2><a class="link-btn" href="#/dna">All changes</a></div><div id="home-changes"><div class="skeleton" style="min-height:60px"></div></div></section>`;
}
viewHome.after = async () => {
  const st = S.state;
  if (!st.has_dna) return;
  bindPicker($("#picker"));
  try {
    const [{ dna }, ch] = await Promise.all([api("dna"), api("dna/changes")]);
    (await viz()).renderDNA($("#home-viz"), dna, { compact: true, changed: ch.items.filter((i) => i.kind === "genre").map((i) => i.subject) });
    $("#home-changes").innerHTML = changeList(ch.items.slice(0, 2), true);
  } catch (e) { $("#home-changes").innerHTML = errorBlock(e); }
};
function changeList(items, compact = false) {
  if (!items.length) {
    return `<p class="muted">${compact ? "No changes yet. Your DNA learns from how you react inside capsules." : "Nothing has changed yet. Open a capsule and react to tracks; changes appear here with the evidence behind them."}</p>`;
  }
  return `<ul class="feed">${items.map((i) => `<li class="${esc(i.direction)}"><span class="arrow" aria-hidden="true">${i.direction === "up" ? "↑" : i.direction === "down" ? "↓" : "•"}</span>
    <div><b>${esc(i.title)}</b><small>${esc(i.why)}</small>${i.confidence ? `<em>${esc(i.confidence)}${i.evidence ? ` · ${i.evidence} signal${i.evidence === 1 ? "" : "s"}` : ""}</em>` : ""}</div></li>`).join("")}</ul>`;
}

/* ------------------------------------------------------------------ DNA */
async function viewDNA() {
  const st = await refresh();
  if (!st.has_dna) return `<h1>Your Music DNA</h1><div style="margin-top:18px">${empty("dna", "No DNA yet", "Connect or import at least one music source to build your DNA.", `<a class="btn btn-primary" href="#/sources">Connect a source</a>`)}</div>`;
  const [{ dna }, ch] = await Promise.all([api("dna"), api("dna/changes")]);
  S.dna = dna; S.changes = ch;
  const dims = dna.dimensions;
  const DIM = [
    ["genre_affinity", "Genre affinity"], ["microgenre_affinity", "Microgenre affinity"], ["artist_affinity", "Artist affinity"],
    ["familiarity", "Familiarity", "New", "Repeats"], ["novelty", "Novelty", "Familiar", "Novel"],
    ["discovery_tolerance", "Discovery tolerance", "Stays close", "Roams far"], ["mainstream_niche", "Mainstream ↔ Niche", "Mainstream", "Niche"],
    ["recent_shift", "Recent taste shift"], ["context_affinity", "Context affinity"],
  ];
  const dimCard = ([k, title, lo, hi]) => {
    const x = dims[k] || { status: "insufficient_data", reason: "Not computed." };
    if (x.status !== "ok") return `<div class="dim insufficient"><h3>${esc(title)}</h3><div class="val">Not enough data</div><p class="basis">${esc(x.reason)}</p></div>`;
    let body = "";
    if (x.value != null) body = `<div class="val">${pct(x.value)}</div><div class="meter"><i data-v="${x.value}"></i></div>${lo ? `<div class="scale"><span>${esc(lo)}</span><span>${esc(hi)}</span></div>` : ""}`;
    else if (x.top) body = `<div class="chips">${x.top.map((t) => `<span class="chip">${esc(t)}</span>`).join("")}</div>`;
    else if (x.rising) body = `<div class="chips">${x.rising.map((t) => `<span class="chip up">↑ ${esc(t)}</span>`).join("")}${x.fading.map((t) => `<span class="chip down">↓ ${esc(t)}</span>`).join("")}</div>`;
    else if (x.values) body = `<div class="chips">${Object.entries(x.values).map(([c, v]) => `<span class="chip ${v >= 0 ? "up" : "down"}">${esc(c.replace(/_/g, " "))} ${v >= 0 ? "↑" : "↓"}</span>`).join("")}</div>`;
    return `<div class="dim"><h3>${esc(title)}</h3>${body}<p class="basis">${esc(x.basis || "")}</p></div>`;
  };
  const bars = (items, key = "affinity") => `<div class="bars">${items.map((g) => `<div class="bar-row"><span title="${esc(g.name)}">${esc(g.name)}</span><div class="meter"><i data-v="${g[key]}"></i></div><span class="v">${pct(g[key])}</span></div>`).join("")}</div>`;
  const s = dna.stats;
  return `
  <div class="page-head"><div><p class="eyebrow">Music DNA · built ${esc(ago(dna.generated_at))}</p><h1>Your Music DNA</h1>
    <p>A living map of what you listen to. Families sit closer to the centre the stronger your affinity; satellites are genres, outer points are your artists.</p></div>
    <button class="btn btn-sm" data-act="rebuild">${icon("sync")} Rebuild</button></div>
  ${demoNotice()}
  <div class="dna-layout" style="margin-top:${dna.demo ? 16 : 0}px">
    <section class="card viz-card" aria-labelledby="map-title">
      <div class="viz-toolbar"><h2 id="map-title" class="eyebrow">Taste map</h2>
        <div class="segmented" role="tablist" aria-label="View"><button role="tab" aria-selected="true" data-act="mode" data-value="map">Map</button><button role="tab" aria-selected="false" data-act="mode" data-value="list">List</button></div></div>
      <div id="dna-map"><div class="viz-wrap" id="dna-viz"></div>
        <div class="viz-legend" aria-hidden="true"><span><i class="l-fam"></i>Genre family</span><span><i class="l-genre"></i>Genre</span><span><i class="l-micro"></i>Microgenre</span><span><i class="l-artist"></i>Artist</span></div>
        <p class="faint" style="padding:0 8px 6px;font-size:12.5px">Hover or focus a family to see its artists. Enter or click to pin it.</p></div>
      <div id="dna-listview" hidden>${dnaListView(dna)}</div>
    </section>
    <div class="stack">
      <section class="card focus-panel" id="focus-panel" aria-live="polite">${focusPanel(null, dna)}</section>
      <section class="card"><h2 class="eyebrow" style="margin-bottom:12px">Signals</h2>
        <div class="stats">
          <div class="stat"><b>${n(s.raw_events)}</b><span>listening events</span></div>
          <div class="stat"><b>${n(s.unique_tracks)}</b><span>unique tracks</span></div>
          <div class="stat"><b>${n(s.artists)}</b><span>artists</span></div>
          <div class="stat"><b>${s.source_count}</b><span>source${s.source_count === 1 ? "" : "s"}</span></div>
        </div>
        <p class="faint" style="margin-top:10px;font-size:12.5px">Coverage <b>${esc(dna.coverage.level)}</b>${dna.coverage.reasons.length ? ` · ${esc(dna.coverage.reasons.join(", "))}` : ""}${s.history_span ? ` · ${esc(s.history_span.text)} of dated history` : " · no dated plays"}${s.inferred_genres ? ` · ${n(s.inferred_genres)} tracks with inferred genres` : ""}.</p>
      </section>
    </div>
  </div>
  <section class="card" style="margin-top:16px" aria-labelledby="cn2"><h2 id="cn2" class="sr-only">Core DNA vs right now</h2>${coreNow(dna, dna.session)}</section>
  <section class="card" style="margin-top:16px" aria-labelledby="why-title"><div class="card-head"><h2 id="why-title">Why did my DNA change?</h2><span class="faint">Last ${ch.window_days} days · ${ch.feedback_events} reactions</span></div>
    ${changeList(ch.items)}<p class="faint" style="margin-top:12px;font-size:12.5px">${esc(ch.note)}</p></section>
  <section class="card" style="margin-top:16px" aria-labelledby="dims-title"><div class="card-head"><h2 id="dims-title">Dimensions</h2><span class="faint">Only shown where there's evidence</span></div>
    <div class="dims">${DIM.map(dimCard).join("")}</div></section>
  <div class="grid grid-2" style="margin-top:16px">
    <section class="card"><h2 class="eyebrow" style="margin-bottom:12px">Genres</h2>${bars(dna.genres.slice(0, 12))}</section>
    <section class="card"><h2 class="eyebrow" style="margin-bottom:12px">Artists</h2>${bars(dna.artists.slice(0, 12).map((a) => ({ ...a })))}</section>
  </div>
  ${dna.learned.evidence_count ? `<section class="card" style="margin-top:16px"><div class="card-head"><h2 class="eyebrow">Learned from your reactions</h2><span class="faint">${dna.learned.evidence_count} signals · confidence ${pct(dna.learned.confidence)}</span></div>
    <div class="chips">${Object.entries(dna.learned.genres).map(([g, v]) => `<span class="chip ${v >= 0 ? "up" : "down"}">${esc(g)} ${v >= 0 ? "+" : ""}${v.toFixed(2)}</span>`).join("")}</div>
    <p class="faint" style="margin-top:10px;font-size:12.5px">A bounded layer on top of your history. It can move a recommendation's score by at most 18 points.</p></section>` : ""}`;
}
function dnaListView(dna) {
  return `<div class="dna-list">${dna.families.map((f) => {
    const gs = dna.genres.filter((g) => g.family === f.id);
    const as = dna.artists.filter((a) => a.family === f.id);
    return `<details><summary>${esc(f.label)} · ${pct(f.affinity)}</summary>
      <p class="muted" style="margin-top:8px">Genres: ${esc(gs.map((g) => `${g.name}${g.kind === "microgenre" ? " (micro)" : ""} ${pct(g.affinity)}`).join(", ") || "—")}</p>
      <p class="muted">Artists: ${esc(as.map((a) => a.name).join(", ") || "—")}</p></details>`;
  }).join("")}</div>`;
}
function focusPanel(fam, dna) {
  if (!fam) {
    const top = dna.families[0];
    return `<h2 class="eyebrow">Focus</h2><p class="muted" style="margin-top:8px">Select a family on the map to see its genres, microgenres and artists.</p>
      ${top ? `<p style="margin-top:12px">Your strongest family is <b>${esc(top.label)}</b>, led by ${esc(top.genres.slice(0, 3).join(", "))}.</p>` : ""}`;
  }
  const gs = dna.genres.filter((g) => g.family === fam.id);
  const as = dna.artists.filter((a) => a.family === fam.id);
  const micro = gs.filter((g) => g.kind === "microgenre");
  return `<div class="card-head"><h2>${esc(fam.label)}</h2><span class="mono faint">${pct(fam.affinity)} relative affinity</span></div>
    <p class="eyebrow">Genres</p><div class="chips" style="margin:8px 0 14px">${gs.filter((g) => g.kind !== "microgenre").slice(0, 8).map((g) => `<span class="chip">${esc(g.name)}</span>`).join("") || '<span class="faint">—</span>'}</div>
    <p class="eyebrow">Microgenres</p><div class="chips" style="margin:8px 0 14px">${micro.slice(0, 8).map((g) => `<span class="chip up">${esc(g.name)}</span>`).join("") || '<span class="faint">None detected</span>'}</div>
    <p class="eyebrow">Artists</p><div class="chips" style="margin-top:8px">${as.slice(0, 10).map((a) => `<span class="chip dim">${esc(a.name)}</span>`).join("") || '<span class="faint">None in your top artists</span>'}</div>`;
}
viewDNA.after = async () => {
  if (!S.state.has_dna) return;
  const main = root();
  $$(".meter i[data-v]", main).forEach((i) => i.style.setProperty("--v", `${Math.max(0, Math.min(1, +i.dataset.v)) * 100}%`));
  const changed = S.changes.items.filter((i) => i.kind === "genre").map((i) => i.subject);
  (await viz()).renderDNA($("#dna-viz"), S.dna, { changed, onSelect: (fam, dna) => { $("#focus-panel").innerHTML = focusPanel(fam, dna); } });
  main.addEventListener("click", async (ev) => {
    const b = ev.target.closest("[data-act]");
    if (!b) return;
    if (b.dataset.act === "mode") {
      const list = b.dataset.value === "list";
      $("#dna-map").hidden = list; $("#dna-listview").hidden = !list;
      $$('[data-act="mode"]', main).forEach((x) => x.setAttribute("aria-selected", String(x === b)));
    }
    if (b.dataset.act === "rebuild") rebuild(b);
  });
};
async function rebuild(btn) {
  btn.disabled = true; btn.innerHTML = `<span class="pulse-dot" aria-hidden="true"></span> Rebuilding…`;
  try {
    let last = null;
    await streamBuild({}, (s) => { if (s.step === "error") throw new ApiError(s.error, 500); last = s; });
    toast("Music DNA rebuilt from your current sources.", "ok");
    await refresh(); route();
  } catch (e) { showError(e); btn.disabled = false; btn.textContent = "Rebuild"; }
}

/* ------------------------------------------------------------------ capsules */
async function viewCapsules() {
  const st = await refresh();
  if (!st.has_dna) return `<h1>Capsules</h1><div style="margin-top:18px">${empty("capsule", "Build your DNA first", "Capsules are generated from your Music DNA. Connect a source to begin.", `<a class="btn btn-primary" href="#/sources">Connect a source</a>`)}</div>`;
  const h = await api("history");
  const recent = h.capsules.slice(0, 6);
  return `<div class="page-head"><div><h1>Capsules</h1><p>Short, explainable listening sessions built from your DNA. React as you listen, and the next one gets better.</p></div></div>
  ${demoNotice()}
  <section class="card" id="picker" style="margin-top:${st.dna.demo ? 16 : 0}px"><div class="card-head"><h2>Choose a capsule</h2></div>
    ${tierPicker()}<hr class="divider"><div class="card-head"><h3>Context</h3><span class="faint">Optional</span></div>${intentGrid()}
    <div class="cta-bar"><button class="btn btn-signal btn-lg" data-act="open-capsule">${icon("capsule")} Open capsule</button></div></section>
  <section class="card" style="margin-top:16px"><div class="card-head"><h2>Recent capsules</h2><a class="link-btn" href="#/history">Full history</a></div>
    ${recent.length ? historyCards(recent) : `<p class="muted">No capsule history. Your first capsule will appear here.</p>`}</section>`;
}
viewCapsules.after = () => { if (S.state.has_dna) bindPicker($("#picker")); };

const FB_MAIN = [["love", "Love", "love"], ["save", "Save", "save"], ["completed", "Listened", "listened"], ["replay", "Replay", "replay"], ["skip", "Skip", "skip"], ["not_for_me", "Not for me", "no"]];
const FB_MORE = [["more_like_this", "More like this"], ["too_similar", "Too similar"], ["too_strange", "Too strange"]];
const TERMINAL = new Set(["completed", "skip", "not_for_me", "save", "love", "replay"]);

async function viewCapsule(m) {
  const id = m[1];
  const { capsule } = await api(`capsules/${id}`);
  S.capsule = capsule;
  return capsuleHTML(capsule);
}
function currentIndex(c) {
  const i = c.tracks.findIndex((t) => !t.feedback.some((a) => TERMINAL.has(a)));
  return i;
}
function capsuleHTML(c) {
  const cur = currentIndex(c);
  const closed = c.state === "completed" || c.state === "abandoned";
  const intro = S.justOpened ? " capsule-open" : "";
  S.justOpened = false;
  const warn = (c.retrieval?.warnings || []).includes("pool_smaller_than_capsule")
    ? `<div class="notice warn"><div><b>Smaller than usual</b><p>Only ${c.actual_size} suitable candidates were available for this capsule. Connect Spotify for a larger catalog.</p></div></div>` : "";
  return `<div data-tier="${esc(c.rarity)}" class="${intro.trim()}">
    <div class="capsule-head">
      <div class="capsule-title"><p class="eyebrow">${esc(c.context?.intent_label || "Surprise")} · ${date(c.generated_at)}${c.demo ? ' · <span class="badge demo">Demo</span>' : ""}</p>
        <h1><span class="badge tier-badge">${esc(c.tier_label)}</span> ${c.rarity === "mystery" ? "Mystery capsule" : `${c.actual_size} tracks`}</h1>
        <p class="muted">${esc(c.tagline || "")}</p></div>
      <div class="capsule-progress" aria-label="Progress"><div class="row"><span>${c.progress.done} of ${c.progress.total} reacted</span><span>${esc(c.state)}</span></div>
        <div class="meter tier"><i data-v="${c.progress.done / Math.max(1, c.progress.total)}"></i></div></div>
    </div>
    ${warn}
    ${closed && c.summary ? completeHTML(c) : ""}
    <ol class="tracks" aria-label="Capsule tracks" style="list-style:none;padding:0;margin:${warn ? "14px" : "0"} 0 0">
      ${c.tracks.map((t, i) => trackHTML(c, t, i, i === cur && !closed)).join("")}
    </ol>
    ${!closed ? `<div class="row" style="margin-top:18px"><span class="faint spacer">${esc(c.composition ? `${c.composition.close} close · ${c.composition.moderate} moderate · ${c.composition.far} far` : "")}${c.session_taste_used ? " · shaped by this session" : ""}</span>
      <button class="btn btn-ghost" data-act="finish">${c.progress.done ? "Finish capsule" : "Close capsule"}</button></div>` : ""}
    ${advanced() ? `<p class="faint mono" style="margin-top:14px;font-size:12px">variant ${esc(c.algorithm?.variant)} · ${esc(c.algorithm?.version)} · pool ${c.retrieval?.pool_size} · ${esc((c.retrieval?.catalogs || []).map((x) => x.label).join(" + "))}</p>` : ""}
  </div>`;
}
function trackHTML(c, t, i, isCurrent) {
  const done = t.feedback.some((a) => TERMINAL.has(a));
  const open = isCurrent || S.expanded.has(t.track_id);
  const num = String(i + 1).padStart(2, "0");
  const name = t.hidden
    ? `<b>TRACK ${num}</b><span>UNKNOWN ARTIST</span><span>UNKNOWN TITLE</span>`
    : `<b>${esc(t.title)}</b><span>${esc(t.artist)}</span>`;
  const label = t.hidden ? `Hidden track ${i + 1}` : `${t.title} by ${t.artist}`;
  const cls = ["track", isCurrent ? "is-current" : "", done ? "is-done" : "", t.hidden ? "hidden-track" : "", S.revealing.has(t.track_id) ? "revealing" : ""].join(" ");
  return `<li class="${cls}" style="--i:${i}" data-track="${esc(t.track_id)}">
    <div class="track-main">
      <span class="track-no" aria-hidden="true">${num}</span>
      <button class="track-name link-reset" data-act="toggle" aria-expanded="${open}" aria-controls="tb-${esc(t.track_id)}" aria-label="${esc(label)}${isCurrent ? " (current)" : ""}">${name}</button>
      <div class="track-match"><b>${t.explain.match}%</b><small>match</small></div>
    </div>
    <div class="track-body" id="tb-${esc(t.track_id)}" ${open ? "" : "hidden"}>
      ${done ? `<span class="done-tag">${icon("check", "")} ${esc(t.feedback.filter((a) => TERMINAL.has(a)).map(fbLabel).join(" · "))}</span>` : ""}
      ${t.hidden ? mysteryBody(t) : playBody(t)}
      ${c.state === "completed" || c.state === "abandoned" ? "" : feedbackRow(t)}
      ${t.hidden ? "" : whyPanel(t, c)}
    </div>
  </li>`;
}
const fbLabel = (a) => ({ love: "Loved", save: "Saved", completed: "Listened", replay: "Replayed", skip: "Skipped", not_for_me: "Not for me", more_like_this: "More like this", too_similar: "Too similar", too_strange: "Too strange" }[a] || a);
function mysteryBody(t) {
  return `<div class="why-kv" aria-label="What we can tell you before the reveal">
      <div><small>DNA match</small><b>${t.explain.match}%</b></div><div><small>Discovery distance</small><b>${esc(t.explain.distance)}</b></div><div><small>Context fit</small><b>${t.explain.context_fit}%</b></div></div>
    <div class="mystery-veil" aria-hidden="true"></div>
    <div class="play-row"><button class="btn btn-sm" data-act="reveal">${icon("eye")} Reveal track</button>
      <span class="play-note">Or react first: any reaction reveals it.</span></div>`;
}
function playBody(t) {
  const pb = t.playback || { actions: [] };
  const acts = pb.actions || [];
  const primary = acts.filter((a) => !a.secondary).slice(0, 2);
  const secondary = acts.filter((a) => a.secondary);
  const btn = (a, cls) => a.url ? `<a class="btn btn-sm ${cls}" href="${esc(a.url)}" target="_blank" rel="noopener noreferrer" data-act="open" data-provider="${esc(a.provider)}">${icon(a.kind === "open" ? "external" : "search")} ${esc(a.label)}</a>` : "";
  return `<div class="play-row">${primary.map((a, i) => btn(a, i === 0 ? "btn-primary" : "")).join("")}
      ${secondary.length ? `<details class="more-fb"><summary>Other services</summary><div class="play-row" style="margin-top:6px">${secondary.map((a) => btn(a, "btn-ghost")).join("")}</div></details>` : ""}</div>
    ${pb.note ? `<p class="play-note">${esc(pb.note)}</p>` : ""}`;
}
function feedbackRow(t) {
  const on = (a) => t.feedback.includes(a);
  return `<div class="fb-row" role="group" aria-label="React to this track">${FB_MAIN.map(([a, l, ic]) =>
    `<button class="fb" data-act="fb" data-action="${a}" aria-pressed="${on(a)}" aria-label="${l}">${icon(ic)}<span class="${a === "completed" || a === "replay" ? "lbl-opt" : ""}">${l}</span></button>`).join("")}</div>
    <details class="more-fb"><summary>More feedback</summary><div class="fb-row">${FB_MORE.map(([a, l]) =>
      `<button class="fb" data-act="fb" data-action="${a}" aria-pressed="${on(a)}">${l}</button>`).join("")}</div></details>`;
}
function whyPanel(t, c) {
  const x = t.explain;
  return `<details class="why"><summary>Why this track? <span class="faint mono">${x.match}% match</span></summary><div class="why-body">
    <div class="why-kv"><div><small>Match</small><b>${x.match}%</b></div><div><small>Discovery distance</small><b>${esc(x.distance)}</b></div><div><small>Context fit</small><b>${x.context_fit}%</b></div></div>
    <ul>${x.reasons.map((r) => `<li>${esc(r.text)}${r.items ? `: <b>${esc(r.items.join(", "))}</b>` : ""}</li>`).join("")}</ul>
    ${x.caution ? `<p class="muted">${esc(x.caution)}</p>` : ""}
    ${t.genres?.length ? `<div class="chips">${t.genres.map((g) => `<span class="chip dim">${esc(g)}</span>`).join("")}</div>` : ""}
    <p class="faint" style="font-size:12px">${esc(x.match_note)}${x.genres_inferred ? " Genres for this track were inferred from artist data." : ""}</p>
    ${advanced() && t.playback ? `<p class="faint mono" style="font-size:12px">resolver: ${esc(t.playback.status)} / ${esc(t.playback.method)} via ${esc(t.playback.provider)}</p>` : ""}
  </div></details>`;
}
function completeHTML(c) {
  const s = c.summary;
  const abandoned = c.state === "abandoned";
  return `<section class="card complete reveal" aria-labelledby="done-title" style="margin-bottom:16px">
    <div class="complete-hero"><div><p class="eyebrow">${abandoned ? "Capsule closed" : "Capsule complete"}</p><h2 id="done-title" tabindex="-1">${abandoned ? "Closed before listening" : "Capsule complete"}</h2>
      <div class="complete-counts" style="margin-top:14px">
        <div class="stat"><b>${s.tracks}</b><span>tracks</span></div><div class="stat"><b>${s.completed}</b><span>listened</span></div>
        <div class="stat"><b>${s.saved + s.loved}</b><span>saved or loved</span></div><div class="stat"><b>${s.replayed}</b><span>replayed</span></div>
        <div class="stat"><b>${s.skipped}</b><span>skipped</span></div><div class="stat"><b>${s.rejected}</b><span>not for me</span></div></div>
      <p class="faint" style="font-size:12px;margin-top:8px">${esc(s.completed_note)}</p></div>
    <div><p class="eyebrow">What your DNA learned</p>
      ${s.learned.length ? `<ul class="learned" style="margin-top:12px">${s.learned.map((l) => `<li class="${esc(l.direction)}"><span class="dir" aria-label="${l.direction === "up" ? "increased" : "decreased"}">${l.direction === "up" ? "↑" : "↓"}</span><span>${esc(l.text)}</span><small>${esc(l.evidence)}</small></li>`).join("")}</ul>`
      : `<p class="muted" style="margin-top:12px">${esc(s.learned_empty_reason)}</p>`}
    </div></div>
    <div class="cta-bar"><button class="btn btn-signal" data-act="next">Generate next capsule ${icon("arrow")}</button><a class="btn" href="#/dna">View DNA changes</a></div>
  </section>`;
}
viewCapsule.after = () => {
  const main = root();
  $$(".meter i[data-v]", main).forEach((i) => i.style.setProperty("--v", `${Math.max(0, Math.min(1, +i.dataset.v)) * 100}%`));
  S.revealing.clear();
  main.onclick = async (ev) => {
    const b = ev.target.closest("[data-act]");
    if (!b) return;
    const c = S.capsule;
    const li = b.closest("[data-track]");
    const tid = li?.dataset.track;
    const act = b.dataset.act;
    if (act === "toggle") {
      const body = $(`#tb-${CSS.escape(tid)}`);
      const open = body.hidden;
      body.hidden = !open; b.setAttribute("aria-expanded", String(open));
      if (open) S.expanded.add(tid); else S.expanded.delete(tid);
      return;
    }
    if (act === "open") {
      // Let the link open normally; record the (observable) open in the background.
      fetch(`/api/v3/capsules/${c.capsule_id}/open`, { method: "POST", keepalive: true,
        headers: { "X-MusicDNA-Client": "3", "Content-Type": "application/json" }, body: JSON.stringify({ track_id: tid, provider: b.dataset.provider }) }).catch(() => {});
      return;
    }
    try {
      if (act === "fb") {
        const wasHidden = c.tracks.find((t) => t.track_id === tid)?.hidden;
        b.setAttribute("aria-busy", "true");
        const before = c.state;
        const { capsule } = await api(`capsules/${c.capsule_id}/feedback`, { method: "POST", body: { track_id: tid, action: b.dataset.action } });
        const nt = capsule.tracks.find((t) => t.track_id === tid);
        if (wasHidden && nt && !nt.hidden) S.revealing.add(tid);
        rerenderCapsule(capsule, tid);
        if (before !== "completed" && capsule.state === "completed") { $("#done-title")?.focus(); window.scrollTo({ top: 0, behavior: "smooth" }); }
      } else if (act === "reveal") {
        const { capsule } = await api(`capsules/${c.capsule_id}/reveal`, { method: "POST", body: { track_id: tid } });
        S.revealing.add(tid); S.expanded.add(tid);
        rerenderCapsule(capsule, tid);
      } else if (act === "finish") {
        const ok = c.progress.done ? true : await confirmDialog("Close this capsule?", "You haven't reacted to any tracks. It will be marked as closed in your history.", "Close capsule");
        if (!ok) return;
        const { capsule } = await api(`capsules/${c.capsule_id}/finish`, { method: "POST", body: {} });
        rerenderCapsule(capsule); $("#done-title")?.focus();
      } else if (act === "next") {
        S.tier = c.rarity; S.intent = c.context?.custom ? null : c.context?.intent; S.custom = "";
        openCapsule(b);
      }
    } catch (e) { showError(e); }
  };
};
function rerenderCapsule(capsule, focusTrack) {
  S.capsule = capsule;
  const main = root();
  main.innerHTML = capsuleHTML(capsule);
  viewCapsule.after();
  if (focusTrack) {
    const next = capsule.tracks[currentIndex(capsule)];
    const target = next ? $(`[data-track="${CSS.escape(next.track_id)}"] [data-act="toggle"]`, main) : null;
    const same = $(`[data-track="${CSS.escape(focusTrack)}"] [data-act="toggle"]`, main);
    (target && next.track_id !== focusTrack && capsule.tracks.find((t) => t.track_id === focusTrack)?.feedback.some((a) => TERMINAL.has(a)) ? target : same)?.focus({ preventScroll: false });
  }
}

/* ------------------------------------------------------------------ history */
function historyCards(rows) {
  return `<div class="history-table table-wrap"><table class="data"><thead><tr><th>Date</th><th>Capsule</th><th>Context</th><th class="num">Reacted</th><th class="num">Saves</th><th class="num">Replays</th><th class="num">Rejected</th><th>Provider</th><th>Status</th></tr></thead><tbody>
    ${rows.map((r) => `<tr data-tier="${esc(r.tier)}"><td>${date(r.date)}</td><td><a href="#/capsule/${esc(r.capsule_id)}"><span class="badge tier-badge">${esc(r.tier_label)}</span></a>${r.demo ? ' <span class="badge demo">Demo</span>' : ""}</td>
      <td>${esc(r.intent || "—")}</td><td class="num">${r.reacted}/${r.tracks}</td><td class="num">${r.saves}</td><td class="num">${r.replays}</td><td class="num">${r.rejections}</td><td>${esc(r.provider)}</td><td>${esc(cap1(r.state))}</td></tr>`).join("")}
  </tbody></table></div>
  <div class="history-cards">${rows.map((r) => `<a class="hcard" href="#/capsule/${esc(r.capsule_id)}" data-tier="${esc(r.tier)}"><span class="row"><span class="badge tier-badge">${esc(r.tier_label)}</span><span>${esc(r.intent || "Surprise")}</span></span>
    <small>${date(r.date)}</small><small>${r.reacted}/${r.tracks} reacted · ${r.saves} saved · ${r.replays} replayed · ${r.rejections} rejected</small><small>${esc(cap1(r.state))}</small></a>`).join("")}</div>`;
}
async function viewHistory() {
  const h = await api("history");
  if (!h.capsules.length) return `<h1>History</h1><div style="margin-top:18px">${empty("history", "No capsule history", "Your first capsule will appear here.", S.state.has_dna ? `<a class="btn btn-primary" href="#/capsules">Open a capsule</a>` : "")}</div>`;
  return `<div class="page-head"><div><h1>History</h1><p>Every capsule you've opened, what you did with it, and what you discovered.</p></div>
    <a class="btn btn-sm btn-ghost" href="/api/v3/export/history" download>Export</a></div>
  <section class="card" aria-labelledby="disc-title"><div class="card-head"><h2 id="disc-title">New discoveries</h2><span class="faint">${h.discoveries.length}</span></div>
    ${h.discoveries.length ? `<div class="chips">${h.discoveries.map((d) => `<a class="chip" href="#/capsule/${esc(d.capsule_id)}">${esc(d.title)} · <span class="muted">&nbsp;${esc(d.artist)}</span></a>`).join("")}</div>` : `<p class="muted">Nothing yet. Love, save or replay something by an artist outside your history and it shows up here.</p>`}
    <p class="faint" style="margin-top:10px;font-size:12.5px">${esc(h.discovery_definition)}</p></section>
  <section class="card" style="margin-top:16px"><h2 class="sr-only">All capsules</h2>${historyCards(h.capsules)}</section>`;
}

/* ------------------------------------------------------------------ sources */
const BADGE = { LIVE_CONNECTION: ["live", "Live connection"], IMPORT: ["import", "Import"], REQUIRES_SETUP: ["setup", "Requires setup"], COMING_SOON: ["soon", "Coming soon"], AVAILABLE: ["import", "Available"] };
function providerGrid(cards, onboarding = false) {
  const order = (c) => (c.state === "connected" ? 0 : c.state === "imported" ? 1 : c.state === "configured" ? 2 : c.badge === "COMING_SOON" ? 9 : 3);
  const list = [...cards].sort((a, b) => order(a) - order(b));
  return `<div class="provider-grid">${list.map((c) => providerCard(c, onboarding)).join("")}</div>`;
}
function providerCard(c, onboarding) {
  let [bc, bl] = BADGE[c.badge] || ["import", c.badge];
  // Capability, not state: never let "live" read as "connected" when it isn't.
  if (c.badge === "LIVE_CONNECTION" && c.state !== "connected" && c.state !== "configured") bl = "Can connect live";
  const stateBadge = c.state === "connected" ? `<span class="badge connected">Connected</span>` : c.state === "imported" ? `<span class="badge imported">Imported</span>` : c.state === "configured" ? `<span class="badge live">Configured</span>` : "";
  const st = c.stats;
  const meta = st ? `<div class="provider-meta"><b>${n(st.events)}</b> events · <b>${n(st.rows)}</b> rows${c.last_synced ? ` · ${c.state === "connected" ? "synced" : "imported"} ${esc(ago(c.last_synced))}` : ""}</div>` : "";
  const acts = [];
  if (c.id === "spotify" && c.can_connect) acts.push(`<a class="btn btn-sm btn-primary" href="/spotify/login?next=v3">Connect</a>`);
  if (c.id === "lastfm" && c.can_connect) acts.push(`<button class="btn btn-sm" data-act="lastfm-setup">Set up live sync</button>`);
  if (c.can_sync) acts.push(`<button class="btn btn-sm" data-act="sync" data-provider="${esc(c.id)}">${icon("sync")} Sync</button>`);
  if (c.can_import) acts.push(`<label class="btn btn-sm file-btn ${c.state === "not_connected" && !c.can_connect ? "btn-primary" : ""}">${icon("upload")} ${c.state === "imported" ? "Re-import" : "Import"}<input type="file" data-act="import" data-provider="${esc(c.id)}" accept=".json,.csv,.html,.htm,.tsv,.txt" aria-label="Import ${esc(c.label)} export file"></label>`);
  if (!onboarding && (c.state === "connected" || c.state === "configured") && (c.id === "spotify" || c.id === "lastfm")) acts.push(`<button class="btn btn-sm btn-ghost" data-act="disconnect" data-provider="${esc(c.id)}" data-label="${esc(c.label)}">Disconnect</button>`);
  if (!onboarding && c.stats) acts.push(`<button class="btn btn-sm btn-ghost" data-act="remove" data-provider="${esc(c.id)}" data-label="${esc(c.label)}">Remove data</button>`);
  return `<article class="provider ${c.state === "connected" || c.state === "imported" ? "is-active" : ""}" aria-labelledby="pv-${esc(c.id)}">
    <div class="provider-head"><div><div class="provider-name" id="pv-${esc(c.id)}">${esc(c.label)}</div>${c.account ? `<div class="provider-meta">${esc(c.account)}</div>` : ""}</div>
      <div class="row" style="gap:6px;justify-content:flex-end">${stateBadge}<span class="badge ${bc}">${esc(bl)}</span></div></div>
    ${meta}
    <p class="how">${esc(c.how_to)}</p>
    ${c.note ? `<p class="note">${esc(c.note)}</p>` : ""}
    ${c.error ? `<p class="err" role="alert">${esc(c.error)}</p>` : ""}
    ${c.id === "lastfm" ? `<form class="stack" data-form="lastfm" hidden><div class="field"><label for="lf-user">Last.fm username</label><input class="input" id="lf-user" name="username" autocomplete="username" required></div>
      <div class="field"><label for="lf-key">API key <span class="faint">(free at last.fm/api)</span></label><input class="input" id="lf-key" name="api_key" autocomplete="off"></div>
      <button class="btn btn-sm btn-primary">Save and sync</button><p class="faint" style="font-size:12px">Stored only in outputs/local_config.json on this computer.</p></form>` : ""}
    ${acts.length ? `<div class="provider-actions">${acts.join("")}</div>` : ""}
  </article>`;
}
function bindSources(root, onboarding) {
  root.addEventListener("change", async (ev) => {
    const input = ev.target.closest('input[type="file"][data-act="import"]');
    if (!input || !input.files.length) return;
    const fd = new FormData();
    fd.append("provider", input.dataset.provider);
    fd.append("file", input.files[0]);
    const label = input.closest("label");
    label.classList.add("is-busy"); label.setAttribute("aria-busy", "true");
    try {
      const { import: r } = await api("sources/import", { method: "POST", form: fd });
      toast(`${r.label}: imported ${n(r.events)} listening events (${n(r.rows)} rows).${(r.notes || []).length ? " " + r.notes.join(" ") : ""}`, "ok");
      if (!onboarding) S.sourcesDirty = true;
      route();
    } catch (e) { showError(e); label.removeAttribute("aria-busy"); input.value = ""; }
  });
  root.addEventListener("click", async (ev) => {
    const b = ev.target.closest("[data-act]");
    if (!b) return;
    const p = b.dataset.provider;
    try {
      if (b.dataset.act === "sync") {
        b.disabled = true; b.innerHTML = `<span class="pulse-dot" aria-hidden="true"></span> Syncing…`;
        const { sync } = await api(`sources/${p}/sync`, { method: "POST", body: {} });
        toast(`${sync.label} synced: ${n(sync.events)} listening events.`, "ok");
        S.sourcesDirty = true; route();
      } else if (b.dataset.act === "lastfm-setup") {
        const f = $('[data-form="lastfm"]', b.closest(".provider")); f.hidden = false; $("input", f).focus(); b.hidden = true;
      } else if (b.dataset.act === "disconnect") {
        if (!(await confirmDialog(`Disconnect ${b.dataset.label}?`, "Live syncing stops. Data you already synced stays in your DNA until you remove it.", "Disconnect"))) return;
        await api(`sources/${p}/disconnect`, { method: "POST", body: { confirm: true } });
        toast(`${b.dataset.label} disconnected.`, "ok"); route();
      } else if (b.dataset.act === "remove") {
        if (!(await confirmDialog(`Remove ${b.dataset.label} data?`, "This deletes the imported copy on this computer. Your original export file and your account are not touched. Rebuild your DNA afterwards.", "Remove data"))) return;
        await api(`sources/${p}/remove`, { method: "POST", body: { confirm: true } });
        toast(`${b.dataset.label} data removed.`, "ok"); S.sourcesDirty = true; route();
      }
    } catch (e) { showError(e); route(); }
  });
  root.addEventListener("submit", async (ev) => {
    const f = ev.target.closest('[data-form="lastfm"]');
    if (!f) return;
    ev.preventDefault();
    const data = Object.fromEntries(new FormData(f));
    try {
      await api("sources/lastfm/credentials", { method: "POST", body: data });
      const { sync } = await api("sources/lastfm/sync", { method: "POST", body: {} });
      toast(`Last.fm synced: ${n(sync.events)} scrobbles.`, "ok"); S.sourcesDirty = true; route();
    } catch (e) { showError(e); route(); }
  });
}
async function viewSources(m, params) {
  const [src, st] = [await api("sources"), await refresh()];
  if (params.get("spotify") === "connected") toast("Spotify connected. Sync to pull your listening.", "ok");
  if (params.get("spotify") === "failed") toast("Spotify connection didn't complete. Nothing was changed; try again.", "error");
  const d = st.dna;
  const rawRows = src.active.reduce((a, s) => a + (s.rows || 0), 0);
  const rawEvents = src.active.reduce((a, s) => a + (s.events || 0), 0);
  const unified = d && !d.demo ? `<section class="card" aria-labelledby="uni-title"><div class="card-head"><h2 id="uni-title">Unified Music DNA</h2>
      <button class="btn btn-sm ${S.sourcesDirty ? "btn-signal" : ""}" data-act="rebuild">${icon("sync")} ${S.sourcesDirty ? "Rebuild DNA with changes" : "Rebuild DNA"}</button></div>
    <div class="unified">
      <div class="stat"><b>${n(d.stats.raw_events)}</b><span>listening events</span><small>Every play counted, across all sources</small></div>
      <div class="stat"><b>${n(d.stats.unique_tracks)}</b><span>unique tracks</span><small>After merging duplicates across services</small></div>
      <div class="stat"><b>${n(d.stats.artists)}</b><span>artists</span><small>Distinct artist names</small></div>
      <div class="stat"><b>${d.stats.source_count}</b><span>sources</span><small>${d.stats.cross_service_matches ? `${n(d.stats.cross_service_matches)} tracks found on more than one` : "No cross-service matches yet"}</small></div>
    </div>
    ${d.stats.cross_service_matches && advanced() ? `<p style="margin-top:12px"><a class="link-btn" href="#/settings/advanced/identity">How tracks were matched across services</a></p>` : ""}
    ${S.sourcesDirty ? `<p class="faint" style="margin-top:12px">Your sources changed (${n(rawEvents)} events in ${n(rawRows)} rows now). Rebuild to update your DNA.</p>` : ""}</section>` : "";
  return `<div class="page-head"><div><h1>Sources</h1><p>Your music is fragmented across services. Connect or import each one; Music DNA merges them into one private profile.</p></div></div>
    ${st.dna?.demo ? `<div class="notice demo" style="margin-bottom:16px"><span class="badge demo">Demo</span><div><b>Demo mode is on</b><p>Import or connect a source below and your DNA switches to your real listening.</p></div></div>` : ""}
    ${!src.active_count && !st.dna?.demo ? `<div style="margin-bottom:16px">${empty("sources", "No sources connected", "Connect or import at least one music source to build your DNA.")}</div>` : ""}
    ${unified}
    <section style="margin-top:16px" aria-label="Music services" id="provider-section">${providerGrid(src.cards)}</section>
    <p class="faint" style="margin-top:16px;font-size:12.5px">Live connections are read-only. Imports stay on this computer. A new import from the same service replaces the previous one; importing the identical file twice is detected and ignored.</p>`;
}
viewSources.after = () => {
  const main = root();
  bindSources(main, false);
  main.addEventListener("click", async (ev) => {
    const b = ev.target.closest('[data-act="rebuild"]');
    if (!b) return;
    if (S.state.dna?.demo) await api("demo", { method: "POST", body: { enable: false } });
    S.sourcesDirty = false;
    rebuild(b);
  });
};

/* ------------------------------------------------------------------ settings */
const PROVIDERS = { spotify: "Spotify", apple_music: "Apple Music", youtube_music: "YouTube Music", deezer: "Deezer", tidal: "TIDAL", soundcloud: "SoundCloud" };
async function viewSettings() {
  const { settings: s } = await api("settings");
  S.settings = s;
  const fb = s.fallback_order.filter((p) => p !== s.preferred_provider);
  const avail = Object.keys(PROVIDERS).filter((p) => p !== s.preferred_provider && !fb.includes(p));
  return `<div class="page-head"><div><h1>Settings</h1><p>Playback, motion, privacy and advanced tools.</p></div></div>
  <div class="grid grid-2">
  <section class="card" aria-labelledby="pb-title"><h2 id="pb-title">Playback</h2>
    <p class="muted" style="margin:6px 0 14px">Where tracks open. We try your preferred service first, then the fallbacks in order, and always say when we're searching instead of opening an exact match.</p>
    <div class="field"><label for="pref">Preferred service</label><select class="input" id="pref" data-set="preferred_provider">${Object.entries(PROVIDERS).map(([k, v]) => `<option value="${k}" ${k === s.preferred_provider ? "selected" : ""}>${v}</option>`).join("")}</select></div>
    <p class="eyebrow" style="margin:16px 0 8px">Fallbacks</p>
    <ol class="fallbacks">${fb.map((p, i) => `<li><span>${i + 1}. ${PROVIDERS[p]}</span>
      <button class="btn btn-sm btn-ghost" data-act="fb-up" data-p="${p}" ${i === 0 ? "disabled" : ""} aria-label="Move ${PROVIDERS[p]} up">${icon("up")}</button>
      <button class="btn btn-sm btn-ghost" data-act="fb-down" data-p="${p}" ${i === fb.length - 1 ? "disabled" : ""} aria-label="Move ${PROVIDERS[p]} down">${icon("down")}</button>
      <button class="btn btn-sm btn-ghost" data-act="fb-rm" data-p="${p}" aria-label="Remove ${PROVIDERS[p]}">Remove</button></li>`).join("") || '<li><span class="faint">No fallbacks. Only your preferred service is used.</span></li>'}</ol>
    ${avail.length ? `<div class="row" style="margin-top:10px"><select class="input" id="fb-add" aria-label="Add a fallback service" style="flex:1">${avail.map((p) => `<option value="${p}">${PROVIDERS[p]}</option>`).join("")}</select><button class="btn btn-sm" data-act="fb-add">Add</button></div>` : ""}
    <p class="faint" style="font-size:12.5px;margin-top:12px">Applies to capsules you open from now on.</p>
  </section>
  <section class="card" aria-labelledby="gen-title"><h2 id="gen-title">Experience</h2>
    <div class="settings-list">
      <div class="setting"><div><b id="motion-l">Motion</b><small>“System” follows your device's reduced-motion setting.</small></div>
        <div class="segmented" role="radiogroup" aria-labelledby="motion-l">${["system", "reduced", "full"].map((m) => `<button role="radio" aria-checked="${s.motion === m}" data-act="motion" data-value="${m}">${cap1(m)}</button>`).join("")}</div></div>
      <label class="setting switch"><div><b>Local analytics</b><small>Private product events kept on this computer (no titles or artists).</small></div><input type="checkbox" data-set="analytics_enabled" ${s.analytics_enabled ? "checked" : ""}></label>
      <label class="setting switch"><div><b>Advanced mode</b><small>Show technical details, diagnostics and the Quality Lab.</small></div><input type="checkbox" data-set="advanced_mode" ${s.advanced_mode ? "checked" : ""}></label>
    </div>
  </section></div>
  <section class="card" style="margin-top:16px"><div class="nav-list">
    <a href="#/settings/privacy"><span><b>Privacy &amp; Data</b><small>What stays local, exports and deletion</small></span>${icon("lock")}</a>
    <a href="#/settings/advanced"><span><b>Advanced</b><small>Recommendation Quality, beta dashboard, identity graph, diagnostics</small></span>${icon("arrow")}</a>
    <a href="/classic"><span><b>Classic workspace (2.x)</b><small>The previous power-user interface: presets, genre controls, reports</small></span>${icon("external")}</a>
    <a href="#/welcome"><span><b>Replay onboarding</b><small>See the welcome flow again</small></span>${icon("arrow")}</a>
  </div></section>`;
}
viewSettings.after = () => {
  const main = root();
  const save = async (changes, msg) => {
    try { const { settings } = await api("settings", { method: "POST", body: changes }); S.settings = settings; applyMotion(); if (msg) toast(msg, "ok"); route(); }
    catch (e) { showError(e); }
  };
  main.addEventListener("change", (ev) => {
    const el = ev.target.closest("[data-set]");
    if (!el) return;
    const v = el.type === "checkbox" ? el.checked : el.value;
    const ch = { [el.dataset.set]: v };
    if (el.dataset.set === "preferred_provider") ch.fallback_order = S.settings.fallback_order.filter((p) => p !== v);
    save(ch, "Saved.");
  });
  main.addEventListener("click", (ev) => {
    const b = ev.target.closest("[data-act]");
    if (!b) return;
    const fb = S.settings.fallback_order.filter((p) => p !== S.settings.preferred_provider);
    const i = fb.indexOf(b.dataset.p);
    if (b.dataset.act === "motion") save({ motion: b.dataset.value });
    if (b.dataset.act === "fb-up" && i > 0) { [fb[i - 1], fb[i]] = [fb[i], fb[i - 1]]; save({ fallback_order: fb }); }
    if (b.dataset.act === "fb-down" && i < fb.length - 1) { [fb[i + 1], fb[i]] = [fb[i], fb[i + 1]]; save({ fallback_order: fb }); }
    if (b.dataset.act === "fb-rm") save({ fallback_order: fb.filter((p) => p !== b.dataset.p) });
    if (b.dataset.act === "fb-add") save({ fallback_order: [...fb, $("#fb-add").value] });
  });
};

async function viewPrivacy() {
  const p = await api("privacy");
  const fmtB = (b) => (b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : b > 1e3 ? `${Math.round(b / 1e3)} KB` : `${b} B`);
  return `<div class="page-head"><div><p class="eyebrow"><a href="#/settings" class="link-btn">Settings</a> /</p><h1>Privacy &amp; Data</h1><p>Privacy is part of the product. Here is exactly what exists, where, and how to remove it.</p></div></div>
  <div class="grid grid-2">
    <section class="card privacy-sec"><h3>What stays local</h3><p>${esc(p.stays_local)}</p><p style="margin-top:8px">${esc(p.network_calls)}</p></section>
    <section class="card privacy-sec"><h3>What is imported</h3>${p.imported.length ? `<dl class="kv" style="margin-top:8px">${p.imported.map((i) => `<dt>${esc(i.label)}</dt><dd>${esc(i.file)} · ${fmtB(i.bytes)}</dd>`).join("")}</dl>` : '<p>Nothing imported.</p>'}</section>
    <section class="card privacy-sec"><h3>What is stored</h3><dl class="kv" style="margin-top:8px">
      <dt>Music DNA</dt><dd>${p.stored.music_dna.exists ? fmtB(p.stored.music_dna.bytes) : "Not built"}</dd>
      <dt>Capsules</dt><dd>${p.stored.capsules.count}</dd>
      <dt>Reactions</dt><dd>${p.stored.feedback.count}</dd>
      <dt>Analytics events</dt><dd>${p.stored.analytics_events.count}</dd></dl></section>
    <section class="card privacy-sec"><h3>What analytics contain</h3><p><b>${p.analytics.enabled ? "On" : "Off"}</b> · local only. ${esc(p.analytics.contains)}</p><p style="margin-top:8px"><b>Never:</b> ${esc(p.analytics.never_contains)}</p></section>
  </div>
  <section class="card" style="margin-top:16px"><h2>Export</h2><p class="muted" style="margin:6px 0 14px">Download your data as JSON.</p>
    <div class="row"><a class="btn btn-sm" href="/api/v3/export/dna" download>Export my Music DNA</a><a class="btn btn-sm" href="/api/v3/export/history" download>Export history</a>
      <a class="btn btn-sm" href="/api/v3/export/feedback" download>Export feedback</a><a class="btn btn-sm" href="/api/v3/export/analytics" download>Export analytics</a></div></section>
  <section class="card" style="margin-top:16px"><h2>What can be deleted</h2><p class="muted" style="margin:6px 0 14px">Each action asks for confirmation. Imported listening history is never deleted here; remove a source's data on the Sources page.</p>
    <div class="settings-list">
      ${[["reset_session", "Reset session taste", "Forget this session's short-term reactions. Core DNA is untouched.", "Reset"],
         ["delete_history", "Delete capsule history", "Removes past capsules. Learned preferences stay.", "Delete"],
         ["reset_dna", "Reset Music DNA", "Removes everything learned from your reactions and the DNA snapshot. Imports stay; rebuild afterwards.", "Reset"],
         ["delete_analytics", "Delete analytics", "Removes local analytics events.", "Delete"]].map(([a, t, d, l]) =>
        `<div class="setting"><div><b>${t}</b><small>${d}</small></div><button class="btn btn-sm btn-danger" data-act="priv" data-action="${a}" data-title="${t}" data-desc="${d}" data-label="${l}">${l}</button></div>`).join("")}
      <div class="setting"><div><b>Disconnect a provider</b><small>Manage live connections and imported data per service.</small></div><a class="btn btn-sm" href="#/sources">Sources</a></div>
    </div></section>`;
}
viewPrivacy.after = () => {
  root().addEventListener("click", async (ev) => {
    const b = ev.target.closest('[data-act="priv"]');
    if (!b) return;
    if (!(await confirmDialog(`${b.dataset.title}?`, b.dataset.desc, b.dataset.label))) return;
    try {
      const { result } = await api(`privacy/${b.dataset.action}`, { method: "POST", body: { confirm: true } });
      toast(result.note || "Done.", "ok"); await refresh(); route();
    } catch (e) { showError(e); }
  });
};

async function viewAdvanced(m) {
  const tab = (m && m[1]) || "quality";
  const tabs = [["quality", "Recommendation Quality"], ["beta", "Beta dashboard"], ["identity", "Identity graph"], ["diagnostics", "Diagnostics"]];
  const data = await api(`advanced/${tab}`);
  let body = "";
  const metric = (name, v, def, fmt = pct) => `<div class="metric"><span class="name">${esc(name)}</span><b>${v == null ? "—" : fmt(v)}</b><small>${esc(def)}</small></div>`;
  if (tab === "quality") {
    const L = data.latest, D = data.definitions;
    body = `<div class="notice warn"><div><b>Proxy metrics</b><p>${esc(data.caveat)}</p></div></div>
      ${L ? `<h2 style="margin:18px 0 12px">${esc(cap1(L.label))} <span class="faint">· ${L.count} tracks</span></h2><div class="metric-grid">
        ${metric("Relevance proxy", L.relevance_proxy, D.relevance_proxy)}${metric("Diversity", L.diversity, D.diversity)}${metric("Novelty", L.novelty, D.novelty)}
        ${metric("Coverage", L.catalog_coverage, D.catalog_coverage)}${metric("Artist concentration", L.artist_concentration, D.artist_concentration, (v) => v.toFixed(2))}
        ${metric("Context fit", L.context_fit, D.context_fit)}${metric("Calibration", L.calibration, D.calibration)}</div>` : `<p class="muted" style="margin-top:14px">Open a capsule to evaluate it.</p>`}
      <h2 style="margin:22px 0 12px">Outcomes by tier and context</h2>
      ${data.outcomes.length ? `<div class="table-wrap"><table class="data"><thead><tr><th>Tier</th><th>Context</th><th class="num">Capsules</th><th class="num">Completion</th><th class="num">Save</th><th class="num">Replay</th><th class="num">Reject</th></tr></thead><tbody>
        ${data.outcomes.map((o) => `<tr><td>${esc(cap1(o.rarity))}</td><td>${esc(o.task || "—")}</td><td class="num">${o.sessions}</td><td class="num">${pct(o.completion_rate)}</td><td class="num">${pct(o.save_rate)}</td><td class="num">${pct(o.replay_rate)}</td><td class="num">${pct(o.rejection_rate)}</td></tr>`).join("")}</tbody></table></div>` : `<p class="muted">No completed capsules yet.</p>`}`;
  } else if (tab === "beta") {
    const f = data.funnel;
    const bd = (key, title) => {
      const rows = Object.entries(data.breakdowns[key] || {});
      return `<h3 style="margin:18px 0 8px">${title}</h3>${rows.length ? `<div class="table-wrap"><table class="data"><thead><tr><th>${title}</th><th class="num">Opened</th><th class="num">Started</th><th class="num">Completed</th><th class="num">Completion</th><th class="num">Save</th><th class="num">Replay</th><th class="num">Reject</th></tr></thead><tbody>
        ${rows.map(([k, r]) => `<tr><td>${esc(k)}</td><td class="num">${r.opened}</td><td class="num">${r.started}</td><td class="num">${r.completed}</td><td class="num">${pct(r.completion_rate)}</td><td class="num">${pct(r.save_rate)}</td><td class="num">${pct(r.replay_rate)}</td><td class="num">${pct(r.rejection_rate)}</td></tr>`).join("")}</tbody></table></div>` : '<p class="faint">No data yet.</p>'}`;
    };
    const cOpen = f.capsule_opened.sessions, cStart = f.capsule_started.sessions, cDone = f.capsule_completed.sessions;
    body = `<div class="notice"><div><b>Local-only beta analytics · ${data.enabled ? "on" : "off"}</b><p>Your stable experiment variant is <b>${esc(data.variant)}</b> (${esc(data.algorithm_version)}). ${esc(data.definitions.track_played)}</p></div></div>
      <div class="metric-grid" style="margin-top:16px">
        ${metric("Sessions", data.sessions, "App sessions on this device", n)}${metric("Returning users (proxy)", data.retention.return_rate, `${data.retention.returned_users}/${data.retention.users} came back within ${data.retention.window_days} days. ${data.definitions.returning_users_proxy}`)}
        ${metric("Capsules opened", cOpen, "Sessions that opened a capsule", n)}${metric("Capsules started", cStart, "Sessions that reacted to or opened a track", n)}
        ${metric("Capsules completed", cDone, "Sessions with a completed capsule", n)}${metric("Completion rate", f.capsule_completed.session_rate, "Completed ÷ all sessions")}
      </div>
      ${bd("capsule_rarity", "Capsule tier")}${bd("context", "Context")}${bd("provider", "Provider")}${bd("algorithm_variant", "Experiment variant")}`;
  } else if (tab === "identity") {
    body = `<div class="notice"><div><b>${n(data.cross_service_tracks)} tracks found on more than one service</b><p>${esc(data.policy)}</p></div></div>
      <div class="chips" style="margin:14px 0">${Object.entries(data.methods).map(([k, v]) => `<span class="chip">${esc(k)} · ${v}</span>`).join("")}</div>
      ${data.tracks.length ? `<div class="table-wrap"><table class="data"><thead><tr><th>Track</th><th>Found across</th><th>Matched by</th><th>Confidence</th></tr></thead><tbody>
        ${data.tracks.map((t) => `<tr><td>${esc(t.title)} <span class="muted">· ${esc(t.artist)}</span></td><td>${esc(t.found_on.join(", "))}</td><td>${esc(t.method)}</td><td>${esc(t.confidence)}</td></tr>`).join("")}</tbody></table></div>` : `<p class="muted">Import a second service to see cross-service matches.</p>`}`;
  } else {
    body = `<dl class="kv"><dt>Version</dt><dd>${esc(data.version)}</dd><dt>Data folder</dt><dd class="mono">${esc(data.outputs)}</dd></dl>
      <h3 style="margin:18px 0 8px">Recent issues</h3>${data.diagnostics.length ? `<pre class="code">${esc(data.diagnostics.map((d) => `${d.ts}  ${d.code}  ${d.message}${d.detail ? "\n    " + (typeof d.detail === "string" ? d.detail.split("\n").slice(-3).join("\n    ") : JSON.stringify(d.detail)) : ""}`).join("\n"))}</pre>` : '<p class="muted">No issues recorded.</p>'}`;
  }
  return `<div class="page-head"><div><p class="eyebrow"><a href="#/settings" class="link-btn">Settings</a> /</p><h1>Advanced</h1><p>Engineering views. They don't affect your recommendations.</p></div></div>
    <div class="tabs" role="tablist">${tabs.map(([k, l]) => `<button role="tab" aria-selected="${k === tab}" data-href="#/settings/advanced/${k}">${l}</button>`).join("")}</div>
    <section class="card">${body}</section>`;
}
viewAdvanced.after = () => {
  root().addEventListener("click", (ev) => { const b = ev.target.closest("[data-href]"); if (b) location.hash = b.dataset.href; });
};

function viewNotFound() {
  return `<h1>Page not found</h1><p class="muted" style="margin:10px 0 18px">That page doesn't exist.</p><a class="btn" href="#/">Home</a>`;
}

/* ------------------------------------------------------------------ boot */
window.addEventListener("hashchange", route);
window.addEventListener("offline", () => toast("You're offline. Local features still work; syncing will wait.", "error"));
route();

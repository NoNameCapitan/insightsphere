// Music DNA map — an orbital "taste structure", not a pie chart.
//
// Encoding (every visual property carries data):
//   nucleus            total listening events
//   family node        genre family; distance to the nucleus = 1 - affinity,
//                      node size = affinity, spoke width = affinity
//   satellites         genres (filled) and microgenres (ring) of that family;
//                      size = genre affinity
//   outer ring nodes   top artists, tethered to their dominant family;
//                      size = artist affinity (play share)
// Idle motion is limited to the decorative orbit rings; nodes and labels
// never move, so the map stays readable (and fully static under reduced motion).

const C = 400;
const cache = new Map();

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pct = (v) => `${Math.round((v || 0) * 100)}%`;
const fmt = (n) => (n >= 10000 ? `${Math.round(n / 1000)}k` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n ?? 0));

function layout(dna, compact) {
  const key = `${dna.generated_at}|${compact}`;
  if (cache.has(key)) return cache.get(key);
  const families = (dna.families || []).slice(0, 8);
  const n = Math.max(1, families.length);
  const offset = -Math.PI / 2 + (n % 2 ? 0 : Math.PI / n);
  const fams = families.map((f, i) => {
    const a = offset + (i * 2 * Math.PI) / n;
    const r = 150 + (1 - f.affinity) * 105;
    const size = 15 + 21 * Math.sqrt(f.affinity);
    return { ...f, a, r, size, x: C + Math.cos(a) * r, y: C + Math.sin(a) * r };
  });
  const byFam = Object.fromEntries(fams.map((f) => [f.id, f]));
  const sats = [];
  for (const f of fams) {
    const gs = (dna.genres || []).filter((g) => g.family === f.id && g.kind !== "family").slice(0, compact ? 4 : 6);
    gs.forEach((g, j) => {
      const spread = (j - (gs.length - 1) / 2) * 0.5;
      const d = f.size + 20 + (j % 2) * 16;
      const a = f.a + spread;
      sats.push({ ...g, fam: f.id, x: f.x + Math.cos(a) * d, y: f.y + Math.sin(a) * d, s: 2.8 + 5 * Math.sqrt(g.affinity), a });
    });
  }
  const artists = (dna.artists || []).slice(0, compact ? 10 : 18);
  const perFam = {};
  artists.forEach((ar) => { const k = byFam[ar.family] ? ar.family : "_"; (perFam[k] = perFam[k] || []).push(ar); });
  const arts = [];
  Object.entries(perFam).forEach(([k, list], gi) => {
    const f = byFam[k];
    list.forEach((ar, j) => {
      const base = f ? f.a : offset + Math.PI / n + (gi * 2 * Math.PI) / n;
      const a = base + (j - (list.length - 1) / 2) * 0.17;
      const r = 345 - (j % 2) * 16;
      arts.push({ ...ar, fam: f ? f.id : null, a, x: C + Math.cos(a) * r, y: C + Math.sin(a) * r, s: 2.6 + 4.6 * Math.sqrt(ar.affinity) });
    });
  });
  const out = { fams, sats, arts };
  cache.set(key, out);
  return out;
}

function anchor(a) {
  const c = Math.cos(a);
  return c > 0.3 ? "start" : c < -0.3 ? "end" : "middle";
}

export function renderDNA(container, dna, opts = {}) {
  const { compact = false, changed = [], onSelect = null, label = "Music DNA map", illustration = false } = opts;
  const { fams, sats, arts } = layout(dna, compact);
  const changedFams = new Set(sats.filter((s) => changed.includes(s.name)).map((s) => s.fam));
  changed.forEach((c) => fams.forEach((f) => { if (f.genres?.includes(c)) changedFams.add(f.id); }));
  const events = dna.stats?.raw_events ?? 0;

  const parts = [];
  parts.push(`<g aria-hidden="true">
    <circle class="orbit drift" cx="${C}" cy="${C}" r="150"/>
    <circle class="orbit drift-rev" cx="${C}" cy="${C}" r="255"/>
    <circle class="orbit drift" cx="${C}" cy="${C}" r="345"/>
  </g>`);
  parts.push(`<g aria-hidden="true">${fams.map((f) =>
    `<line class="spoke" data-fam="${esc(f.id)}" x1="${C}" y1="${C}" x2="${f.x.toFixed(1)}" y2="${f.y.toFixed(1)}" stroke-width="${(1 + 6 * f.affinity).toFixed(2)}"/>`).join("")}</g>`);
  parts.push(`<g aria-hidden="true">${arts.filter((a) => a.fam).map((a) => {
    const f = fams.find((x) => x.id === a.fam);
    return `<line class="tether" data-fam="${esc(a.fam)}" x1="${f.x.toFixed(1)}" y1="${f.y.toFixed(1)}" x2="${a.x.toFixed(1)}" y2="${a.y.toFixed(1)}"/>`;
  }).join("")}</g>`);
  parts.push(`<g aria-hidden="true">
    <circle class="nucleus-ring breathe" cx="${C}" cy="${C}" r="76" stroke-width="1.5"/>
    <circle class="nucleus-core" cx="${C}" cy="${C}" r="58"/>
    ${illustration ? "" : `<text x="${C}" y="${C + (compact ? 6 : 2)}" text-anchor="middle" class="fam-label" font-size="22">${esc(fmt(events))}</text>
    <text x="${C}" y="${C + (compact ? 32 : 22)}" text-anchor="middle" class="nucleus-sub" font-size="11">${compact ? "events" : "listening events"}</text>`}
  </g>`);
  parts.push(`<g aria-hidden="true">${sats.map((s) =>
    `<circle class="sat${s.kind === "microgenre" ? " micro" : ""}" data-fam="${esc(s.fam)}" cx="${s.x.toFixed(1)}" cy="${s.y.toFixed(1)}" r="${s.s.toFixed(1)}"><title>${esc(s.name)} · ${pct(s.affinity)}</title></circle>`).join("")}
    ${compact ? "" : sats.map((s) => `<text class="sat-label" data-fam="${esc(s.fam)}" x="${(s.x + Math.cos(s.a) * (s.s + 6)).toFixed(1)}" y="${(s.y + Math.sin(s.a) * (s.s + 6) + 4).toFixed(1)}" text-anchor="${anchor(s.a)}">${esc(s.name)}</text>`).join("")}
  </g>`);
  parts.push(`<g aria-hidden="true">${arts.map((a) =>
    `<circle class="artist" data-fam="${esc(a.fam || "")}" cx="${a.x.toFixed(1)}" cy="${a.y.toFixed(1)}" r="${a.s.toFixed(1)}"><title>${esc(a.name)} · ${a.plays} plays</title></circle>`).join("")}
    ${compact ? "" : arts.map((a) => `<text class="artist-label" data-fam="${esc(a.fam || "")}" x="${(a.x + Math.cos(a.a) * 10).toFixed(1)}" y="${(a.y + Math.sin(a.a) * 10 + 4).toFixed(1)}" text-anchor="${anchor(a.a)}">${esc(a.name)}</text>`).join("")}
  </g>`);
  parts.push(fams.map((f) => {
    const lx = f.x + Math.cos(f.a) * (f.size + 12);
    const ly = f.y + Math.sin(f.a) * (f.size + 12) + 5;
    const gl = (f.genres || []).slice(0, 4).join(", ");
    return `<g class="fam${changedFams.has(f.id) ? " changed" : ""}" data-fam="${esc(f.id)}" tabindex="0" role="button"
        aria-label="${esc(f.label)}: relative affinity ${pct(f.affinity)}. Genres: ${esc(gl) || "none"}.">
      <circle class="halo" cx="${f.x.toFixed(1)}" cy="${f.y.toFixed(1)}" r="${(f.size + 5).toFixed(1)}"/>
      <circle class="body" cx="${f.x.toFixed(1)}" cy="${f.y.toFixed(1)}" r="${f.size.toFixed(1)}" stroke-width="1.5"/>
      <text class="fam-label" data-fam="${esc(f.id)}" x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="${anchor(f.a)}">${esc(f.label)}</text>
    </g>`;
  }).join(""));

  const desc = `Taste map with ${fams.length} genre families around a nucleus of ${events} listening events. ` +
    fams.map((f) => `${f.label} ${pct(f.affinity)}`).join(", ") + ".";
  container.innerHTML = `<svg class="dna-svg viz-enter${compact ? " compact" : ""}" viewBox="-40 -40 880 880" role="group" aria-label="${esc(label)}">
    <desc>${esc(desc)}</desc>${parts.join("")}</svg>`;
  const svg = container.querySelector("svg");
  let selected = null;

  const focusFam = (id) => {
    svg.classList.toggle("has-focus", !!id);
    svg.querySelectorAll("[data-fam]").forEach((el) => el.classList.toggle("is-related", !!id && el.dataset.fam === id));
    svg.querySelectorAll(".fam").forEach((el) => el.classList.toggle("is-selected", el.dataset.fam === selected));
  };
  const pick = (id) => {
    selected = selected === id ? null : id;
    focusFam(selected);
    if (onSelect) onSelect(selected ? fams.find((f) => f.id === selected) : null, dna);
  };
  svg.querySelectorAll(".fam").forEach((g) => {
    const id = g.dataset.fam;
    g.addEventListener("mouseenter", () => focusFam(id));
    g.addEventListener("mouseleave", () => focusFam(selected));
    g.addEventListener("focus", () => focusFam(id));
    g.addEventListener("blur", () => focusFam(selected));
    g.addEventListener("click", () => pick(id));
    g.addEventListener("keydown", (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); pick(id); } });
  });
  svg.querySelectorAll(".artist").forEach((c) => {
    if (!c.dataset.fam) return;
    c.addEventListener("mouseenter", () => focusFam(c.dataset.fam));
    c.addEventListener("mouseleave", () => focusFam(selected));
  });
  return { select: pick, fams };
}

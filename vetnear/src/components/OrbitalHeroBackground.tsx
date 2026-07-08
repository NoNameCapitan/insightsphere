// Decorative orbital background for the homepage hero — an abstract, premium
// take on the product's "search radius" ring motif. Pure static markup + CSS
// keyframes (see globals.css "Orbital hero background"): no canvas, no JS,
// no re-renders. The layer is aria-hidden and pointer-events-none, sits behind
// the hero content (-z-10) and fades out toward its edges, so it can never
// block clicks, reduce readability or shift layout. prefers-reduced-motion
// renders it as a calm static decoration.
export function OrbitalHeroBackground() {
  return (
    <div
      aria-hidden
      className="orbital-bg pointer-events-none absolute inset-x-0 top-0 -z-10 h-[640px] overflow-hidden"
    >
      <div className="orbital-bg__system">
        {/* Central soft glow — the "sun", barely there. */}
        <span className="orbital-bg__core" />

        {/* Thin concentric orbit lines. */}
        <span className="orbital-bg__ring orbital-bg__ring--1" />
        <span className="orbital-bg__ring orbital-bg__ring--2" />
        <span className="orbital-bg__ring orbital-bg__ring--3" />
        <span className="orbital-bg__ring orbital-bg__ring--4" />
        <span className="orbital-bg__ring orbital-bg__ring--5" />

        {/* Small translucent bodies travelling along three of the orbits. */}
        <span className="orbital-bg__orbit orbital-bg__orbit--1">
          <i className="orbital-bg__planet orbital-bg__planet--teal" />
        </span>
        <span className="orbital-bg__orbit orbital-bg__orbit--2">
          <i className="orbital-bg__planet orbital-bg__planet--cream" />
        </span>
        <span className="orbital-bg__orbit orbital-bg__orbit--3">
          <i className="orbital-bg__planet orbital-bg__planet--teal-sm" />
        </span>
        <span className="orbital-bg__orbit orbital-bg__orbit--4">
          <i className="orbital-bg__planet orbital-bg__planet--rose" />
        </span>

        {/* Free-floating blurred spheres for layered depth. */}
        <span className="orbital-bg__sphere orbital-bg__sphere--1" />
        <span className="orbital-bg__sphere orbital-bg__sphere--2" />
        <span className="orbital-bg__sphere orbital-bg__sphere--3" />
        <span className="orbital-bg__sphere orbital-bg__sphere--4" />
      </div>
    </div>
  );
}

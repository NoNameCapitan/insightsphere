// Need-router uses per-user browser state (localStorage active pet). Render on
// demand rather than prerendering — matches the other interactive routes.
export const dynamic = "force-dynamic";

export default function SegmentLayout({ children }: { children: React.ReactNode }) {
  return children;
}

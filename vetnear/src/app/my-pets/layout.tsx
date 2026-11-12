import { PetsAccountGate } from "@/components/account/PetsAccountGate";

// These routes depend on per-user state (account session / browser cache).
// They are intentionally NOT pre-rendered, and the server HTML never contains
// personal data: cards are loaded by the browser from /api/pets, which
// enforces the session and Row Level Security.
export const dynamic = "force-dynamic";

export default function SegmentLayout({ children }: { children: React.ReactNode }) {
  return <PetsAccountGate>{children}</PetsAccountGate>;
}

"use client";

import { useState } from "react";

/**
 * "Продовжити з Google". A plain link to our own start route, so it works
 * without JavaScript and never opens a popup that can be blocked or closed.
 */
export function GoogleButton({ next, className = "" }: { next: string; className?: string }) {
  const [going, setGoing] = useState(false);
  return (
    <a
      href={`/api/auth/google?next=${encodeURIComponent(next)}`}
      onClick={() => setGoing(true)}
      aria-busy={going}
      className={`google-btn ${className}`}
    >
      <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5 shrink-0">
        <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.500a5.6 5.6 0 0 1-2.4 3.600v3h3.900c2.3-2.1 3.5-5.2 3.5-8.700Z" />
        <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.900l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.300v3.100A12 12 0 0 0 12 24Z" />
        <path fill="#FBBC05" d="M5.3 14.300a7.2 7.2 0 0 1 0-4.600V6.600H1.300a12 12 0 0 0 0 10.800l4-3.100Z" />
        <path fill="#EA4335" d="M12 4.800c1.8 0 3.3.6 4.6 1.800L20 3.100A12 12 0 0 0 1.3 6.600l4 3.100c.9-2.9 3.6-4.9 6.7-4.900Z" />
      </svg>
      {going ? "Відкриваємо Google…" : "Продовжити з Google"}
    </a>
  );
}

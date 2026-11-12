"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "@/lib/auth/client";

/** Header entry: "Увійти" for guests, "Акаунт" when signed in; hidden when accounts are off. */
export function AccountLink({ className = "" }: { className?: string }) {
  const session = useSession();
  const pathname = usePathname() ?? "/";
  if (!session?.configured) return null;
  const signedIn = Boolean(session.user);
  const active = pathname.startsWith("/account") || pathname.startsWith("/auth");
  return (
    <Link href={signedIn ? "/account" : "/auth"} aria-current={active ? "page" : undefined} className={`site-nav__link ${className}`}>
      {signedIn ? "Акаунт" : "Увійти"}
    </Link>
  );
}

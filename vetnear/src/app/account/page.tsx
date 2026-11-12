import type { Metadata } from "next";
import { AccountPanel } from "@/components/account/AccountPanel";

export const metadata: Metadata = { title: "Акаунт", robots: { index: false, follow: false } };

export default function AccountPage() {
  return (
    <div className="container-px mx-auto max-w-xl py-8">
      <AccountPanel />
    </div>
  );
}

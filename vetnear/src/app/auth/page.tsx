import type { Metadata } from "next";
import { AuthForm } from "@/components/account/AuthForm";
import { safeNextPath } from "@/lib/auth/shared";

export const metadata: Metadata = {
  title: "Вхід",
  robots: { index: false, follow: false },
};

export default async function AuthPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const params = await searchParams;
  return (
    <div className="container-px mx-auto max-w-md py-10">
      <div className="rounded-3xl border border-brand-100 bg-surface p-6 shadow-card sm:p-8">
        <AuthForm next={safeNextPath(params.next)} initialError={params.error} />
      </div>
    </div>
  );
}

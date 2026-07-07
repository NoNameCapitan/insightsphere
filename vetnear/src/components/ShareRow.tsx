"use client";

import { useState } from "react";
import { track } from "@/lib/analytics";
import { EXTERNAL_LINK_PROPS } from "@/lib/security/url";
import { buildShareLinks } from "@/lib/share";

export function ShareRow({ text, url }: { text: string; url: string }) {
  const links = buildShareLinks(text, url);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${text} ${url}`);
      setCopied(true);
      track("share_clicked", { network: "copy" });
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  const Btn = ({ href, label, net }: { href?: string; label: string; net: string }) =>
    href ? (
      <a
        href={href}
        {...EXTERNAL_LINK_PROPS}
        onClick={() => track("share_clicked", { network: net })}
        className="rounded-full border border-brand-100 px-3 py-1.5 text-sm text-ink/70 hover:border-brand hover:text-brand"
      >
        {label}
      </a>
    ) : null;

  return (
    <div className="flex flex-wrap gap-2">
      <Btn href={links.telegram} label="Telegram" net="telegram" />
      <Btn href={links.viber} label="Viber" net="viber" />
      <Btn href={links.facebook} label="Facebook" net="facebook" />
      <button
        onClick={copy}
        className="rounded-full border border-brand-100 px-3 py-1.5 text-sm text-ink/70 hover:border-brand hover:text-brand"
      >
        {copied ? "Скопійовано ✓" : "Копіювати"}
      </button>
    </div>
  );
}

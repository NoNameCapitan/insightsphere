"use client";
import { track } from "@/lib/analytics";
import { EXTERNAL_LINK_PROPS, safeUrl } from "@/lib/security/url";
import type { SocialLinks } from "@/lib/types";

const ICON: Record<keyof SocialLinks, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  telegram: "Telegram",
  tiktok: "TikTok",
  youtube: "YouTube",
  linkedin: "LinkedIn",
};

export function SocialRow({
  links,
  placeId,
}: {
  links?: SocialLinks;
  placeId?: string;
}) {
  if (!links) return null;
  const entries = (Object.keys(ICON) as (keyof SocialLinks)[])
    .map((k) => [k, safeUrl(links[k])] as const)
    .filter(([, url]) => !!url);
  if (!entries.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {entries.map(([key, url]) => (
        <a
          key={key}
          href={url}
          {...EXTERNAL_LINK_PROPS}
          onClick={() => track("social_link_clicked", { placeId, network: key })}
          className="rounded-full border border-brand-100 px-3 py-1 text-xs text-ink/70 hover:border-brand hover:text-brand"
        >
          {ICON[key]}
        </a>
      ))}
    </div>
  );
}

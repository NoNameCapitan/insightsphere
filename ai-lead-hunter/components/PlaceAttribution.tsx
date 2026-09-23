import type { Lead } from "@/lib/types";

export default function PlaceAttribution({ lead }: { lead: Lead }) {
  if (lead.source !== "google_places") return null;
  return (
    <p className="mt-2 text-xs font-normal not-italic tracking-normal text-[#5e5e5e]">
      Дані:{" "}
      <span translate="no" className="whitespace-nowrap">
        Google Maps
      </span>
      {lead.attributions?.map((a, i) => (
        <span key={`${a.provider}-${i}`}>
          {" · "}
          {a.providerUri && /^https?:\/\//i.test(a.providerUri) ? (
            <a
              href={a.providerUri}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              {a.provider}
            </a>
          ) : (
            a.provider
          )}
        </span>
      ))}
    </p>
  );
}

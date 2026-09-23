// Campaign persistence via localStorage. All functions are SSR-safe.

import { validateCampaigns } from "./backup";
import { businessKey } from "./leadIdentity";
import type {
  Campaign,
  Lead,
  LeadOutcome,
  LeadStatus,
  LeadVerification,
} from "./types";
import { makeId } from "./utils";

const KEY = "alh_campaigns_v1";

function read(): Campaign[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? validateCampaigns(JSON.parse(raw)) : [];
  } catch {
    throw new Error(
      "Не вдалося прочитати кампанії. Дані не перезаписано. Перевірте доступ до сховища або відновіть резервну копію.",
    );
  }
}
function write(campaigns: Campaign[]): void {
  if (typeof window === "undefined")
    throw new Error("Сховище доступне тільки в браузері.");
  try {
    window.localStorage.setItem(KEY, JSON.stringify(campaigns));
  } catch {
    throw new Error(
      "Не збережено: сховище браузера заповнене або заблоковане. Зробіть резервну копію.",
    );
  }
  window.dispatchEvent(new Event("alh-campaigns-changed"));
}
export function getCampaigns(): Campaign[] {
  return read();
}
export function importCampaigns(incoming: Campaign[]): Campaign[] {
  const current = read();
  const merged = [...current];
  for (const campaign of validateCampaigns(incoming)) {
    const index = merged.findIndex((c) => c.id === campaign.id);
    if (index < 0) merged.push(campaign);
    else {
      const keys = new Set(merged[index].leads.map(businessKey));
      merged[index] = {
        ...merged[index],
        leads: [
          ...merged[index].leads,
          ...campaign.leads.filter((l) => {
            const key = businessKey(l);
            if (keys.has(key)) return false;
            keys.add(key);
            return true;
          }),
        ],
      };
    }
  }
  write(merged);
  return merged;
}
export function addLeadsToCampaign(
  campaignId: string,
  leads: Lead[],
): { campaigns: Campaign[]; added: number } {
  let added = 0;
  const campaigns = read().map((c) => {
    if (c.id !== campaignId) return c;
    const keys = new Set(c.leads.map(businessKey));
    const fresh = leads.filter((l) => {
      const key = businessKey(l);
      if (keys.has(key)) return false;
      keys.add(key);
      added++;
      return true;
    });
    return {
      ...c,
      leads: [
        ...fresh.map((l) => ({
          ...l,
          status: l.status ?? ("new" as LeadStatus),
        })),
        ...c.leads,
      ],
    };
  });
  write(campaigns);
  return { campaigns, added };
}
export function updateLeadFollowUp(
  campaignId: string,
  leadId: string,
  date: string,
): Campaign[] {
  const campaigns = read().map((c) =>
    c.id === campaignId
      ? {
          ...c,
          leads: c.leads.map((l) =>
            l.id === leadId ? { ...l, followUpAt: date || undefined } : l,
          ),
        }
      : c,
  );
  write(campaigns);
  return campaigns;
}
export function saveLeadChanges(campaignId: string, lead: Lead): Campaign[] {
  const campaigns = read().map((c) =>
    c.id === campaignId
      ? {
          ...c,
          leads: c.leads.map((l) => (l.id === lead.id ? { ...l, ...lead } : l)),
        }
      : c,
  );
  write(campaigns);
  return campaigns;
}

export function createCampaign(name: string): Campaign {
  const campaigns = read();
  const campaign: Campaign = {
    id: makeId("camp"),
    name: name.trim().slice(0, 200) || "Нова кампанія",
    createdAt: new Date().toISOString(),
    leads: [],
  };
  write([campaign, ...campaigns]);
  return campaign;
}

export function renameCampaign(id: string, name: string): Campaign[] {
  const campaigns = read().map((c) =>
    c.id === id ? { ...c, name: name.trim().slice(0, 200) || c.name } : c,
  );
  write(campaigns);
  return campaigns;
}

export function deleteCampaign(id: string): Campaign[] {
  const campaigns = read().filter((c) => c.id !== id);
  write(campaigns);
  return campaigns;
}

export function addLeadToCampaign(campaignId: string, lead: Lead): Campaign[] {
  const campaigns = read().map((c) => {
    if (c.id !== campaignId) return c;
    const exists = c.leads.some(
      (l) =>
        (l.sourcePlaceId && l.sourcePlaceId === lead.sourcePlaceId) ||
        (l.name === lead.name && l.address === lead.address),
    );
    if (exists) return c;
    return {
      ...c,
      leads: [{ ...lead, status: lead.status ?? "new" }, ...c.leads],
    };
  });
  write(campaigns);
  return campaigns;
}

// Like addLeadToCampaign, but reports whether the lead was actually added
// (for an "undo" affordance) and the target campaign name (for the toast).
export function saveLeadDetailed(
  campaignId: string,
  lead: Lead,
): { campaigns: Campaign[]; added: boolean; campaignName: string } {
  const before = read();
  const target = before.find((c) => c.id === campaignId);
  const campaignName = target?.name ?? "";
  const exists =
    !!target &&
    target.leads.some(
      (l) =>
        (l.sourcePlaceId && l.sourcePlaceId === lead.sourcePlaceId) ||
        (l.name === lead.name && l.address === lead.address),
    );
  if (exists || !target) {
    return { campaigns: before, added: false, campaignName };
  }
  const campaigns = before.map((c) =>
    c.id === campaignId
      ? { ...c, leads: [{ ...lead, status: lead.status ?? "new" }, ...c.leads] }
      : c,
  );
  write(campaigns);
  return { campaigns, added: true, campaignName };
}

export function removeLeadFromCampaign(
  campaignId: string,
  leadId: string,
): Campaign[] {
  const campaigns = read().map((c) =>
    c.id === campaignId
      ? { ...c, leads: c.leads.filter((l) => l.id !== leadId) }
      : c,
  );
  write(campaigns);
  return campaigns;
}

export function updateLeadStatus(
  campaignId: string,
  leadId: string,
  status: LeadStatus,
): Campaign[] {
  const campaigns = read().map((c) =>
    c.id === campaignId
      ? {
          ...c,
          leads: c.leads.map((l) =>
            l.id === leadId
              ? {
                  ...l,
                  status,
                  // Outcome only applies to the "result" stage.
                  outcome: status === "result" ? l.outcome : undefined,
                }
              : l,
          ),
        }
      : c,
  );
  write(campaigns);
  return campaigns;
}

export function updateLeadOutcome(
  campaignId: string,
  leadId: string,
  outcome: LeadOutcome,
): Campaign[] {
  const campaigns = read().map((c) =>
    c.id === campaignId
      ? {
          ...c,
          leads: c.leads.map((l) =>
            l.id === leadId
              ? { ...l, status: "result" as LeadStatus, outcome }
              : l,
          ),
        }
      : c,
  );
  write(campaigns);
  return campaigns;
}

export function updateLeadNotes(
  campaignId: string,
  leadId: string,
  notes: string,
): Campaign[] {
  const campaigns = read().map((c) =>
    c.id === campaignId
      ? {
          ...c,
          leads: c.leads.map((l) => (l.id === leadId ? { ...l, notes } : l)),
        }
      : c,
  );
  write(campaigns);
  return campaigns;
}

export function updateLeadVerification(
  campaignId: string,
  leadId: string,
  verification: LeadVerification,
): Campaign[] {
  const campaigns = read().map((c) =>
    c.id === campaignId
      ? {
          ...c,
          leads: c.leads.map((l) =>
            l.id === leadId
              ? {
                  ...l,
                  verification: { ...(l.verification ?? {}), ...verification },
                }
              : l,
          ),
        }
      : c,
  );
  write(campaigns);
  return campaigns;
}

// Explicit replacement is only exposed after a validated import and confirmation.
export function replaceCampaigns(campaigns: Campaign[]): Campaign[] {
  const valid = validateCampaigns(campaigns);
  write(valid);
  return valid;
}

// Campaign funnel: 5 stages with controlled migration from the old 8 statuses.
// Pure helpers — safe to unit-test and reuse on the server.

import type { Campaign, Lead, LeadOutcome, LeadStatus } from "./types";

export const STAGES: Array<{ key: LeadStatus; label: string; hint: string }> = [
  { key: "new", label: "Нові", hint: "Щойно збережені ліди" },
  { key: "verified", label: "Перевірені", hint: "Дані підтверджено" },
  { key: "contact", label: "Контакт", hint: "Звернення надіслано" },
  { key: "dialog", label: "Діалог", hint: "Є відповідь / спілкування" },
  { key: "result", label: "Результат", hint: "Підсумок по ліду" },
];

export const OUTCOMES: Array<{ key: LeadOutcome; label: string }> = [
  { key: "won", label: "Угода" },
  { key: "lost", label: "Втрачено" },
  { key: "postponed", label: "Відкладено" },
];

const NEW_STAGES = new Set<string>(STAGES.map((s) => s.key));

/** Map any old or new status string to a {stage, outcome}. Idempotent. */
export function migrateStatus(old?: string | null): {
  status: LeadStatus;
  outcome?: LeadOutcome;
} {
  switch (old) {
    case "new":
      return { status: "new" };
    case "verified":
      return { status: "verified" };
    case "contacted":
      return { status: "contact" };
    case "replied":
    case "interested":
    case "meeting":
      return { status: "dialog" };
    case "won":
      return { status: "result", outcome: "won" };
    case "lost":
      return { status: "result", outcome: "lost" };
    default:
      // Pass through already-migrated stage keys; otherwise default to "new".
      if (old && NEW_STAGES.has(old)) return { status: old as LeadStatus };
      return { status: "new" };
  }
}

/** Migrate a single lead's status/outcome without losing other fields. */
export function migrateLead(lead: Lead): Lead {
  const m = migrateStatus(lead.status as unknown as string);
  const outcome = lead.outcome ?? m.outcome;
  if (lead.status === m.status && lead.outcome === outcome) return lead;
  return { ...lead, status: m.status, outcome };
}

/** Returns a migrated copy and whether anything actually changed. */
export function migrateCampaigns(campaigns: Campaign[]): {
  campaigns: Campaign[];
  changed: boolean;
} {
  let changed = false;
  const next = campaigns.map((c) => {
    const leads = c.leads.map((l) => {
      const ml = migrateLead(l);
      if (ml !== l) changed = true;
      return ml;
    });
    return { ...c, leads };
  });
  return { campaigns: next, changed };
}

/** A clear recommended next action for a lead, by stage + verification. */
export function nextActionForLead(lead: Lead): {
  label: string;
  description: string;
} {
  const v = lead.verification ?? {};
  if (v.doNotContact)
    return {
      label: "Не контактувати",
      description: "Лід позначено як такий, що не бажає звернень.",
    };
  if (v.badData)
    return {
      label: "Перевірити дані",
      description: "Дані потребують виправлення перед контактом.",
    };
  switch (lead.status) {
    case "result":
      if (lead.outcome === "won")
        return {
          label: "Зберегти як клієнта",
          description: "Угода закрита — зафіксуйте контакт у постійних.",
        };
      if (lead.outcome === "lost")
        return {
          label: "Архівувати",
          description: "Втрачено — за бажанням поверніться пізніше.",
        };
      return {
        label: "Запланувати нагадування",
        description: "Відкладено — поверніться до ліда згодом.",
      };
    case "dialog":
      return {
        label: "Зафіксувати результат",
        description: "Є діалог — позначте угоду, втрату або відкладення.",
      };
    case "contact":
      return {
        label: "Чекати на відповідь",
        description:
          "Контакт зроблено — після відповіді перенесіть у «Діалог».",
      };
    case "verified":
      return {
        label: "Написати першим",
        description: "Дані перевірені — час для першого контакту.",
      };
    case "new":
    default:
      if (!v.phoneChecked && !v.websiteChecked && !v.businessActive)
        return {
          label: "Перевірити дані",
          description: "Новий лід — перевірте телефон і сайт перед контактом.",
        };
      return {
        label: "Перенести в «Перевірені»",
        description: "Дані підтверджено — рухайте далі по воронці.",
      };
  }
}

import { nextActionForLead } from "@/lib/campaignStages";
import type { Lead } from "@/lib/types";

export default function CampaignNextAction({ lead }: { lead: Lead }) {
  const action = nextActionForLead(lead);
  return (
    <div className="mt-2 rounded-lg bg-brand-50 px-2.5 py-1.5 ring-1 ring-brand-100">
      <p className="text-xs font-semibold text-brand-800">
        Далі: {action.label}
      </p>
      <p className="text-[11px] leading-snug text-brand-700/80">
        {action.description}
      </p>
    </div>
  );
}

import { CircleAlert, CircleCheck, CircleMinus, CircleX } from "lucide-react";
import { outcomeStyles } from "@/lib/vlk-outcomes";

/** The badge describes the text of a rule, never a patient's status. */
export function OutcomeBadge({ outcome, label }: { outcome: string; label?: string }) {
  const style = outcomeStyles(outcome);
  const Icon = { critical: CircleX, warning: CircleAlert, positive: CircleCheck, neutral: CircleMinus }[style.tone];
  return <span className={`outcome-badge ${style.badge}`} data-tone={style.tone}>
    <Icon className="size-3.5 shrink-0" aria-hidden="true" />
    <span>{label ?? style.label}</span>
  </span>;
}

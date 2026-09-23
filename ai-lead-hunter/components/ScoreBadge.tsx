import type { LeadConfidence, LeadScore, ScoreLabel } from "@/lib/types";
import { cn } from "@/lib/utils";

const LABEL_TEXT: Record<ScoreLabel, string> = {
  hot: "Гарячий",
  warm: "Теплий",
  cold: "Холодний",
  bad_fit: "Слабкий",
};

const LABEL_COLOR: Record<ScoreLabel, string> = {
  hot: "text-hot",
  warm: "text-warm",
  cold: "text-cold",
  bad_fit: "text-bad",
};

const LABEL_RING: Record<ScoreLabel, string> = {
  hot: "ring-hot/30 bg-hot/5",
  warm: "ring-warm/30 bg-warm/5",
  cold: "ring-cold/30 bg-cold/5",
  bad_fit: "ring-bad/30 bg-bad/5",
};

// Component max values mirror the scoring weights.
const SEGMENTS: Array<{ key: keyof LeadScore; max: number; title: string }> = [
  { key: "fit", max: 30, title: "Відповідність" },
  { key: "pain", max: 35, title: "Біль / потреба" },
  { key: "reachability", max: 20, title: "Доступність" },
  { key: "timing", max: 15, title: "Тайминг" },
];

export function ScoreBadge({
  score,
  compact,
}: {
  score: LeadScore;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl px-3 py-2 ring-1",
        LABEL_RING[score.label],
      )}
    >
      <div className="text-center leading-none">
        <div
          className={cn(
            "font-mono text-2xl font-bold",
            LABEL_COLOR[score.label],
          )}
        >
          {score.total}
        </div>
        <div
          className={cn(
            "text-[10px] font-semibold uppercase tracking-wide",
            LABEL_COLOR[score.label],
          )}
        >
          {LABEL_TEXT[score.label]}
        </div>
      </div>
      {!compact && (
        <div className="flex flex-col gap-1">
          {SEGMENTS.map((seg) => {
            const val = score[seg.key] as number;
            const pct = Math.round((val / seg.max) * 100);
            return (
              <div
                key={seg.key}
                className="flex items-center gap-1.5"
                title={`${seg.title}: ${val}/${seg.max}`}
              >
                <span className="w-9 text-[9px] font-medium uppercase tracking-wide text-slate-400">
                  {seg.title.slice(0, 4)}
                </span>
                <span className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-200">
                  <span
                    className={cn(
                      "block h-full rounded-full",
                      barColor(score.label),
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function barColor(label: ScoreLabel): string {
  return {
    hot: "bg-hot",
    warm: "bg-warm",
    cold: "bg-cold",
    bad_fit: "bg-bad",
  }[label];
}

export function ScoreBreakdown({ score }: { score: LeadScore }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {SEGMENTS.map((seg) => {
        const val = score[seg.key] as number;
        const pct = Math.round((val / seg.max) * 100);
        return (
          <div key={seg.key} className="rounded-lg bg-slate-50 p-3">
            <div className="text-xs font-medium text-slate-500">
              {seg.title}
            </div>
            <div className="mt-1 font-mono text-lg font-bold text-ink">
              {val}
              <span className="text-sm font-normal text-slate-400">
                /{seg.max}
              </span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-200">
              <span
                className={cn(
                  "block h-full rounded-full",
                  barColor(score.label),
                )}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

const CONF_TEXT: Record<LeadConfidence["label"], string> = {
  high: "Висока",
  medium: "Середня",
  low: "Низька",
};

const CONF_STYLE: Record<LeadConfidence["label"], string> = {
  high: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  medium: "bg-amber-50 text-amber-700 ring-amber-200",
  low: "bg-slate-100 text-slate-500 ring-slate-200",
};

// Data-reliability badge — deliberately distinct from the Lead Score badge.
export function ConfidenceBadge({
  confidence,
  withLabel = true,
}: {
  confidence: LeadConfidence;
  withLabel?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ring-1",
        CONF_STYLE[confidence.label],
      )}
      title={`Впевненість у даних: ${confidence.score}/100`}
    >
      <span aria-hidden>◆</span>
      {confidence.score}
      {withLabel && (
        <span className="font-medium">· {CONF_TEXT[confidence.label]}</span>
      )}
    </span>
  );
}

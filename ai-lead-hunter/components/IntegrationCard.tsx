"use client";

import type { ReactNode } from "react";

export default function IntegrationCard({
  title,
  benefit,
  cost,
  opens,
  badge,
  children,
}: {
  title: string;
  benefit: string;
  cost: string;
  opens: string;
  badge?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-sm font-bold text-ink">{title}</h4>
        {badge}
      </div>
      <dl className="mt-2 space-y-1 text-xs text-slate-600">
        <div className="flex gap-2">
          <dt className="w-20 shrink-0 font-semibold text-slate-400">
            Користь
          </dt>
          <dd>{benefit}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-20 shrink-0 font-semibold text-slate-400">
            Вартість
          </dt>
          <dd>{cost}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-20 shrink-0 font-semibold text-slate-400">
            Відкриває
          </dt>
          <dd>{opens}</dd>
        </div>
      </dl>
      {children && <div className="mt-3">{children}</div>}
    </div>
  );
}

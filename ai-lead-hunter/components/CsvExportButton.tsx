"use client";

import { downloadCsv } from "@/lib/csv";
import type { Lead } from "@/lib/types";

export default function CsvExportButton({
  leads,
  filename = "leads.csv",
  label = "Експорт CSV",
}: {
  leads: Lead[];
  filename?: string;
  label?: string;
}) {
  return (
    <button
      className="btn-ghost btn-sm"
      disabled={leads.length === 0}
      onClick={() => downloadCsv(leads, filename)}
    >
      {label} ({leads.length})
    </button>
  );
}

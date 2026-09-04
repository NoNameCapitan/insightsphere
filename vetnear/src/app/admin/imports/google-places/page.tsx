"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { DemoAdminBanner } from "@/components/DemoBanner";
import { GOOGLE_PLACES } from "@/lib/data/google-places";
import { CATEGORY_LABELS, DISTRICT_LABELS } from "@/lib/labels";
import { EXTERNAL_LINK_PROPS, safeUrl } from "@/lib/security/url";
import { readJSON, writeJSON } from "@/lib/storage";
import type { GooglePlaceCandidate } from "@/lib/types";

type Decision = "verified" | "needs_call" | "duplicate" | "wrong_category" | "hidden";

interface ReviewState {
  decision?: Decision;
  emergencyVerified?: boolean;
  updatedAt: string;
}
type ReviewMap = Record<string, ReviewState>;

const REVIEW_KEY = "vetnear:gplaces-review";

const DECISION_LABEL: Record<Decision, string> = {
  verified: "Перевірено",
  needs_call: "Потрібен дзвінок",
  duplicate: "Дублікат",
  wrong_category: "Невірна категорія",
  hidden: "Сховано з датасету",
};

const DECISIONS: Decision[] = ["verified", "needs_call", "duplicate", "wrong_category", "hidden"];

const isEmergencyCandidate = (c: GooglePlaceCandidate) =>
  c.category === "emergency_vet" || c.emergencyAvailable === true || c.isOpen24_7 === true;

function download(filename: string, text: string, type: string) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export default function GooglePlacesReviewPage() {
  const [review, setReview] = useState<ReviewMap>({});
  const [cat, setCat] = useState("all");
  const [status, setStatus] = useState("all");
  const [district, setDistrict] = useState("all");
  const [emergencyOnly, setEmergencyOnly] = useState(false);
  const [missingPhone, setMissingPhone] = useState(false);
  const [missingWebsite, setMissingWebsite] = useState(false);
  const [duplicatesOnly, setDuplicatesOnly] = useState(false);

  useEffect(() => {
    setReview(readJSON<ReviewMap>(REVIEW_KEY, {}));
  }, []);

  const update = (id: string, patch: Partial<ReviewState>) => {
    setReview((prev) => {
      const next = { ...prev, [id]: { ...prev[id], ...patch, updatedAt: new Date().toISOString() } };
      writeJSON(REVIEW_KEY, next);
      return next;
    });
  };

  const setDecision = (id: string, decision: Decision) => {
    const current = review[id]?.decision;
    update(id, { decision: current === decision ? undefined : decision });
  };

  const confirmEmergency = (c: GooglePlaceCandidate) => {
    const already = review[c.id]?.emergencyVerified;
    if (already) {
      update(c.id, { emergencyVerified: false });
      return;
    }
    const ok = window.confirm(
      `Підтвердити НЕВІДКЛАДНУ допомогу для «${c.name}»?\n\n` +
        "Лише після того, як ви ЗАТЕЛЕФОНУВАЛИ і підтвердили, що заклад дійсно приймає цілодобово/невідкладно. " +
        "Демо/неперевірені невідкладні заклади не можна публікувати.",
    );
    if (ok) update(c.id, { emergencyVerified: true });
  };

  // Duplicate detection by normalized name.
  const nameCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of GOOGLE_PLACES) {
      const k = c.name.trim().toLowerCase();
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return m;
  }, []);
  const isDuplicateName = (c: GooglePlaceCandidate) =>
    (nameCounts.get(c.name.trim().toLowerCase()) ?? 0) > 1;

  const categories = useMemo(
    () => Array.from(new Set(GOOGLE_PLACES.map((c) => c.category))),
    [],
  );
  const districts = useMemo(
    () => Array.from(new Set(GOOGLE_PLACES.map((c) => c.district).filter(Boolean))) as string[],
    [],
  );

  const filtered = useMemo(() => {
    return GOOGLE_PLACES.filter((c) => {
      if (cat !== "all" && c.category !== cat) return false;
      if (district !== "all" && c.district !== district) return false;
      if (emergencyOnly && !isEmergencyCandidate(c)) return false;
      if (missingPhone && c.phone) return false;
      if (missingWebsite && c.website) return false;
      if (duplicatesOnly && !isDuplicateName(c)) return false;
      if (status !== "all") {
        const d = review[c.id]?.decision;
        if (status === "undecided" && d) return false;
        if (status !== "undecided" && d !== status) return false;
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cat, district, emergencyOnly, missingPhone, missingWebsite, duplicatesOnly, status, review]);

  const counts = useMemo(() => {
    const c = { total: GOOGLE_PLACES.length, verified: 0, hidden: 0, emergency: 0, emergencyVerified: 0 };
    for (const p of GOOGLE_PLACES) {
      const st = review[p.id];
      if (st?.decision === "verified") c.verified += 1;
      if (st?.decision === "hidden") c.hidden += 1;
      if (isEmergencyCandidate(p)) c.emergency += 1;
      if (st?.emergencyVerified) c.emergencyVerified += 1;
    }
    return c;
  }, [review]);

  const exportJson = () => {
    const reviewed = GOOGLE_PLACES.map((c) => {
      const st = review[c.id];
      const emergency = isEmergencyCandidate(c);
      // Safety: emergency candidates are promotable only with explicit emergency confirmation.
      const promotable =
        st?.decision === "verified" && (!emergency || st?.emergencyVerified === true);
      return {
        ...c,
        review: st ?? null,
        promotable,
        // When promotable, suggest the verified status the admin can publish with.
        suggestedVerificationStatus: promotable ? "verified" : c.verificationStatus,
      };
    });
    download("google-places-reviewed.json", JSON.stringify(reviewed, null, 2), "application/json");
  };

  const exportCsv = () => {
    const cols = [
      "id", "name", "category", "district", "address", "phone", "website",
      "googleMapsUri", "rating", "userRatingCount", "emergencyAvailable", "isOpen24_7",
      "review_decision", "emergency_verified", "reviewed_at",
    ];
    const rows = GOOGLE_PLACES.map((c) => {
      const st = review[c.id];
      const rec: Record<string, unknown> = {
        ...c,
        review_decision: st?.decision ?? "",
        emergency_verified: st?.emergencyVerified ? "true" : "",
        reviewed_at: st?.updatedAt ?? "",
      };
      return cols.map((k) => csvEscape(rec[k])).join(",");
    });
    download("google-places-review-queue.csv", [cols.join(","), ...rows].join("\n") + "\n", "text/csv");
  };

  return (
    <div className="container-px mx-auto max-w-6xl py-6">
      <Link href="/admin/imports" className="text-sm text-brand hover:underline">← Імпорти</Link>
      <h1 className="mt-2 font-display text-2xl font-extrabold text-ink">
        Перевірка імпорту Google Places
      </h1>
      <p className="mt-1 text-ink/60">
        Зовнішні кандидати ({counts.total}) зі статусом <code>needs_review</code>. Нічого не
        публікується автоматично — рішення зберігаються лише у вашому браузері.
      </p>

      <div className="mt-4"><DemoAdminBanner /></div>

      <div className="mt-3 rounded-2xl border border-emergency/30 bg-emergency-50 px-4 py-3 text-sm text-emergency-700">
        🚑 Невідкладні / цілодобові заклади <strong>ніколи не підвищуються автоматично</strong>.
        Позначити «Невідкладну перевірено» можна лише окремою дією після телефонного підтвердження,
        що заклад справді приймає цілодобово.
      </div>

      {/* Summary */}
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {[
          ["Усього", counts.total],
          ["Перевірено", counts.verified],
          ["Сховано", counts.hidden],
          ["Невідкладні", counts.emergency],
          ["Невідкладну підтв.", counts.emergencyVerified],
        ].map(([label, val]) => (
          <div key={String(label)} className="card px-3 py-2 text-center">
            <p className="text-lg font-bold text-ink">{val}</p>
            <p className="text-[11px] text-ink/50">{label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl border border-brand-100 p-3">
        <select value={cat} onChange={(e) => setCat(e.target.value)} className="rounded-xl border border-brand-100 px-2 py-1.5 text-sm">
          <option value="all">Усі категорії</option>
          {categories.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-xl border border-brand-100 px-2 py-1.5 text-sm">
          <option value="all">Будь-який статус</option>
          <option value="undecided">Без рішення</option>
          {DECISIONS.map((d) => <option key={d} value={d}>{DECISION_LABEL[d]}</option>)}
        </select>
        <select value={district} onChange={(e) => setDistrict(e.target.value)} className="rounded-xl border border-brand-100 px-2 py-1.5 text-sm">
          <option value="all">Усі райони</option>
          {districts.map((d) => <option key={d} value={d}>{DISTRICT_LABELS[d as keyof typeof DISTRICT_LABELS] ?? d}</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-sm text-ink/70">
          <input type="checkbox" checked={emergencyOnly} onChange={(e) => setEmergencyOnly(e.target.checked)} /> Невідкладні
        </label>
        <label className="flex items-center gap-1.5 text-sm text-ink/70">
          <input type="checkbox" checked={missingPhone} onChange={(e) => setMissingPhone(e.target.checked)} /> Без телефону
        </label>
        <label className="flex items-center gap-1.5 text-sm text-ink/70">
          <input type="checkbox" checked={missingWebsite} onChange={(e) => setMissingWebsite(e.target.checked)} /> Без сайту
        </label>
        <label className="flex items-center gap-1.5 text-sm text-ink/70">
          <input type="checkbox" checked={duplicatesOnly} onChange={(e) => setDuplicatesOnly(e.target.checked)} /> Дублікати
        </label>
      </div>

      {/* Export */}
      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={exportJson} className="btn btn-brand py-2 text-sm">Експорт JSON (перевірені)</button>
        <button onClick={exportCsv} className="btn btn-ghost py-2 text-sm">Експорт CSV (черга)</button>
        <span className="self-center text-xs text-ink/40">Показано: {filtered.length} / {counts.total}</span>
      </div>

      {/* List */}
      <ul className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
        {filtered.map((c) => {
          const st = review[c.id];
          const emergency = isEmergencyCandidate(c);
          const website = safeUrl(c.website ?? undefined);
          const maps = safeUrl(c.googleMapsUri ?? undefined);
          const dup = isDuplicateName(c);
          return (
            <li key={c.id} className={`card p-4 ${st?.decision === "hidden" ? "opacity-50" : ""}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-display font-bold text-ink">{c.name}</p>
                  <p className="text-sm text-ink/60">
                    {CATEGORY_LABELS[c.category]}
                    {c.district ? ` · ${DISTRICT_LABELS[c.district]}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="rounded-full bg-amber/15 px-2 py-0.5 text-[11px] font-medium text-amber">
                    {c.verificationStatus}
                  </span>
                  {emergency && (
                    <span className="rounded-full bg-emergency-50 px-2 py-0.5 text-[11px] font-medium text-emergency-700">
                      Невідкладна
                    </span>
                  )}
                  {dup && (
                    <span className="rounded-full bg-ink/10 px-2 py-0.5 text-[11px] text-ink/60">Дубль назви</span>
                  )}
                </div>
              </div>

              <div className="mt-2 space-y-0.5 text-sm text-ink/70">
                <p>{c.address}</p>
                <p>{c.phone ?? <span className="text-amber">немає телефону</span>}</p>
                <p>
                  {website ? (
                    <a href={website} {...EXTERNAL_LINK_PROPS} className="text-brand hover:underline">Сайт</a>
                  ) : (
                    <span className="text-amber">немає сайту</span>
                  )}
                  {maps && (
                    <>
                      {" · "}
                      <a href={maps} {...EXTERNAL_LINK_PROPS} className="text-brand hover:underline">Google Maps</a>
                    </>
                  )}
                </p>
                <p className="text-xs text-ink/50">
                  {c.rating != null ? `★ ${c.rating}` : "без рейтингу"}
                  {c.userRatingCount != null ? ` (${c.userRatingCount})` : ""}
                  {c.animalTypes.length ? ` · ${c.animalTypes.join(", ")}` : ""}
                  {c.isOpen24_7 ? " · 24/7" : ""}
                  {c.lastVerifiedAt ? ` · перевірено ${c.lastVerifiedAt}` : ""}
                </p>
              </div>

              {/* Review controls */}
              <div className="mt-3 flex flex-wrap gap-1.5">
                {DECISIONS.map((d) => (
                  <button
                    key={d}
                    onClick={() => setDecision(c.id, d)}
                    className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
                      st?.decision === d ? "bg-brand text-white" : "bg-ink/5 text-ink/70 hover:bg-ink/10"
                    }`}
                  >
                    {DECISION_LABEL[d]}
                  </button>
                ))}
              </div>

              {emergency && (
                <button
                  onClick={() => confirmEmergency(c)}
                  className={`mt-2 w-full rounded-xl py-2 text-xs font-semibold transition ${
                    st?.emergencyVerified
                      ? "bg-emergency-700 text-white"
                      : "border border-emergency/40 text-emergency-700 hover:bg-emergency-50"
                  }`}
                >
                  {st?.emergencyVerified
                    ? "✓ Невідкладну підтверджено (натисніть, щоб скасувати)"
                    : "Підтвердити невідкладну (лише після дзвінка)"}
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {filtered.length === 0 && (
        <div className="mt-6 rounded-3xl border border-dashed border-brand-100 p-10 text-center text-ink/50">
          Немає кандидатів за поточними фільтрами.
        </div>
      )}
    </div>
  );
}

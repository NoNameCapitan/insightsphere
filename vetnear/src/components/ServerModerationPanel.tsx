"use client";
// Server moderation queue (Phase 2). Shown on /admin/moderation when the
// backend is enabled: lets a moderator see submissions/reports from ALL
// devices (not just this browser's localStorage) and change statuses.
// Auth: x-admin-token header; token entered here, kept in sessionStorage only.
import { useCallback, useEffect, useState } from "react";
import {
  fetchServerReports,
  fetchServerSubmissions,
  getAdminToken,
  isBackendEnabled,
  setAdminToken,
  setServerSubmissionStatus,
} from "@/lib/api/backendClient";
import { CATEGORY_LABELS, DISTRICT_LABELS, STATUS_LABELS } from "@/lib/labels";
import type { PartnerSubmission, ReportIssue } from "@/lib/types";

export function ServerModerationPanel() {
  const [token, setToken] = useState("");
  const [authed, setAuthed] = useState(false);
  const [subs, setSubs] = useState<PartnerSubmission[]>([]);
  const [reports, setReports] = useState<ReportIssue[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, r] = await Promise.all([fetchServerSubmissions(), fetchServerReports()]);
      setSubs(s);
      setReports(r);
      setAuthed(true);
    } catch (e) {
      setAuthed(false);
      setError(e instanceof Error && e.message === "unauthorized"
        ? "Невірний токен модератора."
        : "Не вдалося завантажити дані з сервера.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (getAdminToken()) void load();
  }, [load]);

  if (!isBackendEnabled()) return null;

  const decide = async (id: string, status: PartnerSubmission["status"]) => {
    try {
      await setServerSubmissionStatus(id, status);
      await load();
    } catch {
      setError("Не вдалося змінити статус.");
    }
  };

  return (
    <section className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="font-semibold text-emerald-900">
          Серверна черга модерації
          <span className="ml-2 text-xs font-normal text-emerald-700">
            заявки з усіх пристроїв (Supabase)
          </span>
        </h2>
        {authed && (
          <button onClick={() => void load()} className="text-sm underline text-emerald-800">
            Оновити
          </button>
        )}
      </div>

      {!authed && (
        <div className="flex gap-2 flex-wrap items-center">
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Токен модератора"
            className="rounded-lg border px-3 py-1.5 text-sm"
          />
          <button
            onClick={() => {
              setAdminToken(token.trim());
              void load();
            }}
            className="rounded-lg bg-emerald-700 px-3 py-1.5 text-sm text-white"
            disabled={loading || !token.trim()}
          >
            {loading ? "Перевірка…" : "Увійти"}
          </button>
        </div>
      )}

      {error && <p className="text-sm text-red-700">{error}</p>}

      {authed && (
        <>
          <div className="space-y-2">
            {subs.length === 0 && (
              <p className="text-sm text-emerald-800">Серверних заявок поки немає.</p>
            )}
            {subs.map((s) => (
              <div key={s.id} className="rounded-xl border bg-white p-3 text-sm space-y-1">
                <div className="flex justify-between gap-2 flex-wrap">
                  <b>{s.name}</b>
                  <span className="text-xs rounded-full bg-slate-100 px-2 py-0.5">
                    {STATUS_LABELS[s.status]}
                  </span>
                </div>
                <div className="text-slate-600">
                  {CATEGORY_LABELS[s.category]} · {DISTRICT_LABELS[s.district]} · {s.phone}
                </div>
                <div className="text-slate-600">{s.address}</div>
                {s.status === "pending_review" && (
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => void decide(s.id, "approved")}
                      className="rounded-lg bg-emerald-600 px-3 py-1 text-white"
                    >
                      Схвалити
                    </button>
                    <button
                      onClick={() => void decide(s.id, "rejected")}
                      className="rounded-lg bg-red-600 px-3 py-1 text-white"
                    >
                      Відхилити
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="pt-2 border-t border-emerald-200">
            <h3 className="text-sm font-semibold text-emerald-900 mb-1">
              Репорти «невірна інформація» ({reports.length})
            </h3>
            {reports.slice(0, 20).map((r) => (
              <div key={r.id} className="text-xs text-slate-700">
                {r.placeId} — {r.reason}
                {r.message ? ` · ${r.message}` : ""}
              </div>
            ))}
          </div>

          <button
            onClick={() => {
              setAdminToken("");
              setAuthed(false);
              setSubs([]);
              setReports([]);
            }}
            className="text-xs underline text-slate-500"
          >
            Вийти (забути токен)
          </button>
        </>
      )}
    </section>
  );
}

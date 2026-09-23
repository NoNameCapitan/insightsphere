"use client";
import PlaceAttribution from "./PlaceAttribution";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Search,
  LayoutGrid,
  List,
  MapPin,
  BookmarkPlus,
  Check,
  SlidersHorizontal,
  RotateCcw,
  ArrowRight,
  Loader2,
} from "lucide-react";
import ActionToast, { type ToastState } from "./ActionToast";
import CsvExportButton from "./CsvExportButton";
import DemoModeBanner from "./DemoModeBanner";
import FiltersPanel, { type FilterState } from "./FiltersPanel";
import LeadCard from "./LeadCard";
import LeadDetailDrawer from "./LeadDetailDrawer";
import MapView from "./MapView";
import SearchForm, { type SearchSubmit } from "./SearchForm";
import SetupWizard from "./SetupWizard";
import {
  addLeadsToCampaign,
  createCampaign,
  getCampaigns,
  removeLeadFromCampaign,
  saveLeadChanges,
  saveLeadDetailed,
  updateLeadStatus,
  updateLeadVerification,
} from "@/lib/campaignStorage";
import { parseQuery } from "@/lib/queryParser";
import { applyFilters, sortLeads } from "@/lib/filters";
import { businessKey } from "@/lib/leadIdentity";
import { cn } from "@/lib/utils";
import { hasAnyContact } from "@/lib/contactExtractor";
import type {
  Campaign,
  Lead,
  SearchFilters,
  SearchRequest,
  SearchResponse,
} from "@/lib/types";
const DEFAULT_FILTERS: FilterState = { sort: "score", category: "all" };
function toFilters(f: FilterState): SearchFilters {
  const { sort, ...rest } = f;
  void sort;
  return rest;
}
function forceDemo() {
  try {
    return localStorage.getItem("alh_force_demo") === "true";
  } catch {
    return false;
  }
}
export default function SearchView() {
  const params = useSearchParams();
  const router = useRouter();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [result, setResult] = useState<SearchResponse | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [lastRequest, setLastRequest] = useState<SearchRequest | null>(null);
  const [searched, setSearched] = useState(false);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [view, setView] = useState<"list" | "table" | "map">("list");
  const [text, setText] = useState("");
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [target, setTarget] = useState("");
  const [active, setActive] = useState<Lead | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const [wizard, setWizard] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const sequence = useRef(0);
  const attempt = useCallback(<T,>(fn: () => T): T | undefined => {
    try {
      return fn();
    } catch (e) {
      setToast({ message: (e as Error).message });
      return undefined;
    }
  }, []);
  useEffect(() => {
    const sync = () => attempt(() => setCampaigns(getCampaigns()));
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener("alh-campaigns-changed", sync);
    return () => {
      controller.current?.abort();
      window.removeEventListener("storage", sync);
      window.removeEventListener("alh-campaigns-changed", sync);
    };
  }, [attempt]);
  const runSearch = useCallback(
    async ({
      request,
      demo,
      parsedFilters,
      notice: locationNotice,
    }: SearchSubmit) => {
      controller.current?.abort();
      const abort = new AbortController();
      controller.current = abort;
      const id = ++sequence.current;
      setLoading(true);
      setLoadingMore(false);
      setError("");
      setNotice(locationNotice ?? "");
      setSearched(true);
      setActive(null);
      const req = { ...request, filters: parsedFilters };
      setLastRequest(req);
      try {
        const res = await fetch("/api/places/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: abort.signal,
          body: JSON.stringify({ ...req, demo: demo || forceDemo() }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
        if (id !== sequence.current) return;
        setResult(data);
        setLeads(data.leads);
        setDismissed(new Set());
        setSelected(new Set());
        setText("");
        setFilters({ ...DEFAULT_FILTERS, ...parsedFilters });
        setBannerDismissed(false);
      } catch (e) {
        if (abort.signal.aborted || id !== sequence.current) return;
        setError((e as Error).message);
        setLeads([]);
        setResult(null);
      } finally {
        if (id === sequence.current) setLoading(false);
      }
    },
    [],
  );
  useEffect(() => {
    if (params.get("demo") !== "1") return;
    const query = params.get("q") ?? "";
    const parsed = parseQuery(query);
    void runSearch({
      request: {
        query,
        niche: parsed.niche,
        offerType: parsed.offer,
        locationMode: parsed.nearMe ? "city" : parsed.locationMode,
        city: parsed.city ?? "Київ",
        address: parsed.address,
        radiusKm: parsed.nearMe ? 0 : parsed.radiusKm,
        limit: parsed.limit,
        lang: "uk",
        filters: parsed.filters,
      },
      demo: true,
      parsedFilters: parsed.filters,
    });
  }, [params, runSearch]);
  const visible = useMemo(
    () =>
      sortLeads(
        applyFilters(
          leads.filter(
            (l) =>
              !dismissed.has(l.id) &&
              `${l.name} ${l.address} ${l.category}`
                .toLowerCase()
                .includes(text.toLowerCase()),
          ),
          toFilters(filters),
        ),
        filters.sort,
      ),
    [leads, dismissed, filters, text],
  );
  const savedKeys = useMemo(
    () => new Set(campaigns.flatMap((c) => c.leads.map(businessKey))),
    [campaigns],
  );
  const selectedLeads = visible.filter((l) => selected.has(l.id));
  const getTarget = () =>
    campaigns.find((c) => c.id === target) ??
    campaigns[0] ??
    createCampaign("Моя кампанія");
  function save(lead: Lead, campaignId?: string) {
    attempt(() => {
      const id = campaignId ?? getTarget().id;
      const result = saveLeadDetailed(id, lead);
      setCampaigns(result.campaigns);
      setToast({
        message: result.added
          ? `Збережено в «${result.campaignName}»`
          : `Уже є в «${result.campaignName}»`,
        actions: result.added
          ? [
              { label: "Відкрити", onClick: () => router.push("/campaigns") },
              {
                label: "Скасувати",
                onClick: () =>
                  attempt(() =>
                    setCampaigns(removeLeadFromCampaign(id, lead.id)),
                  ),
              },
            ]
          : undefined,
      });
    });
  }
  const contactLead = useMemo(
    () =>
      active
        ? {
            ...active,
            verification: {
              ...active.verification,
              doNotContact:
                !!active.verification?.doNotContact ||
                campaigns.some((c) =>
                  c.leads.some(
                    (l) =>
                      businessKey(l) === businessKey(active) &&
                      l.verification?.doNotContact,
                  ),
                ),
            },
          }
        : null,
    [active, campaigns],
  );
  function updatedLead(lead: Lead) {
    setLeads((prev) => prev.map((l) => (l.id === lead.id ? lead : l)));
    setActive(lead);
    attempt(() => {
      for (const c of getCampaigns()) {
        const saved = c.leads.find((l) => businessKey(l) === businessKey(lead));
        if (saved)
          saveLeadChanges(c.id, {
            ...lead,
            id: saved.id,
            status: saved.status,
            notes: saved.notes,
            verification: saved.verification,
            outcome: saved.outcome,
            followUpAt: saved.followUpAt,
          });
      }
    });
  }
  async function more() {
    if (!lastRequest || loading || loadingMore) return;
    const id = sequence.current;
    setLoadingMore(true);
    const abort = controller.current;
    try {
      const res = await fetch("/api/places/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abort?.signal,
        body: JSON.stringify({
          ...lastRequest,
          filters: toFilters(filters),
          demo: result?.mode === "demo" || forceDemo(),
          excludeKeys: leads.map(businessKey),
          widen: 1,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Помилка пошуку");
      if (id !== sequence.current) return;
      const existing = new Set(leads.map(businessKey));
      const fresh = (data.leads as Lead[]).filter(
        (l) => !existing.has(businessKey(l)),
      );
      setLeads((prev) => [...prev, ...fresh]);
      setToast({
        message: fresh.length
          ? `Додано ${fresh.length} нових лідів`
          : "Нових лідів немає. Змініть нішу або локацію.",
      });
    } catch (e) {
      if (id === sequence.current && !abort?.signal.aborted)
        setToast({ message: (e as Error).message });
    } finally {
      if (id === sequence.current) setLoadingMore(false);
    }
  }
  function resetFilters() {
    setFilters(DEFAULT_FILTERS);
    setText("");
    setDismissed(new Set());
    if (lastRequest && Object.keys(lastRequest.filters ?? {}).length)
      void runSearch({
        request: lastRequest,
        demo: result?.mode === "demo",
        parsedFilters: {},
      });
  }
  return (
    <div className="container-app py-7 sm:py-9">
      <p className="page-eyebrow">Відбір можливостей</p>
      <h1 className="page-title">Знайдіть свого наступного клієнта</h1>
      <p className="mt-2 text-sm text-slate-500">
        Пошук за потребою бізнесу, а не лише за його назвою.
      </p>
      <div className="mt-6">
        <SearchForm
          initialQuery={params.get("q") ?? ""}
          loading={loading || loadingMore}
          onSearch={runSearch}
        />
      </div>
      {error && (
        <div
          role="alert"
          className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"
        >
          <p>{error}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              className="btn-ghost btn-sm"
              onClick={() =>
                lastRequest &&
                runSearch({
                  request: lastRequest,
                  demo: false,
                  parsedFilters: lastRequest.filters ?? {},
                })
              }
            >
              Спробувати ще раз
            </button>
            <button
              className="btn-ghost btn-sm"
              onClick={() =>
                lastRequest &&
                runSearch({
                  request: {
                    ...lastRequest,
                    locationMode: "city",
                    city: "Київ",
                  },
                  demo: true,
                  parsedFilters: {},
                })
              }
            >
              Переглянути демо
            </button>
            <button
              className="btn-ghost btn-sm"
              onClick={() => setWizard(true)}
            >
              Налаштувати
            </button>
          </div>
        </div>
      )}
      {result?.mode === "demo" && !error && !bannerDismissed && (
        <div className="mt-4">
          <DemoModeBanner
            message={result.warning}
            onConnect={() => setWizard(true)}
            onContinueDemo={() => setBannerDismissed(true)}
            onLearn={() => setWizard(true)}
          />
        </div>
      )}
      {(notice || result?.geoNote) && !error && (
        <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
          {[notice, result?.geoNote].filter(Boolean).join(" ")}
        </p>
      )}
      {searched && !error && (
        <>
          {!loading && leads.length > 0 && (
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {[
                ["У вибірці", leads.length],
                ["Гарячі", leads.filter((l) => l.score.label === "hot").length],
                ["Без сайту", leads.filter((l) => !l.hasWebsite).length],
                ["Із телефоном", leads.filter((l) => l.hasPhone).length],
                [
                  "Email / соцмережі",
                  leads.filter((l) => hasAnyContact(l.websiteAnalysis?.contacts))
                    .length,
                ],
              ].map(([label, value]) => (
                <div className="card px-4 py-3" key={label}>
                  <p className="text-[11px] text-slate-500">{label}</p>
                  <p className="mt-1 text-xl font-semibold tabular-nums">
                    {value}
                  </p>
                </div>
              ))}
            </div>
          )}
          <details className="mt-5 card px-4 py-3">
            <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-semibold">
              <SlidersHorizontal size={15} />
              Фільтри та сортування{" "}
              <span className="ml-auto text-slate-400">Розгорнути</span>
            </summary>
            <div className="mt-4">
              <FiltersPanel filters={filters} onChange={setFilters} />
            </div>
          </details>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">
                Результати{" "}
                <span className="ml-1 text-sm font-normal text-slate-400">
                  {visible.length}
                </span>
              </h2>
              <p className="mt-1 text-[11px] text-slate-500">
                {result?.mode === "google_places"
                  ? "Дані: Google Maps"
                  : "Демо · вигадані бізнеси"}
                {result &&
                  ` · ${result.totalCandidates} кандидатів у зоні пошуку`}
                {result && !result.approximate && result.radiusKm
                  ? result.wholeCity
                    ? ` · усе місто (~${result.radiusKm} км від центру)`
                    : ` · радіус ${result.radiusKm} км`
                  : ""}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex rounded-xl border border-slate-200 bg-white p-1">
                {(
                  [
                    { id: "list", label: "Картки", icon: LayoutGrid },
                    { id: "table", label: "Таблиця", icon: List },
                    { id: "map", label: "Карта", icon: MapPin },
                  ] as const
                ).map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    className={cn(
                      "btn btn-sm",
                      view === id
                        ? "bg-brand-50 text-brand-700"
                        : "text-slate-500",
                    )}
                    aria-pressed={view === id}
                    title={label}
                    onClick={() => setView(id)}
                  >
                    <Icon size={14} />
                    <span className="hidden sm:inline">{label}</span>
                  </button>
                ))}
              </div>
              <CsvExportButton
                leads={selectedLeads.length ? selectedLeads : visible}
                filename="ai-lead-hunter.csv"
                label={
                  selectedLeads.length
                    ? `CSV (${selectedLeads.length})`
                    : "Експорт CSV"
                }
              />
            </div>
          </div>
          {leads.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <div className="relative min-w-[180px] flex-1">
                <Search
                  size={15}
                  className="absolute left-3 top-3 text-slate-400"
                />
                <input
                  className="input pl-9"
                  aria-label="Знайти у результатах"
                  placeholder="Назва, адреса або категорія…"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                />
              </div>
              <label className="btn-ghost btn-sm">
                <input
                  type="checkbox"
                  aria-label="Обрати всі видимі ліди"
                  checked={
                    visible.length > 0 &&
                    visible.every((l) => selected.has(l.id))
                  }
                  onChange={(e) =>
                    setSelected(
                      e.target.checked
                        ? new Set(visible.map((l) => l.id))
                        : new Set(),
                    )
                  }
                />
                Обрати всі
              </label>
              <button className="btn-ghost btn-sm" onClick={resetFilters}>
                <RotateCcw size={13} />
                Скинути
              </button>
            </div>
          )}
          {selectedLeads.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-brand-200 bg-brand-50 p-3">
              <span className="text-xs font-semibold text-brand-800">
                Обрано: {selectedLeads.length}
              </span>
              <select
                className="input max-w-[240px]"
                aria-label="Кампанія для збереження"
                value={campaigns.some((c) => c.id === target) ? target : (campaigns[0]?.id ?? "")}
                onChange={(e) => setTarget(e.target.value)}
              >
                {campaigns.length === 0 && (
                  <option value="">Моя кампанія (створити)</option>
                )}
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <button
                className="btn-primary btn-sm"
                onClick={() =>
                  attempt(() => {
                    const c = getTarget();
                    const r = addLeadsToCampaign(c.id, selectedLeads);
                    setCampaigns(r.campaigns);
                    setSelected(new Set());
                    setToast({
                      message: `Додано ${r.added} лідів у «${c.name}». Дублікати пропущено.`,
                    });
                  })
                }
              >
                <BookmarkPlus size={15} />
                Зберегти обрані
              </button>
            </div>
          )}
        </>
      )}
      {loading && (
        <div role="status" className="mt-6">
          <p className="mb-4 flex items-center gap-2 text-sm text-brand-700">
            <Loader2 className="animate-spin" size={16} />
            Шукаємо бізнеси та перевіряємо сигнали…
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="card h-48 animate-pulse bg-slate-100" />
            ))}
          </div>
        </div>
      )}
      {!loading && searched && !error && visible.length === 0 && (
        <div className="mt-5 card px-5 py-12 text-center">
          <Search size={28} className="mx-auto mb-4 text-slate-300" />
          <h2 className="font-semibold">За цими умовами лідів немає</h2>
          <p className="mt-2 text-sm text-slate-500">
            Збільште радіус, змініть нішу або приберіть фільтри.
          </p>
          <button className="btn-ghost mt-5" onClick={resetFilters}>
            Скинути фільтри
          </button>
        </div>
      )}
      {!loading && visible.length > 0 && view === "list" && (
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          {visible.map((l) => (
            <LeadCard
              key={l.id}
              lead={l}
              saved={savedKeys.has(businessKey(l))}
              selected={selected.has(l.id)}
              onSelect={() =>
                setSelected((prev) => {
                  const next = new Set(prev);
                  if (next.has(l.id)) next.delete(l.id);
                  else next.add(l.id);
                  return next;
                })
              }
              onDetails={setActive}
              onSave={save}
              onDismiss={(lead) => {
                setDismissed((prev) => new Set(prev).add(lead.id));
                setToast({
                  message: "Лід приховано",
                  actions: [
                    {
                      label: "Повернути",
                      onClick: () =>
                        setDismissed((prev) => {
                          const next = new Set(prev);
                          next.delete(lead.id);
                          return next;
                        }),
                    },
                  ],
                });
              }}
            />
          ))}
        </div>
      )}
      {!loading && visible.length > 0 && view === "table" && (
        <div className="mt-4 card overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-xs">
            <thead className="border-b bg-slate-50 text-slate-500">
              <tr>
                {["Обрати", "Бізнес", "Оцінка", "Сайт", "Телефон", "Email / соцмережі", ""].map(
                  (h, i) => (
                    <th className="p-4 font-medium" key={i}>
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {visible.map((l) => (
                <tr
                  key={l.id}
                  className="border-b last:border-b-0 hover:bg-brand-50/40"
                >
                  <td className="p-4">
                    <input
                      type="checkbox"
                      aria-label={`Обрати ${l.name}`}
                      checked={selected.has(l.id)}
                      onChange={(e) =>
                        setSelected((prev) => {
                          const next = new Set(prev);
                          if (e.target.checked) next.add(l.id);
                          else next.delete(l.id);
                          return next;
                        })
                      }
                    />
                  </td>
                  <td className="p-4">
                    <button
                      className="text-left font-semibold"
                      onClick={() => setActive(l)}
                    >
                      {l.name}
                    </button>
                    <p className="mt-1 max-w-xs truncate text-[11px] text-slate-400">
                      {l.address}
                    </p>
                    <PlaceAttribution lead={l} />
                  </td>
                  <td className="p-4 font-semibold text-brand-700">
                    {l.score.total}/100
                  </td>
                  <td className="p-4">
                    {l.hasWebsite ? "Є сайт" : "Без сайту"}
                  </td>
                  <td className="p-4 text-slate-500">
                    {l.phone ?? "Не вказано"}
                  </td>
                  <td className="max-w-[220px] p-4 text-slate-500">
                    <span className="block truncate">
                      {[
                        l.websiteAnalysis?.contacts?.emails[0],
                        l.websiteAnalysis?.contacts?.instagram && "Instagram",
                        l.websiteAnalysis?.contacts?.telegram && "Telegram",
                        l.websiteAnalysis?.contacts?.facebook && "Facebook",
                      ]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </span>
                  </td>
                  <td className="p-4">
                    <button
                      className="btn-ghost btn-sm"
                      aria-label={`Деталі ${l.name}`}
                      onClick={() => setActive(l)}
                    >
                      <ArrowRight size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!loading && visible.length > 0 && view === "map" && (
        <div className="mt-4">
          <MapView
            leads={visible}
            onSelect={setActive}
            center={result?.approximate ? undefined : result?.center}
            radiusKm={result?.approximate ? undefined : result?.radiusKm}
          />
        </div>
      )}
      {!loading && leads.length > 0 && !error && (
        <div className="mt-6 flex justify-center">
          <button className="btn-ghost" disabled={loadingMore} onClick={more}>
            {loadingMore ? (
              <Loader2 className="animate-spin" size={15} />
            ) : (
              <Search size={15} />
            )}{" "}
            {loadingMore ? "Шукаємо ще…" : "Шукати ще"}
          </button>
        </div>
      )}
      {!searched && (
        <div className="mt-6 flex items-center gap-3 rounded-2xl border border-dashed border-slate-300 p-5 text-sm text-slate-500">
          <Check size={20} className="shrink-0 text-brand-600" />
          Почніть із демо: перевірте відбір, оцінку потреби та збереження
          кампаній без ключів.
        </div>
      )}
      <LeadDetailDrawer
        lead={contactLead}
        campaigns={campaigns}
        onClose={() => setActive(null)}
        onSaveToCampaign={(id, l) => save(l, id)}
        onCreateCampaign={(name) =>
          attempt(() => {
            const c = createCampaign(name);
            setCampaigns(getCampaigns());
            return c;
          })
        }
        onLeadUpdate={updatedLead}
        onMarkContacted={(lead) =>
          attempt(() => {
            const c = campaigns.find((c) =>
              c.leads.some((l) => businessKey(l) === businessKey(lead)),
            );
            if (!c) {
              setToast({ message: "Спершу збережіть лід у кампанію." });
              return;
            }
            const l = c.leads.find(
              (l) => businessKey(l) === businessKey(lead),
            )!;
            updateLeadVerification(c.id, l.id, { contacted: true });
            setCampaigns(updateLeadStatus(c.id, l.id, "contact"));
            setToast({ message: "Лід перенесено до етапу «Контакт»." });
          })
        }
      />
      <ActionToast toast={toast} onClose={() => setToast(null)} />
      <SetupWizard open={wizard} onClose={() => setWizard(false)} />
    </div>
  );
}

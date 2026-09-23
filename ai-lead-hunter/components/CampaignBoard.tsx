"use client";
import PlaceAttribution from "./PlaceAttribution";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  CalendarDays,
  ArrowUpRight,
  Kanban,
  Download,
} from "lucide-react";
import CsvExportButton from "./CsvExportButton";
import CampaignNextAction from "./CampaignNextAction";
import LeadDetailDrawer from "./LeadDetailDrawer";
import ActionToast, { type ToastState } from "./ActionToast";
import {
  createCampaign,
  deleteCampaign,
  getCampaigns,
  importCampaigns,
  removeLeadFromCampaign,
  renameCampaign,
  saveLeadChanges,
  saveLeadDetailed,
  updateLeadFollowUp,
  updateLeadNotes,
  updateLeadOutcome,
  updateLeadStatus,
  updateLeadVerification,
} from "@/lib/campaignStorage";
import { OUTCOMES, STAGES } from "@/lib/campaignStages";
import { VERIFICATION_FIELDS } from "@/lib/options";
import type {
  Campaign,
  Lead,
  LeadOutcome,
  LeadStatus,
  LeadVerification,
} from "@/lib/types";
function LeadRow({
  lead,
  onChange,
  onOpen,
}: {
  lead: Lead;
  onChange: (field: string, value: string | LeadVerification) => void;
  onOpen: () => void;
}) {
  const [notes, setNotes] = useState(lead.notes ?? "");
  const [expanded, setExpanded] = useState(false);
  const today = new Date();
  const localDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  return (
    <article className="card p-3.5">
      <div className="flex items-start justify-between gap-2">
        <button className="min-w-0 text-left" onClick={onOpen}>
          <h3 className="text-sm font-semibold hover:text-brand-600">
            {lead.name}
          </h3>
          <p className="mt-1 line-clamp-1 text-[11px] text-slate-400">
            {lead.address}
          </p>
        </button>
        <span className="rounded-lg bg-brand-50 px-2 py-1 text-xs font-bold text-brand-700">
          {lead.score.total}
        </span>
      </div>
      <PlaceAttribution lead={lead} />
      <div className="mt-3 flex flex-wrap gap-1.5">
        <span className="chip bg-slate-50 text-slate-500">
          {lead.source === "demo" ? "Демо" : "Google Maps"}
        </span>
        <span className="chip bg-slate-50 text-slate-500">
          {lead.hasWebsite ? "Є сайт" : "Без сайту"}
        </span>
        {lead.verification?.doNotContact && (
          <span className="chip bg-rose-50 text-rose-700">Не контактувати</span>
        )}
      </div>
      {lead.followUpAt && (
        <p
          className={`mt-3 flex items-center gap-1.5 text-[11px] ${lead.followUpAt <= localDate ? "text-amber-700" : "text-slate-500"}`}
        >
          <CalendarDays size={12} />
          {lead.followUpAt <= localDate
            ? "Повернутися до ліда"
            : "Наступний контакт"}
          : {lead.followUpAt}
        </p>
      )}
      <select
        className="input mt-3 py-2 text-xs"
        aria-label={`Етап: ${lead.name}`}
        value={lead.status ?? "new"}
        onChange={(e) => onChange("status", e.target.value)}
      >
        {STAGES.map((s) => (
          <option key={s.key} value={s.key}>
            {s.label}
          </option>
        ))}
      </select>
      {lead.status === "result" && (
        <select
          className="input mt-2 text-xs"
          aria-label={`Результат: ${lead.name}`}
          value={lead.outcome ?? ""}
          onChange={(e) => onChange("outcome", e.target.value)}
        >
          <option value="" disabled>
            Оберіть підсумок
          </option>
          {OUTCOMES.map((o) => (
            <option key={o.key} value={o.key}>
              {o.label}
            </option>
          ))}
        </select>
      )}
      <CampaignNextAction lead={lead} />
      <div className="mt-3 flex justify-between border-t border-slate-100 pt-2">
        <button
          className="btn-sm text-xs font-medium text-brand-700"
          onClick={onOpen}
        >
          Деталі <ArrowUpRight size={12} className="ml-1 inline" />
        </button>
        <button
          className="btn-sm text-xs text-slate-500"
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
        >
          Керувати
        </button>
      </div>
      {expanded && (
        <div className="mt-3 space-y-3 border-t border-slate-100 pt-3">
          <div>
            <label className="label" htmlFor={`follow-${lead.id}`}>
              Наступний контакт
            </label>
            <input
              id={`follow-${lead.id}`}
              type="date"
              className="input text-xs"
              value={lead.followUpAt ?? ""}
              onChange={(e) => onChange("followUp", e.target.value)}
              onBlur={(e) => {
                if (e.currentTarget.value !== (lead.followUpAt ?? ""))
                  onChange("followUp", e.currentTarget.value);
              }}
            />
          </div>
          <div>
            <label className="label" htmlFor={`notes-${lead.id}`}>
              Нотатки
            </label>
            <textarea
              id={`notes-${lead.id}`}
              className="input text-xs"
              maxLength={20000}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={() => {
                if (notes !== lead.notes) onChange("notes", notes);
              }}
              placeholder="Що обговорили, про що домовились…"
            />
          </div>
          <div className="space-y-2">
            {VERIFICATION_FIELDS.map((f) => (
              <label
                key={f.key}
                className={`flex items-center gap-2 text-xs ${f.danger ? "text-rose-700" : "text-slate-600"}`}
              >
                <input
                  type="checkbox"
                  checked={!!lead.verification?.[f.key]}
                  onChange={(e) =>
                    onChange("verification", { [f.key]: e.target.checked })
                  }
                />
                {f.label}
              </label>
            ))}
          </div>
          <button
            className="btn-ghost btn-sm w-full text-rose-600"
            onClick={() => onChange("remove", "")}
          >
            <Trash2 size={13} />
            Прибрати з кампанії
          </button>
        </div>
      )}
    </article>
  );
}
export default function CampaignBoard() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [activeId, setActiveId] = useState("");
  const [name, setName] = useState("");
  const [filter, setFilter] = useState("");
  const [leadId, setLeadId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const [error, setError] = useState("");
  function attempt<T>(fn: () => T): T | undefined {
    try {
      return fn();
    } catch (e) {
      setToast({ message: (e as Error).message });
      return undefined;
    }
  }
  useEffect(() => {
    const load = () => {
      try {
        const cs = getCampaigns();
        setCampaigns(cs);
        setActiveId((id) =>
          cs.some((c) => c.id === id) ? id : (cs[0]?.id ?? ""),
        );
        setError("");
      } catch (e) {
        setError((e as Error).message);
      }
    };
    load();
    window.addEventListener("storage", load);
    window.addEventListener("alh-campaigns-changed", load);
    return () => {
      window.removeEventListener("storage", load);
      window.removeEventListener("alh-campaigns-changed", load);
    };
  }, []);
  const active = campaigns.find((c) => c.id === activeId);
  const activeLead = active?.leads.find((l) => l.id === leadId) ?? null;
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropStage, setDropStage] = useState<string | null>(null);
  const grouped = useMemo(
    () =>
      Object.fromEntries(
        STAGES.map((s) => [
          s.key,
          (active?.leads ?? []).filter(
            (l) =>
              (l.status ?? "new") === s.key &&
              `${l.name} ${l.address}`
                .toLowerCase()
                .includes(filter.toLowerCase()),
          ),
        ]),
      ),
    [active, filter],
  );
  function change(lead: Lead, field: string, value: string | LeadVerification) {
    if (!active) return;
    attempt(() => {
      const cid = active.id;
      if (field === "status")
        updateLeadStatus(cid, lead.id, value as LeadStatus);
      if (field === "outcome")
        updateLeadOutcome(cid, lead.id, value as LeadOutcome);
      if (field === "notes") updateLeadNotes(cid, lead.id, value as string);
      if (field === "followUp")
        updateLeadFollowUp(cid, lead.id, value as string);
      if (field === "verification")
        updateLeadVerification(cid, lead.id, value as LeadVerification);
      if (field === "remove") {
        removeLeadFromCampaign(cid, lead.id);
        setToast({
          message: "Лід прибрано з кампанії",
          actions: [
            {
              label: "Повернути",
              onClick: () => attempt(() => saveLeadDetailed(cid, lead)),
            },
          ],
        });
      }
    });
  }
  return (
    <div className="container-app py-7 sm:py-9">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="page-eyebrow">Від знайомства до угоди</p>
          <h1 className="page-title">Ваші кампанії</h1>
          <p className="mt-2 text-sm text-slate-500">
            Кожен контакт має наступний крок.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className="btn-ghost btn-sm" href="/settings">
            <Download size={14} />
            Резервна копія
          </Link>
          <Link className="btn-primary btn-sm" href="/search">
            <Plus size={14} />
            Знайти лідів
          </Link>
        </div>
      </div>
      {error && (
        <p
          role="alert"
          className="mt-4 rounded-xl bg-rose-50 p-4 text-sm text-rose-800"
        >
          {error}
        </p>
      )}
      <section className="card mt-6 p-4">
        <div className="flex flex-wrap gap-2">
          {campaigns.map((c) => (
            <button
              key={c.id}
              onClick={() => {
                setActiveId(c.id);
                setLeadId(null);
              }}
              className={`btn btn-sm ${c.id === activeId ? "bg-brand-50 text-brand-700" : "text-slate-500"}`}
              aria-pressed={c.id === activeId}
            >
              {c.name}
              <span className="ml-1 rounded-md bg-white px-1.5 text-[10px]">
                {c.leads.length}
              </span>
            </button>
          ))}
        </div>
        <form
          className="mt-3 flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            attempt(() => {
              const c = createCampaign(name || "Нова кампанія");
              setName("");
              setActiveId(c.id);
            });
          }}
        >
          <input
            className="input max-w-sm"
            aria-label="Назва нової кампанії"
            placeholder="Наприклад, стоматології Києва"
            value={name}
            maxLength={200}
            onChange={(e) => setName(e.target.value)}
          />
          <button className="btn-ghost" type="submit">
            <Plus size={15} />
            Створити кампанію
          </button>
        </form>
      </section>
      {active && (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div className="relative w-full max-w-sm">
            <Search
              className="absolute left-3 top-3 text-slate-400"
              size={16}
            />
            <input
              className="input pl-9"
              aria-label="Пошук у кампанії"
              placeholder="Знайти лід у кампанії…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <CsvExportButton
              leads={active.leads}
              filename={`${active.name}.csv`}
              label="CSV"
            />
            <button
              className="btn-ghost btn-sm"
              onClick={() => {
                const next = window.prompt("Нова назва кампанії", active.name);
                if (next?.trim())
                  attempt(() => renameCampaign(active.id, next));
              }}
            >
              <Pencil size={13} />
              Назва
            </button>
            <button
              className="btn-ghost btn-sm text-rose-600"
              onClick={() => {
                if (window.confirm(`Прибрати кампанію «${active.name}»?`)) {
                  const removed = active;
                  attempt(() => {
                    deleteCampaign(active.id);
                    setToast({
                      message: "Кампанію прибрано",
                      actions: [
                        {
                          label: "Повернути",
                          onClick: () =>
                            attempt(() => importCampaigns([removed])),
                        },
                      ],
                    });
                  });
                }
              }}
            >
              <Trash2 size={13} />
              Видалити
            </button>
          </div>
        </div>
      )}
      {active && active.leads.length > 0 ? (
        <div
          className="mt-5 grid auto-cols-[minmax(250px,1fr)] grid-flow-col gap-3 overflow-x-auto pb-5 lg:auto-cols-[minmax(196px,1fr)]"
          aria-label="Дошка кампанії"
        >
          {STAGES.map((s, i) => (
            <section
              key={s.key}
              onDragOver={(e) => {
                if (!dragId) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (dropStage !== s.key) setDropStage(s.key);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null))
                  setDropStage(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                const lead = active.leads.find((l) => l.id === dragId);
                setDropStage(null);
                setDragId(null);
                if (lead && (lead.status ?? "new") !== s.key)
                  change(lead, "status", s.key);
              }}
              className={`min-w-0 rounded-2xl border p-3 transition ${
                dropStage === s.key
                  ? "border-brand-400 bg-brand-50 ring-2 ring-brand-200"
                  : "border-slate-200/70 bg-[#edf1ee]"
              }`}
            >
              <header className="mb-3 flex items-center gap-2 px-1">
                <span
                  className={`size-2 rounded-full ${["bg-slate-400", "bg-blue-400", "bg-amber-400", "bg-violet-400", "bg-brand-500"][i]}`}
                />
                <h2 className="text-xs font-semibold">{s.label}</h2>
                <span className="ml-auto rounded-md bg-white px-2 py-1 text-[10px] text-slate-500">
                  {grouped[s.key].length}
                </span>
              </header>
              <div className="space-y-3">
                {grouped[s.key].map((l) => (
                  <div
                    key={l.id}
                    draggable
                    onDragStart={(e) => {
                      setDragId(l.id);
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData("text/plain", l.id);
                    }}
                    onDragEnd={() => {
                      setDragId(null);
                      setDropStage(null);
                    }}
                    className={`cursor-grab active:cursor-grabbing ${dragId === l.id ? "opacity-50" : ""}`}
                    title="Перетягніть картку на інший етап"
                  >
                    <LeadRow
                      lead={l}
                      onChange={(f, v) => change(l, f, v)}
                      onOpen={() => setLeadId(l.id)}
                    />
                  </div>
                ))}
                {!grouped[s.key].length && (
                  <p className="rounded-xl border border-dashed border-slate-300 px-3 py-7 text-center text-[11px] text-slate-400">
                    {s.hint}
                  </p>
                )}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="mt-6 card py-16 text-center">
          <Kanban className="mx-auto mb-4 text-brand-400" size={32} />
          <h2 className="font-semibold">
            {active ? "Додайте перших лідів" : "Створіть першу кампанію"}
          </h2>
          <p className="mx-auto mt-2 max-w-md px-4 text-sm text-slate-500">
            Збережіть бізнеси з пошуку, перевірте дані та рухайте лідів між
            етапами.
          </p>
          <Link className="btn-primary mt-5" href="/search">
            Перейти до пошуку
          </Link>
        </div>
      )}
      <LeadDetailDrawer
        lead={activeLead}
        campaigns={campaigns}
        onClose={() => setLeadId(null)}
        onCreateCampaign={(n) => attempt(() => createCampaign(n))}
        onSaveToCampaign={(id, l) =>
          attempt(() => {
            const r = saveLeadDetailed(id, l);
            setToast({
              message: r.added ? "Лід додано" : "Лід уже в кампанії",
            });
          })
        }
        onLeadUpdate={(l) =>
          attempt(() => active && saveLeadChanges(active.id, l))
        }
        onMarkContacted={(l) =>
          attempt(() => {
            if (active) {
              updateLeadVerification(active.id, l.id, { contacted: true });
              updateLeadStatus(active.id, l.id, "contact");
              setToast({ message: "Позначено контакт" });
            }
          })
        }
      />
      <ActionToast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}

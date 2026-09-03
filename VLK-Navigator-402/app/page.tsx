"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  Check,
  ClipboardCheck,
  Copy,
  ExternalLink,
  FileText,
  History,
  ListPlus,
  Maximize2,
  MoreHorizontal,
  Plus,
  Search,
  Printer,
  RotateCcw,
  ShieldCheck,
  Table2,
  UsersRound,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { SwRegister } from "@/components/sw-register";
import { TdvDialog } from "@/components/vlk/tdv-dialog";
import { ARTICLE_RULES, type ArticleRule } from "@/lib/vlk-rules";
import {
  ARTICLES,
  EDITION,
  SOURCE_URL,
  SPECIALTIES,
  type SpecialtyId,
  type VlkArticle,
} from "@/lib/vlk-sample-data";
import {
  matchesOutcomeFilter,
  outcomeStyles,
  OUTCOME_FILTERS,
  strictestOutcome,
  type OutcomeFilterId,
} from "@/lib/vlk-outcomes";
import {
  highlightParts,
  MATCH_TYPE_LABELS,
  MATCH_TYPE_SHORT,
  POPULAR_QUERIES,
  searchArticles,
  snippetAround,
  type SearchHit,
} from "@/lib/vlk-search";
import {
  addSearchHistory,
  readSearchHistory,
  SEARCH_HISTORY_KEY,
} from "@/lib/vlk-search-history";
import {
  createBasketItem,
  EMPTY_DIRECTORY,
  EXAMINEE_TYPES,
  LEGACY_SESSION_KEYS,
  restoreSession,
  serializeSession,
  SESSION_KEY,
  specialtyLabels,
  type BasketItem,
  type DoctorDirectory,
  type Mode,
} from "@/lib/vlk-session";
import { TDV_COLUMNS, TDV_RULES } from "@/lib/vlk-tdv";
import {
  EXPLANATION_ARTICLES,
  EXPLANATION_EDITION,
  EXPLANATION_META,
  EXPLANATION_SOURCE_URL,
  getLoadedExplanation,
  loadArticleExplanation,
  warmExplanations,
  type ArticleExplanation,
} from "@/lib/vlk-explanations";
import { pointExplanation } from "@/lib/vlk-explanation-view";
import { buildDraftText, buildReferenceText } from "@/lib/vlk-report";
import {
  explanationUrl as buildExplanationUrl,
  officialRuleUrl,
  TDV_DOCX_URL,
  TDV_URL,
} from "@/lib/vlk-links";

const ANALYSIS_CHECKS = [
  "Діагноз і код підтверджені документами",
  "Порушення функцій об’єктивно описані",
  "Профільні обстеження завершені",
  "Офіційні пояснення до статті звірено",
  "Графу обліку та ТДВ звірено",
];

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2e817b] focus-visible:ring-offset-1 focus-visible:ring-offset-white";

function articleCountLabel(count: number) {
  const lastTwo = count % 100;
  const last = count % 10;
  const word =
    lastTwo >= 11 && lastTwo <= 14
      ? "статей"
      : last === 1
        ? "стаття"
        : last >= 2 && last <= 4
          ? "статті"
          : "статей";
  return `${count} ${word}`;
}

function pointCountLabel(count: number) {
  const lastTwo = count % 100;
  const last = count % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return `${count} пунктів`;
  if (last === 1) return `${count} пункт`;
  if (last >= 2 && last <= 4) return `${count} пункти`;
  return `${count} пунктів`;
}

/**
 * Єдиний стиль назви спеціальності: повна назва, а справжня абревіатура
 * (ЛОР) — у дужках. Скорочена назва-синонім у дужки не виноситься.
 */
function specialtyName(item: (typeof SPECIALTIES)[number]) {
  const isAbbreviation =
    item.short !== item.label && item.short === item.short.toLocaleUpperCase("uk");
  return isAbbreviation ? `${item.label} (${item.short})` : item.label;
}

function pointLabel(point: string) {
  return point === "—" ? "без поділу" : `пункт «${point}»`;
}

/** Родовий відмінок для формулювань «до пункту…». */
function pointLabelGenitive(point: string) {
  return point === "—" ? "статті без поділу на пункти" : `пункту «${point}»`;
}

function Highlighted({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;
  return (
    <>
      {highlightParts(text, query).map((part, index) =>
        part.match ? (
          <mark key={index} className="rounded-[3px] bg-[#fdeaae] px-0.5 text-inherit">
            {part.text}
          </mark>
        ) : (
          <span key={index}>{part.text}</span>
        ),
      )}
    </>
  );
}

export default function Home() {
  const [mode, setMode] = useState<Mode>("express");
  // Порожнє значення означає, що лікар ще не обрав спеціальність:
  // до цього моменту перший екран лишається чистим.
  const [specialty, setSpecialty] = useState<SpecialtyId | "">("");
  const [examineeType, setExamineeType] = useState<string>(EXAMINEE_TYPES[0]);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [selectedRuleIndex, setSelectedRuleIndex] = useState("");
  const [checked, setChecked] = useState<string[]>([]);
  const [basket, setBasket] = useState<BasketItem[]>([]);
  const [directory, setDirectory] = useState<DoctorDirectory>(EMPTY_DIRECTORY);
  const [draftOpen, setDraftOpen] = useState(false);
  const [outcomeFilter, setOutcomeFilter] = useState<OutcomeFilterId>("all");
  const [copied, setCopied] = useState<"reference" | "draft" | "">("");
  const [online, setOnline] = useState(true);
  const [hydrated, setHydrated] = useState(false);
  const [restoreNotice, setRestoreNotice] = useState("");
  const [explanation, setExplanation] = useState<ArticleExplanation | undefined>();
  const [explanationState, setExplanationState] = useState<"loading" | "ready" | "error">("ready");
  const [searchOpen, setSearchOpen] = useState(false);
  const [directoryOpen, setDirectoryOpen] = useState(false);
  const [activeHit, setActiveHit] = useState(-1);
  const [history, setHistory] = useState<string[]>([]);
  const listRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const searchBoxRef = useRef<HTMLDivElement>(null);
  /** Чи додано запис в історію браузера при переході на робочий екран. */
  const historyPushedRef = useRef(false);

  useEffect(() => {
    const setConnected = () => setOnline(true);
    const setDisconnected = () => setOnline(false);
    window.addEventListener("online", setConnected);
    window.addEventListener("offline", setDisconnected);

    // Локальний стан читається після гідратації, щоб серверна та клієнтська
    // розмітка збігалися.
    const hydrationTimer = window.setTimeout(() => {
      setOnline(navigator.onLine);

      let stored = localStorage.getItem(SESSION_KEY);
      if (!stored) {
        for (const key of LEGACY_SESSION_KEYS) {
          stored = localStorage.getItem(key);
          if (stored) break;
        }
      }
      const restored = restoreSession(stored);
      setBasket(restored.basket);
      setExamineeType(restored.examineeType);
      setMode(restored.mode);
      setDirectory(restored.directory);
      if (restored.dropped) {
        setRestoreNotice(
          `${restored.dropped} збережених пунктів не знайдено в чинній редакції — їх прибрано зі зведення.`,
        );
      }
      setHistory(readSearchHistory(localStorage.getItem(SEARCH_HISTORY_KEY)));
      setHydrated(true);
    }, 0);

    return () => {
      window.clearTimeout(hydrationTimer);
      window.removeEventListener("online", setConnected);
      window.removeEventListener("offline", setDisconnected);
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(SESSION_KEY, serializeSession({ basket, examineeType, mode, directory }));
  }, [basket, directory, examineeType, hydrated, mode]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history));
  }, [history, hydrated]);

  // Клік поза пошуком закриває випадний список.
  useEffect(() => {
    if (!searchOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (!searchBoxRef.current?.contains(event.target as Node)) setSearchOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [searchOpen]);

  /** Повертає застосунок на головний екран вибору спеціальності. */
  const resetToHome = useCallback(() => {
    setSpecialty("");
    setQuery("");
    setSelectedId("");
    setSelectedRuleIndex("");
    setOutcomeFilter("all");
    setChecked([]);
    setCopied("");
  }, []);

  // Апаратна або браузерна кнопка «назад» повертає на головний екран,
  // а не виводить із застосунку.
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const state = event.state as { vlk?: string } | null;
      if (state?.vlk === "dashboard") return;
      historyPushedRef.current = false;
      resetToHome();
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [resetToHome]);

  const searchHits = useMemo(
    () => (query.trim() ? searchArticles(query, directory) : []),
    [directory, query],
  );
  const searchResults = useMemo(() => searchHits.map((hit) => hit.article), [searchHits]);
  const hitsById = useMemo(() => {
    const map = new Map<string, SearchHit>();
    for (const hit of searchHits) map.set(hit.article.id, hit);
    return map;
  }, [searchHits]);

  const specialtyArticles = useMemo(
    () => (specialty ? ARTICLES.filter((article) => article.specialties.includes(specialty)) : []),
    [specialty],
  );

  const baseArticles = query.trim() ? searchResults : specialtyArticles;
  // Фільтр показує статті, у яких є хоча б один пункт із такою категорією
  // дослівного результату. Стаття не отримує єдиної категорії придатності.
  const listArticles = useMemo(
    () =>
      outcomeFilter === "all"
        ? baseArticles
        : baseArticles.filter((article) =>
            matchesOutcomeFilter(
              (ARTICLE_RULES[article.article] ?? []).map((rule) => rule.outcome),
              outcomeFilter,
            ),
          ),
    [baseArticles, outcomeFilter],
  );
  // Вибрана стаття тримається за власним id, а не за поточним списком: набір
  // запиту фільтрує список, але не перемикає відкриту статтю.
  const selected =
    ARTICLES.find((article) => article.id === selectedId) ?? specialtyArticles[0];
  const selectedSpecialty = SPECIALTIES.find((item) => item.id === specialty);
  /** Робочий екран відкривається лише після вибору спеціальності або пошуку. */
  const showDashboard = Boolean(specialty) || Boolean(query.trim());

  useEffect(() => {
    if (!showDashboard || historyPushedRef.current) return;
    window.history.pushState({ vlk: "dashboard" }, "");
    historyPushedRef.current = true;
  }, [showDashboard]);

  /** Кнопка «назад» у застосунку: віддає крок історії, якщо він наш. */
  const goHome = useCallback(() => {
    if (historyPushedRef.current) {
      historyPushedRef.current = false;
      window.history.back();
      return;
    }
    resetToHome();
  }, [resetToHome]);
  const articleRules = selected ? (ARTICLE_RULES[selected.article] ?? []) : [];
  const selectedRule = selectedRuleIndex === "" ? undefined : articleRules[Number(selectedRuleIndex)];
  const articleNumber = selected?.article;
  const explanationMeta = articleNumber ? EXPLANATION_META[articleNumber] : undefined;

  // Дослівне пояснення підвантажується лише для відкритої статті.
  useEffect(() => {
    if (!articleNumber) return;
    const meta = EXPLANATION_META[articleNumber];
    const absent = !meta || meta.status === "absent";
    const immediate = absent || getLoadedExplanation(articleNumber) !== undefined;

    let active = true;
    // Стан «завантаження» показується лише тоді, коли модуль справді треба
    // забрати з мережі або кешу service worker.
    const pendingTimer = immediate
      ? 0
      : window.setTimeout(() => {
          if (active) setExplanationState("loading");
        }, 120);

    const request = absent
      ? Promise.resolve<ArticleExplanation | undefined>(undefined)
      : loadArticleExplanation(articleNumber);

    request
      .then((value) => {
        if (!active) return;
        window.clearTimeout(pendingTimer);
        setExplanation(value);
        setExplanationState("ready");
      })
      .catch(() => {
        if (!active) return;
        window.clearTimeout(pendingTimer);
        setExplanationState("error");
      });

    return () => {
      active = false;
      window.clearTimeout(pendingTimer);
    };
  }, [articleNumber]);

  // Після першого відкриття решта пояснень прогрівається у фоні, щоб
  // застосунок працював офлайн на будь-якій статті.
  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;
    const queue = EXPLANATION_ARTICLES.filter((item) => item !== articleNumber);
    const schedule = (callback: () => void) =>
      typeof window.requestIdleCallback === "function"
        ? window.requestIdleCallback(() => callback(), { timeout: 5000 })
        : window.setTimeout(callback, 900);

    const step = () => {
      if (cancelled) return;
      const batch = queue.splice(0, 4);
      if (!batch.length) return;
      void warmExplanations(batch).finally(() => {
        if (!cancelled) schedule(step);
      });
    };
    schedule(step);

    return () => {
      cancelled = true;
    };
    // Прогрів запускається один раз після гідратації.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  const selectedPointExplanation = selectedRule
    ? pointExplanation(explanation, selectedRule.point)
    : [];
  const explanationUrl = buildExplanationUrl(explanationMeta?.anchor, EXPLANATION_SOURCE_URL);

  const sourceUrl = selected ? officialRuleUrl(selected.article, selectedRule) : SOURCE_URL;

  const tdvKey =
    selected && selectedRule
      ? selectedRule.point === "—"
        ? selected.article
        : `${selected.article}-${selectedRule.point}`
      : "";
  const tdvRule = tdvKey
    ? (TDV_RULES[tdvKey] ?? (selected ? TDV_RULES[selected.article] : undefined))
    : undefined;
  const tdvMarks = tdvRule ? TDV_COLUMNS.filter((column) => tdvRule[column.id]) : [];

  const summaryItem = strictestOutcome(basket);
  const summaryStyle = summaryItem ? outcomeStyles(summaryItem.outcome) : undefined;
  const selectedInBasket =
    selected && selectedRule
      ? basket.some((item) => item.id === `${selected.article}-${selectedRule.point}`)
      : false;

  const draftText = useMemo(() => buildDraftText(basket, examineeType), [basket, examineeType]);

  const referenceText =
    selected && selectedRule ? buildReferenceText(selected, selectedRule) : "";

  function resetArticleReview() {
    setChecked([]);
    setSelectedRuleIndex("");
    setCopied("");
  }

  /**
   * Набір запиту лише фільтрує список: вибрана стаття не змінюється, доки
   * лікар сам не обере результат.
   */
  function changeQuery(value: string) {
    setQuery(value);
    setSearchOpen(true);
    setActiveHit(-1);
  }

  function clearQuery(options: { focus?: boolean; notify?: boolean } = {}) {
    setQuery("");
    setActiveHit(-1);
    setSearchOpen(false);
    if (options.focus) searchRef.current?.focus();
    if (options.notify) toast("Пошук очищено");
  }

  /** Вибір результату пошуку: відкриває статтю та її спеціальність. */
  function chooseHit(hit: SearchHit) {
    const article = hit.article;
    setSelectedId(article.id);
    setSpecialty(article.specialties[0]);
    setHistory((current) => addSearchHistory(current, query));
    setSearchOpen(false);
    setActiveHit(-1);
    resetArticleReview();
  }

  function runQuery(value: string) {
    setQuery(value);
    setSearchOpen(true);
    setActiveHit(-1);
    searchRef.current?.focus();
  }

  function handleSearchKeys(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      if (searchOpen) setSearchOpen(false);
      else clearQuery({ focus: true });
      return;
    }
    if (!searchHits.length) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSearchOpen(true);
      setActiveHit((current) => (current + 1) % Math.min(searchHits.length, 8));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setSearchOpen(true);
      setActiveHit((current) => {
        const limit = Math.min(searchHits.length, 8);
        return current <= 0 ? limit - 1 : current - 1;
      });
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const hit = searchHits[activeHit >= 0 ? activeHit : 0];
      if (hit) chooseHit(hit);
    }
  }

  function changeSpecialty(next: SpecialtyId) {
    const first = ARTICLES.find((article) => article.specialties.includes(next));
    setSpecialty(next);
    setQuery("");
    if (first) setSelectedId(first.id);
    resetArticleReview();
  }

  function selectFromList(article: VlkArticle) {
    if (article.id === selectedId) return;
    setSelectedId(article.id);
    if (query.trim()) setSpecialty(article.specialties[0]);
    resetArticleReview();
  }

  function selectRule(index: string) {
    setSelectedRuleIndex(index);
    setCopied("");
  }

  function toggleCheck(step: string, next: boolean) {
    setChecked((current) =>
      next ? [...new Set([...current, step])] : current.filter((item) => item !== step),
    );
  }

  function addArticleRuleToBasket(article: VlkArticle, rule: ArticleRule) {
    const articleChanged = selected?.id !== article.id;
    setSelectedId(article.id);
    if (query.trim()) setSpecialty(article.specialties[0]);
    const ruleIndex = (ARTICLE_RULES[article.article] ?? []).findIndex(
      (entry) => entry.point === rule.point && entry.condition === rule.condition,
    );
    setSelectedRuleIndex(ruleIndex >= 0 ? String(ruleIndex) : "");
    if (articleChanged) setChecked([]);
    setCopied("");
    const item = createBasketItem(article, rule);
    setBasket((current) => [...current.filter((entry) => entry.id !== item.id), item]);
    toast.success(
      `Стаття ${item.article}${item.point === "—" ? "" : `, пункт «${item.point}»`} — у зведенні`,
    );
  }

  function addToBasket() {
    if (!selected || !selectedRule) return;
    addArticleRuleToBasket(selected, selectedRule);
  }

  function openBasketItem(item: BasketItem) {
    const article = ARTICLES.find((entry) => entry.id === item.articleId);
    if (!article) return;
    setQuery("");
    setSpecialty(article.specialties[0]);
    setSelectedId(article.id);
    const index = (ARTICLE_RULES[article.article] ?? []).findIndex(
      (rule) => rule.point === item.point,
    );
    setSelectedRuleIndex(index >= 0 ? String(index) : "");
  }

  async function copyText(text: string, type: "reference" | "draft") {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(type);
      toast.success(type === "draft" ? "Зведення скопійовано" : "Формулювання скопійовано");
      window.setTimeout(() => setCopied(""), 1600);
    } catch {
      setCopied("");
      toast.error("Не вдалося скопіювати. Скопіюйте текст вручну.");
    }
  }

  function printDraft() {
    const safe = draftText.replace(
      /[&<>]/g,
      (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[character] ?? character,
    );
    const target = window.open("", "_blank", "width=860,height=720");
    if (!target) return;
    target.document.write(
      `<html lang="uk"><head><title>Чернетка ВЛК 402</title><style>body{font-family:Arial,sans-serif;margin:42px;color:#142f30}pre{white-space:pre-wrap;font:14px/1.55 Arial,sans-serif}h1{font-size:20px}@media print{body{margin:20mm}}</style></head><body><h1>VLK Навігатор · Чернетка</h1><pre>${safe}</pre></body></html>`,
    );
    target.document.close();
    target.focus();
    window.setTimeout(() => target.print(), 150);
  }

  /** Стрілки переміщують фокус компактним списком статей. */
  const handleListKeys = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    const rows = Array.from(
      listRef.current?.querySelectorAll<HTMLButtonElement>("[data-article-row]") ?? [],
    );
    if (!rows.length) return;
    const current = rows.indexOf(document.activeElement as HTMLButtonElement);
    let next = current;
    if (event.key === "ArrowDown") next = current < 0 ? 0 : Math.min(current + 1, rows.length - 1);
    if (event.key === "ArrowUp") next = current < 0 ? 0 : Math.max(current - 1, 0);
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = rows.length - 1;
    if (next !== current) {
      event.preventDefault();
      rows[next]?.focus();
    }
  }, []);

  return (
    <main className="min-h-screen bg-[#eef2ef] text-[#102d2e] xl:h-screen xl:overflow-hidden">
      <SwRegister />
      <Toaster position="bottom-center" />

      <header className="sticky top-0 z-30 border-b border-[#173f40]/12 bg-white xl:relative">
        <div className="mx-auto flex max-w-[1720px] flex-wrap items-center gap-2 px-3 py-2 lg:flex-nowrap lg:px-5">
          <div className="flex shrink-0 items-center gap-1.5">
            {showDashboard ? (
              <button
                type="button"
                onClick={goHome}
                aria-label="Назад до вибору спеціальності"
                title="Назад до вибору спеціальності"
                className={`grid size-10 shrink-0 place-items-center rounded-lg border border-[#173f40]/12 bg-white text-[#2d6f69] transition hover:bg-[#edf4f0] ${FOCUS_RING}`}
              >
                <ArrowLeft className="size-4" />
              </button>
            ) : null}

            {showDashboard ? (
              <button
                type="button"
                onClick={goHome}
                aria-label="На головну — вибір спеціальності"
                title="На головну — вибір спеціальності"
                className={`grid size-9 shrink-0 place-items-center rounded-lg bg-[#123f40] text-xs font-black text-white transition hover:bg-[#1a5554] ${FOCUS_RING}`}
              >
                402
              </button>
            ) : (
              <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#123f40] text-xs font-black text-white">
                402
              </div>
            )}

            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold leading-none">
                  {showDashboard ? (
                    <button
                      type="button"
                      onClick={goHome}
                      title="На головну — вибір спеціальності"
                      className={`rounded font-bold transition hover:text-[#2d6f69] ${FOCUS_RING}`}
                    >
                      VLK Навігатор
                    </button>
                  ) : (
                    "VLK Навігатор"
                  )}
                </h1>
                <span className="rounded-full bg-[#e8f1ed] px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-[#27645f]">
                  MVP
                </span>
              </div>
              <p className="mt-1 text-[11px] text-[#657b7a]">
                {showDashboard ? "Натисніть, щоб повернутися на головну" : "Навігація по Наказу МОУ №402"}
              </p>
            </div>
          </div>

          <div
            ref={searchBoxRef}
            className="relative order-3 w-full lg:order-none lg:mx-auto lg:max-w-2xl"
          >
            <label className="sr-only" htmlFor="vlk-search">
              Пошук статті за діагнозом, кодом МКХ-10 або номером статті
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-3.5 size-4 text-[#4d706d]" />
              <Input
                id="vlk-search"
                ref={searchRef}
                value={query}
                onChange={(event) => changeQuery(event.target.value)}
                onFocus={() => setSearchOpen(true)}
                onKeyDown={handleSearchKeys}
                placeholder="Діагноз, код МКХ-10, номер статті або прізвище лікаря…"
                autoComplete="off"
                role="combobox"
                aria-expanded={searchOpen}
                aria-controls="vlk-search-results"
                aria-autocomplete="list"
                aria-activedescendant={activeHit >= 0 ? `vlk-hit-${activeHit}` : undefined}
                className="h-11 w-full border-[#2b6e68]/35 bg-white pl-9 pr-10 text-sm shadow-sm"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => clearQuery({ focus: true, notify: true })}
                  aria-label="Очистити пошук"
                  className={`absolute right-1 top-1 grid size-9 place-items-center rounded-md text-[#4d706d] hover:bg-[#edf4f0] ${FOCUS_RING}`}
                >
                  <X className="size-4" />
                </button>
              ) : null}
            </div>

            {searchOpen ? (
              <div
                id="vlk-search-results"
                role="listbox"
                aria-label="Результати пошуку"
                className="absolute left-0 right-0 top-12 z-50 overflow-hidden rounded-xl border border-[#173f40]/15 bg-white shadow-lg"
              >
                {query.trim() ? (
                  searchHits.length ? (
                    <>
                      <p className="border-b border-[#173f40]/10 bg-[#f7faf8] px-3 py-1.5 text-[10px] font-bold text-[#5b7472]">
                        Знайдено {articleCountLabel(searchHits.length)}
                      </p>
                      <ul className="max-h-[52vh] overflow-y-auto scrollbar-thin">
                        {searchHits.slice(0, 8).map((hit, index) => (
                          <li key={hit.article.id}>
                            <button
                              type="button"
                              id={`vlk-hit-${index}`}
                              role="option"
                              aria-selected={index === activeHit}
                              onMouseEnter={() => setActiveHit(index)}
                              onClick={() => chooseHit(hit)}
                              className={`flex w-full items-start gap-2 px-3 py-2 text-left transition ${index === activeHit ? "bg-[#eef5f2]" : "hover:bg-[#f4f8f6]"}`}
                            >
                              <span className="grid size-7 shrink-0 place-items-center rounded-md bg-[#e7efeb] text-[11px] font-black text-[#205f59]">
                                {hit.article.article}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-xs font-semibold">
                                  <Highlighted text={hit.article.title} query={query} />
                                </span>
                                <span className="mt-0.5 block truncate text-[10px] text-[#687d7b]">
                                  <Highlighted text={hit.article.icd} query={query} /> ·{" "}
                                  {specialtyLabels(hit.article)}
                                </span>
                                <span className="mt-0.5 block text-[10px] font-bold text-[#3c6b66]">
                                  {MATCH_TYPE_LABELS[hit.matches[0]]}
                                </span>
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                      <p className="border-t border-[#173f40]/10 px-3 py-1.5 text-[10px] text-[#7a8a88]">
                        ↑↓ — вибір, Enter — відкрити, Esc — закрити
                      </p>
                    </>
                  ) : (
                    <div className="p-3">
                      <p className="text-xs font-bold">Нічого не знайдено</p>
                      <p className="mt-1 text-[11px] leading-4 text-[#617775]">
                        Спробуйте коротший запит, код МКХ-10 або номер статті. Приклади:
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {POPULAR_QUERIES.map((example) => (
                          <button
                            key={example}
                            type="button"
                            onClick={() => runQuery(example)}
                            className={`rounded-full border border-[#173f40]/12 bg-[#f7faf8] px-2 py-1 text-[10px] font-bold text-[#2d6f69] hover:bg-[#edf4f0] ${FOCUS_RING}`}
                          >
                            {example}
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                ) : (
                  <div className="p-3">
                    {history.length ? (
                      <>
                        <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#5b7472]">
                          Останні запити
                        </p>
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {history.map((item) => (
                            <button
                              key={item}
                              type="button"
                              onClick={() => runQuery(item)}
                              className={`rounded-full border border-[#173f40]/12 bg-white px-2 py-1 text-[10px] font-semibold text-[#3c6b66] hover:bg-[#f4f8f6] ${FOCUS_RING}`}
                            >
                              {item}
                            </button>
                          ))}
                        </div>
                      </>
                    ) : null}
                    <p className="mt-2 text-[10px] font-black uppercase tracking-[0.12em] text-[#5b7472]">
                      Популярні запити
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {POPULAR_QUERIES.map((example) => (
                        <button
                          key={example}
                          type="button"
                          onClick={() => runQuery(example)}
                          className={`rounded-full border border-[#173f40]/12 bg-[#f7faf8] px-2 py-1 text-[10px] font-bold text-[#2d6f69] hover:bg-[#edf4f0] ${FOCUS_RING}`}
                        >
                          {example}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-1.5">
            <a
              href={SOURCE_URL}
              target="_blank"
              rel="noreferrer"
              className={`hidden items-center gap-1.5 rounded-full bg-[#edf7f2] px-2.5 py-1 text-[11px] font-bold text-[#236757] hover:bg-[#e2f0ea] sm:flex ${FOCUS_RING}`}
              title={`База статей, пунктів, пояснень і ТДВ звірена за редакцією Наказу №402 від ${EDITION}. Автоматичної перевірки нових редакцій немає.`}
            >
              <ShieldCheck className="size-3.5" /> Оновлено: {EDITION}
            </a>
            <span
              className={`hidden items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold md:flex ${online ? "bg-[#edf7f2] text-[#236757]" : "bg-[#fff4df] text-[#765612]"}`}
            >
              {online ? <Wifi className="size-3.5" /> : <WifiOff className="size-3.5" />}
              {online ? "Онлайн" : "Офлайн"}
            </span>
            <Dialog open={directoryOpen} onOpenChange={setDirectoryOpen}>
              <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
                <DialogHeader>
                  <DialogTitle>Локальний довідник лікарів</DialogTitle>
                  <DialogDescription>
                    Вкажіть прізвища членів вашої ВЛК через кому. Вони зберігаються лише у цьому
                    браузері та стають доступними у глобальному пошуку.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-3 sm:grid-cols-2">
                  {SPECIALTIES.map((item) => (
                    <label key={item.id} className="text-sm font-semibold">
                      {item.label}
                      <Input
                        value={directory[item.id]}
                        onChange={(event) =>
                          setDirectory((current) => ({ ...current, [item.id]: event.target.value }))
                        }
                        placeholder="Напр. Іваненко, Петренко"
                        className="mt-1 bg-[#f8faf8] font-normal"
                      />
                    </label>
                  ))}
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setDirectory(EMPTY_DIRECTORY)}>
                    Очистити довідник
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <TdvDialog
              article={selected}
              selectedPoint={selectedRule?.point}
              trigger={
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-10 bg-white"
                  title="Відкрити повну таблицю додаткових вимог (Додаток 3)"
                >
                  <Table2 />
                  <span className="hidden sm:inline">ТДВ</span>
                </Button>
              }
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-10 bg-white"
                  aria-label="Ще дії"
                >
                  <MoreHorizontal />
                  <span className="hidden sm:inline">Ще</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel>Додаткові дії</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => setDirectoryOpen(true)}>
                  <UsersRound />
                  Довідник лікарів ВЛК
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <a href={SOURCE_URL} target="_blank" rel="noreferrer">
                    <History />
                    Останні зміни в Наказі №402
                  </a>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-[10px] font-normal text-[#617775]">
                  Оновлено: редакція від {EDITION}
                </DropdownMenuLabel>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {showDashboard ? (
        <>
      <div className="border-b border-[#173f40]/10 bg-white">
        <div className="mx-auto flex max-w-[1720px] flex-wrap items-center justify-between gap-2 px-3 py-1.5 lg:px-5">
          <div className="flex items-center gap-1 rounded-lg bg-[#eef3f0] p-1" aria-label="Режим роботи">
            {(["express", "detailed"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setMode(value)}
                aria-pressed={mode === value}
                className={`min-h-9 rounded-md px-3 py-1.5 text-xs font-bold transition ${FOCUS_RING} ${mode === value ? "bg-[#123f40] text-white shadow-sm" : "text-[#5c7472]"}`}
              >
                {value === "express" ? "Експрес" : "Детальний"}
              </button>
            ))}
          </div>
          <p className="hidden items-center gap-1.5 text-xs text-[#607775] md:flex">
            <ShieldCheck className="size-3.5 text-[#2e6e67]" />
            Довідкова навігація, не рішення ВЛК
          </p>
          <button
            type="button"
            onClick={() => setDraftOpen(true)}
            className={`flex min-h-9 items-center gap-2 rounded-lg border border-[#b88a2e]/20 bg-[#fff7df] px-3 py-1.5 text-xs font-bold text-[#6e531d] ${FOCUS_RING}`}
          >
            <ListPlus className="size-4" />
            Кошик діагнозів · {basket.length}
          </button>
        </div>
      </div>

      <div className="mx-auto grid max-w-[1720px] gap-2 p-2 lg:p-3 xl:h-[calc(100vh-105px)] xl:grid-cols-[330px_minmax(430px,1fr)_320px] xl:overflow-hidden">
        <aside className="flex min-h-[520px] flex-col overflow-hidden rounded-xl border border-[#173f40]/12 bg-white xl:min-h-0">
          <div className="border-b border-[#173f40]/10 p-2.5">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.13em] text-[#34736d]">
                  Навігація
                </p>
                <h2 className="mt-0.5 truncate text-sm font-bold">
                  {query.trim()
                    ? `Знайдено ${articleCountLabel(searchResults.length)}`
                    : (selectedSpecialty?.label ?? "Усі статті")}
                </h2>
              </div>
              {query.trim() ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => clearQuery({ notify: true })}
                  className="h-9 shrink-0 text-xs"
                  title="Повернутися до списку статей вибраної спеціальності"
                >
                  <RotateCcw />
                  Скинути пошук
                </Button>
              ) : null}
            </div>

            <div className="mt-2">
              <label className="sr-only" htmlFor="examinee-type">
                Категорія оглядуваного
              </label>
              <Select value={examineeType} onValueChange={setExamineeType}>
                <SelectTrigger id="examinee-type" className="h-10 w-full bg-[#f7faf8] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXAMINEE_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="mt-2 flex gap-1 overflow-x-auto pb-1 scrollbar-thin sm:grid sm:grid-cols-2 sm:overflow-visible sm:pb-0">
              {SPECIALTIES.map((item) => {
                const active = specialty === item.id;
                const count = ARTICLES.filter((article) =>
                  article.specialties.includes(item.id),
                ).length;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => changeSpecialty(item.id)}
                    aria-pressed={active}
                    className={`min-h-11 shrink-0 rounded-md border px-2 py-1.5 text-left text-[11px] transition sm:shrink ${FOCUS_RING} ${active ? "border-[#123f40] bg-[#123f40] text-white" : "border-[#173f40]/10 bg-[#f7f9f7] hover:bg-[#edf4f0]"}`}
                  >
                    <span className="block font-bold leading-tight">{specialtyName(item)}</span>
                    <span className={`text-[10px] ${active ? "text-[#b8d7d3]" : "text-[#738583]"}`}>
                      {articleCountLabel(count)}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="mt-2">
              <label className="block text-[10px] font-black uppercase tracking-[0.12em] text-[#5b7472]" htmlFor="outcome-filter">
                Фільтр за результатом
              </label>
              <Select
                value={outcomeFilter}
                onValueChange={(value) => setOutcomeFilter(value as OutcomeFilterId)}
              >
                <SelectTrigger id="outcome-filter" className="mt-1 h-10 w-full bg-[#f7faf8] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OUTCOME_FILTERS.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {outcomeFilter === "all" ? null : (
                <p className="mt-1 text-[10px] leading-4 text-[#607775]">
                  Показано статті, де є хоча б один пункт із таким дослівним результатом.
                </p>
              )}
            </div>
          </div>

          <div
            ref={listRef}
            onKeyDown={handleListKeys}
            className="min-h-0 flex-1 overflow-y-auto p-2 scrollbar-thin"
          >
            {listArticles.length ? (
              <ul className="space-y-1" aria-label={query.trim() ? "Знайдені статті" : `Статті · ${selectedSpecialty?.label ?? "усі"}`}>
                {listArticles.map((article) => {
                  const isSelected = selected?.id === article.id;
                  const hit = hitsById.get(article.id);
                  const matches = hit?.matches ?? [];
                  return (
                    <li key={article.id}>
                      <button
                        type="button"
                        data-article-row
                        aria-current={isSelected ? "true" : undefined}
                        onClick={() => selectFromList(article)}
                        className={`flex w-full min-h-11 items-start gap-2 rounded-lg border px-2 py-2 text-left transition ${FOCUS_RING} ${isSelected ? "border-[#2d7872]/45 bg-[#e9f2ee]" : "border-[#173f40]/10 bg-white hover:bg-[#f4f8f6]"}`}
                      >
                        <span
                          className={`grid size-8 shrink-0 place-items-center rounded-md text-xs font-black ${isSelected ? "bg-[#123f40] text-white" : "bg-[#e7efeb] text-[#205f59]"}`}
                        >
                          {article.article}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-xs font-semibold leading-4">
                            <Highlighted text={article.title} query={query} />
                          </span>
                          <span className="mt-0.5 block break-words text-[10px] leading-4 text-[#687d7b]">
                            <Highlighted text={article.icd} query={query} />
                          </span>
                          {matches.length ? (
                            <span className="mt-1 flex flex-wrap gap-1">
                              {matches.map((match) => (
                                <span
                                  key={match}
                                  title={MATCH_TYPE_LABELS[match]}
                                  className="rounded-full bg-[#eef3f0] px-1.5 py-0.5 text-[9px] font-bold text-[#3c6b66]"
                                >
                                  збіг: {MATCH_TYPE_SHORT[match]}
                                </span>
                              ))}
                            </span>
                          ) : null}
                          {hit?.evidence ? (
                            <span className="mt-1 block text-[9px] leading-3.5 text-[#6b807e]">
                              <Highlighted
                                text={snippetAround(hit.evidence.text, query)}
                                query={query}
                              />
                            </span>
                          ) : null}
                        </span>
                      </button>

                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="p-5 text-center text-sm text-[#667d7b]">
                Нічого не знайдено. Спробуйте коротшу назву, номер статті або код МКХ-10.
              </div>
            )}
          </div>

          <div className="shrink-0 border-t border-[#173f40]/10 px-2.5 py-2 text-[10px] leading-4 text-[#607775]">
            <span className="block font-bold text-[#2d6f69]">
              База перевірена за редакцією Наказу №402 від {EDITION}
            </span>
            У списку: {articleCountLabel(listArticles.length)}. Стрілки ↑↓ переміщують фокус списком.
          </div>
        </aside>

        <section className="flex min-h-[620px] flex-col overflow-hidden rounded-xl border border-[#173f40]/12 bg-white xl:min-h-0">
          {selected ? (
            <>
              <div className="shrink-0 border-b border-[#173f40]/10 px-3 py-2.5">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 items-start gap-2.5">
                    <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-[#123f40] text-sm font-black text-white">
                      {selected.article}
                    </span>
                    <div className="min-w-0">
                      <nav
                        aria-label="Шлях"
                        className="flex flex-wrap items-center gap-1 text-[10px] font-bold text-[#5b7472]"
                      >
                        <button
                          type="button"
                          onClick={goHome}
                          className={`rounded px-1 text-[#2d6f69] hover:underline ${FOCUS_RING}`}
                        >
                          {query.trim() ? "Пошук" : (selectedSpecialty?.label ?? "Спеціальність")}
                        </button>
                        <span aria-hidden>/</span>
                        <span className="text-[#102d2e]">Стаття {selected.article}</span>
                        {selectedRule ? (
                          <>
                            <span aria-hidden>/</span>
                            <span className="text-[#102d2e]">{pointLabel(selectedRule.point)}</span>
                          </>
                        ) : null}
                      </nav>
                      <p className="mt-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#34736d]">
                        {specialtyLabels(selected)}
                      </p>
                      <h2 className="mt-1 text-lg font-bold leading-tight sm:text-xl">
                        <Highlighted text={selected.title} query={query} />
                      </h2>
                      <p className="mt-1 break-words text-xs font-black text-[#123f40]">
                        МКХ-10: <Highlighted text={selected.icd} query={query} />
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={!selectedRule}
                      onClick={() => copyText(referenceText, "reference")}
                      className="h-9 bg-white"
                    >
                      {copied === "reference" ? <Check /> : <Copy />}
                      <span className="hidden sm:inline">
                        {copied === "reference" ? "Скопійовано" : "Копіювати"}
                      </span>
                    </Button>
                    <Button asChild size="sm" className="h-9 bg-[#123f40] text-white hover:bg-[#1a5554]">
                      <a href={sourceUrl} target="_blank" rel="noreferrer">
                        Відкрити у №402 <ExternalLink />
                      </a>
                    </Button>
                  </div>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-2.5 scrollbar-thin">
                <div className="grid items-start gap-2 sm:grid-cols-[minmax(0,1fr)_230px]">
                  <div className="min-w-0 rounded-lg border border-[#173f40]/10 bg-[#f7faf8] p-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#50716e]">
                        Дослівно з Наказу №402 · третя графа
                      </p>
                      <span className="shrink-0 rounded-full bg-[#e1ece7] px-2 py-1 text-[9px] font-black text-[#28665f]">
                        без узагальнень
                      </span>
                    </div>
                    <div className="mt-2 rounded-md border border-[#2d7771]/14 bg-white p-2.5">
                      <p className="text-[9px] font-black uppercase tracking-[0.11em] text-[#34736d]">
                        Включено · дослівно
                      </p>
                      <p className="mt-1 max-h-40 overflow-y-auto break-words pr-1 text-[11px] leading-[1.15rem] text-[#425f5d] scrollbar-thin">
                        <Highlighted text={selected.officialIncluded} query={query} />
                      </p>
                    </div>
                  </div>

                  <div
                    className={`min-w-0 rounded-lg border p-3 ${selectedRule && tdvRule ? "border-[#ba4a4a]/18 bg-[#fff3f1]" : "border-[#173f40]/10 bg-white"}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#50716e]">
                        ТДВ · Додаток 3
                      </p>
                      <TdvDialog
                        article={selected}
                        selectedPoint={selectedRule?.point}
                        trigger={
                          <button
                            type="button"
                            aria-label="Відкрити таблицю додаткових вимог на весь екран"
                            title="Відкрити таблицю на весь екран"
                            className={`grid size-7 shrink-0 place-items-center rounded-md border border-[#173f40]/12 bg-white text-[#2d6f69] hover:bg-[#edf5f1] ${FOCUS_RING}`}
                          >
                            <Maximize2 className="size-3.5" />
                          </button>
                        }
                      />
                    </div>
                    {!selectedRule ? (
                      <>
                        <p className="mt-1 text-sm font-bold">Оберіть пункт</p>
                        <p className="mt-1 text-[10px] leading-4 text-[#617775]">
                          Позначки з’являться автоматично.
                        </p>
                      </>
                    ) : tdvRule ? (
                      <>
                        <p className="mt-1 text-sm font-black text-[#8a3030]">
                          {tdvMarks.length} спец. позначок
                        </p>
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {tdvMarks.map((column) => (
                            <span
                              key={column.id}
                              className="rounded bg-white px-1.5 py-0.5 text-[9px] font-black text-[#8a3030]"
                            >
                              {column.id}: {tdvRule[column.id]}
                            </span>
                          ))}
                        </div>
                      </>
                    ) : (
                      <>
                        <p className="mt-1 text-sm font-bold text-[#5c7773]">Окремих позначок немає</p>
                        <p className="mt-1 text-[10px] leading-4 text-[#617775]">
                          Це не є автоматичним підтвердженням придатності.
                        </p>
                      </>
                    )}
                    <div className="mt-2 flex flex-wrap gap-1 border-t border-[#173f40]/10 pt-2">
                      <Button asChild variant="outline" size="sm" className="h-8 bg-white text-[10px]">
                        <a href={TDV_URL} target="_blank" rel="noreferrer">
                          ТДВ у №402 <ExternalLink />
                        </a>
                      </Button>
                      <Button asChild variant="ghost" size="sm" className="h-8 text-[10px]">
                        <a href={TDV_DOCX_URL} target="_blank" rel="noreferrer">
                          DOCX <BookOpen />
                        </a>
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="mt-2.5 flex items-center justify-between">
                  <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#50716e]">
                    Пункти статті · дослівно
                  </p>
                  <span className="text-[10px] text-[#617775]">{pointCountLabel(articleRules.length)}</span>
                </div>
                <RadioGroup value={selectedRuleIndex} onValueChange={selectRule} className="mt-1.5 gap-1.5">
                  {articleRules.map((rule, index) => {
                    const active = selectedRuleIndex === String(index);
                    const style = outcomeStyles(rule.outcome);
                    return (
                      <label
                        key={`${rule.point}-${index}`}
                        className={`grid cursor-pointer grid-cols-[28px_minmax(0,1fr)] gap-2 rounded-lg border p-2.5 transition sm:grid-cols-[28px_minmax(0,1fr)_auto] ${active ? "border-[#c58b28]/45 bg-[#fff8e7]" : "border-[#173f40]/10 bg-[#fafbf9] hover:border-[#2c756f]/25"}`}
                      >
                        <RadioGroupItem
                          value={String(index)}
                          className="mt-1"
                          aria-label={`${pointLabel(rule.point)}: ${rule.condition}`}
                        />
                        <span className="min-w-0">
                          <span className="block text-[10px] font-black uppercase tracking-[0.12em] text-[#36716c]">
                            {pointLabel(rule.point)}
                          </span>
                          <span className="mt-0.5 block text-xs leading-5 text-[#294b4b] sm:text-sm">
                            <Highlighted text={rule.condition} query={query} />
                          </span>
                          <span className="mt-1 block text-[11px] leading-4 text-[#4a6664]">
                            Результат за Розкладом: «{rule.outcome}»
                          </span>
                        </span>
                        <span
                          className={`col-start-2 self-start rounded-full px-2 py-1 text-[10px] font-black sm:col-start-3 ${style.badge}`}
                        >
                          {style.label}
                        </span>
                      </label>
                    );
                  })}
                </RadioGroup>

                {selectedRule ? (
                  <div
                    className={`mt-2.5 flex flex-col gap-2 rounded-lg border p-2.5 sm:flex-row sm:items-center sm:justify-between ${outcomeStyles(selectedRule.outcome).box}`}
                  >
                    <div className="min-w-0">
                      <p className="text-[10px] font-black uppercase tracking-[0.11em] text-[#5e7472]">
                        Попередній нормативний орієнтир · не рішення ВЛК
                      </p>
                      <p className="mt-1 text-sm font-bold leading-5">«{selectedRule.outcome}»</p>
                      {outcomeStyles(selectedRule.outcome).requiresLiteralReading ? (
                        <p className="mt-1 text-[10px] leading-4 text-[#5e7472]">
                          У четвертій графі Розкладу хвороб для цього пункту немає готової категорії
                          придатності — рішення приймається за поясненнями та відповідною графою.
                        </p>
                      ) : null}
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      onClick={addToBasket}
                      disabled={selectedInBasket}
                      className="h-10 shrink-0 bg-[#123f40] text-white hover:bg-[#1a5554]"
                    >
                      {selectedInBasket ? (
                        <>
                          <Check />У зведенні
                        </>
                      ) : (
                        <>
                          <Plus />
                          Додати до зведення
                        </>
                      )}
                    </Button>
                  </div>
                ) : null}

                <section className="mt-2.5 overflow-hidden rounded-lg border border-[#2d7771]/18 bg-[#f6faf8]">
                  <div className="flex flex-col gap-2 border-b border-[#173f40]/10 bg-[#eaf3ef] px-3 py-2.5 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-start gap-2">
                      <BookOpen className="mt-0.5 size-4 shrink-0 text-[#286c65]" />
                      <div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <h3 className="text-sm font-bold">
                            Офіційні пояснення до статті {selected.article}
                          </h3>
                          <span className="rounded-full bg-white px-2 py-0.5 text-[9px] font-black text-[#28665f]">
                            дослівно · {EXPLANATION_EDITION}
                          </span>
                        </div>
                        <p className="mt-1 text-[10px] leading-4 text-[#5c7472]">
                          Додаток 2 до Наказу №402. Текст не скорочено й не переказано.
                        </p>
                      </div>
                    </div>
                    <Button asChild variant="outline" size="sm" className="h-9 shrink-0 bg-white text-[10px]">
                      <a href={explanationUrl} target="_blank" rel="noreferrer">
                        Джерело <ExternalLink />
                      </a>
                    </Button>
                  </div>

                  {explanationMeta?.status === "absent" ? (
                    <div className="p-3 text-xs leading-5 text-[#627775]">
                      Для статті {selected.article} окремого пояснення в Додатку 2 чинної редакції
                      немає. Використовуйте дослівний рядок Розкладу хвороб, обраний пункт і ТДВ.
                    </div>
                  ) : explanationState === "loading" ? (
                    <div className="p-3 text-xs leading-5 text-[#627775]" aria-live="polite">
                      Завантаження дослівного пояснення…
                    </div>
                  ) : explanationState === "error" ? (
                    <div className="p-3 text-xs leading-5 text-[#7d4a2c]" aria-live="polite">
                      Пояснення не завантажилося. Перевірте з’єднання або відкрийте офіційне джерело.
                    </div>
                  ) : (
                    <div className="p-3">
                      {selectedRule ? (
                      <div className="rounded-md border border-[#b88a2e]/18 bg-[#fff9e9] p-2.5">
                        <p className="text-[9px] font-black uppercase tracking-[0.11em] text-[#755b22]">
                          Автоматично до {pointLabelGenitive(selectedRule.point)}
                        </p>
                        {
                          selectedPointExplanation.length ? (
                            <div className="mt-1.5 max-h-52 space-y-1.5 overflow-y-auto pr-1 scrollbar-gutter-stable scrollbar-thin">
                              {selectedPointExplanation.map((paragraph, index) => (
                                <p
                                  key={`${selected.article}-${selectedRule.point}-${index}`}
                                  className="text-[11px] leading-[1.2rem] text-[#4d4937]"
                                >
                                  <Highlighted text={paragraph} query={query} />
                                </p>
                              ))}
                            </div>
                          ) : (
                            <p className="mt-1.5 text-[11px] leading-4 text-[#685e44]">
                              У поясненні немає окремого підрозділу для цього пункту. Перегляньте
                              повний офіційний текст нижче — він застосовується до статті загалом.
                            </p>
                          )
                        }
                      </div>
                      ) : null}

                      <Accordion type="single" collapsible className="mt-2">
                        <AccordionItem
                          value="full-explanation"
                          className="overflow-hidden rounded-md border border-[#173f40]/10 bg-white px-2.5"
                        >
                          <AccordionTrigger className="py-2 text-xs font-bold hover:no-underline">
                            Повне офіційне пояснення · {explanationMeta?.paragraphs ?? 0} фрагментів
                          </AccordionTrigger>
                          <AccordionContent>
                            <div className="max-h-72 space-y-2 overflow-y-auto border-t border-[#173f40]/8 py-2 pr-1 scrollbar-gutter-stable scrollbar-thin">
                              {explanation?.paragraphs.map((paragraph, index) => (
                                <p
                                  key={`${selected.article}-explanation-${index}`}
                                  className="text-[11px] leading-5 text-[#405c5a]"
                                >
                                  <Highlighted text={paragraph} query={query} />
                                </p>
                              ))}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>

                      <div className="mt-2 flex items-start gap-2 rounded-md bg-[#edf4f1] p-2">
                        <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-[#2e6e67]" />
                        <p className="text-[9px] leading-4 text-[#56706d]">
                          Пояснення допомагає звірити критерії, але не встановлює діагноз і не
                          замінює оцінку лікаря, постанову ВЛК, графу Розкладу хвороб та ТДВ.
                        </p>
                      </div>
                    </div>
                  )}
                </section>

              </div>
            </>
          ) : (
            <div className="grid flex-1 place-items-center p-8 text-center">
              <div>
                <h2 className="font-bold">Нічого не знайдено</h2>
                <p className="mt-1 text-sm text-[#647876]">
                  Скоротіть запит або введіть код МКХ-10.
                </p>
              </div>
            </div>
          )}
        </section>

        <aside className="flex min-h-[520px] flex-col overflow-hidden rounded-xl border border-[#173f40]/12 bg-[#f7f9f7] xl:min-h-0">
          <div className="flex items-center justify-between border-b border-[#173f40]/10 bg-white px-3 py-2.5">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.13em] text-[#34736d]">
                Резюме стану
              </p>
              <h2 className="mt-0.5 text-sm font-bold">Попереднє зведення</h2>
            </div>
            <span className="rounded-full bg-[#e7efeb] px-2 py-1 text-[10px] font-bold text-[#326762]">
              локально
            </span>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-2.5 scrollbar-thin">
            {restoreNotice ? (
              <div className="mb-2 rounded-lg border border-[#b98b31]/25 bg-[#fff8e6] p-2 text-[10px] leading-4 text-[#6f592d]">
                {restoreNotice}
              </div>
            ) : null}

            {summaryItem && summaryStyle ? (
              <div className={`rounded-lg border p-3 ${summaryStyle.box}`} aria-live="polite">
                <div className="flex items-center justify-between gap-2">
                  <span className={`rounded-full px-2 py-1 text-[10px] font-black ${summaryStyle.badge}`}>
                    {summaryStyle.label}
                  </span>
                  <span className="text-[10px] font-bold text-[#5e7472]">найсуворіший орієнтир</span>
                </div>
                <h3 className="mt-2 font-black">
                  Стаття {summaryItem.article}
                  {summaryItem.point === "—" ? "" : `, пункт «${summaryItem.point}»`}
                </h3>
                <p className="mt-1.5 text-xs font-semibold leading-5">«{summaryItem.outcome}»</p>
                <p className="mt-2 text-[10px] leading-4 text-[#617775]">
                  Категорія: {examineeType}. Остаточна звірка — лікарем за графою і ТДВ.
                </p>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-[#2d7771]/30 bg-white p-4 text-center">
                <ClipboardCheck className="mx-auto size-5 text-[#37766f]" />
                <h3 className="mt-2 text-sm font-bold">Кошик порожній</h3>
                <p className="mt-1 text-xs leading-5 text-[#617775]">
                  Оберіть пункт статті та додайте його до зведення.
                </p>
              </div>
            )}

            <div className="mt-3 flex items-center justify-between">
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#5b7472]">
                Кошик діагнозів · {basket.length}
              </p>
              {basket.length ? (
                <button
                  type="button"
                  onClick={() => setBasket([])}
                  className={`rounded px-1 py-0.5 text-[10px] font-bold text-[#8a3b37] ${FOCUS_RING}`}
                >
                  Очистити
                </button>
              ) : null}
            </div>
            <div className="mt-1.5 space-y-1.5">
              {basket.map((item) => {
                const style = outcomeStyles(item.outcome);
                return (
                  <div key={item.id} className="rounded-lg border border-[#173f40]/10 bg-white p-2">
                    <div className="flex items-start justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => openBasketItem(item)}
                        className={`min-w-0 rounded text-left ${FOCUS_RING}`}
                      >
                        <span className="block text-xs font-bold">
                          Стаття {item.article}
                          {item.point === "—" ? "" : `-${item.point}`} · {item.title}
                        </span>
                        <span className="mt-0.5 block break-words text-[10px] text-[#697d7b]">
                          {item.icd} · {item.doctors}
                        </span>
                      </button>
                      <button
                        type="button"
                        aria-label={`Видалити статтю ${item.article} зі зведення`}
                        onClick={() => setBasket((current) => current.filter((entry) => entry.id !== item.id))}
                        className={`grid size-9 shrink-0 place-items-center rounded-md text-[#7b4a45] hover:bg-[#fff1ef] ${FOCUS_RING}`}
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                    <span className={`mt-1.5 inline-block rounded-full px-2 py-0.5 text-[9px] font-black ${style.badge}`}>
                      {style.label}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="mt-3 rounded-lg border border-[#b98b31]/20 bg-[#fff8e6] p-2.5">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[#956d1f]" />
                <p className="text-[10px] leading-4 text-[#6f592d]">
                  Алгоритм показує найсуворіший попередній орієнтир, але не враховує медичну
                  взаємодію кількох станів і не замінює постанову ВЛК.
                </p>
              </div>
            </div>
          </div>

          <div className="shrink-0 space-y-1.5 border-t border-[#173f40]/10 bg-white p-2.5">
            <Button
              type="button"
              size="sm"
              onClick={() => setDraftOpen(true)}
              disabled={!basket.length}
              className="h-10 w-full bg-[#123f40] text-xs text-white hover:bg-[#1a5554]"
            >
              <FileText />
              Створити зведення
            </Button>
            <div className="flex items-center justify-center gap-1.5 pt-1 text-[9px] text-[#718482]">
              <ShieldCheck className="size-3" />
              Дані зберігаються тільки в цьому браузері
            </div>
          </div>
        </aside>
      </div>
        </>
      ) : (
        <div className="mx-auto flex max-w-[900px] flex-col items-center px-4 py-10 text-center lg:py-16">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#34736d]">Крок 1</p>
          <h2 className="mt-2 text-2xl font-bold">Оберіть свою спеціальність</h2>
          <p className="mt-2 max-w-lg text-sm leading-6 text-[#5d7472]">
            Далі відкриється перелік статей Розкладу хвороб цього лікаря.
          </p>

          <div className="mt-6 grid w-full grid-cols-2 gap-2 sm:grid-cols-4">
            {SPECIALTIES.map((item) => {
              const count = ARTICLES.filter((article) => article.specialties.includes(item.id)).length;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => changeSpecialty(item.id)}
                  className={`min-h-16 rounded-xl border border-[#173f40]/12 bg-white px-3 py-3 text-left transition hover:border-[#2d7872]/45 hover:bg-[#f4f8f6] ${FOCUS_RING}`}
                >
                  <span className="block text-sm font-bold">{specialtyName(item)}</span>
                  <span className="mt-0.5 block text-[11px] text-[#738583]">{articleCountLabel(count)}</span>
                </button>
              );
            })}
          </div>

          <p className="mt-5 text-xs leading-5 text-[#617775]">
            Або скористайтеся пошуком угорі — за діагнозом, кодом МКХ-10 чи номером статті.
          </p>

          <TdvDialog
            trigger={
              <Button type="button" variant="outline" className="mt-4 h-10 bg-white">
                <Table2 />
                Таблиця додаткових вимог (ТДВ)
              </Button>
            }
          />

          {basket.length ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => setDraftOpen(true)}
              className="mt-5 h-10 bg-white"
            >
              <ListPlus />
              Відкрити збережене зведення · {basket.length}
            </Button>
          ) : null}

          <p className="mt-8 flex items-center gap-1.5 text-[11px] text-[#7a8a88]">
            <ShieldCheck className="size-3.5" />
            Довідкова навігація, не рішення ВЛК · оновлено: редакція від {EDITION}
          </p>
        </div>
      )}

      <Dialog open={draftOpen} onOpenChange={setDraftOpen}>
        <DialogContent className="max-h-[90vh] overflow-hidden p-0 sm:max-w-3xl">
          <DialogHeader className="border-b border-[#173f40]/10 p-4 pr-12">
            <DialogTitle>Зведення для перевірки лікарем</DialogTitle>
            <DialogDescription>
              Статті, пункти, ТДВ, чекліст і джерела. Довідкова навігація, не рішення ВЛК.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[58vh] overflow-y-auto scrollbar-thin">
            <div className="border-b border-[#173f40]/10 bg-white px-4 py-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#5b7472]">
                  Що ще треба перевірити перед постановою
                </p>
                <span className="text-[10px] font-bold text-[#617775]">
                  {checked.length}/{ANALYSIS_CHECKS.length}
                </span>
              </div>
              <div className="mt-1.5 grid gap-1.5 sm:grid-cols-2">
                {ANALYSIS_CHECKS.map((step) => (
                  <label
                    key={step}
                    className="flex min-h-10 cursor-pointer items-start gap-2 rounded-lg border border-[#173f40]/10 bg-white p-2"
                  >
                    <Checkbox
                      checked={checked.includes(step)}
                      onCheckedChange={(value) => toggleCheck(step, value === true)}
                      className="mt-0.5"
                    />
                    <span className="text-xs leading-4">{step}</span>
                  </label>
                ))}
              </div>
            </div>
            <pre className="whitespace-pre-wrap break-words bg-[#f8faf8] p-4 font-sans text-xs leading-5 text-[#294b4b]">
              {draftText}
            </pre>
          </div>
          <DialogFooter className="border-t border-[#173f40]/10 p-3">
            <Button variant="outline" onClick={() => copyText(draftText, "draft")}>
              {copied === "draft" ? (
                <>
                  <Check />
                  Скопійовано
                </>
              ) : (
                <>
                  <Copy />
                  Копіювати
                </>
              )}
            </Button>
            <Button variant="outline" onClick={printDraft}>
              <Printer />
              Друк / зберегти PDF
            </Button>
            <Button onClick={() => setDraftOpen(false)} className="bg-[#123f40] text-white">
              Готово
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

"use client";

import { VlkDialogContent } from "@/components/vlk/dialog-content";
import { ClinicalMotion } from "@/components/vlk/clinical-motion";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  SlidersHorizontal,
  BookOpen,
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  History,
  Maximize2,
  MoreHorizontal,
  Search,
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
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
import { CommandBrand } from "@/components/vlk/command-brand";
import { SpecialtyIcon } from "@/components/vlk/specialty-icon";
import { TdvContext } from "@/components/vlk/tdv-context";
import { EditionTicker } from "@/components/vlk/edition-ticker";
import { ThemeToggle } from "@/components/vlk/theme-controls";
import { WorkspaceTabs, type WorkspacePanel } from "@/components/vlk/workspace-tabs";
import { requestedPointIndex } from "@/lib/vlk-selection";
import { copyPlainText } from "@/lib/vlk-clipboard";
import { SessionResetDialog } from "@/components/vlk/session-reset-dialog";
import { clearStoredSession, readStored, writeStored, SESSION_RESET_KEY } from "@/lib/vlk-local-storage";
import { TdvDialog } from "@/components/vlk/tdv-dialog";
import {
  ExplanationDocument,
  FullExplanationDialog,
} from "@/components/vlk/explanation-document";
import { Highlighted } from "@/components/vlk/highlighted";
import { ARTICLE_RULES } from "@/lib/vlk-rules";
import { graphGuidance, SCHEDULE_GRAPHS, type ScheduleGraph } from "@/lib/vlk-graphs";
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
  type OutcomeFilterId,
} from "@/lib/vlk-outcomes";
import {
  MATCH_TYPE_LABELS,
  MATCH_TYPE_SHORT,
  POPULAR_QUERIES,
  searchArticles,
  snippetAround,
  articleIcdLabel,
  parseSearchQuery,
  type SearchHit,
} from "@/lib/vlk-search";
import {
  addSearchHistory,
  readSearchHistory,
  SEARCH_HISTORY_KEY,
} from "@/lib/vlk-search-history";
import {
  addRecent,
  readWorkspace,
  serializeWorkspace,
  WORKSPACE_KEY,
  type RecentEntry,
} from "@/lib/vlk-workspace";
import { EDITION_NOTICE } from "@/lib/vlk-edition";
import {
  EMPTY_DIRECTORY,
  EXAMINEE_TYPES,
  LEGACY_SESSION_KEYS,
  restoreSession,
  serializeSession,
  SESSION_KEY,
  specialtyLabels,
  type DoctorDirectory,
} from "@/lib/vlk-session";
import { TDV_COLUMNS, TDV_RULES } from "@/lib/vlk-tdv";
import {
  EXPLANATION_ARTICLES,
  EXPLANATION_META,
  EXPLANATION_SOURCE_URL,
  loadArticleExplanation,
  warmExplanations,
  type ArticleExplanation,
} from "@/lib/vlk-explanations";
import {
  articleExplanationParagraphs,
  pointExplanation,
} from "@/lib/vlk-explanation-view";
import { buildPointWordingText, buildReferenceText } from "@/lib/vlk-report";
import {
  explanationUrl as buildExplanationUrl,
  officialRuleUrl,
  TDV_DOCX_URL,
  TDV_URL,
} from "@/lib/vlk-links";

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ink)] focus-visible:ring-offset-1 focus-visible:ring-offset-background";

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

function fragmentCountLabel(count: number) {
  const lastTwo = count % 100;
  const last = count % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return `${count} фрагментів`;
  if (last === 1) return `${count} фрагмент`;
  if (last >= 2 && last <= 4) return `${count} фрагменти`;
  return `${count} фрагментів`;
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

export default function Home() {
  // Порожнє значення означає, що лікар ще не обрав спеціальність:
  // до цього моменту перший екран лишається чистим.
  const [specialty, setSpecialty] = useState<SpecialtyId | "">("");
  const [examineeType, setExamineeType] = useState<string>(EXAMINEE_TYPES[0]);
  const [scheduleGraph, setScheduleGraph] = useState<ScheduleGraph>("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [selectedRuleIndex, setSelectedRuleIndex] = useState("");
  const [directory, setDirectory] = useState<DoctorDirectory>(EMPTY_DIRECTORY);
  const [resetOpen, setResetOpen] = useState(false);
  const [outcomeFilter, setOutcomeFilter] = useState<OutcomeFilterId>("all");
  const [copied, setCopied] = useState<"reference" | "point" | "">("");
  const [online, setOnline] = useState(true);
  const [hydrated, setHydrated] = useState(false);
  const [explanationResult, setExplanationResult] = useState<{
    article: string; value?: ArticleExplanation; state: "ready" | "error";
  }>();
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<WorkspacePanel>("list");
  const [manualCopy, setManualCopy] = useState<string | null>(null);
  const copyTriggerRef = useRef<HTMLElement | null>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [directoryOpen, setDirectoryOpen] = useState(false);
  const [activeHit, setActiveHit] = useState(-1);
  const [history, setHistory] = useState<string[]>([]);
  const [lastSpecialty, setLastSpecialty] = useState<SpecialtyId | "">("");
  const [recent, setRecent] = useState<RecentEntry[]>([]);
  const listRef = useRef<HTMLDivElement>(null);
  const articleContentRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const searchBoxRef = useRef<HTMLDivElement>(null);
  const moreTriggerRef = useRef<HTMLButtonElement>(null);
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

      let stored = readStored(SESSION_KEY);
      if (!stored) {
        for (const key of LEGACY_SESSION_KEYS) {
          stored = readStored(key);
          if (stored) break;
        }
      }
      const restored = restoreSession(stored);
      setExamineeType(restored.examineeType);
      setScheduleGraph(restored.scheduleGraph);
      setDirectory(restored.directory);
      setHistory(readSearchHistory(readStored(SEARCH_HISTORY_KEY)));
      const workspace = readWorkspace(readStored(WORKSPACE_KEY));
      setLastSpecialty(workspace.specialty);
      setRecent(workspace.recent);
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
    writeStored(
      SESSION_KEY,
      serializeSession({ examineeType, scheduleGraph, directory }),
    );
  }, [directory, examineeType, hydrated, scheduleGraph]);

  useEffect(() => {
    if (!hydrated) return;
    writeStored(SEARCH_HISTORY_KEY, JSON.stringify(history));
  }, [history, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    writeStored(
      WORKSPACE_KEY,
      serializeWorkspace({ specialty: lastSpecialty, recent }),
    );
  }, [hydrated, lastSpecialty, recent]);

  // Клік поза пошуком закриває випадний список.
  useEffect(() => {
    if (!searchOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (!searchBoxRef.current?.contains(event.target as Node)) setSearchOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [searchOpen]);

  // The shortcut works from any workspace panel, without replacing browser Find.
  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.code === "KeyK") {
        event.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => {
      window.removeEventListener("keydown", handleShortcut);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (searchOpen && activeHit >= 0) {
      document.getElementById(`vlk-hit-${activeHit}`)?.scrollIntoView({ block: "nearest" });
    }
  }, [activeHit, searchOpen]);

  /** Повертає застосунок на головний екран вибору спеціальності. */
  const resetToHome = useCallback(() => {
    setSpecialty("");
    setMobilePanel("list");
    setQuery("");
    setSelectedId("");
    setSelectedRuleIndex("");
    setOutcomeFilter("all");
    setCopied("");
    setSearchOpen(false);
    setActiveHit(-1);
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

  const resetSessionView = useCallback(() => {
    resetToHome();
    setDirectory({ ...EMPTY_DIRECTORY });
    setExamineeType(EXAMINEE_TYPES[0]);
    setScheduleGraph("all");
    setHistory([]);
    setRecent([]);
    setLastSpecialty("");
    setDirectoryOpen(false);
    setResetOpen(false);
    setManualCopy(null);
  }, [resetToHome]);

  useEffect(() => {
    const reset = (event: StorageEvent) => {
      if (event.key === SESSION_RESET_KEY && event.newValue) resetSessionView();
    };
    window.addEventListener("storage", reset);
    return () => window.removeEventListener("storage", reset);
  }, [resetSessionView]);

  function finishSession() {
    const cleared = clearStoredSession();
    resetSessionView();
    if (cleared) toast.success("Сесію завершено. Локальні дані очищено.");
    else toast.error("Екран очищено, але браузер не дозволив видалити збережені дані. Перевірте налаштування сховища сайту.");
  }

  const searchHits = useMemo(
    () => (query.trim() ? searchArticles(query, directory) : []),
    [directory, query],
  );
  const searchResults = useMemo(() => searchHits.map((hit) => hit.article), [searchHits]);
  const requestedSearchPoint = useMemo(() => parseSearchQuery(query).find((term) => term.kind === "point")?.value, [query]);
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

  /** Чи є у статті хоча б один пункт із вибраною категорією результату. */
  const articleMatchesFilter = useCallback(
    (article: VlkArticle) =>
      outcomeFilter === "all" ||
      matchesOutcomeFilter(
        (ARTICLE_RULES[article.article] ?? []).map((rule) => rule.outcome),
        outcomeFilter,
      ),
    [outcomeFilter],
  );

  // Фільтр нічого не ховає: релевантні статті піднімаються вгору, решта
  // лишається в списку приглушеною.
  const listArticles = useMemo(() => {
    if (outcomeFilter === "all") return baseArticles;
    return [...baseArticles].sort(
      (a, b) => Number(articleMatchesFilter(b)) - Number(articleMatchesFilter(a)),
    );
  }, [articleMatchesFilter, baseArticles, outcomeFilter]);

  /** Остання спеціальність піднімається першою в сітці вибору. */
  const welcomeSpecialties = useMemo(() => {
    if (!lastSpecialty) return [...SPECIALTIES];
    return [...SPECIALTIES].sort(
      (a, b) => Number(b.id === lastSpecialty) - Number(a.id === lastSpecialty),
    );
  }, [lastSpecialty]);

  const filteredCount = useMemo(
    () => (outcomeFilter === "all" ? 0 : baseArticles.filter(articleMatchesFilter).length),
    [articleMatchesFilter, baseArticles, outcomeFilter],
  );
  // Вибрана стаття тримається за власним id, а не за поточним списком: набір
  // запиту фільтрує список, але не перемикає відкриту статтю.
  const selected =
    ARTICLES.find((article) => article.id === selectedId) ?? specialtyArticles[0];
  const selectedListIndex = listArticles.findIndex((article) => article.id === selected?.id);
  const selectedEvidence = selected ? hitsById.get(selected.id)?.evidence : undefined;
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
  useEffect(() => {
    if (selectedRuleIndex === "") return;
    const frame = requestAnimationFrame(() => {
      const container = articleContentRef.current;
      const point = container?.querySelector<HTMLElement>(`#vlk-point-${selectedRuleIndex}`);
      if (!container || !point || container.clientHeight === 0) return;
      const pointRect = point.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      if (pointRect.top < containerRect.top || pointRect.bottom > containerRect.bottom) {
        container.scrollTop += pointRect.top - containerRect.top - 12;
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [articleNumber, selectedRuleIndex, mobilePanel]);
  const explanationMeta = articleNumber ? EXPLANATION_META[articleNumber] : undefined;
  // Never label the previous article's text as the newly selected article.
  const explanation = explanationResult?.article === articleNumber ? explanationResult?.value : undefined;
  const explanationState = explanationResult?.article === articleNumber
    ? explanationResult?.state : explanationMeta?.status === "absent" ? "ready" : "loading";

  // Дослівне пояснення підвантажується лише для відкритої статті.
  useEffect(() => {
    if (!articleNumber) return;
    const meta = EXPLANATION_META[articleNumber];
    const absent = !meta || meta.status === "absent";
    let active = true;

    const request = absent
      ? Promise.resolve<ArticleExplanation | undefined>(undefined)
      : loadArticleExplanation(articleNumber);

    request
      .then((value) => {
        if (!active) return;
        setExplanationResult({ article: articleNumber, value, state: "ready" });
      })
      .catch(() => {
        if (!active) return;
        setExplanationResult({ article: articleNumber, state: "error" });
      });

    return () => {
      active = false;
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

  /** Дослівні фрагменти пояснення для конкретного пункту статті. */
  const pointExplanationFor = useCallback(
    (point: string) => pointExplanation(explanation, point),
    [explanation],
  );
  const fullExplanation = articleExplanationParagraphs(explanation);
  const selectedGraphGuidance = useMemo(
    () => graphGuidance(fullExplanation, scheduleGraph),
    [fullExplanation, scheduleGraph],
  );
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

  const referenceText =
    selected && selectedRule
      ? buildReferenceText(selected, selectedRule, scheduleGraph, selectedGraphGuidance)
      : "";

  /** Записує відкриту статтю або пункт в останні перегляди. */
  function rememberView(article: string, point = "") {
    setRecent((current) => addRecent(current, { article, point }));
  }

  function resetArticleReview() {
    setSelectedRuleIndex("");
    setCopied("");
  }

  /**
   * Набір запиту лише фільтрує список: вибрана стаття не змінюється, доки
   * лікар сам не обере результат.
   */
  function changeQuery(value: string) {
    setQuery(value);
    if (!selectedId && !specialty) setMobilePanel("list");
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

  /** Вибір результату пошуку: відкриває статтю, за потреби — конкретний пункт. */
  function chooseHit(hit: SearchHit, pointIndex?: number) {
    const article = hit.article;
    const rules = ARTICLE_RULES[article.article] ?? [];
    const resolvedIndex = pointIndex ?? requestedPointIndex(article.article, query);
    showArticlePanel();
    setSelectedId(article.id);
    setSpecialty(article.specialties[0]);
    setLastSpecialty(article.specialties[0]);
    setHistory((current) => addSearchHistory(current, query));
    setSearchOpen(false);
    setActiveHit(-1);
    setCopied("");
    setSelectedRuleIndex(resolvedIndex === undefined ? "" : String(resolvedIndex));
    rememberView(article.article, resolvedIndex === undefined ? "" : (rules[resolvedIndex]?.point ?? ""));
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

  function showArticlePanel() {
    setMobilePanel("article");
    if (window.matchMedia("(max-width: 1279px)").matches) {
      requestAnimationFrame(() => document.getElementById("vlk-article-heading")?.focus({ preventScroll: true }));
    }
  }

  function changeSpecialty(next: SpecialtyId) {
    showArticlePanel();
    const first = ARTICLES.find((article) => article.specialties.includes(next));
    setSpecialty(next);
    setLastSpecialty(next);
    setQuery("");
    if (first) setSelectedId(first.id);
    resetArticleReview();
  }

  function selectFromList(article: VlkArticle) {
    const hit = hitsById.get(article.id);
    if (query.trim() && hit) {
      chooseHit(hit);
      return;
    }
    showArticlePanel();
    if (article.id === selectedId) return;
    rememberView(article.article);
    setSelectedId(article.id);
    if (query.trim()) setSpecialty(article.specialties[0]);
    resetArticleReview();
  }

  function selectRule(index: string) {
    setSelectedRuleIndex(index);
    setCopied("");
    if (index !== "" && selected) {
      rememberView(selected.article, articleRules[Number(index)]?.point ?? "");
    }
  }

  /** Відкриває запис з останніх переглядів. */
  function openRecent(entry: RecentEntry) {
    const article = ARTICLES.find((item) => item.article === entry.article);
    if (!article) return;
    showArticlePanel();
    setQuery("");
    setSearchOpen(false);
    setSpecialty(article.specialties[0]);
    setLastSpecialty(article.specialties[0]);
    setSelectedId(article.id);
    setCopied("");
    const index = (ARTICLE_RULES[article.article] ?? []).findIndex(
      (rule) => rule.point === entry.point,
    );
    setSelectedRuleIndex(entry.point && index >= 0 ? String(index) : "");
    rememberView(entry.article, entry.point);
  }

  async function copyText(text: string, type: "reference" | "point") {
    copyTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    if (await copyPlainText(text)) {
      setCopied(type);
      toast.success("Формулювання пункту скопійовано");
      copyTimerRef.current = setTimeout(() => setCopied(""), 1600);
    } else {
      setCopied("");
      setManualCopy(text);
    }
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
    <main data-workspace={showDashboard} className="app-shell min-h-screen bg-[var(--background)] text-[var(--foreground)] xl:h-screen xl:overflow-hidden">
      <SwRegister />
      <ClinicalMotion />
      <Toaster position="bottom-center" />

      <header className="command-header sticky top-0 z-30 border-b border-[var(--brand-rule)]/60 bg-[var(--brand-bar)] shadow-none xl:relative">
        <div className="header-inner relative z-10 mx-auto flex max-w-[1720px] flex-wrap items-center gap-2 px-3 py-2 lg:flex-nowrap lg:px-5">
          <div className="header-brand flex shrink-0 items-center gap-1.5">
            {showDashboard ? (
              <button
                type="button"
                onClick={goHome}
                aria-label="Назад до вибору спеціальності"
                title="Назад до вибору спеціальності"
                className={`grid size-10 shrink-0 place-items-center rounded-lg border border-[var(--hairline)] bg-card text-[var(--accent-ink)] transition hover:bg-[var(--surface-sunken)] ${FOCUS_RING}`}
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
                className={`brand-command-button grid shrink-0 place-items-center rounded-lg ${FOCUS_RING}`}
              >
                <CommandBrand size={96} priority />
              </button>
            ) : (
              <button type="button" aria-label="Анімувати емблему VLK" className="brand-command-button grid shrink-0 place-items-center rounded-lg">
                <CommandBrand size={96} priority />
              </button>
            )}

            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold leading-none text-[var(--brand-bar-ink)]">
                  {showDashboard ? (
                    <button
                      type="button"
                      onClick={goHome}
                      title="На головну — вибір спеціальності"
                      className={`rounded font-bold transition hover:text-[var(--brand-hover)] ${FOCUS_RING}`}
                    >
                      VLK Навігатор
                    </button>
                  ) : (
                    "VLK Навігатор"
                  )}
                </h1>
                <span className="rounded-full border border-[var(--brand-rule)]/55 bg-[var(--brand-rule)]/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-[var(--brand-tint)]">
                  402
                </span>
              </div>
              <p className="mt-1 text-[11px] text-[var(--brand-bar-soft)]">
                {showDashboard ? "Статті, пункти та ТДВ" : `Наказ МОУ №402 · редакція ${EDITION}`}
              </p>
            </div>
          </div>

          <div
            ref={searchBoxRef}
            className="header-search relative order-3 w-full lg:order-none lg:mx-auto lg:max-w-2xl"
          >
            <label className="sr-only" htmlFor="vlk-search">
              Пошук статті за діагнозом, кодом МКХ-10 або номером статті
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-3.5 size-4 text-[var(--ink-soft)]" />
              <Input
                id="vlk-search"
                ref={searchRef}
                value={query}
                onChange={(event) => changeQuery(event.target.value)}
                onFocus={() => setSearchOpen(true)}
                onKeyDown={handleSearchKeys}
                placeholder="Діагноз, МКХ-10, стаття або лікар…"
                enterKeyHint="search"
                aria-keyshortcuts="Control+k Meta+k"
                autoComplete="off"
                role="combobox"
                aria-expanded={searchOpen}
                aria-controls="vlk-search-results"
                aria-autocomplete="list"
                aria-activedescendant={searchOpen && activeHit >= 0 ? `vlk-hit-${activeHit}` : undefined}
                className="h-11 w-full border-[var(--input)] bg-[var(--surface-muted)] pl-9 pr-10 text-sm shadow-none transition-shadow"
              />
              {!query ? <kbd className="search-shortcut" aria-hidden="true">Ctrl / ⌘ K</kbd> : null}
              {query ? (
                <button
                  type="button"
                  onClick={() => clearQuery({ focus: true, notify: true })}
                  aria-label="Очистити пошук"
                  className={`absolute right-1 top-1 grid size-9 place-items-center rounded-md text-[var(--ink-soft)] hover:bg-[var(--surface-sunken)] ${FOCUS_RING}`}
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
                className="absolute left-0 right-0 top-12 z-50 overflow-hidden rounded-xl border border-[var(--hairline)] bg-card shadow-lg"
              >
                {query.trim() ? (
                  searchHits.length ? (
                    <>
                      <p className="border-b border-[var(--hairline)] bg-[var(--surface-muted)] px-3 py-1.5 text-[10px] font-bold text-[var(--ink-soft)]">
                        Знайдено {articleCountLabel(searchHits.length)}
                      </p>
                      <ul className="max-h-[52vh] overflow-y-auto scrollbar-thin">
                        {searchHits.slice(0, 8).map((hit, index) => {
                          const hitRules = ARTICLE_RULES[hit.article.article] ?? [];
                          return (
                            <li
                              key={hit.article.id}
                              className={`border-b border-[var(--hairline)] last:border-b-0 ${index === activeHit ? "bg-[var(--surface-sunken)]" : ""}`}
                            >
                              <button
                                type="button"
                                id={`vlk-hit-${index}`}
                                role="option"
                                aria-selected={index === activeHit}
                                onMouseEnter={() => setActiveHit(index)}
                                onClick={() => chooseHit(hit)}
                                className={`flex w-full items-start gap-2 px-3 pt-2 text-left ${FOCUS_RING}`}
                              >
                                <span className="grid size-7 shrink-0 place-items-center rounded-md bg-[var(--secondary)] text-[11px] font-black text-[var(--accent-ink-strong)]">
                                  {hit.article.article}
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="block text-sm font-semibold leading-5">
                                    <Highlighted text={hit.article.title} query={query} />
                                  </span>
                                  <span className="mt-0.5 block text-xs leading-5 text-[var(--ink-muted)]">
                                    МКХ: <Highlighted text={articleIcdLabel(hit.article)} query={query} />
                                    <span className="block text-[var(--accent-ink)]">{MATCH_TYPE_LABELS[hit.matches[0]]}</span>
                                  </span>
                                </span>
                              </button>

                              <div className="flex flex-wrap gap-1 px-3 pb-2 pl-12 pt-1.5">
                                {hitRules.map((rule, pointIndex) => {
                                  if (requestedSearchPoint && rule.point !== requestedSearchPoint) return null;
                                  const style = outcomeStyles(rule.outcome);
                                  return (
                                    <span
                                      key={`${hit.article.id}-${rule.point}-${pointIndex}`}
                                      className="flex items-stretch overflow-hidden rounded-md border border-[var(--hairline)] bg-card"
                                    >
                                      <button
                                        type="button"
                                        onClick={() => chooseHit(hit, pointIndex)}
                                        title={rule.condition}
                                        className={`flex items-center gap-1.5 px-1.5 py-1 text-[10px] font-bold hover:bg-[var(--background)] ${FOCUS_RING}`}
                                      >
                                        <span className={`size-2 shrink-0 rounded-full ${style.dot}`} aria-hidden />
                                        {rule.point === "—" ? "без поділу" : rule.point.toUpperCase()}
                                        <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-black ${style.badge}`}>
                                          {style.label}
                                        </span>
                                      </button>
                                    </span>
                                  );
                                })}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                      <p className="border-t border-[var(--hairline)] px-3 py-1.5 text-[10px] text-[var(--ink-muted)]">
                        ↑↓ — вибір, Enter — відкрити, Esc — закрити
                      </p>
                    </>
                  ) : (
                    <div className="p-3">
                      <p className="text-xs font-bold">Нічого не знайдено</p>
                      <p className="mt-1 text-[11px] leading-4 text-[var(--ink-muted)]">
                        Спробуйте коротший запит, код МКХ-10 або номер статті. Приклади:
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {POPULAR_QUERIES.map((example) => (
                          <button
                            key={example}
                            type="button"
                            onClick={() => runQuery(example)}
                            className={`rounded-full border border-[var(--hairline)] bg-[var(--surface-muted)] px-2 py-1 text-[10px] font-bold text-[var(--accent-ink)] hover:bg-[var(--surface-sunken)] ${FOCUS_RING}`}
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
                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--ink-soft)]">
                          Останні запити
                        </p>
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {history.map((item) => (
                            <button
                              key={item}
                              type="button"
                              onClick={() => runQuery(item)}
                              className={`rounded-full border border-[var(--hairline)] bg-card px-2 py-1 text-[10px] font-semibold text-[var(--accent-ink)] hover:bg-[var(--background)] ${FOCUS_RING}`}
                            >
                              {item}
                            </button>
                          ))}
                        </div>
                      </>
                    ) : null}
                    <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--ink-soft)]">
                      Популярні запити
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {POPULAR_QUERIES.map((example) => (
                        <button
                          key={example}
                          type="button"
                          onClick={() => runQuery(example)}
                          className={`rounded-full border border-[var(--hairline)] bg-[var(--surface-muted)] px-2 py-1 text-[10px] font-bold text-[var(--accent-ink)] hover:bg-[var(--surface-sunken)] ${FOCUS_RING}`}
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

          <div className="header-actions ml-auto flex shrink-0 items-center gap-1.5">
            <ThemeToggle />

            <span
              className={`hidden items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11px] font-medium md:flex ${online ? "text-[var(--brand-bar-soft)]" : "bg-[var(--warning-bg)] text-[var(--warning-ink)]"}`}
            >
              {online ? <Wifi className="size-3.5" /> : <WifiOff className="size-3.5" />}
              {online ? "Онлайн" : "Офлайн"}
            </span>
            <Dialog open={directoryOpen} onOpenChange={setDirectoryOpen}>
              <VlkDialogContent returnFocusRef={moreTriggerRef} className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
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
                        className="mt-1 bg-[var(--surface-muted)] font-normal"
                      />
                    </label>
                  ))}
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setDirectory(EMPTY_DIRECTORY)}>
                    Очистити довідник
                  </Button>
                </DialogFooter>
              </VlkDialogContent>
            </Dialog>
            <TdvDialog
              article={selected}
              selectedPoint={selectedRule?.point}
              trigger={
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-10 text-[var(--brand-bar-soft)] hover:bg-white/10 hover:text-white"
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
                  variant="ghost"
                  size="sm"
                  className="h-10 text-[var(--brand-bar-soft)] hover:bg-white/10 hover:text-white"
                  aria-label="Ще дії"
                  ref={moreTriggerRef}
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
                    Наказ №402 · редакція корпусу
                  </a>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled={!hydrated} onSelect={() => setResetOpen(true)}>
                  <RotateCcw /> Завершити сесію
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-[10px] font-normal text-[var(--ink-muted)]">
                  Корпус: редакція від {EDITION}
                </DropdownMenuLabel>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <div className="workspace-meta">
      <EditionTicker />
      </div>

      {showDashboard ? (<>
      <WorkspaceTabs active={mobilePanel} onChange={setMobilePanel} articleCount={listArticles.length} />
      <div className="vlk-workspace mx-auto grid w-full max-w-[1920px] gap-3 p-2 lg:p-3">
        <aside className="command-sidebar flex min-h-[440px] flex-col overflow-hidden rounded-2xl border border-[var(--hairline-strong)] bg-card text-foreground shadow-[var(--shadow-soft)] xl:min-h-0"
          id="vlk-panel-list" role="tabpanel" aria-labelledby="vlk-tab-list" data-mobile-panel="list" data-active={mobilePanel === "list"}>
          <div className="sidebar-controls shrink-0 border-b border-[var(--hairline)] p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">{query.trim() ? "Результати пошуку" : "Статті за спеціальністю"}</h2>
              <span className="sidebar-count" role="status" aria-live="polite">{articleCountLabel(listArticles.length)}</span>
            </div>
            <label htmlFor="specialty-picker" className="sr-only">Спеціальність лікаря</label>
            <Select value={specialty} onValueChange={(value) => changeSpecialty(value as SpecialtyId)}>
              <SelectTrigger id="specialty-picker" className="min-h-11 w-full bg-card text-sm"><SelectValue placeholder="Спеціальність лікаря" /></SelectTrigger>
              <SelectContent>
                {SPECIALTIES.map((item) => <SelectItem key={item.id} value={item.id} className="min-h-11">
                  {specialtyName(item)} · {articleCountLabel(ARTICLES.filter((article) => article.specialties.includes(item.id)).length)}
                </SelectItem>)}
              </SelectContent>
            </Select>
            <div className="mt-2 flex items-center gap-2">
              <label htmlFor="schedule-graph" className="text-xs font-medium text-muted-foreground">Графа</label>
              <Select value={scheduleGraph} onValueChange={(value) => setScheduleGraph(value as ScheduleGraph)}>
                <SelectTrigger id="schedule-graph" className="h-10 min-w-0 flex-1 bg-card text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{SCHEDULE_GRAPHS.map((item) => <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <details className="review-settings mt-2">
              <summary className="flex min-h-10 cursor-pointer items-center gap-2 rounded-lg px-2 text-xs font-medium text-muted-foreground">
                <SlidersHorizontal className="size-3.5" />Параметри огляду
                {outcomeFilter !== "all" ? <span className="ml-auto text-[var(--accent-ink)]">Фільтр увімкнено</span> : <ChevronDown className="ml-auto size-3.5" />}
              </summary>
              <div className="space-y-2 pb-1 pt-2">
                <label htmlFor="examinee-type" className="block text-xs text-muted-foreground">Категорія оглядуваного</label>
                <Select value={examineeType} onValueChange={setExamineeType}>
                  <SelectTrigger id="examinee-type" className="h-10 w-full bg-card text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{EXAMINEE_TYPES.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent>
                </Select>
                <label htmlFor="outcome-filter" className="block text-xs text-muted-foreground">Фільтр за результатом</label>
                  <Select value={outcomeFilter} onValueChange={(value) => setOutcomeFilter(value as OutcomeFilterId)}>
                    <SelectTrigger id="outcome-filter" className="h-10 w-full bg-card text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{OUTCOME_FILTERS.map((item) => <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>)}</SelectContent>
                  </Select>
                {outcomeFilter !== "all" ? <p className="text-xs text-muted-foreground">Угорі — {articleCountLabel(filteredCount)} з обраним результатом. Інші статті залишаються доступними.</p> : null}
                <p className="text-xs leading-5 text-muted-foreground">Графа — контекст перегляду. Дослівний результат пункту не переобчислюється.</p>
              </div>
            </details>
            {query.trim() ? <button type="button" onClick={() => clearQuery({ notify: true })} className="mt-1 flex min-h-10 items-center gap-2 text-xs text-[var(--accent-ink)]"><RotateCcw className="size-3.5" />Скинути пошук</button> : null}
          </div>

          <div
            ref={listRef}
            onKeyDown={handleListKeys}
            className="article-list min-h-0 flex-1 overflow-y-auto p-2 scrollbar-thin"
          >
            {listArticles.length ? (
              <ul className="space-y-1" aria-label={query.trim() ? "Знайдені статті" : `Статті · ${selectedSpecialty?.label ?? "усі"}`}>
                {listArticles.map((article) => {
                  const isSelected = selected?.id === article.id;
                  const hit = hitsById.get(article.id);
                  const matches = hit?.matches ?? [];
                  const dimmed = !articleMatchesFilter(article);
                  return (
                    <li key={article.id} className={dimmed ? "article-unmatched" : ""}>
                      <button
                        type="button"
                        data-article-row
                        data-dimmed={dimmed ? "true" : undefined}
                        aria-current={isSelected ? "true" : undefined}
                        onClick={() => selectFromList(article)}
                        className={`flex min-h-11 w-full items-start gap-2 rounded-lg border px-2 py-2 text-left transition ${FOCUS_RING} ${isSelected ? "border-[var(--accent-ink)]/30 bg-[var(--secondary)] text-foreground" : "border-transparent bg-transparent text-foreground hover:border-[var(--hairline)] hover:bg-[var(--surface-muted)]"}`}
                      >
                        <span
                          className={`grid size-8 shrink-0 place-items-center rounded-md text-xs font-black ${isSelected ? "bg-[var(--primary)] text-white" : "bg-[var(--surface-sunken)] text-[var(--ink-soft)]"}`}
                        >
                          {article.article}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="line-clamp-2 text-sm font-semibold leading-5" title={article.title}>
                            <Highlighted text={article.title} query={query} />
                          </span>
                          <span className="mt-0.5 block truncate text-xs leading-4 text-[var(--ink-soft)]" title={articleIcdLabel(article)}>
                            <Highlighted text={articleIcdLabel(article)} query={query} />
                          </span>
                          {matches.length ? (
                            <span className="mt-1 flex flex-wrap gap-1">
                              {matches.map((match) => (
                                <span
                                  key={match}
                                  title={MATCH_TYPE_LABELS[match]}
                                  className="rounded-full bg-[var(--surface-sunken)] px-1.5 py-0.5 text-[9px] font-bold text-[var(--accent-ink)]"
                                >
                                  збіг: {MATCH_TYPE_SHORT[match]}
                                </span>
                              ))}
                            </span>
                          ) : null}
                          {hit?.evidence ? (
                            <span className="mt-1 block text-[9px] leading-3.5 text-[var(--ink-soft)]">
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
              <div className="px-5 py-10 text-center text-xs leading-6 text-[var(--ink-soft)]">
                Нічого не знайдено.
                <br />
                Спробуйте коротшу назву, номер статті або код МКХ-10.
              </div>
            )}
          </div>

          <div className="shrink-0 border-t border-[var(--hairline)] px-2.5 py-1.5 text-xs text-[var(--ink-soft)]" title={`Корпус: редакція ${EDITION}. Стрілки ↑↓ — навігація статтями.`}>
            {articleCountLabel(listArticles.length)}
          </div>
        </aside>

        <section id="vlk-panel-article" role="tabpanel" aria-label="Вибрана стаття" aria-labelledby="vlk-tab-article" data-mobile-panel="article" data-active={mobilePanel === "article"} className="normative-surface relative flex min-h-[560px] flex-col overflow-hidden rounded-2xl border border-[var(--brand-rule)]/25 bg-[var(--surface-muted)] shadow-[var(--shadow-soft)] xl:min-h-0">
          {selected ? (
            <>
              <div className="article-header shrink-0 border-b border-[var(--hairline)] px-4 py-2.5">
                <div className="flex flex-col gap-2">
                  <div className="flex min-w-[min(100%,280px)] flex-1 items-start gap-2.5">
                    <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-[var(--primary)] text-sm font-black text-white">
                      {selected.article}
                    </span>
                    <div className="min-w-0">
                      <nav
                        aria-label="Шлях"
                        className="flex flex-wrap items-center gap-1 text-[10px] font-bold text-[var(--ink-soft)]"
                      >
                        <button
                          type="button"
                          onClick={goHome}
                          className={`rounded px-1 text-[var(--accent-ink)] hover:underline ${FOCUS_RING}`}
                        >
                          {query.trim() ? "Пошук" : (selectedSpecialty?.label ?? "Спеціальність")}
                        </button>
                        <span aria-hidden>/</span>
                        <span className="text-[var(--foreground)]"><Highlighted text={`Стаття ${selected.article}`} query={query} /></span>
                        {selectedRule ? (
                          <>
                            <span aria-hidden>/</span>
                            <span className="text-[var(--foreground)]">{pointLabel(selectedRule.point)}</span>
                          </>
                        ) : null}
                        {specialtyLabels(selected) === (selectedSpecialty?.label ?? "") ? null : (
                          <span className="specialty-caption font-medium text-[var(--ink-soft)]">
                            <span aria-hidden className="mr-1 text-[var(--hairline-strong)]">·</span>
                            {specialtyLabels(selected)}
                          </span>
                        )}
                      </nav>
                      <h2 id="vlk-article-heading" tabIndex={-1} className="mt-1 text-xl font-semibold leading-tight tracking-[-0.02em] outline-none sm:text-[22px]">
                        <Highlighted text={selected.title} query={query} />
                      </h2>
                      <p className="mt-1 break-words text-xs font-black text-[var(--accent-ink-strong)]">
                        МКХ-10: <Highlighted text={articleIcdLabel(selected)} query={query} />
                      </p>
                    </div>
                  </div>
                  <div className="article-toolbar flex flex-wrap items-center gap-1.5">
                    <div className="article-pagination mr-auto flex items-center gap-1">
                      <Button type="button" variant="ghost" size="icon" aria-label="Попередня стаття" title="Попередня стаття"
                        disabled={selectedListIndex <= 0} onClick={() => selectFromList(listArticles[selectedListIndex - 1])}><ChevronLeft /></Button>
                      <span className="text-xs tabular-nums text-muted-foreground">{selectedListIndex < 0 ? "Поза списком" : `${selectedListIndex + 1} / ${listArticles.length}`}</span>
                      <Button type="button" variant="ghost" size="icon" aria-label="Наступна стаття" title="Наступна стаття"
                        disabled={selectedListIndex < 0 || selectedListIndex >= listArticles.length - 1} onClick={() => selectFromList(listArticles[selectedListIndex + 1])}><ChevronDown className="-rotate-90" /></Button>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={!selectedRule}
                      aria-label="Копіювати пункт із поясненнями"
                      title="Копіювати пункт із поясненнями"
                      onClick={() => copyText(referenceText, "reference")}
                      className="h-9 bg-card"
                    >
                      {copied === "reference" ? <Check /> : <Copy />}
                      <span className="hidden sm:inline">
                        {copied === "reference" ? "Скопійовано" : "Копіювати"}
                      </span>
                    </Button>
                    <Button asChild size="sm" className="h-9 bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)]">
                      <a href={sourceUrl} target="_blank" rel="noreferrer">
                        Відкрити у №402 <ExternalLink />
                      </a>
                    </Button>
                  </div>
                </div>
              </div>

              <div key={selected.id} ref={articleContentRef} className="article-content relative min-h-0 flex-1 overflow-y-auto p-4 scrollbar-thin">
                {query.trim() && selectedEvidence ? (
                  <div className="search-context mb-3 rounded-lg border px-3 py-2 text-xs" aria-label="Збіг у вибраній статті">
                    <span className="font-semibold">{MATCH_TYPE_LABELS[selectedEvidence.match]}: </span>
                    <Highlighted text={snippetAround(selectedEvidence.text, query)} query={query} />
                  </div>
                ) : null}
                <CommandBrand
                  decorative
                  size={260}
                  className="pointer-events-none absolute bottom-0 right-0 max-w-[40%] opacity-[0.025]"
                />
                <div className="point-section-heading flex items-center justify-between">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--ink-soft)]">
                    Пункти статті
                  </p>
                  <span className="text-[10px] text-[var(--ink-muted)]">
                    {pointCountLabel(articleRules.length)}
                  </span>
                </div>

                <ul className="mt-2 space-y-2">
                  {articleRules.map((rule, index) => {
                    const active = selectedRuleIndex === String(index);
                    const style = outcomeStyles(rule.outcome);
                    // Фільтр не ховає пункти: нерелевантні лише приглушені.
                    const dimmed =
                      outcomeFilter !== "all" && !matchesOutcomeFilter([rule.outcome], outcomeFilter);
                    const pointText = pointExplanationFor(rule.point);
                    const pointTdv =
                      TDV_RULES[rule.point === "—" ? selected.article : `${selected.article}-${rule.point}`] ??
                      TDV_RULES[selected.article];
                    const pointMarks = pointTdv
                      ? TDV_COLUMNS.filter((column) => pointTdv[column.id])
                      : [];

                    return (
                      <li key={`${rule.point}-${index}`} className={dimmed ? "opacity-45" : ""}>
                        <div
                          className={`overflow-hidden rounded-xl border transition ${active ? "command-selected-rule border-[var(--warning-border)]/45 bg-[var(--warning-bg)] shadow-[var(--shadow-soft)]" : "border-[var(--hairline)] bg-card hover:border-[var(--accent-ink)]/25 hover:bg-[var(--surface-muted)]"}`}
                        >
                          <button
                            type="button"
                            data-point-row
                            id={`vlk-point-${index}`}
                            onClick={() => selectRule(active ? "" : String(index))}
                            aria-expanded={active}
                            className={`flex w-full items-center gap-3 p-3 text-left ${FOCUS_RING}`}
                          >
                            <span
                              className={`grid size-8 shrink-0 place-items-center rounded-md text-xs font-black uppercase ${active ? "bg-[var(--primary)] text-white" : "bg-[var(--secondary)] text-[var(--accent-ink-strong)]"}`}
                            >
                              {rule.point === "—" ? "•" : rule.point}
                            </span>
                            <span className="min-w-0 flex-1">
                              {active ? (
                                <span className="mb-1 block text-[11px] font-semibold text-[var(--ink-soft)]">
                                  Стан за пунктом · дослівно
                                </span>
                              ) : null}
                              <span className="point-preview block text-sm leading-5 text-[var(--foreground)]">
                                <Highlighted text={rule.condition} query={query} />
                              </span>
                            </span>
                            <span
                              className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-black ${style.badge}`}
                            >
                              {style.label}
                            </span>
                            {scheduleGraph === "all" ? null : (
                              <span
                                className="hidden shrink-0 rounded-full border border-[var(--hairline)] bg-card px-2 py-1 text-[10px] font-bold text-[var(--ink-soft)] sm:inline"
                                title="Обрана графа — контекст перегляду, не автоматичний висновок"
                              >
                                гр. {scheduleGraph}
                              </span>
                            )}
                            <ChevronDown
                              className={`size-4 shrink-0 text-[var(--ink-soft)] transition ${active ? "rotate-180" : ""}`}
                            />
                          </button>

                          {active ? (
                            <div className="border-t border-[var(--hairline)] bg-white/70 px-3 pb-3 pt-2.5">
                              <ol className="clinical-context" aria-label="Контекст вибраного пункту">
                                <li><span>Стаття</span><b>{selected.article}</b></li>
                                <li><span>Пункт</span><b>{rule.point === "—" ? "без поділу" : rule.point}</b></li>
                                <li><span>Графа</span><b>{scheduleGraph === "all" ? "не обрана" : scheduleGraph}</b></li>
                              </ol>
                              <div className={`mt-3 border-l-2 pl-3 ${style.bar}`}>
                                <p className="text-[11px] font-semibold text-[var(--ink-soft)]">
                                  Попередній нормативний орієнтир · не рішення ВЛК
                                </p>
                                <p className="mt-1 text-sm font-bold leading-5">«{rule.outcome}»</p>
                                <p className="mt-1 text-[10px] leading-4 text-[var(--ink-soft)]">
                                  {scheduleGraph === "all"
                                    ? "Графу не вибрано — звірте її за направленням або обліковою категорією."
                                    : `Контекст перегляду: графа ${scheduleGraph}. Результат наведено дослівно без автоматичної заміни.`}
                                </p>
                                {style.requiresLiteralReading ? (
                                  <p className="mt-1 text-[10px] leading-4 text-[var(--ink-soft)]">
                                    У четвертій графі Розкладу хвороб для цього пункту немає готової
                                    категорії придатності — рішення приймається за поясненнями та
                                    відповідною графою.
                                  </p>
                                ) : null}
                              </div>

                              <div className="mt-3 border-t border-[var(--hairline)] pt-2.5">
                                <p className="text-[11px] font-semibold text-[var(--ink-soft)]">
                                  ТДВ для {pointLabelGenitive(rule.point)}
                                </p>
                                <TdvDialog article={selected} selectedPoint={rule.point} trigger={<Button variant="outline" size="sm" className="mt-2 min-h-11">Звірити ТДВ <Maximize2 /></Button>} />
                                {pointMarks.length ? (
                                  <div className="mt-1.5 flex flex-wrap gap-1">
                                    {pointMarks.map((column) => (
                                      <TdvContext key={column.id} columnId={column.id} mark={pointTdv?.[column.id]}>
                                        {column.id}: {pointTdv?.[column.id]}
                                      </TdvContext>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="mt-1 text-[10px] leading-4 text-[var(--ink-soft)]">
                                    Окремих позначок немає. Це не є автоматичним підтвердженням
                                    придатності.
                                  </p>
                                )}
                              </div>

                              {explanationMeta?.status === "absent" ? null : pointText.length ? (
                                <Accordion type="single" collapsible className="mt-1">
                                  <AccordionItem
                                    value="point-explanation"
                                    className="border-t border-[var(--hairline)]"
                                  >
                                    <AccordionTrigger className="py-2 text-[11px] font-semibold text-[var(--accent-ink-strong)] hover:no-underline">
                                      Повне пояснення до {pointLabelGenitive(rule.point)} ·{" "}
                                      {fragmentCountLabel(pointText.length)}
                                    </AccordionTrigger>
                                    <AccordionContent>
                                      <div className="max-h-[65vh] space-y-1.5 overflow-y-auto border-t border-[var(--hairline)] py-2 pr-1 scrollbar-thin">
                                        <ExplanationDocument article={selected.article} paragraphs={explanation?.paragraphs ?? []} excerpt={pointText} query={query} />
                                      </div>
                                    </AccordionContent>
                                  </AccordionItem>
                                </Accordion>
                              ) : explanationState === "ready" && explanation ? (
                                <div className="mt-2 rounded-md border border-[var(--warning-border)]/25 bg-[var(--warning-bg)] p-2.5 text-xs leading-5 text-[var(--warning-ink)]">
                                  У Додатку 2 немає окремо виділеного розділу для {pointLabelGenitive(rule.point)}.
                                  Повне пояснення до статті доступне нижче пунктів.
                                </div>
                              ) : null}

                              <div className="mt-3 flex flex-wrap gap-1.5 border-t border-[var(--hairline)] pt-2.5">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    copyText(
                                      buildPointWordingText(selected, rule, scheduleGraph),
                                      "point",
                                    )
                                  }
                                  className="h-9 bg-card text-xs"
                                >
                                  {copied === "point" ? <Check /> : <Copy />}
                                  {copied === "point"
                                    ? "Формулювання скопійовано"
                                    : "Скопіювати формулювання пункту"}
                                </Button>
                                <Button asChild size="sm" variant="outline" className="h-9 bg-card text-xs">
                                  <a
                                    href={officialRuleUrl(selected.article, rule)}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    Відкрити у №402 <ExternalLink />
                                  </a>
                                </Button>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>

                <div className="article-reference-grid mt-4 grid items-start gap-3 sm:grid-cols-[minmax(0,1fr)_200px]">
                  <div className="min-w-0 overflow-hidden rounded-lg border border-[var(--hairline)] bg-[var(--surface-muted)]">
                    <Accordion type="single" collapsible defaultValue="included">
                      <AccordionItem value="included" className="border-none px-3">
                        <AccordionTrigger className="py-2.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--ink-soft)] hover:no-underline">
                          Дослівно з Наказу №402 · «Включено»
                        </AccordionTrigger>
                        <AccordionContent>
                          <p className="normative-measure break-words pb-3 text-sm leading-6 text-[var(--foreground)]">
                            <Highlighted text={selected.officialIncluded} query={query} />
                          </p>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  </div>

                  <div
                    className={`min-w-0 rounded-lg border p-3 ${selectedRule && tdvRule ? "border-[var(--critical-ink)]/18 bg-[var(--critical-bg)]" : "border-[var(--hairline)] bg-card"}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--ink-soft)]">
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
                            className={`grid size-7 shrink-0 place-items-center rounded-md border border-[var(--hairline)] bg-card text-[var(--accent-ink)] hover:bg-[var(--surface-sunken)] ${FOCUS_RING}`}
                          >
                            <Maximize2 className="size-3.5" />
                          </button>
                        }
                      />
                    </div>
                    <p className="mt-1 text-xs font-bold">
                      {!selectedRule
                        ? "Оберіть пункт"
                        : tdvRule
                          ? `${tdvMarks.length} спец. позначок`
                          : "Окремих позначок немає"}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1 border-t border-[var(--hairline)] pt-2">
                      <Button asChild variant="outline" size="sm" className="h-8 bg-card text-[10px]">
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

                <section className="mt-3 flex flex-col gap-3 rounded-xl border border-[var(--accent-ink)]/20 bg-[var(--secondary)] p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-start gap-2.5">
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[var(--secondary)] text-[var(--accent-ink-strong)]">
                      <BookOpen className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-[var(--foreground)]">
                        Повне офіційне пояснення до статті {selected.article}
                      </h3>
                      <p className="mt-0.5 text-xs leading-5 text-[var(--ink-soft)]">
                        {explanationMeta?.status === "absent"
                          ? "Окремого пояснення в Додатку 2 немає."
                          : explanationState === "loading"
                            ? "Завантажуємо повний дослівний текст…"
                            : explanationState === "error"
                              ? "Не вдалося завантажити текст. Відкрийте офіційне джерело."
                            : `${fragmentCountLabel(fullExplanation.length || explanationMeta?.paragraphs || 0)} дослівного тексту${fullExplanation.length ? " — без скорочення" : ""}.`}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {explanationMeta?.status !== "absent" && explanationState === "ready" && fullExplanation.length ? (
                      <FullExplanationDialog
                        article={selected.article}
                        paragraphs={fullExplanation}
                        query={query}
                        sourceUrl={explanationUrl}
                      />
                    ) : null}
                    <Button asChild variant="outline" className="min-h-11 bg-card">
                      <a href={explanationUrl} target="_blank" rel="noreferrer">
                        Джерело <ExternalLink />
                      </a>
                    </Button>
                  </div>
                </section>

                {scheduleGraph === "all" ? null : (
                  <section className="mt-3 overflow-hidden rounded-lg border border-[var(--hairline)] bg-card">
                    <Accordion type="single" collapsible>
                      <AccordionItem value="graph-guidance" className="border-none px-3">
                        <AccordionTrigger className="py-2.5 text-left text-xs font-semibold text-[var(--foreground)] hover:no-underline">
                          Пояснення з прямою згадкою графи {scheduleGraph}
                          <span className="ml-auto mr-2 rounded-full bg-[var(--secondary)] px-2 py-0.5 text-[10px] text-[var(--accent-ink-strong)]">
                            {selectedGraphGuidance.length}
                          </span>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="border-t border-[var(--hairline)] py-2">
                            {selectedGraphGuidance.length ? (
                              <ExplanationDocument
                                article={selected.article}
                                paragraphs={fullExplanation}
                                excerpt={selectedGraphGuidance}
                                query={query}
                              />
                            ) : (
                              <p className="text-xs leading-5 text-[var(--ink-muted)]">
                                В офіційному поясненні до цієї статті немає окремого абзацу з
                                прямою згадкою графи {scheduleGraph}. Застосовуйте дослівний текст
                                пункту та перевіряйте офіційне джерело.
                              </p>
                            )}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  </section>
                )}



              </div>
            </>
          ) : (
            <div className="grid flex-1 place-items-center p-10 text-center">
              <div>
                <h2 className="text-base font-semibold tracking-tight">{listArticles.length ? "Оберіть статтю" : "Нічого не знайдено"}</h2>
                <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-[var(--ink-muted)]">
                  {listArticles.length ? "Відкрийте результат пошуку або статтю зі списку." : "Скоротіть запит або введіть код МКХ-10."}
                </p>
              </div>
            </div>
          )}
        </section>

      </div>
        </>
      ) : (
        <div className="welcome-screen mx-auto flex max-w-[1040px] flex-col items-center px-4 py-6 text-center sm:px-6 lg:py-8">
          {EDITION_NOTICE ? (
            <a
              href={EDITION_NOTICE.url}
              target="_blank"
              rel="noreferrer"
              className="mb-4 flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--warning-border)]/25 bg-[var(--warning-bg)] px-3 py-2 text-xs font-bold text-[var(--warning-ink)]"
            >
              <AlertTriangle className="size-4" />
              {EDITION_NOTICE.message}
            </a>
          ) : null}

          {lastSpecialty ? (
            <Button
              type="button"
              onClick={() => changeSpecialty(lastSpecialty)}
              className="h-11 bg-[var(--primary)] px-5 text-sm text-white hover:bg-[var(--primary-hover)]"
            >
              Продовжити як{" "}
              {SPECIALTIES.find((item) => item.id === lastSpecialty)?.label ?? "лікар"}
              <ChevronDown className="-rotate-90" />
            </Button>
          ) : null}

          <h2 className="mt-4 max-w-2xl text-2xl font-semibold leading-tight sm:text-[28px]">
            Робоче місце лікаря ВЛК
          </h2>
          <p className="mt-2 max-w-xl text-base leading-6 text-[var(--ink-soft)]">
            Оберіть спеціальність або знайдіть норму за діагнозом, кодом МКХ-10 чи номером статті.
          </p>



          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <span className="text-[11px] font-bold text-[var(--ink-soft)]">Спробуйте:</span>
            {POPULAR_QUERIES.slice(0, 4).map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => runQuery(example)}
                className={`rounded-full border border-[var(--hairline)] bg-card px-3.5 py-1.5 text-[12px] font-medium text-[var(--accent-ink)] shadow-[var(--shadow-soft)] transition hover:border-[var(--accent-ink)]/25 hover:text-[var(--accent-ink-strong)] ${FOCUS_RING}`}
              >
                {example}
              </button>
            ))}
          </div>

          {recent.length ? (
            <div className="mt-4 w-full">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--ink-soft)]">
                Нещодавно переглянуті
              </p>
              <div className="mt-1.5 flex flex-wrap justify-center gap-1">
                {recent.map((entry) => {
                  const article = ARTICLES.find((item) => item.article === entry.article);
                  if (!article) return null;
                  const rules = ARTICLE_RULES[entry.article] ?? [];
                  const index = entry.point ? rules.findIndex((rule) => rule.point === entry.point) : -1;
                  const style = index >= 0 ? outcomeStyles(rules[index].outcome) : undefined;
                  return (
                    <button
                      key={`${entry.article}-${entry.point}`}
                      type="button"
                      onClick={() => openRecent(entry)}
                      title={article.title}
                      className={`flex items-center gap-1.5 rounded-full border border-[var(--hairline)] bg-card px-2 py-1 text-[11px] font-semibold text-[var(--accent-ink)] hover:bg-[var(--background)] ${FOCUS_RING}`}
                    >
                      {style ? (
                        <span className={`size-2 rounded-full ${style.dot}`} aria-hidden />
                      ) : null}
                      Стаття {entry.article}
                      {entry.point ? ` · ${entry.point}` : ""}
                      <span className="max-w-[160px] truncate font-normal text-[var(--ink-muted)]">
                        {article.title}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="specialty-grid mt-6 grid w-full grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
              {welcomeSpecialties.map((item) => {
                const count = ARTICLES.filter((article) =>
                  article.specialties.includes(item.id),
                ).length;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => changeSpecialty(item.id)}
                    data-specialty={item.id}
                    className={`specialty-card lift min-h-[104px] rounded-2xl border border-[var(--hairline)] bg-card px-4 py-3 text-left shadow-[var(--shadow-soft)] hover:border-[var(--accent-ink)]/25 ${FOCUS_RING}`}
                  >
                    <span className="specialty-card-heading mb-3 flex items-center justify-between"><span className="specialty-icon"><SpecialtyIcon id={item.id} /><span className="clinical-signature" aria-hidden="true" /></span><ArrowRight className="specialty-arrow size-4" aria-hidden="true" /></span>
                    <span className="block hyphens-auto break-words text-[15px] font-semibold leading-snug tracking-tight">
                      {specialtyName(item)}
                    </span>
                    <span className="mt-1.5 block text-[11px] text-[var(--ink-muted)]">
                      {articleCountLabel(count)}
                    </span>
                  </button>
                );
              })}
          </div>

          <TdvDialog
            trigger={
              <Button type="button" variant="outline" className="mt-4 h-10 bg-card">
                <Table2 />
                Таблиця додаткових вимог (ТДВ)
              </Button>
            }
          />

          <p className="mt-5 flex items-center gap-1.5 text-[11px] text-[var(--ink-muted)]">
            <ShieldCheck className="size-3.5" />
            Довідкова навігація, не рішення ВЛК · корпус: редакція від {EDITION}
          </p>
        </div>
      )}

      <Dialog open={manualCopy !== null} onOpenChange={(open) => { if (!open) setManualCopy(null); }}>
        <VlkDialogContent returnFocusRef={copyTriggerRef} className="sm:max-w-2xl">
          <DialogHeader className="pr-8"><DialogTitle>Скопіюйте текст</DialogTitle><DialogDescription>Браузер не надав доступ до буфера обміну. Виділіть текст і скопіюйте його звичним способом.</DialogDescription></DialogHeader>
          <textarea aria-label="Текст для ручного копіювання" readOnly value={manualCopy ?? ""} onFocus={(event) => event.currentTarget.select()} className="min-h-64 w-full rounded-lg border border-input bg-muted p-3 text-sm leading-6" />
        </VlkDialogContent>
      </Dialog>

      <SessionResetDialog open={resetOpen} onOpenChange={setResetOpen} onConfirm={finishSession} returnFocusRef={moreTriggerRef} />

    </main>
  );
}

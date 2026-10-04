"use client";

import { VlkDialogContent } from "@/components/vlk/dialog-content";
import { ClinicalMotion } from "@/components/vlk/clinical-motion";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  ClipboardList,
  SlidersHorizontal,
  BookOpen,
  BookMarked,
  ChevronDown,
  ExternalLink,
  History,
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
import { HeroEmblem } from "@/components/vlk/hero-emblem";
import { UkraineTrident } from "@/components/vlk/ukraine-trident";
import { CommandBrand } from "@/components/vlk/command-brand";
import { SpecialtyIcon } from "@/components/vlk/specialty-icon";
import { PointTdvDetails } from "@/components/vlk/point-tdv-details";
import { HomeQuickAccess, QuickAccessDialog, PinArticleButton } from "@/components/vlk/quick-access";
import { RelatedArticles } from "@/components/vlk/related-articles";
import { ARTICLE_USAGE_KEY, PINNED_ARTICLES_KEY, readArticleUsage, readPinnedArticles, recordArticleOpen, togglePinned, type ArticleUsage } from "@/lib/vlk-article-usage";
import { EditionTicker } from "@/components/vlk/edition-ticker";
import { ThemeToggle } from "@/components/vlk/theme-controls";
import { WorkspaceTabs, type WorkspacePanel } from "@/components/vlk/workspace-tabs";
import { requestedPointIndex } from "@/lib/vlk-selection";
import { articleNavigationSpecialty, scrollOffsetToReveal } from "@/lib/vlk-reading-navigation";
import { createWorkspaceHistory } from "@/lib/vlk-workspace-history";
import { nextContextControl, revealContextControl, type ContextControlId } from "@/lib/vlk-context-navigation";
import { SessionResetDialog } from "@/components/vlk/session-reset-dialog";
import { clearStoredSession, readStored, writeStored, SESSION_RESET_KEY } from "@/lib/vlk-local-storage";
import { TdvDialog } from "@/components/vlk/tdv-dialog";
import { SpecialtyCalculators } from "@/components/vlk/specialty-calculators";
import { CaseDialog } from "@/components/vlk/case-dialog";
import { addCasePoints, casePointKey, emptyCaseDraft, type CasePoint } from "@/lib/vlk-case";
import {
  ExplanationDocument,
  FullExplanationDialog,
} from "@/components/vlk/explanation-document";
import { Highlighted } from "@/components/vlk/highlighted";
import { ArticleFilters } from "@/components/vlk/article-filters";
import { ReviewContextControls, ReviewContextResult } from "@/components/vlk/review-context";
import { categoryGuidance, contextProblem, resolveReviewContext, type ReviewContext } from "@/lib/vlk-review-context";
import { PointComparisonDialog } from "@/components/vlk/point-comparison-dialog";
import { OutcomeBadge } from "@/components/vlk/outcome-badge";
import { availablePoints, matchesRuleFilters } from "@/lib/vlk-view-filters";
import { ARTICLE_RULES } from "@/lib/vlk-rules";
import { graphGuidance, type ScheduleGraph } from "@/lib/vlk-graphs";
import {
  ARTICLES,
  EDITION,
  SOURCE_URL,
  SPECIALTIES,
  type SpecialtyId,
  type VlkArticle,
} from "@/lib/vlk-sample-data";
import {
  outcomeStyles,
  OUTCOME_FILTERS,
  type OutcomeFilterId,
} from "@/lib/vlk-outcomes";
import {
  MATCH_TYPE_LABELS,
  MATCH_TYPE_SHORT,
  POPULAR_QUERIES,
  searchArticles,
  searchAbbreviationHints,
  snippetAround,
  articleIcdLabel,
  articleIcdSearchNote,
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
import {
  explanationUrl as buildExplanationUrl,
  officialRuleUrl,
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
  const [tdvColumn, setTdvColumn] = useState<number | undefined>();
  const reviewContext = useMemo(() => ({ examineeType, scheduleGraph, tdvColumn }), [examineeType, scheduleGraph, tdvColumn]);
  function changeReviewContext(next: ReviewContext) {
    setExamineeType(next.examineeType); setScheduleGraph(next.scheduleGraph); setTdvColumn(next.tdvColumn);
  }
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [selectedRuleIndex, setSelectedRuleIndex] = useState("");
  const [directory, setDirectory] = useState<DoctorDirectory>(EMPTY_DIRECTORY);
  const [resetOpen, setResetOpen] = useState(false);
  // Temporary only: excluded from every stored session and browser-history snapshot.
  const [caseDraft, setCaseDraft] = useState(emptyCaseDraft);
  const [caseOpen, setCaseOpen] = useState(false);
  const [caseEpoch, setCaseEpoch] = useState(0);
  const caseReturnRef = useRef<HTMLElement | null>(null);
  const [outcomeFilter, setOutcomeFilter] = useState<OutcomeFilterId>("all");
  const [pointFilter, setPointFilter] = useState("all");
  const [searchSpecialty, setSearchSpecialty] = useState<SpecialtyId | "all">("all");
  const [online, setOnline] = useState(true);
  const [hydrated, setHydrated] = useState(false);
  const [explanationResult, setExplanationResult] = useState<{
    article: string; value?: ArticleExplanation; state: "ready" | "error";
  }>();
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<WorkspacePanel>("list");
  const [directoryOpen, setDirectoryOpen] = useState(false);
  const [activeHit, setActiveHit] = useState(-1);
  const [history, setHistory] = useState<string[]>([]);
  const [lastSpecialty, setLastSpecialty] = useState<SpecialtyId | "">("");
  const [usage, setUsage] = useState<ArticleUsage>({});
  const [pinned, setPinned] = useState<string[]>([]);
  const storageWarningShown = useRef(false);
  const [recent, setRecent] = useState<RecentEntry[]>([]);
  const listRef = useRef<HTMLDivElement>(null);
  const articleContentRef = useRef<HTMLDivElement>(null);
  const sidebarContextRef = useRef<HTMLDetailsElement>(null);
  const readingContextRef = useRef<HTMLDetailsElement>(null);
  function showReviewControl(control: ContextControlId) {
    const reading = window.matchMedia("(max-width: 1023px)").matches;
    revealContextControl(reading ? readingContextRef.current : sidebarContextRef.current,
      reading ? `reading-${control}` : control);
  }
  const searchRef = useRef<HTMLInputElement>(null);
  const searchBoxRef = useRef<HTMLDivElement>(null);
  const moreTriggerRef = useRef<HTMLButtonElement>(null);
  /** Чи додано запис в історію браузера при переході на робочий екран. */
  const historyPushedRef = useRef(false);
  const [workspaceHistory] = useState(createWorkspaceHistory);

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
      setTdvColumn(restored.tdvColumn);
      setDirectory(restored.directory);
      setHistory(readSearchHistory(readStored(SEARCH_HISTORY_KEY)));
      const workspace = readWorkspace(readStored(WORKSPACE_KEY));
      setLastSpecialty(workspace.specialty);
      setRecent(workspace.recent);
      setUsage(readArticleUsage(readStored(ARTICLE_USAGE_KEY)));
      setPinned(readPinnedArticles(readStored(PINNED_ARTICLES_KEY)));
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
      serializeSession({ examineeType, scheduleGraph, tdvColumn, directory }),
    );
  }, [directory, examineeType, hydrated, scheduleGraph, tdvColumn]);

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

  useEffect(() => {
    if (!hydrated) return;
    const usageSaved = writeStored(ARTICLE_USAGE_KEY, JSON.stringify({ version: 1, items: usage }));
    if (!usageSaved && !storageWarningShown.current && Object.keys(usage).length) {
      storageWarningShown.current = true;
      toast.error('Сховище браузера недоступне. Швидкий доступ зберігатиметься лише до закриття сторінки.');
    }
  }, [hydrated, usage]);

  useEffect(() => {
    if (!hydrated) return;
    const pinsSaved = writeStored(PINNED_ARTICLES_KEY, JSON.stringify({ version: 1, articles: pinned }));
    if (!pinsSaved && !storageWarningShown.current && pinned.length) {
      storageWarningShown.current = true;
      toast.error('Сховище браузера недоступне. Швидкий доступ зберігатиметься лише до закриття сторінки.');
    }
  }, [hydrated, pinned]);

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
      // Let dialogs, menus, native selects and IME own their keyboard events.
      if (event.defaultPrevented || event.isComposing ||
        document.querySelector('[role="dialog"][data-state="open"], [role="alertdialog"], [role="menu"][data-state="open"], [role="listbox"][data-state="open"]')) return;
      const target = event.target instanceof HTMLElement ? event.target : null;
      const editing = target?.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])');
      if (((event.ctrlKey || event.metaKey) && event.code === "KeyK") ||
        (event.key === "/" && !editing && !event.ctrlKey && !event.metaKey && !event.altKey)) {
        event.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
        setSearchOpen(true);
      } else if (event.key === "Escape" && !editing) {
        if (searchOpen) { event.preventDefault(); setSearchOpen(false); setActiveHit(-1); }
        else if (query) { event.preventDefault(); setQuery(""); setActiveHit(-1); }
        else if (outcomeFilter !== "all" || pointFilter !== "all" || searchSpecialty !== "all") {
          event.preventDefault(); setOutcomeFilter("all"); setPointFilter("all"); setSearchSpecialty("all");
        }
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => {
      window.removeEventListener("keydown", handleShortcut);
    };
  }, [searchOpen, query, outcomeFilter, pointFilter, searchSpecialty]);

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
    setPointFilter("all");
    setSearchSpecialty("all");
    setSearchOpen(false);
    setActiveHit(-1);
  }, []);

  // Апаратна або браузерна кнопка «назад» повертає на головний екран,
  // а не виводить із застосунку.
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const snapshot = workspaceHistory.restore(event.state);
      if (snapshot) {
        historyPushedRef.current = true;
        setSpecialty(snapshot.specialty);
        setQuery(snapshot.query);
        setSelectedId(snapshot.selectedId);
        setSelectedRuleIndex(snapshot.selectedRuleIndex);
        setOutcomeFilter(snapshot.outcomeFilter);
        setPointFilter(snapshot.pointFilter);
        setSearchSpecialty(snapshot.searchSpecialty);
        setMobilePanel(snapshot.mobilePanel);
        setSearchOpen(false);
        setActiveHit(-1);
        return;
      }
      historyPushedRef.current = false;
      resetToHome();
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [resetToHome, workspaceHistory]);

  const resetSessionView = useCallback(() => {
    workspaceHistory.clear();
    historyPushedRef.current = false;
    resetToHome();
    setDirectory({ ...EMPTY_DIRECTORY });
    setExamineeType(EXAMINEE_TYPES[0]);
    setScheduleGraph("all");
    setTdvColumn(undefined);
    setHistory([]);
    setRecent([]);
    setUsage({});
    setPinned([]);
    setLastSpecialty("");
    setDirectoryOpen(false);
    setResetOpen(false);
    setCaseDraft(emptyCaseDraft());
    setCaseOpen(false);
    setCaseEpoch(current => current + 1);
  }, [resetToHome, workspaceHistory]);

  useEffect(() => {
    const reset = (event: StorageEvent) => {
      if (event.key === SESSION_RESET_KEY && event.newValue) resetSessionView();
      else if (event.key === ARTICLE_USAGE_KEY) setUsage(readArticleUsage(event.newValue));
      else if (event.key === PINNED_ARTICLES_KEY) setPinned(readPinnedArticles(event.newValue));
    };
    window.addEventListener("storage", reset);
    return () => window.removeEventListener("storage", reset);
  }, [resetSessionView]);

  function openCase(opener: HTMLElement, point?: CasePoint) {
    caseReturnRef.current = opener;
    if (point) setCaseDraft(current => ({ ...current, points: addCasePoints(current.points, [point]) }));
    setCaseOpen(true);
  }

  function finishSession() {
    const cleared = clearStoredSession();
    resetSessionView();
    if (cleared) toast.success("Сесію завершено. Локальні дані очищено.");
    else toast.error("Екран очищено, але браузер не дозволив видалити збережені дані. Перевірте налаштування сховища сайту.");
  }

  const searchHits = useMemo(
    () => (query.trim() ? searchArticles(query, directory).filter((hit) =>
      searchSpecialty === "all" || hit.article.specialties.includes(searchSpecialty)) : []),
    [directory, query, searchSpecialty],
  );
  const abbreviationHints = useMemo(() => searchAbbreviationHints(query), [query]);
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
      (ARTICLE_RULES[article.article] ?? []).some((rule) => matchesRuleFilters(rule, pointFilter, outcomeFilter, resolveReviewContext(article.article, rule, reviewContext).outcome)),
    [outcomeFilter, pointFilter, reviewContext],
  );
  const hasRuleFilters = outcomeFilter !== "all" || pointFilter !== "all";
  const filterPoints = useMemo(() => availablePoints(baseArticles.flatMap((article) => ARTICLE_RULES[article.article] ?? [])), [baseArticles]);

  // Фільтр нічого не ховає: релевантні статті піднімаються вгору, решта
  // лишається в списку приглушеною.
  const listArticles = useMemo(() => {
    if (!hasRuleFilters) return baseArticles;
    return [...baseArticles].sort(
      (a, b) => Number(articleMatchesFilter(b)) - Number(articleMatchesFilter(a)),
    );
  }, [articleMatchesFilter, baseArticles, hasRuleFilters]);

  /** Остання спеціальність піднімається першою в сітці вибору. */
  const welcomeSpecialties = useMemo(() => {
    if (!lastSpecialty) return [...SPECIALTIES];
    return [...SPECIALTIES].sort(
      (a, b) => Number(b.id === lastSpecialty) - Number(a.id === lastSpecialty),
    );
  }, [lastSpecialty]);

  const filteredCount = useMemo(
    () => (hasRuleFilters ? baseArticles.filter(articleMatchesFilter).length : 0),
    [articleMatchesFilter, baseArticles, hasRuleFilters],
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
    if (!showDashboard) return;
    workspaceHistory.remember({ specialty, query, selectedId, selectedRuleIndex,
      outcomeFilter, pointFilter, searchSpecialty, mobilePanel });
  }, [showDashboard, workspaceHistory, specialty, query, selectedId, selectedRuleIndex,
    outcomeFilter, pointFilter, searchSpecialty, mobilePanel]);

  useEffect(() => {
    if (!showDashboard || historyPushedRef.current) return;
    window.history.pushState(workspaceHistory.marker, "");
    historyPushedRef.current = true;
  }, [showDashboard, workspaceHistory]);

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
  const categoryNotes = categoryGuidance(selected?.article ?? "", fullExplanation, examineeType);
  const selectedGraphGuidance = graphGuidance(fullExplanation, scheduleGraph);
  const explanationUrl = buildExplanationUrl(explanationMeta?.anchor, EXPLANATION_SOURCE_URL);

  const sourceUrl = selected ? officialRuleUrl(selected.article, selectedRule) : SOURCE_URL;

  function noteArticleOpen(article: VlkArticle) {
    setUsage(current => recordArticleOpen(current, article.article, selected?.article));
  }
  function pinArticle(number: string) { setPinned(current => togglePinned(current, number)); }
  function clearArticleStatistics() {
    setUsage({});
    if (writeStored(ARTICLE_USAGE_KEY, JSON.stringify({ version: 1, items: {} }))) toast.success('Статистику очищено. Закріплені статті збережено.');
    else toast.error('Статистику прибрано з екрана, але сховище браузера недоступне.');
  }
  function openNavigationArticle(article: VlkArticle, preferred?: SpecialtyId) {
    noteArticleOpen(article);
    const nextSpecialty = articleNavigationSpecialty(article, specialty || lastSpecialty, preferred);
    showArticlePanel(); setQuery(''); setSearchOpen(false); setActiveHit(-1);
    setSpecialty(nextSpecialty); setLastSpecialty(nextSpecialty); setSelectedId(article.id);
    resetArticleReview(); rememberView(article.article);
  }

  /** Записує відкриту статтю або пункт в останні перегляди. */
  function rememberView(article: string, point = "") {
    setRecent((current) => addRecent(current, { article, point }));
  }

  function resetArticleReview() {
    setSelectedRuleIndex("");
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
    noteArticleOpen(article);
    const resolvedIndex = pointIndex ?? requestedPointIndex(article.article, query);
    showArticlePanel();
    setSelectedId(article.id);
    const nextSpecialty = articleNavigationSpecialty(article, specialty || lastSpecialty,
      searchSpecialty === "all" ? undefined : searchSpecialty);
    setSpecialty(nextSpecialty);
    setLastSpecialty(nextSpecialty);
    setHistory((current) => addSearchHistory(current, query));
    setSearchOpen(false);
    setActiveHit(-1);
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
    if (event.nativeEvent.isComposing) return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
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
    if (window.matchMedia("(max-width: 1023px)").matches) {
      requestAnimationFrame(() => document.getElementById("vlk-article-heading")?.focus({ preventScroll: true }));
    }
  }

  /** Return to the current list without losing the query, filters or chosen point. */
  function showListPanel() {
    setMobilePanel("list");
    setSearchOpen(false);
    setActiveHit(-1);
    requestAnimationFrame(() => {
      const list = listRef.current;
      const row = list?.querySelector<HTMLButtonElement>('[data-article-row][aria-current="true"]')
        ?? list?.querySelector<HTMLButtonElement>("[data-article-row]");
      if (!list || !row) {
        searchRef.current?.focus({ preventScroll: true });
        return;
      }
      row.focus({ preventScroll: true });
      const top = row.getBoundingClientRect().top - list.getBoundingClientRect().top + list.scrollTop;
      list.scrollTop = scrollOffsetToReveal({ start: top, end: top + row.offsetHeight,
        viewportSize: list.clientHeight, scrollOffset: list.scrollTop, scrollSize: list.scrollHeight });
    });
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
    noteArticleOpen(article);
    rememberView(article.article);
    setSelectedId(article.id);
    if (query.trim()) setSpecialty(articleNavigationSpecialty(article, specialty || lastSpecialty));
    resetArticleReview();
  }

  function selectRule(index: string) {
    setSelectedRuleIndex(index);
    if (index !== "" && selected) {
      rememberView(selected.article, articleRules[Number(index)]?.point ?? "");
    }
  }

  /** Відкриває запис з останніх переглядів. */
  function openRecent(entry: RecentEntry) {
    const article = ARTICLES.find((item) => item.article === entry.article);
    if (!article) return;
    noteArticleOpen(article);
    showArticlePanel();
    setQuery("");
    setSearchOpen(false);
    const nextSpecialty = articleNavigationSpecialty(article, specialty || lastSpecialty);
    setSpecialty(nextSpecialty);
    setLastSpecialty(nextSpecialty);
    setSelectedId(article.id);
    const index = (ARTICLE_RULES[article.article] ?? []).findIndex(
      (rule) => rule.point === entry.point,
    );
    setSelectedRuleIndex(entry.point && index >= 0 ? String(index) : "");
    rememberView(entry.article, entry.point);
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
                placeholder="Діагноз, МКХ-10 або № статті…"
                enterKeyHint="search"
                aria-keyshortcuts="Control+k Meta+k /"
                autoComplete="off"
                role="combobox"
                aria-expanded={searchOpen}
                aria-controls="vlk-search-results"
                aria-autocomplete="list"
                aria-activedescendant={searchOpen && activeHit >= 0 ? `vlk-hit-${activeHit}` : undefined}
                className="h-11 w-full border-[var(--input)] bg-[var(--surface-muted)] pl-9 pr-10 text-sm shadow-none transition-shadow"
              />
              {!query ? <kbd className="search-shortcut" aria-hidden="true">/ · Ctrl / ⌘ K</kbd> : null}
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
                {query.trim() ? <div className="search-scope">
                  <label htmlFor="search-specialty">Область пошуку</label>
                  <select id="search-specialty" value={searchSpecialty} onChange={(event) => {
                    setSearchSpecialty(event.target.value as SpecialtyId | "all"); setActiveHit(-1);
                  }}>
                    <option value="all">Усі спеціальності</option>
                    {SPECIALTIES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                  </select>
                </div> : null}
                {abbreviationHints.length ? <p className="search-abbreviation" role="status">
                  Навігаційне скорочення: {abbreviationHints.join("; ")}. Пункт обирає лікар після читання критеріїв.
                </p> : null}
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
                                  const contextual = resolveReviewContext(hit.article.article, rule, reviewContext);
                                  const style = outcomeStyles(contextual.outcome);
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
                                          {contextual.label ?? style.label}
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
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-semibold text-[var(--ink-soft)]">Останні пошуки · {history.length}/15</p>
                          <button type="button" className="filter-reset" onClick={() => {
                            setHistory([]);
                            if (writeStored(SEARCH_HISTORY_KEY, "[]")) toast.success("Історію пошуку очищено");
                            else toast.error("Історію прибрано з екрана, але сховище браузера недоступне.");
                            searchRef.current?.focus();
                          }}>Очистити історію</button>
                        </div>
                        <p className="text-xs text-[var(--ink-muted)]">Лише на цьому пристрої. Не вводьте персональні дані пацієнтів.</p>
                        <div className="search-history mt-1.5 flex max-h-48 flex-wrap gap-1 overflow-y-auto">
                          {history.map((item) => (
                            <button
                              key={item}
                              type="button"
                              onClick={() => runQuery(item)}
                              className={`max-w-full break-words rounded-md border border-[var(--hairline)] bg-card px-2 py-1 text-left text-xs font-semibold text-[var(--accent-ink)] hover:bg-[var(--background)] ${FOCUS_RING}`}
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
            <Button type="button" variant="ghost" size="sm" className="case-open-action h-10 text-[var(--brand-bar-soft)] hover:bg-white/10 hover:text-white"
              aria-label={`Відкрити випадок${caseDraft.points.length ? ` · позицій: ${caseDraft.points.length}` : ''}`} aria-haspopup="dialog" title="Випадок · зіставити кілька пунктів за ТДВ"
              onClick={event => openCase(event.currentTarget)}>
              <ClipboardList aria-hidden="true" /><span className="hidden sm:inline">Випадок</span>
              {caseDraft.points.length ? <span className="case-count">{caseDraft.points.length}</span> : null}
            </Button>

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
                        selectedColumn={tdvColumn}
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
      {specialty ? <div className="therapist-tools-wrap"><SpecialtyCalculators key={`${caseEpoch}-${specialty}`} specialty={specialty} onOpenArticle={number => { const article = ARTICLES.find(item => item.article === number); if (article) openNavigationArticle(article); }} /></div> : null}
      <div className="vlk-workspace mx-auto grid w-full max-w-[1920px] gap-3 p-2 lg:p-3">
        <aside className="command-sidebar flex min-h-[440px] flex-col overflow-hidden rounded-2xl border border-[var(--hairline-strong)] bg-card text-foreground shadow-[var(--shadow-soft)] xl:min-h-0"
          id="vlk-panel-list" role="tabpanel" aria-labelledby="vlk-tab-list" data-mobile-panel="list" data-active={mobilePanel === "list"}>
          <div className="sidebar-controls shrink-0 border-b border-[var(--hairline)] p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">{query.trim() ? "Результати пошуку" : "Статті за спеціальністю"}</h2>
              <span className="sidebar-count" role="status" aria-live="polite">{articleCountLabel(listArticles.length)}</span>
            </div>
            <details className="sidebar-fold" data-sidebar-section="specialty">
              <summary>
                <span className="sidebar-fold-copy"><span className="sidebar-fold-label">Спеціальність</span><span className="sidebar-fold-value">{selectedSpecialty?.label ?? "Усі спеціальності"}</span></span>
                <ChevronDown aria-hidden="true" />
              </summary>
              <div className="sidebar-fold-body">
                <label htmlFor="specialty-picker" className="sr-only">Спеціальність лікаря</label>
                <Select value={specialty} onValueChange={(value) => changeSpecialty(value as SpecialtyId)}>
                  <SelectTrigger id="specialty-picker" className="min-h-11 w-full bg-card text-sm"><SelectValue placeholder="Спеціальність лікаря" /></SelectTrigger>
                  <SelectContent>
                    {SPECIALTIES.map((item) => <SelectItem key={item.id} value={item.id} className="min-h-11">
                      {specialtyName(item)} · {articleCountLabel(ARTICLES.filter((article) => article.specialties.includes(item.id)).length)}
                    </SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </details>
            <details ref={sidebarContextRef} className="sidebar-fold" data-sidebar-section="context">
              <summary>
                <span className="sidebar-fold-copy">
                  <span className="sidebar-fold-label">Параметри огляду</span>
                  <span className="sidebar-fold-value">{examineeType}</span>
                  <span className="sidebar-fold-meta">{scheduleGraph === "all" ? "Графу не обрано" : `Графа ${scheduleGraph}`} · {tdvColumn ? `ТДВ ${tdvColumn}` : "ТДВ не уточнено"}</span>
                  {contextProblem(reviewContext) ? <span className="sidebar-fold-alert">Потребує уточнення</span> : null}
                </span>
                <ChevronDown aria-hidden="true" />
              </summary>
              <div className="sidebar-fold-body">
                <ReviewContextControls context={reviewContext} onChange={changeReviewContext} />
              </div>
            </details>
            <details className="sidebar-fold" data-sidebar-section="filters">
              <summary>
                <span className="sidebar-fold-copy">
                  <span className="sidebar-fold-label">Фільтри пунктів{hasRuleFilters ? " · активні" : ""}</span>
                  {hasRuleFilters ? <span className="sidebar-fold-value">
                    {OUTCOME_FILTERS.find((item) => item.id === outcomeFilter)?.label}{pointFilter !== "all" ? ` · ${pointFilter === "—" ? "Без поділу" : `Пункт «${pointFilter}»`}` : ""}
                  </span> : null}
                </span>
                <ChevronDown aria-hidden="true" />
              </summary>
              <div className="sidebar-fold-body">
                <ArticleFilters outcome={outcomeFilter} point={pointFilter} points={filterPoints}
                  onOutcomeChange={setOutcomeFilter} onPointChange={setPointFilter} showReset={false} />

              </div>
            </details>
            {hasRuleFilters ? <div className="filter-summary">
              <p role="status"><strong>Збіги: {filteredCount} із {baseArticles.length}</strong><span>Решта статей доступна нижче. Фільтр не визначає придатність.</span></p>
              <button type="button" onClick={() => { setOutcomeFilter("all"); setPointFilter("all"); }} aria-label="Скинути фільтри пунктів">Скинути <X className="size-3.5" aria-hidden="true" /></button>
            </div> : null}
            {query.trim() && searchSpecialty !== "all" ? <div className="active-search-scope">
              <span>Пошук: {SPECIALTIES.find((item) => item.id === searchSpecialty)?.label}</span>
              <button type="button" onClick={() => { setSearchSpecialty("all"); setActiveHit(-1); }}
                aria-label="Шукати серед усіх спеціальностей">Усі спеціальності <X aria-hidden="true" className="size-3.5" /></button>
            </div> : null}
            {query.trim() ? <button type="button" onClick={() => clearQuery({ notify: true })} className="mt-1 flex min-h-10 items-center gap-2 text-xs text-[var(--accent-ink)]"><RotateCcw className="size-3.5" />Скинути пошук</button> : null}
          </div>

          <div
            ref={listRef}
            onKeyDown={handleListKeys}
            className="article-list min-h-0 flex-1 overflow-y-auto p-2 scrollbar-thin"
          >
            {listArticles.length ? (
              <ul className="space-y-1" aria-label={query.trim() ? "Знайдені статті" : `Статті · ${selectedSpecialty?.label ?? "усі"}`}>
                {listArticles.map((article, listIndex) => {
                  const isSelected = selected?.id === article.id;
                  const hit = hitsById.get(article.id);
                  const matches = hit?.matches ?? [];
                  const dimmed = !articleMatchesFilter(article);
                  return (
                    <li key={article.id} className={dimmed ? "article-unmatched" : ""}>
                      {hasRuleFilters && listIndex === filteredCount && dimmed ? <p className="list-filter-divider">Інші статті · поза фільтром</p> : null}
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
                <div className="article-header-stack flex flex-col gap-2">
                  <div className="article-heading-row flex min-w-[min(100%,280px)] flex-1 items-start gap-2.5">
                    <span className="article-number grid size-10 shrink-0 place-items-center rounded-lg bg-[var(--primary)] text-sm font-black text-white">
                      {selected.article}
                    </span>
                    <div className="min-w-0">
                      <nav
                        aria-label="Шлях"
                        className="flex flex-wrap items-center gap-1 text-[10px] font-bold text-[var(--ink-soft)]"
                      >
                        <button
                          type="button"
                          onClick={showListPanel}
                          aria-label={query.trim() ? "Повернутися до результатів пошуку" : "Повернутися до списку статей"}
                          className={`article-list-return rounded text-[var(--accent-ink)] hover:underline ${FOCUS_RING}`}
                        >
                          <ChevronLeft className="size-3.5" aria-hidden="true" />
                          {query.trim() ? "Результати пошуку" : (selectedSpecialty?.label ?? "Список статей")}
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
                      <p className="article-icd mt-1 break-words text-xs font-black text-[var(--accent-ink-strong)]">
                        МКХ-10: <Highlighted text={articleIcdLabel(selected)} query={query} />
                      </p>
                      {articleIcdSearchNote(selected) ? <p className="article-icd-note">{articleIcdSearchNote(selected)}</p> : null}
                    </div>
                  </div>
                  <div className="article-toolbar flex flex-wrap items-center gap-1.5">
                    {explanationMeta?.status !== "absent" && explanationState === "ready" && fullExplanation.length ? (
                      <FullExplanationDialog key={selected.article}
                        article={selected.article}
                        paragraphs={fullExplanation}
                        query={query}
                        sourceUrl={explanationUrl}
                        selectedPoint={selectedRule?.point}
                        ariaLabel={`Повне офіційне пояснення до статті ${selected.article}`}
                      />
                    ) : (
                      <Button type="button" size="sm" variant="outline" disabled className="h-9 bg-card"
                        title={explanationMeta?.status === "absent" ? "Окремого пояснення в Додатку 2 немає" : explanationState === "error" ? "Не вдалося завантажити пояснення — скористайтеся посиланням на джерело нижче" : "Завантажуємо пояснення"}>
                        <BookOpen /> Детальне пояснення
                      </Button>
                    )}
                    <Button asChild size="sm" variant="outline" className="article-source-action h-9">
                      <a href={sourceUrl} target="_blank" rel="noreferrer" aria-label="Відкрити у №402">
                        <span className="action-full-label">Відкрити у №402</span><span className="action-short-label" aria-hidden="true">№402</span> <ExternalLink />
                      </a>
                    </Button>
                    <details className="article-tools">
                      <summary><SlidersHorizontal className="size-4" aria-hidden="true" />Порівняння та інші дії<ChevronDown className="size-3.5" aria-hidden="true" /></summary>
                      <div className="article-tools-body">
                        <p className="article-tools-hint">Порівняння пунктів, перехід між статтями та закріплення</p>
                      <QuickAccessDialog usage={usage} pinned={pinned} specialty={specialty} onOpen={openNavigationArticle} onPin={pinArticle} onClear={clearArticleStatistics}
                        trigger={<Button type="button" variant="ghost" size="sm" aria-label="Відкрити швидкий доступ"><BookMarked aria-hidden="true" />Мої статті</Button>} />
                      <PinArticleButton showLabel article={selected.article} pinned={pinned.includes(selected.article)} onToggle={() => pinArticle(selected.article)} />
                    <div className="article-pagination mr-auto flex items-center gap-1">
                      <Button type="button" variant="ghost" size="icon" aria-label="Попередня стаття" title="Попередня стаття"
                        disabled={selectedListIndex <= 0} onClick={() => selectFromList(listArticles[selectedListIndex - 1])}><ChevronLeft /></Button>
                      <span className="text-xs tabular-nums text-muted-foreground">{selectedListIndex < 0 ? "Поза списком" : `${selectedListIndex + 1} / ${listArticles.length}`}</span>
                      <Button type="button" variant="ghost" size="icon" aria-label="Наступна стаття" title="Наступна стаття"
                        disabled={selectedListIndex < 0 || selectedListIndex >= listArticles.length - 1} onClick={() => selectFromList(listArticles[selectedListIndex + 1])}><ChevronDown className="-rotate-90" /></Button>
                    </div>
                    <PointComparisonDialog key={selected.id} article={selected.article} title={selected.title}
                      included={selected.officialIncluded} rules={articleRules} selectedIndex={selectedRuleIndex}
                      graph={scheduleGraph} context={reviewContext} query={query} onSelect={(index) => { showArticlePanel(); selectRule(index); }} />
                      </div>
                    </details>
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
                <details ref={readingContextRef} className="reading-context lg:hidden">
                  <summary>Параметри огляду · {examineeType}{scheduleGraph === "all" ? " · графу не обрано" : ` · гр. ${scheduleGraph}`}{contextProblem(reviewContext) ? " · потребує уточнення" : ""}</summary>
                  <ReviewContextControls context={reviewContext} onChange={changeReviewContext} prefix="reading-" />
                </details>
                <p className="review-context-line hidden lg:block" role="status">{examineeType} · {scheduleGraph === "all" ? "графу не обрано" : `графа ${scheduleGraph}`}{tdvColumn ? ` · ТДВ ${tdvColumn}` : " · призначення ТДВ не уточнено"}</p>
                {categoryNotes.length ? <details className="category-guidance" key={`category-${selected.article}-${examineeType}`}>
                  <summary>Умови застосування для категорії · {categoryNotes.length} фрагментів</summary>
                  <p className="context-hint">Дослівні фрагменти Додатка 2. Наявність згадки не підтверджує виконання клінічних умов; пункт обирає лікар.</p>
                  <ExplanationDocument article={selected.article} paragraphs={fullExplanation} excerpt={categoryNotes} query={query} />
                  <a className="context-source" href={explanationUrl} target="_blank" rel="noreferrer">Повне офіційне пояснення ↗</a>
                </details> : null}
                <div className="point-section-heading flex items-center justify-between">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--ink-soft)]">
                    Пункти статті
                  </p>
                  <span className="text-[10px] text-[var(--ink-muted)]">
                    {pointCountLabel(articleRules.length)}
                  </span>
                </div>
                <details className="reading-filters lg:hidden">
                  <summary><SlidersHorizontal className="size-4" aria-hidden="true" />Фільтри пунктів{hasRuleFilters ? " · увімкнено" : ""}</summary>
                  <ArticleFilters outcome={outcomeFilter} point={pointFilter} points={filterPoints}
                    onOutcomeChange={setOutcomeFilter} onPointChange={setPointFilter} showReset={false} />
                </details>
                {hasRuleFilters ? <div className="filter-summary reading-filter-summary">
                  <p role="status"><strong>Збігів у статті: {articleRules.filter((rule) => matchesRuleFilters(rule, pointFilter, outcomeFilter, resolveReviewContext(selected.article, rule, reviewContext).outcome)).length} із {articleRules.length}</strong><span>Усі пункти доступні. Фільтр не визначає придатність.</span></p>
                  <button type="button" onClick={() => { setOutcomeFilter("all"); setPointFilter("all"); }} aria-label="Скинути фільтри пунктів у читанні">Скинути <X className="size-3.5" aria-hidden="true" /></button>
                </div> : null}
                {!selectedRule ? <p className="point-start-hint">{articleRules.length === 1 && articleRules[0].point === "—" ? "Відкрийте запис нижче, щоб прочитати умови й застереження." : "Оберіть пункт за підтвердженим станом. Потім відкрийте пояснення до нього."}</p> : null}

                <ul className="mt-2 space-y-2">
                  {articleRules.map((rule, index) => {
                    const active = selectedRuleIndex === String(index);
                    const contextual = resolveReviewContext(selected.article, rule, reviewContext);
                    const nextControl = nextContextControl(reviewContext, contextual.scheduleNeedsGraph);
                    const style = outcomeStyles(contextual.outcome);
                    // Фільтр позначає збіги, зберігаючи весь нормативний текст читабельним.
                    const dimmed = !matchesRuleFilters(rule, pointFilter, outcomeFilter, resolveReviewContext(selected.article, rule, reviewContext).outcome);
                    const pointText = pointExplanationFor(rule.point);


                    return (
                      <li key={`${rule.point}-${index}`} data-filter-match={hasRuleFilters ? !dimmed : undefined}>
                        <div
                          data-point-tone={style.tone}
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
                              {hasRuleFilters ? <span className="mb-1 block text-xs font-medium text-[var(--ink-soft)]">{dimmed ? "Поза фільтром" : "Збіг із фільтром"}</span> : null}
                              {active ? (
                                <span className="mb-1 block text-[11px] font-semibold text-[var(--ink-soft)]">
                                  Стан за пунктом · дослівно
                                </span>
                              ) : null}
                              <span className="point-preview block text-sm leading-5 text-[var(--foreground)]">
                                <Highlighted text={rule.condition} query={query} />
                              </span>
                            </span>
                            <OutcomeBadge outcome={contextual.outcome} label={contextual.label} />
                            {scheduleGraph === "all" ? null : (
                              <span
                                className="hidden shrink-0 rounded-full border border-[var(--hairline)] bg-card px-2 py-1 text-[10px] font-bold text-[var(--ink-soft)] sm:inline"
                                title="Графа Розкладу хвороб за направленням"
                              >
                                гр. {scheduleGraph}
                              </span>
                            )}
                            <ChevronDown
                              className={`size-4 shrink-0 text-[var(--ink-soft)] transition ${active ? "rotate-180" : ""}`}
                            />
                          </button>

                          {active ? (
                            <div className="point-detail-surface border-t border-[var(--hairline)] px-3 pb-3 pt-2.5">
                              <ReviewContextResult article={selected.article} rule={rule} context={reviewContext} />
                              <div className="mt-3 border-l-2 border-[var(--hairline)] pl-3" data-schedule-result>
                                <p className="text-xs font-semibold text-[var(--ink-soft)]">Загальний результат Розкладу хвороб · {scheduleGraph === "all" ? "без вибраної графи" : `графа ${scheduleGraph}`} · {contextual.scheduleNeedsGraph ? "потрібне уточнення" : "дослівно"}</p>
                                {nextControl ? <button type="button" className="context-next-action" onClick={() => showReviewControl(nextControl)}>
                                  {nextControl === "schedule-graph" ? "Перейти до вибору графи I–III" : "Уточнити призначення ТДВ"} <ArrowRight className="size-4" aria-hidden="true" />
                                </button> : null}
                                <p className="mt-1 text-sm leading-6">{contextual.scheduleText || "— (клітинка цієї графи порожня)"}</p>
                                <p className="context-hint">Читати разом із поясненням, нормою для категорії та ТДВ. Це не постанова ВЛК.</p>
                              </div>

                              <div className="case-point-entry"><Button type="button" variant="outline" className="min-h-11" aria-haspopup="dialog" data-case-add-point
                                onClick={event => openCase(event.currentTarget, { article: selected.article, point: rule.point })}>
                                <ClipboardList aria-hidden="true" />{caseDraft.points.some(point => casePointKey(point) === casePointKey({ article: selected.article, point: rule.point })) ? 'У випадку · відкрити' : 'Додати до випадку'}
                              </Button></div>
                              <PointTdvDetails article={selected} point={rule.point} selectedColumn={tdvColumn} />

                              {explanationState === "ready" && explanation && explanationMeta?.status !== "absent" && !pointText.length ? (
                                <p className="context-warning mt-3">У Додатку 2 немає окремо виділеного розділу для {pointLabelGenitive(rule.point)}. Кнопка «Пояснення» відкриває повний текст статті.</p>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>

                <div className="article-reference-grid mt-4">
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

                </div>

                {explanationMeta?.status === "absent" || explanationState !== "ready" || !fullExplanation.length ? (
                  <div className="explanation-status mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
                    <p>{explanationMeta?.status === "absent" ? "Окремого пояснення в Додатку 2 немає." : explanationState === "error" ? "Не вдалося завантажити пояснення. Відкрийте джерело." : "Завантажуємо повний дослівний текст…"}</p>
                    <Button asChild variant="ghost" className="min-h-11"><a href={explanationUrl} target="_blank" rel="noreferrer">Джерело <ExternalLink /></a></Button>
                  </div>
                ) : null}

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

                <RelatedArticles key={`related-${selected.article}`} article={selected.article} paragraphs={fullExplanation} explanationState={explanationState} onOpen={openNavigationArticle} />
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
              className="home-resume-action h-11 bg-[var(--primary)] px-5 text-sm text-white hover:bg-[var(--primary-hover)]"
            >
              Продовжити як{" "}
              {SPECIALTIES.find((item) => item.id === lastSpecialty)?.label ?? "лікар"}
              <ChevronDown className="-rotate-90" />
            </Button>
          ) : null}

          <section className="vlk-brand-hero" aria-labelledby="welcome-title">
            <div className="vlk-brand-hero-copy">
              <p className="vlk-brand-eyebrow">Робоче місце лікаря ВЛК</p>
              <div className="vlk-brand-title"><UkraineTrident /><h2 id="welcome-title">ВЛК <span>402</span></h2></div>
              <p className="vlk-brand-subtitle">Навігатор військово-лікарської експертизи</p>
            </div>
            <div className="vlk-brand-guide">
              <p>Оберіть спеціальність або знайдіть норму за діагнозом, кодом МКХ-10 чи номером статті.</p>
              <ol className="start-steps" aria-label="Як почати роботу">
                <li><span>1</span>Знайдіть статтю</li><li><span>2</span>Оберіть пункт</li><li><span>3</span>Прочитайте пояснення</li>
              </ol>
            </div>
            <div className="vlk-brand-emblem" aria-hidden="true"><HeroEmblem /></div>
          </section>

          <div className="home-search-examples mt-3 flex flex-wrap items-center justify-center gap-2">
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
            <details className="home-recent w-full">
              <summary>Нещодавно переглянуті <span>{recent.length}</span></summary>
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
            </details>
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

          <HomeQuickAccess ready={hydrated} usage={usage} pinned={pinned} specialty={lastSpecialty} onOpen={openNavigationArticle} onPin={pinArticle} onClear={clearArticleStatistics} />

          <TdvDialog
            trigger={
              <Button type="button" variant="outline" className="home-tdv-action mt-4 h-10 bg-card">
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



      <CaseDialog key={caseEpoch} open={caseOpen} onOpenChange={setCaseOpen} draft={caseDraft} onChange={setCaseDraft} returnFocusRef={caseReturnRef} reviewContext={reviewContext} onReviewContextChange={changeReviewContext} />
      <SessionResetDialog open={resetOpen} onOpenChange={setResetOpen} onConfirm={finishSession} returnFocusRef={moreTriggerRef} />

    </main>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  Check,
  ChevronDown,
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
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { SwRegister } from "@/components/sw-register";
import { CommandBrand } from "@/components/vlk/command-brand";
import {
  CitizenPreparation,
  CITIZEN_PREPARATION_CHECKS,
} from "@/components/vlk/citizen-preparation";
import { NormativePassportDialog } from "@/components/vlk/normative-passport-dialog";
import { TdvDialog } from "@/components/vlk/tdv-dialog";
import { ExplanationDocument } from "@/components/vlk/explanation-document";
import { Highlighted } from "@/components/vlk/highlighted";
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
  addRecent,
  readWorkspace,
  serializeWorkspace,
  WORKSPACE_KEY,
  type RecentEntry,
} from "@/lib/vlk-workspace";
import { EDITION_NOTICE } from "@/lib/vlk-edition";
import {
  APPEARANCE_KEY,
  DEFAULT_APPEARANCE,
  DENSITY_OPTIONS,
  readAppearance,
  resolveTheme,
  serializeAppearance,
  THEME_OPTIONS,
  type Appearance,
} from "@/lib/vlk-appearance";
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
  EXPLANATION_META,
  EXPLANATION_SOURCE_URL,
  getLoadedExplanation,
  loadArticleExplanation,
  warmExplanations,
  type ArticleExplanation,
} from "@/lib/vlk-explanations";
import { pointExplanation } from "@/lib/vlk-explanation-view";
import { buildCitizenSummaryText, buildDraftText, buildReferenceText } from "@/lib/vlk-report";
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

const DOCTOR_WORKFLOW_STEPS = [
  ["1", "Знайдіть", "діагноз або статтю"],
  ["2", "Оберіть", "точний пункт стану"],
  ["3", "Звірте", "орієнтир, ТДВ і джерело"],
] as const;

const CITIZEN_WORKFLOW_STEPS = [
  ["1", "Знайдіть", "норму за діагнозом або МКХ"],
  ["2", "Звірте", "дослівний пункт із документами"],
  ["3", "Підготуйте", "виписки, обстеження та копії"],
] as const;

type MobilePanel = "list" | "article" | "summary";

const MOBILE_PANELS: readonly { id: MobilePanel; label: string; citizenLabel: string }[] = [
  { id: "list", label: "Список", citizenLabel: "Список" },
  { id: "article", label: "Стаття", citizenLabel: "Стаття" },
  { id: "summary", label: "Зведення", citizenLabel: "Підготовка" },
];

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ink)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--surface)]";

/** Склад корпусу статичний, тому кількості рахуються один раз при завантаженні. */
const SPECIALTY_ARTICLE_COUNTS: Record<string, number> = Object.fromEntries(
  SPECIALTIES.map((item) => [
    item.id,
    ARTICLES.filter((article) => article.specialties.includes(item.id)).length,
  ]),
);

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

/**
 * М'який перенос для найдовшої назви спеціальності, щоб у вузькій колонці
 * слово розривалося по складу («Дермато-венеролог»), а не будь-де.
 */
const SOFT_HYPHENS: Partial<Record<SpecialtyId, string>> = {
  dermatologist: "Дермато\u00ADвенеролог",
};

function compactSpecialtyName(item: (typeof SPECIALTIES)[number]) {
  return SOFT_HYPHENS[item.id] ?? specialtyName(item);
}

/**
 * Розбиває дослівний перелік кодів МКХ на окремі чипи для показу.
 * Самі коди не змінюються: розділювач «;» — це лише подання.
 */
function icdTokens(icd: string) {
  return icd
    .split(";")
    .map((token) => token.trim())
    .filter(Boolean);
}

function pointLabel(point: string) {
  return point === "—" ? "без поділу" : `пункт «${point}»`;
}

/** Родовий відмінок для формулювань «до пункту…». */
function pointLabelGenitive(point: string) {
  return point === "—" ? "статті без поділу на пункти" : `пункту «${point}»`;
}

export default function Home() {
  const [mode, setMode] = useState<Mode>("doctor");
  // Порожнє значення означає, що лікар ще не обрав спеціальність:
  // до цього моменту перший екран лишається чистим.
  const [specialty, setSpecialty] = useState<SpecialtyId | "">("");
  const [examineeType, setExamineeType] = useState<string>(EXAMINEE_TYPES[0]);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [selectedRuleIndex, setSelectedRuleIndex] = useState("");
  const [checked, setChecked] = useState<string[]>([]);
  const [citizenChecked, setCitizenChecked] = useState<string[]>([]);
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
  const [lastSpecialty, setLastSpecialty] = useState<SpecialtyId | "">("");
  const [recent, setRecent] = useState<RecentEntry[]>([]);
  // До ширини xl видно одну панель за раз: список, стаття або зведення.
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>("list");
  const [appearance, setAppearance] = useState<Appearance>(DEFAULT_APPEARANCE);
  const [systemDark, setSystemDark] = useState(false);
  const [printRequest, setPrintRequest] = useState(0);
  const [printedAt, setPrintedAt] = useState("");
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

    const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const trackSystemTheme = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    darkQuery.addEventListener("change", trackSystemTheme);

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
      setCitizenChecked(restored.citizenChecked);
      setExamineeType(restored.examineeType);
      setMode(restored.mode);
      setDirectory(restored.directory);
      if (restored.dropped) {
        setRestoreNotice(
          `${restored.dropped} збережених пунктів не знайдено в корпусі редакції від ${EDITION} — їх прибрано зі зведення.`,
        );
      }
      setHistory(readSearchHistory(localStorage.getItem(SEARCH_HISTORY_KEY)));
      const workspace = readWorkspace(localStorage.getItem(WORKSPACE_KEY));
      setLastSpecialty(workspace.specialty);
      setRecent(workspace.recent);
      setAppearance(readAppearance(localStorage.getItem(APPEARANCE_KEY)));
      setSystemDark(darkQuery.matches);
      setHydrated(true);
    }, 0);

    return () => {
      window.clearTimeout(hydrationTimer);
      window.removeEventListener("online", setConnected);
      window.removeEventListener("offline", setDisconnected);
      darkQuery.removeEventListener("change", trackSystemTheme);
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(APPEARANCE_KEY, serializeAppearance(appearance));
  }, [appearance, hydrated]);

  // Друк запускається після коміту, коли аркуш уже має актуальні дані.
  useEffect(() => {
    if (!printRequest) return;
    window.print();
  }, [printRequest]);

  // Тема і щільність живуть на <html>, тому діалоги та портали теж їх бачать.
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme", resolveTheme(appearance.theme, systemDark));
    root.setAttribute("data-density", appearance.density);
  }, [appearance, systemDark]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(
      SESSION_KEY,
      serializeSession({ basket, citizenChecked, examineeType, mode, directory }),
    );
  }, [basket, citizenChecked, directory, examineeType, hydrated, mode]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history));
  }, [history, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(
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

  /** Повертає застосунок на головний екран вибору спеціальності. */
  const resetToHome = useCallback(() => {
    setMobilePanel("list");
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

  /** Дослівні фрагменти пояснення для конкретного пункту статті. */
  const pointExplanationFor = useCallback(
    (point: string) => pointExplanation(explanation, point),
    [explanation],
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

  const summaryItem = strictestOutcome(basket);
  const summaryStyle = summaryItem ? outcomeStyles(summaryItem.outcome) : undefined;

  const draftText = useMemo(
    () =>
      mode === "doctor"
        ? buildDraftText(basket, examineeType)
        : buildCitizenSummaryText(basket, examineeType, citizenChecked),
    [basket, citizenChecked, examineeType, mode],
  );

  const referenceText =
    selected && selectedRule ? buildReferenceText(selected, selectedRule) : "";

  /** Записує відкриту статтю або пункт в останні перегляди. */
  function rememberView(article: string, point = "") {
    setRecent((current) => addRecent(current, { article, point }));
  }

  function resetArticleReview() {
    setChecked([]);
    setSelectedRuleIndex("");
    setCopied("");
  }

  function changeMode(nextMode: Mode) {
    setMode(nextMode);
    setOutcomeFilter("all");
  }

  function toggleCitizenCheck(item: string, value: boolean) {
    setCitizenChecked((current) =>
      value ? [...new Set([...current, item])] : current.filter((entry) => entry !== item),
    );
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

  /** Вибір результату пошуку: відкриває статтю, за потреби — конкретний пункт. */
  function chooseHit(hit: SearchHit, pointIndex?: number) {
    const article = hit.article;
    setMobilePanel("article");
    setSelectedId(article.id);
    setSpecialty(article.specialties[0]);
    setLastSpecialty(article.specialties[0]);
    setHistory((current) => addSearchHistory(current, query));
    setSearchOpen(false);
    setActiveHit(-1);
    setChecked([]);
    setCopied("");
    setSelectedRuleIndex(pointIndex === undefined ? "" : String(pointIndex));
    const rules = ARTICLE_RULES[article.article] ?? [];
    rememberView(article.article, pointIndex === undefined ? "" : (rules[pointIndex]?.point ?? ""));
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
    setMobilePanel("list");
    setSpecialty(next);
    setLastSpecialty(next);
    setQuery("");
    if (first) setSelectedId(first.id);
    resetArticleReview();
  }

  function selectFromList(article: VlkArticle) {
    setMobilePanel("article");
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

  function toggleCheck(step: string, next: boolean) {
    setChecked((current) =>
      next ? [...new Set([...current, step])] : current.filter((item) => item !== step),
    );
  }

  function addArticleRuleToBasket(article: VlkArticle, rule: ArticleRule) {
    const articleChanged = selected?.id !== article.id;
    rememberView(article.article, rule.point);
    setLastSpecialty(article.specialties[0]);
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
      `Стаття ${item.article}${item.point === "—" ? "" : `, пункт «${item.point}»`} — ${mode === "doctor" ? "у зведенні" : "збережена"}`,
    );
  }


  /** Відкриває запис з останніх переглядів. */
  function openRecent(entry: RecentEntry) {
    const article = ARTICLES.find((item) => item.article === entry.article);
    if (!article) return;
    setMobilePanel("article");
    setQuery("");
    setSearchOpen(false);
    setSpecialty(article.specialties[0]);
    setLastSpecialty(article.specialties[0]);
    setSelectedId(article.id);
    setChecked([]);
    setCopied("");
    const index = (ARTICLE_RULES[article.article] ?? []).findIndex(
      (rule) => rule.point === entry.point,
    );
    setSelectedRuleIndex(entry.point && index >= 0 ? String(index) : "");
    rememberView(entry.article, entry.point);
  }

  function openBasketItem(item: BasketItem) {
    const article = ARTICLES.find((entry) => entry.id === item.articleId);
    if (!article) return;
    setMobilePanel("article");
    rememberView(article.article, item.point);
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

  /**
   * Друк іде через аркуш у DOM, а не через нове вікно: popup блокують
   * браузери, а таблиця стилів @media print дає структурований документ.
   */
  function printDraft() {
    setPrintedAt(
      new Date().toLocaleString("uk-UA", { dateStyle: "short", timeStyle: "short" }),
    );
    setPrintRequest((current) => current + 1);
  }

  /** Стрілки переміщують фокус між вкладками панелей, як того очікує tablist. */
  const handleTabKeys = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const keys = ["ArrowLeft", "ArrowRight", "Home", "End"];
      if (!keys.includes(event.key)) return;
      event.preventDefault();
      const current = MOBILE_PANELS.findIndex((panel) => panel.id === mobilePanel);
      const last = MOBILE_PANELS.length - 1;
      let next = current;
      if (event.key === "ArrowRight") next = current >= last ? 0 : current + 1;
      if (event.key === "ArrowLeft") next = current <= 0 ? last : current - 1;
      if (event.key === "Home") next = 0;
      if (event.key === "End") next = last;
      const target = MOBILE_PANELS[next];
      setMobilePanel(target.id);
      const tabs = event.currentTarget.querySelectorAll<HTMLButtonElement>("[data-panel-tab]");
      tabs[next]?.focus();
    },
    [mobilePanel],
  );

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
    <>
    <main className="app-shell min-h-screen bg-[var(--background)] text-[var(--foreground)] xl:h-screen xl:overflow-hidden">
      <SwRegister />
      <Toaster position="bottom-center" />

      <header className="command-header sticky top-0 z-30 border-b border-[var(--brand-line)] bg-[var(--brand-ink)] shadow-[0_8px_24px_-18px_rgba(4,28,25,0.9)] xl:relative">
        <div className="relative z-10 mx-auto flex max-w-[1720px] flex-wrap items-center gap-2 px-3 py-2 lg:flex-nowrap lg:px-5">
          <div className="flex shrink-0 items-center gap-1.5">
            {showDashboard ? (
              <button
                type="button"
                onClick={goHome}
                aria-label="Назад до вибору спеціальності"
                title="Назад до вибору спеціальності"
                className={`grid size-10 shrink-0 place-items-center rounded-lg border border-[var(--hairline)] bg-[var(--surface)] text-[var(--accent-ink)] transition hover:bg-[var(--surface-sunken)] ${FOCUS_RING}`}
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
                className={`brand-command-button grid size-12 shrink-0 place-items-center rounded-lg ${FOCUS_RING}`}
              >
                <CommandBrand size={44} priority />
              </button>
            ) : (
              <div className="brand-command-button grid size-12 shrink-0 place-items-center rounded-lg">
                <CommandBrand size={44} priority />
              </div>
            )}

            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold leading-none text-[var(--on-brand)]">
                  {showDashboard ? (
                    <button
                      type="button"
                      onClick={goHome}
                      title="На головну — вибір спеціальності"
                      className={`rounded font-bold transition hover:text-[var(--gold-soft)] ${FOCUS_RING}`}
                    >
                      VLK Навігатор
                    </button>
                  ) : (
                    "VLK Навігатор"
                  )}
                </h1>
                <span className="rounded-full border border-[var(--brand-line)] bg-[var(--gold-wash)] px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-[var(--gold-text)]">
                  402
                </span>
              </div>
              <p className="mt-1 text-[11px] text-[var(--on-brand-soft)]">
                {showDashboard ? "Статті, пункти та ТДВ" : `Наказ МОУ №402 · редакція ${EDITION}`}
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
              <Search className="pointer-events-none absolute left-3 top-3.5 size-4 text-[var(--ink-soft)]" />
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
                className="h-11 w-full border-[var(--brand-line)] bg-[var(--panel)] pl-9 pr-10 text-sm shadow-[0_1px_2px_rgba(4,28,25,0.2)] transition-shadow focus-visible:shadow-[0_0_0_3px_rgba(181,139,53,0.22)]"
              />
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
                className="absolute left-0 right-0 top-12 z-50 overflow-hidden rounded-xl border border-[var(--hairline)] bg-[var(--surface)] shadow-lg"
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
                                <span className="grid size-7 shrink-0 place-items-center rounded-md bg-[var(--surface-accent)] text-[11px] font-black text-[var(--accent-ink-strong)]">
                                  {hit.article.article}
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-xs font-semibold">
                                    <Highlighted text={hit.article.title} query={query} />
                                  </span>
                                  <span className="mt-0.5 block truncate text-[10px] text-[var(--ink-muted)]">
                                    <Highlighted text={hit.article.icd} query={query} /> ·{" "}
                                    {MATCH_TYPE_LABELS[hit.matches[0]]}
                                  </span>
                                </span>
                              </button>

                              <div className="flex flex-wrap gap-1 px-3 pb-2 pl-12 pt-1.5">
                                {hitRules.map((rule, pointIndex) => {
                                  const style = outcomeStyles(rule.outcome);
                                  const inBasket = basket.some(
                                    (item) => item.id === `${hit.article.article}-${rule.point}`,
                                  );
                                  return (
                                    <span
                                      key={`${hit.article.id}-${rule.point}-${pointIndex}`}
                                      className="flex items-stretch overflow-hidden rounded-md border border-[var(--hairline)] bg-[var(--surface)]"
                                    >
                                      <button
                                        type="button"
                                        onClick={() => chooseHit(hit, pointIndex)}
                                        title={rule.condition}
                                        className={`flex items-center gap-1.5 px-1.5 py-1 text-[10px] font-bold hover:bg-[var(--surface-sunken)] ${FOCUS_RING}`}
                                      >
                                        <span className={`size-2 shrink-0 rounded-full ${style.dot}`} aria-hidden />
                                        {rule.point === "—" ? "без поділу" : rule.point.toUpperCase()}
                                        <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-black ${style.badge}`}>
                                          {style.label}
                                        </span>
                                      </button>
                                      <button
                                        type="button"
                                        aria-label={`Додати статтю ${hit.article.article}, ${pointLabel(rule.point)} до зведення`}
                                        title={inBasket ? "Уже у зведенні" : "Додати до зведення"}
                                        onClick={() => addArticleRuleToBasket(hit.article, rule)}
                                        className={`grid w-6 place-items-center border-l border-[var(--hairline)] ${inBasket ? "bg-[var(--surface-accent)] text-[var(--badge-positive-ink)]" : "text-[var(--accent-ink)] hover:bg-[var(--surface-sunken)]"} ${FOCUS_RING}`}
                                      >
                                        {inBasket ? <Check className="size-3" /> : <Plus className="size-3" />}
                                      </button>
                                    </span>
                                  );
                                })}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                      <p className="border-t border-[var(--hairline)] px-3 py-1.5 text-[10px] text-[var(--ink-faint)]">
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
                        <p className="text-[11px] font-semibold text-[var(--ink-soft)]">
                          Останні запити
                        </p>
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {history.map((item) => (
                            <button
                              key={item}
                              type="button"
                              onClick={() => runQuery(item)}
                              className={`rounded-full border border-[var(--hairline)] bg-[var(--surface)] px-2 py-1 text-[10px] font-semibold text-[var(--accent-ink)] hover:bg-[var(--surface-sunken)] ${FOCUS_RING}`}
                            >
                              {item}
                            </button>
                          ))}
                        </div>
                      </>
                    ) : null}
                    <p className="mt-2 text-[11px] font-semibold text-[var(--ink-soft)]">
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

          <div className="ml-auto flex shrink-0 items-center gap-1.5">
            <a
              href={SOURCE_URL}
              target="_blank"
              rel="noreferrer"
              className={`hidden items-center gap-1.5 rounded-full border border-[var(--brand-line)] bg-[var(--panel)] px-3 py-1.5 text-[11px] font-medium text-[var(--accent-ink-strong)] transition hover:border-[var(--gold-soft)] hover:text-[var(--primary)] sm:flex ${FOCUS_RING}`}
              title={`База статей, пунктів, пояснень і ТДВ звірена за редакцією Наказу №402 від ${EDITION}. Моніторинг нової редакції виконується окремою щоденною перевіркою.`}
            >
              <ShieldCheck className="size-3.5" /> Корпус: {EDITION}
            </a>
            <span
              className={`hidden items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11px] font-medium md:flex ${online ? "text-[var(--on-brand-soft)]" : "bg-[var(--warn-surface)] text-[var(--warn-ink)]"}`}
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
              </DialogContent>
            </Dialog>
            <TdvDialog
              article={selected}
              selectedPoint={selectedRule?.point}
              trigger={
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-10 text-[var(--on-brand-soft)] hover:bg-white/10 hover:text-white"
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
                  className="h-10 text-[var(--on-brand-soft)] hover:bg-white/10 hover:text-white"
                  aria-label="Ще дії"
                >
                  <MoreHorizontal />
                  <span className="hidden sm:inline">Ще</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel>Додаткові дії</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {mode === "doctor" ? (
                  <DropdownMenuItem onSelect={() => setDirectoryOpen(true)}>
                    <UsersRound />
                    Довідник лікарів ВЛК
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuItem asChild>
                  <a href={SOURCE_URL} target="_blank" rel="noreferrer">
                    <History />
                    Останні зміни в Наказі №402
                  </a>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-[11px] font-semibold">Тема</DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={appearance.theme}
                  onValueChange={(value) =>
                    setAppearance((current) => ({
                      ...current,
                      theme: value as Appearance["theme"],
                    }))
                  }
                >
                  {THEME_OPTIONS.map((option) => (
                    <DropdownMenuRadioItem key={option.id} value={option.id}>
                      {option.label}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-[11px] font-semibold">
                  Щільність списків
                </DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={appearance.density}
                  onValueChange={(value) =>
                    setAppearance((current) => ({
                      ...current,
                      density: value as Appearance["density"],
                    }))
                  }
                >
                  {DENSITY_OPTIONS.map((option) => (
                    <DropdownMenuRadioItem key={option.id} value={option.id}>
                      {option.label}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-[10px] font-normal text-[var(--ink-muted)]">
                  Корпус: редакція від {EDITION}
                </DropdownMenuLabel>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Результат пошуку озвучується, а не тільки показується. */}
      <p className="sr-only" role="status" aria-live="polite">
        {query.trim()
          ? `Знайдено ${articleCountLabel(searchResults.length)} за запитом ${query.trim()}`
          : ""}
      </p>

      {showDashboard ? (
        <>
      <div className="command-mode-bar border-b border-[var(--hairline)] bg-[var(--panel-head)]">
        <div className="mx-auto flex max-w-[1720px] flex-wrap items-center justify-between gap-2 px-3 py-1.5 lg:px-5">
          <div
            className="flex items-center gap-0.5 rounded-full border border-[var(--hairline)] bg-[var(--surface)] p-1"
            aria-label="Режим роботи"
          >
            {(["doctor", "citizen"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => changeMode(value)}
                aria-pressed={mode === value}
                className={`min-h-9 rounded-full px-3.5 py-1.5 text-xs font-medium transition ${FOCUS_RING} ${mode === value ? "bg-[var(--primary)] text-[var(--primary-foreground)] shadow-[var(--shadow-soft)]" : "text-[var(--ink-soft)] hover:text-[var(--foreground)]"}`}
              >
                {value === "doctor" ? "Лікар" : "Громадянин"}
              </button>
            ))}
          </div>
          <p className="hidden items-center gap-1.5 text-xs text-[var(--ink-muted)] md:flex">
            <ShieldCheck className="size-3.5 text-[var(--accent-ink)]" />
            {mode === "doctor"
              ? "Швидка нормативна звірка для роботи ВЛК"
              : "Підготовка документів, не визначення придатності"}
          </p>
          <button
            type="button"
            onClick={() => setDraftOpen(true)}
            className={`hidden min-h-9 items-center gap-2 rounded-full border border-[var(--warn-line)] bg-[var(--warn-surface)] px-3.5 py-1.5 text-xs font-medium text-[var(--warn-ink)] transition hover:border-[var(--warn-line)] xl:flex ${FOCUS_RING}`}
          >
            <ListPlus className="size-4" />
            {mode === "doctor" ? "Кошик діагнозів" : "Збережені норми"} · {basket.length}
          </button>
        </div>
      </div>

      {/*
        До ширини xl три панелі не вміщуються поруч, тому показується одна:
        лікар не прокручує 39 статей, щоб дістатися до тексту вибраної.
      */}
      <div
        role="tablist"
        aria-label="Панель робочого екрана"
        onKeyDown={handleTabKeys}
        className="mx-auto flex max-w-[1720px] gap-1 px-2 pt-2 xl:hidden"
      >
        {MOBILE_PANELS.map((panel) => {
          const active = mobilePanel === panel.id;
          const count =
            panel.id === "list"
              ? listArticles.length
              : panel.id === "summary"
                ? basket.length
                : 0;
          return (
            <button
              key={panel.id}
              type="button"
              role="tab"
              data-panel-tab
              aria-selected={active}
              aria-controls={`vlk-panel-${panel.id}`}
              tabIndex={active ? 0 : -1}
              onClick={() => setMobilePanel(panel.id)}
              className={`flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border px-2 text-xs font-semibold transition ${FOCUS_RING} ${active ? "border-[var(--accent-line)] bg-[var(--surface)] text-[var(--foreground)] shadow-[var(--shadow-soft)]" : "border-transparent bg-[var(--surface-sunken)] text-[var(--ink-soft)]"}`}
            >
              {mode === "doctor" ? panel.label : panel.citizenLabel}
              {count ? (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${active ? "bg-[var(--surface-accent)] text-[var(--accent-ink-strong)]" : "bg-[var(--surface)] text-[var(--ink-muted)]"}`}
                >
                  {count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="mx-auto grid max-w-[1720px] gap-2 p-2 lg:p-3 xl:h-[calc(100vh-105px)] xl:grid-cols-[330px_minmax(430px,1fr)_320px] xl:overflow-hidden">
        <aside
          id="vlk-panel-list"
          data-panel="list"
          className={`command-sidebar flex min-h-[440px] flex-col overflow-hidden rounded-2xl border border-[var(--hairline)] bg-[var(--rail)] text-[var(--foreground)] shadow-[var(--shadow-soft)] xl:min-h-0 ${mobilePanel === "list" ? "" : "hidden xl:flex"}`}
        >
          <div data-panel-head className="border-b border-[var(--hairline)] bg-[var(--panel-head)] px-2.5 py-2">
            <div className="flex items-center justify-between gap-2">
              <h2 className="min-w-0 truncate text-sm font-semibold">
                {query.trim()
                  ? `Знайдено ${articleCountLabel(searchResults.length)}`
                  : (selectedSpecialty?.label ?? "Усі статті")}
              </h2>
              {query.trim() ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => clearQuery({ notify: true })}
                  className="h-8 shrink-0 text-xs text-[var(--ink-soft)]"
                  title="Повернутися до списку статей вибраної спеціальності"
                >
                  <RotateCcw />
                  Скинути
                </Button>
              ) : null}
            </div>

            {/*
              Спеціальність, категорія і фільтр — три компактні поля замість
              сітки з восьми карток: список статей отримує висоту панелі.
            */}
            <div className="mt-2 grid gap-1.5">
              <div>
                <label className="sr-only" htmlFor="specialty-select">
                  Спеціальність
                </label>
                <Select
                  value={specialty || "all"}
                  onValueChange={(value) =>
                    value === "all" ? resetToHome() : changeSpecialty(value as SpecialtyId)
                  }
                >
                  <SelectTrigger
                    id="specialty-select"
                    className="h-9 w-full border-[var(--input)] bg-[var(--surface)] text-xs"
                  >
                    <SelectValue placeholder="Спеціальність" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Усі спеціальності</SelectItem>
                    {SPECIALTIES.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {specialtyName(item)} · {SPECIALTY_ARTICLE_COUNTS[item.id]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="sr-only" htmlFor="examinee-type">
                  Категорія оглядуваного
                </label>
                <Select value={examineeType} onValueChange={setExamineeType}>
                  <SelectTrigger
                    id="examinee-type"
                    className="h-9 w-full border-[var(--input)] bg-[var(--surface)] text-xs"
                  >
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

              {mode === "doctor" ? (
                <div>
                  <label className="sr-only" htmlFor="outcome-filter">
                    Фільтр за результатом
                  </label>
                  <Select
                    value={outcomeFilter}
                    onValueChange={(value) => setOutcomeFilter(value as OutcomeFilterId)}
                  >
                    <SelectTrigger
                      id="outcome-filter"
                      className="h-9 w-full border-[var(--input)] bg-[var(--surface)] text-xs"
                    >
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
                    <p className="mt-1 text-[10px] leading-4 text-[var(--ink-muted)]">
                      Угорі — {articleCountLabel(filteredCount)} із таким дослівним результатом.
                      Решта лишається приглушеною.
                    </p>
                  )}
                </div>
              ) : null}
            </div>
          </div>

          <div
            ref={listRef}
            onKeyDown={handleListKeys}
            data-panel-body
            className="min-h-0 flex-1 overflow-y-auto p-2 scrollbar-thin"
          >
            {listArticles.length ? (
              <ul
                data-article-list
                className="space-y-1"
                aria-label={query.trim() ? "Знайдені статті" : `Статті · ${selectedSpecialty?.label ?? "усі"}`}
              >
                {listArticles.map((article) => {
                  const isSelected = selected?.id === article.id;
                  const hit = hitsById.get(article.id);
                  const matches = hit?.matches ?? [];
                  const dimmed = !articleMatchesFilter(article);
                  return (
                    <li key={article.id} className={dimmed ? "opacity-45" : ""}>
                      <button
                        type="button"
                        data-article-row
                        data-dimmed={dimmed ? "true" : undefined}
                        aria-current={isSelected ? "true" : undefined}
                        onClick={() => selectFromList(article)}
                        className={`flex min-h-11 w-full items-start gap-2 rounded-lg border px-2 py-2 text-left transition ${FOCUS_RING} ${isSelected ? "border-[var(--accent-line)] bg-[var(--row-active)] shadow-[inset_3px_0_0_var(--accent-ink)]" : "border-transparent bg-[var(--row)] hover:border-[var(--hairline)] hover:bg-[var(--row-hover)]"}`}
                      >
                        <span
                          className={`grid size-7 shrink-0 place-items-center rounded-md text-xs font-bold ${isSelected ? "bg-[var(--primary)] text-[var(--primary-foreground)]" : "bg-[var(--surface-accent)] text-[var(--accent-ink-strong)]"}`}
                        >
                          {article.article}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-xs font-semibold leading-4">
                            <Highlighted text={article.title} query={query} />
                          </span>
                          <span className="mt-0.5 block break-words text-[10px] leading-4 text-[var(--ink-muted)]">
                            <Highlighted text={article.icd} query={query} />
                          </span>
                          {matches.length ? (
                            <span className="mt-1 flex flex-wrap gap-1">
                              {matches.map((match) => (
                                <span
                                  key={match}
                                  title={MATCH_TYPE_LABELS[match]}
                                  className="rounded-full bg-[var(--surface-accent)] px-1.5 py-0.5 text-[9px] font-semibold text-[var(--accent-ink-strong)]"
                                >
                                  збіг: {MATCH_TYPE_SHORT[match]}
                                </span>
                              ))}
                            </span>
                          ) : null}
                          {hit?.evidence ? (
                            <span className="mt-1 block text-[9px] leading-3.5 text-[var(--ink-muted)]">
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
              <div className="px-5 py-10 text-center text-xs leading-6 text-[var(--ink-muted)]">
                Нічого не знайдено.
                <br />
                Спробуйте коротшу назву, номер статті або код МКХ-10.
              </div>
            )}
          </div>

          <div
            className="shrink-0 truncate border-t border-[var(--hairline)] px-2.5 py-1.5 text-[10px] leading-4 text-[var(--ink-faint)]"
            title="Стрілки ↑↓ переміщують фокус списком"
          >
            {articleCountLabel(listArticles.length)} · редакція {EDITION}
            <span className="sr-only">. Стрілки вгору і вниз переміщують фокус списком.</span>
          </div>
        </aside>

        <section
          id="vlk-panel-article"
          aria-label="Вибрана стаття"
          data-panel="article"
          className={`normative-surface relative flex min-h-[560px] flex-col overflow-hidden rounded-2xl border border-[var(--hairline)] bg-[var(--panel)] shadow-[var(--shadow-soft)] xl:min-h-0 ${mobilePanel === "article" ? "" : "hidden xl:flex"}`}
        >
          {selected ? (
            <>
              <div data-panel-head className="shrink-0 border-b border-[var(--hairline)] bg-[var(--panel-head)] px-3 py-2.5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex min-w-[min(100%,280px)] flex-1 items-start gap-2.5">
                    <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-[var(--primary)] text-sm font-black text-[var(--primary-foreground)]">
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
                      </nav>
                      <p className="mt-1 text-[11px] font-medium text-[var(--ink-muted)]">
                        {specialtyLabels(selected)}
                      </p>
                      <h2 className="mt-1.5 text-xl font-semibold leading-tight tracking-[-0.02em] sm:text-[22px]">
                        <Highlighted text={selected.title} query={query} />
                      </h2>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1" title={`МКХ-10: ${selected.icd}`}>
                        <span className="text-[11px] font-semibold text-[var(--ink-muted)]">
                          МКХ-10
                        </span>
                        {icdTokens(selected.icd).map((token, index) => (
                          <span
                            key={`${token}-${index}`}
                            className="rounded-md bg-[var(--surface-accent)] px-1.5 py-0.5 text-[11px] font-semibold text-[var(--accent-ink-strong)]"
                          >
                            <Highlighted text={token} query={query} />
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex w-full shrink-0 flex-wrap gap-1.5 sm:w-auto">
                    <NormativePassportDialog
                      article={selected.article}
                      point={selectedRule?.point}
                      sourceUrl={sourceUrl}
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={!selectedRule}
                      onClick={() => copyText(referenceText, "reference")}
                      className="h-9 bg-[var(--surface)]"
                    >
                      {copied === "reference" ? <Check /> : <Copy />}
                      <span className="hidden sm:inline">
                        {copied === "reference" ? "Скопійовано" : "Копіювати"}
                      </span>
                    </Button>
                    <Button asChild size="sm" className="h-9 bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-[var(--primary-hover)]">
                      <a href={sourceUrl} target="_blank" rel="noreferrer">
                        <span className="hidden sm:inline">Відкрити у&nbsp;</span>№402
                        <ExternalLink />
                      </a>
                    </Button>
                  </div>
                </div>
              </div>

              <div data-panel-body className="relative min-h-0 flex-1 overflow-y-auto p-4 scrollbar-thin">
                {query.trim() && selectedEvidence ? (
                  <div className="mb-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-950" aria-label="Збіг у вибраній статті">
                    <span className="font-semibold">{MATCH_TYPE_LABELS[selectedEvidence.match]}: </span>
                    <Highlighted text={snippetAround(selectedEvidence.text, query)} query={query} />
                  </div>
                ) : null}
                <div className="grid items-start gap-3 sm:grid-cols-[minmax(0,1fr)_230px]">
                  <div className="min-w-0 overflow-hidden rounded-lg border border-[var(--hairline)] bg-[var(--surface-muted)]">
                    <Accordion type="single" collapsible defaultValue="included">
                      <AccordionItem value="included" className="border-none px-3">
                        <AccordionTrigger className="py-2.5 text-[11px] font-semibold text-[var(--ink-soft)] hover:no-underline">
                          Дослівно з Наказу №402 · «Включено»
                        </AccordionTrigger>
                        <AccordionContent>
                          <p className="break-words pb-3 text-[11px] leading-[1.15rem] text-[var(--ink-body)]">
                            <Highlighted text={selected.officialIncluded} query={query} />
                          </p>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  </div>

                  <div
                    className={`min-w-0 rounded-lg border p-3 ${selectedRule && tdvRule ? "border-[var(--danger-line)] bg-[var(--danger-surface)]" : "border-[var(--hairline)] bg-[var(--surface)]"}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[11px] font-semibold text-[var(--ink-soft)]">
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
                            className={`grid size-7 shrink-0 place-items-center rounded-md border border-[var(--hairline)] bg-[var(--surface)] text-[var(--accent-ink)] hover:bg-[var(--surface-sunken)] ${FOCUS_RING}`}
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
                      <Button asChild variant="outline" size="sm" className="h-8 bg-[var(--surface)] text-[10px]">
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

                <div className="mt-5 flex items-center justify-between">
                  <p className="text-[11px] font-semibold text-[var(--ink-soft)]">
                    Пункти статті
                  </p>
                  <span className="text-[10px] text-[var(--ink-muted)]">
                    {pointCountLabel(articleRules.length)}
                  </span>
                </div>

                <ul data-rule-list className="mt-2 space-y-2">
                  {articleRules.map((rule, index) => {
                    const active = selectedRuleIndex === String(index);
                    const style = outcomeStyles(rule.outcome);
                    const inBasket = basket.some(
                      (item) => item.id === `${selected.article}-${rule.point}`,
                    );
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
                          className={`overflow-hidden rounded-xl border transition ${active ? "command-selected-rule border-[var(--accent-line)] bg-[var(--surface)] shadow-[var(--shadow-soft)]" : "border-[var(--hairline)] bg-[var(--surface)] hover:border-[var(--accent-line)] hover:bg-[var(--panel-head)]"}`}
                        >
                          <button
                            type="button"
                            data-point-row
                            onClick={() => selectRule(active ? "" : String(index))}
                            aria-expanded={active}
                            className={`flex w-full items-start gap-3 p-3 text-left ${FOCUS_RING}`}
                          >
                            <span
                              className={`grid size-8 shrink-0 place-items-center rounded-md text-xs font-bold uppercase ${active ? "bg-[var(--primary)] text-[var(--primary-foreground)]" : "bg-[var(--surface-accent)] text-[var(--accent-ink-strong)]"}`}
                            >
                              {rule.point === "—" ? "•" : rule.point}
                            </span>
                            <span className="flex min-w-0 flex-1 flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
                              <span className="line-clamp-2 min-w-0 flex-1 text-xs leading-5 text-[var(--ink-body)] sm:text-sm">
                                <Highlighted text={rule.condition} query={query} />
                              </span>
                              <span
                                className={`shrink-0 self-start rounded-full px-2 py-1 text-[10px] font-semibold sm:self-auto ${style.badge}`}
                              >
                                {style.label}
                              </span>
                            </span>
                            <ChevronDown
                              className={`mt-1.5 size-4 shrink-0 text-[var(--ink-soft)] transition ${active ? "rotate-180" : ""}`}
                            />
                          </button>

                          {active ? (
                            <div className="border-t border-[var(--hairline)] bg-[var(--panel-head)] px-3 pb-3 pt-2.5">
                              <p className="text-[11px] font-semibold text-[var(--ink-soft)]">
                                Стан за пунктом · дослівно
                              </p>
                              <p className="mt-1 text-xs leading-5 text-[var(--ink-body)]">
                                <Highlighted text={rule.condition} query={query} />
                              </p>

                              {/* Орієнтир позначається смугою тону, а не ще однією коробкою. */}
                              <div className={`mt-3 border-l-2 pl-3 ${style.bar}`}>
                                <p className="text-[11px] font-semibold text-[var(--ink-soft)]">
                                  {mode === "doctor"
                                    ? "Попередній нормативний орієнтир · не рішення ВЛК"
                                    : "Дослівне формулювання Наказу №402 · не персональний висновок"}
                                </p>
                                <p className="mt-1 text-sm font-semibold leading-5">«{rule.outcome}»</p>
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
                                {pointMarks.length ? (
                                  <div className="mt-1.5 flex flex-wrap gap-1">
                                    {pointMarks.map((column) => (
                                      <span
                                        key={column.id}
                                        title={column.label}
                                        className="rounded bg-[var(--surface-sunken)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--ink-body)]"
                                      >
                                        {column.id}: {pointTdv?.[column.id]}
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="mt-1 text-[10px] leading-4 text-[var(--ink-muted)]">
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
                                      Офіційне пояснення до {pointLabelGenitive(rule.point)} ·{" "}
                                      {pointText.length}
                                    </AccordionTrigger>
                                    <AccordionContent>
                                      <div className="max-h-[65vh] space-y-1.5 overflow-y-auto border-t border-[var(--hairline)] py-2 pr-1 scrollbar-thin">
                                        <ExplanationDocument article={selected.article} paragraphs={explanation?.paragraphs ?? []} excerpt={pointText} query={query} />
                                      </div>
                                    </AccordionContent>
                                  </AccordionItem>
                                </Accordion>
                              ) : null}

                              <div className="mt-3 flex flex-wrap gap-1.5 border-t border-[var(--hairline)] pt-2.5">
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={() => addArticleRuleToBasket(selected, rule)}
                                  disabled={inBasket}
                                  className="h-9 bg-[var(--primary)] text-xs text-[var(--primary-foreground)] hover:bg-[var(--primary-hover)]"
                                >
                                  {inBasket ? (
                                    <>
                                      <Check />
                                      {mode === "doctor" ? "У зведенні" : "Збережено"}
                                    </>
                                  ) : (
                                    <>
                                      <Plus />
                                      {mode === "doctor" ? "Додати до зведення" : "Зберегти норму"}
                                    </>
                                  )}
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => copyText(buildReferenceText(selected, rule), "reference")}
                                  className="h-9 bg-[var(--surface)] text-xs"
                                >
                                  <Copy />
                                  Копіювати
                                </Button>
                                <Button asChild size="sm" variant="outline" className="h-9 bg-[var(--surface)] text-xs">
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

                <Accordion type="single" collapsible className="mt-5">
                  <AccordionItem
                    value="article-explanation"
                    className="overflow-hidden rounded-lg border border-[var(--hairline)] bg-[var(--surface-muted)] px-3"
                  >
                    <AccordionTrigger className="py-2.5 text-xs font-bold hover:no-underline">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <BookOpen className="size-4 shrink-0 text-[var(--accent-ink)]" />
                        Офіційні пояснення до статті {selected.article}
                        <span className="rounded-full bg-[var(--surface)] px-2 py-0.5 text-[9px] font-black text-[var(--accent-ink-strong)]">
                          {explanationMeta?.status === "absent"
                            ? "немає в Додатку 2"
                            : `дослівно · ${explanationMeta?.paragraphs ?? 0} фрагментів`}
                        </span>
                      </span>
                    </AccordionTrigger>
                    <AccordionContent>
                      {explanationMeta?.status === "absent" ? (
                        <p className="pb-3 text-xs leading-5 text-[var(--ink-muted)]">
                          Для статті {selected.article} окремого пояснення в Додатку 2 чинної
                          редакції немає. Використовуйте дослівний рядок Розкладу хвороб, обраний
                          пункт і ТДВ.
                        </p>
                      ) : explanationState === "loading" ? (
                        <p className="pb-3 text-xs text-[var(--ink-muted)]" aria-live="polite">
                          Завантаження дослівного пояснення…
                        </p>
                      ) : explanationState === "error" ? (
                        <p className="pb-3 text-xs text-[var(--danger-ink)]" aria-live="polite">
                          Пояснення не завантажилося. Перевірте з’єднання або відкрийте офіційне
                          джерело.
                        </p>
                      ) : (
                        <div className="pb-3">
                          <div className="max-h-[70vh] space-y-2 overflow-y-auto border-y border-[var(--hairline)] py-2 pr-1 scrollbar-gutter-stable scrollbar-thin">
                            <ExplanationDocument article={selected.article} paragraphs={explanation?.paragraphs ?? []} query={query} />
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <Button asChild variant="outline" size="sm" className="h-8 bg-[var(--surface)] text-[10px]">
                              <a href={explanationUrl} target="_blank" rel="noreferrer">
                                Джерело · Додаток 2 <ExternalLink />
                              </a>
                            </Button>
                            <p className="text-[9px] leading-4 text-[var(--ink-muted)]">
                              Пояснення допомагає звірити критерії, але не встановлює діагноз і не
                              замінює постанову ВЛК.
                            </p>
                          </div>
                        </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
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

        {mode === "citizen" ? (
          <CitizenPreparation
            checked={citizenChecked}
            selected={selected}
            selectedRule={selectedRule}
            onToggle={toggleCitizenCheck}
            className={mobilePanel === "summary" ? "" : "hidden xl:flex"}
          />
        ) : (
        <aside
          id="vlk-panel-summary"
          data-panel="summary"
          className={`verification-rail flex min-h-[440px] flex-col overflow-hidden rounded-2xl border border-[var(--hairline)] bg-[var(--rail)] shadow-[var(--shadow-soft)] xl:min-h-0 ${mobilePanel === "summary" ? "" : "hidden xl:flex"}`}
        >
          <div data-panel-head className="flex items-center justify-between border-b border-[var(--hairline)] bg-[var(--panel-head)] px-3 py-2.5">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--accent-ink)]">
                Резюме стану
              </p>
              <h2 className="mt-0.5 text-sm font-bold">Попереднє зведення</h2>
            </div>
            <span className="rounded-full bg-[var(--surface-accent)] px-2 py-1 text-[10px] font-bold text-[var(--accent-ink-strong)]">
              локально
            </span>
          </div>

          <div data-panel-body className="min-h-0 flex-1 overflow-y-auto p-2.5 scrollbar-thin">
            {restoreNotice ? (
              <div className="mb-2 rounded-lg border border-[var(--warn-line)] bg-[var(--warn-surface)] p-2 text-[10px] leading-4 text-[var(--warn-ink)]">
                {restoreNotice}
              </div>
            ) : null}

            {summaryItem && summaryStyle ? (
              <div className={`rounded-lg border p-3 ${summaryStyle.box}`} aria-live="polite">
                <div className="flex items-center justify-between gap-2">
                  <span className={`rounded-full px-2 py-1 text-[10px] font-black ${summaryStyle.badge}`}>
                    {summaryStyle.label}
                  </span>
                  <span className="text-[10px] font-bold text-[var(--ink-soft)]">найсуворіший орієнтир</span>
                </div>
                <h3 className="mt-2 font-black">
                  Стаття {summaryItem.article}
                  {summaryItem.point === "—" ? "" : `, пункт «${summaryItem.point}»`}
                </h3>
                <p className="mt-1.5 text-xs font-semibold leading-5">«{summaryItem.outcome}»</p>
                <p className="mt-2 text-[10px] leading-4 text-[var(--ink-muted)]">
                  Категорія: {examineeType}. Остаточна звірка — лікарем за графою і ТДВ.
                </p>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-[var(--accent-line)] bg-[var(--surface)] px-5 py-8 text-center">
                <ClipboardCheck className="mx-auto size-6 text-[var(--accent-ink)]" />
                <h3 className="mt-3 text-sm font-semibold tracking-tight">Кошик порожній</h3>
                <p className="mx-auto mt-1.5 max-w-[220px] text-xs leading-6 text-[var(--ink-muted)]">
                  Оберіть пункт статті та додайте його до зведення.
                </p>
              </div>
            )}

            <div className="mt-3 flex items-center justify-between">
              <p className="text-[11px] font-semibold text-[var(--ink-soft)]">
                Кошик діагнозів · {basket.length}
              </p>
              {basket.length ? (
                <button
                  type="button"
                  onClick={() => setBasket([])}
                  className={`rounded px-1 py-0.5 text-[10px] font-bold text-[var(--danger-ink)] ${FOCUS_RING}`}
                >
                  Очистити
                </button>
              ) : null}
            </div>
            <div className="mt-1.5 space-y-1.5">
              {basket.map((item) => {
                const style = outcomeStyles(item.outcome);
                return (
                  <div key={item.id} className="rounded-lg border border-[var(--hairline)] bg-[var(--surface)] p-2">
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
                        <span className="mt-0.5 block break-words text-[10px] text-[var(--ink-muted)]">
                          {item.icd} · {item.doctors}
                        </span>
                      </button>
                      <button
                        type="button"
                        aria-label={`Видалити статтю ${item.article} зі зведення`}
                        onClick={() => setBasket((current) => current.filter((entry) => entry.id !== item.id))}
                        className={`grid size-9 shrink-0 place-items-center rounded-md text-[var(--danger-ink)] hover:bg-[var(--danger-surface)] ${FOCUS_RING}`}
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

            <div className="mt-3 rounded-lg border border-[var(--warn-line)] bg-[var(--warn-surface)] p-2.5">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[var(--warn-ink)]" />
                <p className="text-[10px] leading-4 text-[var(--warn-ink)]">
                  Алгоритм показує найсуворіший попередній орієнтир, але не враховує медичну
                  взаємодію кількох станів і не замінює постанову ВЛК.
                </p>
              </div>
            </div>
          </div>

          <div className="shrink-0 space-y-1.5 border-t border-[var(--hairline)] bg-[var(--surface)] p-2.5">
            <Button
              type="button"
              size="sm"
              onClick={() => setDraftOpen(true)}
              disabled={!basket.length}
              className="h-10 w-full bg-[var(--primary)] text-xs text-[var(--primary-foreground)] hover:bg-[var(--primary-hover)]"
            >
              <FileText />
              Створити зведення
            </Button>
            <div className="flex items-center justify-center gap-1.5 pt-1 text-[9px] text-[var(--ink-faint)]">
              <ShieldCheck className="size-3" />
              Дані зберігаються тільки в цьому браузері
            </div>
          </div>
        </aside>
        )}
      </div>
        </>
      ) : (
        <div className="mx-auto flex max-w-[940px] flex-col items-center px-4 py-14 text-center sm:px-6 lg:py-20">
          {EDITION_NOTICE ? (
            <a
              href={EDITION_NOTICE.url}
              target="_blank"
              rel="noreferrer"
              className="mb-4 flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--warn-line)] bg-[var(--warn-surface)] px-3 py-2 text-xs font-bold text-[var(--warn-ink)]"
            >
              <AlertTriangle className="size-4" />
              {EDITION_NOTICE.message}
            </a>
          ) : null}

          <div
            className="mb-6 flex items-center gap-1 rounded-full border border-[var(--hairline)] bg-[var(--surface)] p-1 shadow-[var(--shadow-soft)]"
            aria-label="Оберіть режим навігатора"
          >
            {(["doctor", "citizen"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => changeMode(value)}
                aria-pressed={mode === value}
                className={`min-h-10 rounded-full px-5 py-2 text-sm font-semibold transition ${FOCUS_RING} ${mode === value ? "bg-[var(--primary)] text-[var(--primary-foreground)]" : "text-[var(--ink-soft)] hover:bg-[var(--surface-sunken)]"}`}
              >
                {value === "doctor" ? "Я лікар" : "Я проходжу ВЛК"}
              </button>
            ))}
          </div>

          {mode === "doctor" && lastSpecialty ? (
            <Button
              type="button"
              onClick={() => changeSpecialty(lastSpecialty)}
              className="h-11 bg-[var(--primary)] px-5 text-sm text-[var(--primary-foreground)] hover:bg-[var(--primary-hover)]"
            >
              Продовжити як{" "}
              {SPECIALTIES.find((item) => item.id === lastSpecialty)?.label ?? "лікар"}
              <ChevronDown className="-rotate-90" />
            </Button>
          ) : null}

          <p
            className={`text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--accent-ink)] ${lastSpecialty ? "mt-6" : ""}`}
          >
            {mode === "doctor" && lastSpecialty ? "Або почніть спочатку" : "Крок 1"}
          </p>
          <h2 className="mt-3 max-w-2xl text-[28px] font-semibold leading-[1.15] tracking-[-0.02em] sm:text-[34px]">
            {mode === "doctor"
              ? "Знайдіть статтю, пункт і нормативний орієнтир"
              : "Підготуйтеся до ВЛК без здогадок і самодіагностики"}
          </h2>
          <p className="mt-4 max-w-xl text-[15px] leading-7 text-[var(--ink-soft)]">
            {mode === "doctor"
              ? "Введіть діагноз, код МКХ-10 або номер статті. Спеціальність допоможе звузити список, але для пошуку вона не обов’язкова."
              : "Знайдіть норму за діагнозом або кодом МКХ-10, звірте дослівний пункт і зберіть документи, які підтверджують порушення функцій."}
          </p>

          <ol
            className="mt-6 grid w-full max-w-2xl gap-2 text-left sm:grid-cols-3"
            aria-label="Як працює навігатор"
          >
            {(mode === "doctor" ? DOCTOR_WORKFLOW_STEPS : CITIZEN_WORKFLOW_STEPS).map(
              ([step, title, description]) => (
              <li
                key={step}
                className="flex items-center gap-3 rounded-xl border border-[var(--hairline)] bg-[var(--surface)] px-3 py-2.5 shadow-[var(--shadow-soft)]"
              >
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[var(--surface-accent)] text-xs font-black text-[var(--accent-ink-strong)]">
                  {step}
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-bold text-[var(--foreground)]">{title}</span>
                  <span className="block text-[11px] leading-4 text-[var(--ink-muted)]">{description}</span>
                </span>
              </li>
              ),
            )}
          </ol>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <span className="text-[11px] font-bold text-[var(--ink-soft)]">Спробуйте:</span>
            {POPULAR_QUERIES.slice(0, 4).map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => runQuery(example)}
                className={`rounded-full border border-[var(--hairline)] bg-[var(--surface)] px-3.5 py-1.5 text-[12px] font-medium text-[var(--accent-ink)] shadow-[var(--shadow-soft)] transition hover:border-[var(--accent-line)] hover:text-[var(--accent-ink-strong)] ${FOCUS_RING}`}
              >
                {example}
              </button>
            ))}
          </div>

          {recent.length ? (
            <div className="mt-9 w-full">
              <p className="text-[11px] font-semibold text-[var(--ink-soft)]">
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
                      className={`flex items-center gap-1.5 rounded-full border border-[var(--hairline)] bg-[var(--surface)] px-2 py-1 text-[11px] font-semibold text-[var(--accent-ink)] hover:bg-[var(--surface-sunken)] ${FOCUS_RING}`}
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

          {mode === "doctor" ? (
            <div className="mt-10 grid w-full grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
              {welcomeSpecialties.map((item) => {
                const count = ARTICLES.filter((article) =>
                  article.specialties.includes(item.id),
                ).length;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => changeSpecialty(item.id)}
                    className={`lift min-h-[86px] rounded-2xl border border-[var(--hairline)] bg-[var(--surface)] px-4 py-4 text-left shadow-[var(--shadow-soft)] hover:border-[var(--accent-line)] ${FOCUS_RING}`}
                  >
                    <span className="block hyphens-auto break-words text-[15px] font-semibold leading-snug tracking-tight">
                      {compactSpecialtyName(item)}
                    </span>
                    <span className="mt-1.5 block text-[11px] text-[var(--ink-faint)]">
                      {articleCountLabel(count)}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="mt-9 w-full max-w-2xl rounded-2xl border border-[var(--hairline)] bg-[var(--surface)] p-4 text-left shadow-[var(--shadow-soft)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--accent-ink)]">
                    Що підготувати
                  </p>
                  <h3 className="mt-1 text-base font-bold">Базовий чекліст перед ВЛК</h3>
                </div>
                <span className="rounded-full bg-[var(--surface-accent)] px-2 py-1 text-[10px] font-bold text-[var(--accent-ink-strong)]">
                  без передачі даних
                </span>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {CITIZEN_PREPARATION_CHECKS.map((item) => (
                  <div key={item} className="flex items-start gap-2 rounded-lg bg-[var(--surface-muted)] p-2.5">
                    <ShieldCheck className="mt-0.5 size-4 shrink-0 text-[var(--accent-ink)]" />
                    <span className="text-xs leading-5 text-[var(--ink-body)]">{item}</span>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs leading-5 text-[var(--ink-muted)]">
                Почніть із пошуку у верхньому полі. Після вибору статті чекліст залишатиметься
                праворуч на робочому екрані.
              </p>
            </div>
          )}

          <TdvDialog
            trigger={
              <Button type="button" variant="outline" className="mt-4 h-10 bg-[var(--surface)]">
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
              className="mt-5 h-10 bg-[var(--surface)]"
            >
              <ListPlus />
              Відкрити збережене зведення · {basket.length}
            </Button>
          ) : null}

          <p className="mt-12 flex items-center gap-1.5 text-[11px] text-[var(--ink-faint)]">
            <ShieldCheck className="size-3.5" />
            Довідкова навігація, не рішення ВЛК · корпус: редакція від {EDITION}
          </p>
        </div>
      )}

      <Dialog open={draftOpen} onOpenChange={setDraftOpen}>
        <DialogContent className="max-h-[90vh] overflow-hidden p-0 sm:max-w-3xl">
          <DialogHeader className="border-b border-[var(--hairline)] p-4 pr-12">
            <DialogTitle>
              {mode === "doctor" ? "Зведення для перевірки лікарем" : "Мій список підготовки до ВЛК"}
            </DialogTitle>
            <DialogDescription>
              {mode === "doctor"
                ? "Статті, пункти, ТДВ, чекліст і джерела. Довідкова навігація, не рішення ВЛК."
                : "Збережені норми, відмічені документи та офіційне джерело. Не визначає придатність."}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[58vh] overflow-y-auto scrollbar-thin">
            <div className="border-b border-[var(--hairline)] bg-[var(--surface)] px-4 py-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--ink-soft)]">
                  {mode === "doctor"
                    ? "Що ще треба перевірити перед постановою"
                    : "Що вже підготовлено до проходження ВЛК"}
                </p>
                <span className="text-[10px] font-bold text-[var(--ink-muted)]">
                  {mode === "doctor"
                    ? `${checked.length}/${ANALYSIS_CHECKS.length}`
                    : `${citizenChecked.length}/${CITIZEN_PREPARATION_CHECKS.length}`}
                </span>
              </div>
              <div className="mt-1.5 grid gap-1.5 sm:grid-cols-2">
                {(mode === "doctor" ? ANALYSIS_CHECKS : CITIZEN_PREPARATION_CHECKS).map((step) => (
                  <label
                    key={step}
                    className="flex min-h-10 cursor-pointer items-start gap-2 rounded-lg border border-[var(--hairline)] bg-[var(--surface)] p-2"
                  >
                    <Checkbox
                      checked={
                        mode === "doctor"
                          ? checked.includes(step)
                          : citizenChecked.includes(step)
                      }
                      onCheckedChange={(value) =>
                        mode === "doctor"
                          ? toggleCheck(step, value === true)
                          : toggleCitizenCheck(step, value === true)
                      }
                      className="mt-0.5"
                    />
                    <span className="text-xs leading-4">{step}</span>
                  </label>
                ))}
              </div>
            </div>
            <pre className="whitespace-pre-wrap break-words bg-[var(--surface-muted)] p-4 font-sans text-xs leading-5 text-[var(--ink-body)]">
              {draftText}
            </pre>
          </div>
          <DialogFooter className="border-t border-[var(--hairline)] p-3">
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
            <Button onClick={() => setDraftOpen(false)} className="bg-[var(--primary)] text-[var(--primary-foreground)]">
              Готово
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>

    {/*
      Аркуш для друку та збереження в PDF. У звичайному режимі він
      прихований, а під час друку інтерфейс ховається і на папір іде
      документ: редакція, статті з дослівним результатом, чекліст і джерело.
    */}
    <div className="print-root print-sheet">
      <h1>
        {mode === "doctor"
          ? "Попереднє навігаційне зведення ВЛК"
          : "Список підготовки до ВЛК"}
      </h1>
      <p className="print-meta">
        Наказ МОУ №402, редакція від {EDITION}
        {mode === "doctor" ? ` · категорія оглядуваного: ${examineeType}` : ""}
        {printedAt ? ` · сформовано ${printedAt}` : ""}
      </p>

      {basket.length ? (
        basket.map((item, index) => (
          <div key={item.id} className="print-item">
            <h3>
              {index + 1}. Стаття {item.article}
              {item.point === "—" ? "" : `, пункт «${item.point}»`} · {item.title}
            </h3>
            <p>МКХ-10: {item.icd}</p>
            <p className="print-label">Стан за пунктом, дослівно</p>
            <p>{item.condition}</p>
            <p className="print-label">Результат за четвертою графою, дослівно</p>
            <p className="print-outcome">«{item.outcome}»</p>
            <p>Профільні лікарі: {item.doctors}</p>
          </div>
        ))
      ) : (
        <p>Зведення порожнє: жодного пункту статті не додано.</p>
      )}

      {basket.length && mode === "doctor" && summaryItem ? (
        <p>
          <span className="print-label">Найсуворіший орієнтир: </span>
          Стаття {summaryItem.article}
          {summaryItem.point === "—" ? "" : `, пункт «${summaryItem.point}»`} — «
          {summaryItem.outcome}»
        </p>
      ) : null}

      <h2>
        {mode === "doctor"
          ? "Що ще треба перевірити перед постановою"
          : "Що вже підготовлено до проходження ВЛК"}
      </h2>
      <ul>
        {(mode === "doctor" ? ANALYSIS_CHECKS : CITIZEN_PREPARATION_CHECKS).map((step) => (
          <li key={step}>
            {(mode === "doctor" ? checked : citizenChecked).includes(step) ? "[x]" : "[ ]"} {step}
          </li>
        ))}
      </ul>

      <p className="print-note">
        Довідкова навігація за Наказом МОУ №402, а не постанова ВЛК і не медичний висновок.
        Остаточне рішення приймає лікарсько-військова комісія за дослівним текстом Розкладу
        хвороб, поясненнями Додатка 2 і таблицею додаткових вимог. Джерело: {SOURCE_URL}
      </p>
    </div>
    </>
  );
}

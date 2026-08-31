"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  Check,
  ClipboardCheck,
  Copy,
  ExternalLink,
  FileText,
  History,
  ListPlus,
  Plus,
  Printer,
  RotateCcw,
  ShieldCheck,
  UserRound,
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
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { SwRegister } from "@/components/sw-register";
import { ARTICLE_ANCHORS } from "@/lib/vlk-anchors";
import { ARTICLE_RULES } from "@/lib/vlk-rules";
import {
  ARTICLES,
  EDITION,
  SOURCE_URL,
  SPECIALTIES,
  type SpecialtyId,
  type VlkArticle,
} from "@/lib/vlk-sample-data";
import { DIAGNOSIS_ALIASES } from "@/lib/diagnosis-aliases";
import { TDV_COLUMNS, TDV_RULES } from "@/lib/vlk-tdv";
import {
  ARTICLE_EXPLANATIONS,
  EXPLANATION_EDITION,
  EXPLANATION_SOURCE_URL,
  type ArticleExplanation,
} from "@/lib/vlk-explanations";

const SESSION_KEY = "vlk-402-preview-session-v1";
const TDV_URL = "https://zakon.rada.gov.ua/laws/show/z1109-08/ed20250822#n2820";
const TDV_DOCX_URL = "https://zakon.rada.gov.ua/laws/file/text/122/f277457n7455.docx";

const EXAMINEE_TYPES = [
  "Військовозобов’язаний",
  "Військовослужбовець",
  "Кандидат на контракт",
  "Кандидат до ВВНЗ",
];

const ANALYSIS_CHECKS = [
  "Діагноз і код підтверджені документами",
  "Порушення функцій об’єктивно описані",
  "Профільні обстеження завершені",
  "Офіційні пояснення до статті звірено",
  "Графу обліку та ТДВ звірено",
];

type Mode = "express" | "detailed";

type BasketItem = {
  id: string;
  articleId: string;
  article: string;
  title: string;
  icd: string;
  officialIncluded?: string;
  point: string;
  condition: string;
  outcome: string;
  doctors: string;
};

type DoctorDirectory = Record<SpecialtyId, string>;

const EMPTY_DIRECTORY = Object.fromEntries(
  SPECIALTIES.map((item) => [item.id, ""]),
) as DoctorDirectory;

function normalize(value: string) {
  return value
    .toLocaleLowerCase("uk")
    .replace(/[’'`]/g, "")
    .replace(/[^a-zа-яіїєґ0-9.]+/gi, " ")
    .trim();
}

function articleCountLabel(count: number) {
  const lastTwo = count % 100;
  const last = count % 10;
  const word = lastTwo >= 11 && lastTwo <= 14 ? "статей" : last === 1 ? "стаття" : last >= 2 && last <= 4 ? "статті" : "статей";
  return `${count} ${word}`;
}

function doctorLabels(article: VlkArticle) {
  return article.specialties
    .map((id) => SPECIALTIES.find((item) => item.id === id)?.label)
    .filter(Boolean)
    .join(", ");
}

function searchParts(article: VlkArticle, directory: DoctorDirectory) {
  const rules = ARTICLE_RULES[article.article] ?? [];
  const explanation = ARTICLE_EXPLANATIONS[article.article];
  return [
    `стаття ${article.article}`,
    article.title,
    article.icd,
    article.officialIncluded,
    article.summary,
    doctorLabels(article),
    ...article.keywords,
    ...(DIAGNOSIS_ALIASES[article.article] ?? []),
    ...article.specialties.map((id) => directory[id]),
    ...rules.flatMap((rule) => [rule.condition, rule.outcome, `пункт ${rule.point}`]),
    ...(explanation?.paragraphs ?? []),
  ];
}

function matchesArticle(article: VlkArticle, value: string, directory: DoctorDirectory) {
  const words = normalize(value).split(" ").filter(Boolean);
  if (!words.length) return true;
  const haystack = normalize(searchParts(article, directory).join(" "));
  return words.every((word) => haystack.includes(word));
}

function searchScore(article: VlkArticle, value: string, directory: DoctorDirectory) {
  const needle = normalize(value);
  if (!needle) return 0;
  const aliases = (DIAGNOSIS_ALIASES[article.article] ?? []).map(normalize);
  if (normalize(article.icd).includes(needle)) return 130;
  if (article.specialties.some((id) => normalize(directory[id]).includes(needle))) return 125;
  if (aliases.some((alias) => alias === needle)) return 120;
  if (aliases.some((alias) => alias.includes(needle))) return 110;
  if (normalize(article.title).includes(needle)) return 100;
  if (normalize(article.officialIncluded).includes(needle)) return 95;
  if (normalize(doctorLabels(article)).includes(needle)) return 90;
  if (article.keywords.some((keyword) => normalize(keyword).includes(needle))) return 80;
  if ((ARTICLE_RULES[article.article] ?? []).some((rule) => normalize(rule.condition).includes(needle))) return 70;
  return 50;
}

function textFragment(value: string) {
  const compact = value.replace(/\s+/g, " ").trim();
  const shortened = compact.length > 150 ? compact.slice(0, compact.lastIndexOf(" ", 150)) : compact;
  return encodeURIComponent(shortened);
}

function officialArticleUrl(article: string, highlight?: string) {
  const anchor = ARTICLE_ANCHORS[article] ?? "n1523";
  const base = `https://zakon.rada.gov.ua/laws/show/z1109-08/ed20250822#${anchor}`;
  return highlight ? `${base}:~:text=${textFragment(highlight)}` : base;
}

function severity(outcome: string) {
  if (outcome.startsWith("Непридатні до військової служби") && !outcome.includes("переогляд")) return 4;
  if (outcome.includes("Тимчасово") || outcome.includes("переогляд")) return 3;
  if (outcome.includes("частинах забезпечення")) return 2;
  return 1;
}

function outcomeStyle(outcome: string) {
  if (outcome.startsWith("Непридатні до військової служби") && !outcome.includes("переогляд")) {
    return { short: "Непридатний", box: "border-[#ba4a4a]/22 bg-[#fff1ef]", badge: "bg-[#f3ceca] text-[#7d2929]" };
  }
  if (outcome.includes("Тимчасово") || outcome.includes("переогляд")) {
    return { short: "Тимчасово / переогляд", box: "border-[#c58b28]/25 bg-[#fff8e7]", badge: "bg-[#f2ddaa] text-[#6d4d12]" };
  }
  if (outcome.includes("частинах забезпечення")) {
    return { short: "Визначені види служби", box: "border-[#c58b28]/25 bg-[#fff8e7]", badge: "bg-[#f2ddaa] text-[#6d4d12]" };
  }
  return { short: "Придатний", box: "border-[#2f806f]/20 bg-[#edf7f2]", badge: "bg-[#cfe8dd] text-[#205f51]" };
}

function pointLabel(point: string) {
  return point === "—" ? "без поділу" : `пункт «${point}»`;
}

const EXPLANATION_SIGNALS = [
  { label: "Порушення функцій", pattern: /порушенн\w* функц/iu },
  { label: "Стаціонарне обстеження", pattern: /стаціонар/iu },
  { label: "Інструментальні дані", pattern: /інструменталь|рентген|томограф|мрт|кт\b|екг|аудіометр/iu },
  { label: "Лабораторні дані", pattern: /лаборатор/iu },
  { label: "Динаміка стану", pattern: /динаміч|повторн\w* обстеж|стійк\w* ремісі/iu },
  { label: "Профільний спеціаліст", pattern: /невропатолог|невролог|кардіолог|уролог|психіатр|офтальмолог|отоларинголог|хірург|дерматолог|ендокринолог|гематолог|мамолог/iu },
] as const;

function pointMentions(value: string) {
  if (!/пункт/iu.test(value)) return [];
  const prefix = value.slice(0, 220);
  const quoted = [...prefix.matchAll(/[«"“]([а-г])[»"”]/giu)].map((match) => match[1].toLocaleLowerCase("uk"));
  const plain = [...prefix.matchAll(/пункт(?:у|ом|ами|ів|и)?\s+([а-г])(?:\b|\))/giu)].map((match) => match[1].toLocaleLowerCase("uk"));
  return [...new Set([...quoted, ...plain])];
}

function pointExplanation(explanation: ArticleExplanation | undefined, point: string) {
  if (!explanation?.paragraphs.length) return [];
  if (point === "—") return explanation.paragraphs.slice(0, 8);

  const result: string[] = [];
  let active = false;
  for (const paragraph of explanation.paragraphs) {
    const mentions = pointMentions(paragraph);
    const startsSection = /^(?:\d+\)\s*)?(?:до|за)\s+пункт|^пункт/iu.test(paragraph);
    if (startsSection && mentions.length) active = mentions.includes(point);
    if (active || mentions.includes(point)) result.push(paragraph);
  }
  return [...new Set(result)].slice(0, 12);
}

function explanationSignals(explanation: ArticleExplanation | undefined) {
  const text = explanation?.paragraphs.join(" ") ?? "";
  return EXPLANATION_SIGNALS.filter((signal) => signal.pattern.test(text)).map((signal) => signal.label);
}

export default function Home() {
  const [mode, setMode] = useState<Mode>("express");
  const [specialty, setSpecialty] = useState<SpecialtyId>("therapist");
  const [examineeType, setExamineeType] = useState(EXAMINEE_TYPES[0]);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("article-1");
  const [selectedRuleIndex, setSelectedRuleIndex] = useState("");
  const [checked, setChecked] = useState<string[]>([]);
  const [basket, setBasket] = useState<BasketItem[]>([]);
  const [directory, setDirectory] = useState<DoctorDirectory>(EMPTY_DIRECTORY);
  const [draftOpen, setDraftOpen] = useState(false);
  const [copied, setCopied] = useState<"reference" | "draft" | "">("");
  const [online, setOnline] = useState(true);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const setConnected = () => setOnline(true);
    const setDisconnected = () => setOnline(false);
    window.addEventListener("online", setConnected);
    window.addEventListener("offline", setDisconnected);
    const hydrationTimer = window.setTimeout(() => {
      setOnline(navigator.onLine);
      try {
        const saved = JSON.parse(localStorage.getItem(SESSION_KEY) ?? "null");
        if (saved?.basket) setBasket(saved.basket);
        if (saved?.examineeType) setExamineeType(saved.examineeType);
        if (saved?.mode) setMode(saved.mode);
        if (saved?.directory) setDirectory({ ...EMPTY_DIRECTORY, ...saved.directory });
      } catch {
        // Invalid local preview state is ignored.
      }
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
    localStorage.setItem(SESSION_KEY, JSON.stringify({ basket, examineeType, mode, directory }));
  }, [basket, directory, examineeType, hydrated, mode]);

  const specialtyArticles = useMemo(
    () => ARTICLES.filter((article) => article.specialties.includes(specialty)),
    [specialty],
  );

  const searchResults = useMemo(() => {
    if (!normalize(query)) return ARTICLES.slice(0, 12);
    return ARTICLES
      .filter((article) => matchesArticle(article, query, directory))
      .sort((a, b) => searchScore(b, query, directory) - searchScore(a, query, directory));
  }, [directory, query]);

  const listArticles = query ? searchResults : specialtyArticles;
  const selected = query
    ? searchResults.find((article) => article.id === selectedId) ?? searchResults[0]
    : specialtyArticles.find((article) => article.id === selectedId) ?? specialtyArticles[0];
  const selectedSpecialty = SPECIALTIES.find((item) => item.id === specialty)!;
  const articleRules = selected ? ARTICLE_RULES[selected.article] ?? [] : [];
  const selectedRule = selectedRuleIndex === "" ? undefined : articleRules[Number(selectedRuleIndex)];
  const selectedExplanation = selected ? ARTICLE_EXPLANATIONS[selected.article] : undefined;
  const selectedPointExplanation = selectedRule ? pointExplanation(selectedExplanation, selectedRule.point) : [];
  const selectedExplanationSignals = explanationSignals(selectedExplanation);
  const explanationUrl = selectedExplanation?.anchor
    ? `https://zakon.rada.gov.ua/laws/show/z1109-08/ed20250822#${selectedExplanation.anchor}`
    : EXPLANATION_SOURCE_URL;
  const sourceUrl = selected
    ? officialArticleUrl(
        selected.article,
        selectedRule ? `${selectedRule.point === "—" ? "" : `${selectedRule.point}) `}${selectedRule.condition}` : `Стаття ${selected.article}`,
      )
    : SOURCE_URL;
  const tdvKey = selected && selectedRule
    ? selectedRule.point === "—" ? selected.article : `${selected.article}-${selectedRule.point}`
    : "";
  const tdvRule = tdvKey ? TDV_RULES[tdvKey] ?? (selected ? TDV_RULES[selected.article] : undefined) : undefined;
  const tdvMarks = tdvRule ? TDV_COLUMNS.filter((column) => tdvRule[column.id]) : [];
  const summaryItem = [...basket].sort((a, b) => severity(b.outcome) - severity(a.outcome))[0];
  const summaryStyle = summaryItem ? outcomeStyle(summaryItem.outcome) : undefined;
  const selectedInBasket = selected && selectedRule
    ? basket.some((item) => item.id === `${selected.article}-${selectedRule.point}`)
    : false;

  const draftText = useMemo(() => {
    const lines = basket.map((item, index) =>
      `${index + 1}. Стаття ${item.article}${item.point === "—" ? "" : `, пункт «${item.point}»`} — ${item.title} (${item.icd}).${item.officialIncluded ? `\nДослівний рядок Розкладу хвороб: ${item.officialIncluded}` : ""}\nСтан: ${item.condition}.\nНормативний орієнтир: ${item.outcome}.`,
    );
    return [
      "ЧЕРНЕТКА НАВІГАЦІЙНОГО ЗВЕДЕННЯ ВЛК",
      `Категорія оглядуваного: ${examineeType}`,
      `Наказ МОУ №402, редакція від ${EDITION}`,
      "",
      ...lines,
      "",
      summaryItem ? `Попередній найсуворіший орієнтир: стаття ${summaryItem.article}${summaryItem.point === "—" ? "" : `, пункт «${summaryItem.point}»`} — ${summaryItem.outcome}.` : "Пункти до зведення не додані.",
      "",
      "Чернетка не є постановою ВЛК, не встановлює діагноз і потребує перевірки лікарем за відповідною графою та ТДВ.",
      SOURCE_URL,
    ].join("\n");
  }, [basket, examineeType, summaryItem]);

  function resetArticleReview() {
    setChecked([]);
    setSelectedRuleIndex("");
    setCopied("");
  }

  function chooseArticle(article: VlkArticle) {
    setSelectedId(article.id);
    setSpecialty(article.specialties[0]);
    setQuery(article.title);
    resetArticleReview();
  }

  function changeQuery(value: string) {
    setQuery(value);
    const first = value.trim()
      ? ARTICLES.filter((article) => matchesArticle(article, value, directory)).sort((a, b) => searchScore(b, value, directory) - searchScore(a, value, directory))[0]
      : undefined;
    if (first) {
      setSelectedId(first.id);
      setSpecialty(first.specialties[0]);
    }
    resetArticleReview();
  }

  function changeSpecialty(next: SpecialtyId) {
    const first = ARTICLES.find((article) => article.specialties.includes(next));
    setSpecialty(next);
    setQuery("");
    if (first) setSelectedId(first.id);
    resetArticleReview();
  }

  function selectFromList(article: VlkArticle) {
    setSelectedId(article.id);
    if (query) setSpecialty(article.specialties[0]);
    resetArticleReview();
  }

  function selectRule(index: string) {
    setSelectedRuleIndex(index);
    setCopied("");
  }

  function toggleCheck(step: string, next: boolean) {
    setChecked((current) => next ? [...new Set([...current, step])] : current.filter((item) => item !== step));
  }

  function addToBasket() {
    if (!selected || !selectedRule) return;
    addArticleRuleToBasket(selected, selectedRule);
  }

  function addArticleRuleToBasket(article: VlkArticle, rule: { point: string; condition: string; outcome: string }) {
    const articleChanged = selected?.id !== article.id;
    setSelectedId(article.id);
    setSpecialty(article.specialties[0]);
    const ruleIndex = (ARTICLE_RULES[article.article] ?? []).findIndex((entry) => entry.point === rule.point && entry.condition === rule.condition);
    setSelectedRuleIndex(ruleIndex >= 0 ? String(ruleIndex) : "");
    if (articleChanged) setChecked([]);
    setCopied("");
    const item: BasketItem = {
      id: `${article.article}-${rule.point}`,
      articleId: article.id,
      article: article.article,
      title: article.title,
      icd: article.icd,
      officialIncluded: article.officialIncluded,
      point: rule.point,
      condition: rule.condition,
      outcome: rule.outcome,
      doctors: doctorLabels(article),
    };
    setBasket((current) => [...current.filter((entry) => entry.id !== item.id), item]);
  }

  function openBasketItem(item: BasketItem) {
    const article = ARTICLES.find((entry) => entry.id === item.articleId);
    if (!article) return;
    setQuery("");
    setSpecialty(article.specialties[0]);
    setSelectedId(article.id);
    const index = (ARTICLE_RULES[article.article] ?? []).findIndex((rule) => rule.point === item.point && rule.condition === item.condition);
    setSelectedRuleIndex(index >= 0 ? String(index) : "");
  }

  async function copyText(text: string, type: "reference" | "draft") {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(type);
      window.setTimeout(() => setCopied(""), 1600);
    } catch {
      setCopied("");
    }
  }

  function printDraft() {
    const safe = draftText.replace(/[&<>]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[character] ?? character);
    const target = window.open("", "_blank", "width=860,height=720");
    if (!target) return;
    target.document.write(`<html lang="uk"><head><title>Чернетка ВЛК 402</title><style>body{font-family:Arial,sans-serif;margin:42px;color:#142f30}pre{white-space:pre-wrap;font:14px/1.55 Arial,sans-serif}h1{font-size:20px}@media print{body{margin:20mm}}</style></head><body><h1>VLK Навігатор · Чернетка</h1><pre>${safe}</pre></body></html>`);
    target.document.close();
    target.focus();
    window.setTimeout(() => target.print(), 150);
  }

  const referenceText = selected && selectedRule
    ? `Стаття ${selected.article}${selectedRule.point === "—" ? "" : `, пункт «${selectedRule.point}»`}.\n${selected.officialIncluded}\nСтан: ${selectedRule.condition}.\nНормативний орієнтир: ${selectedRule.outcome}.\nНаказ МОУ №402, редакція ${EDITION}. ${sourceUrl}`
    : "";

  return (
    <main className="min-h-screen bg-[#eef2ef] text-[#102d2e] xl:h-screen xl:overflow-hidden">
      <SwRegister />

      <header className="relative z-30 border-b border-[#173f40]/12 bg-white">
        <div className="mx-auto flex max-w-[1720px] flex-wrap items-center gap-2 px-3 py-2 lg:flex-nowrap lg:px-5">
          <div className="flex shrink-0 items-center gap-2.5">
            <div className="grid size-9 place-items-center rounded-lg bg-[#123f40] text-xs font-black text-white">402</div>
            <div>
              <div className="flex items-center gap-2"><h1 className="font-bold leading-none">VLK Навігатор</h1><span className="rounded-full bg-[#e8f1ed] px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-[#27645f]">MVP</span></div>
              <p className="mt-1 text-[11px] text-[#657b7a]">Навігація по Наказу МОУ №402</p>
            </div>
          </div>

          <div className="order-3 w-full lg:order-none lg:mx-auto lg:max-w-2xl">
            <Combobox<VlkArticle>
              items={searchResults.slice(0, 12)}
              inputValue={query}
              itemToStringLabel={(article) => article?.title ?? ""}
              isItemEqualToValue={(article, value) => article.id === value.id}
              onInputValueChange={(value) => changeQuery(value)}
              onValueChange={(article) => { if (article) chooseArticle(article); }}
            >
              <ComboboxInput
                showTrigger={false}
                showClear
                placeholder="Діагноз, МКХ-10, стаття, ключове слово або лікар…"
                aria-label="Розумний глобальний пошук"
                className="h-10 w-full border-[#2b6e68]/25 bg-[#f7faf8] shadow-none"
              />
              <ComboboxContent className="z-[70]">
                <ComboboxEmpty>Нічого не знайдено. Спробуйте коротшу назву або код МКХ-10.</ComboboxEmpty>
                <ComboboxList>
                  {searchResults.slice(0, 12).map((article) => (
                    <ComboboxItem key={article.id} value={article} className="items-start py-2.5">
                      <span className="grid size-8 shrink-0 place-items-center rounded-md bg-[#e7efeb] text-xs font-black text-[#205f59]">{article.article}</span>
                      <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{article.title}</span><span className="mt-0.5 block text-xs text-[#647876]">{article.icd} · {doctorLabels(article)}</span></span>
                    </ComboboxItem>
                  ))}
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-1.5">
            <span className="hidden items-center gap-1.5 rounded-full bg-[#edf7f2] px-2.5 py-1 text-[11px] font-bold text-[#236757] sm:flex"><Check className="size-3.5" /> Актуально · {EDITION}</span>
            <span className={`hidden items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold md:flex ${online ? "bg-[#edf7f2] text-[#236757]" : "bg-[#fff4df] text-[#765612]"}`}>{online ? <Wifi className="size-3.5" /> : <WifiOff className="size-3.5" />}{online ? "Онлайн" : "Офлайн"}</span>
            <Dialog>
              <DialogTrigger asChild><Button variant="outline" size="sm" className="h-9 bg-white"><UsersRound /><span className="hidden sm:inline">Лікарі</span></Button></DialogTrigger>
              <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
                <DialogHeader><DialogTitle>Локальний довідник лікарів</DialogTitle><DialogDescription>Вкажіть прізвища членів вашої ВЛК через кому. Вони зберігаються лише у цьому браузері та стають доступними у глобальному пошуку.</DialogDescription></DialogHeader>
                <div className="grid gap-3 sm:grid-cols-2">
                  {SPECIALTIES.map((item) => <label key={item.id} className="text-sm font-semibold">{item.label}<Input value={directory[item.id]} onChange={(event) => setDirectory((current) => ({ ...current, [item.id]: event.target.value }))} placeholder="Напр. Іваненко, Петренко" className="mt-1 bg-[#f8faf8] font-normal" /></label>)}
                </div>
                <DialogFooter><Button type="button" variant="outline" onClick={() => setDirectory(EMPTY_DIRECTORY)}>Очистити довідник</Button></DialogFooter>
              </DialogContent>
            </Dialog>
            <Button asChild variant="outline" size="sm" className="h-9 bg-white"><a href={SOURCE_URL} target="_blank" rel="noreferrer"><History /><span className="hidden sm:inline">Останні зміни</span></a></Button>
          </div>
        </div>
      </header>

      <div className="border-b border-[#173f40]/10 bg-white">
        <div className="mx-auto flex max-w-[1720px] flex-wrap items-center justify-between gap-2 px-3 py-1.5 lg:px-5">
          <div className="flex items-center gap-1 rounded-lg bg-[#eef3f0] p-1" aria-label="Режим роботи">
            <button type="button" onClick={() => setMode("express")} className={`rounded-md px-3 py-1.5 text-xs font-bold transition ${mode === "express" ? "bg-[#123f40] text-white shadow-sm" : "text-[#5c7472]"}`}>Експрес</button>
            <button type="button" onClick={() => setMode("detailed")} className={`rounded-md px-3 py-1.5 text-xs font-bold transition ${mode === "detailed" ? "bg-[#123f40] text-white shadow-sm" : "text-[#5c7472]"}`}>Детальний</button>
          </div>
          <p className="hidden text-xs text-[#607775] md:block">{mode === "express" ? "Швидкий сценарій: спеціальність → стаття → пункт → копіювання" : "Повна звірка: МКХ-10 → пояснення → ТДВ → зведення"}</p>
          <button type="button" onClick={() => setDraftOpen(true)} className="flex items-center gap-2 rounded-lg border border-[#b88a2e]/20 bg-[#fff7df] px-3 py-1.5 text-xs font-bold text-[#6e531d]"><ListPlus className="size-4" />Кошик діагнозів · {basket.length}</button>
        </div>
      </div>

      <div className="mx-auto grid max-w-[1720px] gap-2 p-2 lg:p-3 xl:h-[calc(100vh-105px)] xl:grid-cols-[320px_minmax(430px,1fr)_310px] xl:overflow-hidden">
        <aside className="flex min-h-[520px] flex-col overflow-hidden rounded-xl border border-[#173f40]/12 bg-white xl:min-h-0">
          <div className="border-b border-[#173f40]/10 p-2.5">
            <div className="flex items-center justify-between"><div><p className="text-[10px] font-black uppercase tracking-[0.13em] text-[#34736d]">Навігація</p><h2 className="mt-0.5 text-sm font-bold">{query ? `${searchResults.length} результатів` : selectedSpecialty.label}</h2></div><UserRound className="size-4 text-[#4d706d]" /></div>
            <div className="mt-2"><Select value={examineeType} onValueChange={setExamineeType}><SelectTrigger className="h-9 w-full bg-[#f7faf8] text-xs"><SelectValue /></SelectTrigger><SelectContent>{EXAMINEE_TYPES.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent></Select></div>
            <div className="mt-2 grid grid-cols-2 gap-1">
              {SPECIALTIES.map((item) => {
                const active = specialty === item.id;
                const count = ARTICLES.filter((article) => article.specialties.includes(item.id)).length;
                return <button key={item.id} type="button" onClick={() => changeSpecialty(item.id)} className={`rounded-md border px-2 py-1.5 text-left text-[11px] transition ${active ? "border-[#123f40] bg-[#123f40] text-white" : "border-[#173f40]/10 bg-[#f7f9f7] hover:bg-[#edf4f0]"}`}><span className="block truncate font-bold">{item.short}</span><span className={`text-[10px] ${active ? "text-[#b8d7d3]" : "text-[#738583]"}`}>{articleCountLabel(count)}</span></button>;
              })}
            </div>
            <p className="mt-2 text-[10px] leading-4 text-[#607775]">Оберіть лікаря, потім відкрийте компактний список його статей.</p>
            {query ? <Button type="button" variant="ghost" size="sm" onClick={() => changeQuery("")} className="mt-2 h-7 w-full text-xs"><RotateCcw />Повернути профільний список</Button> : null}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-2.5 scrollbar-thin">
            {listArticles.length && selected ? <>
              <label className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.12em] text-[#34736d]">{query ? "Знайдені статті" : `Статті · ${selectedSpecialty.label}`}</label>
              <Select
                value={selected.id}
                onValueChange={(value) => {
                  const article = listArticles.find((item) => item.id === value);
                  if (article) selectFromList(article);
                }}
              >
                <SelectTrigger className="h-auto min-h-11 w-full bg-[#f7faf8] px-2.5 py-2 text-left">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-[65vh]">
                  {listArticles.map((article) => <SelectItem key={article.id} value={article.id}><span className="font-black">{article.article}</span> · {article.title} · {article.icd}</SelectItem>)}
                </SelectContent>
              </Select>

              <p className="mt-1.5 text-[10px] text-[#607775]">У списку: {articleCountLabel(listArticles.length)}. На екрані показується лише вибрана.</p>

              <Accordion type="single" value={selected.id} className="mt-2">
                <AccordionItem value={selected.id} className="overflow-hidden rounded-lg border border-[#2d7872]/35 bg-[#e9f2ee]">
                  <AccordionTrigger className="gap-2 px-2.5 py-2.5 hover:no-underline">
                    <span className="grid size-9 shrink-0 place-items-center rounded-md bg-[#123f40] text-xs font-black text-white">{selected.article}</span>
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 block text-xs font-semibold leading-4">{selected.title}</span>
                      <span className="mt-0.5 block text-[10px] font-normal text-[#687d7b]">{selected.icd} · {doctorLabels(selected)}</span>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="px-2 pb-2">
                    <div className="border-t border-[#2d7872]/12 pt-2">
                      <p className="text-[9px] font-black uppercase tracking-[0.1em] text-[#34736d]">Включено · дослівно з №402</p>
                      <p className="mt-1 text-[10px] leading-4 text-[#425f5d]">{selected.officialIncluded}</p>
                    </div>
                    <div className="mt-2 space-y-1">
                      {articleRules.map((rule, index) => {
                        const isSelected = selectedRuleIndex === String(index);
                        const inBasket = basket.some((item) => item.id === `${selected.article}-${rule.point}`);
                        const style = outcomeStyle(rule.outcome);
                        return (
                          <div key={`${selected.article}-${rule.point}-${index}`} className={`grid grid-cols-[minmax(0,1fr)_28px] overflow-hidden rounded-md border ${isSelected ? "border-[#c58b28]/45 bg-[#fff8e7]" : "border-[#173f40]/10 bg-white"}`}>
                            <button type="button" onClick={() => selectRule(String(index))} className="min-w-0 p-2 text-left">
                              <span className="flex items-center justify-between gap-2">
                                <span className="text-[10px] font-black uppercase tracking-[0.1em] text-[#34736d]">{pointLabel(rule.point)}</span>
                                <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[8px] font-black ${style.badge}`}>{style.short}</span>
                              </span>
                              <span className="mt-1 line-clamp-2 block text-[10px] leading-4 text-[#294b4b]">{rule.condition}</span>
                            </button>
                            <button type="button" aria-label={`${inBasket ? "Оновити" : "Додати"} статтю ${selected.article}, ${pointLabel(rule.point)} у зведенні`} title={inBasket ? "У зведенні" : "Додати до зведення"} onClick={() => addArticleRuleToBasket(selected, rule)} className={`grid place-items-center border-l border-[#173f40]/10 ${inBasket ? "bg-[#dcece5] text-[#205f51]" : "text-[#2d6f69] hover:bg-[#edf5f1]"}`}>
                              {inBasket ? <Check className="size-3.5" /> : <Plus className="size-3.5" />}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                    <a href={sourceUrl} target="_blank" rel="noreferrer" className="mt-2 flex items-center justify-center gap-1 rounded-md border border-[#b88a2e]/20 bg-[#fff7df] px-2 py-1.5 text-[10px] font-bold text-[#6e531d]">{selectedRule ? "Підсвітити вибраний стан у №402" : `Стаття ${selected.article} у №402`} <ExternalLink className="size-3" /></a>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </> : <div className="p-5 text-center text-sm text-[#667d7b]">Нічого не знайдено.</div>}
          </div>
        </aside>

        <section className="flex min-h-[620px] flex-col overflow-hidden rounded-xl border border-[#173f40]/12 bg-white xl:min-h-0">
          {selected ? <>
            <div className="shrink-0 border-b border-[#173f40]/10 px-3 py-2.5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 items-start gap-2.5"><span className="grid size-10 shrink-0 place-items-center rounded-lg bg-[#123f40] text-sm font-black text-white">{selected.article}</span><div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#34736d]">Стаття {selected.article} · {selected.icd} · {doctorLabels(selected)}</p><h2 className="mt-1 text-lg font-bold leading-tight sm:text-xl">{selected.title}</h2></div></div>
                <Button asChild variant="outline" size="sm" className="h-8 shrink-0 bg-[#fff7df] text-[#6e531d]"><a href={sourceUrl} target="_blank" rel="noreferrer">Відкрити у №402 <ExternalLink /></a></Button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-2.5 scrollbar-thin">
              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_210px]">
                <div className="rounded-lg border border-[#173f40]/10 bg-[#f7faf8] p-3">
                  <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#50716e]">МКХ-10 за Розкладом хвороб</p><p className="mt-0.5 break-words text-sm font-black leading-5 text-[#123f40]">{selected.icd}</p></div><span className="shrink-0 rounded-full bg-[#e1ece7] px-2 py-1 text-[9px] font-black text-[#28665f]">без узагальнень</span></div>
                  <div className="mt-2 rounded-md border border-[#2d7771]/14 bg-white p-2.5">
                    <p className="text-[9px] font-black uppercase tracking-[0.11em] text-[#34736d]">Включено · дослівно з №402</p>
                    <p className="mt-1 text-[11px] leading-[1.15rem] text-[#425f5d]">{selected.officialIncluded}</p>
                  </div>
                  <div className="mt-2 border-t border-[#173f40]/8 pt-2"><p className="text-[9px] font-black uppercase tracking-[0.11em] text-[#6a7e7c]">Коротко для навігації</p><p className="mt-1 text-xs leading-5 text-[#5d7472]">{selected.summary}</p></div>
                </div>
                <div className={`rounded-lg border p-3 ${selectedRule && tdvRule ? "border-[#ba4a4a]/18 bg-[#fff3f1]" : "border-[#173f40]/10 bg-white"}`}>
                  <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#50716e]">ТДВ · Додаток 3</p>
                  {!selectedRule ? <><p className="mt-1 text-sm font-bold">Оберіть пункт</p><p className="mt-1 text-[10px] leading-4 text-[#617775]">Позначки з’являться автоматично.</p></> : tdvRule ? <><p className="mt-1 text-sm font-black text-[#8a3030]">{tdvMarks.length} спец. позначок</p><div className="mt-1.5 flex flex-wrap gap-1">{tdvMarks.map((column) => <span key={column.id} className="rounded bg-white px-1.5 py-0.5 text-[9px] font-black text-[#8a3030]">{column.id}: {tdvRule[column.id]}</span>)}</div></> : <><p className="mt-1 text-sm font-bold text-[#5c7773]">Окремих позначок немає</p><p className="mt-1 text-[10px] leading-4 text-[#617775]">Це не є автоматичним підтвердженням придатності.</p></>}
                </div>
              </div>

              {mode === "detailed" ? <p className="mt-2 rounded-lg bg-[#f2f6f3] px-3 py-2 text-xs leading-5 text-[#5d7472]">Оберіть формулювання, яке відповідає підтвердженому стану та ступеню порушення функцій.</p> : null}

              <div className="mt-2 flex items-center justify-between"><p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#50716e]">Критерії статті</p><span className="text-[10px] text-[#617775]">{articleRules.length} {articleRules.length === 1 ? "пункт" : "пункти"}</span></div>
              <RadioGroup value={selectedRuleIndex} onValueChange={selectRule} className="mt-1.5 gap-1.5">
                {articleRules.map((rule, index) => {
                  const active = selectedRuleIndex === String(index);
                  const style = outcomeStyle(rule.outcome);
                  return <label key={`${rule.point}-${index}`} className={`grid cursor-pointer grid-cols-[28px_minmax(0,1fr)] gap-2 rounded-lg border p-2.5 transition sm:grid-cols-[28px_minmax(0,1fr)_auto] ${active ? "border-[#c58b28]/45 bg-[#fff8e7]" : "border-[#173f40]/10 bg-[#fafbf9] hover:border-[#2c756f]/25"}`}><RadioGroupItem value={String(index)} className="mt-1" aria-label={`${pointLabel(rule.point)}: ${rule.condition}`} /><span className="min-w-0"><span className="block text-[10px] font-black uppercase tracking-[0.12em] text-[#36716c]">{pointLabel(rule.point)}</span><span className="mt-0.5 block text-xs leading-5 text-[#294b4b] sm:text-sm">{rule.condition}</span></span><span className={`col-start-2 self-start rounded-full px-2 py-1 text-[10px] font-black sm:col-start-3 ${style.badge}`}>{style.short}</span></label>;
                })}
              </RadioGroup>

              <section className="mt-2.5 overflow-hidden rounded-lg border border-[#2d7771]/18 bg-[#f6faf8]">
                <div className="flex flex-col gap-2 border-b border-[#173f40]/10 bg-[#eaf3ef] px-3 py-2.5 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-start gap-2">
                    <BookOpen className="mt-0.5 size-4 shrink-0 text-[#286c65]" />
                    <div>
                      <div className="flex flex-wrap items-center gap-1.5"><h3 className="text-sm font-bold">Офіційні пояснення до статті {selected.article}</h3><span className="rounded-full bg-white px-2 py-0.5 text-[9px] font-black text-[#28665f]">дослівно · {EXPLANATION_EDITION}</span></div>
                      <p className="mt-1 text-[10px] leading-4 text-[#5c7472]">Додаток 2 до Наказу №402. Текст не скорочено й не переказано.</p>
                    </div>
                  </div>
                  <Button asChild variant="outline" size="sm" className="h-7 shrink-0 bg-white text-[10px]"><a href={explanationUrl} target="_blank" rel="noreferrer">Джерело <ExternalLink /></a></Button>
                </div>

                {selectedExplanation?.status === "absent" ? (
                  <div className="p-3 text-xs leading-5 text-[#627775]">Для статті 87 окремого пояснення в Додатку 2 чинної редакції немає. Використовуйте дослівний рядок Розкладу хвороб, обраний пункт і ТДВ.</div>
                ) : (
                  <div className="p-3">
                    {selectedExplanationSignals.length ? <div><p className="text-[9px] font-black uppercase tracking-[0.11em] text-[#587471]">У поясненні згадано</p><div className="mt-1.5 flex flex-wrap gap-1">{selectedExplanationSignals.map((signal) => <span key={signal} className="rounded-full border border-[#2d7771]/12 bg-white px-2 py-1 text-[9px] font-bold text-[#426965]">{signal}</span>)}</div></div> : null}

                    <div className="mt-2 rounded-md border border-[#b88a2e]/18 bg-[#fff9e9] p-2.5">
                      <p className="text-[9px] font-black uppercase tracking-[0.11em] text-[#755b22]">{selectedRule ? `Автоматично до ${pointLabel(selectedRule.point)}` : "Спочатку оберіть пункт статті"}</p>
                      {selectedRule ? selectedPointExplanation.length ? <div className="mt-1.5 max-h-52 space-y-1.5 overflow-y-auto pr-1 scrollbar-gutter-stable scrollbar-thin">{selectedPointExplanation.map((paragraph, index) => <p key={`${selected.article}-${selectedRule.point}-${index}`} className="text-[11px] leading-[1.2rem] text-[#4d4937]">{paragraph}</p>)}</div> : <p className="mt-1.5 text-[11px] leading-4 text-[#685e44]">У поясненні немає окремого підрозділу для цього пункту. Перегляньте повний офіційний текст нижче — він застосовується до статті загалом.</p> : <p className="mt-1.5 text-[11px] leading-4 text-[#685e44]">Після вибору пункту система покаже пов’язані з ним офіційні критерії та параметри.</p>}
                    </div>

                    <Accordion type="single" collapsible className="mt-2">
                      <AccordionItem value="full-explanation" className="overflow-hidden rounded-md border border-[#173f40]/10 bg-white px-2.5">
                        <AccordionTrigger className="py-2 text-xs font-bold hover:no-underline">Повне офіційне пояснення · {selectedExplanation?.paragraphs.length ?? 0} фрагментів</AccordionTrigger>
                        <AccordionContent>
                          <div className="max-h-72 space-y-2 overflow-y-auto border-t border-[#173f40]/8 py-2 pr-1 scrollbar-gutter-stable scrollbar-thin">{selectedExplanation?.paragraphs.map((paragraph, index) => <p key={`${selected.article}-explanation-${index}`} className="text-[11px] leading-5 text-[#405c5a]">{paragraph}</p>)}</div>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>

                    <div className="mt-2 flex items-start gap-2 rounded-md bg-[#edf4f1] p-2"><ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-[#2e6e67]" /><p className="text-[9px] leading-4 text-[#56706d]">Пояснення допомагає звірити критерії, але не встановлює діагноз і не замінює оцінку лікаря, постанову ВЛК, графу Розкладу хвороб та ТДВ.</p></div>
                  </div>
                )}
              </section>

              {mode === "detailed" ? <div className="mt-3"><div className="flex items-center justify-between"><p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#5b7472]">Достатність даних</p><span className="text-[10px] font-bold text-[#617775]">{checked.length}/{ANALYSIS_CHECKS.length}</span></div><div className="mt-1.5 grid gap-1.5 sm:grid-cols-2">{ANALYSIS_CHECKS.map((step) => <label key={step} className="flex cursor-pointer items-start gap-2 rounded-lg border border-[#173f40]/10 bg-white p-2"><Checkbox checked={checked.includes(step)} onCheckedChange={(value) => toggleCheck(step, value === true)} className="mt-0.5" /><span className="text-xs leading-4">{step}</span></label>)}</div></div> : null}

              {selectedRule ? <div className={`mt-2.5 flex flex-col gap-2 rounded-lg border p-2.5 sm:flex-row sm:items-center sm:justify-between ${outcomeStyle(selectedRule.outcome).box}`}><div><p className="text-[10px] font-black uppercase tracking-[0.11em] text-[#5e7472]">Попередній нормативний орієнтир</p><p className="mt-1 text-sm font-bold leading-5">{selectedRule.outcome}</p></div><Button type="button" size="sm" onClick={addToBasket} disabled={selectedInBasket} className="shrink-0 bg-[#123f40] text-white hover:bg-[#1a5554]">{selectedInBasket ? <><Check />У кошику</> : <><Plus />Додати до зведення</>}</Button></div> : null}

              <section className="mt-3 rounded-lg border border-[#173f40]/10 bg-[#f7faf8] p-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><h3 className="text-sm font-bold">ТДВ показується автоматично</h3><p className="mt-1 text-[10px] leading-4 text-[#5d7472]">Порожня клітинка не є автоматичним підтвердженням придатності.</p></div><div className="flex shrink-0 gap-1"><Button asChild variant="outline" size="sm" className="h-7 text-[10px]"><a href={TDV_URL} target="_blank" rel="noreferrer">ТДВ у №402 <ExternalLink /></a></Button><Button asChild variant="ghost" size="sm" className="h-7 text-[10px]"><a href={TDV_DOCX_URL} target="_blank" rel="noreferrer">DOCX <BookOpen /></a></Button></div></div>
                {!selectedRule ? <div className="mt-2 rounded-md border border-dashed border-[#2d7771]/30 bg-white p-3 text-center text-xs text-[#617775]">Оберіть пункт статті — відповідний рядок ТДВ з’явиться тут без переходу на іншу вкладку.</div> : tdvRule ? <div className="mt-2 grid gap-1.5 sm:grid-cols-2">{TDV_COLUMNS.map((column) => { const mark = tdvRule[column.id]; return <div key={column.id} className={`flex items-start gap-2 rounded-md border p-2 ${mark ? "border-[#ba4a4a]/18 bg-[#fff3f1]" : "border-[#173f40]/10 bg-white"}`}><span className="grid size-6 shrink-0 place-items-center rounded-md bg-[#e7eeea] text-[10px] font-black">{column.id}</span><div><p className="text-[10px] font-semibold leading-4">{column.label}</p><p className={`mt-1 text-[10px] font-black ${mark ? "text-[#8a3030]" : "text-[#5c7773]"}`}>{mark ?? "Окремої позначки НП немає"}</p></div></div>; })}</div> : <div className="mt-2 rounded-md bg-[#fff8e6] p-3 text-xs leading-5 text-[#6d572d]">Для цього пункту немає окремого рядка ТДВ. Звірте повну офіційну таблицю.</div>}
              </section>

              <div className="mt-3 flex flex-col gap-2 rounded-lg border border-[#173f40]/10 bg-white p-3 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="text-sm font-bold">Офіційний текст статті {selected.article}</h3><p className="mt-1 text-[10px] leading-4 text-[#5c7472]">Посилання відкриває конкретну статтю; для вибраного пункту додається пошук формулювання.</p></div><Button asChild size="sm" className="shrink-0 bg-[#123f40] text-white"><a href={sourceUrl} target="_blank" rel="noreferrer">Відкрити й підсвітити <ExternalLink /></a></Button></div>
            </div>
          </> : <div className="grid flex-1 place-items-center p-8 text-center"><div><h2 className="font-bold">Нічого не знайдено</h2><p className="mt-1 text-sm text-[#647876]">Скоротіть запит або введіть код МКХ-10.</p></div></div>}
        </section>

        <aside className="flex min-h-[520px] flex-col overflow-hidden rounded-xl border border-[#173f40]/12 bg-[#f7f9f7] xl:min-h-0">
          <div className="flex items-center justify-between border-b border-[#173f40]/10 bg-white px-3 py-2.5"><div><p className="text-[10px] font-black uppercase tracking-[0.13em] text-[#34736d]">Резюме стану</p><h2 className="mt-0.5 text-sm font-bold">Попереднє зведення</h2></div><span className="rounded-full bg-[#e7efeb] px-2 py-1 text-[10px] font-bold text-[#326762]">локально</span></div>

          <div className="min-h-0 flex-1 overflow-y-auto p-2.5 scrollbar-thin">
            {summaryItem && summaryStyle ? <div className={`rounded-lg border p-3 ${summaryStyle.box}`} aria-live="polite"><div className="flex items-center justify-between gap-2"><span className={`rounded-full px-2 py-1 text-[10px] font-black ${summaryStyle.badge}`}>{summaryStyle.short}</span><span className="text-[10px] font-bold text-[#5e7472]">найсуворіший орієнтир</span></div><h3 className="mt-2 font-black">Стаття {summaryItem.article}{summaryItem.point === "—" ? "" : `, пункт «${summaryItem.point}»`}</h3><p className="mt-1.5 text-xs font-semibold leading-5">{summaryItem.outcome}</p><p className="mt-2 text-[10px] leading-4 text-[#617775]">Категорія: {examineeType}. Остаточна звірка — лікарем за графою і ТДВ.</p></div> : <div className="rounded-lg border border-dashed border-[#2d7771]/30 bg-white p-4 text-center"><ClipboardCheck className="mx-auto size-5 text-[#37766f]" /><h3 className="mt-2 text-sm font-bold">Кошик порожній</h3><p className="mt-1 text-xs leading-5 text-[#617775]">Оберіть пункт статті та додайте його до зведення.</p></div>}

            <div className="mt-3 flex items-center justify-between"><p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#5b7472]">Кошик діагнозів · {basket.length}</p>{basket.length ? <button type="button" onClick={() => setBasket([])} className="text-[10px] font-bold text-[#8a3b37]">Очистити</button> : null}</div>
            <div className="mt-1.5 space-y-1.5">{basket.map((item) => { const style = outcomeStyle(item.outcome); return <div key={item.id} className="rounded-lg border border-[#173f40]/10 bg-white p-2"><div className="flex items-start justify-between gap-2"><button type="button" onClick={() => openBasketItem(item)} className="min-w-0 text-left"><span className="block text-xs font-bold">Стаття {item.article}{item.point === "—" ? "" : `-${item.point}`} · {item.title}</span><span className="mt-0.5 block text-[10px] text-[#697d7b]">{item.icd} · {item.doctors}</span></button><button type="button" aria-label={`Видалити статтю ${item.article}`} onClick={() => setBasket((current) => current.filter((entry) => entry.id !== item.id))} className="grid size-6 shrink-0 place-items-center rounded-md text-[#7b4a45] hover:bg-[#fff1ef]"><X className="size-3.5" /></button></div><span className={`mt-1.5 inline-block rounded-full px-2 py-0.5 text-[9px] font-black ${style.badge}`}>{style.short}</span></div>; })}</div>

            <div className="mt-3 rounded-lg border border-[#b98b31]/20 bg-[#fff8e6] p-2.5"><div className="flex items-start gap-2"><AlertTriangle className="mt-0.5 size-4 shrink-0 text-[#956d1f]" /><p className="text-[10px] leading-4 text-[#6f592d]">Алгоритм показує найсуворіший попередній орієнтир, але не враховує медичну взаємодію кількох станів і не замінює постанову ВЛК.</p></div></div>
          </div>

          <div className="shrink-0 space-y-1.5 border-t border-[#173f40]/10 bg-white p-2.5">
            {selectedRule ? <Button type="button" size="sm" onClick={() => copyText(referenceText, "reference")} variant="outline" className="h-8 w-full bg-white text-xs">{copied === "reference" ? <><Check />Скопійовано</> : <><Copy />Копіювати формулювання</>}</Button> : null}
            <Button type="button" size="sm" onClick={() => setDraftOpen(true)} disabled={!basket.length} className="h-8 w-full bg-[#123f40] text-xs text-white hover:bg-[#1a5554]"><FileText />Сформувати чернетку</Button>
            <div className="flex items-center justify-center gap-1.5 pt-1 text-[9px] text-[#718482]"><ShieldCheck className="size-3" />Дані зберігаються тільки в цьому браузері</div>
          </div>
        </aside>
      </div>

      <Dialog open={draftOpen} onOpenChange={setDraftOpen}>
        <DialogContent className="max-h-[90vh] overflow-hidden p-0 sm:max-w-3xl">
          <DialogHeader className="border-b border-[#173f40]/10 p-4 pr-12"><DialogTitle>Чернетка навігаційного зведення</DialogTitle><DialogDescription>Для перевірки лікарем. Не є постановою ВЛК.</DialogDescription></DialogHeader>
          <pre className="max-h-[58vh] overflow-y-auto whitespace-pre-wrap bg-[#f8faf8] p-4 font-sans text-xs leading-5 text-[#294b4b] scrollbar-thin">{draftText}</pre>
          <DialogFooter className="border-t border-[#173f40]/10 p-3"><Button variant="outline" onClick={() => copyText(draftText, "draft")}>{copied === "draft" ? <><Check />Скопійовано</> : <><Copy />Копіювати</>}</Button><Button variant="outline" onClick={printDraft}><Printer />Друк / зберегти PDF</Button><Button onClick={() => setDraftOpen(false)} className="bg-[#123f40] text-white">Готово</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

"use client";

import { useEffect, useId, useRef, useState } from 'react';
import { BookMarked, Pin, PinOff, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogClose, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { VlkDialogContent } from '@/components/vlk/dialog-content';
import { ARTICLES, SPECIALTIES, type SpecialtyId, type VlkArticle } from '@/lib/vlk-sample-data';
import { frequentArticles, specialtyQuickArticles, type ArticleUsage } from '@/lib/vlk-article-usage';
import { readStored, writeStored } from '@/lib/vlk-local-storage';

// One impression per document visit, including Strict Mode and home remounts.
// This onboarding preference is independent of the doctor's local session.
let pinHintVisibleThisVisit: boolean | undefined;

function HomePinHint() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (pinHintVisibleThisVisit === undefined) {
        const raw = readStored('vlk_pin_hint_seen');
        const parsed = raw !== null && /^\d+$/.test(raw) ? Number(raw) : 0;
        const seen = Number.isSafeInteger(parsed) ? parsed : 0;
        pinHintVisibleThisVisit = seen < 3;
        if (pinHintVisibleThisVisit) writeStored('vlk_pin_hint_seen', String(seen + 1));
      }
      setVisible(pinHintVisibleThisVisit);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  return visible ? <p className="home-quick-hint"><Pin aria-hidden="true" />Відкривайте статті або закріплюйте їх шпилькою — вони з’являться тут.</p> : null;
}

type Props = {
  usage: ArticleUsage; pinned: readonly string[]; specialty: SpecialtyId | '';
  onOpen: (article: VlkArticle, specialty?: SpecialtyId) => void;
  onPin: (number: string) => void; onClear: () => void; heading?: boolean; initialTab?: 'mine' | 'specialty';
};
export function PinArticleButton({ article, pinned, onToggle, showLabel = false }: { article: string; pinned: boolean; onToggle: () => void; showLabel?: boolean }) {
  const Icon = pinned ? PinOff : Pin;
  return <Button type="button" variant="ghost" size={showLabel ? "sm" : "icon"} className="quick-pin min-h-11 min-w-11 shrink-0"
    aria-label={`${pinned ? 'Відкріпити' : 'Закріпити'} статтю ${article}`} aria-pressed={pinned}
    title={pinned ? 'Відкріпити статтю' : 'Закріпити для швидкого доступу'} onClick={onToggle}><Icon aria-hidden="true" />{showLabel ? (pinned ? "Відкріпити" : "Закріпити") : null}</Button>;
}
export function QuickAccessPanel({ usage, pinned, specialty, onOpen, onPin, onClear, heading = true, initialTab = 'mine' }: Props) {
  const [tab, setTab] = useState<string>(initialTab);
  const [chosenSpecialty, setChosenSpecialty] = useState<SpecialtyId | ''>(specialty);
  const selectId = useId();
  const numbers = tab === 'mine' ? frequentArticles(usage, pinned)
    : chosenSpecialty ? specialtyQuickArticles(chosenSpecialty) : [];
  const articles = numbers.flatMap(number => ARTICLES.filter(a => a.article === number));
  const hasStats = Object.keys(usage).length > 0;
  return <section className="quick-access" aria-label="Швидкий доступ до статей">
    {heading ? <h3 className="flex items-center gap-2 text-base font-semibold"><BookMarked className="size-4" aria-hidden="true" />Швидкий доступ</h3> : null}
    <p className="quick-description">Закріплення й часті статті — лише в цьому браузері.</p>
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList className="quick-tabs"><TabsTrigger value="mine">Мої часті</TabsTrigger><TabsTrigger value="specialty">Добірки статей</TabsTrigger></TabsList>
      <TabsContent value={tab} className="mt-3">
        {tab === 'specialty' ? <div className="quick-specialty">
          <label htmlFor={selectId}>Спеціальність добірки</label>
          <select id={selectId} value={chosenSpecialty} onChange={event => setChosenSpecialty(event.target.value as SpecialtyId | '')}>
            <option value="">Оберіть спеціальність</option>
            {SPECIALTIES.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
          <p className="quick-description">Короткий список статей для швидкого переходу. Усі статті — у розділі лікаря.</p>
        </div> : null}
        {articles.length ? <ul className="quick-articles">
          {articles.map(article => <li key={article.id}>
            <button type="button" className="quick-open" onClick={() => onOpen(article, tab === 'specialty' && chosenSpecialty ? chosenSpecialty : undefined)}>
              <span className="quick-number">{article.article}</span>
              <span className="min-w-0"><span className="quick-title">{article.title}</span>
                <span className="quick-meta">{pinned.includes(article.article) ? 'Закріплено' : 'Стаття №402'}{tab === 'mine' ? ` · відкриттів: ${usage[article.article]?.opens ?? 0}` : ''}</span>
              </span>
            </button>
            <PinArticleButton article={article.article} pinned={pinned.includes(article.article)} onToggle={() => onPin(article.article)} />
          </li>)}
        </ul> : <div className="quick-empty">
          <p>{tab === 'mine' ? 'Відкрийте статтю або закріпіть її кнопкою зі шпилькою — вона з’явиться тут.' : 'Оберіть спеціальність, щоб побачити її статті.'}</p>
          {tab === 'mine' ? <Button type="button" variant="outline" className="min-h-11 mt-2" onClick={() => setTab('specialty')}>Переглянути добірки статей</Button> : null}
        </div>}
        {tab === 'mine' ? <div className="quick-footer"><span>До 10 статей · закріплені першими</span>
          <details className="quick-settings"><summary>Налаштування швидкого доступу</summary><Button type="button" variant="ghost" className="min-h-11 text-xs" disabled={!hasStats} onClick={onClear}>Очистити статистику</Button></details>
        </div> : null}
      </TabsContent>
    </Tabs>
  </section>;
}
export function QuickAccessDialog({ trigger, ...props }: Props & { trigger?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const navigated = useRef(false);
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild>{trigger ?? <Button type="button" variant="ghost" size="icon" className="min-h-11 min-w-11" aria-label="Відкрити швидкий доступ" title="Швидкий доступ"><BookMarked /></Button>}</DialogTrigger>
    <VlkDialogContent className="quick-dialog flex flex-col gap-0 overflow-hidden p-0" variant="reader" showCloseButton={false}
      onCloseAutoFocus={event => { if (navigated.current) { event.preventDefault(); navigated.current = false;
        requestAnimationFrame(() => document.getElementById('vlk-article-heading')?.focus({ preventScroll: true })); } }}>
      <DialogHeader className="flex-row items-start justify-between gap-3 border-b border-border p-4 text-left">
        <div><DialogTitle>Швидкий доступ</DialogTitle><DialogDescription>Ваші часті й закріплені статті та добірки за спеціальністю.</DialogDescription></div>
        <DialogClose asChild><Button variant="outline" size="icon" className="min-h-11 min-w-11 shrink-0" aria-label="Закрити швидкий доступ"><X /></Button></DialogClose>
      </DialogHeader>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
        <QuickAccessPanel {...props} heading={false} onOpen={(article, specialty) => { navigated.current = true; props.onOpen(article, specialty); setOpen(false); }} />
      </div>
    </VlkDialogContent>
  </Dialog>;
}

/** A bounded overview: full lists, tabs and settings remain in the existing dialog. */
export function HomeQuickAccess(props: Props & { ready: boolean }) {
  const numbers = frequentArticles(props.usage, props.pinned, 6);
  const articles = numbers.flatMap(number => ARTICLES.filter(article => article.article === number));
  if (!articles.length) return props.ready ? <HomePinHint /> : null;
  return <section className="home-quick-access has-articles" aria-label="Швидкий доступ">
    <div className="home-quick-heading">
      <div><h3><BookMarked aria-hidden="true" />Швидкий доступ</h3>
        <p className="quick-description">Закріплення й часті статті — лише в цьому браузері.</p></div>
      <QuickAccessDialog {...props} initialTab="mine" trigger={<Button type="button" variant="outline" className="min-h-11">Усі швидкі переходи</Button>} />
    </div>
    {articles.length ? <ul className="quick-articles home-quick-list">{articles.map(article => <li key={article.id}>
      <button type="button" className="quick-open" onClick={() => props.onOpen(article)}>
        <span className="quick-number">{article.article}</span><span className="min-w-0"><span className="quick-title">{article.title}</span><span className="quick-meta">{props.pinned.includes(article.article) ? 'Закріплено' : `Відкриттів: ${props.usage[article.article]?.opens ?? 0}`}</span></span>
      </button><PinArticleButton article={article.article} pinned={props.pinned.includes(article.article)} onToggle={() => props.onPin(article.article)} />
    </li>)}</ul> : null}
  </section>;
}

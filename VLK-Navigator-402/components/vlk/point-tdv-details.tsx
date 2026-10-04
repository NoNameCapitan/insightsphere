import { Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TdvDialog } from '@/components/vlk/tdv-dialog';
import { TdvContext } from '@/components/vlk/tdv-context';
import { TDV_COLUMNS } from '@/lib/vlk-tdv';
import { getPointTdv } from '@/lib/vlk-point-tdv';
import type { VlkArticle } from '@/lib/vlk-sample-data';
export function PointTdvDetails({ article, point, selectedColumn }: { article: VlkArticle; point: string; selectedColumn?: number }) {
  const entry = getPointTdv(article.article, point);
  if (!entry) return null;
  const columns = TDV_COLUMNS.filter(column => entry.marks[column.id]?.trim());
  return <details className="point-tdv-details">
    <summary>Є додаткові вимоги (ТДВ)<span>{columns.length} позначок</span></summary>
    <p className="quick-description">{entry.scope === 'article' ? 'ТДВ для статті загалом' : `ТДВ для пункту «${point}»`} · дослівні позначки Додатка 3.</p>
    <dl className="point-tdv-marks">{columns.map(column => <div key={column.id}>
      <dt><TdvContext columnId={column.id} mark={entry.marks[column.id]}>Графа {column.id}</TdvContext><span>{column.label}</span></dt>
      <dd>{entry.marks[column.id]}</dd>
    </div>)}</dl>
    <p className="quick-description">Порожня клітинка не підтверджує придатність. Графи ТДВ 1–12 відрізняються від граф Розкладу I–III.</p>
    <TdvDialog article={article} selectedPoint={point} selectedColumn={selectedColumn} trigger={<Button type="button" variant="outline" className="min-h-11 mt-2">До рядка ТДВ <Maximize2 aria-hidden="true" /></Button>} />
  </details>;
}

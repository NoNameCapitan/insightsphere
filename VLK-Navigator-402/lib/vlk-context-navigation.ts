import { scrollOffsetToReveal } from './vlk-reading-navigation.ts';
import { contextProblem, EDUCATION, type ReviewContext } from './vlk-review-context.ts';

export type ContextControlId = 'schedule-graph' | 'tdv-column';

/** A navigation hint only: never changes context, a rule, or its outcome. */
export function nextContextControl(context: ReviewContext, needsScheduleGraph: boolean): ContextControlId | undefined {
  if (contextProblem(context)) return context.examineeType === EDUCATION ? 'tdv-column' : 'schedule-graph';
  if (needsScheduleGraph) return 'schedule-graph';
  if (context.examineeType === EDUCATION && context.tdvColumn === undefined) return 'tdv-column';
  return undefined;
}

/** Open the visible settings disclosure and focus one field. Never scroll the document. */
export function revealContextControl(disclosure: HTMLDetailsElement | null, controlId: string) {
  if (!disclosure?.isConnected) return false;
  disclosure.open = true;
  const control = disclosure.querySelector<HTMLElement>(`[id="${controlId}"]`);
  if (!control) return false;
  // TDV lives in a nested disclosure; the focused field must not remain hidden.
  let ancestor = control.parentElement;
  while (ancestor && ancestor !== disclosure) {
    if (ancestor.tagName === 'DETAILS') (ancestor as HTMLDetailsElement).open = true;
    ancestor = ancestor.parentElement;
  }
  const container = disclosure.closest<HTMLElement>('.article-content, .sidebar-controls');
  if (container) {
    const outer = container.getBoundingClientRect();
    const field = control.getBoundingClientRect();
    container.scrollTop = scrollOffsetToReveal({
      start: field.top - outer.top + container.scrollTop - 8,
      end: field.bottom - outer.top + container.scrollTop + 8,
      viewportSize: container.clientHeight,
      scrollOffset: container.scrollTop,
      scrollSize: container.scrollHeight,
    });
  }
  control.focus({ preventScroll: true });
  return true;
}

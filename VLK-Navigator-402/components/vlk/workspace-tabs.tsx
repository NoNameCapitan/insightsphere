"use client";

import { useRef } from "react";
import { BookOpen, List } from "lucide-react";

export type WorkspacePanel = "list" | "article";

export function WorkspaceTabs({ active, onChange, articleCount }: {
  active: WorkspacePanel;
  onChange: (panel: WorkspacePanel) => void;
  articleCount: number;
}) {
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);
  const panels = [
    { id: "list", label: "Список", icon: List, count: articleCount },
    { id: "article", label: "Читання", icon: BookOpen, count: null },
  ] as const;

  return <nav className="workspace-tabs" role="tablist" aria-label="Розділи робочого екрана">
    {panels.map((panel, index) => <button key={panel.id}
      ref={(node) => { buttons.current[index] = node; }}
      id={`vlk-tab-${panel.id}`} role="tab" type="button"
      aria-selected={active === panel.id} aria-controls={`vlk-panel-${panel.id}`}
      tabIndex={active === panel.id ? 0 : -1}
      onClick={() => onChange(panel.id)}
      onKeyDown={(event) => {
        let next: number;
        if (event.key === "ArrowRight") next = (index + 1) % panels.length;
        else if (event.key === "ArrowLeft") next = (index + panels.length - 1) % panels.length;
        else if (event.key === "Home") next = 0;
        else if (event.key === "End") next = panels.length - 1;
        else return;
        event.preventDefault();
        onChange(panels[next].id);
        buttons.current[next]?.focus();
      }}>
      <panel.icon aria-hidden="true" className="size-4" />
      {panel.label}
      {panel.count !== null ? <span key={panel.count} className="tab-count">{panel.count}</span> : null}
    </button>)}
  </nav>;
}

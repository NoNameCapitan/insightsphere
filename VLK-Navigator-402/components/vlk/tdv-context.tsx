"use client";
import { useState } from "react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { TDV_COLUMNS } from "@/lib/vlk-tdv";

/** Column wording comes directly from the corpus; no inferred fitness verdict. */
export function TdvContext({columnId,mark,children}:{columnId:number;mark?:string;children?:React.ReactNode}) {
  const [open,setOpen]=useState(false);
  const column=TDV_COLUMNS.find(item=>item.id===columnId);
  if(!column) return null;
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild><button type="button" className="tdv-context-trigger" aria-label={`Графа ${column.id}: ${column.label}${mark ? `. Позначка: ${mark}` : ''}. Відкрити пояснення`}>
      {children ?? column.id}
    </button></PopoverTrigger>
    <PopoverContent className="tdv-context-popover" side="bottom" collisionPadding={12} onOpenAutoFocus={event=>event.preventDefault()}>
      <p className="font-semibold">Графа {column.id}</p>
      <p className="mt-1 text-sm leading-5">{column.label}</p>
      {mark ? <p className="mt-2 text-sm">Позначка в офіційній таблиці: <strong>{mark}</strong></p> : null}
      {mark?.includes('КРП') ? <p className="mt-2 text-xs leading-5">«компонентами ракетного палива (КРП)» — офіційне пояснення до статті 79.</p> : null}
      <p className="mt-2 text-xs leading-5 text-muted-foreground">Позначку слід читати разом із графою та офіційною таблицею. Порожня клітинка не підтверджує придатність.</p>
      <button type="button" className="mt-2 min-h-11 text-sm font-semibold underline" onClick={()=>setOpen(false)}>Закрити пояснення</button>
    </PopoverContent>
  </Popover>;
}

"use client";

import type { RefObject } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { VlkDialogContent } from "@/components/vlk/dialog-content";

export function SessionResetDialog({ open, onOpenChange, onConfirm, returnFocusRef }: {
  open: boolean; onOpenChange: (open: boolean) => void; onConfirm: () => void;
  returnFocusRef: RefObject<HTMLButtonElement | null>;
}) {
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <VlkDialogContent returnFocusRef={returnFocusRef}>
      <DialogHeader className="pr-8">
        <DialogTitle>Завершити сесію?</DialogTitle>
        <DialogDescription>
          Будуть очищені кошик, відмітки перевірок, пошук, останні перегляди та локальний довідник лікарів у цьому браузері.
          Тема оформлення й офлайн-копія Наказу залишаться.
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button autoFocus variant="outline" className="min-h-11" onClick={() => onOpenChange(false)}>Скасувати</Button>
        <Button className="min-h-11" onClick={onConfirm}>Очистити та завершити</Button>
      </DialogFooter>
    </VlkDialogContent>
  </Dialog>;
}

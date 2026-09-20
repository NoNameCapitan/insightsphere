"use client";

import type { ComponentProps, CSSProperties, RefObject } from "react";
import { X } from "lucide-react";
import { DialogClose, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * Center with inset + auto margins, without translated coordinates. Next's CSS
 * optimizer can fold `translate: none` into `transform`, leaving the primitive's
 * separate Tailwind translate active. Inline geometry survives both build paths.
 * Radix still owns the portal, scroll lock, focus trap and focus restoration.
 */
export function VlkDialogContent({
  variant = "default", className, style, children, showCloseButton = true,
  returnFocusRef, onCloseAutoFocus, ...props
}: ComponentProps<typeof DialogContent> & {
  variant?: "default" | "reader" | "fullscreen";
  returnFocusRef?: RefObject<HTMLElement | null>;
}) {
  const fullscreen = variant === "fullscreen";
  const geometry: CSSProperties = {
    inset: 0,
    margin: "auto",
    translate: "none",
    transform: "none",
    animation: "none",
    height: variant === "default" ? "fit-content" : fullscreen ? "100dvh" : "calc(100dvh - 2rem)",
    maxHeight: fullscreen ? "100dvh" : "calc(100dvh - 2rem)",
    ...(variant !== "default" ? {
      width: fullscreen ? "100%" : "calc(100% - 2rem)",
      maxWidth: fullscreen ? "none" : "1120px",
    } : {}),
    ...(fullscreen ? { borderRadius: 0 } : {}),
  };

  return <DialogContent {...props} data-vlk-dialog={variant}
    showCloseButton={false}
    onCloseAutoFocus={(event) => {
      onCloseAutoFocus?.(event);
      if (event.defaultPrevented) return;
      // FocusScope restores focus asynchronously. Do not steal it from a menu
      // or control the doctor has already opened in the meantime.
      const focused = document.activeElement;
      if (focused instanceof HTMLElement && focused !== document.body &&
        !focused.closest('[data-vlk-dialog][data-state="closed"]')) {
        event.preventDefault();
        return;
      }
      if (returnFocusRef?.current?.isConnected) {
        event.preventDefault();
        returnFocusRef.current.focus({ preventScroll: true });
      }
    }}
    className={cn("vlk-dialog top-0 left-0 translate-x-0 translate-y-0 overscroll-contain", className)}
    style={{ ...style, ...geometry }}>
    {children}
    {showCloseButton ? <DialogClose className="absolute right-2 top-2 grid min-h-11 min-w-11 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
      aria-label="Закрити вікно"><X className="size-4" /></DialogClose> : null}
  </DialogContent>;
}

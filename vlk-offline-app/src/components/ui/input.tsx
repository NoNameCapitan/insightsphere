import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
export function Input({ className, ...p }: ComponentProps<"input">) {
  return <input className={cn("input", className)} {...p} />;
}
export function Textarea({ className, ...p }: ComponentProps<"textarea">) {
  return <textarea className={cn("input", className)} {...p} />;
}
export function Select({ className, ...p }: ComponentProps<"select">) {
  return <select className={cn("input", className)} {...p} />;
}

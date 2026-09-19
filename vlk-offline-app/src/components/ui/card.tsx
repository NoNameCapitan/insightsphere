import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
export function Card({ className, ...p }: ComponentProps<"section">) {
  return <section className={cn("card", className)} {...p} />;
}
export function CardHeader({ className, ...p }: ComponentProps<"div">) {
  return <div className={cn("card-header", className)} {...p} />;
}
export function CardContent({ className, ...p }: ComponentProps<"div">) {
  return <div className={cn("card-content", className)} {...p} />;
}

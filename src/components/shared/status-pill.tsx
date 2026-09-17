import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type Tone = "neutral" | "info" | "success" | "warning" | "danger" | "brand";

const TONES: Record<Tone, string> = {
  neutral: "bg-neutral-subtle text-neutral",
  info: "bg-info-subtle text-info",
  success: "bg-success-subtle text-success",
  warning: "bg-warning-subtle text-warning",
  danger: "bg-danger-subtle text-danger",
  brand: "bg-brand-subtle text-brand-subtle-foreground",
};

const DOTS: Record<Tone, string> = {
  neutral: "bg-neutral",
  info: "bg-info",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  brand: "bg-primary",
};

/** Systematic status colour: neutral for normal, clear success, warning and danger. */
export function StatusPill({ tone = "neutral", children, className, dot = true }: { tone?: Tone; children: ReactNode; className?: string; dot?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap", TONES[tone], className)}>
      {dot ? <span aria-hidden className={cn("size-1.5 rounded-full", DOTS[tone])} /> : null}
      {children}
    </span>
  );
}

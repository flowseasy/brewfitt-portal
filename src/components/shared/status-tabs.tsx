"use client";

import { cn } from "@/lib/utils";

/** Status filter pills with counts, used above record lists. */
export function StatusTabs<T extends string>({ tabs, value, onChange, label = "Filter by status" }: { tabs: { value: T; label: string; count: number }[]; value: T; onChange: (v: T) => void; label?: string }) {
  return (
    <div role="tablist" aria-label={label} className="-mx-4 mb-4 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
      {tabs.map((t) => (
        <button
          key={t.value}
          role="tab"
          type="button"
          aria-selected={value === t.value}
          onClick={() => onChange(t.value)}
          className={cn("flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm transition", value === t.value ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-primary/40")}
        >
          {t.label}
          <span className={cn("rounded-full px-1.5 text-xs tabular-nums", value === t.value ? "bg-primary-foreground/20" : "bg-muted")}>{t.count}</span>
        </button>
      ))}
    </div>
  );
}

"use client";

import { MinusIcon, PlusIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = 999,
  label,
  size = "default",
  className,
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  label: string;
  size?: "sm" | "default";
  className?: string;
}) {
  const clamp = (n: number) => Math.min(max, Math.max(min, Number.isFinite(n) ? Math.round(n) : min));
  const h = size === "sm" ? "h-8" : "h-10";
  return (
    <div className={cn("inline-flex items-center rounded-full border bg-background", h, className)} role="group" aria-label={label}>
      <Button type="button" variant="ghost" size={size === "sm" ? "icon-sm" : "icon"} className="rounded-full" onClick={() => onChange(clamp(value - 1))} disabled={value <= min} aria-label="Decrease quantity">
        <MinusIcon aria-hidden />
      </Button>
      <input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(clamp(Number(e.target.value)))}
        aria-label={`${label} quantity`}
        className="w-10 [appearance:textfield] bg-transparent text-center text-sm font-medium tabular-nums outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <Button type="button" variant="ghost" size={size === "sm" ? "icon-sm" : "icon"} className="rounded-full" onClick={() => onChange(clamp(value + 1))} disabled={value >= max} aria-label="Increase quantity">
        <PlusIcon aria-hidden />
      </Button>
    </div>
  );
}

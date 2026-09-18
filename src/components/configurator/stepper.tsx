"use client";

import { CheckIcon, WarningCircleIcon } from "@phosphor-icons/react";
import type { ConfiguratorRules, ConfiguratorStepId } from "@/types";
import { cn } from "@/lib/utils";

export type StepKey = ConfiguratorStepId | "review";

export function ConfiguratorStepper({
  rules,
  current,
  onSelect,
  errors,
  visited,
}: {
  rules: ConfiguratorRules;
  current: StepKey;
  onSelect: (step: StepKey) => void;
  errors: Partial<Record<ConfiguratorStepId, string[]>>;
  visited: Set<StepKey>;
}) {
  const steps: { id: StepKey; title: string }[] = [
    ...rules.steps.map((s) => ({ id: s.id as StepKey, title: s.title })),
    { id: "review", title: "Review" },
  ];
  return (
    <nav
      aria-label="Dispense Designer steps"
      className="-mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0"
    >
      <ol className="flex min-w-max gap-1.5 lg:min-w-0 lg:flex-col">
        {steps.map((s, i) => {
          const invalid =
            s.id !== "review" && visited.has(s.id) && !!errors[s.id as ConfiguratorStepId]?.length;
          const done =
            s.id !== "review" && visited.has(s.id) && !errors[s.id as ConfiguratorStepId]?.length;
          const active = s.id === current;
          return (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => onSelect(s.id)}
                aria-current={active ? "step" : undefined}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm transition",
                  active
                    ? "bg-brand-subtle font-medium text-brand-subtle-foreground"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                )}
              >
                <span
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                    active && "border-primary bg-primary text-primary-foreground",
                    done && !active && "border-success bg-success text-white",
                    invalid && !active && "border-warning text-warning",
                  )}
                >
                  {done && !active ? (
                    <CheckIcon weight="bold" className="size-3.5" aria-hidden />
                  ) : invalid && !active ? (
                    <WarningCircleIcon className="size-4" aria-hidden />
                  ) : (
                    i + 1
                  )}
                </span>
                <span className="whitespace-nowrap">{s.title}</span>
                {invalid ? (
                  <span className="sr-only">(needs attention)</span>
                ) : done ? (
                  <span className="sr-only">(complete)</span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

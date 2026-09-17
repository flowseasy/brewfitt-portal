"use client";

import { useQuery } from "@tanstack/react-query";
import {
  BuildingsIcon,
  CheckCircleIcon,
  FactoryIcon,
  StorefrontIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react";
import { api, queryKeys } from "@/lib/api";
import type { Persona, PersonaOption } from "@/types";
import { cn } from "@/lib/utils";
import { ErrorState, LoadingState } from "./states";

const KIND_LABEL: Record<Persona["kind"], string> = {
  customer: "Customer",
  site: "Pub group site",
  group: "Pub group",
  supplier: "Supplier",
};

const KIND_ICON = {
  customer: StorefrontIcon,
  site: BuildingsIcon,
  group: UsersThreeIcon,
  supplier: FactoryIcon,
};

/** Demo personas in place of login (Phase 1). */
export function PersonaList({
  current,
  onChoose,
}: {
  current?: Persona | null;
  onChoose: (option: PersonaOption) => void;
}) {
  const personas = useQuery({
    queryKey: queryKeys.personas(),
    queryFn: () => api.demo.personas(),
    staleTime: Infinity,
  });

  if (personas.isPending) return <LoadingState rows={4} label="Loading personas" />;
  if (personas.isError)
    return <ErrorState error={personas.error} onRetry={() => personas.refetch()} />;

  return (
    <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2" aria-label="Personas">
      {personas.data.map((option) => {
        const Icon = KIND_ICON[option.persona.kind];
        const selected =
          current?.contactId === option.persona.contactId &&
          current?.accountId === option.persona.accountId;
        return (
          <li key={`${option.persona.contactId}-${option.persona.accountId}`}>
            <button
              type="button"
              onClick={() => onChoose(option)}
              aria-pressed={selected}
              className={cn(
                "group flex h-full w-full items-start gap-3 rounded-xl border bg-card p-3.5 text-left transition hover:border-primary/40 hover:bg-accent/50",
                selected && "border-primary/50 bg-brand-subtle",
              )}
            >
              <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground group-hover:text-primary">
                <Icon className="size-5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    {KIND_LABEL[option.persona.kind]}
                  </span>
                  {selected ? (
                    <CheckCircleIcon
                      weight="fill"
                      className="size-4 text-primary"
                      aria-label="Current persona"
                    />
                  ) : null}
                </span>
                <span className="mt-0.5 block font-medium">{option.label}</span>
                <span className="mt-0.5 block text-sm text-muted-foreground">
                  {option.description}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

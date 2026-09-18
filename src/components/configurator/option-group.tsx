"use client";

import { useId, useState } from "react";
import Image from "next/image";
import { CaretDownIcon, CheckCircleIcon } from "@phosphor-icons/react";
import type { ConfiguratorGroup, ConfiguratorRules, Money } from "@/types";
import {
  checkCompatibility,
  type BuilderAction,
  type BuilderState,
} from "@/features/configurator/use-configurator";
import { buildBillOfMaterials } from "@/lib/configurator/engine";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * One choice within a step. Only compatible options are offered (BLUEPRINT.md);
 * the rest are listed with the reason, behind a disclosure.
 */
export function ConfiguratorOptionGroup({
  group,
  rules,
  state,
  dispatch,
  prices,
}: {
  group: ConfiguratorGroup;
  rules: ConfiguratorRules;
  state: BuilderState;
  dispatch: (a: BuilderAction) => void;
  prices: Map<string, Money>;
}) {
  const legendId = useId();
  const [showUnavailable, setShowUnavailable] = useState(false);
  const options = rules.options.filter((o) => o.groupId === group.id);
  const results = options.map((o) => ({ option: o, result: checkCompatibility(o, state, rules) }));
  const compatible = results.filter((r) => r.result.compatible).map((r) => r.option);
  const unavailable = results.filter((r) => !r.result.compatible);
  const selected = new Set([
    ...state.selections.dispense.optionIds,
    ...state.selections.font.optionIds,
    ...state.selections.cooling.optionIds,
    ...state.selections.gas.optionIds,
    ...state.selections.ancillaries.optionIds,
  ]);
  const single = group.selection === "single";
  const auto = group.id === "g-other-dispense";

  if (compatible.length === 0 && auto) return null;

  /** What this option adds to the total with the current design. */
  const optionCost = (optionId: string) => {
    const probe = structuredClone(state);
    probe.selections.dispense.optionIds = [];
    probe.selections.font.optionIds = [optionId];
    probe.selections.cooling.optionIds = [];
    probe.selections.gas.optionIds = [];
    probe.selections.ancillaries.optionIds = [];
    return buildBillOfMaterials(
      probe,
      { ...rules, options: rules.options.filter((o) => o.id === optionId) },
      (id) => prices.get(id) ?? null,
    ).total;
  };

  return (
    <fieldset aria-labelledby={legendId} className="rounded-2xl border bg-card p-4 sm:p-5">
      <div className="mb-3">
        <legend id={legendId} className="flex items-center gap-2 font-medium">
          {group.label}
          {group.required && !auto ? (
            <span className="text-xs font-normal text-muted-foreground">Required</span>
          ) : (
            <span className="text-xs font-normal text-muted-foreground">
              {auto ? "Added for you" : "Optional"}
            </span>
          )}
        </legend>
        {group.help ? <p className="mt-0.5 text-sm text-muted-foreground">{group.help}</p> : null}
      </div>

      {compatible.length === 0 ? (
        <p className="rounded-xl bg-muted/60 p-3 text-sm text-muted-foreground">
          Not needed for this design.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {compatible.map((o) => {
            const checked = selected.has(o.id);
            const cost = optionCost(o.id);
            return (
              <label
                key={o.id}
                className={cn(
                  "relative flex cursor-pointer gap-3 rounded-xl border p-3 transition focus-within:ring-3 focus-within:ring-ring/40 hover:border-primary/40",
                  checked ? "border-primary bg-brand-subtle/60" : "bg-background",
                  auto && "cursor-default",
                )}
              >
                <input
                  type={single ? "radio" : "checkbox"}
                  name={group.id}
                  value={o.id}
                  checked={checked}
                  disabled={auto}
                  onChange={(e) =>
                    dispatch({
                      type: "select",
                      groupId: group.id,
                      optionId: o.id,
                      single,
                      on: single ? true : e.target.checked,
                    })
                  }
                  onClick={(e) => {
                    // Radios in optional groups can be cleared by choosing them again.
                    if (single && checked && !group.required) {
                      e.preventDefault();
                      dispatch({
                        type: "select",
                        groupId: group.id,
                        optionId: o.id,
                        single,
                        on: false,
                      });
                    }
                  }}
                  className="sr-only"
                />
                {o.image ? (
                  <span className="relative size-14 shrink-0 overflow-hidden rounded-lg border bg-white">
                    <Image src={o.image} alt="" fill sizes="56px" className="object-contain p-1" />
                  </span>
                ) : null}
                <span className="min-w-0 flex-1">
                  <span className="flex items-start justify-between gap-2">
                    <span className="text-sm font-medium">{o.label}</span>
                    {checked ? (
                      <CheckCircleIcon
                        weight="fill"
                        className="size-5 shrink-0 text-primary"
                        aria-hidden
                      />
                    ) : (
                      <span aria-hidden className="size-5 shrink-0 rounded-full border" />
                    )}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {o.description}
                  </span>
                  {cost.amount > 0 ? (
                    <span className="mt-1 block text-xs font-medium tabular-nums">
                      +{formatMoney(cost)}
                    </span>
                  ) : null}
                </span>
              </label>
            );
          })}
        </div>
      )}

      {unavailable.length && !auto ? (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setShowUnavailable((v) => !v)}
            aria-expanded={showUnavailable}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <CaretDownIcon
              className={cn("size-3.5 transition-transform", showUnavailable && "rotate-180")}
              aria-hidden
            />
            {unavailable.length} {unavailable.length === 1 ? "option does" : "options do"} not suit
            this design
          </button>
          {showUnavailable ? (
            <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
              {unavailable.map(({ option, result }) => (
                <li key={option.id}>
                  <span className="font-medium text-foreground">{option.label}</span>:{" "}
                  {result.compatible ? "" : result.reason}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </fieldset>
  );
}

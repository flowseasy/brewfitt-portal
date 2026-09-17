"use client";

import { PlusIcon, TrashIcon, XIcon } from "@phosphor-icons/react";
import type { Beverage, ConfiguratorRules, DispensePoint } from "@/types";
import { Button } from "@/components/ui/button";
import { BEVERAGE_LABEL, draughtTaps, type BuilderAction } from "@/features/configurator/use-configurator";

const BEVERAGES = Object.keys(BEVERAGE_LABEL) as Beverage[];

export function DispenseEditor({ points, rules, dispatch }: { points: DispensePoint[]; rules: ConfiguratorRules; dispatch: (a: BuilderAction) => void }) {
  const set = (next: DispensePoint[]) => dispatch({ type: "points", points: next });
  const update = (id: string, patch: Partial<DispensePoint>) => set(points.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  const nextId = () => `pt-${Math.max(0, ...points.map((p) => Number(p.id.replace("pt-", "")) || 0)) + 1}`;

  return (
    <section aria-labelledby="points-heading" className="rounded-2xl border bg-card p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 id="points-heading" className="font-medium">
            Dispense points
          </h3>
          <p className="text-sm text-muted-foreground">Each point is one font or tower on the bar. Add a product for every tap.</p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={points.length >= rules.limits.maxPoints}
          onClick={() => set([...points, { id: nextId(), name: `Dispense point ${points.length + 1}`, taps: ["lager"] }])}
        >
          <PlusIcon aria-hidden />
          Add point
        </Button>
      </div>

      <ol className="space-y-3">
        {points.map((p, index) => {
          const draught = draughtTaps(p);
          return (
            <li key={p.id} className="rounded-xl border bg-background p-3">
              <div className="flex items-center gap-2">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-subtle text-xs font-semibold text-brand-subtle-foreground" aria-hidden>
                  {index + 1}
                </span>
                <label className="sr-only" htmlFor={`${p.id}-name`}>
                  Name of dispense point {index + 1}
                </label>
                <input
                  id={`${p.id}-name`}
                  value={p.name}
                  onChange={(e) => update(p.id, { name: e.target.value })}
                  className="h-9 min-w-0 flex-1 rounded-md border-0 bg-transparent px-1 font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
                />
                <Button type="button" variant="ghost" size="icon-sm" onClick={() => set(points.filter((x) => x.id !== p.id))} disabled={points.length <= rules.limits.minPoints} aria-label={`Remove ${p.name}`}>
                  <TrashIcon aria-hidden />
                </Button>
              </div>
              <ul className="mt-2 flex flex-wrap gap-2" aria-label={`Products on ${p.name}`}>
                {p.taps.map((tap, i) => (
                  <li key={`${p.id}-${i}`} className="flex items-center rounded-full border bg-card pr-1 pl-3">
                    <label className="sr-only" htmlFor={`${p.id}-tap-${i}`}>
                      Tap {i + 1} on {p.name}
                    </label>
                    <select
                      id={`${p.id}-tap-${i}`}
                      value={tap}
                      onChange={(e) => update(p.id, { taps: p.taps.map((t, j) => (j === i ? (e.target.value as Beverage) : t)) })}
                      className="h-8 bg-transparent pr-1 text-sm outline-none"
                    >
                      {BEVERAGES.map((b) => (
                        <option key={b} value={b}>
                          {BEVERAGE_LABEL[b]}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => update(p.id, { taps: p.taps.filter((_, j) => j !== i) })}
                      disabled={p.taps.length <= 1}
                      className="flex size-6 items-center justify-center rounded-full text-muted-foreground hover:bg-accent disabled:opacity-30"
                      aria-label={`Remove tap ${i + 1} from ${p.name}`}
                    >
                      <XIcon className="size-3.5" aria-hidden />
                    </button>
                  </li>
                ))}
                <li>
                  <button
                    type="button"
                    onClick={() => update(p.id, { taps: [...p.taps, "lager"] })}
                    disabled={draught >= rules.limits.maxTapsPerPoint}
                    className="flex h-8 items-center gap-1 rounded-full border border-dashed px-3 text-sm text-muted-foreground hover:border-primary/40 hover:text-foreground disabled:opacity-40"
                  >
                    <PlusIcon className="size-3.5" aria-hidden />
                    Add product
                  </button>
                </li>
              </ul>
              <p className="mt-2 text-xs text-muted-foreground">
                {draught} draught {draught === 1 ? "tap" : "taps"}
                {p.taps.length > draught ? `, ${p.taps.length - draught} other` : ""}
              </p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

"use client";

import { useEffect, useId, useRef, useState, type ComponentProps } from "react";
import { MagnifyingGlassIcon } from "@phosphor-icons/react";
import type { CompositeBuild, CostItem } from "@/types";
import { useCostItems } from "@/features/internal/use-composite";
import { formatForeign } from "@/lib/composite/pricing";
import { cn } from "@/lib/utils";

/** Native selects in the costing sheet: fast to tab through and to type into. */
export const nativeSelectClass =
  "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30 aria-invalid:border-destructive";

/** Margin colour: thin margins stand out. */
export function marginTone(margin: number): string {
  if (margin < 15) return "text-danger";
  if (margin < 25) return "text-warning";
  return "text-success";
}

/** Currencies a build buys in, other than sterling. */
export function CurrencyBadges({ build }: { build: Pick<CompositeBuild, "bands" | "fxRates"> }) {
  const used = new Set(build.bands.flatMap((b) => b.lines.map((l) => l.currency)));
  const foreign = (["USD", "EUR"] as const).filter((c) => used.has(c));
  if (!foreign.length) return <span className="text-xs text-muted-foreground">GBP only</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {foreign.map((c) => (
        <span
          key={c}
          className="rounded-md bg-info-subtle px-1.5 py-0.5 text-xs text-info tabular-nums"
          title={`Converted at ${build.fxRates[c].toFixed(3)} ${c} to the pound`}
        >
          {c} @ {build.fxRates[c].toFixed(3)}
        </span>
      ))}
    </span>
  );
}

type NumberFieldProps = Omit<ComponentProps<"input">, "value" | "onChange" | "type"> & {
  value: number;
  onValue: (value: number) => void;
  /** Stored units per displayed unit, e.g. 100 for pence shown as pounds. */
  scale?: number;
  decimals?: number;
  /** Trim trailing zeros when not editing (quantities, hours). */
  trim?: boolean;
  integer?: boolean;
  max?: number;
};

/**
 * A number cell that keeps what is typed while focused and reformats on
 * blur, so partial input like "12." never jumps. Values commit as you type.
 */
export function NumberField({
  value,
  onValue,
  scale = 1,
  decimals = 2,
  trim = false,
  integer = false,
  max,
  className,
  onFocus,
  onBlur,
  ...props
}: NumberFieldProps) {
  const [text, setText] = useState<string | null>(null);
  const format = (v: number) => {
    const fixed = (v / scale).toFixed(decimals);
    return trim ? String(Number(fixed)) : fixed;
  };
  return (
    <input
      {...props}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={text ?? format(value)}
      onFocus={(e) => {
        setText(format(value));
        e.currentTarget.select();
        onFocus?.(e);
      }}
      onChange={(e) => {
        const raw = e.target.value;
        setText(raw);
        const n = Number(raw.replace(/[£$€,%\s]/g, ""));
        if (raw.trim() === "" || !Number.isFinite(n) || n < 0) return;
        if (max !== undefined && n > max) return;
        onValue(integer ? Math.round(n * scale) : n * scale);
      }}
      onBlur={(e) => {
        setText(null);
        onBlur?.(e);
      }}
      className={cn(
        "h-8 w-full min-w-0 rounded-md border border-transparent bg-transparent px-2 text-right text-sm tabular-nums outline-none hover:border-input focus-visible:border-ring focus-visible:bg-background focus-visible:ring-3 focus-visible:ring-ring/40",
        className,
      )}
    />
  );
}

/**
 * Type-ahead over the catalogue and the component list, at cost. Arrow keys
 * move through results, Enter adds, and focus stays put for the next item.
 */
export function CostItemSearch({ onPick }: { onPick: (item: CostItem) => void }) {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const results = useCostItems(debounced);
  const items = debounced.trim().length >= 2 ? (results.data ?? []) : [];

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 150);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => setActive(0), [debounced]);

  const pick = (item: CostItem) => {
    onPick(item);
    setQ("");
    setDebounced("");
    setOpen(false);
    inputRef.current?.focus();
  };

  const showList = open && q.trim().length >= 2;

  return (
    <div className="relative">
      <MagnifyingGlassIcon
        className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <input
        ref={inputRef}
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList && items[active] ? `${listId}-${active}` : undefined}
        aria-label="Add an item by code or name"
        placeholder="Add an item: type a code or name, e.g. coupler, MC-TAP, badge"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setActive((i) => Math.min(i + 1, Math.max(items.length - 1, 0)));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => Math.max(i - 1, 0));
          } else if (e.key === "Enter") {
            if (items[active]) {
              e.preventDefault();
              pick(items[active]);
            }
          } else if (e.key === "Escape") {
            setQ("");
            setOpen(false);
          }
        }}
        className="h-9 w-full rounded-lg border border-input bg-background pr-3 pl-8 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
      />
      {showList ? (
        <ul
          id={listId}
          role="listbox"
          aria-label="Matching items"
          className="absolute inset-x-0 top-full z-20 mt-1 max-h-80 overflow-y-auto rounded-xl border bg-popover p-1 text-sm shadow-lg"
        >
          {items.length === 0 ? (
            <li className="px-3 py-2 text-muted-foreground" role="presentation">
              {results.isFetching || debounced !== q
                ? "Searching"
                : "No items match. Add a Misc line for a one-off supplier item."}
            </li>
          ) : (
            items.map((item, i) => (
              <li
                key={item.id}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(item);
                }}
                onMouseEnter={() => setActive(i)}
                className={cn(
                  "flex cursor-pointer items-baseline gap-3 rounded-lg px-2.5 py-1.5",
                  i === active && "bg-accent",
                )}
              >
                <span className="w-32 shrink-0 truncate font-mono text-xs">{item.code}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{item.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {item.kind === "catalogue" ? "Catalogue" : "Component"} · {item.category}
                  </span>
                </span>
                <span className="shrink-0 text-xs tabular-nums">
                  {formatForeign(item.unitCost, item.currency)}
                  <span className="text-muted-foreground"> / {item.unit}</span>
                </span>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}

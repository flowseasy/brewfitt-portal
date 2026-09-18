"use client";

import { Fragment, useState, type KeyboardEvent } from "react";
import { CaretDownIcon, CaretRightIcon, PlusIcon, TrashIcon } from "@phosphor-icons/react";
import type { CompositeBand, CompositeLine, CostItem } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  bandMinQty,
  BAND_LABEL,
  formatCost,
  formatForeign,
  marginPercent,
  priceByMargin,
  type BandFigures,
} from "@/lib/composite/pricing";
import { cn } from "@/lib/utils";
import { CostItemSearch, marginTone, nativeSelectClass, NumberField } from "./composite-parts";

export function newLineId(): string {
  return `cbl_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

const CURRENCY_SYMBOL = { GBP: "£", EUR: "€", USD: "$" } as const;

/** Enter moves to the same column on the next line, like a spreadsheet. */
function moveDown(e: KeyboardEvent<HTMLElement>) {
  const target = e.target as HTMLElement;
  if (e.key !== "Enter" || target.tagName !== "INPUT" || !target.dataset.col) return;
  e.preventDefault();
  const table = e.currentTarget;
  const column = [
    ...table.querySelectorAll<HTMLInputElement>(`input[data-col="${target.dataset.col}"]`),
  ];
  const next = column[column.indexOf(target as HTMLInputElement) + (e.shiftKey ? -1 : 1)];
  next?.focus();
}

/**
 * The costing sheet for one quantity band: CODE, DESCRIPTION, FX COST,
 * £ COST, QTY, TOTAL, edited in place. Misc lines open an inline form for
 * how the item is sold and bought.
 */
export function CostingSheet({
  band,
  figures,
  onChange,
}: {
  band: CompositeBand;
  figures: BandFigures;
  onChange: (fn: (band: CompositeBand) => CompositeBand) => void;
}) {
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const toggle = (id: string) =>
    setOpen((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const updateLine = (id: string, patch: Partial<CompositeLine>) =>
    onChange((b) => ({ ...b, lines: b.lines.map((l) => (l.id === id ? { ...l, ...patch } : l)) }));
  const removeLine = (id: string) =>
    onChange((b) => ({ ...b, lines: b.lines.filter((l) => l.id !== id) }));

  const addItem = (item: CostItem) =>
    onChange((b) => ({
      ...b,
      lines: [
        ...b.lines,
        {
          id: newLineId(),
          kind: item.kind,
          itemId: item.id,
          code: item.code,
          description: item.name,
          currency: item.currency,
          unitCost: item.unitCost,
          qty: 1,
          misc: null,
        },
      ],
    }));

  const addMisc = () => {
    const id = newLineId();
    onChange((b) => ({
      ...b,
      lines: [
        ...b.lines,
        {
          id,
          kind: "misc",
          itemId: null,
          code: "MISC",
          description: "",
          currency: "GBP",
          unitCost: 0,
          qty: 1,
          misc: {
            sellingName: "",
            sellingDescription: "",
            buyingName: "",
            buyingDescription: "",
            supplierQuoteRef: "",
          },
        },
      ],
    }));
    setOpen((s) => new Set(s).add(id));
    // Focus the new line's description once it renders.
    setTimeout(() => document.getElementById(`desc-${id}`)?.focus(), 0);
  };

  const figure = new Map(figures.lines.map((l) => [l.id, l]));

  return (
    <div className="rounded-2xl border bg-card">
      <div className="relative overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm" onKeyDown={moveDown}>
          <caption className="sr-only">
            Costing sheet for the {BAND_LABEL[band.key]} band. Enter moves down a column.
          </caption>
          <thead className="border-b bg-muted/40 text-left text-xs tracking-wide text-muted-foreground uppercase">
            <tr>
              <th scope="col" className="w-36 px-3 py-2 font-medium">
                Code
              </th>
              <th scope="col" className="px-2 py-2 font-medium">
                Description
              </th>
              <th scope="col" className="w-40 px-2 py-2 text-right font-medium">
                FX cost
              </th>
              <th scope="col" className="w-28 px-2 py-2 text-right font-medium">
                £ cost
              </th>
              <th scope="col" className="w-20 px-2 py-2 text-right font-medium">
                Qty
              </th>
              <th scope="col" className="w-28 px-3 py-2 text-right font-medium">
                Total
              </th>
              <th scope="col" className="w-10 px-1 py-2">
                <span className="sr-only">Remove</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {band.lines.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                  No lines in this band yet. Search for an item below or add a Misc line.
                </td>
              </tr>
            ) : null}
            {band.lines.map((line) => {
              const f = figure.get(line.id);
              const isOpen = open.has(line.id);
              const foreign = line.currency !== "GBP";
              const label = line.description || line.code || "this line";
              return (
                <Fragment key={line.id}>
                  <tr className={cn("align-middle", isOpen && "bg-muted/30")}>
                    <td className="px-3 py-1">
                      {line.kind === "misc" ? (
                        <button
                          type="button"
                          onClick={() => toggle(line.id)}
                          aria-expanded={isOpen}
                          aria-controls={`misc-${line.id}`}
                          className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 font-mono text-xs font-semibold text-warning hover:bg-warning-subtle focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none"
                        >
                          {isOpen ? (
                            <CaretDownIcon className="size-3" aria-hidden />
                          ) : (
                            <CaretRightIcon className="size-3" aria-hidden />
                          )}
                          MISC
                          <span className="sr-only">
                            {isOpen ? "Hide" : "Show"} selling and buying details
                          </span>
                        </button>
                      ) : (
                        <span className="block truncate font-mono text-xs" title={line.code}>
                          {line.code}
                          <span className="block font-sans text-[11px] text-muted-foreground">
                            {line.kind === "catalogue" ? "Catalogue" : "Component"}
                          </span>
                        </span>
                      )}
                    </td>
                    <td className="px-1 py-1">
                      <input
                        id={`desc-${line.id}`}
                        data-col="description"
                        value={line.description}
                        placeholder={line.kind === "misc" ? "Selling name" : "Description"}
                        aria-label={`Description, ${label}`}
                        onChange={(e) =>
                          updateLine(line.id, {
                            description: e.target.value,
                            ...(line.misc
                              ? { misc: { ...line.misc, sellingName: e.target.value } }
                              : {}),
                          })
                        }
                        className="h-8 w-full min-w-0 rounded-md border border-transparent bg-transparent px-2 text-sm outline-none hover:border-input focus-visible:border-ring focus-visible:bg-background focus-visible:ring-3 focus-visible:ring-ring/40"
                      />
                    </td>
                    <td className="px-1 py-1">
                      <div className="flex items-center gap-1">
                        <select
                          value={line.currency}
                          aria-label={`Currency, ${label}`}
                          onChange={(e) =>
                            updateLine(line.id, {
                              currency: e.target.value as CompositeLine["currency"],
                            })
                          }
                          className={cn(nativeSelectClass, "w-[4.25rem] shrink-0 px-1.5 text-xs")}
                        >
                          <option value="GBP">GBP</option>
                          <option value="USD">USD</option>
                          <option value="EUR">EUR</option>
                        </select>
                        {foreign ? (
                          <NumberField
                            data-col="fx"
                            value={line.unitCost}
                            scale={100}
                            integer
                            onValue={(v) => updateLine(line.id, { unitCost: v })}
                            aria-label={`Unit cost in ${line.currency}, ${label}`}
                          />
                        ) : (
                          <span
                            className="w-full px-2 text-right text-muted-foreground"
                            aria-hidden
                          >
                            –
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-1 py-1 text-right tabular-nums">
                      {foreign ? (
                        <span
                          className="px-2"
                          title={`${formatForeign(line.unitCost, line.currency)} at the build's ${line.currency} rate`}
                        >
                          {formatCost(f?.unitGbp ?? 0)}
                        </span>
                      ) : (
                        <NumberField
                          data-col="gbp"
                          value={line.unitCost}
                          scale={100}
                          integer
                          onValue={(v) => updateLine(line.id, { unitCost: v })}
                          aria-label={`Unit cost in pounds, ${label}`}
                        />
                      )}
                    </td>
                    <td className="px-1 py-1">
                      <NumberField
                        data-col="qty"
                        value={line.qty}
                        decimals={2}
                        trim
                        onValue={(v) => v > 0 && updateLine(line.id, { qty: v })}
                        aria-label={`Quantity, ${label}`}
                      />
                    </td>
                    <td className="px-3 py-1 text-right font-medium tabular-nums">
                      {formatCost(f?.total ?? 0)}
                    </td>
                    <td className="px-1 py-1 text-center">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => removeLine(line.id)}
                        aria-label={`Remove ${label}`}
                      >
                        <TrashIcon aria-hidden />
                      </Button>
                    </td>
                  </tr>
                  {line.misc && isOpen ? (
                    <tr id={`misc-${line.id}`} className="bg-muted/30">
                      <td colSpan={7} className="px-3 pt-1 pb-4">
                        <MiscForm
                          line={line}
                          onChange={(misc) =>
                            updateLine(line.id, { misc, description: misc.sellingName })
                          }
                        />
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
          <tfoot className="border-t bg-muted/20">
            <tr>
              <th
                scope="row"
                colSpan={5}
                className="px-3 py-2 text-right text-xs font-medium tracking-wide text-muted-foreground uppercase"
              >
                Goods, {BAND_LABEL[band.key]}
              </th>
              <td className="px-3 py-2 text-right font-semibold tabular-nums">
                {formatCost(figures.goods)}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="flex flex-col gap-2 border-t p-3 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <CostItemSearch onPick={addItem} />
        </div>
        <Button variant="outline" onClick={addMisc}>
          <PlusIcon aria-hidden />
          Misc line
        </Button>
      </div>
    </div>
  );
}

function MiscForm({
  line,
  onChange,
}: {
  line: CompositeLine;
  onChange: (misc: NonNullable<CompositeLine["misc"]>) => void;
}) {
  const misc = line.misc!;
  const set = (patch: Partial<typeof misc>) => onChange({ ...misc, ...patch });
  const id = (f: string) => `${f}-${line.id}`;
  return (
    <div className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-xl border bg-background p-3 lg:grid-cols-2">
      <fieldset className="space-y-3">
        <legend className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Selling (customer sees)
        </legend>
        <div className="space-y-1">
          <Label htmlFor={id("sn")}>Selling name</Label>
          <Input
            id={id("sn")}
            value={misc.sellingName}
            onChange={(e) => set({ sellingName: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={id("sd")}>Selling description</Label>
          <Textarea
            id={id("sd")}
            rows={2}
            value={misc.sellingDescription}
            onChange={(e) => set({ sellingDescription: e.target.value })}
          />
        </div>
      </fieldset>
      <fieldset className="space-y-3">
        <legend className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Buying (Brewfitt only)
        </legend>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_12rem]">
          <div className="space-y-1">
            <Label htmlFor={id("bn")}>Buying name</Label>
            <Input
              id={id("bn")}
              value={misc.buyingName}
              onChange={(e) => set({ buyingName: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={id("qr")}>Supplier quote ref</Label>
            <Input
              id={id("qr")}
              value={misc.supplierQuoteRef}
              className="font-mono"
              onChange={(e) => set({ supplierQuoteRef: e.target.value })}
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor={id("bd")}>Buying description</Label>
          <Textarea
            id={id("bd")}
            rows={2}
            value={misc.buyingDescription}
            onChange={(e) => set({ buyingDescription: e.target.value })}
          />
        </div>
      </fieldset>
    </div>
  );
}

/** One costing row below the sheet: label, optional control, amount. */
function TotalRow({
  label,
  hint,
  control,
  amount,
  strong,
}: {
  label: string;
  hint?: string;
  control?: React.ReactNode;
  amount: React.ReactNode;
  strong?: boolean;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 py-2 sm:grid-cols-[10rem_minmax(0,1fr)_7rem]",
        strong && "font-semibold",
      )}
    >
      <div className="text-sm">
        {label}
        {hint ? (
          <span className="block text-xs font-normal text-muted-foreground">{hint}</span>
        ) : null}
      </div>
      <div className="order-3 col-span-2 sm:order-none sm:col-span-1">{control}</div>
      <div className="text-right tabular-nums">{amount}</div>
    </div>
  );
}

function BasisControl({
  basis,
  onChange,
  name,
}: {
  basis: CompositeBand["shipping"];
  onChange: (basis: CompositeBand["shipping"]) => void;
  name: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <div
        role="radiogroup"
        aria-label={`${name} as`}
        className="inline-flex rounded-lg border p-0.5 text-xs"
      >
        {(["amount", "percent"] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            role="radio"
            aria-checked={basis.mode === mode}
            onClick={() => basis.mode !== mode && onChange({ mode, value: 0 })}
            className={cn(
              "rounded-md px-2 py-0.5 focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none",
              basis.mode === mode ? "bg-primary text-primary-foreground" : "text-muted-foreground",
            )}
          >
            {mode === "amount" ? "£ each" : "% of goods"}
          </button>
        ))}
      </div>
      <NumberField
        value={basis.value}
        scale={basis.mode === "amount" ? 100 : 1}
        decimals={2}
        integer={basis.mode === "amount"}
        onValue={(v) => onChange({ ...basis, value: v })}
        aria-label={
          basis.mode === "amount"
            ? `${name} per unit in pounds`
            : `${name} as a percentage of goods`
        }
        className="w-24 border-input"
      />
    </div>
  );
}

/**
 * Below the sheet: shipping, duty and labour to the cost total, then two-way
 * pricing (type a margin to get the price, or a price to get the margin),
 * gross profit, and carriage added after margin.
 */
export function BandTotals({
  band,
  figures,
  labourRate,
  onChange,
}: {
  band: CompositeBand;
  figures: BandFigures;
  labourRate: number;
  onChange: (fn: (band: CompositeBand) => CompositeBand) => void;
}) {
  const set = (patch: Partial<CompositeBand>) => onChange((b) => ({ ...b, ...patch }));
  const byMargin = priceByMargin(figures.costTotal, band.targetMarginPercent);
  const differs = Number.isFinite(byMargin) && Math.abs(byMargin - band.sellPrice) >= 0.5;
  const min = bandMinQty(band.key);

  return (
    <section
      aria-labelledby={`totals-${band.key}`}
      className="rounded-2xl border bg-card p-4 sm:p-5"
    >
      <h3 id={`totals-${band.key}`} className="mb-1 font-medium">
        {BAND_LABEL[band.key]} costing and price
        <span className="ml-2 text-xs font-normal text-muted-foreground">
          per unit{band.key === "base" ? "" : `, ${min} or more`}
        </span>
      </h3>
      <div className="divide-y">
        <TotalRow label="Goods" hint="Lines above" amount={formatCost(figures.goods)} />
        <TotalRow
          label="Shipping"
          control={
            <BasisControl
              basis={band.shipping}
              name="Shipping"
              onChange={(shipping) => set({ shipping })}
            />
          }
          amount={formatCost(figures.shipping)}
        />
        <TotalRow
          label="Duty"
          control={
            <BasisControl basis={band.duty} name="Duty" onChange={(duty) => set({ duty })} />
          }
          amount={formatCost(figures.duty)}
        />
        <TotalRow
          label="Labour"
          hint={`${formatCost(labourRate)} an hour`}
          control={
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <NumberField
                value={band.labourHours}
                decimals={2}
                trim
                onValue={(v) => set({ labourHours: v })}
                aria-label="Labour hours"
                className="w-20 border-input"
              />
              hours
            </div>
          }
          amount={formatCost(figures.labour)}
        />
        <TotalRow label="Cost total" amount={formatCost(figures.costTotal)} strong />
        <TotalRow
          label="Margin"
          hint="% of sell price"
          control={
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
              <div className="flex items-center gap-1">
                <NumberField
                  value={band.targetMarginPercent}
                  decimals={2}
                  max={95}
                  onValue={(m) =>
                    set({
                      targetMarginPercent: m,
                      sellPrice: Math.max(0, Math.round(priceByMargin(figures.costTotal, m))),
                    })
                  }
                  aria-label="Margin percentage"
                  className="w-24 border-input"
                />
                <span className="text-muted-foreground">%</span>
              </div>
              <span className="text-muted-foreground">
                Price by margin{" "}
                <span className="font-medium text-foreground tabular-nums">
                  {Number.isFinite(byMargin) ? formatCost(byMargin) : "–"}
                </span>
              </span>
            </div>
          }
          amount={
            <span className={marginTone(figures.marginPercent)}>
              {figures.marginPercent.toFixed(2)}%
            </span>
          }
        />
        <TotalRow
          label="Sell price"
          hint="Type a price to see the margin"
          control={
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">£</span>
                <NumberField
                  value={band.sellPrice}
                  scale={100}
                  integer
                  onValue={(p) =>
                    set({
                      sellPrice: p,
                      targetMarginPercent: Math.min(
                        95,
                        Math.max(0, marginPercent(figures.costTotal, p)),
                      ),
                    })
                  }
                  aria-label="Sell price per unit in pounds"
                  className="w-28 border-input"
                />
              </div>
              <span className="text-muted-foreground">
                Markup {figures.markupPercent.toFixed(2)}%
                {differs ? " · differs from price by margin" : ""}
              </span>
            </div>
          }
          amount={formatCost(figures.sellPrice)}
          strong
        />
        <TotalRow
          label="Gross profit"
          amount={
            <span className={figures.grossProfit < 0 ? "text-danger" : undefined}>
              {formatCost(figures.grossProfit)}
            </span>
          }
        />
        <TotalRow
          label="Carriage (CRG)"
          hint="Added after margin, not marked up"
          control={
            <div className="flex items-center gap-1 text-sm">
              <span className="text-muted-foreground">£</span>
              <NumberField
                value={band.carriage}
                scale={100}
                integer
                onValue={(c) => set({ carriage: c })}
                aria-label="Carriage per unit in pounds"
                className="w-24 border-input"
              />
            </div>
          }
          amount={formatCost(figures.carriage)}
        />
      </div>
      <div className="mt-2 flex items-baseline justify-between rounded-xl bg-brand-subtle px-3 py-2.5 text-brand-subtle-foreground">
        <span className="text-sm font-medium">Total including carriage</span>
        <span className="text-xl font-semibold tabular-nums">
          {formatCost(figures.totalIncludingCarriage)}
        </span>
      </div>
      <p className="sr-only" aria-live="polite">
        {BAND_LABEL[band.key]}: cost {formatCost(figures.costTotal)}, sell{" "}
        {formatCost(figures.sellPrice)}, margin {figures.marginPercent.toFixed(2)}%.
      </p>
      <p className="mt-2 text-xs text-muted-foreground">
        {CURRENCY_SYMBOL.USD} and {CURRENCY_SYMBOL.EUR} lines convert at the build&apos;s rates.
      </p>
    </section>
  );
}

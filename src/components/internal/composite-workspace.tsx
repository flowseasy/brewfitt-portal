"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeftIcon,
  ArrowsMergeIcon,
  CheckCircleIcon,
  CopyIcon,
  FilePlusIcon,
  PlusIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import type { CompositeBand, CompositeBandKey, CompositeBuild, CompositeSettings } from "@/types";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { StatusPill } from "@/components/shared/status-pill";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useInternalCustomers } from "@/features/internal/use-composite";
import { usePersonaKey } from "@/features/session/use-session";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { api, errorMessage, queryKeys } from "@/lib/api";
import { BAND_LABEL, BAND_ORDER, bandFigures, copyBand, formatCost } from "@/lib/composite/pricing";
import { formatDate, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AddToQuoteSheet } from "./add-to-quote-sheet";
import { marginTone, nativeSelectClass, NumberField } from "./composite-parts";
import { BandTotals, CostingSheet, newLineId } from "./costing-sheet";

type Draft = CompositeBuild;

/**
 * The Composite Configurator workspace (decision 14): a costing sheet per
 * quantity band with live totals, saved automatically as you type.
 */
export function CompositeWorkspace({
  initial,
  settings,
}: {
  initial: CompositeBuild;
  settings: CompositeSettings;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const key = usePersonaKey();
  const customers = useInternalCustomers();
  const [draft, setDraft] = useState<Draft>(initial);
  const [dirty, setDirty] = useState(false);
  const [active, setActive] = useState<CompositeBandKey>(
    BAND_ORDER.find((k) => initial.bands.some((b) => b.key === k))!,
  );
  const [removeOpen, setRemoveOpen] = useState(false);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const latest = useRef(draft);
  latest.current = draft;
  useDocumentTitle(draft.name ? `${draft.name} · Configurator` : "Configurator");

  const save = useMutation({
    mutationFn: (b: Draft) =>
      api.internal.updateCompositeBuild(b.id, {
        name: b.name.trim() || undefined,
        description: b.description,
        accountId: b.accountId,
        brand: b.brand,
        fxRates: b.fxRates,
        labourRate: b.labourRate,
        bands: b.bands,
      }),
    onSuccess: (saved) => {
      queryClient.setQueryData(queryKeys.compositeBuild(key, saved.id), saved);
      void queryClient.invalidateQueries({ queryKey: queryKeys.compositeBuilds(key) });
    },
  });

  const change = useCallback((fn: (d: Draft) => Draft) => {
    setDraft((d) => fn(d));
    setDirty(true);
  }, []);

  // Autosave shortly after typing stops.
  useEffect(() => {
    if (!dirty) return;
    const t = setTimeout(() => {
      setDirty(false);
      save.mutate(latest.current);
    }, 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- save is stable enough; only draft edits schedule a save
  }, [draft, dirty]);

  const flush = async () => {
    if (dirty || save.isError) {
      setDirty(false);
      await save.mutateAsync(latest.current);
    }
  };

  const duplicate = useMutation({
    mutationFn: async () => {
      await flush();
      return api.internal.duplicateCompositeBuild(draft.id);
    },
    onSuccess: (copy) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.compositeBuilds(key) });
      toast.success(`${copy.number} created`, { description: copy.name });
      router.push(`/internal/configurator/build?id=${copy.id}`);
    },
    onError: (error) =>
      toast.error("The build could not be duplicated", { description: errorMessage(error) }),
  });

  const bands = useMemo(
    () => [...draft.bands].sort((a, b) => BAND_ORDER.indexOf(a.key) - BAND_ORDER.indexOf(b.key)),
    [draft.bands],
  );
  const band = bands.find((b) => b.key === active) ?? bands[0]!;
  const figures = useMemo(
    () => new Map(bands.map((b) => [b.key, bandFigures(b, draft)])),
    [bands, draft],
  );
  const missing = BAND_ORDER.filter((k) => !draft.bands.some((b) => b.key === k));

  const changeBand = (fn: (b: CompositeBand) => CompositeBand) =>
    change((d) => ({ ...d, bands: d.bands.map((b) => (b.key === band.key ? fn(b) : b)) }));

  const addBand = (key: CompositeBandKey) => {
    change((d) => {
      const source = d.bands.find((b) => b.key === "base") ?? d.bands[0]!;
      return { ...d, bands: [...d.bands, copyBand(source, key, newLineId)] };
    });
    setActive(key);
  };

  const removeBand = () => {
    const next = bands.find((b) => b.key !== band.key)!.key;
    change((d) => ({ ...d, bands: d.bands.filter((b) => b.key !== band.key) }));
    setActive(next);
    setRemoveOpen(false);
  };

  const saveState = save.isPending
    ? "Saving"
    : dirty
      ? "Unsaved changes"
      : save.isError
        ? "Not saved"
        : "All changes saved";

  return (
    <div>
      <Link
        href="/internal/configurator"
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" aria-hidden />
        Configurator
      </Link>

      {/* Title and actions */}
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <label htmlFor="build-name" className="sr-only">
            Build name
          </label>
          <input
            id="build-name"
            value={draft.name}
            onChange={(e) => change((d) => ({ ...d, name: e.target.value }))}
            className="-ml-2 w-full rounded-lg border border-transparent bg-transparent px-2 py-0.5 text-2xl font-semibold tracking-tight outline-none hover:border-input focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 sm:text-3xl"
            aria-invalid={!draft.name.trim()}
          />
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            <span className="font-mono">{draft.number}</span>
            <StatusPill tone={draft.status === "quoted" ? "success" : "neutral"}>
              {draft.status === "quoted" ? "Quoted" : "Draft"}
            </StatusPill>
            <span
              role="status"
              className={cn(
                "inline-flex items-center gap-1",
                save.isError && !dirty && !save.isPending && "text-danger",
              )}
            >
              {save.isError && !dirty && !save.isPending ? (
                <WarningCircleIcon className="size-4" aria-hidden />
              ) : !dirty && !save.isPending ? (
                <CheckCircleIcon className="size-4 text-success" aria-hidden />
              ) : null}
              {saveState}
              {save.isError && !dirty && !save.isPending ? (
                <button
                  type="button"
                  className="underline"
                  onClick={() => save.mutate(latest.current)}
                >
                  Retry
                </button>
              ) : null}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={() => duplicate.mutate()}
            disabled={duplicate.isPending}
          >
            <CopyIcon aria-hidden />
            Duplicate
          </Button>
          <Tooltip>
            <TooltipTrigger asChild>
              {/* Disabled buttons get no pointer events, so the tooltip hangs on a focusable wrapper. */}
              <span
                tabIndex={0}
                className="rounded-lg focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none"
              >
                <Button variant="outline" disabled aria-describedby="convert-hint">
                  <ArrowsMergeIcon aria-hidden />
                  Convert to composite
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent id="convert-hint">Available in TOTA360v5 in Phase 2</TooltipContent>
          </Tooltip>
          <Button
            onClick={async () => {
              try {
                await flush();
                setQuoteOpen(true);
              } catch (error) {
                toast.error("Save the build before quoting it", {
                  description: errorMessage(error),
                });
              }
            }}
          >
            <FilePlusIcon aria-hidden />
            Add to quote
          </Button>
        </div>
      </div>

      {/* Header: customer, brand, date, creator */}
      <section aria-label="Build details" className="mb-4 rounded-2xl border bg-card p-4 sm:p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-[1.4fr_1.2fr_0.7fr_0.5fr]">
          <div className="space-y-1.5">
            <Label htmlFor="build-customer">Customer</Label>
            <select
              id="build-customer"
              className={nativeSelectClass}
              value={draft.accountId}
              onChange={(e) => change((d) => ({ ...d, accountId: e.target.value }))}
              disabled={draft.status === "quoted"}
            >
              {(customers.data ?? []).length === 0 ? (
                <option value={draft.accountId}>Loading customers</option>
              ) : null}
              {(customers.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="build-brand">Brand or project</Label>
            <Input
              id="build-brand"
              value={draft.brand}
              onChange={(e) => change((d) => ({ ...d, brand: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <span className="text-sm font-medium" id="build-date">
              Date
            </span>
            <p aria-labelledby="build-date" className="flex h-8 items-center text-sm tabular-nums">
              {formatDate(draft.createdOn)}
            </p>
          </div>
          <div className="space-y-1.5">
            <span className="text-sm font-medium" id="build-creator">
              Creator
            </span>
            <p aria-labelledby="build-creator" className="flex h-8 items-center">
              <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-sm font-semibold">
                {draft.creatorInitials}
              </span>
            </p>
          </div>
          <div className="space-y-1.5 sm:col-span-2 xl:col-span-4">
            <Label htmlFor="build-description">Description on the quote</Label>
            <Textarea
              id="build-description"
              rows={2}
              value={draft.description}
              onChange={(e) => change((d) => ({ ...d, description: e.target.value }))}
              placeholder="What the customer sees under the composite name"
            />
            <p className="text-xs text-muted-foreground">
              Customers see the name, this description and the band price. The bill of materials
              stays inside Brewfitt.
            </p>
          </div>
        </div>
      </section>

      {/* Rates */}
      <Rates draft={draft} settings={settings} change={change} />

      {/* Bands */}
      <div className="mt-6 mb-3 flex flex-wrap items-center justify-between gap-2">
        <div
          role="tablist"
          aria-label="Quantity bands"
          className="inline-flex flex-wrap gap-1 rounded-xl bg-muted p-1"
        >
          {bands.map((b) => {
            const f = figures.get(b.key)!;
            const selected = b.key === band.key;
            return (
              <button
                key={b.key}
                type="button"
                role="tab"
                id={`tab-${b.key}`}
                aria-selected={selected}
                aria-controls="band-panel"
                tabIndex={selected ? 0 : -1}
                onClick={() => setActive(b.key)}
                onKeyDown={(e) => {
                  const i = bands.indexOf(b);
                  const next =
                    e.key === "ArrowRight"
                      ? bands[i + 1]
                      : e.key === "ArrowLeft"
                        ? bands[i - 1]
                        : null;
                  if (next) {
                    setActive(next.key);
                    document.getElementById(`tab-${next.key}`)?.focus();
                  }
                }}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-left text-sm transition focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none",
                  selected
                    ? "bg-background font-medium shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {BAND_LABEL[b.key]}
                <span className="ml-2 text-xs tabular-nums">
                  {b.sellPrice ? formatCost(b.sellPrice) : "–"}
                  {b.sellPrice ? (
                    <span className={cn("ml-1", marginTone(f.marginPercent))}>
                      {f.marginPercent.toFixed(2)}%
                    </span>
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>
        <div className="flex gap-2">
          {missing.length ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <PlusIcon aria-hidden />
                  Add band
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                  Starts as a copy of the{" "}
                  {draft.bands.some((b) => b.key === "base") ? "base" : BAND_LABEL[bands[0]!.key]}{" "}
                  band
                </DropdownMenuLabel>
                {missing.map((k) => (
                  <DropdownMenuItem key={k} onSelect={() => addBand(k)}>
                    {BAND_LABEL[k]}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
          {bands.length > 1 ? (
            <Button variant="ghost" size="sm" onClick={() => setRemoveOpen(true)}>
              Remove {BAND_LABEL[band.key]}
            </Button>
          ) : null}
        </div>
      </div>

      <div
        id="band-panel"
        role="tabpanel"
        aria-labelledby={`tab-${band.key}`}
        className="grid grid-cols-1 gap-4 2xl:grid-cols-[minmax(0,1fr)_26rem]"
      >
        <CostingSheet band={band} figures={figures.get(band.key)!} onChange={changeBand} />
        <BandTotals
          band={band}
          figures={figures.get(band.key)!}
          labourRate={draft.labourRate}
          onChange={changeBand}
        />
      </div>

      <BandComparison bands={bands} figures={figures} active={band.key} onSelect={setActive} />

      {draft.quotes.length ? (
        <section aria-labelledby="quoted-on" className="mt-6">
          <h2 id="quoted-on" className="mb-2 font-medium">
            Added to quotes
          </h2>
          <ul className="divide-y rounded-2xl border bg-card text-sm">
            {draft.quotes.map((q) => (
              <li
                key={`${q.quoteId}-${q.addedAt}`}
                className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-2.5"
              >
                <Link
                  href={`/internal/quotes/view?id=${q.quoteId}`}
                  className="font-medium hover:underline"
                >
                  {q.quoteNumber}
                </Link>
                <span className="text-muted-foreground">
                  {q.qty} at the {BAND_LABEL[q.bandKey]} price · {formatDateTime(q.addedAt)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <ConfirmDialog
        open={removeOpen}
        onOpenChange={setRemoveOpen}
        title={`Remove the ${BAND_LABEL[band.key]} band?`}
        description="Its lines and pricing are removed from this build. Quotes already sent keep their price."
        confirmLabel="Remove band"
        destructive
        onConfirm={removeBand}
      />

      <AddToQuoteSheet
        open={quoteOpen}
        onOpenChange={setQuoteOpen}
        build={draft}
        bands={bands}
        onAdded={(build) => {
          queryClient.setQueryData(queryKeys.compositeBuild(key, build.id), build);
          setDraft((d) => ({
            ...d,
            status: build.status,
            quotes: build.quotes,
            updatedAt: build.updatedAt,
          }));
        }}
      />
    </div>
  );
}

function Rates({
  draft,
  settings,
  change,
}: {
  draft: Draft;
  settings: CompositeSettings;
  change: (fn: (d: Draft) => Draft) => void;
}) {
  const used = new Set(draft.bands.flatMap((b) => b.lines.map((l) => l.currency)));
  return (
    <section aria-labelledby="rates" className="rounded-2xl border bg-card p-4 sm:p-5">
      <h2 id="rates" className="font-medium">
        Rates for this build
      </h2>
      <p className="mt-0.5 text-xs text-muted-foreground">
        System rates are mock rates as at {formatDate(settings.fxRatesAsOf)}. A 0.05 buffer below
        the system rate is common for longer-term supply.
      </p>
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
        {(["USD", "EUR"] as const).map((c) => {
          const system = settings.systemFxRates[c];
          const rate = draft.fxRates[c];
          return (
            <div key={c} className="space-y-1.5">
              <Label htmlFor={`fx-${c}`} className="flex items-center gap-2">
                GBP/{c}
                {used.has(c) ? (
                  <span className="rounded bg-info-subtle px-1.5 text-[11px] font-normal text-info">
                    in use
                  </span>
                ) : null}
              </Label>
              <div className="flex items-center gap-2">
                <NumberField
                  id={`fx-${c}`}
                  value={rate}
                  decimals={3}
                  onValue={(v) =>
                    v > 0 && change((d) => ({ ...d, fxRates: { ...d.fxRates, [c]: v } }))
                  }
                  className="w-24 border-input text-left"
                  aria-describedby={`fx-${c}-hint`}
                />
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  onClick={() => change((d) => ({ ...d, fxRates: { ...d.fxRates, [c]: system } }))}
                  disabled={rate === system}
                >
                  System
                </Button>
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  onClick={() =>
                    change((d) => ({
                      ...d,
                      fxRates: { ...d.fxRates, [c]: Math.round((system - 0.05) * 1000) / 1000 },
                    }))
                  }
                >
                  −0.05
                </Button>
              </div>
              <p id={`fx-${c}-hint`} className="text-xs text-muted-foreground">
                System rate {system.toFixed(3)}
                {rate !== system
                  ? ` · this build ${rate > system ? "+" : "−"}${Math.abs(rate - system).toFixed(3)}`
                  : ""}
              </p>
            </div>
          );
        })}
        <div className="space-y-1.5">
          <Label htmlFor="labour-rate">Labour rate, £ an hour</Label>
          <div className="flex items-center gap-2">
            <NumberField
              id="labour-rate"
              value={draft.labourRate}
              scale={100}
              integer
              onValue={(v) => change((d) => ({ ...d, labourRate: v }))}
              className="w-24 border-input text-left"
              aria-describedby="labour-hint"
            />
            <Button
              type="button"
              size="xs"
              variant="outline"
              onClick={() => change((d) => ({ ...d, labourRate: settings.labourRate }))}
              disabled={draft.labourRate === settings.labourRate}
            >
              System
            </Button>
          </div>
          <p id="labour-hint" className="text-xs text-muted-foreground">
            System default {formatCost(settings.labourRate)} an hour. Hours are set per band.
          </p>
        </div>
      </div>
    </section>
  );
}

/** Every band side by side, like the costing sheet's columns. */
function BandComparison({
  bands,
  figures,
  active,
  onSelect,
}: {
  bands: CompositeBand[];
  figures: Map<CompositeBandKey, ReturnType<typeof bandFigures>>;
  active: CompositeBandKey;
  onSelect: (key: CompositeBandKey) => void;
}) {
  const rows: {
    label: string;
    value: (f: ReturnType<typeof bandFigures>) => React.ReactNode;
    strong?: boolean;
  }[] = [
    { label: "Goods", value: (f) => formatCost(f.goods) },
    { label: "Shipping", value: (f) => formatCost(f.shipping) },
    { label: "Duty", value: (f) => formatCost(f.duty) },
    { label: "Labour", value: (f) => formatCost(f.labour) },
    { label: "Cost total", value: (f) => formatCost(f.costTotal), strong: true },
    {
      label: "Margin",
      value: (f) => (
        <span className={marginTone(f.marginPercent)}>{f.marginPercent.toFixed(2)}%</span>
      ),
    },
    { label: "Markup", value: (f) => `${f.markupPercent.toFixed(2)}%` },
    { label: "Sell price", value: (f) => formatCost(f.sellPrice), strong: true },
    { label: "Gross profit", value: (f) => formatCost(f.grossProfit) },
    { label: "Carriage (CRG)", value: (f) => formatCost(f.carriage) },
    {
      label: "Total including carriage",
      value: (f) => formatCost(f.totalIncludingCarriage),
      strong: true,
    },
  ];
  return (
    <section aria-labelledby="compare" className="mt-6">
      <h2 id="compare" className="mb-2 font-medium">
        All bands, per unit
      </h2>
      <div className="relative overflow-x-auto rounded-2xl border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-2 text-left font-medium">
                <span className="sr-only">Figure</span>
              </th>
              {bands.map((b) => (
                <th key={b.key} scope="col" className="px-4 py-2 text-right font-medium">
                  <button
                    type="button"
                    onClick={() => onSelect(b.key)}
                    aria-pressed={b.key === active}
                    className={cn(
                      "rounded-md px-1.5 py-0.5 focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none",
                      b.key === active
                        ? "bg-primary text-primary-foreground"
                        : "hover:text-foreground",
                    )}
                  >
                    {BAND_LABEL[b.key]}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((row) => (
              <tr key={row.label} className={row.strong ? "font-semibold" : undefined}>
                <th scope="row" className="px-4 py-1.5 text-left font-normal text-muted-foreground">
                  {row.label}
                </th>
                {bands.map((b) => (
                  <td key={b.key} className="px-4 py-1.5 text-right tabular-nums">
                    {row.value(figures.get(b.key)!)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

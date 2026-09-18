"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { CompositeBand, CompositeBandKey, CompositeBuild } from "@/types";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useInternalQuotes } from "@/features/internal/use-composite";
import { usePersonaKey } from "@/features/session/use-session";
import { api, errorMessage, queryKeys } from "@/lib/api";
import { BAND_LABEL, bandFigures, bandMinQty, formatCost } from "@/lib/composite/pricing";
import { formatDate, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { marginTone, NumberField } from "./composite-parts";

/**
 * Adds the build to a customer quote as one line: the composite name,
 * description and the chosen band's price. The BOM travels with the line
 * for Brewfitt only (decision 14).
 */
export function AddToQuoteSheet({
  open,
  onOpenChange,
  build,
  bands,
  onAdded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  build: CompositeBuild;
  bands: CompositeBand[];
  onAdded: (build: CompositeBuild) => void;
}) {
  const router = useRouter();
  const key = usePersonaKey();
  const queryClient = useQueryClient();
  const quotes = useInternalQuotes();
  const priced = bands.filter((b) => b.sellPrice > 0 && b.lines.length > 0);
  const [bandKey, setBandKey] = useState<CompositeBandKey | null>(null);
  const [qty, setQty] = useState(1);
  const [quoteId, setQuoteId] = useState<string | null>(null);

  const chosen = priced.find((b) => b.key === bandKey) ?? priced[0] ?? null;
  const min = chosen ? bandMinQty(chosen.key) : 1;

  useEffect(() => {
    if (!open) return;
    const first = priced[0] ?? null;
    setBandKey(first?.key ?? null);
    setQty(first ? bandMinQty(first.key) : 1);
    setQuoteId(null);
    // Reset each time the sheet opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const openQuotes = useMemo(
    () => (quotes.data ?? []).filter((q) => q.accountId === build.accountId && q.status === "sent"),
    [quotes.data, build.accountId],
  );

  const add = useMutation({
    mutationFn: () =>
      api.internal.addCompositeToQuote(build.id, { bandKey: chosen!.key, qty, quoteId }),
    onSuccess: ({ build: saved, quote }) => {
      onAdded(saved);
      for (const k of [queryKeys.compositeBuilds(key), queryKeys.internalQuotes(key)])
        void queryClient.invalidateQueries({ queryKey: k });
      onOpenChange(false);
      toast.success(
        quoteId ? `Added to ${quote.number}` : `Quote ${quote.number} sent to the customer`,
        {
          description: `${qty} × ${build.name} at ${formatCost(chosen!.sellPrice)}${chosen!.carriage ? `, plus delivery ${formatCost(chosen!.carriage * qty)}` : ""}`,
          action: {
            label: "View quote",
            onClick: () => router.push(`/internal/quotes/view?id=${quote.id}`),
          },
        },
      );
    },
    onError: (error) =>
      toast.error("The composite could not be added to the quote", {
        description: errorMessage(error),
      }),
  });

  const f = chosen ? bandFigures(chosen, build) : null;
  const unit = chosen ? chosen.sellPrice : 0;
  const delivery = chosen ? chosen.carriage * qty : 0;
  const tooFew = qty < min;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Add to quote</SheetTitle>
          <SheetDescription>
            One line for {build.name} at the band price, plus a Delivery line when the band has
            carriage. The customer sees the name, description and price; the bill of materials stays
            internal.
          </SheetDescription>
        </SheetHeader>

        {priced.length === 0 ? (
          <p className="px-4 text-sm text-muted-foreground">
            Price at least one band (lines and a sell price) before adding the build to a quote.
          </p>
        ) : (
          <div className="space-y-5 px-4">
            <fieldset>
              <legend className="mb-2 text-sm font-medium">Band</legend>
              <div className="grid grid-cols-1 gap-2">
                {priced.map((b) => {
                  const bf = bandFigures(b, build);
                  const selected = chosen?.key === b.key;
                  return (
                    <label
                      key={b.key}
                      className={cn(
                        "flex cursor-pointer items-center justify-between gap-3 rounded-xl border p-3 text-sm has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/40",
                        selected && "border-primary bg-brand-subtle/50",
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="band"
                          className="accent-primary"
                          checked={selected}
                          onChange={() => {
                            setBandKey(b.key);
                            setQty((q) => Math.max(q, bandMinQty(b.key)));
                          }}
                        />
                        <span className="font-medium">{BAND_LABEL[b.key]}</span>
                      </span>
                      <span className="text-right tabular-nums">
                        {formatCost(b.sellPrice)}
                        <span className={cn("block text-xs", marginTone(bf.marginPercent))}>
                          {bf.marginPercent.toFixed(2)}% margin
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <div className="space-y-1.5">
              <Label htmlFor="quote-qty">Quantity</Label>
              <NumberField
                id="quote-qty"
                value={qty}
                decimals={0}
                trim
                integer
                onValue={(v) => v > 0 && setQty(v)}
                className="w-28 border-input text-left"
                aria-invalid={tooFew}
                aria-describedby="quote-qty-hint"
              />
              <p
                id="quote-qty-hint"
                className={cn("text-xs", tooFew ? "text-danger" : "text-muted-foreground")}
              >
                {chosen && chosen.key !== "base"
                  ? `The ${BAND_LABEL[chosen.key]} price needs ${min} or more.`
                  : "Any quantity at the base price."}
              </p>
            </div>

            <fieldset>
              <legend className="mb-2 text-sm font-medium">Quote</legend>
              <div className="space-y-2 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="quote"
                    className="accent-primary"
                    checked={quoteId === null}
                    onChange={() => setQuoteId(null)}
                  />
                  New quote, sent to the customer ready to accept
                </label>
                {openQuotes.map((q) => (
                  <label key={q.id} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="quote"
                      className="accent-primary"
                      checked={quoteId === q.id}
                      onChange={() => setQuoteId(q.id)}
                    />
                    <span>
                      Add to <span className="font-mono">{q.number}</span>
                      <span className="text-muted-foreground">
                        {" "}
                        · {formatMoney(q.total)} · valid to {formatDate(q.validUntil)}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            {f && chosen ? (
              <div className="rounded-xl bg-muted/50 p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Unit price</span>
                  <span className="tabular-nums">{formatCost(unit)}</span>
                </div>
                <div className="mt-1 flex justify-between">
                  <span className="text-muted-foreground">Composite line</span>
                  <span className="tabular-nums">{formatCost(unit * qty)}</span>
                </div>
                {delivery ? (
                  <div className="mt-1 flex justify-between">
                    <span className="text-muted-foreground">
                      Delivery line ({formatCost(chosen.carriage)} carriage each)
                    </span>
                    <span className="tabular-nums">{formatCost(delivery)}</span>
                  </div>
                ) : null}
                <div className="mt-1 flex justify-between font-semibold">
                  <span>Added to the quote, before VAT</span>
                  <span className="tabular-nums">{formatCost(unit * qty + delivery)}</span>
                </div>
                <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                  <span>Gross profit on the line</span>
                  <span className="tabular-nums">{formatCost(f.grossProfit * qty)}</span>
                </div>
              </div>
            ) : null}
            <p className="text-xs text-muted-foreground">
              Quotes are read-only here once sent: see them under{" "}
              <Link href="/internal/quotes" className="underline">
                Quotes
              </Link>
              .
            </p>
          </div>
        )}

        <SheetFooter>
          <Button onClick={() => add.mutate()} disabled={!chosen || tooFew || add.isPending}>
            {add.isPending ? "Adding" : quoteId ? "Add to quote" : "Create and send quote"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

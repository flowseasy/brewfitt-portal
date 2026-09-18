"use client";

import { Fragment, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeftIcon, LockSimpleIcon } from "@phosphor-icons/react";
import { marginTone } from "@/components/internal/composite-parts";
import { TotalsList } from "@/components/quotes/quote-parts";
import { PageHeader } from "@/components/shared/page-header";
import { ErrorState, LoadingState, RecordIdGate } from "@/components/shared/states";
import { StatusPill } from "@/components/shared/status-pill";
import { usePersonaKey } from "@/features/session/use-session";
import { api, queryKeys } from "@/lib/api";
import { BAND_LABEL, formatCost, formatForeign, lineUnitGbp } from "@/lib/composite/pricing";
import { formatDate, formatMoney } from "@/lib/format";
import { QUOTE_STATUS } from "@/lib/status";

/** Brewfitt staff (decision 14): one quote, read-only, with each composite's BOM. */
export default function InternalQuoteViewPage() {
  return (
    <Suspense fallback={<LoadingState rows={5} />}>
      <RecordIdGate backHref="/internal/quotes" backLabel="Back to quotes">
        <QuoteView />
      </RecordIdGate>
    </Suspense>
  );
}

function QuoteView() {
  const id = useSearchParams().get("id") ?? "";
  const key = usePersonaKey();
  const quote = useQuery({
    queryKey: queryKeys.internalQuote(key, id),
    queryFn: () => api.internal.quote(id),
  });

  const back = (
    <Link
      href="/internal/quotes"
      className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeftIcon className="size-4" aria-hidden />
      Quotes
    </Link>
  );

  if (quote.isPending) return <LoadingState rows={5} label="Loading quote" />;
  if (quote.isError)
    return (
      <div>
        {back}
        <ErrorState error={quote.error} onRetry={() => quote.refetch()} />
      </div>
    );

  const q = quote.data;
  const status = QUOTE_STATUS[q.status];
  return (
    <div>
      {back}
      <PageHeader
        title={`Quote ${q.number}`}
        eyebrow={q.accountName}
        description={`Issued ${formatDate(q.createdAt)} · valid until ${formatDate(q.validUntil)}`}
        actions={
          <>
            <StatusPill tone={status.tone}>{status.label}</StatusPill>
            <span className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm text-muted-foreground">
              <LockSimpleIcon className="size-4" aria-hidden />
              Read-only
            </span>
          </>
        }
      />

      <div className="relative overflow-x-auto rounded-2xl border bg-card">
        <table className="w-full min-w-[640px] text-sm">
          <caption className="sr-only">
            Quote lines, with the internal bill of materials for composites
          </caption>
          <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-2.5 font-medium">
                Line
              </th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">
                Qty
              </th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">
                Unit price
              </th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium">
                Total
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {q.lines.map((l, i) => (
              <Fragment key={i}>
                <tr className="align-top">
                  <td className="px-4 py-3">
                    <span className="font-medium">{l.description}</span>
                    {l.detail ? (
                      <span className="block text-sm text-muted-foreground">{l.detail}</span>
                    ) : null}
                    {l.internal ? (
                      <span className="mt-1 block text-xs">
                        <span className="rounded bg-warning-subtle px-1.5 py-0.5 text-warning">
                          Composite
                        </span>{" "}
                        <Link
                          href={`/internal/configurator/build?id=${l.internal.buildId}`}
                          className="font-mono hover:underline"
                        >
                          {l.internal.buildNumber}
                        </Link>
                        <span className="text-muted-foreground">
                          {" "}
                          · {BAND_LABEL[l.internal.bandKey]} band · cost{" "}
                          {formatCost(l.internal.unitCost)} ·{" "}
                        </span>
                        <span className={marginTone(l.internal.marginPercent)}>
                          {l.internal.marginPercent.toFixed(2)}% margin
                        </span>
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">{l.qty}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{formatMoney(l.unitPrice)}</td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums">
                    {formatMoney(l.lineTotal)}
                  </td>
                </tr>
                {l.internal ? (
                  <tr>
                    <td colSpan={4} className="bg-muted/30 px-4 pt-1 pb-3">
                      <p className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                        Bill of materials, Brewfitt only
                      </p>
                      <table className="w-full text-xs">
                        <thead className="text-left text-muted-foreground">
                          <tr>
                            <th scope="col" className="py-1 pr-2 font-medium">
                              Code
                            </th>
                            <th scope="col" className="py-1 pr-2 font-medium">
                              Description
                            </th>
                            <th scope="col" className="py-1 pr-2 text-right font-medium">
                              FX cost
                            </th>
                            <th scope="col" className="py-1 pr-2 text-right font-medium">
                              £ cost
                            </th>
                            <th scope="col" className="py-1 text-right font-medium">
                              Qty
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {l.internal.bom.map((b) => (
                            <tr key={b.id} className="align-top">
                              <td className="py-1 pr-2 font-mono">{b.code}</td>
                              <td className="py-1 pr-2">
                                {b.description}
                                {b.misc?.buyingDescription ? (
                                  <span className="block text-muted-foreground">
                                    {b.misc.buyingDescription}
                                    {b.misc.supplierQuoteRef
                                      ? ` · ref ${b.misc.supplierQuoteRef}`
                                      : ""}
                                  </span>
                                ) : null}
                              </td>
                              <td className="py-1 pr-2 text-right tabular-nums">
                                {b.currency === "GBP" ? "–" : formatForeign(b.unitCost, b.currency)}
                              </td>
                              <td className="py-1 pr-2 text-right tabular-nums">
                                {formatCost(lineUnitGbp(b, l.internal!.fxRates))}
                              </td>
                              <td className="py-1 text-right tabular-nums">{b.qty}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 ml-auto max-w-xs rounded-2xl border bg-card p-4">
        <TotalsList subtotal={q.subtotal} vat={q.vat} total={q.total} />
      </div>
      <p className="mt-4 text-sm text-muted-foreground">
        The customer sees each composite as one line with its name, description and price. The bill
        of materials is never shown to them.
      </p>
    </div>
  );
}

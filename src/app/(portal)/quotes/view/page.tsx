"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { z } from "zod";
import {
  ArrowLeftIcon,
  CheckCircleIcon,
  ChatsCircleIcon,
  FadersHorizontalIcon,
  FilePdfIcon,
  FileTextIcon,
  PackageIcon,
  PaperPlaneTiltIcon,
  XCircleIcon,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { AIInsightCard } from "@/components/ai/ai-insight-card";
import { TextareaField } from "@/components/forms/fields";
import { ThreadView } from "@/components/messages/thread-view";
import { LinesTable, QuoteDocument, TotalsList } from "@/components/quotes/quote-parts";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { PageHeader } from "@/components/shared/page-header";
import { PdfPreview } from "@/components/shared/pdf-preview";
import { EmptyState, ErrorState, LoadingState, RecordIdGate } from "@/components/shared/states";
import { StatusPill } from "@/components/shared/status-pill";
import { TeamMemberCard } from "@/components/shared/team-member-card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FieldError } from "@/components/ui/field";
import { useIsSupplier, usePersonaKey } from "@/features/session/use-session";
import { api, errorMessage, queryKeys } from "@/lib/api";
import { daysFromToday, formatDate, formatMoney, formatRelativeDay, plural } from "@/lib/format";
import { hrefFor } from "@/lib/links";
import { QUOTE_STATUS, RFQ_STATUS } from "@/lib/status";
import type { Quote, RfqWithResponse } from "@/types";

export default function QuoteViewPage() {
  return (
    <Suspense fallback={<LoadingState rows={5} />}>
      <RecordIdGate backHref="/quotes" backLabel="Back to quotes">
        <QuoteView />
      </RecordIdGate>
    </Suspense>
  );
}

function QuoteView() {
  const id = useSearchParams().get("id") ?? "";
  return useIsSupplier() ? <RfqDetail id={id} /> : <QuoteDetail id={id} />;
}

function BackLink({ label }: { label: string }) {
  return (
    <Link
      href="/quotes"
      className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeftIcon className="size-4" aria-hidden />
      {label}
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Customer quote
// ---------------------------------------------------------------------------

const DeclineForm = z.object({
  reason: z.string().trim().min(3, "Tell Brewfitt why, so they can revise the quote"),
});

function QuoteDetail({ id }: { id: string }) {
  const key = usePersonaKey();
  const queryClient = useQueryClient();
  const quote = useQuery({
    queryKey: queryKeys.quote(key, id),
    queryFn: () => api.quotes.get(id),
    enabled: !!id,
  });
  const me = useQuery({ queryKey: queryKeys.me(key), queryFn: () => api.session.me() });
  const priceList = useQuery({
    queryKey: queryKeys.priceList(key),
    queryFn: () => api.priceList.get(),
  });
  const addresses = useQuery({
    queryKey: queryKeys.addresses(key),
    queryFn: () => api.account.addresses(),
  });
  const configurations = useQuery({
    queryKey: queryKeys.configurations(key),
    queryFn: () => api.configurator.list(),
  });
  const insights = useQuery({
    queryKey: queryKeys.insights(key),
    queryFn: () => api.ai.insights(),
  });
  const [pdfOpen, setPdfOpen] = useState(useSearchParams().get("pdf") === "1");
  const [acceptOpen, setAcceptOpen] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);

  const products = useMemo(
    () => new Map((priceList.data?.lines ?? []).map((l) => [l.productId, l.product])),
    [priceList.data],
  );
  const refresh = () => {
    for (const k of [
      queryKeys.quote(key, id),
      queryKeys.quotes(key),
      queryKeys.salesOrders(key),
      queryKeys.insights(key),
      queryKeys.thread(key, quote.data?.threadId ?? ""),
      queryKeys.threads(key),
      queryKeys.notifications(key),
    ])
      void queryClient.invalidateQueries({ queryKey: k });
  };

  const accept = useMutation({
    mutationFn: () => api.quotes.accept(id),
    onSuccess: ({ salesOrder }) => {
      setAcceptOpen(false);
      refresh();
      toast.success(`Quote accepted. Order ${salesOrder.number} is confirmed.`, {
        description: "Brewfitt will confirm the delivery date.",
      });
    },
    onError: (error) =>
      toast.error("The quote could not be accepted", { description: errorMessage(error) }),
  });

  const declineForm = useForm<z.infer<typeof DeclineForm>>({
    resolver: zodResolver(DeclineForm),
    defaultValues: { reason: "" },
  });
  const decline = useMutation({
    mutationFn: (reason: string) => api.quotes.decline(id, { reason }),
    onSuccess: () => {
      setDeclineOpen(false);
      refresh();
      toast.success("Quote declined", { description: "Your account manager has your reason." });
    },
    onError: (error) =>
      toast.error("The quote could not be declined", { description: errorMessage(error) }),
  });

  if (quote.isPending) return <LoadingState rows={5} label="Loading quote" />;
  if (quote.isError) {
    return (
      <div>
        <BackLink label="Quotes" />
        <ErrorState error={quote.error} onRetry={() => quote.refetch()} />
      </div>
    );
  }

  const q: Quote = quote.data;
  const s = QUOTE_STATUS[q.status];
  const days = daysFromToday(q.validUntil);
  const config = configurations.data?.find((c) => c.id === q.configurationId);
  const account = me.data?.account;
  const billing = addresses.data?.find((a) => a.id === account?.billingAddressId);
  const followUp = insights.data?.find(
    (i) => i.category === "quote-follow-up" && i.relatedId === q.id,
  );
  const manager = me.data?.brewfittTeam.find((t) => t.role === "account-manager");

  return (
    <div>
      <BackLink label="Quotes" />
      <PageHeader
        eyebrow="Quote"
        title={
          <span className="flex flex-wrap items-center gap-3">
            {q.number}
            <StatusPill tone={s.tone}>{s.label}</StatusPill>
          </span>
        }
        description={
          q.status === "sent"
            ? `${formatMoney(q.total)} including VAT. Valid until ${formatDate(q.validUntil)}${days <= 14 ? ` (${days === 0 ? "expires today" : `expires ${formatRelativeDay(q.validUntil)}`})` : ""}.`
            : q.status === "draft"
              ? `Requested ${formatDate(q.createdAt)}. Brewfitt is preparing the quote.`
              : `Raised ${formatDate(q.createdAt)}.`
        }
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => setPdfOpen(true)}
              disabled={q.status === "draft"}
            >
              <FilePdfIcon aria-hidden />
              PDF
            </Button>
            {q.status === "sent" ? (
              <>
                <Button variant="outline" onClick={() => setDeclineOpen(true)}>
                  <XCircleIcon aria-hidden />
                  Decline
                </Button>
                <Button onClick={() => setAcceptOpen(true)}>
                  <CheckCircleIcon aria-hidden />
                  Accept quote
                </Button>
              </>
            ) : null}
          </>
        }
      />

      {q.status === "accepted" && q.salesOrderId ? (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-success/30 bg-success-subtle p-4"
        >
          <PackageIcon className="size-5 text-success" aria-hidden />
          <p className="flex-1 text-sm">
            This quote was accepted on {formatDate(q.updatedAt)} and is now an order.
          </p>
          <Button asChild size="sm">
            <Link href={hrefFor("sales-order", q.salesOrderId)}>View order</Link>
          </Button>
        </motion.div>
      ) : null}
      {q.status === "declined" ? (
        <div className="mb-5 rounded-2xl border bg-muted/50 p-4 text-sm">
          <p className="font-medium">Declined on {formatDate(q.updatedAt)}</p>
          {q.declineReason ? <p className="mt-1 text-muted-foreground">{q.declineReason}</p> : null}
        </div>
      ) : null}
      {q.status === "expired" ? (
        <div className="mb-5 rounded-2xl border border-warning/30 bg-warning-subtle p-4 text-sm">
          This quote expired on {formatDate(q.validUntil)}. Ask Brewfitt below to reissue it at
          current prices.
        </div>
      ) : null}
      {q.status === "draft" ? (
        <div className="mb-5 rounded-2xl border border-info/30 bg-info-subtle p-4 text-sm">
          Brewfitt is checking installation and availability. You will be notified when the quote is
          ready to accept; prices below are from your price list.
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-6">
          {followUp ? <AIInsightCard insight={followUp} /> : null}
          <section aria-labelledby="lines">
            <h2 id="lines" className="mb-3 font-medium">
              {plural(q.lines.length, "line")}
            </h2>
            <LinesTable lines={q.lines} products={products} />
          </section>
          <section aria-labelledby="conversation" className="rounded-2xl border bg-card p-4 sm:p-5">
            <h2 id="conversation" className="mb-4 flex items-center gap-2 font-medium">
              <ChatsCircleIcon className="size-5 text-primary" aria-hidden />
              Questions about this quote
            </h2>
            <ThreadView threadId={q.threadId} compact />
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <section aria-label="Totals" className="rounded-2xl border bg-card p-5">
            <TotalsList subtotal={q.subtotal} vat={q.vat} total={q.total} />
            {q.status === "sent" ? (
              <Button
                className="mt-4 w-full rounded-full"
                size="lg"
                onClick={() => setAcceptOpen(true)}
              >
                Accept and place order
              </Button>
            ) : null}
          </section>
          {config ? (
            <Link
              href={`/configurator/build?id=${config.id}`}
              className="flex items-center gap-3 rounded-2xl border bg-card p-4 hover:border-primary/40"
            >
              <FadersHorizontalIcon className="size-5 text-primary" aria-hidden />
              <span className="min-w-0">
                <span className="block text-xs text-muted-foreground">From configuration</span>
                <span className="block truncate font-medium">{config.name}</span>
              </span>
            </Link>
          ) : null}
          {manager ? (
            <section aria-label="Your account manager" className="rounded-2xl border bg-card p-4">
              <p className="mb-3 text-xs text-muted-foreground">Your account manager</p>
              <TeamMemberCard member={manager} compact />
            </section>
          ) : null}
        </aside>
      </div>

      {account ? (
        <PdfPreview open={pdfOpen} onOpenChange={setPdfOpen} title={`Quote ${q.number}`}>
          <QuoteDocument
            quote={q}
            account={me.data?.group?.account ?? account}
            billing={billing}
            products={products}
          />
        </PdfPreview>
      ) : null}

      <ConfirmDialog
        open={acceptOpen}
        onOpenChange={setAcceptOpen}
        title={`Accept quote ${q.number}?`}
        description={`This places an order for ${plural(q.lines.length, "line")} totalling ${formatMoney(q.total)} including VAT. Brewfitt confirms the delivery date and any installation.`}
        confirmLabel="Accept and place order"
        pending={accept.isPending}
        onConfirm={() => accept.mutate()}
      />

      <Dialog open={declineOpen} onOpenChange={setDeclineOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Decline quote {q.number}</DialogTitle>
            <DialogDescription>
              Your reason goes to your account manager so they can revise or close the quote.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={declineForm.handleSubmit((v) => decline.mutate(v.reason))} noValidate>
            <TextareaField
              control={declineForm.control}
              name="reason"
              label="Reason"
              rows={4}
              placeholder="For example: the refit has moved to next year"
            />
            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={() => setDeclineOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="destructive" disabled={decline.isPending}>
                {decline.isPending ? "Declining…" : "Decline quote"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Supplier request for quotation
// ---------------------------------------------------------------------------

const ResponseForm = z.object({
  lines: z.array(
    z.object({
      productId: z.string(),
      price: z
        .string()
        .trim()
        .regex(/^\d+(\.\d{1,2})?$/, "Enter a unit price, for example 42.50")
        .refine((v) => Number(v) > 0, "The price must be more than zero"),
      leadTimeDays: z
        .string()
        .trim()
        .regex(/^\d{1,3}$/, "Enter the lead time in working days"),
    }),
  ),
  notes: z.string().trim().max(500).nullable(),
});
type ResponseValues = z.infer<typeof ResponseForm>;

function RfqDetail({ id }: { id: string }) {
  const key = usePersonaKey();
  const queryClient = useQueryClient();
  const rfqs = useQuery({ queryKey: queryKeys.rfqs(key), queryFn: () => api.quotes.rfqs() });
  const products = useQuery({
    queryKey: queryKeys.products(key),
    queryFn: () => api.products.list(),
  });
  const priceList = useQuery({
    queryKey: queryKeys.priceList(key),
    queryFn: () => api.priceList.get(),
  });
  const rfq: RfqWithResponse | undefined = rfqs.data?.find((r) => r.id === id);
  const product = useMemo(
    () => new Map((products.data ?? []).map((p) => [p.id, p])),
    [products.data],
  );
  const agreed = useMemo(
    () => new Map((priceList.data?.lines ?? []).map((l) => [l.productId, l.price])),
    [priceList.data],
  );

  const form = useForm<ResponseValues>({
    resolver: zodResolver(ResponseForm),
    values: {
      lines: (rfq?.lines ?? []).map((l) => ({
        productId: l.productId,
        price: agreed.get(l.productId) ? (agreed.get(l.productId)!.amount / 100).toFixed(2) : "",
        leadTimeDays: String(product.get(l.productId)?.leadTimeDays ?? ""),
      })),
      notes: null,
    },
    resetOptions: { keepDirtyValues: true },
  });
  const { fields } = useFieldArray({ control: form.control, name: "lines" });

  const respond = useMutation({
    mutationFn: (v: ResponseValues) =>
      api.quotes.respondToRfq(id, {
        lines: v.lines.map((l) => ({
          productId: l.productId,
          price: { amount: Math.round(Number(l.price) * 100), currency: "GBP" },
          leadTimeDays: Number(l.leadTimeDays),
        })),
        notes: v.notes || null,
      }),
    onSuccess: () => {
      for (const k of [
        queryKeys.rfqs(key),
        queryKeys.thread(key, rfq?.threadId ?? ""),
        queryKeys.threads(key),
      ])
        void queryClient.invalidateQueries({ queryKey: k });
      toast.success(`Quote sent for ${rfq?.number}`, {
        description: "Brewfitt's buyer will be in touch if anything needs clarifying.",
      });
    },
    onError: (error) =>
      toast.error("Your response was not sent", { description: errorMessage(error) }),
  });

  if (rfqs.isPending || products.isPending)
    return <LoadingState rows={5} label="Loading request for quotation" />;
  if (rfqs.isError) return <ErrorState error={rfqs.error} onRetry={() => rfqs.refetch()} />;
  if (!rfq) {
    return (
      <div>
        <BackLink label="RFQs and quotes" />
        <EmptyState
          icon={FileTextIcon}
          title="This request could not be found"
          description="It may have been withdrawn, or it belongs to another supplier."
        />
      </div>
    );
  }
  const s = RFQ_STATUS[rfq.status];
  const days = daysFromToday(rfq.deadline);
  const total = form
    .watch("lines")
    .reduce((sum, l, i) => sum + (Number(l.price) || 0) * (rfq.lines[i]?.qty ?? 0), 0);

  return (
    <div>
      <BackLink label="RFQs and quotes" />
      <PageHeader
        eyebrow="Request for quotation"
        title={
          <span className="flex flex-wrap items-center gap-3">
            {rfq.number}
            <StatusPill tone={s.tone}>{s.label}</StatusPill>
          </span>
        }
        description={
          rfq.status === "open"
            ? `Respond by ${formatDate(rfq.deadline)} (${days < 0 ? "deadline passed" : formatRelativeDay(rfq.deadline)}).`
            : `Raised ${formatDate(rfq.createdAt)}.`
        }
      />
      {rfq.notes ? (
        <p className="mb-5 rounded-2xl border bg-card p-4 text-sm">{rfq.notes}</p>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-6">
          {rfq.status === "open" ? (
            <form
              onSubmit={form.handleSubmit((v) => respond.mutate(v))}
              noValidate
              className="rounded-2xl border bg-card p-4 sm:p-5"
            >
              <h2 className="mb-1 font-medium">Your quote</h2>
              <p className="mb-4 text-sm text-muted-foreground">
                Prices are per unit, excluding VAT. Your current agreed cost is filled in to start
                from.
              </p>
              <ol className="space-y-3">
                {fields.map((f, i) => {
                  const line = rfq.lines[i]!;
                  const p = product.get(line.productId);
                  return (
                    <li key={f.id} className="rounded-xl border bg-background p-3">
                      <p className="font-medium">{p?.name ?? line.productId}</p>
                      <p className="text-xs text-muted-foreground">
                        <span className="font-mono">{p?.sku}</span> · {line.qty} required by{" "}
                        {formatDate(line.requiredBy)}
                      </p>
                      <div className="mt-3 grid grid-cols-2 gap-3">
                        <Controller
                          control={form.control}
                          name={`lines.${i}.price`}
                          render={({ field, fieldState }) => (
                            <div>
                              <label htmlFor={`price-${i}`} className="text-sm font-medium">
                                Unit price (£)
                              </label>
                              <input
                                id={`price-${i}`}
                                {...field}
                                inputMode="decimal"
                                aria-invalid={fieldState.invalid || undefined}
                                className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-base tabular-nums outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 aria-invalid:border-destructive sm:text-sm"
                              />
                              <FieldError errors={[fieldState.error]} />
                            </div>
                          )}
                        />
                        <Controller
                          control={form.control}
                          name={`lines.${i}.leadTimeDays`}
                          render={({ field, fieldState }) => (
                            <div>
                              <label htmlFor={`lead-${i}`} className="text-sm font-medium">
                                Lead time (working days)
                              </label>
                              <input
                                id={`lead-${i}`}
                                {...field}
                                inputMode="numeric"
                                aria-invalid={fieldState.invalid || undefined}
                                className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-base tabular-nums outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 aria-invalid:border-destructive sm:text-sm"
                              />
                              <FieldError errors={[fieldState.error]} />
                            </div>
                          )}
                        />
                      </div>
                    </li>
                  );
                })}
              </ol>
              <div className="mt-4">
                <TextareaField
                  control={form.control}
                  name="notes"
                  label="Notes for Brewfitt (optional)"
                  nullable
                  rows={3}
                  placeholder="Price breaks, delivery arrangements or how long the price holds"
                />
              </div>
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
                <p className="text-sm">
                  <span className="text-muted-foreground">Quote value </span>
                  <span className="font-semibold tabular-nums">
                    {formatMoney({ amount: Math.round(total * 100), currency: "GBP" })}
                  </span>
                  <span className="text-muted-foreground"> ex VAT</span>
                </p>
                <Button
                  type="submit"
                  disabled={respond.isPending || days < 0}
                  className="rounded-full"
                >
                  <PaperPlaneTiltIcon aria-hidden />
                  {respond.isPending ? "Sending…" : "Send quote to Brewfitt"}
                </Button>
              </div>
            </form>
          ) : (
            <section aria-labelledby="request" className="space-y-4">
              <h2 id="request" className="font-medium">
                {rfq.response ? "Your response" : "Requested items"}
              </h2>
              <LinesTable
                linkProducts={false}
                lines={rfq.lines.map((l) => {
                  const r = rfq.response?.lines.find((x) => x.productId === l.productId);
                  const unit = r?.price ?? { amount: 0, currency: "GBP" as const };
                  return {
                    productId: l.productId,
                    description: product.get(l.productId)?.name ?? l.productId,
                    qty: l.qty,
                    unitPrice: unit,
                    lineTotal: { amount: unit.amount * l.qty, currency: "GBP" },
                    extra: r
                      ? `${r.leadTimeDays} day lead time`
                      : `required by ${formatDate(l.requiredBy)}`,
                  };
                })}
                products={product}
              />
              {rfq.response?.notes ? (
                <p className="rounded-xl bg-muted/60 p-3 text-sm">{rfq.response.notes}</p>
              ) : null}
              {rfq.response ? (
                <p className="text-sm text-muted-foreground">
                  Submitted {formatDate(rfq.response.submittedAt)}.
                </p>
              ) : null}
            </section>
          )}
        </div>
        <section
          aria-labelledby="rfq-conversation"
          className="rounded-2xl border bg-card p-4 sm:p-5 lg:self-start"
        >
          <h2 id="rfq-conversation" className="mb-4 flex items-center gap-2 font-medium">
            <ChatsCircleIcon className="size-5 text-primary" aria-hidden />
            Questions for the buyer
          </h2>
          <ThreadView threadId={rfq.threadId} compact />
        </section>
      </div>
    </div>
  );
}

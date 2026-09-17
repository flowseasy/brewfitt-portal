"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeftIcon,
  CalendarCheckIcon,
  CreditCardIcon,
  FilePdfIcon,
  PackageIcon,
  ReceiptIcon,
} from "@phosphor-icons/react";
import { formatAddress } from "@/components/account/addresses";
import { PayInvoiceDialog } from "@/components/finance/pay-invoice-dialog";
import { LinesTable, TotalsList } from "@/components/quotes/quote-parts";
import { PageHeader } from "@/components/shared/page-header";
import {
  DocumentFooter,
  DocumentHeader,
  DocumentParty,
  PdfPreview,
} from "@/components/shared/pdf-preview";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/states";
import { StatusPill } from "@/components/shared/status-pill";
import { Button } from "@/components/ui/button";
import { invoiceLines, splitVat } from "@/features/finance/invoice-lines";
import { useIsSupplier, useMe, usePersonaKey } from "@/features/session/use-session";
import { api, queryKeys } from "@/lib/api";
import { formatDate, formatDateTime, formatMoney, formatRelativeDay, plural } from "@/lib/format";
import { hrefFor } from "@/lib/links";
import { INVOICE_STATUS } from "@/lib/status";

export default function InvoiceViewPage() {
  return (
    <Suspense fallback={<LoadingState rows={5} />}>
      <InvoiceRouter />
    </Suspense>
  );
}

function InvoiceRouter() {
  const id = useSearchParams().get("id") ?? "";
  if (id.startsWith("pay_")) return <PaymentView id={id} />;
  if (id.startsWith("run_")) return <PaymentRunView id={id} />;
  return <InvoiceView id={id} />;
}

function Back({ supplier }: { supplier: boolean }) {
  return (
    <Link
      href="/invoices"
      className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeftIcon className="size-4" aria-hidden />
      {supplier ? "Payments" : "Invoices"}
    </Link>
  );
}

const KIND_LABEL = {
  invoice: "Invoice",
  "credit-note": "Credit note",
  "self-bill": "Self-billed invoice",
} as const;
const METHOD = {
  bacs: "Bank transfer",
  card: "Card",
  "direct-debit": "Direct Debit",
  "credit-allocation": "Credit applied",
} as const;

function InvoiceView({ id }: { id: string }) {
  const key = usePersonaKey();
  const supplier = useIsSupplier();
  const me = useMe();
  const invoice = useQuery({
    queryKey: queryKeys.invoice(key, id),
    queryFn: () => api.invoices.get(id),
    enabled: !!id,
  });
  const orders = useQuery({
    queryKey: queryKeys.salesOrders(key),
    queryFn: () => api.orders.salesOrders(),
    enabled: !supplier,
  });
  const pos = useQuery({
    queryKey: queryKeys.purchaseOrders(key),
    queryFn: () => api.orders.purchaseOrders(),
    enabled: supplier,
  });
  const deliveries = useQuery({
    queryKey: queryKeys.deliveries(key),
    queryFn: () => api.deliveries.list(),
  });
  const payments = useQuery({
    queryKey: queryKeys.payments(key),
    queryFn: () => api.invoices.payments(),
  });
  const priceList = useQuery({
    queryKey: queryKeys.priceList(key),
    queryFn: () => api.priceList.get(),
  });
  const addresses = useQuery({
    queryKey: queryKeys.addresses(key),
    queryFn: () => api.account.addresses(),
  });
  const [pdfOpen, setPdfOpen] = useState(useSearchParams().get("pdf") === "1");
  const [payOpen, setPayOpen] = useState(false);
  const products = useMemo(
    () => new Map((priceList.data?.lines ?? []).map((l) => [l.productId, l.product])),
    [priceList.data],
  );

  if (invoice.isPending) return <LoadingState rows={5} label="Loading invoice" />;
  if (invoice.isError) {
    return (
      <div>
        <Back supplier={supplier} />
        <ErrorState error={invoice.error} onRetry={() => invoice.refetch()} />
      </div>
    );
  }
  const inv = invoice.data;
  const order = supplier
    ? pos.data?.find((p) => p.id === inv.orderId)
    : orders.data?.find((o) => o.id === inv.orderId);
  const lines = invoiceLines(inv, order, deliveries.data ?? []);
  const { net, vat } = splitVat(inv.total, lines);
  const allocations = (payments.data ?? []).flatMap((p) =>
    p.allocatedTo
      .filter((a) => a.invoiceId === inv.id)
      .map((a) => ({ payment: p, amount: a.amount })),
  );
  const s = INVOICE_STATUS[inv.status];
  const canPay =
    !supplier &&
    me.data?.credit?.onAccount === false &&
    inv.kind === "invoice" &&
    inv.outstanding.amount > 0;
  const billing = addresses.data?.find((a) => a.id === me.data?.account.billingAddressId);
  const accountName = me.data?.group?.account.name ?? me.data?.account.name ?? "";

  return (
    <div>
      <Back supplier={supplier} />
      <PageHeader
        eyebrow={KIND_LABEL[inv.kind]}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {inv.number}
            <StatusPill tone={s.tone}>{s.label}</StatusPill>
          </span>
        }
        description={
          inv.kind === "credit-note"
            ? `Issued ${formatDate(inv.issuedAt)} · ${formatMoney(inv.total)} credit${inv.outstanding.amount ? `, ${formatMoney(inv.outstanding)} not yet allocated` : ", allocated"}`
            : `Issued ${formatDate(inv.issuedAt)} · due ${formatDate(inv.dueAt)}${inv.outstanding.amount > 0 ? ` (${formatRelativeDay(inv.dueAt)})` : ""}`
        }
        actions={
          <>
            <Button variant="outline" onClick={() => setPdfOpen(true)}>
              <FilePdfIcon aria-hidden />
              PDF
            </Button>
            {canPay ? (
              <Button onClick={() => setPayOpen(true)}>
                <CreditCardIcon aria-hidden />
                Pay {formatMoney(inv.outstanding)}
              </Button>
            ) : null}
          </>
        }
      />

      {inv.status === "overdue" && !supplier ? (
        <div
          role="status"
          className="mb-5 rounded-2xl border border-danger/30 bg-danger-subtle p-4 text-sm"
        >
          {formatMoney(inv.outstanding)} was due on {formatDate(inv.dueAt)}.{" "}
          {me.data?.credit?.onAccount
            ? "Please pay by bank transfer quoting the invoice number, or message credit control with any query."
            : "Pay by card to settle it."}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-6">
          <section aria-labelledby="inv-lines">
            <h2 id="inv-lines" className="mb-3 font-medium">
              {inv.kind === "credit-note" ? "Credited" : plural(lines.length, "line")}
            </h2>
            {lines.length ? (
              <LinesTable
                linkProducts={!supplier}
                products={products}
                lines={lines.map((l) => ({
                  productId: l.productId,
                  description: products.get(l.productId)?.name ?? "Item",
                  qty: l.qty,
                  unitPrice: l.unitPrice,
                  lineTotal: l.lineTotal,
                  extra: inv.kind === "credit-note" ? "returned" : undefined,
                }))}
              />
            ) : (
              <LoadingState rows={2} />
            )}
          </section>
          <section aria-labelledby="inv-payments" className="rounded-2xl border bg-card p-5">
            <h2 id="inv-payments" className="mb-3 font-medium">
              {supplier ? "Payment from Brewfitt" : "Payments and credits"}
            </h2>
            {allocations.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {inv.kind === "credit-note"
                  ? "Credit notes reduce your balance; see the statement."
                  : supplier
                    ? "Scheduled in a coming payment run."
                    : "No payments received yet."}
              </p>
            ) : (
              <ul className="divide-y">
                {allocations.map(({ payment, amount }) => (
                  <li
                    key={payment.id}
                    className="flex items-center justify-between gap-3 py-2 text-sm"
                  >
                    <Link href={hrefFor("payment", payment.id)} className="hover:underline">
                      {METHOD[payment.method]} · {payment.reference}
                      <span className="block text-xs text-muted-foreground">
                        {formatDate(payment.paidAt)}
                      </span>
                    </Link>
                    <span className="font-medium tabular-nums">{formatMoney(amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <section aria-label="Amounts" className="rounded-2xl border bg-card p-5">
            <TotalsList subtotal={net} vat={vat} total={inv.total} />
            <div className="mt-3 flex justify-between border-t pt-3 text-sm">
              <span className="text-muted-foreground">
                {inv.kind === "credit-note" ? "Unallocated" : "Outstanding"}
              </span>
              <span className="font-semibold tabular-nums">{formatMoney(inv.outstanding)}</span>
            </div>
            {canPay ? (
              <Button className="mt-4 w-full rounded-full" onClick={() => setPayOpen(true)}>
                Pay by card
              </Button>
            ) : null}
          </section>
          {order ? (
            <Link
              href={hrefFor(inv.orderType === "sales" ? "sales-order" : "purchase-order", order.id)}
              className="flex items-center gap-3 rounded-2xl border bg-card p-4 hover:border-primary/40"
            >
              <PackageIcon className="size-5 text-primary" aria-hidden />
              <span className="text-sm">
                <span className="block text-xs text-muted-foreground">
                  {inv.orderType === "sales" ? "For order" : "For purchase order"}
                </span>
                <span className="font-medium">{order.number}</span>
              </span>
            </Link>
          ) : null}
        </aside>
      </div>

      <PdfPreview
        open={pdfOpen}
        onOpenChange={setPdfOpen}
        title={`${KIND_LABEL[inv.kind]} ${inv.number}`}
      >
        <DocumentHeader
          kind={KIND_LABEL[inv.kind]}
          number={inv.number}
          date={inv.issuedAt}
          meta={[
            ...(inv.kind !== "credit-note" ? [{ label: "Due", value: formatDate(inv.dueAt) }] : []),
            ...(order ? [{ label: "Order", value: order.number }] : []),
          ]}
        />
        <div className="my-6 grid grid-cols-2 gap-6">
          <DocumentParty
            label={supplier ? "Supplier" : "Invoice to"}
            lines={[accountName, ...(billing ? formatAddress(billing) : [])]}
          />
          {inv.kind === "self-bill" ? (
            <DocumentParty
              label="Self-billing"
              lines={["Issued by Brewfitt Limited under the self-billing agreement."]}
            />
          ) : null}
        </div>
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-neutral-300 text-left text-neutral-500">
              <th className="py-1.5 font-medium">SKU</th>
              <th className="py-1.5 font-medium">Description</th>
              <th className="py-1.5 text-right font-medium">Qty</th>
              <th className="py-1.5 text-right font-medium">Unit</th>
              <th className="py-1.5 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i} className="border-b border-neutral-100">
                <td className="py-1.5 pr-2 font-mono">{products.get(l.productId)?.sku}</td>
                <td className="py-1.5 pr-2">{products.get(l.productId)?.name}</td>
                <td className="py-1.5 text-right">{l.qty}</td>
                <td className="py-1.5 text-right whitespace-nowrap">{formatMoney(l.unitPrice)}</td>
                <td className="py-1.5 text-right whitespace-nowrap">{formatMoney(l.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-4 ml-auto w-64 space-y-1 text-[12px]">
          <div className="flex justify-between">
            <span>Net</span>
            <span>{formatMoney(net)}</span>
          </div>
          <div className="flex justify-between">
            <span>VAT</span>
            <span>{formatMoney(vat)}</span>
          </div>
          <div className="flex justify-between border-t border-neutral-300 pt-1 text-sm font-semibold">
            <span>{inv.kind === "credit-note" ? "Credit" : "Total due"}</span>
            <span>{formatMoney(inv.total)}</span>
          </div>
        </div>
        <DocumentFooter
          note={
            inv.kind === "credit-note"
              ? "This credit is applied to your account."
              : `Payment due by ${formatDate(inv.dueAt)}.`
          }
        />
      </PdfPreview>

      {canPay ? <PayInvoiceDialog invoice={inv} open={payOpen} onOpenChange={setPayOpen} /> : null}
    </div>
  );
}

function PaymentView({ id }: { id: string }) {
  const key = usePersonaKey();
  const supplier = useIsSupplier();
  const payments = useQuery({
    queryKey: queryKeys.payments(key),
    queryFn: () => api.invoices.payments(),
  });
  const invoices = useQuery({
    queryKey: queryKeys.invoices(key),
    queryFn: () => api.invoices.list(),
  });
  const p = payments.data?.find((x) => x.id === id);
  const number = new Map((invoices.data ?? []).map((i) => [i.id, i.number]));

  if (payments.isPending) return <LoadingState rows={4} />;
  if (payments.isError)
    return <ErrorState error={payments.error} onRetry={() => payments.refetch()} />;
  if (!p) return <EmptyState icon={ReceiptIcon} title="This payment could not be found" />;

  return (
    <div>
      <Back supplier={supplier} />
      <PageHeader
        eyebrow={supplier ? "Remittance advice" : "Payment"}
        title={formatMoney(p.amount)}
        description={`${METHOD[p.method]} · ${formatDateTime(p.paidAt)} · ${p.reference}`}
      />
      <section className="rounded-2xl border bg-card p-5" aria-labelledby="alloc">
        <h2 id="alloc" className="mb-3 font-medium">
          Allocated to
        </h2>
        <ul className="divide-y">
          {p.allocatedTo.map((a) => (
            <li key={a.invoiceId} className="flex items-center justify-between py-2 text-sm">
              <Link href={hrefFor("invoice", a.invoiceId)} className="hover:underline">
                {number.get(a.invoiceId) ?? "Invoice"}
              </Link>
              <span className="font-medium tabular-nums">{formatMoney(a.amount)}</span>
            </li>
          ))}
        </ul>
        {p.remittanceDocumentId ? (
          <Link
            href={hrefFor("document", p.remittanceDocumentId)}
            className="mt-4 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm hover:border-primary/40"
          >
            <FilePdfIcon aria-hidden />
            Remittance advice
          </Link>
        ) : null}
      </section>
    </div>
  );
}

function PaymentRunView({ id }: { id: string }) {
  const key = usePersonaKey();
  const runs = useQuery({
    queryKey: queryKeys.paymentRuns(key),
    queryFn: () => api.invoices.paymentRuns(),
  });
  const invoices = useQuery({
    queryKey: queryKeys.invoices(key),
    queryFn: () => api.invoices.list(),
  });
  const run = runs.data?.find((r) => r.id === id);
  const byId = new Map((invoices.data ?? []).map((i) => [i.id, i]));

  if (runs.isPending) return <LoadingState rows={4} />;
  if (runs.isError) return <ErrorState error={runs.error} onRetry={() => runs.refetch()} />;
  if (!run)
    return <EmptyState icon={CalendarCheckIcon} title="This payment run could not be found" />;

  return (
    <div>
      <Back supplier />
      <PageHeader
        eyebrow="Payment run"
        title={
          <span className="flex flex-wrap items-center gap-3">
            {formatDate(run.scheduledFor)}
            <StatusPill tone={run.status === "paid" ? "success" : "info"}>
              {run.status === "paid" ? "Paid" : "Scheduled"}
            </StatusPill>
          </span>
        }
        description={`${formatMoney(run.total)} across ${plural(run.invoiceIds.length, "invoice")}. Brewfitt pays by bank transfer in fortnightly runs.`}
      />
      <ul className="space-y-2">
        {run.invoiceIds.map((invoiceId) => {
          const inv = byId.get(invoiceId);
          return (
            <li key={invoiceId}>
              <Link
                href={hrefFor("invoice", invoiceId)}
                className="flex items-center justify-between gap-3 rounded-2xl border bg-card p-4 hover:border-primary/40"
              >
                <span>
                  <span className="block font-medium">{inv?.number ?? "Invoice"}</span>
                  {inv ? (
                    <span className="block text-sm text-muted-foreground">
                      Due {formatDate(inv.dueAt)}
                    </span>
                  ) : null}
                </span>
                <span className="font-semibold tabular-nums">
                  {inv ? formatMoney(inv.total) : ""}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

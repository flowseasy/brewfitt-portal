"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarCheckIcon,
  CreditCardIcon,
  DownloadSimpleIcon,
  FilePdfIcon,
  ReceiptIcon,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { AgeingBar } from "@/components/finance/ageing-bar";
import { PayInvoiceDialog } from "@/components/finance/pay-invoice-dialog";
import { PageHeader } from "@/components/shared/page-header";
import {
  DocumentFooter,
  DocumentHeader,
  DocumentParty,
  PdfPreview,
} from "@/components/shared/pdf-preview";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/states";
import { StatusPill } from "@/components/shared/status-pill";
import { StatusTabs } from "@/components/shared/status-tabs";
import { Button } from "@/components/ui/button";
import { useIsSupplier, useMe, usePersonaKey } from "@/features/session/use-session";
import { api, queryKeys } from "@/lib/api";
import { downloadText } from "@/lib/download";
import { formatDate, formatMoney, formatRelativeDay, plural } from "@/lib/format";
import { hrefFor } from "@/lib/links";
import { INVOICE_STATUS } from "@/lib/status";
import { cn } from "@/lib/utils";
import type { Invoice, Statement } from "@/types";

export default function InvoicesPage() {
  return (
    <Suspense fallback={<LoadingState rows={5} />}>
      <Invoices />
    </Suspense>
  );
}

type Tab = "outstanding" | "paid" | "credits" | "statement" | "payments" | "runs";

const BAND_LABEL = {
  current: "Under 30 days",
  "30": "30 to 59 days",
  "60": "60 to 89 days",
  "90+": "90 days or more",
} as const;

function Invoices() {
  const supplier = useIsSupplier();
  const key = usePersonaKey();
  const params = useSearchParams();
  const me = useMe();
  const invoices = useQuery({
    queryKey: queryKeys.invoices(key),
    queryFn: () => api.invoices.list(),
  });
  const credits = useQuery({
    queryKey: queryKeys.creditNotes(key),
    queryFn: () => api.invoices.creditNotes(),
  });
  const statement = useQuery({
    queryKey: queryKeys.statement(key),
    queryFn: () => api.invoices.statement(),
  });
  const payments = useQuery({
    queryKey: queryKeys.payments(key),
    queryFn: () => api.invoices.payments(),
  });
  const runs = useQuery({
    queryKey: queryKeys.paymentRuns(key),
    queryFn: () => api.invoices.paymentRuns(),
    enabled: supplier,
  });
  const [tab, setTab] = useState<Tab>(params.get("tab") === "runs" ? "runs" : "outstanding");
  const [paying, setPaying] = useState<Invoice | null>(null);

  const all = useMemo(() => invoices.data ?? [], [invoices.data]);
  const outstanding = all
    .filter((i) => i.outstanding.amount > 0)
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  const paid = all.filter((i) => i.outstanding.amount === 0);
  const canPayByCard = !supplier && me.data?.credit?.onAccount === false;
  const invoiceNumber = useMemo(
    () => new Map([...all, ...(credits.data ?? [])].map((i) => [i.id, i.number])),
    [all, credits.data],
  );

  const tabs: { value: Tab; label: string; count: number }[] = supplier
    ? [
        { value: "outstanding", label: "Owed to you", count: outstanding.length },
        { value: "runs", label: "Payment runs", count: runs.data?.length ?? 0 },
        { value: "payments", label: "Remittances", count: payments.data?.length ?? 0 },
        { value: "paid", label: "Paid", count: paid.length },
        { value: "statement", label: "Statement", count: statement.data?.lines.length ?? 0 },
      ]
    : [
        { value: "outstanding", label: "Outstanding", count: outstanding.length },
        { value: "paid", label: "Paid", count: paid.length },
        { value: "credits", label: "Credit notes", count: credits.data?.length ?? 0 },
        {
          value: "payments",
          label: "Payments",
          count: (payments.data ?? []).filter((p) => p.method !== "credit-allocation").length,
        },
        { value: "statement", label: "Statement", count: statement.data?.lines.length ?? 0 },
      ];

  return (
    <div>
      <PageHeader
        title={supplier ? "Payments" : "Invoices"}
        description={
          supplier
            ? "What Brewfitt owes you, self-billed and supplier invoices, payment runs and remittance advices."
            : canPayByCard
              ? "Your invoices and statement. Pay open invoices by card."
              : "Your invoices, credit notes, payments and statement."
        }
      />

      <section
        aria-label="Summary"
        className="mb-6 grid grid-cols-1 gap-4 rounded-2xl border bg-card p-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]"
      >
        {statement.isPending ? (
          <LoadingState rows={1} />
        ) : statement.isError ? (
          <ErrorState error={statement.error} onRetry={() => statement.refetch()} />
        ) : (
          <>
            <dl className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-xs text-muted-foreground">
                  {supplier ? "Owed to you" : "Balance"}
                </dt>
                <dd className="text-2xl font-semibold tracking-tight tabular-nums">
                  {formatMoney(statement.data.closingBalance, { whole: true })}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">
                  {supplier ? "Past due" : "Overdue"}
                </dt>
                <dd
                  className={cn(
                    "text-2xl font-semibold tracking-tight tabular-nums",
                    statement.data.overdue.amount > 0 &&
                      (supplier ? "text-warning" : "text-danger"),
                  )}
                >
                  {formatMoney(statement.data.overdue, { whole: true })}
                </dd>
              </div>
            </dl>
            <div>
              <AgeingBar ageing={statement.data.ageing} />
              {statement.data.unallocatedCredit.amount > 0 ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Less {formatMoney(statement.data.unallocatedCredit)} credit on account.
                </p>
              ) : null}
            </div>
          </>
        )}
      </section>

      <StatusTabs tabs={tabs} value={tab} onChange={setTab} label="Invoice views" />

      {invoices.isPending ? (
        <LoadingState rows={5} label="Loading invoices" />
      ) : invoices.isError ? (
        <ErrorState error={invoices.error} onRetry={() => invoices.refetch()} />
      ) : tab === "outstanding" || tab === "paid" ? (
        <InvoiceList
          invoices={tab === "outstanding" ? outstanding : paid}
          empty={
            tab === "outstanding"
              ? supplier
                ? "Nothing owed to you right now"
                : "Nothing due for payment"
              : "No paid invoices yet"
          }
          onPay={canPayByCard && tab === "outstanding" ? setPaying : undefined}
        />
      ) : tab === "credits" ? (
        <InvoiceList invoices={credits.data ?? []} empty="No credit notes" />
      ) : tab === "payments" ? (
        payments.isPending ? (
          <LoadingState rows={4} />
        ) : (
          <PaymentList
            payments={(payments.data ?? []).filter((p) => p.method !== "credit-allocation")}
            invoiceNumber={invoiceNumber}
            supplier={supplier}
          />
        )
      ) : tab === "runs" ? (
        runs.isPending ? (
          <LoadingState rows={4} />
        ) : (runs.data ?? []).length === 0 ? (
          <EmptyState icon={CalendarCheckIcon} title="No payment runs include your invoices" />
        ) : (
          <ul className="space-y-2">
            {runs.data!.map((r) => (
              <li key={r.id}>
                <Link
                  href={hrefFor("payment-run", r.id)}
                  className="flex flex-col gap-2 rounded-2xl border bg-card p-4 hover:border-primary/40 sm:flex-row sm:items-center"
                >
                  <div className="flex-1">
                    <p className="flex items-center gap-2 font-medium">
                      Payment run {formatDate(r.scheduledFor)}
                      <StatusPill tone={r.status === "paid" ? "success" : "info"}>
                        {r.status === "paid"
                          ? "Paid"
                          : `Scheduled, ${formatRelativeDay(r.scheduledFor)}`}
                      </StatusPill>
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {r.invoiceIds.map((id) => invoiceNumber.get(id) ?? "invoice").join(", ")}
                    </p>
                  </div>
                  <p className="text-lg font-semibold tabular-nums">{formatMoney(r.total)}</p>
                </Link>
              </li>
            ))}
          </ul>
        )
      ) : statement.data ? (
        <StatementView
          statement={statement.data}
          accountName={me.data?.group?.account.name ?? me.data?.account.name ?? ""}
          supplier={supplier}
        />
      ) : (
        <LoadingState rows={5} />
      )}

      {paying ? (
        <PayInvoiceDialog invoice={paying} open onOpenChange={(o) => !o && setPaying(null)} />
      ) : null}
    </div>
  );
}

function InvoiceList({
  invoices,
  empty,
  onPay,
}: {
  invoices: Invoice[];
  empty: string;
  onPay?: (i: Invoice) => void;
}) {
  if (invoices.length === 0) return <EmptyState icon={ReceiptIcon} title={empty} />;
  return (
    <ul className="space-y-2">
      {invoices.map((i) => {
        const s = INVOICE_STATUS[i.status];
        const label =
          i.kind === "credit-note"
            ? "Credit note"
            : i.kind === "self-bill"
              ? "Self-billed invoice"
              : "Invoice";
        return (
          <li
            key={i.id}
            className="flex flex-col gap-3 rounded-2xl border bg-card p-4 sm:flex-row sm:items-center"
          >
            <Link
              href={hrefFor("invoice", i.id)}
              className="min-w-0 flex-1 hover:underline-offset-4"
            >
              <p className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{i.number}</span>
                <StatusPill tone={s.tone}>{s.label}</StatusPill>
                {i.outstanding.amount > 0 && i.kind !== "credit-note" ? (
                  <span className="text-xs text-muted-foreground">
                    {BAND_LABEL[i.ageingBand]} old
                  </span>
                ) : null}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {label} · issued {formatDate(i.issuedAt)}
                {i.kind !== "credit-note" ? ` · due ${formatDate(i.dueAt)}` : ""}
              </p>
            </Link>
            <div className="flex items-center justify-between gap-4 sm:justify-end">
              <p className="text-right">
                <span className="block text-lg font-semibold tabular-nums">
                  {formatMoney(i.outstanding.amount > 0 ? i.outstanding : i.total)}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {i.outstanding.amount > 0 && i.outstanding.amount !== i.total.amount
                    ? `of ${formatMoney(i.total)}`
                    : i.outstanding.amount > 0
                      ? i.kind === "credit-note"
                        ? "credit available"
                        : "outstanding"
                      : "total"}
                </span>
              </p>
              {onPay && i.kind === "invoice" && i.outstanding.amount > 0 ? (
                <Button size="sm" onClick={() => onPay(i)}>
                  <CreditCardIcon aria-hidden />
                  Pay
                </Button>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function PaymentList({
  payments,
  invoiceNumber,
  supplier,
}: {
  payments: import("@/types").Payment[];
  invoiceNumber: Map<string, string>;
  supplier: boolean;
}) {
  if (payments.length === 0)
    return (
      <EmptyState
        icon={CreditCardIcon}
        title={supplier ? "No remittances yet" : "No payments yet"}
      />
    );
  const METHOD = {
    bacs: "Bank transfer",
    card: "Card",
    "direct-debit": "Direct Debit",
    "credit-allocation": "Credit applied",
  } as const;
  return (
    <ul className="space-y-2">
      {payments.map((p) => (
        <li key={p.id}>
          <Link
            href={hrefFor("payment", p.id)}
            className="flex flex-col gap-2 rounded-2xl border bg-card p-4 hover:border-primary/40 sm:flex-row sm:items-center"
          >
            <div className="min-w-0 flex-1">
              <p className="font-medium">{p.reference}</p>
              <p className="truncate text-sm text-muted-foreground">
                {METHOD[p.method]} · {formatDate(p.paidAt)} ·{" "}
                {p.allocatedTo.map((a) => invoiceNumber.get(a.invoiceId) ?? "invoice").join(", ")}
              </p>
            </div>
            <p className="text-lg font-semibold tabular-nums">{formatMoney(p.amount)}</p>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function StatementView({
  statement,
  accountName,
  supplier,
}: {
  statement: Statement;
  accountName: string;
  supplier: boolean;
}) {
  const [pdfOpen, setPdfOpen] = useState(false);
  const KIND = {
    invoice: "Invoice",
    "credit-note": "Credit note",
    "self-bill": "Self-billed invoice",
    payment: "Payment",
  } as const;

  const exportCsv = () => {
    const cell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const money = (m: { amount: number } | null) => (m ? (m.amount / 100).toFixed(2) : "");
    const rows = [
      ["Date", "Type", "Reference", "Debit (GBP)", "Credit (GBP)", "Balance (GBP)"],
      [statement.from, "Opening balance", "", "", "", money(statement.openingBalance)],
      ...statement.lines.map((l) => [
        l.date.slice(0, 10),
        KIND[l.kind],
        l.reference,
        money(l.debit),
        money(l.credit),
        money(l.balance),
      ]),
      [statement.to, "Closing balance", "", "", "", money(statement.closingBalance)],
    ];
    const filename = `brewfitt-statement-${statement.to}.csv`;
    downloadText(filename, rows.map((r) => r.map(cell).join(",")).join("\r\n"));
    toast.success("Statement downloaded", { description: filename });
  };

  return (
    <section aria-labelledby="statement-heading">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 id="statement-heading" className="font-medium">
          Statement, {formatDate(statement.from)} to {formatDate(statement.to)}
        </h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setPdfOpen(true)}>
            <FilePdfIcon aria-hidden />
            PDF
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <DownloadSimpleIcon aria-hidden />
            CSV
          </Button>
        </div>
      </div>
      <div className="overflow-x-auto rounded-2xl border bg-card">
        <table className="w-full min-w-[640px] text-sm">
          <caption className="sr-only">Statement lines with running balance</caption>
          <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-2.5 font-medium">
                Date
              </th>
              <th scope="col" className="px-3 py-2.5 font-medium">
                Reference
              </th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">
                {supplier ? "Invoiced" : "Debit"}
              </th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">
                {supplier ? "Paid or credited" : "Credit"}
              </th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium">
                Balance
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            <tr className="bg-muted/20">
              <td className="px-4 py-2.5">{formatDate(statement.from)}</td>
              <td className="px-3 py-2.5 font-medium" colSpan={3}>
                Opening balance
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums">
                {formatMoney(statement.openingBalance)}
              </td>
            </tr>
            {[...statement.lines].reverse().map((l) => (
              <tr key={`${l.relatedId}-${l.date}`}>
                <td className="px-4 py-2.5 whitespace-nowrap">{formatDate(l.date)}</td>
                <td className="px-3 py-2.5">
                  <Link
                    href={hrefFor(l.kind === "payment" ? "payment" : "invoice", l.relatedId)}
                    className="hover:underline"
                  >
                    {KIND[l.kind]} {l.kind === "payment" ? "" : l.reference}
                  </Link>
                  {l.kind === "payment" ? (
                    <span className="block text-xs text-muted-foreground">{l.reference}</span>
                  ) : null}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">
                  {l.debit ? formatMoney(l.debit) : ""}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">
                  {l.credit ? formatMoney(l.credit) : ""}
                </td>
                <td className="px-4 py-2.5 text-right font-medium tabular-nums">
                  {formatMoney(l.balance)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Newest first. {plural(statement.lines.length, "entry", "entries")} in the last 12 months.
      </p>

      <PdfPreview open={pdfOpen} onOpenChange={setPdfOpen} title="Statement of account">
        <DocumentHeader
          kind="Statement of account"
          date={statement.to}
          meta={[
            {
              label: "Period",
              value: `${formatDate(statement.from)} to ${formatDate(statement.to)}`,
            },
          ]}
        />
        <div className="my-6 grid grid-cols-2 gap-6">
          <DocumentParty label="Account" lines={[accountName]} />
          <DocumentParty
            label={supplier ? "Owed to you" : "Balance due"}
            lines={[
              formatMoney(statement.closingBalance),
              statement.overdue.amount
                ? `${formatMoney(statement.overdue)} overdue`
                : "Nothing overdue",
            ]}
          />
        </div>
        <table className="w-full text-[11px]">
          <thead>
            <tr className="border-b border-neutral-300 text-left text-neutral-500">
              <th className="py-1 font-medium">Date</th>
              <th className="py-1 font-medium">Reference</th>
              <th className="py-1 text-right font-medium">Debit</th>
              <th className="py-1 text-right font-medium">Credit</th>
              <th className="py-1 text-right font-medium">Balance</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-neutral-100">
              <td className="py-1">{formatDate(statement.from)}</td>
              <td className="py-1" colSpan={3}>
                Opening balance
              </td>
              <td className="py-1 text-right">{formatMoney(statement.openingBalance)}</td>
            </tr>
            {statement.lines.map((l) => (
              <tr key={`${l.relatedId}-${l.date}`} className="border-b border-neutral-100">
                <td className="py-1 whitespace-nowrap">{formatDate(l.date)}</td>
                <td className="py-1">
                  {KIND[l.kind]} {l.reference}
                </td>
                <td className="py-1 text-right whitespace-nowrap">
                  {l.debit ? formatMoney(l.debit) : ""}
                </td>
                <td className="py-1 text-right whitespace-nowrap">
                  {l.credit ? formatMoney(l.credit) : ""}
                </td>
                <td className="py-1 text-right whitespace-nowrap">{formatMoney(l.balance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <DocumentFooter
          note={
            supplier
              ? "Brewfitt pays suppliers in fortnightly payment runs."
              : "Please pay by bank transfer quoting the invoice number, or contact credit control with any query."
          }
        />
      </PdfPreview>
    </section>
  );
}

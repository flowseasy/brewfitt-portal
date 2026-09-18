"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { FileTextIcon, LockSimpleIcon, MagnifyingGlassIcon } from "@phosphor-icons/react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/states";
import { StatusPill } from "@/components/shared/status-pill";
import { Input } from "@/components/ui/input";
import { useInternalQuotes } from "@/features/internal/use-composite";
import { formatDate, formatMoney, plural } from "@/lib/format";
import { QUOTE_STATUS } from "@/lib/status";
import { cn } from "@/lib/utils";
import type { InternalQuote } from "@/types";

type Filter = "all" | "composite" | "open";

/** Brewfitt staff (decision 14): every account's quotes, read-only. */
export default function InternalQuotesPage() {
  const quotes = useInternalQuotes();
  const [term, setTerm] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const list = useMemo(() => {
    const t = term.trim().toLowerCase();
    return (quotes.data ?? []).filter((q) => {
      if (filter === "composite" && !q.lines.some((l) => l.internal)) return false;
      if (filter === "open" && q.status !== "sent") return false;
      if (!t) return true;
      return (
        q.number.toLowerCase().includes(t) ||
        q.accountName.toLowerCase().includes(t) ||
        q.lines.some((l) => l.description.toLowerCase().includes(t))
      );
    });
  }, [quotes.data, term, filter]);

  const counts = {
    all: quotes.data?.length ?? 0,
    open: quotes.data?.filter((q) => q.status === "sent").length ?? 0,
    composite: quotes.data?.filter((q) => q.lines.some((l) => l.internal)).length ?? 0,
  };

  return (
    <div>
      <PageHeader
        title="Quotes"
        description="Every customer quote, for reference while costing. Quotes are changed in TOTA360v5, not here."
        actions={
          <span className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm text-muted-foreground">
            <LockSimpleIcon className="size-4" aria-hidden />
            Read-only
          </span>
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div role="group" aria-label="Show" className="flex flex-wrap gap-1.5">
          {(
            [
              ["all", "All"],
              ["open", "Awaiting acceptance"],
              ["composite", "With composites"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
              className={cn(
                "rounded-full border px-3 py-1 text-sm focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none",
                filter === value
                  ? "border-primary bg-brand-subtle font-medium text-brand-subtle-foreground"
                  : "bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              {label} <span className="tabular-nums">{counts[value]}</span>
            </button>
          ))}
        </div>
        <div className="relative sm:w-72">
          <MagnifyingGlassIcon
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Quote, customer or item"
            aria-label="Search quotes"
            className="pl-8"
          />
        </div>
      </div>

      {quotes.isPending ? (
        <LoadingState rows={6} label="Loading quotes" />
      ) : quotes.isError ? (
        <ErrorState error={quotes.error} onRetry={() => quotes.refetch()} />
      ) : list.length === 0 ? (
        <EmptyState
          icon={FileTextIcon}
          title="No quotes match"
          description="Try another search or show all quotes."
        />
      ) : (
        <>
          <div className="relative hidden overflow-x-auto rounded-2xl border bg-card md:block">
            <table className="w-full text-sm">
              <caption className="sr-only">Customer quotes, newest first</caption>
              <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-medium">
                    Quote
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-medium">
                    Customer
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-medium">
                    Lines
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-medium">
                    Status
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {list.map((q) => (
                  <tr key={q.id} className="align-top">
                    <td className="px-4 py-3">
                      <Link
                        href={`/internal/quotes/view?id=${q.id}`}
                        className="font-mono font-medium hover:underline"
                      >
                        {q.number}
                      </Link>
                      <span className="block text-xs text-muted-foreground">
                        {formatDate(q.createdAt)}
                      </span>
                    </td>
                    <td className="px-3 py-3">{q.accountName}</td>
                    <td className="px-3 py-3">
                      <LineSummary quote={q} />
                    </td>
                    <td className="px-3 py-3">
                      <StatusPill tone={QUOTE_STATUS[q.status].tone}>
                        {QUOTE_STATUS[q.status].label}
                      </StatusPill>
                    </td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums">
                      {formatMoney(q.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="space-y-2 md:hidden">
            {list.map((q) => (
              <li key={q.id}>
                <Link
                  href={`/internal/quotes/view?id=${q.id}`}
                  className="block rounded-2xl border bg-card p-4"
                >
                  <span className="flex items-start justify-between gap-2">
                    <span className="min-w-0">
                      <span className="block font-mono font-medium">{q.number}</span>
                      <span className="block text-sm text-muted-foreground">{q.accountName}</span>
                    </span>
                    <StatusPill tone={QUOTE_STATUS[q.status].tone}>
                      {QUOTE_STATUS[q.status].label}
                    </StatusPill>
                  </span>
                  <span className="mt-2 block text-sm">
                    <LineSummary quote={q} />
                  </span>
                  <span className="mt-2 block text-right font-semibold tabular-nums">
                    {formatMoney(q.total)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function LineSummary({ quote }: { quote: InternalQuote }) {
  const composites = quote.lines.filter((l) => l.internal).length;
  return (
    <span className="block">
      <span className="line-clamp-1">
        {quote.lines
          .slice(0, 2)
          .map((l) => `${l.qty} × ${l.description}`)
          .join(", ")}
        {quote.lines.length > 2 ? "…" : ""}
      </span>
      <span className="block text-xs text-muted-foreground">
        {plural(quote.lines.length, "line")}
        {composites ? (
          <span className="ml-1 rounded bg-warning-subtle px-1.5 text-warning">
            {plural(composites, "composite")}
          </span>
        ) : null}
      </span>
    </span>
  );
}

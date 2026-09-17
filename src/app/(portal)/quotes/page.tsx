"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { FileTextIcon, MagnifyingGlassIcon } from "@phosphor-icons/react";
import { SearchInput } from "@/components/shared/filter-bar";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/states";
import { StatusPill } from "@/components/shared/status-pill";
import { Button } from "@/components/ui/button";
import { useIsSupplier, usePersonaKey } from "@/features/session/use-session";
import { api, queryKeys } from "@/lib/api";
import { daysFromToday, formatDate, formatMoney, formatRelativeDay, plural } from "@/lib/format";
import { hrefFor } from "@/lib/links";
import { QUOTE_STATUS, RFQ_STATUS } from "@/lib/status";
import { cn } from "@/lib/utils";
import type { Quote, Rfq } from "@/types";

export default function QuotesPage() {
  return (
    <Suspense fallback={<LoadingState rows={5} />}>
      {useIsSupplier() ? <SupplierRfqs /> : <CustomerQuotes />}
    </Suspense>
  );
}

function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { value: T; label: string; count: number }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div role="tablist" aria-label="Filter by status" className="-mx-4 mb-4 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
      {tabs.map((t) => (
        <button
          key={t.value}
          role="tab"
          type="button"
          aria-selected={value === t.value}
          onClick={() => onChange(t.value)}
          className={cn("flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm transition", value === t.value ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-primary/40")}
        >
          {t.label}
          <span className={cn("rounded-full px-1.5 text-xs tabular-nums", value === t.value ? "bg-primary-foreground/20" : "bg-muted")}>{t.count}</span>
        </button>
      ))}
    </div>
  );
}

type QuoteTab = "awaiting" | "requested" | "accepted" | "closed" | "all";

function CustomerQuotes() {
  const key = usePersonaKey();
  const quotes = useQuery({ queryKey: queryKeys.quotes(key), queryFn: () => api.quotes.list() });
  const configurations = useQuery({ queryKey: queryKeys.configurations(key), queryFn: () => api.configurator.list() });
  const [tab, setTab] = useState<QuoteTab>("awaiting");
  const [search, setSearch] = useState("");

  const configName = useMemo(() => new Map((configurations.data ?? []).map((c) => [c.id, c.name])), [configurations.data]);
  const all = useMemo(() => quotes.data ?? [], [quotes.data]);
  const inTab = (q: Quote, t: QuoteTab) =>
    t === "all" ? true : t === "awaiting" ? q.status === "sent" : t === "requested" ? q.status === "draft" : t === "accepted" ? q.status === "accepted" : q.status === "declined" || q.status === "expired";
  const term = search.trim().toLowerCase();
  const filtered = all.filter((q) => inTab(q, tab) && (!term || q.number.toLowerCase().includes(term) || q.lines.some((l) => l.description.toLowerCase().includes(term)) || (q.configurationId && configName.get(q.configurationId)?.toLowerCase().includes(term))));
  const tabs: { value: QuoteTab; label: string; count: number }[] = [
    { value: "awaiting", label: "Awaiting you", count: all.filter((q) => inTab(q, "awaiting")).length },
    { value: "requested", label: "Requested", count: all.filter((q) => inTab(q, "requested")).length },
    { value: "accepted", label: "Accepted", count: all.filter((q) => inTab(q, "accepted")).length },
    { value: "closed", label: "Declined or expired", count: all.filter((q) => inTab(q, "closed")).length },
    { value: "all", label: "All", count: all.length },
  ];

  return (
    <div>
      <PageHeader
        title="Quotes"
        description="Accept, decline or ask Brewfitt about a quote. Accepting turns it straight into an order."
        actions={
          <Button asChild variant="outline">
            <Link href="/configurator/build">Build a system for a quote</Link>
          </Button>
        }
      />
      <Tabs tabs={tabs} value={tab} onChange={setTab} />
      <div className="mb-4">
        <SearchInput value={search} onChange={setSearch} placeholder="Search by quote number, product or configuration" label="Search quotes" className="max-w-md" />
      </div>
      {quotes.isPending ? (
        <LoadingState rows={5} label="Loading quotes" />
      ) : quotes.isError ? (
        <ErrorState error={quotes.error} onRetry={() => quotes.refetch()} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={term ? MagnifyingGlassIcon : FileTextIcon}
          title={term ? "No quotes match your search" : tab === "awaiting" ? "No quotes awaiting you" : "No quotes here"}
          description={tab === "awaiting" && !term ? "When Brewfitt sends a quote it appears here for you to accept." : undefined}
        />
      ) : (
        <ul className="space-y-2">
          {filtered.map((q) => {
            const days = daysFromToday(q.validUntil);
            const s = QUOTE_STATUS[q.status];
            return (
              <li key={q.id}>
                <Link href={hrefFor("quote", q.id)} className="flex flex-col gap-3 rounded-2xl border bg-card p-4 transition hover:border-primary/40 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{q.number}</span>
                      <StatusPill tone={s.tone}>{s.label}</StatusPill>
                      {q.status === "sent" && days <= 7 ? <StatusPill tone="warning">Expires {formatRelativeDay(q.validUntil)}</StatusPill> : null}
                    </div>
                    <p className="mt-1 truncate text-sm text-muted-foreground">
                      {q.configurationId && configName.get(q.configurationId) ? `${configName.get(q.configurationId)} · ` : ""}
                      {plural(q.lines.length, "line")}: {q.lines.slice(0, 2).map((l) => l.description).join(", ")}
                      {q.lines.length > 2 ? "…" : ""}
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-6 sm:justify-end">
                    <p className="text-sm text-muted-foreground">
                      {q.status === "sent" || q.status === "draft" ? `Valid until ${formatDate(q.validUntil)}` : `Raised ${formatDate(q.createdAt)}`}
                    </p>
                    <p className="text-right text-lg font-semibold tabular-nums">{formatMoney(q.total, { whole: true })}</p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

type RfqTab = "open" | "responded" | "decided" | "all";

function SupplierRfqs() {
  const key = usePersonaKey();
  const params = useSearchParams();
  const rfqs = useQuery({ queryKey: queryKeys.rfqs(key), queryFn: () => api.quotes.rfqs() });
  const products = useQuery({ queryKey: queryKeys.products(key), queryFn: () => api.products.list() });
  const [tab, setTab] = useState<RfqTab>((["open", "responded", "decided", "all"] as const).find((t) => t === params.get("filter")) ?? "open");
  const name = useMemo(() => new Map((products.data ?? []).map((p) => [p.id, p.name])), [products.data]);
  const all = rfqs.data ?? [];
  const inTab = (r: Rfq, t: RfqTab) => (t === "all" ? true : t === "open" ? r.status === "open" : t === "responded" ? r.status === "responded" : ["awarded", "not-awarded", "closed"].includes(r.status));
  const filtered = all.filter((r) => inTab(r, tab));

  return (
    <div>
      <PageHeader title="RFQs and quotes" description="Requests for quotation from Brewfitt's buyer. Respond with your price and lead time before the deadline." />
      <Tabs
        tabs={[
          { value: "open", label: "Awaiting response", count: all.filter((r) => inTab(r, "open")).length },
          { value: "responded", label: "Responded", count: all.filter((r) => inTab(r, "responded")).length },
          { value: "decided", label: "Awarded or closed", count: all.filter((r) => inTab(r, "decided")).length },
          { value: "all", label: "All", count: all.length },
        ]}
        value={tab}
        onChange={setTab}
      />
      {rfqs.isPending ? (
        <LoadingState rows={4} label="Loading requests for quotation" />
      ) : rfqs.isError ? (
        <ErrorState error={rfqs.error} onRetry={() => rfqs.refetch()} />
      ) : filtered.length === 0 ? (
        <EmptyState icon={FileTextIcon} title={tab === "open" ? "No requests awaiting your response" : "No requests here"} description="New requests from Brewfitt appear here with their deadline." />
      ) : (
        <ul className="space-y-2">
          {filtered.map((r) => {
            const s = RFQ_STATUS[r.status];
            const days = daysFromToday(r.deadline);
            return (
              <li key={r.id}>
                <Link href={hrefFor("rfq", r.id)} className="flex flex-col gap-3 rounded-2xl border bg-card p-4 transition hover:border-primary/40 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{r.number}</span>
                      <StatusPill tone={s.tone}>{s.label}</StatusPill>
                    </div>
                    <p className="mt-1 truncate text-sm text-muted-foreground">{r.lines.map((l) => `${l.qty} × ${name.get(l.productId) ?? "item"}`).join(", ")}</p>
                  </div>
                  <div className="text-sm sm:text-right">
                    {r.status === "open" ? (
                      <StatusPill tone={days <= 3 ? "warning" : "info"}>Respond {days < 0 ? "overdue" : formatRelativeDay(r.deadline)}</StatusPill>
                    ) : (
                      <span className="text-muted-foreground">Raised {formatDate(r.createdAt)}</span>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

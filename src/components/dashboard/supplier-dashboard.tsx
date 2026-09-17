"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ChartBarIcon,
  ChatsCircleIcon,
  FileTextIcon,
  PackageIcon,
  SparkleIcon,
  TagIcon,
  TrendUpIcon,
  UsersIcon,
  WalletIcon,
} from "@phosphor-icons/react";
import { AIInsightCard } from "@/components/ai/ai-insight-card";
import { AllInsightsButton } from "@/components/ai/assistant-panel";
import { AssistantPrompt } from "@/components/ai/assistant-prompt";
import { AgeingBar } from "@/components/finance/ageing-bar";
import { AnimatedNumber } from "@/components/shared/animated-number";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/states";
import { StatusPill } from "@/components/shared/status-pill";
import { StockPill } from "@/components/shared/stock-pill";
import { TeamMemberCard } from "@/components/shared/team-member-card";
import { Button } from "@/components/ui/button";
import { usePersonaKey } from "@/features/session/use-session";
import { api, queryKeys } from "@/lib/api";
import { formatDate, formatMoney, formatRelativeDay, formatSince, plural } from "@/lib/format";
import { hrefFor } from "@/lib/links";
import { OPEN_PO_STATUSES, PO_STATUS, SUBMISSION_STATUS } from "@/lib/status";
import { cn } from "@/lib/utils";
import { CardRow, DashboardCard } from "./dashboard-card";
import { SupplierStatsPanel } from "./performance-stats";

const money = (n: number) => formatMoney({ amount: n, currency: "GBP" }, { whole: true });

export function SupplierDashboard() {
  const key = usePersonaKey();
  const me = useQuery({ queryKey: queryKeys.me(key), queryFn: () => api.session.me() });
  const statement = useQuery({
    queryKey: queryKeys.statement(key),
    queryFn: () => api.invoices.statement(),
  });
  const runs = useQuery({
    queryKey: queryKeys.paymentRuns(key),
    queryFn: () => api.invoices.paymentRuns(),
  });
  const rfqs = useQuery({ queryKey: queryKeys.rfqs(key), queryFn: () => api.quotes.rfqs() });
  const pos = useQuery({
    queryKey: queryKeys.purchaseOrders(key),
    queryFn: () => api.orders.purchaseOrders(),
  });
  const stock = useQuery({ queryKey: queryKeys.stock(key), queryFn: () => api.stock.list() });
  const forecast = useQuery({
    queryKey: queryKeys.forecast(key),
    queryFn: () => api.stock.forecast(),
  });
  const products = useQuery({
    queryKey: queryKeys.products(key),
    queryFn: () => api.products.list(),
  });
  const submissions = useQuery({
    queryKey: queryKeys.supplierProducts(key),
    queryFn: () => api.supplierProducts.list(),
  });
  const threads = useQuery({
    queryKey: queryKeys.threads(key),
    queryFn: () => api.messages.threads(),
  });
  const performance = useQuery({
    queryKey: queryKeys.supplierPerformance(key),
    queryFn: () => api.supplierProducts.performance(),
  });
  const insights = useQuery({
    queryKey: queryKeys.insights(key),
    queryFn: () => api.ai.insights(),
  });

  const d = useMemo(() => {
    const productName = new Map((products.data ?? []).map((p) => [p.id, p.name]));
    const forecastById = new Map((forecast.data ?? []).map((f) => [f.productId, f]));
    const openPos = (pos.data ?? []).filter((p) => OPEN_PO_STATUSES.includes(p.status));
    const statusRank = { out: 0, "on-order": 1, low: 2, "in-stock": 3 } as const;
    return {
      productName,
      nextRun:
        (runs.data ?? [])
          .filter((r) => r.status === "scheduled")
          .sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor))[0] ?? null,
      openRfqs: (rfqs.data ?? [])
        .filter((r) => r.status === "open")
        .sort((a, b) => a.deadline.localeCompare(b.deadline)),
      openPos: openPos.sort((a, b) => a.expectedDate.localeCompare(b.expectedDate)),
      stageCounts: (["issued", "acknowledged", "in-transit", "part-received"] as const).map(
        (s) => [s, openPos.filter((p) => p.status === s).length] as const,
      ),
      stockRows: (stock.data ?? [])
        .map((s) => ({ stock: s, forecast: forecastById.get(s.productId) }))
        .sort(
          (a, b) =>
            statusRank[a.stock.status] - statusRank[b.stock.status] ||
            (b.forecast?.averageMonthlyQuantity ?? 0) - (a.forecast?.averageMonthlyQuantity ?? 0),
        )
        .slice(0, 5),
      openSubmissions: (submissions.data ?? []).slice(0, 4),
      recentThreads: (threads.data ?? []).slice(0, 4),
      unread: (threads.data ?? []).filter((t) => t.unreadCount > 0).length,
      supplierInsights: (insights.data ?? []).slice(0, 2),
    };
  }, [
    products.data,
    forecast.data,
    pos.data,
    runs.data,
    rfqs.data,
    stock.data,
    submissions.data,
    threads.data,
    insights.data,
  ]);

  const firstName = me.data?.contact.name.split(" ")[0];

  return (
    <div className="space-y-6">
      <section
        aria-labelledby="welcome"
        className="rounded-3xl border bg-gradient-to-br from-brand-subtle via-card to-card p-5 sm:p-7"
      >
        <p className="text-sm text-muted-foreground">{me.data?.account.name}</p>
        <h1 id="welcome" className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
          {firstName ? `Good to see you, ${firstName}` : "Your dashboard"}
        </h1>
        <p className="mt-1 text-muted-foreground">
          What Brewfitt needs from you, what it owes you and how your range is moving.
        </p>
        <div className="mt-5 max-w-2xl">
          <AssistantPrompt />
        </div>
      </section>

      <SupplierStatsPanel />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* 1. Account status */}
        <DashboardCard
          index={0}
          className="lg:col-span-2"
          title="Amounts due to you"
          icon={WalletIcon}
          action={{ label: "Payments", href: "/invoices" }}
        >
          {statement.isPending || runs.isPending ? (
            <LoadingState rows={2} />
          ) : statement.isError ? (
            <ErrorState error={statement.error} onRetry={() => statement.refetch()} />
          ) : (
            <div>
              <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <div>
                  <dt className="text-xs text-muted-foreground">Owed by Brewfitt</dt>
                  <dd className="mt-0.5 text-2xl font-semibold tracking-tight">
                    <AnimatedNumber value={statement.data.closingBalance.amount} format={money} />
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Past due date</dt>
                  <dd
                    className={cn(
                      "mt-0.5 text-2xl font-semibold tracking-tight",
                      statement.data.overdue.amount > 0 && "text-warning",
                    )}
                  >
                    <AnimatedNumber value={statement.data.overdue.amount} format={money} />
                  </dd>
                </div>
                <div className="relative col-span-2 -m-2 rounded-lg p-2 hover:bg-accent/50 sm:col-span-1">
                  <dt className="text-xs text-muted-foreground">
                    <Link
                      href="/invoices?tab=runs"
                      className="after:absolute after:inset-0 after:rounded-lg focus-visible:outline-none focus-visible:after:ring-3 focus-visible:after:ring-ring/40"
                    >
                      Next payment run
                    </Link>
                  </dt>
                  <dd className="mt-0.5 text-2xl font-semibold tracking-tight">
                    {d.nextRun ? formatMoney(d.nextRun.total, { whole: true }) : "None scheduled"}
                  </dd>
                  {d.nextRun ? (
                    <dd className="text-xs text-muted-foreground">
                      {formatDate(d.nextRun.scheduledFor)},{" "}
                      {plural(d.nextRun.invoiceIds.length, "invoice")}
                    </dd>
                  ) : null}
                </div>
              </dl>
              <div className="mt-5">
                <p className="mb-2 text-xs font-medium text-muted-foreground">Owed to you by due date</p>
                <AgeingBar ageing={statement.data.ageing} />
              </div>
            </div>
          )}
        </DashboardCard>

        {/* 2. RFQs */}
        <DashboardCard
          index={1}
          title="RFQs awaiting response"
          icon={FileTextIcon}
          action={{ label: "All RFQs", href: "/quotes" }}
        >
          {rfqs.isPending ? (
            <LoadingState rows={3} />
          ) : rfqs.isError ? (
            <ErrorState error={rfqs.error} onRetry={() => rfqs.refetch()} />
          ) : d.openRfqs.length === 0 ? (
            <EmptyState
              icon={FileTextIcon}
              title="No requests awaiting you"
              description="New requests for quotation from Brewfitt appear here."
            />
          ) : (
            <ul>
              {d.openRfqs.map((r) => {
                const days = Math.round(
                  (Date.parse(`${r.deadline}T00:00:00Z`) - Date.now()) / 86_400_000,
                );
                return (
                  <CardRow key={r.id} href={hrefFor("rfq", r.id)}>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{r.number}</p>
                      <p className="truncate text-sm text-muted-foreground">
                        {r.lines.map((l) => d.productName.get(l.productId) ?? "Item").join(", ")}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <StatusPill tone={days <= 3 ? "warning" : "info"}>
                        Due {formatRelativeDay(r.deadline)}
                      </StatusPill>
                    </div>
                  </CardRow>
                );
              })}
            </ul>
          )}
        </DashboardCard>

        {/* 3. Purchase orders */}
        <DashboardCard
          index={2}
          className="lg:col-span-2"
          title="Purchase orders"
          icon={PackageIcon}
          action={{ label: "All purchase orders", href: "/orders" }}
        >
          {pos.isPending ? (
            <LoadingState rows={2} />
          ) : pos.isError ? (
            <ErrorState error={pos.error} onRetry={() => pos.refetch()} />
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
              <dl className="grid grid-cols-2 gap-2">
                {d.stageCounts.map(([status, count]) => (
                  <div
                    key={status}
                    className="relative rounded-xl border p-3 transition focus-within:ring-3 focus-within:ring-ring/40 hover:border-primary/40 hover:bg-accent/40"
                  >
                    <dt className="text-xs text-muted-foreground">
                      <Link
                        href={`/orders?status=${status}`}
                        className="after:absolute after:inset-0 focus-visible:outline-none"
                      >
                        {PO_STATUS[status].label}
                      </Link>
                    </dt>
                    <dd className="mt-0.5 text-2xl font-semibold tabular-nums">{count}</dd>
                  </div>
                ))}
              </dl>
              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">Expected next</p>
                {d.openPos.length === 0 ? (
                  <p className="py-6 text-sm text-muted-foreground">No open purchase orders.</p>
                ) : (
                  <ul>
                    {d.openPos.slice(0, 4).map((p) => (
                      <CardRow key={p.id} href={hrefFor("purchase-order", p.id)}>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium">{p.number}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatMoney(p.total, { whole: true })}
                          </p>
                        </div>
                        <div className="text-right">
                          <StatusPill tone={PO_STATUS[p.status].tone}>
                            {PO_STATUS[p.status].label}
                          </StatusPill>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            Expected {formatDate(p.expectedDate)}
                          </p>
                        </div>
                      </CardRow>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </DashboardCard>

        {/* 4. Brewfitt stock and forecast */}
        <DashboardCard
          index={3}
          title="Brewfitt stock of your items"
          icon={TrendUpIcon}
          action={{ label: "Stock and forecast", href: "/stock" }}
        >
          {stock.isPending || forecast.isPending ? (
            <LoadingState rows={3} />
          ) : stock.isError ? (
            <ErrorState error={stock.error} onRetry={() => stock.refetch()} />
          ) : (
            <ul className="divide-y">
              {d.stockRows.map(({ stock: s, forecast: f }) => (
                <li key={s.productId} className="py-2.5 first:pt-0">
                  <p className="line-clamp-1 text-sm font-medium">
                    {d.productName.get(s.productId)}
                  </p>
                  <div className="mt-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span className="tabular-nums">
                      {s.onHand} held · min {s.minimumLevel}
                      {f ? ` · ${f.months[0]?.quantity ?? 0} forecast next month` : ""}
                    </span>
                    <StockPill stock={s} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </DashboardCard>

        {/* 5. Product submissions */}
        <DashboardCard
          index={4}
          title="Product submissions"
          icon={TagIcon}
          action={{ label: "Products and offers", href: "/products" }}
        >
          {submissions.isPending ? (
            <LoadingState rows={3} />
          ) : submissions.isError ? (
            <ErrorState error={submissions.error} onRetry={() => submissions.refetch()} />
          ) : d.openSubmissions.length === 0 ? (
            <EmptyState
              icon={TagIcon}
              title="No submissions yet"
              action={
                <Button asChild size="sm" variant="outline">
                  <Link href="/products?new=product">Submit a product</Link>
                </Button>
              }
            />
          ) : (
            <ul>
              {d.openSubmissions.map((sp) => (
                <CardRow key={sp.id} href={hrefFor("supplier-product", sp.id)}>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{sp.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Updated {formatSince(sp.updatedAt)}
                    </p>
                  </div>
                  <StatusPill tone={SUBMISSION_STATUS[sp.status].tone}>
                    {SUBMISSION_STATUS[sp.status].label}
                  </StatusPill>
                </CardRow>
              ))}
            </ul>
          )}
        </DashboardCard>

        {/* Simulated insights (supply-side) */}
        <DashboardCard
          index={5}
          title="What Brewfitt is likely to need"
          icon={SparkleIcon}
          action={{ label: "Forecast", href: "/stock" }}
        >
          {insights.isPending ? (
            <LoadingState rows={2} />
          ) : d.supplierInsights.length === 0 ? (
            <EmptyState icon={SparkleIcon} title="No insights right now" />
          ) : (
            <div className="space-y-3">
              {d.supplierInsights.map((i) => (
                <AIInsightCard key={i.id} insight={i} compact supplier />
              ))}
            </div>
          )}
          {(insights.data?.length ?? 0) > d.supplierInsights.length ? (
            <AllInsightsButton count={insights.data!.length} className="mt-3" />
          ) : null}
        </DashboardCard>

        {/* 6. Conversations */}
        <DashboardCard
          index={6}
          title="Conversations"
          icon={ChatsCircleIcon}
          action={{ label: "Messages", href: "/messages" }}
          headerExtra={d.unread ? <StatusPill tone="info">{d.unread} new</StatusPill> : null}
        >
          {threads.isPending ? (
            <LoadingState rows={3} />
          ) : threads.isError ? (
            <ErrorState error={threads.error} onRetry={() => threads.refetch()} />
          ) : (
            <ul>
              {d.recentThreads.map((t) => (
                <CardRow key={t.id} href={hrefFor("thread", t.id)}>
                  <span
                    aria-hidden
                    className={cn(
                      "size-2 shrink-0 rounded-full",
                      t.unreadCount ? "bg-primary" : "bg-transparent",
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "truncate text-sm",
                        t.unreadCount ? "font-semibold" : "font-medium",
                      )}
                    >
                      {t.subject}
                    </p>
                    <p className="text-xs text-muted-foreground">{formatSince(t.lastMessageAt)}</p>
                  </div>
                </CardRow>
              ))}
            </ul>
          )}
        </DashboardCard>

        {/* 7. Purchase history and ranking */}
        <DashboardCard
          index={7}
          className="lg:col-span-2"
          title="Ranking and top products"
          icon={ChartBarIcon}
          action={{ label: "Purchase orders", href: "/orders" }}
        >
          {performance.isPending ? (
            <LoadingState rows={2} />
          ) : performance.isError ? (
            <ErrorState error={performance.error} onRetry={() => performance.refetch()} />
          ) : (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div className="rounded-xl bg-brand-subtle/60 p-4">
                <p className="text-xs text-brand-subtle-foreground">
                  Ranking among Brewfitt&apos;s {performance.data.sector}s
                </p>
                <p className="mt-1 text-3xl font-semibold tracking-tight">
                  {performance.data.rank}
                  <span className="text-base font-normal text-muted-foreground">
                    {" "}
                    of {performance.data.supplierCount}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">
                  By spend over 12 months. Other suppliers are not named.
                </p>
              </div>
              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">Top products</p>
                <ol className="space-y-1.5 text-sm">
                  {performance.data.topProducts.slice(0, 3).map((p) => (
                    <li key={p.productId} className="flex justify-between gap-3">
                      <span className="line-clamp-1">{d.productName.get(p.productId)}</span>
                      <span className="shrink-0 text-muted-foreground tabular-nums">
                        {formatMoney(p.total, { whole: true })}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          )}
        </DashboardCard>

        {/* 8. Brewfitt contacts */}
        <DashboardCard
          index={8}
          title="Your Brewfitt contacts"
          icon={UsersIcon}
          action={{ label: "Account", href: "/account" }}
        >
          {me.isPending ? (
            <LoadingState rows={2} />
          ) : me.isError ? (
            <ErrorState error={me.error} onRetry={() => me.refetch()} />
          ) : (
            <ul className="space-y-3">
              {me.data.brewfittTeam.map((m) => (
                <li key={m.id}>
                  <TeamMemberCard member={m} compact />
                </li>
              ))}
            </ul>
          )}
        </DashboardCard>
      </div>
    </div>
  );
}

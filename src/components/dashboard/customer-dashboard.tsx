"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowsClockwiseIcon,
  BellSimpleIcon,
  ChatsCircleIcon,
  FileTextIcon,
  LifebuoyIcon,
  PackageIcon,
  SparkleIcon,
  UsersIcon,
  WalletIcon,
  WarehouseIcon,
} from "@phosphor-icons/react";
import { AIInsightCard, SimulatedBadge } from "@/components/ai/ai-insight-card";
import { AllInsightsButton } from "@/components/ai/assistant-panel";
import { AssistantPrompt } from "@/components/ai/assistant-prompt";
import { AgeingBar } from "@/components/finance/ageing-bar";
import { AnimatedNumber } from "@/components/shared/animated-number";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/states";
import { StatusPill } from "@/components/shared/status-pill";
import { StockPill } from "@/components/shared/stock-pill";
import { TeamMemberCard } from "@/components/shared/team-member-card";
import { Button } from "@/components/ui/button";
import { useCustomerDashboard } from "@/features/dashboard/use-customer-dashboard";
import { useAddToBasket } from "@/features/shop/use-add-to-basket";
import { formatDate, formatMoney, formatRelativeDay, formatSince, plural } from "@/lib/format";
import { hrefFor } from "@/lib/links";
import { CASE_STATUS, JOB_STATUS, ORDER_STATUS } from "@/lib/status";
import { cn } from "@/lib/utils";
import { CardRow, DashboardCard } from "./dashboard-card";

const money = (n: number) => formatMoney({ amount: n, currency: "GBP" }, { whole: true });

export function CustomerDashboard() {
  const d = useCustomerDashboard();
  const addToBasket = useAddToBasket();
  const me = d.me.data;
  const firstName = me?.contact.name.split(" ")[0];
  const viewingGroup = me?.persona.kind === "group" && !me.persona.activeSiteId;

  return (
    <div className="space-y-6">
      <section
        aria-labelledby="welcome"
        className="rounded-3xl border bg-gradient-to-br from-brand-subtle via-card to-card p-5 sm:p-7"
      >
        <p className="text-sm text-muted-foreground">
          {viewingGroup ? `${me?.account.name}, all sites` : me?.account.name}
        </p>
        <h1 id="welcome" className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
          {firstName ? `Good to see you, ${firstName}` : "Your dashboard"}
        </h1>
        <p className="mt-1 text-muted-foreground">
          Where you stand with Brewfitt and what needs your attention.
        </p>
        <div className="mt-5 max-w-2xl">
          <AssistantPrompt />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* 1. Account status */}
        <DashboardCard
          index={0}
          className="lg:col-span-2"
          title="Account status"
          icon={WalletIcon}
          action={{ label: "Invoices and statement", href: "/invoices" }}
        >
          {d.statement.isPending || d.me.isPending ? (
            <LoadingState rows={2} />
          ) : d.statement.isError ? (
            <ErrorState error={d.statement.error} onRetry={() => d.statement.refetch()} />
          ) : (
            <div>
              <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Kpi
                  label="Balance"
                  value={
                    <AnimatedNumber value={d.statement.data.closingBalance.amount} format={money} />
                  }
                />
                <Kpi
                  label="Overdue"
                  value={<AnimatedNumber value={d.statement.data.overdue.amount} format={money} />}
                  tone={d.statement.data.overdue.amount > 0 ? "danger" : undefined}
                />
                {me?.credit?.onAccount && me.credit.limit ? (
                  <Kpi
                    label="Credit available"
                    value={
                      <AnimatedNumber value={me.credit.available?.amount ?? 0} format={money} />
                    }
                    hint={`of ${formatMoney(me.credit.limit, { whole: true })} limit${me.credit.heldByAccountId !== me.account.id ? ", shared by the group" : ""}`}
                    tone={
                      (me.credit.available?.amount ?? 0) < me.credit.limit.amount * 0.1
                        ? "warning"
                        : undefined
                    }
                  />
                ) : (
                  <Kpi label="Payment terms" value="Pay by card" hint="No credit account" />
                )}
                <Kpi
                  label="Next payment due"
                  value={
                    d.nextPayment
                      ? formatMoney(d.nextPayment.outstanding, { whole: true })
                      : "Nothing due"
                  }
                  hint={
                    d.nextPayment
                      ? `${d.nextPayment.number}, ${formatRelativeDay(d.nextPayment.dueAt)}`
                      : undefined
                  }
                  href={d.nextPayment ? hrefFor("invoice", d.nextPayment.id) : undefined}
                />
              </dl>
              <div className="mt-5">
                <p className="mb-2 text-xs font-medium text-muted-foreground">Outstanding by age</p>
                <AgeingBar ageing={d.statement.data.ageing} />
                {d.statement.data.unallocatedCredit.amount > 0 ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Less {formatMoney(d.statement.data.unallocatedCredit)} credit on account, not
                    yet allocated.
                  </p>
                ) : null}
              </div>
              {d.invoiceInsights[0] ? (
                <InsightStrip
                  text={d.invoiceInsights[0].title}
                  action={d.invoiceInsights[0].recommendedAction}
                  href={hrefFor("invoice", d.invoiceInsights[0].relatedId)}
                />
              ) : null}
            </div>
          )}
        </DashboardCard>

        {/* 2. Quotes awaiting acceptance */}
        <DashboardCard
          index={1}
          title="Quotes awaiting you"
          icon={FileTextIcon}
          action={{ label: "All quotes", href: "/quotes" }}
        >
          {d.quotes.isPending ? (
            <LoadingState rows={3} />
          ) : d.quotes.isError ? (
            <ErrorState error={d.quotes.error} onRetry={() => d.quotes.refetch()} />
          ) : d.awaitingQuotes.length === 0 ? (
            <EmptyState
              icon={FileTextIcon}
              title="No quotes awaiting you"
              description="New quotes from Brewfitt appear here for you to accept."
              action={
                <Button asChild variant="outline" size="sm">
                  <Link href="/configurator">Build a system</Link>
                </Button>
              }
            />
          ) : (
            <ul>
              {d.awaitingQuotes.slice(0, 4).map((q) => {
                const days = Math.round(
                  (Date.parse(`${q.validUntil}T00:00:00Z`) - Date.now()) / 86_400_000,
                );
                const followUp = d.quoteFollowUps.some((i) => i.relatedId === q.id);
                return (
                  <CardRow key={q.id} href={hrefFor("quote", q.id)}>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{q.number}</p>
                      <p className="truncate text-sm text-muted-foreground">
                        {plural(q.lines.length, "line")} · expires {formatRelativeDay(q.validUntil)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium tabular-nums">
                        {formatMoney(q.total, { whole: true })}
                      </p>
                      {followUp || days <= 7 ? (
                        <StatusPill tone="warning">Expiring</StatusPill>
                      ) : null}
                    </div>
                  </CardRow>
                );
              })}
            </ul>
          )}
        </DashboardCard>

        {/* 3. Orders by stage and next deliveries */}
        <DashboardCard
          index={2}
          className="lg:col-span-2"
          title="Orders and deliveries"
          icon={PackageIcon}
          action={{ label: "All orders", href: "/orders" }}
        >
          {d.orders.isPending ? (
            <LoadingState rows={2} />
          ) : d.orders.isError ? (
            <ErrorState error={d.orders.error} onRetry={() => d.orders.refetch()} />
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
              <dl className="grid grid-cols-2 gap-2">
                {(
                  [
                    ["Confirmed", d.stageCounts.confirmed, "confirmed"],
                    ["Picking", d.stageCounts.picking, "picking"],
                    ["Dispatched", d.stageCounts.dispatched, "dispatched"],
                    ["Part-delivered", d.stageCounts.partDelivered, "part-delivered"],
                  ] as const
                ).map(([label, count, status]) => (
                  <div
                    key={label}
                    className="relative rounded-xl border p-3 transition focus-within:ring-3 focus-within:ring-ring/40 hover:border-primary/40 hover:bg-accent/40"
                  >
                    <dt className="text-xs text-muted-foreground">
                      <Link
                        href={`/orders?status=${status}`}
                        className="after:absolute after:inset-0 focus-visible:outline-none"
                      >
                        {label}
                      </Link>
                    </dt>
                    <dd className="mt-0.5 text-2xl font-semibold tabular-nums">{count}</dd>
                  </div>
                ))}
              </dl>
              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">Next deliveries</p>
                {d.nextDeliveries.length === 0 ? (
                  <p className="py-6 text-sm text-muted-foreground">
                    No open orders. Reorder from the shop when you are ready.
                  </p>
                ) : (
                  <ul>
                    {d.nextDeliveries.map((o) => (
                      <CardRow key={o.id} href={hrefFor("sales-order", o.id)}>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium">{o.number}</p>
                          <p className="truncate text-sm text-muted-foreground">
                            {o.poReference ? `${o.poReference} · ` : ""}
                            {formatMoney(o.total, { whole: true })}
                          </p>
                        </div>
                        <div className="text-right">
                          <StatusPill tone={ORDER_STATUS[o.status].tone}>
                            {ORDER_STATUS[o.status].label}
                          </StatusPill>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {formatDate(o.confirmedDate ?? o.requestedDate)}
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

        {/* 4. Stock of frequently bought products */}
        <DashboardCard
          index={3}
          title="Your regular products"
          icon={WarehouseIcon}
          action={{ label: "Stock", href: "/stock" }}
        >
          {d.priceList.isPending || d.orders.isPending ? (
            <LoadingState rows={3} />
          ) : d.priceList.isError ? (
            <ErrorState error={d.priceList.error} onRetry={() => d.priceList.refetch()} />
          ) : d.frequent.length === 0 ? (
            <EmptyState
              icon={WarehouseIcon}
              title="No regular products yet"
              description="Products you order more than once appear here with one-tap reorder."
            />
          ) : (
            <ul className="space-y-1">
              {d.frequent.map((f) => (
                <li key={f.line.productId} className="flex items-center gap-3 py-1.5">
                  <Link
                    href={hrefFor("product", f.line.productId)}
                    tabIndex={-1}
                    aria-hidden
                    className="relative size-11 shrink-0 overflow-hidden rounded-lg border bg-white"
                  >
                    <Image
                      src={f.line.product.images[0]!}
                      alt=""
                      fill
                      sizes="44px"
                      className="object-contain p-1"
                    />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={hrefFor("product", f.line.productId)}
                      className="line-clamp-1 text-sm font-medium hover:underline"
                    >
                      {f.line.product.name}
                    </Link>
                    <div className="mt-0.5 flex items-center gap-2">
                      <StockPill stock={f.line.stock} />
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {formatMoney(f.line.price)}
                      </span>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0"
                    disabled={addToBasket.isPending}
                    onClick={() =>
                      addToBasket.mutate({
                        productId: f.line.productId,
                        qty: f.lastQty,
                        name: f.line.product.name,
                      })
                    }
                    aria-label={`Reorder ${f.lastQty} × ${f.line.product.name}`}
                  >
                    <ArrowsClockwiseIcon aria-hidden />
                    {f.lastQty}
                  </Button>
                </li>
              ))}
            </ul>
          )}
          {d.stockRisks[0] ? (
            <InsightStrip
              text={d.stockRisks[0].title}
              action={d.stockRisks[0].recommendedAction}
              href={hrefFor("product", d.stockRisks[0].relatedId)}
            />
          ) : null}
        </DashboardCard>

        {/* 5. Offers and suggested products */}
        <DashboardCard
          index={4}
          className="lg:col-span-2"
          title="Suggested for you"
          icon={SparkleIcon}
          action={{ label: "Shop", href: "/shop" }}
          headerExtra={<SimulatedBadge className="hidden sm:inline-flex" />}
        >
          {d.insights.isPending ? (
            <LoadingState rows={2} />
          ) : d.insights.isError ? (
            <ErrorState error={d.insights.error} onRetry={() => d.insights.refetch()} />
          ) : d.suggestions.length === 0 ? (
            <EmptyState
              icon={SparkleIcon}
              title="No suggestions right now"
              description="Suggestions appear when a regular item is due or similar venues buy something you do not."
            />
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {d.suggestions.slice(0, 4).map((i) => (
                <AIInsightCard key={i.id} insight={i} compact />
              ))}
            </div>
          )}
          {d.insights.data?.length ? (
            <AllInsightsButton count={d.insights.data.length} className="mt-3" />
          ) : null}
        </DashboardCard>

        {/* 6. Conversations */}
        <DashboardCard
          index={5}
          title="Conversations"
          icon={ChatsCircleIcon}
          action={{ label: "Messages", href: "/messages" }}
          headerExtra={
            d.needsReply.length ? (
              <StatusPill tone="info">{d.needsReply.length} new</StatusPill>
            ) : null
          }
        >
          {d.threads.isPending ? (
            <LoadingState rows={3} />
          ) : d.threads.isError ? (
            <ErrorState error={d.threads.error} onRetry={() => d.threads.refetch()} />
          ) : d.recentThreads.length === 0 ? (
            <EmptyState
              icon={ChatsCircleIcon}
              title="No conversations yet"
              action={
                <Button asChild size="sm" variant="outline">
                  <Link href="/messages?new=1">Message Brewfitt</Link>
                </Button>
              }
            />
          ) : (
            <ul>
              {[...d.needsReply, ...d.recentThreads.filter((t) => t.unreadCount === 0)]
                .slice(0, 4)
                .map((t) => (
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
                      <p className="text-xs text-muted-foreground">
                        {t.unreadCount ? `${plural(t.unreadCount, "unread message")} · ` : ""}
                        {formatSince(t.lastMessageAt)}
                      </p>
                    </div>
                  </CardRow>
                ))}
            </ul>
          )}
        </DashboardCard>

        {/* 7. Cases and jobs */}
        <DashboardCard
          index={6}
          className="lg:col-span-2"
          title="After-sales and installs"
          icon={LifebuoyIcon}
          action={{ label: "Customer Support", href: "/cases" }}
        >
          {d.cases.isPending || d.jobs.isPending ? (
            <LoadingState rows={2} />
          ) : d.cases.isError ? (
            <ErrorState error={d.cases.error} onRetry={() => d.cases.refetch()} />
          ) : (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">Open cases</p>
                {d.openCases.length === 0 ? (
                  <p className="py-4 text-sm text-muted-foreground">
                    No cases open.{" "}
                    <Link href="/cases?new=1" className="font-medium text-primary hover:underline">
                      Raise a case
                    </Link>
                  </p>
                ) : (
                  <ul>
                    {d.openCases.slice(0, 3).map((c) => (
                      <CardRow key={c.id} href={hrefFor("case", c.id)}>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{c.subject}</p>
                          <p className="text-xs text-muted-foreground">
                            {c.number} · updated {formatSince(c.updatedAt)}
                          </p>
                        </div>
                        <StatusPill tone={CASE_STATUS[c.status].tone}>
                          {CASE_STATUS[c.status].label}
                        </StatusPill>
                      </CardRow>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">
                  Supply and install jobs
                </p>
                {d.activeJobs.length === 0 ? (
                  <p className="py-4 text-sm text-muted-foreground">No installs scheduled.</p>
                ) : (
                  <ul>
                    {d.activeJobs.slice(0, 3).map((j) => (
                      <CardRow key={j.id} href={hrefFor("job", j.id)}>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{j.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(j.scheduledDate)} · {j.engineerName}
                          </p>
                        </div>
                        <StatusPill tone={JOB_STATUS[j.status].tone}>
                          {JOB_STATUS[j.status].label}
                        </StatusPill>
                      </CardRow>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </DashboardCard>

        {/* 8. Brewfitt contacts */}
        <DashboardCard
          index={7}
          title="Your Brewfitt contacts"
          icon={UsersIcon}
          action={{ label: "Account", href: "/account" }}
        >
          {d.me.isPending ? (
            <LoadingState rows={3} />
          ) : d.me.isError ? (
            <ErrorState error={d.me.error} onRetry={() => d.me.refetch()} />
          ) : (
            <ul className="space-y-3">
              {d.me.data.brewfittTeam.slice(0, 4).map((m) => (
                <li key={m.id}>
                  <TeamMemberCard member={m} compact />
                </li>
              ))}
            </ul>
          )}
        </DashboardCard>

        <DashboardCard
          index={8}
          className="lg:col-span-3"
          title="Recent activity"
          icon={BellSimpleIcon}
          action={{ label: "Notifications", href: "/notifications" }}
        >
          {d.notifications.isPending ? (
            <LoadingState rows={2} />
          ) : d.activity.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing new in the last few days.</p>
          ) : (
            <ul className="grid grid-cols-1 gap-x-6 md:grid-cols-2">
              {d.activity.map((n) => (
                <CardRow key={n.id} href={hrefFor(n.relatedType, n.relatedId)}>
                  <span
                    aria-hidden
                    className={cn(
                      "size-2 shrink-0 rounded-full",
                      n.read ? "bg-muted-foreground/30" : "bg-primary",
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{n.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{n.body}</p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatSince(n.createdAt)}
                  </span>
                </CardRow>
              ))}
            </ul>
          )}
        </DashboardCard>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
  tone,
  href,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: "danger" | "warning";
  href?: string;
}) {
  // A <dl> may only group <dt>/<dd> in <div>s, so a linked KPI puts the link in its term and stretches it over the tile.
  const body = (
    <>
      <dt className="text-xs text-muted-foreground">
        {href ? (
          <Link
            href={href}
            className="after:absolute after:inset-0 after:rounded-lg focus-visible:outline-none focus-visible:after:ring-3 focus-visible:after:ring-ring/40"
          >
            {label}
          </Link>
        ) : (
          label
        )}
      </dt>
      <dd
        className={cn(
          "mt-0.5 text-xl font-semibold tracking-tight sm:text-2xl",
          tone === "danger" && "text-danger",
          tone === "warning" && "text-warning",
        )}
      >
        {value}
      </dd>
      {hint ? <dd className="mt-0.5 text-xs text-muted-foreground">{hint}</dd> : null}
    </>
  );
  return href ? (
    <div className="relative -m-2 rounded-lg p-2 hover:bg-accent/50">{body}</div>
  ) : (
    <div>{body}</div>
  );
}

function InsightStrip({ text, action, href }: { text: string; action: string; href: string }) {
  return (
    <Link
      href={href}
      className="mt-4 flex items-start gap-3 rounded-xl bg-brand-subtle/60 px-3 py-2.5 text-sm transition hover:bg-brand-subtle"
    >
      <SparkleIcon weight="fill" className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="font-medium">{text}</span>
        <span className="block text-muted-foreground">{action}</span>
      </span>
      <span className="shrink-0 text-[11px] font-medium text-brand-subtle-foreground">
        Simulated insight
      </span>
    </Link>
  );
}

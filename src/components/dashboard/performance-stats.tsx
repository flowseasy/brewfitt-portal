"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ChartLineUpIcon } from "@phosphor-icons/react";
import { BarChart, monthBarLabels } from "@/components/shared/bar-chart";
import { ErrorState, LoadingState } from "@/components/shared/states";
import { usePersonaKey } from "@/features/session/use-session";
import { api, queryKeys } from "@/lib/api";
import { formatMoney, plural } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Money } from "@/types";

type Tone = "success" | "warning" | "danger";

const whole = (m: Money | null) => (m ? formatMoney(m, { whole: true }) : "None");
const percent = (p: number | null) =>
  p === null ? "No data" : `${Number.isInteger(p) ? p : p.toFixed(1)}%`;
const one = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
/** Hours under two days read as hours, longer as days. */
const duration = (hours: number | null) =>
  hours === null ? "No data" : hours < 48 ? `${one(hours)} hours` : `${one(hours / 24)} days`;
const days = (d: number | null) =>
  d === null ? "No data" : `${one(d)} ${d === 1 ? "day" : "days"}`;

/** A stat in a definition list; linked stats put the link in the term and stretch it over the tile. */
function Stat({
  label,
  value,
  detail,
  href,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  href?: string;
  tone?: Tone;
}) {
  return (
    <div
      className={cn(
        "relative rounded-xl border bg-background p-3 sm:p-4",
        href &&
          "transition focus-within:ring-3 focus-within:ring-ring/40 hover:border-primary/40 hover:bg-accent/40",
      )}
    >
      <dt className="text-xs text-muted-foreground">
        {href ? (
          <Link href={href} className="after:absolute after:inset-0 focus-visible:outline-none">
            {label}
          </Link>
        ) : (
          label
        )}
      </dt>
      <dd
        className={cn(
          "mt-1 text-xl font-semibold tracking-tight tabular-nums sm:text-2xl",
          tone === "success" && "text-success",
          tone === "warning" && "text-warning",
          tone === "danger" && "text-danger",
        )}
      >
        {value}
      </dd>
      <dd className="mt-0.5 text-[11px] leading-snug text-muted-foreground sm:text-xs">{detail}</dd>
    </div>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  const count = Array.isArray(children) ? children.length : 1;
  return (
    <div className="mt-5 first:mt-0">
      <h3 className="mb-2.5 text-sm font-medium">{title}</h3>
      <dl
        className={cn(
          "grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-3",
          count >= 6 ? "xl:grid-cols-6" : "xl:grid-cols-5",
        )}
      >
        {children}
      </dl>
    </div>
  );
}

function Panel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby="performance-stats" className="rounded-2xl border bg-card p-5">
      <div className="mb-4 flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-subtle text-brand-subtle-foreground">
          <ChartLineUpIcon className="size-[18px]" aria-hidden />
        </span>
        <h2 id="performance-stats" className="font-medium">
          {title}
        </h2>
        <span className="text-sm text-muted-foreground">{subtitle}</span>
      </div>
      {children}
    </section>
  );
}

const onTimeTone = (p: number | null): Tone | undefined =>
  p === null ? undefined : p >= 95 ? "success" : p >= 85 ? undefined : "warning";

/** Customer dashboard: Brewfitt's service to this account over the last 12 months. */
export function CustomerStatsPanel() {
  const key = usePersonaKey();
  const stats = useQuery({
    queryKey: queryKeys.accountStats(key),
    queryFn: () => api.account.stats(),
  });

  return (
    <Panel title="Your year with Brewfitt" subtitle="Last 12 months, values ex VAT">
      {stats.isPending ? (
        <LoadingState rows={2} label="Loading your statistics" />
      ) : stats.isError ? (
        <ErrorState error={stats.error} onRetry={() => stats.refetch()} />
      ) : (
        (() => {
          const s = stats.data;
          const change = s.spendTrend.changePercent;
          return (
            <>
              <Group title="Orders and quotes">
                <Stat
                  label="Orders placed"
                  value={whole(s.orderValue)}
                  detail={plural(s.orderCount, "order")}
                  href="/orders"
                />
                <Stat
                  label="Average order value"
                  value={whole(s.averageOrderValue)}
                  detail={
                    s.orderCount ? `Across ${plural(s.orderCount, "order")}` : "No orders yet"
                  }
                  href="/orders"
                />
                <Stat
                  label="Spend, last 6 months"
                  value={whole(s.spendTrend.recent)}
                  detail={
                    change === null
                      ? "No spend in the 6 months before"
                      : `${change >= 0 ? "Up" : "Down"} ${Math.abs(change)}% on the 6 months before (${whole(s.spendTrend.previous)})`
                  }
                  tone={change !== null && change >= 0 ? "success" : undefined}
                />
                <Stat
                  label="Quote conversion"
                  value={percent(s.quoteConversion.percent)}
                  detail={
                    s.quoteConversion.decided
                      ? `${s.quoteConversion.accepted} of ${plural(s.quoteConversion.decided, "quote")} accepted`
                      : "No quotes decided yet"
                  }
                  href="/quotes"
                />
                <Stat
                  label="Open back orders"
                  value={String(s.backOrders.units)}
                  detail={
                    s.backOrders.lines
                      ? `${plural(s.backOrders.units, "unit")} on ${plural(s.backOrders.lines, "order line")}`
                      : "Nothing on back order"
                  }
                  tone={s.backOrders.units ? "warning" : undefined}
                  href="/orders?status=part-delivered"
                />
              </Group>
              <Group title="Brewfitt's service to you">
                <Stat
                  label="On-time delivery"
                  value={percent(s.onTimeDelivery.percent)}
                  detail={
                    s.onTimeDelivery.total
                      ? `${s.onTimeDelivery.onTime} of ${plural(s.onTimeDelivery.total, "delivery", "deliveries")} by the confirmed date`
                      : "No deliveries in the last 12 months"
                  }
                  tone={onTimeTone(s.onTimeDelivery.percent)}
                  href="/orders?status=delivered"
                />
                <Stat
                  label="Delivered in full"
                  value={percent(s.fillRate.percent)}
                  detail={
                    s.fillRate.total
                      ? `${s.fillRate.inFull} of ${plural(s.fillRate.total, "order")} complete on the first delivery`
                      : "No deliveries yet"
                  }
                  tone={onTimeTone(s.fillRate.percent)}
                />
                <Stat
                  label="Order to delivery"
                  value={days(s.averageLeadDays)}
                  detail="Average from placing an order to its final delivery"
                />
                <Stat
                  label="Support cases resolved"
                  value={days(s.caseResolution.averageDays)}
                  detail={
                    s.caseResolution.resolved
                      ? `Average across ${plural(s.caseResolution.resolved, "resolved case")}`
                      : "No cases resolved yet"
                  }
                  href="/cases"
                />
                <Stat
                  label="Account team reply time"
                  value={duration(s.responseTime.averageHours)}
                  detail={
                    s.responseTime.replies
                      ? `Average across ${plural(s.responseTime.replies, "reply", "replies")}`
                      : "No messages answered yet"
                  }
                  href="/messages"
                />
              </Group>
            </>
          );
        })()
      )}
    </Panel>
  );
}

/** Supplier dashboard: delivery performance and Brewfitt's purchasing over the last 12 months. */
export function SupplierStatsPanel() {
  const key = usePersonaKey();
  const perf = useQuery({
    queryKey: queryKeys.supplierPerformance(key),
    queryFn: () => api.supplierProducts.performance(),
  });

  return (
    <Panel title="Your performance with Brewfitt" subtitle="Last 12 months, values ex VAT">
      {perf.isPending ? (
        <LoadingState rows={2} label="Loading your statistics" />
      ) : perf.isError ? (
        <ErrorState error={perf.error} onRetry={() => perf.refetch()} />
      ) : (
        (() => {
          const p = perf.data;
          const orders = p.monthly.reduce((s, m) => s + m.orders, 0);
          const withOrders = p.monthly.filter((m) => m.average);
          const peak = [...p.monthly].sort((a, b) => b.total.amount - a.total.amount)[0];
          const highestAverage = [...withOrders].sort(
            (a, b) => (b.average?.amount ?? 0) - (a.average?.amount ?? 0),
          )[0];
          const certificates = p.certificates.expired + p.certificates.expiringSoon;
          return (
            <>
              <Group title="Business with Brewfitt">
                <Stat
                  label="Orders from Brewfitt"
                  value={whole(p.last12Months)}
                  detail={plural(orders, "purchase order")}
                  href="/orders"
                />
                <Stat
                  label="Average order value"
                  value={whole(p.averageOrderValue)}
                  detail={orders ? `Across ${plural(orders, "purchase order")}` : "No orders yet"}
                />
                <Stat
                  label={`Share of ${p.sector} spend`}
                  value={`${one(p.spendShare)}%`}
                  detail={`Of Brewfitt's spend with ${plural(p.supplierCount, p.sector)}`}
                />
                <Stat
                  label="RFQ win rate"
                  value={percent(p.rfqs.winRate)}
                  detail={
                    p.rfqs.decided
                      ? `${p.rfqs.awarded} of ${plural(p.rfqs.decided, "decided RFQ")} won`
                      : "No RFQs decided yet"
                  }
                  href="/quotes"
                />
                <Stat
                  label="Invoice to payment"
                  value={days(p.paymentDays)}
                  detail="Average from invoice to Brewfitt's payment"
                  href="/invoices"
                />
              </Group>
              <Group title="Your service to Brewfitt">
                <Stat
                  label="On-time delivery"
                  value={percent(p.onTimeDelivery.percent)}
                  detail={
                    p.onTimeDelivery.total
                      ? `${p.onTimeDelivery.onTime} of ${plural(p.onTimeDelivery.total, "delivery", "deliveries")} by the expected date`
                      : "No deliveries in the last 12 months"
                  }
                  tone={onTimeTone(p.onTimeDelivery.percent)}
                  href="/orders"
                />
                <Stat
                  label="Time to acknowledge"
                  value={duration(p.acknowledgement.averageHours)}
                  detail={
                    p.acknowledgement.acknowledged
                      ? `Average across ${plural(p.acknowledgement.acknowledged, "purchase order")}`
                      : "No purchase orders acknowledged yet"
                  }
                  tone={
                    p.acknowledgement.averageHours !== null && p.acknowledgement.averageHours > 48
                      ? "warning"
                      : undefined
                  }
                />
                <Stat
                  label="RFQ response rate"
                  value={percent(p.rfqs.responseRate)}
                  detail={
                    p.rfqs.total
                      ? `${p.rfqs.responded} of ${plural(p.rfqs.total, "RFQ")} answered`
                      : "No RFQs closed yet"
                  }
                  href="/quotes"
                />
                <Stat
                  label="After-sales issues"
                  value={String(p.afterSalesIssues.total)}
                  detail={`${p.afterSalesIssues.open} open · ${p.afterSalesIssues.last12Months} in the last 12 months, on your products`}
                  tone={p.afterSalesIssues.open ? "warning" : undefined}
                />
                <Stat
                  label="Awaiting approval"
                  value={String(p.awaitingApproval.products)}
                  detail={`${plural(p.awaitingApproval.products, "product")} and ${plural(p.awaitingApproval.offers, "offer")} with Brewfitt`}
                  href="/products"
                />
                <Stat
                  label="Certificates due"
                  value={String(certificates)}
                  detail={
                    certificates
                      ? `${p.certificates.expired} expired · ${p.certificates.expiringSoon} expiring within 60 days`
                      : "All certificates current for 60 days"
                  }
                  tone={p.certificates.expired ? "danger" : certificates ? "warning" : "success"}
                  href="/documents?category=compliance"
                />
              </Group>
              <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div>
                  <h3 className="mb-3 text-sm font-medium">Order value by month</h3>
                  <BarChart
                    bars={p.monthly.map((m) => ({
                      key: m.month,
                      ...monthBarLabels(m.month),
                      value: m.total.amount,
                      display: formatMoney(m.total, { whole: true }),
                    }))}
                    summary={`Brewfitt ordered ${whole(p.last12Months)} from you across ${plural(orders, "purchase order")}.${peak && peak.total.amount ? ` The busiest month was ${monthBarLabels(peak.month).label} at ${whole(peak.total)}.` : ""}`}
                  />
                </div>
                <div>
                  <h3 className="mb-3 text-sm font-medium">Average order value by month</h3>
                  <BarChart
                    bars={p.monthly.map((m) => ({
                      key: m.month,
                      ...monthBarLabels(m.month),
                      value: m.average?.amount ?? 0,
                      display: m.average ? formatMoney(m.average, { whole: true }) : "No orders",
                    }))}
                    summary={`Average ${whole(p.averageOrderValue)} per purchase order.${highestAverage ? ` Highest in ${monthBarLabels(highestAverage.month).label} at ${whole(highestAverage.average)}.` : ""}`}
                  />
                </div>
              </div>
            </>
          );
        })()
      )}
    </Panel>
  );
}

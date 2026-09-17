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

const whole = (m: Money | null) => (m ? formatMoney(m, { whole: true }) : "None");
const percent = (p: number | null) =>
  p === null ? "No data" : `${Number.isInteger(p) ? p : p.toFixed(1)}%`;

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
  tone?: "success" | "warning" | "danger";
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

const onTimeTone = (p: number | null) =>
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
        <LoadingState rows={1} label="Loading your statistics" />
      ) : stats.isError ? (
        <ErrorState error={stats.error} onRetry={() => stats.refetch()} />
      ) : (
        <dl className="grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-4">
          <Stat
            label="On-time delivery"
            value={percent(stats.data.onTimeDelivery.percent)}
            detail={
              stats.data.onTimeDelivery.total
                ? `${stats.data.onTimeDelivery.onTime} of ${plural(stats.data.onTimeDelivery.total, "delivery", "deliveries")} by the confirmed date`
                : "No deliveries in the last 12 months"
            }
            tone={onTimeTone(stats.data.onTimeDelivery.percent)}
            href="/orders?status=delivered"
          />
          <Stat
            label="Orders placed"
            value={whole(stats.data.orderValue)}
            detail={plural(stats.data.orderCount, "order")}
            href="/orders"
          />
          <Stat
            label="Average order value"
            value={whole(stats.data.averageOrderValue)}
            detail={
              stats.data.orderCount
                ? `Across ${plural(stats.data.orderCount, "order")}`
                : "No orders yet"
            }
            href="/orders"
          />
          <Stat
            label="Quote conversion"
            value={percent(stats.data.quoteConversion.percent)}
            detail={
              stats.data.quoteConversion.decided
                ? `${stats.data.quoteConversion.accepted} of ${plural(stats.data.quoteConversion.decided, "quote")} accepted`
                : "No quotes decided yet"
            }
            href="/quotes"
          />
        </dl>
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
          return (
            <>
              <dl className="grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-4">
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
                  label="After-sales issues"
                  value={String(p.afterSalesIssues.total)}
                  detail={`${p.afterSalesIssues.open} open · ${p.afterSalesIssues.last12Months} in the last 12 months, on your products`}
                  tone={p.afterSalesIssues.open ? "warning" : undefined}
                />
              </dl>
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

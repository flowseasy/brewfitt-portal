"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ChartLineUpIcon } from "@phosphor-icons/react";
import { BarChart, monthBarLabels, penceAxis } from "@/components/shared/bar-chart";
import { ErrorState, LoadingState } from "@/components/shared/states";
import { usePersonaKey } from "@/features/session/use-session";
import { api, queryKeys } from "@/lib/api";
import { formatMoney, plural } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { CustomerStats, Money } from "@/types";

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
  actions,
  children,
}: {
  title: string;
  subtitle: string;
  actions?: ReactNode;
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
        {actions ? <div className="w-full sm:ml-auto sm:w-auto">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}

type Month = { month: string; total: Money; orders: number; average: Money | null };

/** Order value and average order value by month, side by side, with value axes. */
function MonthlyCharts({
  monthly,
  total,
  average,
  noun,
  who,
}: {
  monthly: Month[];
  total: Money;
  average: Money | null;
  noun: string;
  who: string;
}) {
  const orders = monthly.reduce((s, m) => s + m.orders, 0);
  const peak = [...monthly].sort((a, b) => b.total.amount - a.total.amount)[0];
  const highestAverage = monthly
    .filter((m) => m.average)
    .sort((a, b) => (b.average?.amount ?? 0) - (a.average?.amount ?? 0))[0];
  return (
    <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div>
        <h3 className="mb-3 text-sm font-medium">Order value by month</h3>
        <BarChart
          axis={penceAxis}
          bars={monthly.map((m) => ({
            key: m.month,
            ...monthBarLabels(m.month),
            value: m.total.amount,
            display: formatMoney(m.total, { whole: true }),
          }))}
          summary={`${who} ${whole(total)} across ${plural(orders, noun)}.${peak && peak.total.amount ? ` The busiest month was ${monthBarLabels(peak.month).label} at ${whole(peak.total)}.` : ""}`}
        />
      </div>
      <div>
        <h3 className="mb-3 text-sm font-medium">Average order value by month</h3>
        <BarChart
          axis={penceAxis}
          bars={monthly.map((m) => ({
            key: m.month,
            ...monthBarLabels(m.month),
            value: m.average?.amount ?? 0,
            display: m.average ? formatMoney(m.average, { whole: true }) : "No orders",
          }))}
          summary={`Average ${whole(average)} per ${noun}.${highestAverage ? ` Highest in ${monthBarLabels(highestAverage.month).label} at ${whole(highestAverage.average)}.` : ""}`}
        />
      </div>
    </div>
  );
}

type GroupView = "total" | "sites";

/** Group contacts switch between the group total and a site-by-site comparison. */
function GroupViewToggle({
  value,
  onChange,
}: {
  value: GroupView;
  onChange: (v: GroupView) => void;
}) {
  const options: { value: GroupView; label: string }[] = [
    { value: "total", label: "Group total" },
    { value: "sites", label: "Compare sites" },
  ];
  return (
    <div
      role="group"
      aria-label="Statistics view"
      className="inline-flex w-full rounded-full border bg-muted/50 p-0.5 sm:w-auto"
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "flex-1 rounded-full px-3 py-1 text-sm transition focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none sm:flex-none",
            value === o.value
              ? "bg-background font-medium text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Orders placed, order count, average order value and share of group spend per site, with a site picker for the charts. */
function SiteComparison({ stats }: { stats: CustomerStats }) {
  const sites = stats.sites ?? [];
  const [selected, setSelected] = useState<string>("all");
  const max = Math.max(1, ...sites.map((x) => x.orderValue.amount));
  const chosen = sites.find((x) => x.accountId === selected);

  return (
    <div>
      <h3 className="mb-2.5 text-sm font-medium">Orders by site</h3>
      <ul className="space-y-2 sm:hidden">
        {sites.map((site) => {
          const share = stats.orderValue.amount
            ? Math.round((site.orderValue.amount / stats.orderValue.amount) * 100)
            : 0;
          const active = selected === site.accountId;
          return (
            <li key={site.accountId}>
              <button
                type="button"
                onClick={() => setSelected(active ? "all" : site.accountId)}
                aria-pressed={active}
                className={cn(
                  "w-full rounded-xl border p-3 text-left transition focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none",
                  active ? "border-primary bg-brand-subtle/40" : "bg-background",
                )}
              >
                <span className="flex items-baseline justify-between gap-2">
                  <span className="font-medium">{site.name}</span>
                  <span className="font-semibold tabular-nums">{whole(site.orderValue)}</span>
                </span>
                <span className="mt-2 block h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
                  <span
                    className="block h-full rounded-full bg-chart-1"
                    style={{ width: `${(site.orderValue.amount / max) * 100}%` }}
                  />
                </span>
                <span className="mt-1.5 block text-xs text-muted-foreground">
                  {plural(site.orderCount, "order")} · average {whole(site.averageOrderValue)} ·{" "}
                  {share}% of group
                </span>
              </button>
            </li>
          );
        })}
        <li className="flex items-baseline justify-between rounded-xl bg-muted/40 px-3 py-2 text-sm">
          <span className="font-medium">All sites</span>
          <span className="tabular-nums">
            <span className="font-semibold">{whole(stats.orderValue)}</span>
            <span className="text-muted-foreground"> · {plural(stats.orderCount, "order")}</span>
          </span>
        </li>
      </ul>
      <div className="hidden overflow-x-auto rounded-xl border sm:block">
        <table className="w-full min-w-[34rem] text-sm">
          <caption className="sr-only">
            Orders placed, number of orders, average order value and share of group spend for each
            site, last 12 months
          </caption>
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">
                Site
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                Orders placed
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                Orders
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                Average order
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                Share
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {sites.map((site) => {
              const share = stats.orderValue.amount
                ? Math.round((site.orderValue.amount / stats.orderValue.amount) * 100)
                : 0;
              const active = selected === site.accountId;
              return (
                <tr key={site.accountId} className={cn(active && "bg-brand-subtle/40")}>
                  <th scope="row" className="px-3 py-2.5 text-left font-medium">
                    <button
                      type="button"
                      onClick={() => setSelected(active ? "all" : site.accountId)}
                      aria-pressed={active}
                      className="rounded text-left hover:text-primary hover:underline focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none"
                    >
                      {site.name}
                    </button>
                  </th>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="w-20 shrink-0 font-medium tabular-nums">
                        {whole(site.orderValue)}
                      </span>
                      <span
                        className="h-2 flex-1 overflow-hidden rounded-full bg-muted"
                        aria-hidden
                      >
                        <span
                          className="block h-full rounded-full bg-chart-1"
                          style={{ width: `${(site.orderValue.amount / max) * 100}%` }}
                        />
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{site.orderCount}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {whole(site.averageOrderValue)}
                  </td>
                  <td className="px-3 py-2.5 text-right text-muted-foreground tabular-nums">
                    {share}%
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="border-t bg-muted/30 text-sm">
            <tr>
              <th scope="row" className="px-3 py-2 text-left font-medium">
                All sites
              </th>
              <td className="px-3 py-2 font-medium tabular-nums">{whole(stats.orderValue)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{stats.orderCount}</td>
              <td className="px-3 py-2 text-right tabular-nums">
                {whole(stats.averageOrderValue)}
              </td>
              <td className="px-3 py-2 text-right text-muted-foreground tabular-nums">100%</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div
        className="mt-5 flex flex-wrap items-center gap-1.5"
        role="group"
        aria-label="Show charts for"
      >
        <span className="mr-1 text-sm font-medium">Charts for</span>
        {[{ accountId: "all", name: "All sites" }, ...sites].map((x) => (
          <button
            key={x.accountId}
            type="button"
            aria-pressed={selected === x.accountId}
            onClick={() => setSelected(x.accountId)}
            className={cn(
              "rounded-full border px-2.5 py-1 text-xs transition focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none",
              selected === x.accountId
                ? "border-primary bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
            )}
          >
            {x.name}
          </button>
        ))}
      </div>
      <MonthlyCharts
        monthly={chosen ? chosen.monthly : stats.monthly}
        total={chosen ? chosen.orderValue : stats.orderValue}
        average={chosen ? chosen.averageOrderValue : stats.averageOrderValue}
        noun="order"
        who={chosen ? `${chosen.name} ordered` : "Your sites ordered"}
      />
    </div>
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
  const [view, setView] = useState<GroupView>("total");
  const canCompare = !!stats.data?.sites?.length;
  const comparing = canCompare && view === "sites";

  return (
    <Panel
      title="Your year with Brewfitt"
      subtitle="Last 12 months, values ex VAT"
      actions={canCompare ? <GroupViewToggle value={view} onChange={setView} /> : undefined}
    >
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
              {comparing ? (
                <SiteComparison stats={s} />
              ) : (
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
                  <MonthlyCharts
                    monthly={s.monthly}
                    total={s.orderValue}
                    average={s.averageOrderValue}
                    noun="order"
                    who="You ordered"
                  />
                </>
              )}
              <Group
                title={comparing ? "Brewfitt's service to your group" : "Brewfitt's service to you"}
              >
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
              <MonthlyCharts
                monthly={p.monthly}
                total={p.last12Months}
                average={p.averageOrderValue}
                noun="purchase order"
                who="Brewfitt ordered"
              />
            </>
          );
        })()
      )}
    </Panel>
  );
}

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { MagnifyingGlassIcon, PlusIcon, SparkleIcon, WarehouseIcon } from "@phosphor-icons/react";
import { AIInsightCard, SimulatedBadge } from "@/components/ai/ai-insight-card";
import { BarChart } from "@/components/shared/bar-chart";
import { FilterBar, FilterSelect, SearchInput } from "@/components/shared/filter-bar";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/states";
import { StatusPill } from "@/components/shared/status-pill";
import { StockPill } from "@/components/shared/stock-pill";
import { StatusTabs } from "@/components/shared/status-tabs";
import { NotifyMeButton, ProductImage } from "@/components/shop/product-card";
import { Button } from "@/components/ui/button";
import { useIsSupplier, usePersonaKey } from "@/features/session/use-session";
import { useAddToBasket } from "@/features/shop/use-add-to-basket";
import { api, queryKeys } from "@/lib/api";
import { formatDate, formatMoney, plural } from "@/lib/format";
import { hrefFor } from "@/lib/links";
import { STOCK_STATUS } from "@/lib/status";
import { cn } from "@/lib/utils";
import type { StockForecast, StockPosition } from "@/types";

export default function StockPage() {
  return useIsSupplier() ? <SupplierStock /> : <CustomerStock />;
}

type Filter = "all" | "regular" | StockPosition["status"];

function CustomerStock() {
  const key = usePersonaKey();
  const priceList = useQuery({
    queryKey: queryKeys.priceList(key),
    queryFn: () => api.priceList.get(),
  });
  const orders = useQuery({
    queryKey: queryKeys.salesOrders(key),
    queryFn: () => api.orders.salesOrders(),
  });
  const insights = useQuery({
    queryKey: queryKeys.insights(key),
    queryFn: () => api.ai.insights(),
  });
  const add = useAddToBasket();
  const [filter, setFilter] = useState<Filter>("regular");
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(50);

  const regular = useMemo(() => {
    const since = new Date(Date.now() - 365 * 86_400_000).toISOString();
    return new Set(
      (orders.data ?? [])
        .filter((o) => o.status !== "cancelled" && o.createdAt >= since)
        .flatMap((o) => o.lines.map((l) => l.productId)),
    );
  }, [orders.data]);
  const lines = priceList.data?.lines ?? [];
  const risks = (insights.data ?? []).filter((i) => i.category === "stock-out-risk");
  const term = search.trim().toLowerCase();
  const rank = { out: 0, low: 1, "on-order": 2, "in-stock": 3 } as const;
  const filtered = lines
    .filter((l) =>
      filter === "all"
        ? true
        : filter === "regular"
          ? regular.has(l.productId)
          : l.stock?.status === filter,
    )
    .filter(
      (l) =>
        !term ||
        l.product.name.toLowerCase().includes(term) ||
        l.product.sku.toLowerCase().includes(term),
    )
    .sort(
      (a, b) =>
        rank[a.stock?.status ?? "in-stock"] - rank[b.stock?.status ?? "in-stock"] ||
        a.product.name.localeCompare(b.product.name),
    );
  const count = (f: Filter) =>
    lines.filter((l) =>
      f === "all" ? true : f === "regular" ? regular.has(l.productId) : l.stock?.status === f,
    ).length;

  return (
    <div>
      <PageHeader
        title="Stock"
        description="Availability at Brewfitt for the products on your price list, with expected dates for items on order."
      />

      {risks.length ? (
        <section aria-labelledby="risks" className="mb-6">
          <h2 id="risks" className="mb-3 flex items-center gap-2 font-medium">
            <SparkleIcon className="size-5 text-primary" aria-hidden />
            Products you buy that are running short
            <SimulatedBadge />
          </h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {risks.slice(0, 4).map((i) => (
              <AIInsightCard key={i.id} insight={i} compact />
            ))}
          </div>
        </section>
      ) : null}

      <StatusTabs
        tabs={[
          { value: "regular" as Filter, label: "Products you buy", count: count("regular") },
          { value: "low" as Filter, label: "Low", count: count("low") },
          { value: "out" as Filter, label: "Out of stock", count: count("out") },
          { value: "on-order" as Filter, label: "On order", count: count("on-order") },
          { value: "all" as Filter, label: "All products", count: count("all") },
        ]}
        value={filter}
        onChange={(f) => {
          setFilter(f);
          setLimit(50);
        }}
        label="Stock status"
      />
      <div className="mb-4">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search by product or SKU"
          label="Search stock"
          className="max-w-md"
        />
      </div>

      {priceList.isPending ? (
        <LoadingState rows={6} label="Loading stock" />
      ) : priceList.isError ? (
        <ErrorState error={priceList.error} onRetry={() => priceList.refetch()} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={term ? MagnifyingGlassIcon : WarehouseIcon}
          title={
            term
              ? "No products match"
              : filter === "regular"
                ? "No orders in the last 12 months"
                : "Nothing in this status"
          }
          description={filter === "out" ? "Everything on your price list is available." : undefined}
        />
      ) : (
        <>
          <ul className="grid grid-cols-1 gap-2 lg:grid-cols-2">
            {filtered.slice(0, limit).map((l) => {
              const st = l.stock;
              return (
                <li
                  key={l.productId}
                  className="flex items-center gap-3 rounded-2xl border bg-card p-3"
                >
                  <ProductImage
                    src={l.product.images[0]}
                    alt=""
                    sizes="56px"
                    className="size-14 shrink-0 rounded-xl border"
                  />
                  <div className="min-w-0 flex-1">
                    <Link
                      href={hrefFor("product", l.productId)}
                      className="line-clamp-1 text-sm font-medium hover:underline"
                    >
                      {l.product.name}
                    </Link>
                    <p className="font-mono text-[11px] text-muted-foreground">{l.product.sku}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <StockPill stock={st} />
                      {st && st.available > 0 ? <span>{st.available} available</span> : null}
                      {st?.expectedAt ? <span>More due {formatDate(st.expectedAt)}</span> : null}
                    </div>
                  </div>
                  {st?.status === "out" ? (
                    <NotifyMeButton productId={l.productId} name={l.product.name} />
                  ) : (
                    <Button
                      size="icon"
                      variant="outline"
                      className="rounded-full"
                      onClick={() =>
                        add.mutate({ productId: l.productId, qty: 1, name: l.product.name })
                      }
                      disabled={add.isPending}
                      aria-label={`Add ${l.product.name} to basket`}
                    >
                      <PlusIcon aria-hidden />
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
          {filtered.length > limit ? (
            <div className="mt-4 flex justify-center">
              <Button variant="outline" onClick={() => setLimit((n) => n + 50)}>
                Show more
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

const monthName = (m: string) =>
  new Intl.DateTimeFormat("en-GB", { month: "long", timeZone: "UTC" }).format(
    new Date(`${m}-01T00:00:00Z`),
  );

function SupplierStock() {
  const key = usePersonaKey();
  const stock = useQuery({ queryKey: queryKeys.stock(key), queryFn: () => api.stock.list() });
  const forecast = useQuery({
    queryKey: queryKeys.forecast(key),
    queryFn: () => api.stock.forecast(),
  });
  const products = useQuery({
    queryKey: queryKeys.products(key),
    queryFn: () => api.products.list(),
  });
  const priceList = useQuery({
    queryKey: queryKeys.priceList(key),
    queryFn: () => api.priceList.get(),
  });
  const insights = useQuery({
    queryKey: queryKeys.insights(key),
    queryFn: () => api.ai.insights(),
  });
  const [status, setStatus] = useState<"all" | "below">("below");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const product = useMemo(
    () => new Map((products.data ?? []).map((p) => [p.id, p])),
    [products.data],
  );
  const cost = useMemo(
    () => new Map((priceList.data?.lines ?? []).map((l) => [l.productId, l.price])),
    [priceList.data],
  );
  const forecastById = useMemo(
    () => new Map((forecast.data ?? []).map((f) => [f.productId, f])),
    [forecast.data],
  );
  const term = search.trim().toLowerCase();
  const rows = (stock.data ?? [])
    .filter((s) =>
      status === "below" ? s.onHand < s.minimumLevel || !!forecastById.get(s.productId) : true,
    )
    .filter(
      (s) =>
        !term ||
        (product.get(s.productId)?.name ?? "").toLowerCase().includes(term) ||
        (product.get(s.productId)?.sku ?? "").toLowerCase().includes(term),
    )
    .sort(
      (a, b) =>
        Number(b.onHand < b.minimumLevel) - Number(a.onHand < a.minimumLevel) ||
        (forecastById.get(b.productId)?.averageMonthlyQuantity ?? 0) -
          (forecastById.get(a.productId)?.averageMonthlyQuantity ?? 0),
    );
  const focus: StockForecast | undefined = forecastById.get(selected ?? "") ?? forecast.data?.[0];
  const next3 = (forecast.data ?? []).reduce(
    (s, f) => s + f.months.reduce((x, m) => x + m.value.amount, 0),
    0,
  );

  return (
    <div>
      <PageHeader
        title="Stock and forecast"
        description="Brewfitt's holding of the items you supply, minimum levels, what is on order from you, and forecast demand for the next three months."
      />

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <section aria-labelledby="forecast" className="rounded-2xl border bg-card p-5">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h2 id="forecast" className="font-medium">
              Forecast demand
            </h2>
            <SimulatedBadge />
          </div>
          {forecast.isPending ? (
            <LoadingState rows={2} />
          ) : forecast.isError ? (
            <ErrorState error={forecast.error} onRetry={() => forecast.refetch()} />
          ) : !focus ? (
            <EmptyState
              icon={WarehouseIcon}
              title="No purchases in the last six months to forecast from"
            />
          ) : (
            <>
              <label htmlFor="forecast-product" className="sr-only">
                Product to forecast
              </label>
              <select
                id="forecast-product"
                value={focus.productId}
                onChange={(e) => setSelected(e.target.value)}
                className="mb-4 h-9 w-full rounded-full border bg-background px-3 text-sm"
              >
                {(forecast.data ?? []).map((f) => (
                  <option key={f.productId} value={f.productId}>
                    {product.get(f.productId)?.name ?? f.productId}
                  </option>
                ))}
              </select>
              <BarChart
                height="h-32"
                bars={focus.months.map((m) => ({
                  key: m.month,
                  label: monthName(m.month),
                  shortLabel: monthName(m.month).slice(0, 3),
                  value: m.quantity,
                  display: `${m.quantity} units, ${formatMoney(m.value, { whole: true })}`,
                }))}
                summary={`Brewfitt bought an average of ${focus.averageMonthlyQuantity} a month over the last six months. Adjusted for the season, that projects ${focus.months.map((m) => `${m.quantity} in ${monthName(m.month)}`).join(", ")}.`}
              />
              <p className="mt-3 text-sm">
                <span className="text-muted-foreground">All your items, next three months: </span>
                <span className="font-semibold tabular-nums">
                  {formatMoney({ amount: next3, currency: "GBP" }, { whole: true })}
                </span>
              </p>
            </>
          )}
        </section>
        <section aria-labelledby="supply-insights" className="space-y-3">
          <h2 id="supply-insights" className="sr-only">
            Supply insights
          </h2>
          {(insights.data ?? [])
            .filter((i) => i.category === "stock-out-risk")
            .slice(0, 2)
            .map((i) => (
              <AIInsightCard key={i.id} insight={i} compact supplier />
            ))}
        </section>
      </div>

      <FilterBar
        activeCount={[status !== "all", search].filter(Boolean).length}
        onClear={() => {
          setStatus("all");
          setSearch("");
        }}
        search={
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search your items"
            label="Search your items"
          />
        }
        filters={
          <FilterSelect
            label="Show"
            value={status}
            onChange={setStatus}
            options={[
              { value: "below", label: "Below minimum or in demand" },
              { value: "all", label: "All your items" },
            ]}
          />
        }
      />

      {stock.isPending ? (
        <LoadingState rows={6} label="Loading stock" />
      ) : stock.isError ? (
        <ErrorState error={stock.error} onRetry={() => stock.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={WarehouseIcon}
          title="Nothing to show"
          description="Switch to all items to see Brewfitt's full holding of your range."
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border bg-card">
          <table className="w-full min-w-[760px] text-sm">
            <caption className="sr-only">Brewfitt stock of your items</caption>
            <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-medium">
                  Item
                </th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">
                  On hand
                </th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">
                  Allocated
                </th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">
                  Minimum
                </th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">
                  On order from you
                </th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">
                  Forecast next month
                </th>
                <th scope="col" className="px-4 py-2.5 font-medium">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((s) => {
                const p = product.get(s.productId);
                const f = forecastById.get(s.productId);
                const below = s.onHand < s.minimumLevel;
                return (
                  <tr key={s.productId} className={cn(below && "bg-warning-subtle/40")}>
                    <td className="px-4 py-2.5">
                      <button
                        type="button"
                        onClick={() => setSelected(s.productId)}
                        className="text-left font-medium hover:underline disabled:no-underline"
                        disabled={!f}
                      >
                        {p?.name}
                      </button>
                      <span className="block text-xs text-muted-foreground">
                        <span className="font-mono">{p?.sku}</span>
                        {cost.get(s.productId)
                          ? ` · agreed ${formatMoney(cost.get(s.productId)!)}`
                          : ""}
                        {p ? ` · ${plural(p.leadTimeDays, "day")} lead time` : ""}
                      </span>
                    </td>
                    <td
                      className={cn(
                        "px-3 py-2.5 text-right tabular-nums",
                        below && "font-semibold text-warning",
                      )}
                    >
                      {s.onHand}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{s.allocated}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{s.minimumLevel}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {s.onOrder ? (
                        <>
                          {s.onOrder}
                          {s.expectedAt ? (
                            <span className="block text-xs text-muted-foreground">
                              due {formatDate(s.expectedAt)}
                            </span>
                          ) : null}
                        </>
                      ) : (
                        "None"
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {f ? f.months[0]?.quantity : "No recent demand"}
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusPill tone={STOCK_STATUS[s.status].tone}>
                        {below ? "Below minimum" : STOCK_STATUS[s.status].label}
                      </StatusPill>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

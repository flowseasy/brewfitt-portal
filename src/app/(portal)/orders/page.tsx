"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { MagnifyingGlassIcon, PackageIcon, XIcon } from "@phosphor-icons/react";
import { SearchInput } from "@/components/shared/filter-bar";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/states";
import { StatusPill } from "@/components/shared/status-pill";
import { StatusTabs } from "@/components/shared/status-tabs";
import { Button } from "@/components/ui/button";
import { useIsSupplier, useMe, usePersonaKey } from "@/features/session/use-session";
import { api, queryKeys } from "@/lib/api";
import { formatDate, formatMoney, plural } from "@/lib/format";
import { hrefFor } from "@/lib/links";
import { OPEN_ORDER_STATUSES, OPEN_PO_STATUSES, ORDER_STATUS, PO_STATUS } from "@/lib/status";
import type { PurchaseOrder, SalesOrder } from "@/types";

export default function OrdersPage() {
  return (
    <Suspense fallback={<LoadingState rows={5} />}>
      <Orders />
    </Suspense>
  );
}

function Orders() {
  return useIsSupplier() ? <PurchaseOrders /> : <SalesOrders />;
}

type OrderTab = "open" | "delivered" | "cancelled" | "all";

function SalesOrders() {
  const key = usePersonaKey();
  const params = useSearchParams();
  const me = useMe();
  const orders = useQuery({
    queryKey: queryKeys.salesOrders(key),
    queryFn: () => api.orders.salesOrders(),
  });
  const priceList = useQuery({
    queryKey: queryKeys.priceList(key),
    queryFn: () => api.priceList.get(),
  });
  const statusParam = params.get("status") as SalesOrder["status"] | null;
  const [tab, setTab] = useState<OrderTab>(statusParam === "delivered" ? "delivered" : "open");
  const [stage, setStage] = useState<SalesOrder["status"] | null>(
    statusParam && statusParam !== "delivered" ? statusParam : null,
  );
  const [search, setSearch] = useState("");

  const productName = useMemo(
    () => new Map((priceList.data?.lines ?? []).map((l) => [l.productId, l.product.name])),
    [priceList.data],
  );
  const siteName = useMemo(
    () => new Map((me.data?.group?.sites ?? []).map((s) => [s.id, s.name])),
    [me.data],
  );
  const all = orders.data ?? [];
  const inTab = (o: SalesOrder, t: OrderTab) =>
    t === "all" ? true : t === "open" ? OPEN_ORDER_STATUSES.includes(o.status) : o.status === t;
  const term = search.trim().toLowerCase();
  const filtered = all.filter(
    (o) =>
      inTab(o, tab) &&
      (!stage || o.status === stage) &&
      (!term ||
        o.number.toLowerCase().includes(term) ||
        (o.poReference ?? "").toLowerCase().includes(term) ||
        o.lines.some((l) => (productName.get(l.productId) ?? "").toLowerCase().includes(term))),
  );
  const showSites = me.data?.persona.kind === "group" && !me.data.persona.activeSiteId;

  return (
    <div>
      <PageHeader
        title="Orders"
        description="Every order with its stage, delivery dates and tracking. Request a date or address change before dispatch."
        actions={
          <Button asChild variant="outline">
            <Link href="/shop?reorder=1">Reorder</Link>
          </Button>
        }
      />
      <StatusTabs
        tabs={[
          { value: "open", label: "Open", count: all.filter((o) => inTab(o, "open")).length },
          {
            value: "delivered",
            label: "Delivered",
            count: all.filter((o) => inTab(o, "delivered")).length,
          },
          {
            value: "cancelled",
            label: "Cancelled",
            count: all.filter((o) => inTab(o, "cancelled")).length,
          },
          { value: "all", label: "All", count: all.length },
        ]}
        value={tab}
        onChange={(t) => {
          setTab(t);
          setStage(null);
        }}
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search by order number, your reference or product"
          label="Search orders"
          className="w-full max-w-md"
        />
        {stage ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setStage(null)}
            className="rounded-full"
          >
            Stage: {ORDER_STATUS[stage].label}
            <XIcon aria-label="Clear stage filter" />
          </Button>
        ) : null}
      </div>
      {orders.isPending ? (
        <LoadingState rows={6} label="Loading orders" />
      ) : orders.isError ? (
        <ErrorState error={orders.error} onRetry={() => orders.refetch()} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={term ? MagnifyingGlassIcon : PackageIcon}
          title={
            term || stage
              ? "No orders match these filters"
              : tab === "open"
                ? "No open orders"
                : "No orders here"
          }
          description={
            tab === "open" && !term ? "Place an order from the shop or accept a quote." : undefined
          }
          action={
            !term && tab === "open" ? (
              <Button asChild>
                <Link href="/shop">Go to the shop</Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ul className="space-y-2">
          {filtered.map((o) => {
            const s = ORDER_STATUS[o.status];
            const backordered = o.lines.reduce((n, l) => n + l.backordered, 0);
            return (
              <li key={o.id}>
                <Link
                  href={hrefFor("sales-order", o.id)}
                  className="flex flex-col gap-3 rounded-2xl border bg-card p-4 transition hover:border-primary/40 sm:flex-row sm:items-center"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{o.number}</span>
                      <StatusPill tone={s.tone}>{s.label}</StatusPill>
                      {backordered ? (
                        <StatusPill tone="warning">{backordered} on back order</StatusPill>
                      ) : null}
                      {showSites && siteName.get(o.accountId) ? (
                        <span className="text-xs text-muted-foreground">
                          {siteName.get(o.accountId)}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 truncate text-sm text-muted-foreground">
                      {o.poReference ? `${o.poReference} · ` : ""}
                      {plural(o.lines.length, "line")}:{" "}
                      {o.lines
                        .slice(0, 2)
                        .map((l) => productName.get(l.productId) ?? "item")
                        .join(", ")}
                      {o.lines.length > 2 ? "…" : ""}
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-6 sm:justify-end">
                    <p className="text-sm text-muted-foreground">
                      {OPEN_ORDER_STATUSES.includes(o.status)
                        ? `Delivery ${formatDate(o.confirmedDate ?? o.requestedDate)}`
                        : `Ordered ${formatDate(o.createdAt)}`}
                    </p>
                    <p className="text-right text-lg font-semibold tabular-nums">
                      {formatMoney(o.total, { whole: true })}
                    </p>
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

type PoTab = "open" | "received" | "all";

function PurchaseOrders() {
  const key = usePersonaKey();
  const params = useSearchParams();
  const pos = useQuery({
    queryKey: queryKeys.purchaseOrders(key),
    queryFn: () => api.orders.purchaseOrders(),
  });
  const products = useQuery({
    queryKey: queryKeys.products(key),
    queryFn: () => api.products.list(),
  });
  const statusParam = params.get("status") as PurchaseOrder["status"] | null;
  const [tab, setTab] = useState<PoTab>(statusParam === "received" ? "received" : "open");
  const [stage, setStage] = useState<PurchaseOrder["status"] | null>(
    statusParam && statusParam !== "received" ? statusParam : null,
  );
  const productName = useMemo(
    () => new Map((products.data ?? []).map((p) => [p.id, p.name])),
    [products.data],
  );
  const all = pos.data ?? [];
  const inTab = (p: PurchaseOrder, t: PoTab) =>
    t === "all"
      ? true
      : t === "open"
        ? OPEN_PO_STATUSES.includes(p.status)
        : p.status === "received";
  const filtered = all.filter((p) => inTab(p, tab) && (!stage || p.status === stage));

  return (
    <div>
      <PageHeader
        title="Purchase orders"
        description="What Brewfitt has ordered from you, when it is expected and what has been received."
      />
      <StatusTabs
        tabs={[
          { value: "open", label: "Open", count: all.filter((p) => inTab(p, "open")).length },
          {
            value: "received",
            label: "Received",
            count: all.filter((p) => inTab(p, "received")).length,
          },
          { value: "all", label: "All", count: all.length },
        ]}
        value={tab}
        onChange={(t) => {
          setTab(t);
          setStage(null);
        }}
      />
      {stage ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setStage(null)}
          className="mb-4 rounded-full"
        >
          Stage: {PO_STATUS[stage].label}
          <XIcon aria-label="Clear stage filter" />
        </Button>
      ) : null}
      {pos.isPending ? (
        <LoadingState rows={5} label="Loading purchase orders" />
      ) : pos.isError ? (
        <ErrorState error={pos.error} onRetry={() => pos.refetch()} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={PackageIcon}
          title={tab === "open" ? "No open purchase orders" : "No purchase orders here"}
        />
      ) : (
        <ul className="space-y-2">
          {filtered.map((p) => {
            const s = PO_STATUS[p.status];
            return (
              <li key={p.id}>
                <Link
                  href={hrefFor("purchase-order", p.id)}
                  className="flex flex-col gap-3 rounded-2xl border bg-card p-4 transition hover:border-primary/40 sm:flex-row sm:items-center"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{p.number}</span>
                      <StatusPill tone={s.tone}>{s.label}</StatusPill>
                      {p.status === "issued" ? (
                        <StatusPill tone="warning">Needs acknowledging</StatusPill>
                      ) : null}
                    </div>
                    <p className="mt-1 truncate text-sm text-muted-foreground">
                      {p.lines
                        .map((l) => `${l.qty} × ${productName.get(l.productId) ?? "item"}`)
                        .join(", ")}
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-6 sm:justify-end">
                    <p className="text-sm text-muted-foreground">
                      {p.status === "received"
                        ? `Raised ${formatDate(p.createdAt)}`
                        : `Expected ${formatDate(p.expectedDate)}`}
                    </p>
                    <p className="text-right text-lg font-semibold tabular-nums">
                      {formatMoney(p.total, { whole: true })}
                    </p>
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

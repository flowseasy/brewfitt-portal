"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, queryKeys } from "@/lib/api";
import { OPEN_CASE_STATUSES, OPEN_ORDER_STATUSES } from "@/lib/status";
import type { AIInsight, PriceListResponse, SalesOrder } from "@/types";
import { usePersonaKey } from "@/features/session/use-session";

export type FrequentProduct = {
  line: PriceListResponse["lines"][number];
  orders: number;
  lastQty: number;
  lastOrderedAt: string;
};

/** Products ordered most often in the last 12 months, with price and stock. */
export function frequentProducts(
  orders: SalesOrder[],
  priceList: PriceListResponse,
  limit = 5,
): FrequentProduct[] {
  const since = Date.now() - 365 * 86_400_000;
  const stats = new Map<string, { orders: number; lastQty: number; lastOrderedAt: string }>();
  for (const o of [...orders].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    if (o.status === "cancelled" || Date.parse(o.createdAt) < since) continue;
    for (const l of o.lines) {
      const s = stats.get(l.productId) ?? { orders: 0, lastQty: 0, lastOrderedAt: o.createdAt };
      stats.set(l.productId, { orders: s.orders + 1, lastQty: l.qty, lastOrderedAt: o.createdAt });
    }
  }
  const lines = new Map(priceList.lines.map((l) => [l.productId, l]));
  return [...stats.entries()]
    .filter(([id, s]) => lines.has(id) && s.orders >= 2)
    .sort(
      (a, b) => b[1].orders - a[1].orders || b[1].lastOrderedAt.localeCompare(a[1].lastOrderedAt),
    )
    .slice(0, limit)
    .map(([id, s]) => ({ line: lines.get(id)!, ...s }));
}

export function useCustomerDashboard() {
  const key = usePersonaKey();
  const me = useQuery({ queryKey: queryKeys.me(key), queryFn: () => api.session.me() });
  const statement = useQuery({
    queryKey: queryKeys.statement(key),
    queryFn: () => api.invoices.statement(),
  });
  const invoices = useQuery({
    queryKey: queryKeys.invoices(key),
    queryFn: () => api.invoices.list(),
  });
  const quotes = useQuery({ queryKey: queryKeys.quotes(key), queryFn: () => api.quotes.list() });
  const orders = useQuery({
    queryKey: queryKeys.salesOrders(key),
    queryFn: () => api.orders.salesOrders(),
  });
  const priceList = useQuery({
    queryKey: queryKeys.priceList(key),
    queryFn: () => api.priceList.get(),
  });
  const insights = useQuery({
    queryKey: queryKeys.insights(key),
    queryFn: () => api.ai.insights(),
  });
  const threads = useQuery({
    queryKey: queryKeys.threads(key),
    queryFn: () => api.messages.threads(),
  });
  const cases = useQuery({ queryKey: queryKeys.cases(key), queryFn: () => api.cases.list() });
  const jobs = useQuery({ queryKey: queryKeys.jobs(key), queryFn: () => api.jobs.list() });
  const notifications = useQuery({
    queryKey: queryKeys.notifications(key),
    queryFn: () => api.notifications.list(),
  });

  const derived = useMemo(() => {
    const byCategory = (category: AIInsight["category"]) =>
      (insights.data ?? []).filter((i) => i.category === category);
    const openInvoices = (invoices.data ?? [])
      .filter((i) => i.outstanding.amount > 0 && i.kind === "invoice")
      .sort((a, b) => a.dueAt.localeCompare(b.dueAt));
    const openOrders = (orders.data ?? []).filter((o) => OPEN_ORDER_STATUSES.includes(o.status));
    return {
      nextPayment: openInvoices[0] ?? null,
      awaitingQuotes: (quotes.data ?? [])
        .filter((q) => q.status === "sent")
        .sort((a, b) => a.validUntil.localeCompare(b.validUntil)),
      openOrders,
      stageCounts: {
        confirmed: openOrders.filter((o) => o.status === "confirmed").length,
        picking: openOrders.filter((o) => o.status === "picking").length,
        dispatched: openOrders.filter((o) => o.status === "dispatched").length,
        partDelivered: openOrders.filter((o) => o.status === "part-delivered").length,
      },
      nextDeliveries: [...openOrders]
        .sort((a, b) =>
          (a.confirmedDate ?? a.requestedDate).localeCompare(b.confirmedDate ?? b.requestedDate),
        )
        .slice(0, 4),
      frequent: orders.data && priceList.data ? frequentProducts(orders.data, priceList.data) : [],
      suggestions: [...byCategory("reorder-due"), ...byCategory("product-suggestion")],
      stockRisks: byCategory("stock-out-risk"),
      quoteFollowUps: byCategory("quote-follow-up"),
      invoiceInsights: byCategory("invoice-ageing"),
      needsReply: (threads.data ?? []).filter((t) => t.unreadCount > 0),
      recentThreads: (threads.data ?? []).slice(0, 4),
      openCases: (cases.data ?? []).filter((c) => OPEN_CASE_STATUSES.includes(c.status)),
      activeJobs: (jobs.data ?? [])
        .filter((j) => j.status === "scheduled" || j.status === "in-progress")
        .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate)),
      activity: (notifications.data ?? []).slice(0, 6),
    };
  }, [
    insights.data,
    invoices.data,
    quotes.data,
    orders.data,
    priceList.data,
    threads.data,
    cases.data,
    jobs.data,
    notifications.data,
  ]);

  return {
    me,
    statement,
    invoices,
    quotes,
    orders,
    priceList,
    insights,
    threads,
    cases,
    jobs,
    notifications,
    ...derived,
  };
}

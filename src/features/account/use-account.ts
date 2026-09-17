"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, errorMessage, queryKeys } from "@/lib/api";
import type {
  Delivery,
  Invoice,
  Notification,
  Payment,
  SalesOrder,
  SupplierProduct,
  Thread,
  Case,
  PurchaseOrder,
  RelatedType,
} from "@/types";
import { formatMoney } from "@/lib/format";
import { useIsSupplier, usePersonaKey } from "@/features/session/use-session";

export function useAccountQueries() {
  const key = usePersonaKey();
  return {
    me: useQuery({ queryKey: queryKeys.me(key), queryFn: () => api.session.me() }),
    account: useQuery({ queryKey: queryKeys.account(key), queryFn: () => api.account.get() }),
    addresses: useQuery({
      queryKey: queryKeys.addresses(key),
      queryFn: () => api.account.addresses(),
    }),
    contacts: useQuery({
      queryKey: queryKeys.contacts(key),
      queryFn: () => api.account.contacts(),
    }),
    documents: useQuery({
      queryKey: queryKeys.accountDocuments(key),
      queryFn: () => api.account.documents(),
    }),
  };
}

/** Account edits go to Brewfitt for approval; the UI shows them as pending. */
export function useAccountMutations() {
  const key = usePersonaKey();
  const queryClient = useQueryClient();
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.account(key) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.me(key) });
  };
  const pending = (what: string) =>
    toast.success(`${what} sent to Brewfitt`, {
      description: "It shows as pending until Brewfitt approves it in TOTA360v5.",
    });
  const failed = (error: unknown) =>
    toast.error("That could not be saved", { description: errorMessage(error) });

  return {
    updateAccount: useMutation({
      mutationFn: api.account.update,
      onSuccess: () => {
        refresh();
        pending("Company details change");
      },
      onError: failed,
    }),
    createAddress: useMutation({
      mutationFn: api.account.createAddress,
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: queryKeys.addresses(key) });
        pending("New address");
      },
      onError: failed,
    }),
    updateAddress: useMutation({
      mutationFn: ({
        id,
        input,
      }: {
        id: string;
        input: Parameters<typeof api.account.updateAddress>[1];
      }) => api.account.updateAddress(id, input),
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: queryKeys.addresses(key) });
        refresh();
        pending("Address change");
      },
      onError: failed,
    }),
    createContact: useMutation({
      mutationFn: api.account.createContact,
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: queryKeys.contacts(key) });
        pending("New contact");
      },
      onError: failed,
    }),
    updateContact: useMutation({
      mutationFn: ({
        id,
        input,
      }: {
        id: string;
        input: Parameters<typeof api.account.updateContact>[1];
      }) => api.account.updateContact(id, input),
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: queryKeys.contacts(key) });
        refresh();
        pending("Contact change");
      },
      onError: failed,
    }),
    uploadDocument: useMutation({
      mutationFn: api.account.uploadDocument,
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: queryKeys.accountDocuments(key) });
        void queryClient.invalidateQueries({ queryKey: queryKeys.documents(key) });
        pending("Document");
      },
      onError: failed,
    }),
  };
}

export type MonthTotal = { month: string; total: number; count: number };

/** The last 12 calendar months, oldest first. */
export function last12Months(): string[] {
  const now = new Date();
  return Array.from({ length: 12 }, (_, i) =>
    new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11 + i, 1))
      .toISOString()
      .slice(0, 7),
  );
}

/** Customer spend by month (ex VAT) and top products, from their own orders. */
export function customerSpend(orders: SalesOrder[]) {
  const months = last12Months();
  const live = orders.filter(
    (o) => o.status !== "cancelled" && o.createdAt.slice(0, 7) >= months[0]!,
  );
  const monthly: MonthTotal[] = months.map((month) => {
    const list = live.filter((o) => o.createdAt.startsWith(month));
    return {
      month,
      total: list.reduce((s, o) => s + o.lines.reduce((x, l) => x + l.qty * l.price.amount, 0), 0),
      count: list.length,
    };
  });
  const byProduct = new Map<string, { qty: number; total: number }>();
  for (const l of live.flatMap((o) => o.lines)) {
    const e = byProduct.get(l.productId) ?? { qty: 0, total: 0 };
    byProduct.set(l.productId, { qty: e.qty + l.qty, total: e.total + l.qty * l.price.amount });
  }
  const top = [...byProduct.entries()].sort((a, b) => b[1].total - a[1].total).slice(0, 5);
  return { monthly, top, total: monthly.reduce((s, m) => s + m.total, 0) };
}

export type ActivityItem = {
  id: string;
  at: string;
  title: string;
  detail: string;
  relatedType: RelatedType;
  relatedId: string;
  kind: "order" | "delivery" | "invoice" | "payment" | "message" | "case" | "submission" | "note";
};

/** Account timeline across orders, deliveries, invoices, payments, conversations and cases. */
export function useAccountActivity(limit = 20) {
  const key = usePersonaKey();
  const supplier = useIsSupplier();
  const orders = useQuery({
    queryKey: queryKeys.salesOrders(key),
    queryFn: () => api.orders.salesOrders(),
    enabled: !supplier,
  });
  const pos = useQuery({
    queryKey: queryKeys.purchaseOrders(key),
    queryFn: () => api.orders.purchaseOrders(),
    enabled: supplier,
  });
  const deliveries = useQuery({
    queryKey: queryKeys.deliveries(key),
    queryFn: () => api.deliveries.list(),
  });
  const invoices = useQuery({
    queryKey: queryKeys.invoices(key),
    queryFn: () => api.invoices.list(),
  });
  const payments = useQuery({
    queryKey: queryKeys.payments(key),
    queryFn: () => api.invoices.payments(),
  });
  const threads = useQuery({
    queryKey: queryKeys.threads(key),
    queryFn: () => api.messages.threads(),
  });
  const cases = useQuery({
    queryKey: queryKeys.cases(key),
    queryFn: () => api.cases.list(),
    enabled: !supplier,
  });
  const submissions = useQuery({
    queryKey: queryKeys.supplierProducts(key),
    queryFn: () => api.supplierProducts.list(),
    enabled: supplier,
  });

  const items = useMemo(() => {
    const out: ActivityItem[] = [];
    const orderNumber = new Map<string, string>([
      ...(orders.data ?? []).map((o) => [o.id, o.number] as const),
      ...(pos.data ?? []).map((p) => [p.id, p.number] as const),
    ]);
    for (const o of orders.data ?? [])
      out.push({
        id: `o-${o.id}`,
        at: o.createdAt,
        title: `Order ${o.number} placed`,
        detail: formatMoney(o.total),
        relatedType: "sales-order",
        relatedId: o.id,
        kind: "order",
      });
    for (const p of pos.data ?? [])
      out.push({
        id: `p-${p.id}`,
        at: p.createdAt,
        title: `Purchase order ${p.number} issued`,
        detail: formatMoney(p.total),
        relatedType: "purchase-order",
        relatedId: p.id,
        kind: "order",
      });
    for (const d of (deliveries.data ?? []) as Delivery[]) {
      if (d.deliveredAt)
        out.push({
          id: `d-${d.id}`,
          at: d.deliveredAt,
          title: `${supplier ? "Received" : "Delivered"}: ${d.number}`,
          detail: `For ${orderNumber.get(d.orderId) ?? "order"}${d.carrier ? ` by ${d.carrier}` : ""}`,
          relatedType: d.orderType === "sales" ? "sales-order" : "purchase-order",
          relatedId: d.orderId,
          kind: "delivery",
        });
    }
    for (const i of (invoices.data ?? []) as Invoice[])
      out.push({
        id: `i-${i.id}`,
        at: i.issuedAt,
        title: `${i.kind === "self-bill" ? "Self-billed invoice" : "Invoice"} ${i.number}`,
        detail: formatMoney(i.total),
        relatedType: "invoice",
        relatedId: i.id,
        kind: "invoice",
      });
    for (const p of (payments.data ?? []) as Payment[]) {
      if (p.method === "credit-allocation") continue;
      out.push({
        id: `pay-${p.id}`,
        at: p.paidAt,
        title: supplier ? "Payment from Brewfitt" : "Payment received",
        detail: `${formatMoney(p.amount)} · ${p.reference}`,
        relatedType: "invoice",
        relatedId: p.allocatedTo[0]?.invoiceId ?? p.id,
        kind: "payment",
      });
    }
    for (const t of (threads.data ?? []) as Thread[])
      out.push({
        id: `t-${t.id}`,
        at: t.lastMessageAt,
        title: t.subject,
        detail: "Latest message",
        relatedType: "thread",
        relatedId: t.id,
        kind: "message",
      });
    for (const c of (cases.data ?? []) as Case[])
      out.push({
        id: `c-${c.id}`,
        at: c.updatedAt,
        title: `Case ${c.number}: ${c.subject}`,
        detail: c.status.replace("-", " "),
        relatedType: "case",
        relatedId: c.id,
        kind: "case",
      });
    for (const s of (submissions.data ?? []) as SupplierProduct[])
      out.push({
        id: `s-${s.id}`,
        at: s.updatedAt,
        title: `Submission: ${s.name}`,
        detail: s.status.replace("-", " "),
        relatedType: "supplier-product",
        relatedId: s.id,
        kind: "submission",
      });
    return out
      .sort((a, b) => b.at.localeCompare(a.at))
      .filter((a) => Date.parse(a.at) <= Date.now())
      .slice(0, limit);
  }, [
    orders.data,
    pos.data,
    deliveries.data,
    invoices.data,
    payments.data,
    threads.data,
    cases.data,
    submissions.data,
    supplier,
    limit,
  ]);

  const loading = [deliveries, invoices, payments, threads].some((q) => q.isPending);
  const error = [deliveries, invoices, payments, threads].find((q) => q.isError)?.error ?? null;
  return { items, loading, error, orders, pos };
}

export type { Notification, PurchaseOrder };

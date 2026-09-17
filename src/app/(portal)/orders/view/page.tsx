"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {
  ArrowLeftIcon,
  ArrowsClockwiseIcon,
  CalendarIcon,
  ChatsCircleIcon,
  CheckCircleIcon,
  FilePdfIcon,
  FileTextIcon,
  LifebuoyIcon,
  MapPinIcon,
  PackageIcon,
  ReceiptIcon,
  WrenchIcon,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { formatAddress } from "@/components/account/addresses";
import { TextareaField, TextField } from "@/components/forms/fields";
import { ThreadView } from "@/components/messages/thread-view";
import {
  DeliveryTimeline,
  OrderDocument,
  OrderStageTracker,
  purchaseOrderStages,
  salesOrderStages,
} from "@/components/orders/order-parts";
import { LinesTable, TotalsList } from "@/components/quotes/quote-parts";
import { PageHeader } from "@/components/shared/page-header";
import { PdfPreview } from "@/components/shared/pdf-preview";
import { EmptyState, ErrorState, LoadingState, RecordIdGate } from "@/components/shared/states";
import { StatusPill } from "@/components/shared/status-pill";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FieldGroup } from "@/components/ui/field";
import { useIsSupplier, usePersonaKey } from "@/features/session/use-session";
import { api, errorMessage, queryKeys } from "@/lib/api";
import { formatDate, formatMoney, formatShortDate, plural } from "@/lib/format";
import { hrefFor } from "@/lib/links";
import { INVOICE_STATUS, JOB_STATUS, ORDER_STATUS, PO_STATUS } from "@/lib/status";
import { cn } from "@/lib/utils";
import type { Address, ChangeRequest, SalesOrderDetail } from "@/types";

export default function OrderViewPage() {
  return (
    <Suspense fallback={<LoadingState rows={5} />}>
      <RecordIdGate backHref="/orders" backLabel="Back to orders">
        <OrderView />
      </RecordIdGate>
    </Suspense>
  );
}

function OrderView() {
  const id = useSearchParams().get("id") ?? "";
  return useIsSupplier() ? <PurchaseOrderDetailView id={id} /> : <SalesOrderView id={id} />;
}

function Back({ label }: { label: string }) {
  return (
    <Link
      href="/orders"
      className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeftIcon className="size-4" aria-hidden />
      {label}
    </Link>
  );
}

function SideCard({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof MapPinIcon;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border bg-card p-4" aria-label={title}>
      <h2 className="mb-2 flex items-center gap-2 text-sm font-medium">
        <Icon className="size-4 text-primary" aria-hidden />
        {title}
      </h2>
      {children}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Sales order
// ---------------------------------------------------------------------------

function SalesOrderView({ id }: { id: string }) {
  const router = useRouter();
  const key = usePersonaKey();
  const queryClient = useQueryClient();
  const order = useQuery({
    queryKey: queryKeys.salesOrder(key, id),
    queryFn: () => api.orders.salesOrder(id),
    enabled: !!id,
    // Brewfitt packs, ships and delivers portal orders over the next few minutes (decision 11).
    refetchInterval: (q) =>
      q.state.data && ["confirmed", "picking", "dispatched"].includes(q.state.data.status)
        ? 20_000
        : false,
  });
  const me = useQuery({ queryKey: queryKeys.me(key), queryFn: () => api.session.me() });
  const priceList = useQuery({
    queryKey: queryKeys.priceList(key),
    queryFn: () => api.priceList.get(),
  });
  const addresses = useQuery({
    queryKey: queryKeys.addresses(key),
    queryFn: () => api.account.addresses(),
  });
  const invoices = useQuery({
    queryKey: queryKeys.invoices(key),
    queryFn: () => api.invoices.list(),
  });
  const jobs = useQuery({ queryKey: queryKeys.jobs(key), queryFn: () => api.jobs.list() });
  const cases = useQuery({ queryKey: queryKeys.cases(key), queryFn: () => api.cases.list() });
  const [pdfOpen, setPdfOpen] = useState(useSearchParams().get("pdf") === "1");
  const [changeOpen, setChangeOpen] = useState(false);

  const products = useMemo(
    () => new Map((priceList.data?.lines ?? []).map((l) => [l.productId, l.product])),
    [priceList.data],
  );
  const addressById = useMemo(
    () => new Map((addresses.data ?? []).map((a) => [a.id, a])),
    [addresses.data],
  );

  const reorder = useMutation({
    mutationFn: async (o: SalesOrderDetail) => {
      let basket = await api.shop.basket();
      for (const l of o.lines)
        if (products.has(l.productId))
          basket = await api.shop.addToBasket({ productId: l.productId, qty: l.qty });
      return basket;
    },
    onSuccess: (basket) => {
      queryClient.setQueryData(queryKeys.basket(key), basket);
      toast.success("Order lines added to your basket", {
        action: { label: "View basket", onClick: () => router.push("/shop/basket") },
      });
    },
    onError: (error) => toast.error("Could not reorder", { description: errorMessage(error) }),
  });

  if (order.isPending) return <LoadingState rows={5} label="Loading order" />;
  if (order.isError) {
    return (
      <div>
        <Back label="Orders" />
        <ErrorState error={order.error} onRetry={() => order.refetch()} />
      </div>
    );
  }

  const o = order.data;
  const s = ORDER_STATUS[o.status];
  const address = addressById.get(o.deliveryAddressId);
  const net = o.lines.reduce((sum, l) => sum + l.qty * l.price.amount, 0);
  const vat = o.total.amount - net;
  const orderInvoices = (invoices.data ?? []).filter((i) => i.orderId === o.id);
  const orderJobs = (jobs.data ?? []).filter((j) => j.orderId === o.id);
  const orderCases = (cases.data ?? []).filter((c) => c.orderId === o.id);
  const pending = o.changeRequests.filter((c) => c.status === "pending");
  const canChange = o.status === "confirmed" || o.status === "picking";

  return (
    <div>
      <Back label="Orders" />
      <PageHeader
        eyebrow={o.poReference ? `Your reference ${o.poReference}` : "Order"}
        documentTitle={`Order ${o.number}`}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {o.number}
            <StatusPill tone={s.tone}>{s.label}</StatusPill>
          </span>
        }
        description={`Placed ${formatDate(o.createdAt)} · ${formatMoney(o.total)} including VAT`}
        actions={
          <>
            <Button variant="outline" onClick={() => setPdfOpen(true)}>
              <FilePdfIcon aria-hidden />
              Confirmation
            </Button>
            <Button
              variant="outline"
              onClick={() => reorder.mutate(o)}
              disabled={reorder.isPending}
            >
              <ArrowsClockwiseIcon aria-hidden />
              Reorder
            </Button>
            {canChange ? (
              <Button onClick={() => setChangeOpen(true)}>
                <CalendarIcon aria-hidden />
                Request a change
              </Button>
            ) : null}
          </>
        }
      />

      <section aria-label="Order progress" className="mb-6 rounded-2xl border bg-card p-5">
        <OrderStageTracker
          stages={salesOrderStages(o, o.deliveries)}
          cancelled={o.status === "cancelled"}
        />
      </section>

      {pending.length ? (
        <div className="mb-5 rounded-2xl border border-info/30 bg-info-subtle p-4 text-sm">
          <p className="font-medium">Change awaiting Brewfitt approval</p>
          <ul className="mt-1">
            {pending.map((c) => (
              <li key={c.id}>{describeChange(c, addressById)}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-6">
          <section aria-labelledby="lines">
            <h2 id="lines" className="mb-3 font-medium">
              {plural(o.lines.length, "line")}
            </h2>
            <LinesTable
              products={products}
              lines={o.lines.map((l) => ({
                productId: l.productId,
                description: products.get(l.productId)?.name ?? l.productId,
                qty: l.qty,
                unitPrice: l.price,
                lineTotal: { amount: l.qty * l.price.amount, currency: l.price.currency },
                extra: l.backordered
                  ? `${l.delivered} delivered, ${l.backordered} on back order`
                  : o.status === "part-delivered" || (o.status === "delivered" && l.delivered)
                    ? `${l.delivered} delivered`
                    : undefined,
              }))}
            />
          </section>

          <section aria-labelledby="deliveries">
            <h2 id="deliveries" className="mb-3 font-medium">
              Deliveries
            </h2>
            {o.deliveries.length === 0 ? (
              <EmptyState
                icon={PackageIcon}
                title="Not dispatched yet"
                description={`Delivery is ${o.confirmedDate ? "confirmed" : "requested"} for ${formatDate(o.confirmedDate ?? o.requestedDate)}. Tracking appears here when it leaves Huddersfield.`}
              />
            ) : (
              <DeliveryTimeline deliveries={o.deliveries} products={products} />
            )}
          </section>

          {o.changeRequests.length ? (
            <section aria-labelledby="changes">
              <h2 id="changes" className="mb-3 font-medium">
                Change requests
              </h2>
              <ul className="space-y-2">
                {o.changeRequests.map((c) => (
                  <li
                    key={c.id}
                    className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3 text-sm"
                  >
                    <span className="flex-1">{describeChange(c, addressById)}</span>
                    <StatusPill
                      tone={
                        c.status === "approved"
                          ? "success"
                          : c.status === "rejected"
                            ? "danger"
                            : "info"
                      }
                    >
                      {c.status === "pending"
                        ? "Awaiting approval"
                        : c.status === "approved"
                          ? "Approved"
                          : "Not approved"}
                    </StatusPill>
                    {c.reason ? <p className="w-full text-muted-foreground">{c.reason}</p> : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section
            aria-labelledby="order-conversation"
            className="rounded-2xl border bg-card p-4 sm:p-5"
          >
            <h2 id="order-conversation" className="mb-4 flex items-center gap-2 font-medium">
              <ChatsCircleIcon className="size-5 text-primary" aria-hidden />
              Conversation about this order
            </h2>
            <ThreadView threadId={o.threadId} compact />
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <section aria-label="Totals" className="rounded-2xl border bg-card p-5">
            <TotalsList
              subtotal={{ amount: net, currency: "GBP" }}
              vat={{ amount: vat, currency: "GBP" }}
              total={o.total}
            />
          </section>
          <SideCard title="Delivery" icon={MapPinIcon}>
            {address ? (
              <>
                <p className="text-sm font-medium">{address.label}</p>
                <p className="text-sm text-muted-foreground">{formatAddress(address).join(", ")}</p>
                {address.deliveryNotes ? (
                  <p className="mt-2 rounded-lg bg-muted/60 px-2.5 py-1.5 text-xs">
                    {address.deliveryNotes}
                  </p>
                ) : null}
              </>
            ) : null}
            <dl className="mt-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Requested</dt>
                <dd>{formatDate(o.requestedDate)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Confirmed</dt>
                <dd>{o.confirmedDate ? formatDate(o.confirmedDate) : "Awaiting confirmation"}</dd>
              </div>
            </dl>
          </SideCard>
          {o.quoteId ? (
            <Link
              href={hrefFor("quote", o.quoteId)}
              className="flex items-center gap-3 rounded-2xl border bg-card p-4 text-sm hover:border-primary/40"
            >
              <FileTextIcon className="size-5 text-primary" aria-hidden />
              From an accepted quote
            </Link>
          ) : null}
          {orderInvoices.length ? (
            <SideCard title="Invoices" icon={ReceiptIcon}>
              <ul className="space-y-1.5 text-sm">
                {orderInvoices.map((i) => (
                  <li key={i.id}>
                    <Link
                      href={hrefFor("invoice", i.id)}
                      className="flex items-center justify-between gap-2 hover:underline"
                    >
                      <span>{i.number}</span>
                      <StatusPill tone={INVOICE_STATUS[i.status].tone}>
                        {INVOICE_STATUS[i.status].label}
                      </StatusPill>
                    </Link>
                  </li>
                ))}
              </ul>
            </SideCard>
          ) : null}
          {orderJobs.length ? (
            <SideCard title="Installation" icon={WrenchIcon}>
              <ul className="space-y-1.5 text-sm">
                {orderJobs.map((j) => (
                  <li key={j.id}>
                    <Link
                      href={hrefFor("job", j.id)}
                      className="flex items-center justify-between gap-2 hover:underline"
                    >
                      <span className="min-w-0 truncate">{j.name}</span>
                      <StatusPill tone={JOB_STATUS[j.status].tone}>
                        {formatShortDate(j.scheduledDate)}
                      </StatusPill>
                    </Link>
                  </li>
                ))}
              </ul>
            </SideCard>
          ) : null}
          <SideCard title="Customer Support" icon={LifebuoyIcon}>
            {orderCases.length ? (
              <ul className="mb-2 space-y-1.5 text-sm">
                {orderCases.map((c) => (
                  <li key={c.id}>
                    <Link href={hrefFor("case", c.id)} className="hover:underline">
                      {c.number}: {c.subject}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
            <Link
              href={`/cases?new=1&orderId=${o.id}`}
              className="text-sm font-medium text-primary hover:underline"
            >
              Raise a case about this order
            </Link>
          </SideCard>
        </aside>
      </div>

      {me.data ? (
        <PdfPreview
          open={pdfOpen}
          onOpenChange={setPdfOpen}
          title={`Order confirmation ${o.number}`}
        >
          <OrderDocument
            kind="Order confirmation"
            number={o.number}
            date={o.createdAt}
            reference={o.poReference}
            partyLabel="Customer"
            partyLines={[
              me.data.account.name,
              ...(addressById.get(me.data.account.billingAddressId)
                ? formatAddress(addressById.get(me.data.account.billingAddressId)!)
                : []),
            ]}
            deliverTo={address ?? null}
            lines={o.lines.map((l) => ({
              sku: products.get(l.productId)?.sku ?? "",
              name: products.get(l.productId)?.name ?? l.productId,
              qty: l.qty,
              unit: l.price.amount,
            }))}
            total={o.total.amount}
            vatRate={me.data.vatRate}
            note={`Delivery ${o.confirmedDate ? "confirmed for" : "requested for"} ${formatDate(o.confirmedDate ?? o.requestedDate)}.`}
          />
        </PdfPreview>
      ) : null}

      {canChange ? (
        <ChangeRequestDialog
          open={changeOpen}
          onOpenChange={setChangeOpen}
          orderId={o.id}
          orderNumber={o.number}
          currentDate={o.confirmedDate ?? o.requestedDate}
          currentAddressId={o.deliveryAddressId}
          addresses={(addresses.data ?? []).filter((a) => a.accountId === o.accountId)}
        />
      ) : null}
    </div>
  );
}

function describeChange(c: ChangeRequest, addresses: Map<string, Address>) {
  if (c.kind === "date")
    return `Delivery date from ${formatDate(c.current)} to ${formatDate(c.requested)}`;
  return `Delivery address from ${addresses.get(c.current)?.label ?? "current address"} to ${addresses.get(c.requested)?.label ?? "a new address"}`;
}

const ChangeForm = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("date"),
    requested: z.iso.date({ message: "Choose the new delivery date" }),
    reason: z.string().trim().max(300).nullable(),
  }),
  z.object({
    kind: z.literal("address"),
    requested: z.string().min(1, "Choose the new delivery address"),
    reason: z.string().trim().max(300).nullable(),
  }),
]);
type ChangeValues = z.infer<typeof ChangeForm>;

function ChangeRequestDialog({
  open,
  onOpenChange,
  orderId,
  orderNumber,
  currentDate,
  currentAddressId,
  addresses,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  orderId: string;
  orderNumber: string;
  currentDate: string;
  currentAddressId: string;
  addresses: Address[];
}) {
  const key = usePersonaKey();
  const queryClient = useQueryClient();
  const form = useForm<ChangeValues>({
    resolver: zodResolver(ChangeForm),
    defaultValues: { kind: "date", requested: "", reason: null },
  });
  const kind = form.watch("kind");
  const change = useMutation({
    mutationFn: (v: ChangeValues) =>
      api.orders.requestChange(orderId, { ...v, reason: v.reason || null }),
    onSuccess: () => {
      for (const k of [queryKeys.salesOrder(key, orderId), queryKeys.threads(key)])
        void queryClient.invalidateQueries({ queryKey: k });
      onOpenChange(false);
      form.reset({ kind: "date", requested: "", reason: null });
      toast.success("Change requested", {
        description: "It shows as pending until Brewfitt approves it.",
      });
    },
    onError: (error) =>
      toast.error("The change could not be requested", { description: errorMessage(error) }),
  });
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request a change to {orderNumber}</DialogTitle>
          <DialogDescription>
            Changes can be requested until the order is dispatched. Brewfitt approves them before
            they apply.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit((v) => change.mutate(v))} noValidate>
          <FieldGroup>
            <fieldset className="grid grid-cols-2 gap-2">
              <legend className="mb-2 text-sm font-medium">What needs to change?</legend>
              {(["date", "address"] as const).map((k) => (
                <label
                  key={k}
                  className={cn(
                    "flex cursor-pointer items-center justify-center rounded-xl border p-3 text-sm focus-within:ring-3 focus-within:ring-ring/40",
                    kind === k ? "border-primary bg-brand-subtle/60 font-medium" : "",
                  )}
                >
                  <input
                    type="radio"
                    className="sr-only"
                    checked={kind === k}
                    onChange={() =>
                      form.reset({ kind: k, requested: "", reason: form.getValues("reason") })
                    }
                  />
                  {k === "date" ? "Delivery date" : "Delivery address"}
                </label>
              ))}
            </fieldset>
            {kind === "date" ? (
              <TextField
                control={form.control}
                name="requested"
                label="New delivery date"
                type="date"
                min={tomorrow}
                description={`Currently ${formatDate(currentDate)}.`}
              />
            ) : (
              <fieldset>
                <legend className="mb-2 text-sm font-medium">New delivery address</legend>
                <div className="space-y-2">
                  {addresses
                    .filter((a) => a.id !== currentAddressId)
                    .map((a) => (
                      <label
                        key={a.id}
                        className="flex cursor-pointer gap-3 rounded-xl border p-3 text-sm has-checked:border-primary has-checked:bg-brand-subtle/50"
                      >
                        <input
                          type="radio"
                          value={a.id}
                          {...form.register("requested")}
                          className="mt-1 accent-[var(--primary)]"
                        />
                        <span>
                          <span className="block font-medium">{a.label}</span>
                          <span className="block text-muted-foreground">
                            {formatAddress(a).join(", ")}
                          </span>
                        </span>
                      </label>
                    ))}
                  {addresses.length <= 1 ? (
                    <p className="text-sm text-muted-foreground">
                      You have no other delivery addresses. Add one in Account first.
                    </p>
                  ) : null}
                </div>
                {form.formState.errors.requested ? (
                  <p className="mt-1 text-sm text-destructive">
                    {form.formState.errors.requested.message}
                  </p>
                ) : null}
              </fieldset>
            )}
            <TextareaField
              control={form.control}
              name="reason"
              label="Reason (optional)"
              nullable
              rows={2}
            />
          </FieldGroup>
          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={change.isPending}>
              {change.isPending ? "Sending…" : "Send request"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Purchase order (supplier)
// ---------------------------------------------------------------------------

function PurchaseOrderDetailView({ id }: { id: string }) {
  const key = usePersonaKey();
  const queryClient = useQueryClient();
  const po = useQuery({
    queryKey: queryKeys.purchaseOrder(key, id),
    queryFn: () => api.orders.purchaseOrder(id),
    enabled: !!id,
  });
  const me = useQuery({ queryKey: queryKeys.me(key), queryFn: () => api.session.me() });
  const products = useQuery({
    queryKey: queryKeys.products(key),
    queryFn: () => api.products.list(),
  });
  const invoices = useQuery({
    queryKey: queryKeys.invoices(key),
    queryFn: () => api.invoices.list(),
  });
  const [pdfOpen, setPdfOpen] = useState(useSearchParams().get("pdf") === "1");
  const productById = useMemo(
    () => new Map((products.data ?? []).map((p) => [p.id, p])),
    [products.data],
  );

  const acknowledge = useMutation({
    mutationFn: () => api.orders.acknowledge(id),
    onSuccess: (updated) => {
      for (const k of [
        queryKeys.purchaseOrder(key, id),
        queryKeys.purchaseOrders(key),
        queryKeys.threads(key),
      ])
        void queryClient.invalidateQueries({ queryKey: k });
      toast.success(`${updated.number} acknowledged`, {
        description: `Delivery confirmed for ${formatDate(updated.expectedDate)}.`,
      });
    },
    onError: (error) => toast.error("Could not acknowledge", { description: errorMessage(error) }),
  });

  if (po.isPending) return <LoadingState rows={5} label="Loading purchase order" />;
  if (po.isError) {
    return (
      <div>
        <Back label="Purchase orders" />
        <ErrorState error={po.error} onRetry={() => po.refetch()} />
      </div>
    );
  }
  const p = po.data;
  const s = PO_STATUS[p.status];
  const net = p.lines.reduce((sum, l) => sum + l.qty * l.price.amount, 0);
  const poInvoices = (invoices.data ?? []).filter((i) => i.orderId === p.id);

  return (
    <div>
      <Back label="Purchase orders" />
      <PageHeader
        eyebrow="Purchase order from Brewfitt"
        documentTitle={`Purchase order ${p.number}`}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {p.number}
            <StatusPill tone={s.tone}>{s.label}</StatusPill>
          </span>
        }
        description={`Issued ${formatDate(p.createdAt)} · expected ${formatDate(p.expectedDate)} · ${formatMoney(p.total)}`}
        actions={
          <>
            <Button variant="outline" onClick={() => setPdfOpen(true)}>
              <FilePdfIcon aria-hidden />
              PDF
            </Button>
            {p.status === "issued" ? (
              <Button onClick={() => acknowledge.mutate()} disabled={acknowledge.isPending}>
                <CheckCircleIcon aria-hidden />
                {acknowledge.isPending ? "Acknowledging…" : "Acknowledge order"}
              </Button>
            ) : null}
          </>
        }
      />
      <section aria-label="Purchase order progress" className="mb-6 rounded-2xl border bg-card p-5">
        <OrderStageTracker stages={purchaseOrderStages(p, p.deliveries)} />
      </section>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-6">
          <section aria-labelledby="po-lines">
            <h2 id="po-lines" className="mb-3 font-medium">
              {plural(p.lines.length, "line")}
            </h2>
            <LinesTable
              linkProducts={false}
              products={productById}
              lines={p.lines.map((l) => ({
                productId: l.productId,
                description: productById.get(l.productId)?.name ?? l.productId,
                qty: l.qty,
                unitPrice: l.price,
                lineTotal: { amount: l.qty * l.price.amount, currency: "GBP" },
                extra: l.received ? `${l.received} of ${l.qty} received` : undefined,
              }))}
            />
          </section>
          <section aria-labelledby="po-deliveries">
            <h2 id="po-deliveries" className="mb-3 font-medium">
              Deliveries to Brewfitt
            </h2>
            {p.deliveries.length ? (
              <DeliveryTimeline deliveries={p.deliveries} products={productById} inbound />
            ) : (
              <EmptyState
                icon={PackageIcon}
                title="Nothing dispatched yet"
                description={`Brewfitt expects this order on ${formatDate(p.expectedDate)}.`}
              />
            )}
          </section>
          <section
            aria-labelledby="po-conversation"
            className="rounded-2xl border bg-card p-4 sm:p-5"
          >
            <h2 id="po-conversation" className="mb-4 flex items-center gap-2 font-medium">
              <ChatsCircleIcon className="size-5 text-primary" aria-hidden />
              Conversation with the buyer
            </h2>
            <ThreadView threadId={p.threadId} compact />
          </section>
        </div>
        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <section aria-label="Totals" className="rounded-2xl border bg-card p-5">
            <TotalsList
              subtotal={{ amount: net, currency: "GBP" }}
              vat={{ amount: p.total.amount - net, currency: "GBP" }}
              total={p.total}
            />
          </section>
          <SideCard title="Invoices and payment" icon={ReceiptIcon}>
            {poInvoices.length ? (
              <ul className="space-y-1.5 text-sm">
                {poInvoices.map((i) => (
                  <li key={i.id}>
                    <Link
                      href={hrefFor("invoice", i.id)}
                      className="flex items-center justify-between gap-2 hover:underline"
                    >
                      <span>{i.number}</span>
                      <StatusPill tone={INVOICE_STATUS[i.status].tone}>
                        {INVOICE_STATUS[i.status].label}
                      </StatusPill>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Invoiced when goods are received.</p>
            )}
          </SideCard>
          <SideCard title="Supplier Support" icon={LifebuoyIcon}>
            <Link
              href={`/cases?new=1&purchaseOrderId=${p.id}`}
              className="text-sm font-medium text-primary hover:underline"
            >
              Raise an issue about this purchase order
            </Link>
          </SideCard>
        </aside>
      </div>
      {me.data ? (
        <PdfPreview open={pdfOpen} onOpenChange={setPdfOpen} title={`Purchase order ${p.number}`}>
          <OrderDocument
            kind="Purchase order"
            number={p.number}
            date={p.createdAt}
            reference={null}
            partyLabel="Supplier"
            partyLines={[me.data.account.name]}
            deliverTo={null}
            lines={p.lines.map((l) => ({
              sku: productById.get(l.productId)?.sku ?? "",
              name: productById.get(l.productId)?.name ?? l.productId,
              qty: l.qty,
              unit: l.price.amount,
            }))}
            total={p.total.amount}
            vatRate={p.total.amount > net ? 0.2 : 0}
            note={`Deliver to Brewfitt Limited, Huddersfield, by ${formatDate(p.expectedDate)}. Quote ${p.number} on the delivery note.`}
          />
        </PdfPreview>
      ) : null}
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { z } from "zod";
import {
  CheckCircleIcon,
  FileTextIcon,
  ShoppingCartSimpleIcon,
  TrashIcon,
  WarningIcon,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { formatAddress } from "@/components/account/addresses";
import { TextareaField, TextField } from "@/components/forms/fields";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/states";
import { StockPill } from "@/components/shared/stock-pill";
import { ProductImage } from "@/components/shop/product-card";
import { QuantityStepper } from "@/components/shop/quantity-stepper";
import { Button } from "@/components/ui/button";
import { FieldError, FieldGroup, FieldLegend, FieldSet } from "@/components/ui/field";
import {
  CardFields,
  cardFieldsSchema,
  last4,
  validateCard,
} from "@/components/finance/card-fields";
import { useMe, usePersonaKey } from "@/features/session/use-session";
import { useBasket, useBasketMutations, useCatalogue } from "@/features/shop/use-catalogue";
import { api, errorMessage, queryKeys } from "@/lib/api";
import { formatDate, formatMoney, plural } from "@/lib/format";
import { hrefFor } from "@/lib/links";
import type { SalesOrder } from "@/types";

function nextWorkingDay(from: Date, days: number): string {
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate() + days));
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

const earliest = () => nextWorkingDay(new Date(), 1);

const CheckoutForm = z
  .object({
    deliveryAddressId: z.string().min(1, "Choose a delivery address"),
    requestedDate: z.iso.date({ message: "Choose a delivery date" }),
    poReference: z.string().trim().max(30, "Keep the reference under 30 characters").nullable(),
    notes: z.string().trim().max(500).nullable(),
    payByCard: z.boolean(),
  })
  .extend(cardFieldsSchema.shape)
  .superRefine((v, ctx) => {
    if (v.requestedDate < earliest())
      ctx.addIssue({
        code: "custom",
        path: ["requestedDate"],
        message: `The earliest delivery is ${formatDate(earliest())}`,
      });
    const day = new Date(`${v.requestedDate}T00:00:00Z`).getUTCDay();
    if (day === 0 || day === 6)
      ctx.addIssue({
        code: "custom",
        path: ["requestedDate"],
        message: "Brewfitt delivers Monday to Friday",
      });
    if (v.payByCard) validateCard(v, ctx);
  });
type CheckoutValues = z.infer<typeof CheckoutForm>;

export default function BasketPage() {
  const router = useRouter();
  const key = usePersonaKey();
  const queryClient = useQueryClient();
  const me = useMe();
  const basket = useBasket();
  const { priceList } = useCatalogue();
  const addresses = useQuery({
    queryKey: queryKeys.addresses(key),
    queryFn: () => api.account.addresses(),
  });
  const { update } = useBasketMutations();
  const [placed, setPlaced] = useState<SalesOrder | null>(null);

  const lines = useMemo(() => {
    const byId = new Map(priceList.data?.lines.map((l) => [l.productId, l]));
    return (basket.data?.lines ?? [])
      .map((l) => ({ ...l, line: byId.get(l.productId) }))
      .filter((l) => !!l.line);
  }, [basket.data, priceList.data]);
  const subtotal = lines.reduce((s, l) => s + l.qty * l.line!.price.amount, 0);
  const vatRate = me.data?.vatRate ?? 0.2;
  const vat = Math.round(subtotal * vatRate);
  const total = subtotal + vat;
  const onAccount = me.data?.credit?.onAccount ?? true;
  const available = me.data?.credit?.available?.amount;
  const groupRollUp = me.data?.persona.kind === "group" && !me.data.persona.activeSiteId;
  const siteAddresses = (addresses.data ?? []).filter((a) => a.accountId === me.data?.account.id);

  const form = useForm<CheckoutValues>({
    resolver: zodResolver(CheckoutForm),
    values: {
      deliveryAddressId:
        basket.data?.deliveryAddressId ?? siteAddresses.find((a) => a.isDefault)?.id ?? "",
      requestedDate: basket.data?.requestedDate ?? nextWorkingDay(new Date(), 3),
      poReference: basket.data?.poReference ?? null,
      notes: basket.data?.notes ?? null,
      payByCard: !onAccount,
      nameOnCard: "",
      cardNumber: "",
      expiry: "",
      cvc: "",
    },
    resetOptions: { keepDirtyValues: true },
  });

  const checkout = useMutation({
    mutationFn: (v: CheckoutValues) =>
      api.shop.checkout({
        deliveryAddressId: v.deliveryAddressId,
        requestedDate: v.requestedDate,
        poReference: v.poReference || null,
        notes: v.notes || null,
        paymentMethod: onAccount ? "account" : "card",
        card: onAccount ? null : { nameOnCard: v.nameOnCard, last4: last4(v.cardNumber) },
      }),
    onSuccess: (order) => {
      setPlaced(order);
      for (const k of [
        queryKeys.basket(key),
        queryKeys.salesOrders(key),
        queryKeys.invoices(key),
        queryKeys.statement(key),
        queryKeys.priceList(key),
        queryKeys.stock(key),
        queryKeys.notifications(key),
        queryKeys.threads(key),
        queryKeys.me(key),
        queryKeys.payments(key),
      ]) {
        void queryClient.invalidateQueries({ queryKey: k });
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    onError: (error) =>
      toast.error("Your order could not be placed", { description: errorMessage(error) }),
  });

  const requestQuote = useMutation({
    mutationFn: () => api.shop.requestQuote({ notes: form.getValues("notes") || null }),
    onSuccess: (quote) => {
      for (const k of [
        queryKeys.basket(key),
        queryKeys.quotes(key),
        queryKeys.threads(key),
        queryKeys.notifications(key),
        queryKeys.documents(key),
      ]) {
        void queryClient.invalidateQueries({ queryKey: k });
      }
      toast.success(`Quote ${quote.number} is ready to accept`);
      router.push(hrefFor("quote", quote.id));
    },
    onError: (error) =>
      toast.error("The quote could not be created", { description: errorMessage(error) }),
  });

  if (placed) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="mx-auto max-w-xl rounded-3xl border bg-card p-8 text-center"
        role="status"
      >
        <CheckCircleIcon weight="fill" className="mx-auto size-14 text-success" aria-hidden />
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">
          Order {placed.number} confirmed
        </h1>
        <p className="mt-2 text-muted-foreground">
          {onAccount ? "Charged to your account." : "Paid by card."} Delivery requested for{" "}
          {formatDate(placed.requestedDate)}. Brewfitt has emailed a confirmation, and you can
          follow the order here.
        </p>
        <p className="mt-4 text-lg font-semibold tabular-nums">{formatMoney(placed.total)}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button asChild>
            <Link href={hrefFor("sales-order", placed.id)}>View order</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/shop">Continue shopping</Link>
          </Button>
        </div>
      </motion.div>
    );
  }

  if (basket.isPending || priceList.isPending || me.isPending)
    return <LoadingState rows={4} label="Loading your basket" />;
  if (basket.isError) return <ErrorState error={basket.error} onRetry={() => basket.refetch()} />;

  return (
    <div>
      <PageHeader
        title="Basket"
        description={
          lines.length ? `${plural(lines.length, "product")} at your price-list prices.` : undefined
        }
        actions={
          <Button asChild variant="outline">
            <Link href="/shop">Continue shopping</Link>
          </Button>
        }
      />

      {lines.length === 0 ? (
        <EmptyState
          icon={ShoppingCartSimpleIcon}
          title="Your basket is empty"
          description="Add stock items from the shop or reorder your regular products."
          action={
            <Button asChild>
              <Link href="/shop?reorder=1">Buy again</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <section aria-label="Basket lines">
            <ul className="divide-y rounded-2xl border bg-card">
              {lines.map(({ productId, qty, line }) => (
                <li key={productId} className="flex gap-3 p-4">
                  <ProductImage
                    src={line!.product.images[0]}
                    alt=""
                    sizes="72px"
                    className="size-16 shrink-0 rounded-xl border sm:size-20"
                  />
                  <div className="min-w-0 flex-1">
                    <Link
                      href={hrefFor("product", productId)}
                      className="line-clamp-2 text-sm font-medium hover:underline"
                    >
                      {line!.product.name}
                    </Link>
                    <p className="font-mono text-[11px] text-muted-foreground">
                      {line!.product.sku}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <StockPill stock={line!.stock} />
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {formatMoney(line!.price)} each
                      </span>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <QuantityStepper
                        size="sm"
                        value={qty}
                        label={line!.product.name}
                        onChange={(n) =>
                          update.mutate({
                            lines: basket.data!.lines.map((l) =>
                              l.productId === productId ? { ...l, qty: n } : l,
                            ),
                          })
                        }
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          update.mutate({
                            lines: basket.data!.lines.filter((l) => l.productId !== productId),
                          })
                        }
                        aria-label={`Remove ${line!.product.name}`}
                      >
                        <TrashIcon aria-hidden />
                        <span className="hidden sm:inline">Remove</span>
                      </Button>
                    </div>
                  </div>
                  <p className="shrink-0 text-right font-medium tabular-nums">
                    {formatMoney({ amount: qty * line!.price.amount, currency: "GBP" })}
                  </p>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="checkout" className="lg:sticky lg:top-20 lg:self-start">
            <form
              onSubmit={form.handleSubmit((v) => checkout.mutate(v))}
              noValidate
              className="rounded-2xl border bg-card p-5"
            >
              <h2 id="checkout" className="mb-4 font-medium">
                Checkout
              </h2>
              {groupRollUp ? (
                <p className="mb-4 rounded-xl bg-info-subtle p-3 text-sm">
                  Choose a site with the site switcher to place this order for it.
                </p>
              ) : null}
              <FieldGroup>
                <Controller
                  control={form.control}
                  name="deliveryAddressId"
                  render={({ field, fieldState }) => (
                    <FieldSet data-invalid={fieldState.invalid || undefined}>
                      <FieldLegend variant="label">Deliver to</FieldLegend>
                      <div className="space-y-2">
                        {siteAddresses.map((a) => (
                          <label
                            key={a.id}
                            className="flex cursor-pointer gap-3 rounded-xl border p-3 has-checked:border-primary has-checked:bg-brand-subtle/50"
                          >
                            <input
                              type="radio"
                              name={field.name}
                              value={a.id}
                              checked={field.value === a.id}
                              onChange={() => field.onChange(a.id)}
                              className="mt-1 accent-[var(--primary)]"
                            />
                            <span className="min-w-0 text-sm">
                              <span className="block font-medium">{a.label}</span>
                              <span className="block text-muted-foreground">
                                {formatAddress(a).join(", ")}
                              </span>
                              {a.deliveryNotes ? (
                                <span className="mt-0.5 block text-xs text-muted-foreground">
                                  {a.deliveryNotes}
                                </span>
                              ) : null}
                            </span>
                          </label>
                        ))}
                      </div>
                      <FieldError errors={[fieldState.error]} />
                    </FieldSet>
                  )}
                />
                <TextField
                  control={form.control}
                  name="requestedDate"
                  label="Requested delivery date"
                  type="date"
                  min={earliest()}
                  description="Monday to Friday. Brewfitt confirms the date."
                />
                <TextField
                  control={form.control}
                  name="poReference"
                  label="Your PO reference (optional)"
                  nullable
                />
                <TextareaField
                  control={form.control}
                  name="notes"
                  label="Notes for Brewfitt (optional)"
                  nullable
                  rows={2}
                  placeholder="Delivery instructions or anything we should know"
                />

                {!onAccount ? <CardFields control={form.control} /> : null}
              </FieldGroup>

              <dl className="mt-5 space-y-1.5 border-t pt-4 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Subtotal</dt>
                  <dd className="tabular-nums">
                    {formatMoney({ amount: subtotal, currency: "GBP" })}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">
                    VAT{" "}
                    {vatRate === 0 ? "(export, zero-rated)" : `at ${Math.round(vatRate * 100)}%`}
                  </dt>
                  <dd className="tabular-nums">{formatMoney({ amount: vat, currency: "GBP" })}</dd>
                </div>
                <div className="flex justify-between text-base font-semibold">
                  <dt>Total</dt>
                  <dd className="tabular-nums">
                    {formatMoney({ amount: total, currency: "GBP" })}
                  </dd>
                </div>
              </dl>

              {onAccount && available !== undefined && total > available ? (
                <p className="mt-3 flex items-start gap-2 rounded-xl bg-warning-subtle p-3 text-sm">
                  <WarningIcon className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
                  This order is more than your available credit of{" "}
                  {formatMoney({ amount: available, currency: "GBP" })}. Brewfitt credit control
                  will be in touch before it is released.
                </p>
              ) : null}

              <Button
                type="submit"
                size="lg"
                className="mt-5 h-11 w-full rounded-full"
                disabled={checkout.isPending || groupRollUp}
              >
                {checkout.isPending
                  ? "Placing order…"
                  : onAccount
                    ? "Place order on account"
                    : `Pay ${formatMoney({ amount: total, currency: "GBP" })} and place order`}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="mt-2 h-11 w-full rounded-full"
                disabled={requestQuote.isPending || checkout.isPending || groupRollUp}
                onClick={() => requestQuote.mutate()}
              >
                <FileTextIcon aria-hidden />
                {requestQuote.isPending ? "Preparing quote…" : "Get a quote instead"}
              </Button>
              <p className="mt-2 text-center text-xs text-muted-foreground">
                A quote holds these prices for 30 days; accept it to place the order. Orders are
                subject to Brewfitt&apos;s conditions of sale.
              </p>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}

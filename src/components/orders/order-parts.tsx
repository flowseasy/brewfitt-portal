"use client";

import Link from "next/link";
import { CheckIcon, FileTextIcon, ImageIcon, TruckIcon } from "@phosphor-icons/react";
import type { Address, Delivery, Product, PurchaseOrder, SalesOrder } from "@/types";
import { formatAddress } from "@/components/account/addresses";
import { DocumentFooter, DocumentHeader, DocumentParty } from "@/components/shared/pdf-preview";
import { StatusPill } from "@/components/shared/status-pill";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { hrefFor } from "@/lib/links";
import { cn } from "@/lib/utils";

type Stage = { key: string; label: string; at: string | null };

/** Sales order stages from its own dates and deliveries. */
export function salesOrderStages(order: SalesOrder, deliveries: Delivery[]): Stage[] {
  const dispatched = deliveries.map((d) => d.dispatchedAt).filter((x): x is string => !!x).sort()[0] ?? null;
  const delivered = order.status === "delivered" ? (deliveries.map((d) => d.deliveredAt).filter((x): x is string => !!x).sort().at(-1) ?? null) : null;
  const reached = { confirmed: 0, picking: 1, dispatched: 2, "part-delivered": 2, delivered: 3, cancelled: -1 }[order.status];
  return [
    { key: "confirmed", label: "Confirmed", at: order.createdAt },
    { key: "picking", label: "Picking", at: null },
    { key: "dispatched", label: order.status === "part-delivered" ? "Part-delivered" : "Dispatched", at: dispatched },
    { key: "delivered", label: "Delivered", at: delivered },
  ].map((s, i) => ({ ...s, at: i <= reached ? (s.at ?? "reached") : null }));
}

export function purchaseOrderStages(po: PurchaseOrder, deliveries: Delivery[]): Stage[] {
  const reached = { issued: 0, acknowledged: 1, "in-transit": 2, "part-received": 2, received: 3 }[po.status];
  const dispatched = deliveries.map((d) => d.dispatchedAt).filter((x): x is string => !!x).sort()[0] ?? null;
  const received = deliveries.map((d) => d.deliveredAt).filter((x): x is string => !!x).sort().at(-1) ?? null;
  return [
    { key: "issued", label: "Issued", at: po.createdAt },
    { key: "acknowledged", label: "Acknowledged", at: null },
    { key: "in-transit", label: po.status === "part-received" ? "Part-received" : "In transit", at: dispatched },
    { key: "received", label: "Received", at: received },
  ].map((s, i) => ({ ...s, at: i <= reached ? (s.at ?? "reached") : null }));
}

/** Horizontal stage tracker; the current stage is announced to screen readers. */
export function OrderStageTracker({ stages, cancelled }: { stages: Stage[]; cancelled?: boolean }) {
  const current = stages.map((s) => !!s.at).lastIndexOf(true);
  if (cancelled) return <StatusPill tone="neutral">Cancelled</StatusPill>;
  return (
    <ol className="flex items-start" aria-label={`Order progress: ${stages[current]?.label ?? "Not started"}`}>
      {stages.map((s, i) => {
        const done = i <= current;
        return (
          <li key={s.key} className="relative flex flex-1 flex-col items-center text-center" aria-current={i === current ? "step" : undefined}>
            {i > 0 ? <span aria-hidden className={cn("absolute top-3.5 right-1/2 h-0.5 w-full", i <= current ? "bg-primary" : "bg-border")} /> : null}
            <span className={cn("relative z-10 flex size-7 items-center justify-center rounded-full border-2 bg-card", done ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground")}>
              {done ? <CheckIcon weight="bold" className="size-3.5" aria-hidden /> : <span className="size-1.5 rounded-full bg-current" />}
            </span>
            <span className={cn("mt-1.5 text-xs", i === current ? "font-semibold" : done ? "font-medium" : "text-muted-foreground")}>{s.label}</span>
            {s.at && s.at !== "reached" ? <span className="text-[11px] text-muted-foreground">{formatDate(s.at)}</span> : null}
          </li>
        );
      })}
    </ol>
  );
}

const DELIVERY_STATUS = { scheduled: { label: "Scheduled", tone: "info" }, dispatched: { label: "Dispatched", tone: "brand" }, "in-transit": { label: "In transit", tone: "brand" }, delivered: { label: "Delivered", tone: "success" } } as const;

export function DeliveryTimeline({ deliveries, products, inbound }: { deliveries: Delivery[]; products: Map<string, Product>; inbound?: boolean }) {
  return (
    <ol className="space-y-3">
      {deliveries.map((d) => {
        const s = DELIVERY_STATUS[d.status];
        return (
          <li key={d.id} id={d.id} className="scroll-mt-24 rounded-2xl border bg-card p-4">
            <div className="flex flex-wrap items-center gap-2">
              <TruckIcon className="size-5 text-primary" aria-hidden />
              <span className="font-medium">{d.number}</span>
              <StatusPill tone={s.tone}>{inbound && d.status === "delivered" ? "Received" : s.label}</StatusPill>
              <span className="ml-auto text-sm text-muted-foreground">{d.carrier ?? "Carrier to be confirmed"}</span>
            </div>
            <dl className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-xs text-muted-foreground">Dispatched</dt>
                <dd>{d.dispatchedAt ? formatDateTime(d.dispatchedAt) : "Not yet"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{inbound ? "Received" : "Delivered"}</dt>
                <dd>{d.deliveredAt ? formatDateTime(d.deliveredAt) : "On its way"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Tracking</dt>
                <dd className="font-mono text-xs">{d.trackingRef ?? (d.carrier === "Brewfitt delivery" ? "Brewfitt's own vehicle" : "Not provided")}</dd>
              </div>
            </dl>
            <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
              {d.lines.map((l) => (
                <li key={l.productId}>
                  {l.qty} × {products.get(l.productId)?.name ?? "item"}
                </li>
              ))}
            </ul>
            {d.noteDocumentId || d.proofDocumentId ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {d.noteDocumentId ? (
                  <Link href={hrefFor("document", d.noteDocumentId)} className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs hover:border-primary/40">
                    <FileTextIcon aria-hidden />
                    Delivery note
                  </Link>
                ) : null}
                {d.proofDocumentId ? (
                  <Link href={hrefFor("document", d.proofDocumentId)} className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs hover:border-primary/40">
                    <ImageIcon aria-hidden />
                    Proof of delivery
                  </Link>
                ) : null}
              </div>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

export function OrderDocument({
  kind,
  number,
  date,
  reference,
  partyLabel,
  partyLines,
  deliverTo,
  lines,
  total,
  vatRate,
  note,
}: {
  kind: string;
  number: string;
  date: string;
  reference: string | null;
  partyLabel: string;
  partyLines: string[];
  deliverTo: Address | null;
  lines: { sku: string; name: string; qty: number; unit: number }[];
  total: number;
  vatRate: number;
  note: string;
}) {
  const net = lines.reduce((s, l) => s + l.qty * l.unit, 0);
  return (
    <>
      <DocumentHeader kind={kind} number={number} date={date} meta={reference ? [{ label: "Your reference", value: reference }] : undefined} />
      <div className="my-6 grid grid-cols-2 gap-6">
        <DocumentParty label={partyLabel} lines={partyLines} />
        {deliverTo ? <DocumentParty label="Deliver to" lines={[deliverTo.label, ...formatAddress(deliverTo)]} /> : null}
      </div>
      <table className="w-full text-[12px]">
        <thead>
          <tr className="border-b border-neutral-300 text-left text-neutral-500">
            <th className="py-1.5 font-medium">SKU</th>
            <th className="py-1.5 font-medium">Description</th>
            <th className="py-1.5 text-right font-medium">Qty</th>
            <th className="py-1.5 text-right font-medium">Unit</th>
            <th className="py-1.5 text-right font-medium">Total</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={i} className="border-b border-neutral-100">
              <td className="py-1.5 pr-2 font-mono whitespace-nowrap">{l.sku}</td>
              <td className="py-1.5 pr-2">{l.name}</td>
              <td className="py-1.5 text-right">{l.qty}</td>
              <td className="py-1.5 text-right whitespace-nowrap">{formatMoney({ amount: l.unit, currency: "GBP" })}</td>
              <td className="py-1.5 text-right whitespace-nowrap">{formatMoney({ amount: l.qty * l.unit, currency: "GBP" })}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-4 ml-auto w-64 space-y-1 text-[12px]">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span>{formatMoney({ amount: net, currency: "GBP" })}</span>
        </div>
        <div className="flex justify-between">
          <span>VAT{vatRate ? ` at ${Math.round(vatRate * 100)}%` : " (zero-rated)"}</span>
          <span>{formatMoney({ amount: total - net, currency: "GBP" })}</span>
        </div>
        <div className="flex justify-between border-t border-neutral-300 pt-1 text-sm font-semibold">
          <span>Total</span>
          <span>{formatMoney({ amount: total, currency: "GBP" })}</span>
        </div>
      </div>
      <DocumentFooter note={note} />
    </>
  );
}

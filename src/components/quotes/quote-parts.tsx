"use client";

import Link from "next/link";
import type { Account, Address, Money, Product, Quote } from "@/types";
import { formatAddress } from "@/components/account/addresses";
import { DocumentFooter, DocumentHeader, DocumentParty } from "@/components/shared/pdf-preview";
import { formatDate, formatMoney } from "@/lib/format";
import { hrefFor } from "@/lib/links";

export type LineRow = {
  /** Null for a made-to-order composite line (decision 14). */
  productId: string | null;
  description: string;
  detail?: string | null;
  qty: number;
  unitPrice: Money;
  discountPercent?: number;
  lineTotal: Money;
  extra?: string;
};

/** Lines table for quotes, orders and invoices; a stacked list on phones. */
export function LinesTable({
  lines,
  products,
  linkProducts = true,
}: {
  lines: LineRow[];
  products?: Map<string, Product>;
  linkProducts?: boolean;
}) {
  return (
    <>
      <div className="hidden overflow-hidden rounded-2xl border bg-card sm:block">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-2.5 font-medium">
                Product
              </th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">
                Qty
              </th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">
                Unit price
              </th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium">
                Total
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {lines.map((l, i) => {
              const sku = l.productId ? products?.get(l.productId)?.sku : null;
              return (
                <tr key={`${l.productId}-${i}`}>
                  <td className="px-4 py-3">
                    {linkProducts && l.productId ? (
                      <Link
                        href={hrefFor("product", l.productId)}
                        className="font-medium hover:underline"
                      >
                        {l.description}
                      </Link>
                    ) : (
                      <span className="font-medium">{l.description}</span>
                    )}
                    {l.detail ? (
                      <span className="mt-0.5 block text-sm text-muted-foreground">{l.detail}</span>
                    ) : null}
                    <span className="block text-xs text-muted-foreground">
                      {sku ? <span className="font-mono">{sku}</span> : null}
                      {l.productId ? null : "Made to order"}
                      {l.discountPercent ? ` · ${l.discountPercent}% off list` : ""}
                      {l.extra ? ` · ${l.extra}` : ""}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">{l.qty}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{formatMoney(l.unitPrice)}</td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums">
                    {formatMoney(l.lineTotal)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <ul className="divide-y rounded-2xl border bg-card sm:hidden">
        {lines.map((l, i) => (
          <li key={`${l.productId}-${i}`} className="flex gap-3 p-3 text-sm">
            <span className="w-8 shrink-0 font-medium tabular-nums">{l.qty}×</span>
            <span className="min-w-0 flex-1">
              <span className="line-clamp-2 font-medium">{l.description}</span>
              {l.detail ? (
                <span className="block text-xs text-muted-foreground">{l.detail}</span>
              ) : null}
              <span className="block text-xs text-muted-foreground tabular-nums">
                {formatMoney(l.unitPrice)} each{l.extra ? ` · ${l.extra}` : ""}
              </span>
            </span>
            <span className="shrink-0 font-medium tabular-nums">{formatMoney(l.lineTotal)}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

export function TotalsList({
  subtotal,
  vat,
  total,
  vatLabel,
}: {
  subtotal: Money;
  vat: Money;
  total: Money;
  vatLabel?: string;
}) {
  return (
    <dl className="space-y-1.5 text-sm">
      <div className="flex justify-between">
        <dt className="text-muted-foreground">Subtotal</dt>
        <dd className="tabular-nums">{formatMoney(subtotal)}</dd>
      </div>
      <div className="flex justify-between">
        <dt className="text-muted-foreground">
          {vatLabel ?? (vat.amount === 0 ? "VAT (zero-rated)" : "VAT")}
        </dt>
        <dd className="tabular-nums">{formatMoney(vat)}</dd>
      </div>
      <div className="flex justify-between border-t pt-2 text-base font-semibold">
        <dt>Total</dt>
        <dd className="tabular-nums">{formatMoney(total)}</dd>
      </div>
    </dl>
  );
}

export function QuoteDocument({
  quote,
  account,
  billing,
  products,
}: {
  quote: Quote;
  account: Account;
  billing: Address | undefined;
  products: Map<string, Product>;
}) {
  return (
    <>
      <DocumentHeader
        kind="Quotation"
        number={quote.number}
        date={quote.createdAt}
        meta={[{ label: "Valid until", value: formatDate(quote.validUntil) }]}
      />
      <div className="my-6 grid grid-cols-2 gap-6">
        <DocumentParty
          label="Quote for"
          lines={[account.name, ...(billing ? formatAddress(billing) : [])]}
        />
        <DocumentParty
          label="Status"
          lines={[
            quote.status === "sent"
              ? "Awaiting acceptance"
              : quote.status[0]!.toUpperCase() + quote.status.slice(1),
          ]}
        />
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
          {quote.lines.map((l, i) => (
            <tr key={i} className="border-b border-neutral-100 align-top">
              <td className="py-1.5 pr-2 font-mono whitespace-nowrap">
                {l.productId ? products.get(l.productId)?.sku : "Made to order"}
              </td>
              <td className="py-1.5 pr-2">
                {l.description}
                {l.detail ? <span className="block text-neutral-500">{l.detail}</span> : null}
              </td>
              <td className="py-1.5 text-right">{l.qty}</td>
              <td className="py-1.5 text-right whitespace-nowrap">{formatMoney(l.unitPrice)}</td>
              <td className="py-1.5 text-right whitespace-nowrap">{formatMoney(l.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-4 ml-auto w-64 space-y-1 text-[12px]">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span>{formatMoney(quote.subtotal)}</span>
        </div>
        <div className="flex justify-between">
          <span>VAT</span>
          <span>{formatMoney(quote.vat)}</span>
        </div>
        <div className="flex justify-between border-t border-neutral-300 pt-1 text-sm font-semibold">
          <span>Total</span>
          <span>{formatMoney(quote.total)}</span>
        </div>
      </div>
      <DocumentFooter
        note={`This quotation is valid until ${formatDate(quote.validUntil)}. Brewfitt confirms installation and final pricing; installation, where included, is scheduled on acceptance.`}
      />
    </>
  );
}

"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { ConfigurationLine, ConfiguratorStepId, Money, Product } from "@/types";
import { formatMoney, plural } from "@/lib/format";

export function BillOfMaterials({
  lines,
  total,
  vatRate,
  products,
  errors,
  compact,
}: {
  lines: ConfigurationLine[];
  total: Money;
  vatRate: number;
  products: Map<string, Product>;
  errors?: Partial<Record<ConfiguratorStepId, string[]>>;
  compact?: boolean;
}) {
  const vat = Math.round(total.amount * vatRate);
  const openSteps = Object.keys(errors ?? {}).length;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-medium">Bill of materials</h2>
        <span className="text-xs text-muted-foreground">{plural(lines.length, "line")}</span>
      </div>
      {lines.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Choose options to build the list of parts.
        </p>
      ) : (
        <ul className={compact ? "mt-3 max-h-[40dvh] divide-y overflow-y-auto" : "mt-3 divide-y"}>
          <AnimatePresence initial={false}>
            {lines.map((l) => {
              const p = products.get(l.productId);
              return (
                <motion.li
                  key={l.productId}
                  layout
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.18 }}
                  className="flex gap-3 py-2 text-sm"
                >
                  <span className="w-8 shrink-0 text-right font-medium tabular-nums">{l.qty}×</span>
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2">{p?.name ?? l.productId}</span>
                    <span className="block text-xs text-muted-foreground tabular-nums">
                      {p?.sku} · {formatMoney(l.price)} {p?.unit === "metre" ? "per metre" : "each"}
                    </span>
                  </span>
                  <span className="shrink-0 tabular-nums">
                    {formatMoney({ amount: l.qty * l.price.amount, currency: l.price.currency })}
                  </span>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}
      <dl className="mt-3 space-y-1 border-t pt-3 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Total at your prices</dt>
          <dd className="font-medium tabular-nums">{formatMoney(total)}</dd>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <dt>VAT {vatRate ? `at ${Math.round(vatRate * 100)}%` : "(zero-rated export)"}</dt>
          <dd className="tabular-nums">{formatMoney({ amount: vat, currency: total.currency })}</dd>
        </div>
        <div className="flex justify-between text-base font-semibold">
          <dt>Including VAT</dt>
          <dd className="tabular-nums" aria-live="polite">
            {formatMoney({ amount: total.amount + vat, currency: total.currency })}
          </dd>
        </div>
      </dl>
      <p className="mt-2 text-xs text-muted-foreground">
        {openSteps ? `${plural(openSteps, "step")} still to complete. ` : ""}Brewfitt confirms
        installation and final pricing on the quote.
      </p>
    </div>
  );
}

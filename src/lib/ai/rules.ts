import type {
  Account,
  AIInsight,
  Invoice,
  Message,
  Money,
  PriceListLine,
  Product,
  PurchaseOrder,
  Quote,
  SalesOrder,
  StockPosition,
  Thread,
} from "@/types";
import { formatDate, formatMoney, formatMoneyRange, gbp, plural } from "@/lib/format";

/**
 * Deterministic mock AI (BLUEPRINT.md "Deterministic mock logic"). Every
 * insight is derived from the records passed in; nothing is hand-written.
 * Phase 2 replaces these rules with TOTA360v5 intelligence behind the same
 * AIInsight shape.
 */

const DAY = 86_400_000;
const days = (from: string, to: Date) =>
  Math.floor((to.getTime() - new Date(from).getTime()) / DAY);

export type InsightInputs = {
  today: Date;
  accounts: Account[];
  products: Product[];
  priceListLines: PriceListLine[];
  stock: StockPosition[];
  salesOrders: SalesOrder[];
  purchaseOrders: PurchaseOrder[];
  quotes: Quote[];
  threads: Thread[];
  messages: Message[];
  invoices: Invoice[];
  /** Month (1–12) → factor. */
  seasonality: Record<number, number>;
};

export const RULES = {
  reorderDueFactor: 1.2,
  reorderDueHighFactor: 1.5,
  minOrdersForInterval: 3,
  stockLookbackDays: 365,
  suggestionSectorShare: 0.4,
  quoteExpiryWindowDays: 7,
  quoteQuietDays: 5,
  invoiceDueWindowDays: 5,
  invoiceHighOverdueDays: 30,
  forecastHistoryMonths: 6,
  forecastHorizonMonths: 3,
} as const;

function insight(base: Omit<AIInsight, "id" | "simulated">): AIInsight {
  return {
    ...base,
    id: `ins_${base.category}_${base.accountId}_${base.relatedId}`,
    simulated: true,
  };
}

function orderDate(order: SalesOrder): string {
  return order.createdAt;
}

/** Customer rules, evaluated for one account (a site or a standalone customer). */
export function customerInsights(accountId: string, input: InsightInputs): AIInsight[] {
  const { today } = input;
  const createdAt = today.toISOString();
  const account = input.accounts.find((a) => a.id === accountId);
  if (!account || account.kind !== "customer") return [];
  // Site accounts use their group's price list (decision 10).
  const priceListId =
    account.priceListId ??
    input.accounts.find((a) => a.id === account.parentAccountId)?.priceListId ??
    null;
  const productById = new Map(input.products.map((p) => [p.id, p]));
  const stockById = new Map(input.stock.map((s) => [s.productId, s]));
  const orders = input.salesOrders
    .filter((o) => o.accountId === accountId && o.status !== "cancelled")
    .sort((a, b) => orderDate(a).localeCompare(orderDate(b)));
  const out: AIInsight[] = [];

  // ---- Reorder due: daysSinceLastOrder > 1.2 × averageIntervalDays (High if > 1.5×)
  const byProduct = new Map<string, { dates: string[]; values: number[]; qtys: number[] }>();
  for (const o of orders) {
    for (const line of o.lines) {
      const entry = byProduct.get(line.productId) ?? { dates: [], values: [], qtys: [] };
      if (entry.dates[entry.dates.length - 1] !== orderDate(o)) entry.dates.push(orderDate(o));
      entry.values.push(line.qty * line.price.amount);
      entry.qtys.push(line.qty);
      byProduct.set(line.productId, entry);
    }
  }
  for (const [productId, h] of byProduct) {
    if (h.dates.length < RULES.minOrdersForInterval) continue;
    const gaps = h.dates
      .slice(1)
      .map((d, i) => (new Date(d).getTime() - new Date(h.dates[i]!).getTime()) / DAY);
    const averageIntervalDays = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    const daysSinceLastOrder = days(h.dates[h.dates.length - 1]!, today);
    if (
      averageIntervalDays <= 0 ||
      daysSinceLastOrder <= RULES.reorderDueFactor * averageIntervalDays
    )
      continue;
    const product = productById.get(productId);
    if (!product) continue;
    const high = daysSinceLastOrder > RULES.reorderDueHighFactor * averageIntervalDays;
    const stock = stockById.get(productId);
    const weeks = (n: number) =>
      n >= 14 ? plural(Math.round(n / 7), "week") : plural(Math.round(n), "day");
    out.push(
      insight({
        accountId,
        category: "reorder-due",
        severity: high ? "warning" : "info",
        title: `${product.name} is due for reorder`,
        whatIsHappening: `You usually reorder ${product.name} every ${weeks(averageIntervalDays)}; the last order was ${weeks(daysSinceLastOrder)} ago.`,
        whyItMatters: "Running out mid-service loses trade.",
        valueAtStake: { low: gbp(Math.min(...h.values)), high: gbp(Math.max(...h.values)) },
        confidence: high ? "high" : "medium",
        recommendedAction:
          stock && stock.available > 0
            ? `Reorder now; ${stock.available} in stock at Brewfitt.`
            : "Reorder now; Brewfitt will confirm the delivery date.",
        relatedType: "product",
        relatedId: productId,
        createdAt,
      }),
    );
  }

  // ---- Stock-out risk: stockOnHand < minimumLevel for a product bought in the last 12 months
  const recent = new Set(
    orders
      .filter((o) => days(orderDate(o), today) <= RULES.stockLookbackDays)
      .flatMap((o) => o.lines.map((l) => l.productId)),
  );
  for (const productId of recent) {
    const stock = stockById.get(productId);
    const product = productById.get(productId);
    if (!stock || !product || stock.onHand >= stock.minimumLevel) continue;
    const history = byProduct.get(productId)!;
    const out_ = stock.onHand === 0;
    out.push(
      insight({
        accountId,
        category: "stock-out-risk",
        severity: out_ ? "critical" : "warning",
        title: `${product.name} is ${out_ ? "out of stock" : "running low"} at Brewfitt`,
        whatIsHappening: `Brewfitt has ${stock.onHand} on hand against a minimum of ${stock.minimumLevel}.${stock.expectedAt ? ` More expected ${formatDate(stock.expectedAt)}.` : ""}`,
        whyItMatters:
          "You buy this regularly; ordering early secures your share of the remaining stock.",
        valueAtStake: {
          low: gbp(Math.min(...history.values)),
          high: gbp(Math.max(...history.values)),
        },
        confidence: out_ ? "high" : "medium",
        recommendedAction:
          stock.available > 0
            ? `Order now; ${stock.available} available.`
            : "Order now to be allocated from the next delivery.",
        relatedType: "product",
        relatedId: productId,
        createdAt,
      }),
    );
  }

  // ---- Product suggestion: bought by ≥ 40% of same-sector accounts, not by this account
  const peers = input.accounts.filter(
    (a) => a.kind === "customer" && !a.isGroup && a.sector === account.sector && a.id !== accountId,
  );
  if (peers.length > 0) {
    const bought = new Map<string, Set<string>>();
    for (const o of input.salesOrders) {
      if (o.status === "cancelled" || !peers.some((p) => p.id === o.accountId)) continue;
      for (const l of o.lines) {
        const set = bought.get(l.productId) ?? new Set<string>();
        set.add(o.accountId);
        bought.set(l.productId, set);
      }
    }
    const own = new Set(byProduct.keys());
    const sectorLabel = account.sector.replace("-", " ");
    for (const [productId, buyers] of bought) {
      const share = buyers.size / peers.length;
      if (share < RULES.suggestionSectorShare || own.has(productId)) continue;
      const product = productById.get(productId);
      if (!product) continue;
      // Only suggest what the account can buy at its own price.
      const price = input.priceListLines.find(
        (l) => l.priceListId === priceListId && l.productId === productId,
      )?.price;
      if (!price) continue;
      out.push(
        insight({
          accountId,
          category: "product-suggestion",
          severity: "info",
          title: `Customers like you also buy ${product.name}`,
          whatIsHappening: `${Math.round(share * 100)}% of ${sectorLabel} accounts buy ${product.name}; you have not ordered it yet.`,
          whyItMatters: "Similar venues use it alongside the products you already buy.",
          valueAtStake: { low: price, high: gbp(price.amount * 4) },
          confidence: "medium",
          recommendedAction: `View ${product.name} at your price of ${formatMoney(price)}.`,
          relatedType: "product",
          relatedId: productId,
          createdAt,
        }),
      );
    }
  }

  // ---- Quote follow-up: expires within 7 days, no message or view in 5 days
  for (const q of input.quotes) {
    if (q.accountId !== accountId || q.status !== "sent") continue;
    const daysToExpiry = -days(`${q.validUntil}T00:00:00Z`, today);
    if (daysToExpiry < 0 || daysToExpiry > RULES.quoteExpiryWindowDays) continue;
    const lastMessage = input.messages
      .filter((m) => m.threadId === q.threadId)
      .reduce<string | null>(
        (latest, m) => (!latest || m.sentAt > latest ? m.sentAt : latest),
        null,
      );
    const lastActivity = [lastMessage, q.lastViewedAt]
      .filter((d): d is string => !!d)
      .sort()
      .pop();
    if (lastActivity && days(lastActivity, today) <= RULES.quoteQuietDays) continue;
    out.push(
      insight({
        accountId,
        category: "quote-follow-up",
        severity: daysToExpiry <= 2 ? "warning" : "info",
        title: `Quote ${q.number} expires ${daysToExpiry === 0 ? "today" : `in ${plural(daysToExpiry, "day")}`}`,
        whatIsHappening: `Quote ${q.number} for ${formatMoney(q.total)} has had no activity for over ${RULES.quoteQuietDays} days.`,
        whyItMatters: "Prices and stock allocation are held only until the quote expires.",
        valueAtStake: { low: q.subtotal, high: q.total },
        confidence: daysToExpiry <= 2 ? "high" : "medium",
        recommendedAction:
          "Review the quote and accept it, or ask Brewfitt a question in its thread.",
        relatedType: "quote",
        relatedId: q.id,
        createdAt,
      }),
    );
  }

  out.push(...invoiceInsights(accountId, input));
  return out;
}

/** Invoice ageing: due within 5 days or overdue (High when overdue > 30 days). */
export function invoiceInsights(accountId: string, input: InsightInputs): AIInsight[] {
  const { today } = input;
  const out: AIInsight[] = [];
  for (const inv of input.invoices) {
    if (inv.accountId !== accountId || inv.kind !== "invoice" || inv.outstanding.amount <= 0)
      continue;
    const daysToDue = -days(inv.dueAt, today);
    const overdueDays = -daysToDue;
    if (daysToDue > RULES.invoiceDueWindowDays) continue;
    const overdue = overdueDays > 0;
    const high = overdueDays > RULES.invoiceHighOverdueDays;
    out.push(
      insight({
        accountId,
        category: "invoice-ageing",
        severity: high ? "critical" : overdue ? "warning" : "info",
        title: overdue
          ? `Invoice ${inv.number} is ${plural(overdueDays, "day")} overdue`
          : `Invoice ${inv.number} is due ${daysToDue === 0 ? "today" : `in ${plural(daysToDue, "day")}`}`,
        whatIsHappening: `${formatMoney(inv.outstanding)} outstanding, due ${formatDate(inv.dueAt)}.`,
        whyItMatters: overdue
          ? "Overdue balances reduce your available credit and can put orders on hold."
          : "Paying on time keeps your credit available for the next order.",
        valueAtStake: { low: inv.outstanding, high: inv.outstanding },
        confidence: high ? "high" : "medium",
        recommendedAction: overdue
          ? "Pay now or contact credit control if there is a query."
          : "Schedule payment before the due date.",
        relatedType: "invoice",
        relatedId: inv.id,
        createdAt: today.toISOString(),
      }),
    );
  }
  return out;
}

export type ForecastRow = {
  productId: string;
  averageMonthlyQuantity: number;
  months: { month: string; quantity: number; value: Money }[];
};

/** Supplier forecast = average monthly purchases over 6 months × seasonal factor. */
export function supplierForecast(supplierId: string, input: InsightInputs): ForecastRow[] {
  const { today } = input;
  const windowStart = new Date(
    Date.UTC(
      today.getUTCFullYear(),
      today.getUTCMonth() - RULES.forecastHistoryMonths,
      today.getUTCDate(),
    ),
  );
  const qty = new Map<string, { qty: number; value: number }>();
  for (const po of input.purchaseOrders) {
    if (po.supplierId !== supplierId || new Date(po.createdAt) < windowStart) continue;
    for (const l of po.lines) {
      const e = qty.get(l.productId) ?? { qty: 0, value: 0 };
      e.qty += l.qty;
      e.value += l.qty * l.price.amount;
      qty.set(l.productId, e);
    }
  }
  const rows: ForecastRow[] = [];
  for (const [productId, e] of qty) {
    const averageMonthlyQuantity = e.qty / RULES.forecastHistoryMonths;
    const unit = e.value / e.qty;
    const months = Array.from({ length: RULES.forecastHorizonMonths }, (_, i) => {
      const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1 + i, 1));
      const factor = input.seasonality[d.getUTCMonth() + 1] ?? 1;
      const quantity = Math.round(averageMonthlyQuantity * factor);
      return { month: d.toISOString().slice(0, 7), quantity, value: gbp(quantity * unit) };
    });
    rows.push({
      productId,
      averageMonthlyQuantity: Math.round(averageMonthlyQuantity * 10) / 10,
      months,
    });
  }
  return rows.sort((a, b) => b.averageMonthlyQuantity - a.averageMonthlyQuantity);
}

/** Supplier rules: stock-out risk on their items (a PO is likely) and demand forecast. */
export function supplierInsights(supplierId: string, input: InsightInputs): AIInsight[] {
  const { today } = input;
  const createdAt = today.toISOString();
  const out: AIInsight[] = [];
  const forecast = supplierForecast(supplierId, input);
  const forecastById = new Map(forecast.map((f) => [f.productId, f]));
  const costOf = (productId: string) => {
    const last = input.purchaseOrders
      .filter((po) => po.supplierId === supplierId)
      .flatMap((po) => po.lines)
      .find((l) => l.productId === productId);
    return (
      last?.price.amount ?? input.products.find((p) => p.id === productId)!.listPrice.amount * 0.55
    );
  };

  for (const product of input.products.filter((p) => p.supplierId === supplierId)) {
    const stock = input.stock.find((s) => s.productId === product.id);
    if (!stock || stock.onHand >= stock.minimumLevel) continue;
    const f = forecastById.get(product.id);
    const monthly = Math.max(f?.averageMonthlyQuantity ?? 0, stock.minimumLevel - stock.onHand);
    const cost = costOf(product.id);
    const low = Math.round((stock.minimumLevel - stock.onHand) * cost);
    const high = Math.round((stock.minimumLevel - stock.onHand + monthly * 2) * cost);
    out.push(
      insight({
        accountId: supplierId,
        category: "stock-out-risk",
        severity: stock.onHand === 0 ? "critical" : "warning",
        title: `Brewfitt stock of ${product.name} is below minimum`,
        whatIsHappening: `Brewfitt holds ${stock.onHand} against a minimum of ${stock.minimumLevel}${stock.onOrder > 0 ? `, with ${stock.onOrder} already on order` : ""}.`,
        whyItMatters:
          stock.onOrder > 0
            ? "Further orders are likely once the open purchase order is received."
            : "A purchase order is likely within 2 weeks.",
        valueAtStake: { low: gbp(Math.max(low, cost)), high: gbp(Math.max(high, cost * 2)) },
        confidence: stock.onOrder > 0 ? "low" : f ? "high" : "medium",
        recommendedAction: "Confirm lead time and current price.",
        relatedType: "product",
        relatedId: product.id,
        createdAt,
      }),
    );
  }

  for (const f of forecast.slice(0, 3)) {
    const product = input.products.find((p) => p.id === f.productId);
    if (!product) continue;
    const total = f.months.reduce((s, m) => s + m.quantity, 0);
    const values = f.months.map((m) => m.value.amount);
    out.push(
      insight({
        accountId: supplierId,
        category: "demand-forecast",
        severity: "info",
        title: `Forecast: ${plural(total, "unit")} of ${product.name} over 3 months`,
        whatIsHappening: `Brewfitt bought an average of ${f.averageMonthlyQuantity} a month over the last 6 months; seasonal demand projects ${f.months.map((m) => m.quantity).join(", ")} for the next three months.`,
        whyItMatters:
          "Holding stock ahead of peak months shortens Brewfitt's lead time to its customers.",
        valueAtStake: { low: gbp(Math.min(...values) * 3), high: gbp(Math.max(...values) * 3) },
        confidence: f.averageMonthlyQuantity >= 5 ? "medium" : "low",
        recommendedAction: `Plan production or stock for ${formatMoneyRange(gbp(Math.min(...values) * 3), gbp(Math.max(...values) * 3))} of orders.`,
        relatedType: "product",
        relatedId: f.productId,
        createdAt,
      }),
    );
  }
  return out;
}

const severityRank = { critical: 0, warning: 1, info: 2 } as const;

export function sortInsights(insights: AIInsight[]): AIInsight[] {
  return [...insights].sort(
    (a, b) => severityRank[a.severity] - severityRank[b.severity] || a.title.localeCompare(b.title),
  );
}

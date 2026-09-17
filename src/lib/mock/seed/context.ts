import type { Account, Category, Money, PriceList, PriceListLine, Product } from "@/types";
import { addDays, isoDate, toDate } from "../clock";
import type { Rng } from "../random";
import { productRole, type ProductRole } from "./catalogue";

/** Month (1–12) → demand factor: spring, run-up to summer and December peak. */
export const SEASONALITY: Record<number, number> = {
  1: 0.7,
  2: 0.8,
  3: 1.1,
  4: 1.25,
  5: 1.3,
  6: 1.2,
  7: 1.0,
  8: 0.9,
  9: 0.95,
  10: 1.0,
  11: 1.15,
  12: 1.3,
};

export type SeedContext = {
  rng: Rng;
  today: Date;
  accounts: Account[];
  categories: Category[];
  products: Product[];
  priceLists: PriceList[];
  priceListLines: PriceListLine[];
  productById: Map<string, Product>;
  roleOf: (product: Product) => ProductRole;
  /** Price of a product on an account's effective price list, or null when it is not on the list. */
  priceFor: (accountId: string, productId: string) => Money | null;
  /** Products on an account's effective price list. */
  listProducts: (accountId: string) => Product[];
  account: (id: string) => Account;
  /** Flat mock VAT (decision 8): 20% UK, 0% export. */
  vatRate: (accountId: string) => number;
  number: (kind: keyof typeof NUMBER_START) => string;
  /** A date within the last `days`, biased by seasonality. */
  seasonalDate: (fromDaysAgo: number, toDaysAgo: number) => Date;
};

const NUMBER_START = {
  quote: ["QU-", 23180],
  salesOrder: ["SO-", 104520],
  purchaseOrder: ["PO-", 38240],
  delivery: ["DN-", 71300],
  invoice: ["INV-", 58010],
  creditNote: ["CN-", 1040],
  selfBill: ["SB-", 2200],
  supplierInvoice: ["PI-", 44100],
  rfq: ["RFQ-", 410],
  case: ["CS-", 1170],
  payment: ["PAY-", 90210],
  paymentRun: ["RUN-", 310],
  configuration: ["CFG-", 700],
} as const;

export function effectivePriceListId(account: Account, accounts: Account[]): string | null {
  if (account.priceListId) return account.priceListId;
  const parent = accounts.find((a) => a.id === account.parentAccountId);
  return parent?.priceListId ?? null;
}

export function createContext(args: {
  rng: Rng;
  today: Date;
  accounts: Account[];
  categories: Category[];
  products: Product[];
  priceLists: PriceList[];
  priceListLines: PriceListLine[];
  countryOf: (accountId: string) => string;
}): SeedContext {
  const { rng, today, accounts, categories, products, priceLists, priceListLines } = args;
  const productById = new Map(products.map((p) => [p.id, p]));
  const accountById = new Map(accounts.map((a) => [a.id, a]));
  const lineIndex = new Map(priceListLines.map((l) => [`${l.priceListId}|${l.productId}`, l]));
  const counters = new Map<string, number>();

  const account = (id: string) => {
    const a = accountById.get(id);
    if (!a) throw new Error(`Unknown account ${id}`);
    return a;
  };

  return {
    rng,
    today,
    accounts,
    categories,
    products,
    priceLists,
    priceListLines,
    productById,
    roleOf: (p) => productRole(p, categories),
    priceFor: (accountId, productId) => {
      const listId = effectivePriceListId(account(accountId), accounts);
      return listId ? (lineIndex.get(`${listId}|${productId}`)?.price ?? null) : null;
    },
    listProducts: (accountId) => {
      const listId = effectivePriceListId(account(accountId), accounts);
      return products.filter((p) => lineIndex.has(`${listId}|${p.id}`));
    },
    account,
    vatRate: (accountId) => (args.countryOf(accountId) === "GB" ? 0.2 : 0),
    number: (kind) => {
      const [prefix, start] = NUMBER_START[kind];
      const n = (counters.get(kind) ?? start) + 1;
      counters.set(kind, n);
      return `${prefix}${n}`;
    },
    seasonalDate: (fromDaysAgo, toDaysAgo) => {
      // Rejection sampling against the seasonal factor keeps peaks realistic.
      for (let i = 0; i < 50; i++) {
        const d = addDays(today, -rng.int(toDaysAgo, fromDaysAgo));
        const factor = SEASONALITY[d.getUTCMonth() + 1] ?? 1;
        if (rng.next() < factor / 1.3) return d;
      }
      return addDays(today, -rng.int(toDaysAgo, fromDaysAgo));
    },
  };
}

export const money = (amount: number, currency: Money["currency"] = "GBP"): Money => ({
  amount: Math.round(amount),
  currency,
});

/** Due date from payment terms. */
export function dueDate(issued: Date, terms: Account["paymentTerms"]): Date {
  switch (terms) {
    case "proforma":
      return issued;
    case "7-days":
      return addDays(issued, 7);
    case "14-days":
      return addDays(issued, 14);
    case "30-days":
      return addDays(issued, 30);
    case "60-days":
      return addDays(issued, 60);
    case "30-days-eom": {
      // End of the month following the invoice month.
      return new Date(Date.UTC(issued.getUTCFullYear(), issued.getUTCMonth() + 2, 0));
    }
  }
}

export function isWeekend(d: Date) {
  return d.getUTCDay() === 0 || d.getUTCDay() === 6;
}

export function workingDay(d: Date): Date {
  let x = d;
  while (isWeekend(x)) x = addDays(x, 1);
  return x;
}

/** Created dates roll back to the previous working day so they are never in the future. */
export function previousWorkingDay(d: Date): Date {
  let x = d;
  while (isWeekend(x)) x = addDays(x, -1);
  return x;
}

export const dateOnly = (d: Date | string) => isoDate(toDate(d));

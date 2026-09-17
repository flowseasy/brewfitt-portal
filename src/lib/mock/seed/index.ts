import { ConfiguratorRules } from "@/schemas";
import { customerInsights, supplierInsights } from "@/lib/ai/rules";
import { CONFIGURATOR_RULES } from "../data/configurator-rules";
import { isoDate } from "../clock";
import type { MockDb } from "../db";
import { DB_VERSION } from "../version";
import { createRng } from "../random";
import { productRole, seedCatalogue } from "./catalogue";
import { seedComms } from "./comms";
import { seedCommerce, seedPriceLists } from "./commerce";
import { seedContent } from "./content";
import { createContext, SEASONALITY } from "./context";
import { deriveInvoice, seedFinance } from "./finance";
import { seedPeople } from "./people";
import { seedPurchasing } from "./purchasing";

/** Fixed seed: the same structure every day, dated relative to `today` (decision 3). */
const SEED = 1966;

/**
 * Moves timestamps that are later than `cap` back to just before it, keeping
 * their relative order (latest stays latest, a few minutes apart).
 */
function clampToNow(cap: number, targets: [object[], string[]][]) {
  const late: { record: Record<string, unknown>; field: string; ms: number }[] = [];
  for (const [records, fields] of targets) {
    for (const record of records as Record<string, unknown>[]) {
      for (const field of fields) {
        const value = record[field];
        if (typeof value === "string" && value.length > 10 && Date.parse(value) > cap)
          late.push({ record, field, ms: Date.parse(value) });
      }
    }
  }
  late.sort((a, b) => b.ms - a.ms);
  late.forEach((item, i) => {
    item.record[item.field] = new Date(cap - i * 3 * 60_000).toISOString();
  });
}

export function generateDb(today: Date): MockDb {
  const rng = createRng(SEED);
  const people = seedPeople(rng, today);
  const { categories, products } = seedCatalogue();
  const configuratorRules = ConfiguratorRules.parse(CONFIGURATOR_RULES);

  const suppliers = people.accounts.filter((a) => a.kind === "supplier");
  const isFontOrTap = (p: (typeof products)[number]) => /cat_bar-(fonts|taps)/.test(p.category);
  const { priceLists, priceListLines } = seedPriceLists({
    today,
    products,
    suppliers,
    rng,
    isFontOrTap,
    isConsumable: (p) => productRole(p, categories) === "consumable",
  });

  const countryOf = (accountId: string) => {
    const account = people.accounts.find((a) => a.id === accountId)!;
    return people.addresses.find((a) => a.id === account.billingAddressId)!.country;
  };
  const ctx = createContext({
    rng,
    today,
    accounts: people.accounts,
    categories,
    products,
    priceLists,
    priceListLines,
    countryOf,
  });

  const commerce = seedCommerce(ctx, { addresses: people.addresses });
  const purchasing = seedPurchasing(ctx, commerce);
  const deliveries = [...commerce.deliveries, ...purchasing.inboundDeliveries];
  const finance = seedFinance(ctx, {
    salesOrders: commerce.salesOrders,
    deliveries: commerce.deliveries,
    purchaseOrders: purchasing.purchaseOrders,
    inboundDeliveries: purchasing.inboundDeliveries,
    cardPaidOrderIds: commerce.cardPaidOrderIds,
  });
  const content = seedContent(ctx, {
    quotes: commerce.quotes,
    salesOrders: commerce.salesOrders,
    purchaseOrders: purchasing.purchaseOrders,
    deliveries,
    invoices: finance.invoices,
    payments: finance.payments,
    supplierProducts: purchasing.supplierProducts,
    products,
    categories,
  });

  // Insights are computed from the seeded records, so notifications that cite them are consistent.
  const invoicesNow = finance.invoices.map((i) => deriveInvoice(i, today));
  const insightInputs = {
    today,
    accounts: people.accounts,
    products,
    priceListLines,
    stock: purchasing.stock,
    salesOrders: commerce.salesOrders,
    purchaseOrders: purchasing.purchaseOrders,
    quotes: commerce.quotes,
    threads: [],
    messages: [],
    invoices: invoicesNow,
    seasonality: SEASONALITY,
  };
  const insights = people.accounts.flatMap((a) =>
    a.kind === "supplier"
      ? supplierInsights(a.id, insightInputs)
      : a.isGroup
        ? []
        : customerInsights(a.id, insightInputs),
  );

  const comms = seedComms(ctx, {
    team: people.team,
    contacts: people.contacts,
    addresses: people.addresses,
    quotes: commerce.quotes,
    configurations: commerce.configurations,
    salesOrders: commerce.salesOrders,
    deliveries,
    changeRequests: commerce.changeRequests,
    jobs: commerce.jobs,
    purchaseOrders: purchasing.purchaseOrders,
    documents: content.documents,
    payments: finance.payments,
    rfqs: purchasing.rfqs,
    supplierProducts: purchasing.supplierProducts,
    invoices: finance.invoices,
    paymentRuns: finance.paymentRuns,
    rolloutOrderId: commerce.rolloutOrderId,
    insights,
  });

  // Seeded times of day are fixed, so on the real today some would still be ahead of the clock.
  if (isoDate(today) === isoDate(new Date())) {
    clampToNow(Date.now() - 2 * 60_000, [
      [comms.messages, ["sentAt"]],
      [comms.notifications, ["createdAt"]],
      [comms.cases, ["createdAt", "updatedAt"]],
      [commerce.quotes, ["createdAt", "updatedAt", "lastViewedAt"]],
      [commerce.salesOrders, ["createdAt"]],
      [commerce.changeRequests, ["createdAt"]],
      [commerce.configurations, ["createdAt", "updatedAt"]],
      [commerce.jobs, ["signedOffAt"]],
      [deliveries, ["dispatchedAt", "deliveredAt"]],
      [purchasing.purchaseOrders, ["createdAt"]],
      [purchasing.rfqs, ["createdAt"]],
      [purchasing.supplierQuotes, ["submittedAt"]],
      [purchasing.supplierProducts, ["submittedAt", "updatedAt"]],
      [purchasing.offers, ["createdAt"]],
      [finance.invoices, ["issuedAt"]],
      [finance.payments, ["paidAt"]],
      [content.documents, ["modifiedAt"]],
      [content.knowledge, ["updatedAt"]],
    ]);
    for (const t of comms.threads) {
      const list = comms.messages.filter((m) => m.threadId === t.id);
      t.lastMessageAt =
        list
          .map((m) => m.sentAt)
          .sort()
          .at(-1) ?? t.lastMessageAt;
    }
  }

  // Last contact reflects the latest message on the account.
  for (const account of people.accounts) {
    const latest = comms.threads
      .filter((t) => t.accountId === account.id)
      .map((t) => t.lastMessageAt)
      .sort()
      .pop();
    if (latest) account.lastContactAt = latest;
  }

  return {
    version: DB_VERSION,
    asOf: isoDate(today),
    team: people.team,
    accounts: people.accounts,
    contacts: people.contacts,
    addresses: people.addresses,
    categories,
    products,
    priceLists,
    priceListLines,
    stock: purchasing.stock,
    seasonality: SEASONALITY,
    configuratorRules,
    configurations: commerce.configurations,
    baskets: commerce.baskets,
    quotes: commerce.quotes,
    rfqs: purchasing.rfqs,
    supplierQuotes: purchasing.supplierQuotes,
    salesOrders: commerce.salesOrders,
    purchaseOrders: purchasing.purchaseOrders,
    deliveries,
    changeRequests: commerce.changeRequests,
    invoices: finance.invoices,
    payments: finance.payments,
    paymentRuns: finance.paymentRuns,
    jobs: commerce.jobs,
    cases: comms.cases,
    knowledge: content.knowledge,
    documents: content.documents,
    supplierProducts: purchasing.supplierProducts,
    offers: purchasing.offers,
    threads: comms.threads,
    messages: comms.messages,
    notifications: comms.notifications,
    dismissedInsightIds: [],
    journeys: [],
  };
}

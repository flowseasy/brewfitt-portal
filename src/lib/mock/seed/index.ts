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
  const ctx = createContext({ rng, today, accounts: people.accounts, categories, products, priceLists, priceListLines, countryOf });

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
    a.kind === "supplier" ? supplierInsights(a.id, insightInputs) : a.isGroup ? [] : customerInsights(a.id, insightInputs),
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
    rfqs: purchasing.rfqs,
    supplierProducts: purchasing.supplierProducts,
    invoices: finance.invoices,
    paymentRuns: finance.paymentRuns,
    rolloutOrderId: commerce.rolloutOrderId,
    insights,
  });

  // Last contact reflects the latest message on the account.
  for (const account of people.accounts) {
    const latest = comms.threads.filter((t) => t.accountId === account.id).map((t) => t.lastMessageAt).sort().pop();
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
  };
}

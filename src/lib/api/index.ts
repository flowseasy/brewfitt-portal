import { z } from "zod";
import * as s from "@/schemas";
import { mockApi } from "@/lib/mock";
import type { PortalApi } from "./contract";

export type { PortalApi } from "./contract";
export { ApiError, errorMessage } from "./errors";
export { personaKey, queryKeys } from "./query-keys";

/**
 * Response schema for every contract method. Every response is parsed at the
 * boundary, so a Phase 2 transport that drifts from the contract fails loudly
 * instead of rendering wrong data.
 */
const responses = {
  session: { me: s.Me },
  account: {
    get: s.Account,
    update: s.Account,
    addresses: z.array(s.Address),
    createAddress: s.Address,
    updateAddress: s.Address,
    contacts: z.array(s.Contact),
    createContact: s.Contact,
    updateContact: s.Contact,
    documents: z.array(s.Document),
    uploadDocument: s.Document,
  },
  products: { list: z.array(s.Product), get: s.Product, categories: z.array(s.Category) },
  priceList: { get: s.PriceListResponse, export: s.PriceListExport },
  configurator: {
    rules: s.ConfiguratorRules,
    list: z.array(s.Configuration),
    get: s.Configuration,
    create: s.Configuration,
    update: s.Configuration,
    requestQuote: s.Quote,
  },
  shop: { basket: s.Basket, addToBasket: s.Basket, updateBasket: s.Basket, checkout: s.SalesOrder },
  quotes: {
    list: z.array(s.Quote),
    get: s.Quote,
    accept: z.object({ quote: s.Quote, salesOrder: s.SalesOrder }),
    decline: s.Quote,
    rfqs: z.array(s.RfqWithResponse),
    respondToRfq: s.SupplierQuote,
  },
  orders: {
    salesOrders: z.array(s.SalesOrder),
    salesOrder: s.SalesOrderDetail,
    requestChange: s.ChangeRequest,
    purchaseOrders: z.array(s.PurchaseOrder),
    purchaseOrder: s.PurchaseOrderDetail,
    acknowledge: s.PurchaseOrder,
  },
  deliveries: { list: z.array(s.Delivery), get: s.Delivery },
  invoices: {
    list: z.array(s.Invoice),
    get: s.Invoice,
    creditNotes: z.array(s.Invoice),
    statement: s.Statement,
    pay: z.object({ invoice: s.Invoice, payment: s.Payment }),
    payments: z.array(s.Payment),
    paymentRuns: z.array(s.PaymentRun),
  },
  stock: { list: z.array(s.StockPosition), forecast: z.array(s.StockForecast) },
  jobs: { list: z.array(s.Job), get: s.Job },
  cases: { list: z.array(s.Case), create: s.Case, get: s.Case, update: s.Case },
  knowledge: { list: z.array(s.KnowledgeItem), get: s.KnowledgeItem, submit: s.KnowledgeItem },
  supplierProducts: {
    list: z.array(s.SupplierProduct),
    create: s.SupplierProduct,
    update: s.SupplierProduct,
    offers: z.array(s.Offer),
    createOffer: s.Offer,
  },
  documents: { list: z.array(s.Document), get: s.Document },
  messages: { threads: z.array(s.Thread), thread: s.ThreadDetail, send: s.Message, createThread: s.ThreadDetail },
  notifications: { list: z.array(s.Notification), update: s.Notification },
  ai: { insights: z.array(s.AIInsight), productInsight: s.AIInsight.nullable(), ask: s.AskResponse },
  demo: { personas: z.array(s.PersonaOption), reset: z.void() },
} satisfies { [G in keyof PortalApi]: { [M in keyof PortalApi[G]]: z.ZodType } };

function withValidation(impl: PortalApi): PortalApi {
  const out: Record<string, Record<string, unknown>> = {};
  for (const group of Object.keys(responses) as (keyof PortalApi)[]) {
    const methods = impl[group] as unknown as Record<string, (...args: unknown[]) => Promise<unknown>>;
    const schemas = responses[group] as Record<string, z.ZodType>;
    out[group] = Object.fromEntries(
      Object.keys(schemas).map((name) => [
        name,
        async (...args: unknown[]) => {
          const result = await methods[name]!(...args);
          const parsed = schemas[name]!.safeParse(result);
          if (!parsed.success) {
            console.error(`api.${group}.${name} returned an invalid response`, z.treeifyError(parsed.error));
            throw new Error(`api.${group}.${name} returned data that does not match the contract.`);
          }
          return parsed.data;
        },
      ]),
    );
  }
  return out as unknown as PortalApi;
}

/** The only data access the UI uses. Phase 2 swaps `mockApi` for the Catalyst client. */
export const api: PortalApi = withValidation(mockApi);

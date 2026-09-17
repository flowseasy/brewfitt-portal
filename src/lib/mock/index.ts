import type { PortalApi } from "@/lib/api/contract";
import { accountApi, configurator, priceList, products, session, shop, stock } from "./api/commerce";
import { ai, cases, demo, documents, jobs, knowledge, messages, notifications, supplierProducts } from "./api/service";
import { deliveries, invoices, orders, quotes } from "./api/trade";

/**
 * Phase 1 implementation of the portal contract over mock TOTA360v5 data.
 * Phase 2 replaces this module with Catalyst Functions and Data Store calls.
 */
export const mockApi: PortalApi = {
  session,
  account: accountApi,
  products,
  priceList,
  configurator,
  shop,
  quotes,
  orders,
  deliveries,
  invoices,
  stock,
  jobs,
  cases,
  knowledge,
  supplierProducts,
  documents,
  messages,
  notifications,
  ai,
  demo,
};

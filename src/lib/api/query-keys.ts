/**
 * TanStack Query keys. Every key starts with the persona so switching persona
 * never shows another account's cached data.
 */
type PersonaKey = string;

export const queryKeys = {
  all: (persona: PersonaKey) => [persona] as const,
  me: (persona: PersonaKey) => [persona, "me"] as const,
  account: (persona: PersonaKey) => [persona, "account"] as const,
  accountStats: (persona: PersonaKey) => [persona, "account", "stats"] as const,
  addresses: (persona: PersonaKey) => [persona, "account", "addresses"] as const,
  contacts: (persona: PersonaKey) => [persona, "account", "contacts"] as const,
  accountDocuments: (persona: PersonaKey) => [persona, "account", "documents"] as const,
  products: (persona: PersonaKey, query?: object) => [persona, "products", query ?? {}] as const,
  product: (persona: PersonaKey, id: string) => [persona, "products", "detail", id] as const,
  categories: (persona: PersonaKey) => [persona, "categories"] as const,
  priceList: (persona: PersonaKey) => [persona, "price-list"] as const,
  configuratorRules: (persona: PersonaKey) => [persona, "configurator", "rules"] as const,
  configurations: (persona: PersonaKey) => [persona, "configurations"] as const,
  configuration: (persona: PersonaKey, id: string) => [persona, "configurations", id] as const,
  basket: (persona: PersonaKey) => [persona, "basket"] as const,
  quotes: (persona: PersonaKey) => [persona, "quotes"] as const,
  quote: (persona: PersonaKey, id: string) => [persona, "quotes", id] as const,
  rfqs: (persona: PersonaKey) => [persona, "rfqs"] as const,
  salesOrders: (persona: PersonaKey) => [persona, "sales-orders"] as const,
  salesOrder: (persona: PersonaKey, id: string) => [persona, "sales-orders", id] as const,
  purchaseOrders: (persona: PersonaKey) => [persona, "purchase-orders"] as const,
  purchaseOrder: (persona: PersonaKey, id: string) => [persona, "purchase-orders", id] as const,
  deliveries: (persona: PersonaKey) => [persona, "deliveries"] as const,
  invoices: (persona: PersonaKey) => [persona, "invoices"] as const,
  invoice: (persona: PersonaKey, id: string) => [persona, "invoices", id] as const,
  creditNotes: (persona: PersonaKey) => [persona, "credit-notes"] as const,
  statement: (persona: PersonaKey) => [persona, "statement"] as const,
  payments: (persona: PersonaKey) => [persona, "payments"] as const,
  paymentRuns: (persona: PersonaKey) => [persona, "payment-runs"] as const,
  stock: (persona: PersonaKey) => [persona, "stock"] as const,
  forecast: (persona: PersonaKey) => [persona, "stock", "forecast"] as const,
  jobs: (persona: PersonaKey) => [persona, "jobs"] as const,
  job: (persona: PersonaKey, id: string) => [persona, "jobs", id] as const,
  cases: (persona: PersonaKey) => [persona, "cases"] as const,
  case: (persona: PersonaKey, id: string) => [persona, "cases", id] as const,
  knowledge: (persona: PersonaKey) => [persona, "knowledge"] as const,
  knowledgeItem: (persona: PersonaKey, id: string) => [persona, "knowledge", id] as const,
  supplierProducts: (persona: PersonaKey) => [persona, "supplier-products"] as const,
  offers: (persona: PersonaKey) => [persona, "offers"] as const,
  supplierPerformance: (persona: PersonaKey) => [persona, "supplier-performance"] as const,
  documents: (persona: PersonaKey) => [persona, "documents"] as const,
  document: (persona: PersonaKey, id: string) => [persona, "documents", id] as const,
  threads: (persona: PersonaKey) => [persona, "threads"] as const,
  thread: (persona: PersonaKey, id: string) => [persona, "threads", id] as const,
  notifications: (persona: PersonaKey) => [persona, "notifications"] as const,
  insights: (persona: PersonaKey) => [persona, "ai", "insights"] as const,
  productInsight: (persona: PersonaKey, id: string) => [persona, "ai", "product", id] as const,
  personas: () => ["demo", "personas"] as const,
};

/** Stable key for the active persona, including the site a group contact has switched into. */
export function personaKey(persona: {
  kind: string;
  contactId: string;
  accountId: string;
  activeSiteId: string | null;
}): PersonaKey {
  return `${persona.kind}:${persona.contactId}:${persona.accountId}:${persona.activeSiteId ?? "all"}`;
}

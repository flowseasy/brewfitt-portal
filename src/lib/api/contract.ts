import type { z } from "zod";
import type * as s from "@/schemas";
import type {
  Account,
  Address,
  AddCompositeToQuoteResponse,
  AIInsight,
  AskResponse,
  CompositeBuild,
  CompositeBuildSummary,
  CompositeSettings,
  CostItem,
  InternalCustomer,
  InternalQuote,
  Basket,
  Case,
  Category,
  Configuration,
  ConfiguratorRules,
  Contact,
  CustomerStats,
  Delivery,
  Document,
  Invoice,
  Job,
  KnowledgeItem,
  Me,
  Message,
  Notification,
  Offer,
  Payment,
  PaymentRun,
  PersonaOption,
  PriceListExport,
  PriceListResponse,
  Product,
  PurchaseOrder,
  PurchaseOrderDetail,
  Quote,
  RfqWithResponse,
  SalesOrder,
  SalesOrderDetail,
  Statement,
  StockForecast,
  StockPosition,
  SupplierPerformance,
  SupplierProduct,
  SupplierQuote,
  ThreadDetail,
  ThreadSummary,
  ChangeRequest,
} from "@/types";

type In<T extends z.ZodType> = z.input<T>;

/**
 * The portal's data-access contract. Each method maps to one endpoint in
 * BLUEPRINT.md ("Mock API endpoints"); the comment gives the route. Phase 1
 * implements it in src/lib/mock; Phase 2 implements it over Catalyst Functions
 * with the same request and response shapes. All calls are scoped to the
 * signed-in contact's account.
 */
export interface PortalApi {
  session: {
    /** GET /api/me */
    me(): Promise<Me>;
  };

  account: {
    /** GET /api/account */
    get(): Promise<Account>;
    /** PATCH /api/account — recorded as pending until Brewfitt approves. */
    update(patch: In<typeof s.AccountPatch>): Promise<Account>;
    /** GET /api/account/addresses */
    addresses(): Promise<Address[]>;
    /** POST /api/account/addresses */
    createAddress(input: In<typeof s.AddressInput>): Promise<Address>;
    /** PATCH /api/account/addresses/:id */
    updateAddress(id: string, input: Partial<In<typeof s.AddressInput>>): Promise<Address>;
    /** GET /api/account/contacts */
    contacts(): Promise<Contact[]>;
    /** POST /api/account/contacts */
    createContact(input: In<typeof s.ContactInput>): Promise<Contact>;
    /** PATCH /api/account/contacts/:id */
    updateContact(id: string, input: Partial<In<typeof s.ContactInput>>): Promise<Contact>;
    /** GET /api/account/documents */
    documents(): Promise<Document[]>;
    /** POST /api/account/documents */
    uploadDocument(input: In<typeof s.DocumentUploadInput>): Promise<Document>;
    /** GET /api/account/stats (customers; contract defined by the mock) */
    stats(): Promise<CustomerStats>;
  };

  products: {
    /** GET /api/products */
    list(query?: In<typeof s.ProductListQuery>): Promise<Product[]>;
    /** GET /api/products/:id */
    get(id: string): Promise<Product>;
    /** GET /api/categories */
    categories(): Promise<Category[]>;
  };

  priceList: {
    /** GET /api/price-list */
    get(): Promise<PriceListResponse>;
    /** GET /api/price-list/export */
    export(): Promise<PriceListExport>;
  };

  configurator: {
    /** GET /api/configurator/rules */
    rules(): Promise<ConfiguratorRules>;
    /** GET /api/configurations */
    list(): Promise<Configuration[]>;
    /** GET /api/configurations/:id (read through the list endpoint in production) */
    get(id: string): Promise<Configuration>;
    /** POST /api/configurations */
    create(input: In<typeof s.ConfigurationInput>): Promise<Configuration>;
    /** PATCH /api/configurations/:id */
    update(id: string, patch: In<typeof s.ConfigurationPatch>): Promise<Configuration>;
    /** POST /api/configurations/:id/request-quote */
    requestQuote(id: string): Promise<Quote>;
  };

  shop: {
    /** GET /api/basket */
    basket(): Promise<Basket>;
    /** POST /api/basket — add a line (merges quantities). */
    addToBasket(line: In<typeof s.BasketLine>): Promise<Basket>;
    /** PATCH /api/basket */
    updateBasket(patch: In<typeof s.BasketPatch>): Promise<Basket>;
    /** POST /api/checkout */
    checkout(input: In<typeof s.CheckoutRequest>): Promise<SalesOrder>;
    /** POST /api/basket/quote (contract defined by the mock): quote the basket, ready to accept. */
    requestQuote(input: In<typeof s.BasketQuoteRequest>): Promise<Quote>;
  };

  quotes: {
    /** GET /api/quotes */
    list(): Promise<Quote[]>;
    /** GET /api/quotes/:id */
    get(id: string): Promise<Quote>;
    /**
     * POST /api/quotes/:id/accept — converts to a sales order. Null when every line is a
     * composite Brewfitt still has to set up as a product (decision 14).
     */
    accept(id: string): Promise<{ quote: Quote; salesOrder: SalesOrder | null }>;
    /** POST /api/quotes/:id/decline */
    decline(id: string, input: In<typeof s.DeclineQuoteRequest>): Promise<Quote>;
    /** GET /api/rfqs */
    rfqs(): Promise<RfqWithResponse[]>;
    /** POST /api/rfqs/:id/respond */
    respondToRfq(id: string, input: In<typeof s.RfqResponseRequest>): Promise<SupplierQuote>;
  };

  orders: {
    /** GET /api/sales-orders */
    salesOrders(): Promise<SalesOrder[]>;
    /** GET /api/sales-orders/:id */
    salesOrder(id: string): Promise<SalesOrderDetail>;
    /** POST /api/sales-orders/:id/change-request */
    requestChange(id: string, input: In<typeof s.ChangeRequestInput>): Promise<ChangeRequest>;
    /** GET /api/purchase-orders */
    purchaseOrders(): Promise<PurchaseOrder[]>;
    /** GET /api/purchase-orders/:id */
    purchaseOrder(id: string): Promise<PurchaseOrderDetail>;
    /** POST /api/purchase-orders/:id/acknowledge */
    acknowledge(id: string): Promise<PurchaseOrder>;
  };

  deliveries: {
    /** GET /api/deliveries */
    list(): Promise<Delivery[]>;
    /** GET /api/deliveries/:id */
    get(id: string): Promise<Delivery>;
  };

  invoices: {
    /** GET /api/invoices (invoices and self-bills) */
    list(): Promise<Invoice[]>;
    /** GET /api/invoices/:id */
    get(id: string): Promise<Invoice>;
    /** GET /api/credit-notes */
    creditNotes(): Promise<Invoice[]>;
    /** GET /api/statement */
    statement(): Promise<Statement>;
    /** POST /api/invoices/:id/pay — mock card payment for customers not on account. */
    pay(
      id: string,
      input: In<typeof s.PayInvoiceRequest>,
    ): Promise<{ invoice: Invoice; payment: Payment }>;
    /** GET /api/payments */
    payments(): Promise<Payment[]>;
    /** GET /api/payment-runs (supplier) */
    paymentRuns(): Promise<PaymentRun[]>;
  };

  stock: {
    /** GET /api/stock */
    list(): Promise<StockPosition[]>;
    /** GET /api/stock/forecast (supplier) */
    forecast(): Promise<StockForecast[]>;
  };

  jobs: {
    /** GET /api/jobs */
    list(): Promise<Job[]>;
    /** GET /api/jobs/:id */
    get(id: string): Promise<Job>;
  };

  cases: {
    /** GET /api/cases */
    list(): Promise<Case[]>;
    /** POST /api/cases */
    create(input: In<typeof s.CaseInput>): Promise<Case>;
    /** GET /api/cases/:id */
    get(id: string): Promise<Case>;
    /** PATCH /api/cases/:id */
    update(id: string, patch: In<typeof s.CasePatch>): Promise<Case>;
  };

  knowledge: {
    /** GET /api/knowledge */
    list(): Promise<KnowledgeItem[]>;
    /** GET /api/knowledge/:id */
    get(id: string): Promise<KnowledgeItem>;
    /** POST /api/knowledge/submissions (supplier) */
    submit(input: In<typeof s.KnowledgeSubmissionInput>): Promise<KnowledgeItem>;
  };

  supplierProducts: {
    /** GET /api/supplier-products */
    list(): Promise<SupplierProduct[]>;
    /** POST /api/supplier-products */
    create(input: In<typeof s.SupplierProductInput>): Promise<SupplierProduct>;
    /** PATCH /api/supplier-products/:id */
    update(id: string, patch: In<typeof s.SupplierProductPatch>): Promise<SupplierProduct>;
    /** GET /api/offers */
    offers(): Promise<Offer[]>;
    /** POST /api/offers */
    createOffer(input: In<typeof s.OfferInput>): Promise<Offer>;
    /** GET /api/supplier-performance (contract defined by the mock) */
    performance(): Promise<SupplierPerformance>;
  };

  documents: {
    /** GET /api/documents */
    list(): Promise<Document[]>;
    /** GET /api/documents/:id */
    get(id: string): Promise<Document>;
  };

  messages: {
    /** GET /api/threads */
    threads(): Promise<ThreadSummary[]>;
    /** GET /api/threads/:id (marks the thread read) */
    thread(id: string): Promise<ThreadDetail>;
    /** POST /api/threads/:id/messages */
    send(threadId: string, input: In<typeof s.NewMessageInput>): Promise<Message>;
    /** POST /api/threads */
    createThread(input: In<typeof s.NewThreadInput>): Promise<ThreadDetail>;
  };

  notifications: {
    /** GET /api/notifications */
    list(): Promise<Notification[]>;
    /** PATCH /api/notifications/:id */
    update(id: string, patch: In<typeof s.NotificationPatch>): Promise<Notification>;
  };

  ai: {
    /** GET /api/ai/insights */
    insights(): Promise<AIInsight[]>;
    /** GET /api/ai/products/:id/insight */
    productInsight(productId: string): Promise<AIInsight | null>;
    /** POST /api/ai/ask */
    ask(input: In<typeof s.AskRequest>): Promise<AskResponse>;
  };

  /** Brewfitt staff tools (decision 14). Customers and suppliers are refused. */
  internal: {
    /** GET /api/internal/composite-settings — system FX rates and labour rate. */
    compositeSettings(): Promise<CompositeSettings>;
    /** GET /api/internal/customers */
    customers(): Promise<InternalCustomer[]>;
    /** GET /api/internal/cost-items?q= — catalogue products and components at cost. */
    costItems(query: In<typeof s.CostItemQuery>): Promise<CostItem[]>;
    /** GET /api/internal/composite-builds */
    compositeBuilds(): Promise<CompositeBuildSummary[]>;
    /** GET /api/internal/composite-builds/:id */
    compositeBuild(id: string): Promise<CompositeBuild>;
    /** POST /api/internal/composite-builds */
    createCompositeBuild(input: In<typeof s.CompositeBuildInput>): Promise<CompositeBuild>;
    /** PATCH /api/internal/composite-builds/:id */
    updateCompositeBuild(
      id: string,
      patch: In<typeof s.CompositeBuildPatch>,
    ): Promise<CompositeBuild>;
    /** POST /api/internal/composite-builds/:id/duplicate */
    duplicateCompositeBuild(id: string): Promise<CompositeBuild>;
    /** POST /api/internal/composite-builds/:id/add-to-quote */
    addCompositeToQuote(
      id: string,
      input: In<typeof s.AddCompositeToQuoteRequest>,
    ): Promise<AddCompositeToQuoteResponse>;
    /** GET /api/internal/quotes — read-only, every account. */
    quotes(): Promise<InternalQuote[]>;
    /** GET /api/internal/quotes/:id */
    quote(id: string): Promise<InternalQuote>;
  };

  /** Phase 1 only: the persona switcher and demo reset. Removed in Phase 2. */
  demo: {
    personas(): Promise<PersonaOption[]>;
    reset(): Promise<void>;
  };
}

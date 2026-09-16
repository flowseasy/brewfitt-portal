import { z } from "zod";
import { Id, IsoDate, IsoDateTime, Money } from "./common";

// ---------- Shop ----------

export const BasketLine = z.object({
  productId: Id,
  qty: z.int().positive(),
});

export const Basket = z.object({
  id: Id,
  accountId: Id,
  lines: z.array(BasketLine),
  deliveryAddressId: Id.nullable(),
  requestedDate: IsoDate.nullable(),
  poReference: z.string().nullable(),
  notes: z.string().nullable(),
});

export const BasketPatch = Basket.pick({
  lines: true,
  deliveryAddressId: true,
  requestedDate: true,
  poReference: true,
  notes: true,
}).partial();

/**
 * Mock card step for customers not on account. Only a display-safe summary is
 * sent; Phase 2 hands card capture to a payment provider.
 */
export const MockCardPayment = z.object({
  nameOnCard: z.string().min(1),
  last4: z.string().regex(/^\d{4}$/),
});

export const CheckoutRequest = z.object({
  deliveryAddressId: Id,
  requestedDate: IsoDate,
  poReference: z.string().nullable(),
  notes: z.string().nullable(),
  paymentMethod: z.enum(["account", "card"]),
  card: MockCardPayment.nullable(),
});

// ---------- Quotes and RFQs ----------

export const QuoteStatus = z.enum(["draft", "sent", "accepted", "declined", "expired"]);

export const QuoteLine = z.object({
  productId: Id,
  description: z.string().min(1),
  qty: z.int().positive(),
  unitPrice: Money,
  discountPercent: z.number().min(0).max(100),
  lineTotal: Money,
});

export const Quote = z.object({
  id: Id,
  accountId: Id,
  number: z.string().min(1),
  status: QuoteStatus,
  lines: z.array(QuoteLine),
  subtotal: Money,
  vat: Money,
  total: Money,
  validUntil: IsoDate,
  configurationId: Id.nullable(),
  pdfDocumentId: Id.nullable(),
  threadId: Id,
  /** Set when accepted; the order it converted to. */
  salesOrderId: Id.nullable(),
  declineReason: z.string().nullable(),
  /** Last time the customer opened it (quote follow-up rule). */
  lastViewedAt: IsoDateTime.nullable(),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
});

export const DeclineQuoteRequest = z.object({
  reason: z.string().min(3, "Tell Brewfitt why, so they can revise the quote"),
});

export const RfqStatus = z.enum(["open", "responded", "awarded", "not-awarded", "closed"]);

export const RfqLine = z.object({
  productId: Id,
  qty: z.int().positive(),
  requiredBy: IsoDate,
});

export const Rfq = z.object({
  id: Id,
  supplierId: Id,
  number: z.string().min(1),
  lines: z.array(RfqLine),
  deadline: IsoDate,
  status: RfqStatus,
  notes: z.string().nullable(),
  threadId: Id,
  createdAt: IsoDateTime,
});

export const SupplierQuoteLine = z.object({
  productId: Id,
  price: Money,
  leadTimeDays: z.int().nonnegative(),
});

export const SupplierQuote = z.object({
  id: Id,
  rfqId: Id,
  lines: z.array(SupplierQuoteLine),
  notes: z.string().nullable(),
  submittedAt: IsoDateTime,
});

export const RfqResponseRequest = z.object({
  lines: z.array(SupplierQuoteLine).min(1),
  notes: z.string().nullable(),
});

// ---------- Orders and deliveries ----------

export const SalesOrderStatus = z.enum([
  "confirmed",
  "picking",
  "dispatched",
  "part-delivered",
  "delivered",
  "cancelled",
]);

export const SalesOrderLine = z.object({
  productId: Id,
  qty: z.int().positive(),
  delivered: z.int().nonnegative(),
  backordered: z.int().nonnegative(),
  /** Unit price, ex VAT. */
  price: Money,
});

export const SalesOrder = z.object({
  id: Id,
  accountId: Id,
  number: z.string().min(1),
  status: SalesOrderStatus,
  lines: z.array(SalesOrderLine),
  deliveryAddressId: Id,
  requestedDate: IsoDate,
  confirmedDate: IsoDate.nullable(),
  poReference: z.string().nullable(),
  quoteId: Id.nullable(),
  /** Including VAT (flat mock rate, decision 8). */
  total: Money,
  threadId: Id,
  createdAt: IsoDateTime,
});

export const PurchaseOrderStatus = z.enum([
  "issued",
  "acknowledged",
  "in-transit",
  "part-received",
  "received",
]);

export const PurchaseOrderLine = z.object({
  productId: Id,
  qty: z.int().positive(),
  received: z.int().nonnegative(),
  /** Unit cost, ex VAT. */
  price: Money,
});

export const PurchaseOrder = z.object({
  id: Id,
  supplierId: Id,
  number: z.string().min(1),
  status: PurchaseOrderStatus,
  lines: z.array(PurchaseOrderLine),
  expectedDate: IsoDate,
  /** Including VAT. */
  total: Money,
  threadId: Id,
  createdAt: IsoDateTime,
});

export const OrderType = z.enum(["sales", "purchase"]);

export const DeliveryStatus = z.enum(["scheduled", "dispatched", "in-transit", "delivered"]);

export const DeliveryLine = z.object({
  productId: Id,
  qty: z.int().positive(),
});

export const Delivery = z.object({
  id: Id,
  orderId: Id,
  orderType: OrderType,
  number: z.string().min(1),
  status: DeliveryStatus,
  carrier: z.string().nullable(),
  trackingRef: z.string().nullable(),
  dispatchedAt: IsoDateTime.nullable(),
  deliveredAt: IsoDateTime.nullable(),
  lines: z.array(DeliveryLine),
  /** Delivery note document. */
  noteDocumentId: Id.nullable(),
  proofDocumentId: Id.nullable(),
});

export const ChangeRequest = z.object({
  id: Id,
  orderId: Id,
  kind: z.enum(["date", "address"]),
  /** ISO date or address id, per kind. */
  requested: z.string().min(1),
  current: z.string().min(1),
  status: z.enum(["pending", "approved", "rejected"]),
  reason: z.string().nullable(),
  createdAt: IsoDateTime,
});

export const ChangeRequestInput = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("date"), requested: IsoDate, reason: z.string().nullable() }),
  z.object({ kind: z.literal("address"), requested: Id, reason: z.string().nullable() }),
]);

/** GET /api/sales-orders/:id */
export const SalesOrderDetail = SalesOrder.extend({
  deliveries: z.array(Delivery),
  changeRequests: z.array(ChangeRequest),
});

/** GET /api/purchase-orders/:id */
export const PurchaseOrderDetail = PurchaseOrder.extend({
  deliveries: z.array(Delivery),
});

/** GET /api/rfqs */
export const RfqWithResponse = Rfq.extend({
  response: SupplierQuote.nullable(),
});

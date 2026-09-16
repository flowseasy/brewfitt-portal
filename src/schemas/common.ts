import { z } from "zod";

/** Every id is a string (TOTA360v5 record id). */
export const Id = z.string().min(1);

/** ISO 8601 timestamp, e.g. 2026-09-17T09:30:00.000Z. */
export const IsoDateTime = z.iso.datetime({ offset: true });

/** ISO 8601 calendar date, e.g. 2026-09-17. */
export const IsoDate = z.iso.date();

export const Currency = z.enum(["GBP", "EUR", "USD"]);

/** Money is an integer number of minor units (pence) with a currency code. */
export const Money = z.object({
  amount: z.int(),
  currency: Currency,
});

/** Blueprint: valueAtStake (low, high). */
export const MoneyRange = z.object({
  low: Money,
  high: Money,
});

/** Record types that threads, documents, notifications and insights can point at. */
export const RelatedType = z.enum([
  "account",
  "product",
  "configuration",
  "quote",
  "rfq",
  "sales-order",
  "purchase-order",
  "delivery",
  "invoice",
  "payment",
  "payment-run",
  "job",
  "case",
  "knowledge-item",
  "supplier-product",
  "offer",
  "document",
  "thread",
]);

export const ApprovalStatus = z.enum(["pending", "approved", "rejected"]);

export const Confidence = z.enum(["low", "medium", "high"]);

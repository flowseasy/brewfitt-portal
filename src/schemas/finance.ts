import { z } from "zod";
import { Id, IsoDate, IsoDateTime, Money } from "./common";
import { MockCardPayment, OrderType } from "./trade";

export const InvoiceKind = z.enum(["invoice", "credit-note", "self-bill"]);

export const InvoiceStatus = z.enum(["open", "part-paid", "paid", "overdue", "allocated"]);

/**
 * Aged by invoice date, as on a UK aged-debt statement:
 * current = under 30 days old, "30" = 30–59, "60" = 60–89, "90+" = 90 or more.
 * Computed at read time from issuedAt so it stays correct as the clock moves.
 */
export const AgeingBand = z.enum(["current", "30", "60", "90+"]);

export const Invoice = z.object({
  id: Id,
  accountId: Id,
  number: z.string().min(1),
  kind: InvoiceKind,
  status: InvoiceStatus,
  issuedAt: IsoDateTime,
  dueAt: IsoDateTime,
  /** Including VAT. Always positive; credit notes reduce the balance by kind. */
  total: Money,
  outstanding: Money,
  ageingBand: AgeingBand,
  /** Credit notes reference the original invoice's order (decision 7). */
  orderId: Id,
  orderType: OrderType,
  pdfDocumentId: Id.nullable(),
});

export const PaymentMethod = z.enum(["bacs", "card", "direct-debit", "credit-allocation"]);

export const PaymentAllocation = z.object({
  invoiceId: Id,
  amount: Money,
});

export const Payment = z.object({
  id: Id,
  accountId: Id,
  amount: Money,
  method: PaymentMethod,
  reference: z.string().min(1),
  paidAt: IsoDateTime,
  allocatedTo: z.array(PaymentAllocation),
  /** Remittance advice (supplier payments). */
  remittanceDocumentId: Id.nullable(),
});

export const PaymentRun = z.object({
  id: Id,
  scheduledFor: IsoDate,
  /** Total of the invoices in this run visible to the account. */
  total: Money,
  invoiceIds: z.array(Id),
  status: z.enum(["scheduled", "paid"]),
});

export const StatementLine = z.object({
  date: IsoDateTime,
  kind: z.enum(["invoice", "credit-note", "self-bill", "payment"]),
  reference: z.string().min(1),
  relatedId: Id,
  debit: Money.nullable(),
  credit: Money.nullable(),
  balance: Money,
});

export const Statement = z.object({
  accountId: Id,
  from: IsoDate,
  to: IsoDate,
  openingBalance: Money,
  closingBalance: Money,
  lines: z.array(StatementLine),
  ageing: z.object({
    current: Money,
    "30": Money,
    "60": Money,
    "90+": Money,
  }),
  overdue: Money,
});

export const PayInvoiceRequest = z.object({
  card: MockCardPayment,
});

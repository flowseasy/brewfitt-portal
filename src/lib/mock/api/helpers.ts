import type {
  Account,
  Contact,
  Invoice,
  Message,
  Money,
  Quote,
  StockPosition,
  Thread,
} from "@/types";
import type { InsightInputs } from "@/lib/ai/rules";
import { ageingBandFor, deriveInvoice } from "../seed/finance";
import { effectivePriceListId } from "../seed/context";
import { SEASONALITY } from "../seed/context";
import { daysBetween, today } from "../clock";
import { getDb, latency, newId, type MockDb } from "../db";
import { insert, patch, type Change } from "../mutations";
import { badRequest, forbidden, notFound, resolveScope, type Scope } from "../scope";

export { badRequest, forbidden, notFound };

/** Simulated round trip: latency, then a copy so callers never mutate the store. */
export async function respond<T>(fn: (db: MockDb, scope: Scope) => T): Promise<T> {
  await latency();
  const db = getDb();
  const scope = resolveScope(db);
  return structuredClone(fn(db, scope));
}

export function requireCustomer(scope: Scope) {
  if (scope.isSupplier) forbidden("This is only available to customer accounts.");
}

export function requireSupplier(scope: Scope) {
  if (!scope.isSupplier) forbidden("This is only available to supplier accounts.");
}

export const inScope = (scope: Scope, accountId: string) => scope.accountIds.includes(accountId);

export function nowIso(): string {
  return new Date().toISOString();
}

// ---- Read-time derivations ---------------------------------------------------

export function invoiceNow(invoice: Invoice): Invoice {
  return deriveInvoice(invoice, today());
}

/** Sent quotes past their validity date read as expired. */
export function quoteNow(quote: Quote): Quote {
  if (quote.status === "sent" && daysBetween(today(), quote.validUntil) < 0)
    return { ...quote, status: "expired" };
  return quote;
}

export { ageingBandFor };

export function stockStatus(
  onHand: number,
  allocated: number,
  onOrder: number,
  minimumLevel: number,
): StockPosition["status"] {
  const available = onHand - allocated;
  if (available <= 0) return onOrder > 0 ? "on-order" : "out";
  if (onHand < minimumLevel) return onOrder > 0 ? "on-order" : "low";
  return "in-stock";
}

// ---- Accounts, pricing and VAT ----------------------------------------------

export function account(db: MockDb, id: string): Account {
  return db.accounts.find((a) => a.id === id) ?? notFound("Account");
}

export function priceListIdFor(db: MockDb, accountId: string): string | null {
  return effectivePriceListId(account(db, accountId), db.accounts);
}

export function priceFor(db: MockDb, accountId: string, productId: string): Money | null {
  const listId = priceListIdFor(db, accountId);
  return (
    db.priceListLines.find((l) => l.priceListId === listId && l.productId === productId)?.price ??
    null
  );
}

/** Flat mock VAT (decision 8): 20% for UK accounts, 0% for export. */
export function vatRate(db: MockDb, accountId: string): number {
  const a = account(db, accountId);
  const billing = db.addresses.find((x) => x.id === a.billingAddressId);
  return billing?.country === "GB" ? 0.2 : 0;
}

export function withVat(
  db: MockDb,
  accountId: string,
  net: number,
): { vat: number; gross: number } {
  const vat = Math.round(net * vatRate(db, accountId));
  return { vat, gross: net + vat };
}

export function contactOf(db: MockDb, scope: Scope): Contact {
  return db.contacts.find((c) => c.id === scope.persona.contactId) ?? notFound("Contact");
}

export function teamMember(
  db: MockDb,
  scope: Scope,
  role: "account-manager" | "technical-manager" | "buyer" | "sales-office" | "credit-control",
) {
  const c = scope.commercialAccount;
  const id =
    role === "account-manager"
      ? c.accountManagerId
      : role === "technical-manager"
        ? c.technicalContactId
        : role === "buyer"
          ? c.buyerId
          : null;
  return db.team.find((t) => t.id === id) ?? db.team.find((t) => t.role === role) ?? db.team[0]!;
}

// ---- Threads ----------------------------------------------------------------

/** Changes that open a thread on a record with a first message. */
export function openThreadChanges(
  db: MockDb,
  scope: Scope,
  args: {
    accountId: string;
    subject: string;
    relatedType: Thread["relatedType"];
    relatedId: string | null;
    brewfittRole: Parameters<typeof teamMember>[2];
    first: { side: Message["senderSide"]; channel: Message["channel"]; body: string; at: string };
  },
): { thread: Thread; changes: Change[] } {
  const contact = contactOf(db, scope);
  const brewfitt = teamMember(db, scope, args.brewfittRole);
  const thread: Thread = {
    id: newId("thr"),
    accountId: args.accountId,
    subject: args.subject,
    relatedType: args.relatedType,
    relatedId: args.relatedId,
    participants: [
      { id: contact.id, name: contact.name, side: "account" },
      { id: brewfitt.id, name: brewfitt.name, side: "brewfitt" },
    ],
    lastMessageAt: args.first.at,
    unreadCount: 0,
  };
  const message: Message = {
    id: newId("msg"),
    threadId: thread.id,
    senderId: args.first.side === "account" ? contact.id : brewfitt.id,
    senderSide: args.first.side,
    channel: args.first.channel,
    body: args.first.body,
    attachments: [],
    sentAt: args.first.at,
  };
  return { thread, changes: [insert("threads", thread), insert("messages", message)] };
}

/** Changes that post a message from the signed-in contact to an existing thread. */
export function postChanges(
  db: MockDb,
  scope: Scope,
  threadId: string,
  body: string,
  at: string,
  attachments: string[] = [],
): { message: Message; changes: Change[] } {
  const thread = db.threads.find((t) => t.id === threadId) ?? notFound("Conversation");
  const contact = contactOf(db, scope);
  const message: Message = {
    id: newId("msg"),
    threadId,
    senderId: contact.id,
    senderSide: "account",
    channel: "portal",
    body,
    attachments,
    sentAt: at,
  };
  const participants = thread.participants.some((p) => p.id === contact.id)
    ? thread.participants
    : [...thread.participants, { id: contact.id, name: contact.name, side: "account" as const }];
  return {
    message,
    changes: [
      insert("messages", message),
      patch("threads", threadId, { lastMessageAt: at, unreadCount: 0, participants }),
    ],
  };
}

// ---- AI inputs ----------------------------------------------------------------

export function insightInputs(db: MockDb): InsightInputs {
  return {
    today: today(),
    accounts: db.accounts,
    products: db.products,
    priceListLines: db.priceListLines,
    stock: db.stock,
    salesOrders: db.salesOrders,
    purchaseOrders: db.purchaseOrders,
    quotes: db.quotes.map(quoteNow),
    threads: db.threads,
    messages: db.messages,
    invoices: db.invoices.map(invoiceNow),
    seasonality: db.seasonality ?? SEASONALITY,
  };
}

/** Accounts whose own records are evaluated (group accounts hold no orders of their own). */
export function orderingAccountIds(db: MockDb, scope: Scope): string[] {
  return scope.accountIds.filter((id) => !account(db, id).isGroup);
}

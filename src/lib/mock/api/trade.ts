import * as s from "@/schemas";
import type { PortalApi } from "@/lib/api/contract";
import type { AgeingBand, ChangeRequest, Invoice, Money, Payment, Statement, StatementLine, SupplierQuote } from "@/types";
import { formatDate } from "@/lib/format";
import { addDays, daysBetween, isoDate, today } from "../clock";
import { commit, newId } from "../db";
import { insert, patch } from "../mutations";
import { createOrderChanges } from "./commerce";
import {
  account,
  badRequest,
  forbidden,
  inScope,
  invoiceNow,
  notFound,
  nowIso,
  postChanges,
  quoteNow,
  requireCustomer,
  requireSupplier,
  respond,
} from "./helpers";

const gbp = (amount: number): Money => ({ amount, currency: "GBP" });

// ---------------------------------------------------------------------------
// Quotes and RFQs
// ---------------------------------------------------------------------------

export const quotes: PortalApi["quotes"] = {
  list: () =>
    respond((db, scope) => {
      requireCustomer(scope);
      return db.quotes.filter((q) => inScope(scope, q.accountId)).map(quoteNow).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }),

  get: (id) =>
    respond((db, scope) => {
      const quote = db.quotes.find((q) => q.id === id && inScope(scope, q.accountId)) ?? notFound("Quote");
      // Opening a sent quote records the view (used by the quote follow-up insight).
      const last = quote.lastViewedAt ? Date.parse(quote.lastViewedAt) : 0;
      if (quote.status === "sent" && Date.now() - last > 3_600_000) commit("quotes.view", [patch("quotes", id, { lastViewedAt: nowIso() })]);
      return quoteNow(db.quotes.find((q) => q.id === id)!);
    }),

  accept: (id) =>
    respond((db, scope) => {
      const quote = quoteNow(db.quotes.find((q) => q.id === id && inScope(scope, q.accountId)) ?? notFound("Quote"));
      if (quote.status === "expired") badRequest(`Quote ${quote.number} expired on ${formatDate(quote.validUntil)}. Ask Brewfitt to reissue it.`);
      if (quote.status !== "sent") badRequest(`Quote ${quote.number} is ${quote.status} and cannot be accepted.`);
      const at = nowIso();
      const config = db.configurations.find((c) => c.id === quote.configurationId);
      const deliveryAddressId = config?.siteAddressId ?? db.addresses.find((a) => a.accountId === quote.accountId && a.isDefault)!.id;
      const leadDays = Math.max(3, ...quote.lines.map((l) => db.products.find((p) => p.id === l.productId)?.leadTimeDays ?? 3));
      const order = createOrderChanges(db, scope, {
        accountId: quote.accountId,
        lines: quote.lines.map((l) => ({ productId: l.productId, qty: l.qty })),
        deliveryAddressId,
        requestedDate: isoDate(addDays(today(), leadDays + 2)),
        poReference: null,
        quoteId: quote.id,
        card: null,
        notes: null,
      });
      const message = postChanges(db, scope, quote.threadId, `Quote ${quote.number} accepted. Order ${order.order.number} has been created.`, at);
      commit("quotes.accept", [...order.changes, ...message.changes, patch("quotes", id, { status: "accepted", salesOrderId: order.order.id, updatedAt: at, lastViewedAt: at })]);
      return { quote: db.quotes.find((q) => q.id === id)!, salesOrder: db.salesOrders.find((o) => o.id === order.order.id)! };
    }),

  decline: (id, input) =>
    respond((db, scope) => {
      const { reason } = s.DeclineQuoteRequest.parse(input);
      const quote = quoteNow(db.quotes.find((q) => q.id === id && inScope(scope, q.accountId)) ?? notFound("Quote"));
      if (quote.status !== "sent") badRequest(`Quote ${quote.number} is ${quote.status} and cannot be declined.`);
      const at = nowIso();
      const message = postChanges(db, scope, quote.threadId, `We are declining ${quote.number}. ${reason}`, at);
      commit("quotes.decline", [...message.changes, patch("quotes", id, { status: "declined", declineReason: reason, updatedAt: at })]);
      return db.quotes.find((q) => q.id === id)!;
    }),

  rfqs: () =>
    respond((db, scope) => {
      requireSupplier(scope);
      return db.rfqs
        .filter((r) => r.supplierId === scope.account.id)
        .map((r) => ({ ...r, response: db.supplierQuotes.filter((q) => q.rfqId === r.id).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))[0] ?? null }))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }),

  respondToRfq: (id, input) =>
    respond((db, scope) => {
      requireSupplier(scope);
      const data = s.RfqResponseRequest.parse(input);
      const rfq = db.rfqs.find((r) => r.id === id && r.supplierId === scope.account.id) ?? notFound("Request for quotation");
      if (rfq.status !== "open") badRequest(`${rfq.number} is ${rfq.status} and no longer accepts responses.`);
      if (daysBetween(today(), rfq.deadline) < 0) badRequest(`The deadline for ${rfq.number} was ${formatDate(rfq.deadline)}.`);
      const lineIds = new Set(rfq.lines.map((l) => l.productId));
      if (data.lines.some((l) => !lineIds.has(l.productId)) || data.lines.length !== rfq.lines.length) badRequest("Price every line on the request.");
      const at = nowIso();
      const response: SupplierQuote = { id: newId("sq"), rfqId: rfq.id, lines: data.lines, notes: data.notes, submittedAt: at };
      const message = postChanges(db, scope, rfq.threadId, `Quote submitted for ${rfq.number}: ${data.lines.length} ${data.lines.length === 1 ? "line" : "lines"} priced.${data.notes ? ` ${data.notes}` : ""}`, at);
      commit("quotes.respondToRfq", [insert("supplierQuotes", response), patch("rfqs", rfq.id, { status: "responded" }), ...message.changes]);
      return response;
    }),
};

// ---------------------------------------------------------------------------
// Orders and deliveries
// ---------------------------------------------------------------------------

export const orders: PortalApi["orders"] = {
  salesOrders: () =>
    respond((db, scope) => {
      requireCustomer(scope);
      return db.salesOrders.filter((o) => inScope(scope, o.accountId)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }),

  salesOrder: (id) =>
    respond((db, scope) => {
      const order = db.salesOrders.find((o) => o.id === id && inScope(scope, o.accountId)) ?? notFound("Order");
      return {
        ...order,
        deliveries: db.deliveries.filter((d) => d.orderType === "sales" && d.orderId === id).sort((a, b) => (a.dispatchedAt ?? "").localeCompare(b.dispatchedAt ?? "")),
        changeRequests: db.changeRequests.filter((c) => c.orderId === id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      };
    }),

  requestChange: (id, input) =>
    respond((db, scope) => {
      const data = s.ChangeRequestInput.parse(input);
      const order = db.salesOrders.find((o) => o.id === id && inScope(scope, o.accountId)) ?? notFound("Order");
      if (order.status !== "confirmed" && order.status !== "picking") badRequest(`Order ${order.number} has been ${order.status}; changes can only be requested before dispatch.`);
      if (db.changeRequests.some((c) => c.orderId === id && c.kind === data.kind && c.status === "pending")) badRequest(`There is already a ${data.kind} change awaiting Brewfitt's approval on this order.`);
      if (data.kind === "date" && daysBetween(today(), data.requested) < 1) badRequest("Choose a delivery date from tomorrow onwards.");
      if (data.kind === "address" && !db.addresses.some((a) => a.id === data.requested && a.accountId === order.accountId)) notFound("Delivery address");
      const at = nowIso();
      const current = data.kind === "date" ? (order.confirmedDate ?? order.requestedDate) : order.deliveryAddressId;
      const change: ChangeRequest = { id: newId("chr"), orderId: id, kind: data.kind, requested: data.requested, current, status: "pending", reason: data.reason, createdAt: at };
      const describe = data.kind === "date" ? `the delivery date to ${formatDate(data.requested)}` : `the delivery address to ${db.addresses.find((a) => a.id === data.requested)!.label}`;
      const message = postChanges(db, scope, order.threadId, `Change requested: please move ${describe}.${data.reason ? ` ${data.reason}` : ""}`, at);
      commit("orders.requestChange", [insert("changeRequests", change), ...message.changes]);
      return change;
    }),

  purchaseOrders: () =>
    respond((db, scope) => {
      requireSupplier(scope);
      return db.purchaseOrders.filter((p) => p.supplierId === scope.account.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }),

  purchaseOrder: (id) =>
    respond((db, scope) => {
      requireSupplier(scope);
      const po = db.purchaseOrders.find((p) => p.id === id && p.supplierId === scope.account.id) ?? notFound("Purchase order");
      return { ...po, deliveries: db.deliveries.filter((d) => d.orderType === "purchase" && d.orderId === id) };
    }),

  acknowledge: (id) =>
    respond((db, scope) => {
      requireSupplier(scope);
      const po = db.purchaseOrders.find((p) => p.id === id && p.supplierId === scope.account.id) ?? notFound("Purchase order");
      if (po.status !== "issued") badRequest(`${po.number} has already been ${po.status.replace("-", " ")}.`);
      const at = nowIso();
      const message = postChanges(db, scope, po.threadId, `${po.number} acknowledged. Delivery confirmed for ${formatDate(po.expectedDate)}.`, at);
      commit("orders.acknowledge", [patch("purchaseOrders", id, { status: "acknowledged" }), ...message.changes]);
      return db.purchaseOrders.find((p) => p.id === id)!;
    }),
};

export const deliveries: PortalApi["deliveries"] = {
  list: () =>
    respond((db, scope) => {
      if (scope.isSupplier) {
        const pos = new Set(db.purchaseOrders.filter((p) => p.supplierId === scope.account.id).map((p) => p.id));
        return db.deliveries.filter((d) => d.orderType === "purchase" && pos.has(d.orderId));
      }
      const sos = new Set(db.salesOrders.filter((o) => inScope(scope, o.accountId)).map((o) => o.id));
      return db.deliveries.filter((d) => d.orderType === "sales" && sos.has(d.orderId));
    }),
  get: (id) =>
    respond((db, scope) => {
      const d = db.deliveries.find((x) => x.id === id) ?? notFound("Delivery");
      const owner = d.orderType === "sales" ? db.salesOrders.find((o) => o.id === d.orderId)?.accountId : db.purchaseOrders.find((p) => p.id === d.orderId)?.supplierId;
      if (!owner || !inScope(scope, owner)) notFound("Delivery");
      return d;
    }),
};

// ---------------------------------------------------------------------------
// Invoices, credits, statement and payments
// ---------------------------------------------------------------------------

const BANDS: AgeingBand[] = ["current", "30", "60", "90+"];

export const invoices: PortalApi["invoices"] = {
  list: () =>
    respond((db, scope) => db.invoices.filter((i) => inScope(scope, i.accountId) && i.kind !== "credit-note").map(invoiceNow).sort((a, b) => b.issuedAt.localeCompare(a.issuedAt))),

  get: (id) => respond((db, scope) => invoiceNow(db.invoices.find((i) => i.id === id && inScope(scope, i.accountId)) ?? notFound("Invoice"))),

  creditNotes: () =>
    respond((db, scope) => db.invoices.filter((i) => inScope(scope, i.accountId) && i.kind === "credit-note").map(invoiceNow).sort((a, b) => b.issuedAt.localeCompare(a.issuedAt))),

  statement: () =>
    respond((db, scope): Statement => {
      const now = today();
      const from = addDays(now, -365);
      const docs = db.invoices.filter((i) => inScope(scope, i.accountId)).map(invoiceNow);
      const cash = db.payments.filter((p) => inScope(scope, p.accountId) && p.method !== "credit-allocation");
      type Entry = Omit<StatementLine, "balance"> & { signed: number };
      const entries: Entry[] = [
        ...docs.map((i) => ({
          date: i.issuedAt,
          kind: i.kind,
          reference: i.number,
          relatedId: i.id,
          debit: i.kind === "credit-note" ? null : i.total,
          credit: i.kind === "credit-note" ? i.total : null,
          signed: i.kind === "credit-note" ? -i.total.amount : i.total.amount,
        })),
        ...cash.map((p) => ({ date: p.paidAt, kind: "payment" as const, reference: p.reference, relatedId: p.id, debit: null, credit: p.amount, signed: -p.amount.amount })),
      ].sort((a, b) => a.date.localeCompare(b.date));
      const opening = entries.filter((e) => Date.parse(e.date) < from.getTime()).reduce((sum, e) => sum + e.signed, 0);
      let balance = opening;
      const lines = entries
        .filter((e) => Date.parse(e.date) >= from.getTime())
        .map(({ signed, ...e }) => {
          balance += signed;
          return { ...e, balance: gbp(balance) };
        });
      const ageing = Object.fromEntries(
        BANDS.map((b) => [b, gbp(docs.filter((i) => i.ageingBand === b).reduce((sum, i) => sum + (i.kind === "credit-note" ? -1 : 1) * i.outstanding.amount, 0))]),
      ) as Statement["ageing"];
      const overdue = docs.filter((i) => i.status === "overdue").reduce((sum, i) => sum + i.outstanding.amount, 0);
      return { accountId: scope.viewAccount.id, from: isoDate(from), to: isoDate(now), openingBalance: gbp(opening), closingBalance: gbp(balance), lines, ageing, overdue: gbp(overdue) };
    }),

  pay: (id, input) =>
    respond((db, scope) => {
      requireCustomer(scope);
      const { card } = s.PayInvoiceRequest.parse(input);
      const invoice = invoiceNow(db.invoices.find((i) => i.id === id && inScope(scope, i.accountId)) ?? notFound("Invoice"));
      if (account(db, invoice.accountId).onAccount) forbidden("Invoices on credit terms are paid by bank transfer to Brewfitt. Card payment is for accounts without credit terms.");
      if (invoice.kind !== "invoice" || invoice.outstanding.amount <= 0) badRequest(`${invoice.number} has nothing to pay.`);
      const at = nowIso();
      const payment: Payment = { id: newId("pay"), accountId: invoice.accountId, amount: invoice.outstanding, method: "card", reference: `Card ending ${card.last4}`, paidAt: at, allocatedTo: [{ invoiceId: invoice.id, amount: invoice.outstanding }], remittanceDocumentId: null };
      commit("invoices.pay", [insert("payments", payment), patch("invoices", id, { outstanding: gbp(0), status: "paid" })]);
      return { invoice: invoiceNow(db.invoices.find((i) => i.id === id)!), payment };
    }),

  payments: () => respond((db, scope) => db.payments.filter((p) => inScope(scope, p.accountId)).sort((a, b) => b.paidAt.localeCompare(a.paidAt))),

  paymentRuns: () =>
    respond((db, scope) => {
      requireSupplier(scope);
      const mine = new Map<string, Invoice>(db.invoices.filter((i) => i.accountId === scope.account.id).map((i) => [i.id, i]));
      // Payment runs are Brewfitt-wide; each supplier sees only its own invoices and total.
      return db.paymentRuns
        .map((run) => {
          const invoiceIds = run.invoiceIds.filter((id) => mine.has(id));
          const total = invoiceIds.reduce((sum, id) => {
            const inv = mine.get(id)!;
            return sum + (run.status === "paid" ? inv.total.amount : inv.outstanding.amount);
          }, 0);
          return { ...run, invoiceIds, total: gbp(total) };
        })
        .filter((run) => run.invoiceIds.length > 0)
        .sort((a, b) => b.scheduledFor.localeCompare(a.scheduledFor));
    }),
};

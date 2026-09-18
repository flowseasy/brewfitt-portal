import * as s from "@/schemas";
import type { PortalApi } from "@/lib/api/contract";
import type {
  CompositeBand,
  CompositeBuild,
  CostItem,
  Document,
  Message,
  Money,
  Notification,
  Quote,
  QuoteLine,
  Thread,
} from "@/types";
import { BAND_LABEL, bandFigures, bandMinQty } from "@/lib/composite/pricing";
import { formatDate, formatMoney, initials } from "@/lib/format";
import { isoDate, today } from "../clock";
import { commit, newId, nextNumber, type MockDb } from "../db";
import { insert, patch, type Change } from "../mutations";
import {
  productCostItem,
  STAFF_CONTACT,
  SYSTEM_FX_RATES,
  SYSTEM_LABOUR_RATE,
} from "../seed/composite";
import {
  account,
  badRequest,
  notFound,
  nowIso,
  quoteNow,
  requireStaff,
  respond,
  withVat,
} from "./helpers";

/**
 * Brewfitt staff tools (decision 14): the Composite Configurator and a
 * read-only view of every account's quotes. Refused for every other persona.
 */

const gbp = (amount: number): Money => ({ amount, currency: "GBP" });

function build(db: MockDb, id: string): CompositeBuild {
  return db.compositeBuilds.find((b) => b.id === id) ?? notFound("Composite build");
}

function customer(db: MockDb, id: string) {
  const a = account(db, id);
  if (a.kind !== "customer") badRequest("A composite build must be for a customer account.");
  return a;
}

function costItems(db: MockDb): CostItem[] {
  const categoryName = new Map(db.categories.map((c) => [c.id, c.name]));
  return [
    ...db.products
      .filter((p) => p.active)
      .map((p) =>
        productCostItem(
          p,
          db.accounts,
          db.priceListLines,
          categoryName.get(p.category) ?? "Catalogue",
        ),
      ),
    ...db.components,
  ];
}

function emptyBand(): CompositeBand {
  return {
    key: "base",
    lines: [],
    shipping: { mode: "amount", value: 0 },
    duty: { mode: "amount", value: 0 },
    labourHours: 0,
    targetMarginPercent: 30,
    sellPrice: 0,
    carriage: 0,
  };
}

function checkBands(bands: CompositeBand[]) {
  const keys = bands.map((b) => b.key);
  if (new Set(keys).size !== keys.length) badRequest("Each quantity band can only appear once.");
  for (const band of bands) {
    const ids = band.lines.map((l) => l.id);
    if (new Set(ids).size !== ids.length) badRequest("Line ids must be unique within a band.");
    for (const l of band.lines) {
      if (l.kind === "misc" && !l.misc)
        badRequest("A Misc line needs its selling and buying details.");
      if (l.kind !== "misc" && !l.itemId)
        badRequest(`${l.code || "A line"} is not linked to an item.`);
    }
  }
}

/** The customer and account manager on a quote conversation Brewfitt starts. */
function quoteParticipants(db: MockDb, accountId: string) {
  const a = account(db, accountId);
  const commercial = a.parentAccountId ? account(db, a.parentAccountId) : a;
  const contacts = db.contacts.filter((c) => c.accountId === accountId);
  const contact = contacts.find((c) => c.isPrimary) ?? contacts[0] ?? notFound("Contact");
  const manager =
    db.team.find((t) => t.id === commercial.accountManagerId) ??
    db.team.find((t) => t.role === "account-manager")!;
  return { contact, manager };
}

function quoteNotification(
  accountId: string,
  quote: Quote,
  title: string,
  at: string,
): Notification {
  return {
    id: newId("ntf"),
    accountId,
    kind: "quote-awaiting-acceptance",
    title,
    body: `${formatMoney(quote.total)} including VAT, valid until ${formatDate(quote.validUntil)}.`,
    relatedType: "quote",
    relatedId: quote.id,
    read: false,
    dismissed: false,
    createdAt: at,
  };
}

/** A new quote Brewfitt sends: ready to accept, with PDF, conversation and notification. */
function newQuoteChanges(
  db: MockDb,
  accountId: string,
  line: QuoteLine,
  at: string,
): { quote: Quote; changes: Change[] } {
  const { vat, gross } = withVat(db, accountId, line.lineTotal.amount);
  const { contact, manager } = quoteParticipants(db, accountId);
  const quote: Quote = {
    id: newId("quo"),
    accountId,
    number: nextNumber("QU-", db.quotes),
    status: "sent",
    lines: [line],
    subtotal: gbp(line.lineTotal.amount),
    vat: gbp(vat),
    total: gbp(gross),
    validUntil: isoDate(new Date(Date.now() + 30 * 86_400_000)),
    configurationId: null,
    pdfDocumentId: newId("doc"),
    threadId: newId("thr"),
    salesOrderId: null,
    declineReason: null,
    lastViewedAt: null,
    createdAt: at,
    updatedAt: at,
  };
  const pdf: Document = {
    id: quote.pdfDocumentId!,
    name: `Quote ${quote.number}.pdf`,
    category: "quote",
    relatedType: "quote",
    relatedId: quote.id,
    ownerAccountId: accountId,
    fileType: "pdf",
    fileSize: 96_000,
    expiresAt: null,
    approvalStatus: null,
    modifiedAt: at,
  };
  const thread: Thread = {
    id: quote.threadId,
    accountId,
    subject: `Quote ${quote.number}: ${line.description}`,
    relatedType: "quote",
    relatedId: quote.id,
    participants: [
      { id: contact.id, name: contact.name, side: "account" },
      { id: manager.id, name: manager.name, side: "brewfitt" },
    ],
    lastMessageAt: at,
    unreadCount: 1,
  };
  const message: Message = {
    id: newId("msg"),
    threadId: thread.id,
    senderId: manager.id,
    senderSide: "brewfitt",
    channel: "portal",
    body: `Hello ${contact.name.split(" ")[0]}, quote ${quote.number} for ${line.description} is attached: ${line.qty} at ${formatMoney(line.unitPrice)} each, ${formatMoney(quote.total)} including VAT, valid until ${formatDate(quote.validUntil)}. Accept it here when you are ready.`,
    attachments: [pdf.id],
    sentAt: at,
  };
  return {
    quote,
    changes: [
      insert("quotes", quote),
      insert("documents", pdf),
      insert("threads", thread),
      insert("messages", message),
      insert(
        "notifications",
        quoteNotification(accountId, quote, `Quote ${quote.number} ready to accept`, at),
      ),
    ],
  };
}

/** Adds the line to an open quote on the same account, re-issuing its PDF. */
function addToQuoteChanges(
  db: MockDb,
  quoteId: string,
  line: QuoteLine,
  at: string,
): { quote: Quote; changes: Change[] } {
  const existing = db.quotes.find((q) => q.id === quoteId) ?? notFound("Quote");
  const current = quoteNow(existing);
  if (current.status !== "sent")
    badRequest(`Quote ${current.number} is ${current.status}; add the composite to a new quote.`);
  const lines = [...existing.lines, line];
  const subtotal = lines.reduce((sum, l) => sum + l.lineTotal.amount, 0);
  const { vat, gross } = withVat(db, existing.accountId, subtotal);
  const quote: Quote = {
    ...existing,
    lines,
    subtotal: gbp(subtotal),
    vat: gbp(vat),
    total: gbp(gross),
    updatedAt: at,
  };
  const { manager } = quoteParticipants(db, existing.accountId);
  const message: Message = {
    id: newId("msg"),
    threadId: existing.threadId,
    senderId: manager.id,
    senderSide: "brewfitt",
    channel: "portal",
    body: `We have added ${line.description} to quote ${quote.number}: ${line.qty} at ${formatMoney(line.unitPrice)} each. The updated quote is attached, now ${formatMoney(quote.total)} including VAT.`,
    attachments: existing.pdfDocumentId ? [existing.pdfDocumentId] : [],
    sentAt: at,
  };
  const thread = db.threads.find((t) => t.id === existing.threadId);
  return {
    quote,
    changes: [
      patch("quotes", quote.id, {
        lines: quote.lines,
        subtotal: quote.subtotal,
        vat: quote.vat,
        total: quote.total,
        updatedAt: at,
      }),
      ...(existing.pdfDocumentId && db.documents.some((d) => d.id === existing.pdfDocumentId)
        ? [patch("documents", existing.pdfDocumentId, { modifiedAt: at })]
        : []),
      insert("messages", message),
      ...(thread
        ? [
            patch("threads", thread.id, {
              lastMessageAt: at,
              unreadCount: thread.unreadCount + 1,
            }),
          ]
        : []),
      insert(
        "notifications",
        quoteNotification(existing.accountId, quote, `Quote ${quote.number} updated`, at),
      ),
    ],
  };
}

function withAccountName<T extends { accountId: string }>(db: MockDb, record: T) {
  return { ...record, accountName: account(db, record.accountId).name };
}

export const internal: PortalApi["internal"] = {
  compositeSettings: () =>
    respond((_db, scope) => {
      requireStaff(scope);
      return {
        systemFxRates: { ...SYSTEM_FX_RATES },
        fxRatesAsOf: isoDate(today()),
        labourRate: SYSTEM_LABOUR_RATE,
      };
    }),

  customers: () =>
    respond((db, scope) => {
      requireStaff(scope);
      return db.accounts
        .filter((a) => a.kind === "customer")
        .map((a) => ({ id: a.id, name: a.name, sector: a.sector }))
        .sort((a, b) => a.name.localeCompare(b.name));
    }),

  costItems: (query) =>
    respond((db, scope) => {
      requireStaff(scope);
      const { q, limit } = s.CostItemQuery.parse(query);
      const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
      if (!terms.length) return [];
      const first = terms[0]!;
      return costItems(db)
        .filter((item) => {
          const text = `${item.code} ${item.name} ${item.category}`.toLowerCase();
          return terms.every((t) => text.includes(t));
        })
        .map((item) => ({
          item,
          rank: item.code.toLowerCase().startsWith(first)
            ? 0
            : item.name.toLowerCase().startsWith(first)
              ? 1
              : 2,
        }))
        .sort((a, b) => a.rank - b.rank || a.item.name.localeCompare(b.item.name))
        .slice(0, limit)
        .map((x) => x.item);
    }),

  compositeBuilds: () =>
    respond((db, scope) => {
      requireStaff(scope);
      return db.compositeBuilds
        .map((b) => withAccountName(db, b))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    }),

  compositeBuild: (id) =>
    respond((db, scope) => {
      requireStaff(scope);
      return build(db, id);
    }),

  createCompositeBuild: (input) =>
    respond((db, scope) => {
      requireStaff(scope);
      const data = s.CompositeBuildInput.parse(input);
      customer(db, data.accountId);
      const at = nowIso();
      const record: CompositeBuild = {
        id: newId("cb"),
        number: nextNumber("CB-", db.compositeBuilds),
        name: data.name,
        description: data.description,
        accountId: data.accountId,
        brand: data.brand,
        createdOn: isoDate(today()),
        creatorInitials: initials(STAFF_CONTACT.name),
        status: "draft",
        fxRates: { ...SYSTEM_FX_RATES },
        labourRate: SYSTEM_LABOUR_RATE,
        bands: [emptyBand()],
        quotes: [],
        createdAt: at,
        updatedAt: at,
      };
      commit("internal.createCompositeBuild", [insert("compositeBuilds", record)]);
      return build(db, record.id);
    }),

  updateCompositeBuild: (id, input) =>
    respond((db, scope) => {
      requireStaff(scope);
      build(db, id);
      const data = s.CompositeBuildPatch.parse(input);
      if (data.accountId) customer(db, data.accountId);
      if (data.bands) checkBands(data.bands);
      commit("internal.updateCompositeBuild", [
        patch("compositeBuilds", id, { ...data, updatedAt: nowIso() }),
      ]);
      return build(db, id);
    }),

  duplicateCompositeBuild: (id) =>
    respond((db, scope) => {
      requireStaff(scope);
      const source = build(db, id);
      const at = nowIso();
      const copy: CompositeBuild = {
        ...structuredClone(source),
        id: newId("cb"),
        number: nextNumber("CB-", db.compositeBuilds),
        name: `${source.name} (copy)`,
        createdOn: isoDate(today()),
        creatorInitials: initials(STAFF_CONTACT.name),
        status: "draft",
        bands: source.bands.map((b) => ({
          ...structuredClone(b),
          lines: b.lines.map((l) => ({ ...structuredClone(l), id: newId("cbl") })),
        })),
        quotes: [],
        createdAt: at,
        updatedAt: at,
      };
      commit("internal.duplicateCompositeBuild", [insert("compositeBuilds", copy)]);
      return build(db, copy.id);
    }),

  addCompositeToQuote: (id, input) =>
    respond((db, scope) => {
      requireStaff(scope);
      const record = build(db, id);
      const data = s.AddCompositeToQuoteRequest.parse(input);
      const band = record.bands.find((b) => b.key === data.bandKey);
      if (!band) badRequest(`This build has no ${BAND_LABEL[data.bandKey]} band.`);
      if (!band.lines.length) badRequest("Add at least one line to the band before quoting it.");
      const min = bandMinQty(band.key);
      if (data.qty < min)
        badRequest(
          `The ${BAND_LABEL[band.key]} band prices ${min} or more; quote at least ${min}.`,
        );
      if (band.sellPrice <= 0) badRequest("Set a sell price for the band before quoting it.");
      const figures = bandFigures(band, record);
      const unit = band.sellPrice + band.carriage;
      const detail = [
        record.description.trim(),
        band.key === "base" ? "" : `Priced for ${min} or more.`,
        band.carriage ? `Includes carriage of ${formatMoney(gbp(band.carriage))} each.` : "",
      ]
        .filter(Boolean)
        .join(" ");
      const line: QuoteLine = {
        productId: null,
        description: record.name,
        detail: detail || null,
        qty: data.qty,
        unitPrice: gbp(unit),
        discountPercent: 0,
        lineTotal: gbp(unit * data.qty),
        internal: {
          buildId: record.id,
          buildNumber: record.number,
          bandKey: band.key,
          bom: structuredClone(band.lines),
          fxRates: { ...record.fxRates },
          unitCost: figures.costTotal,
          marginPercent: figures.marginPercent,
        },
      };
      const at = nowIso();
      const result = data.quoteId
        ? addToQuoteChanges(db, data.quoteId, line, at)
        : newQuoteChanges(db, record.accountId, line, at);
      if (result.quote.accountId !== record.accountId)
        badRequest("That quote is for a different customer.");
      commit("internal.addCompositeToQuote", [
        ...result.changes,
        patch("compositeBuilds", id, {
          status: "quoted",
          quotes: [
            ...record.quotes,
            {
              quoteId: result.quote.id,
              quoteNumber: result.quote.number,
              bandKey: band.key,
              qty: data.qty,
              addedAt: at,
            },
          ],
          updatedAt: at,
        }),
      ]);
      return {
        build: build(db, id),
        quote: quoteNow(db.quotes.find((q) => q.id === result.quote.id)!),
      };
    }),

  quotes: () =>
    respond((db, scope) => {
      requireStaff(scope);
      return db.quotes
        .map((q) => withAccountName(db, quoteNow(q)))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }),

  quote: (id) =>
    respond((db, scope) => {
      requireStaff(scope);
      const q = db.quotes.find((x) => x.id === id) ?? notFound("Quote");
      return withAccountName(db, quoteNow(q));
    }),
};

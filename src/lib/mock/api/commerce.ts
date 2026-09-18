import * as s from "@/schemas";
import type { PortalApi } from "@/lib/api/contract";
import type {
  Address,
  Basket,
  Configuration,
  Contact,
  Document,
  Invoice,
  Message,
  Payment,
  PendingChange,
  Quote,
  SalesOrder,
} from "@/types";
import { supplierForecast } from "@/lib/ai/rules";
import { buildBillOfMaterials, validateConfiguration } from "@/lib/configurator/engine";
import { formatDate, formatMoney } from "@/lib/format";
import { isoDate, today } from "../clock";
import { commit, newId, nextNumber, type MockDb } from "../db";
import { insert, patch, type Change } from "../mutations";
import type { Scope } from "../scope";
import { startJourney } from "./journey";
import {
  account,
  badRequest,
  contactOf,
  forbidden,
  inScope,
  insightInputs,
  netValue,
  onTimeDelivery,
  quoteNow,
  YEAR_MS,
  notFound,
  nowIso,
  openThreadChanges,
  priceFor,
  priceListIdFor,
  requireCustomer,
  requireSupplier,
  respond,
  stockStatus,
  vatRate,
  withVat,
} from "./helpers";

// ---------------------------------------------------------------------------
// Session and account
// ---------------------------------------------------------------------------

export const session: PortalApi["session"] = {
  me: () =>
    respond((db, scope) => {
      const contact = contactOf(db, scope);
      const c = scope.commercialAccount;
      const teamIds = [c.accountManagerId, c.technicalContactId, c.buyerId].filter(
        (x): x is string => !!x,
      );
      const roles = scope.isSupplier
        ? ["credit-control"]
        : ["sales-office", "credit-control", "service-engineer"];
      const brewfittTeam = [
        ...db.team.filter((t) => teamIds.includes(t.id)),
        ...db.team.filter((t) => roles.includes(t.role)),
      ];
      const groupAccount = scope.account.isGroup
        ? scope.account
        : scope.account.parentAccountId
          ? account(db, scope.account.parentAccountId)
          : null;
      // Credit is held on the commercial account and shared by every site beneath it.
      let credit = null;
      if (!scope.isSupplier) {
        const sharing = new Set([
          c.id,
          ...db.accounts.filter((a) => a.parentAccountId === c.id).map((a) => a.id),
        ]);
        const balance = db.invoices
          .filter((i) => sharing.has(i.accountId))
          .reduce((sum, i) => sum + (i.kind === "credit-note" ? -1 : 1) * i.outstanding.amount, 0);
        credit = {
          heldByAccountId: c.id,
          onAccount: c.onAccount,
          limit: c.creditLimit,
          balance: { amount: balance, currency: "GBP" as const },
          available: c.creditLimit
            ? { amount: c.creditLimit.amount - balance, currency: "GBP" as const }
            : null,
        };
      }
      return {
        credit,
        vatRate: vatRate(db, scope.viewAccount.id),
        contact,
        account: scope.viewAccount,
        persona: scope.persona,
        brewfittTeam,
        group: groupAccount
          ? {
              account: groupAccount,
              sites: db.accounts.filter((a) => a.parentAccountId === groupAccount.id),
            }
          : null,
      };
    }),
};

function pendingChange(
  scope: Scope,
  field: string,
  from: string | null,
  to: string | null,
  at: string,
): PendingChange {
  return {
    id: newId("chg"),
    field,
    from,
    to,
    requestedById: scope.persona.contactId,
    requestedAt: at,
    status: "pending",
  };
}

export const accountApi: PortalApi["account"] = {
  get: () => respond((_db, scope) => scope.viewAccount),

  update: (input) =>
    respond((db, scope) => {
      const patchInput = s.AccountPatch.parse(input);
      const at = nowIso();
      const a = scope.viewAccount;
      const changes = (Object.keys(patchInput) as (keyof typeof patchInput)[])
        .filter((k) => patchInput[k] !== undefined && patchInput[k] !== a[k])
        .map((k) => pendingChange(scope, k, a[k] ?? null, patchInput[k] ?? null, at));
      if (changes.length === 0) return a;
      commit("account.update", [
        patch("accounts", a.id, { pendingChanges: [...a.pendingChanges, ...changes] }),
      ]);
      return account(db, a.id);
    }),

  addresses: () => respond((db, scope) => db.addresses.filter((x) => inScope(scope, x.accountId))),

  createAddress: (input) =>
    respond((db, scope) => {
      const data = s.AddressInput.parse(input);
      const address: Address = {
        ...data,
        id: newId("adr"),
        accountId: scope.viewAccount.id,
        latitude: data.latitude ?? 53.6458,
        longitude: data.longitude ?? -1.785,
        isDefault: false,
        approvalStatus: "pending",
      };
      commit("account.createAddress", [insert("addresses", address)]);
      return address;
    }),

  updateAddress: (id, input) =>
    respond((db, scope) => {
      const current =
        db.addresses.find((x) => x.id === id && inScope(scope, x.accountId)) ?? notFound("Address");
      const data = s.AddressInput.partial().parse(input);
      const at = nowIso();
      const changes = (Object.keys(data) as (keyof typeof data)[])
        .filter((k) => data[k] !== undefined && data[k] !== current[k as keyof Address])
        .map((k) =>
          pendingChange(
            scope,
            `address:${current.label}:${k}`,
            String(current[k as keyof Address] ?? ""),
            String(data[k] ?? ""),
            at,
          ),
        );
      if (changes.length === 0) return current;
      const owner = account(db, current.accountId);
      commit("account.updateAddress", [
        patch("addresses", id, { approvalStatus: "pending" }),
        patch("accounts", owner.id, { pendingChanges: [...owner.pendingChanges, ...changes] }),
      ]);
      return db.addresses.find((x) => x.id === id)!;
    }),

  contacts: () => respond((db, scope) => db.contacts.filter((x) => inScope(scope, x.accountId))),

  createContact: (input) =>
    respond((db, scope) => {
      const contact: Contact = {
        ...s.ContactInput.parse(input),
        id: newId("con"),
        accountId: scope.viewAccount.id,
        approvalStatus: "pending",
      };
      commit("account.createContact", [insert("contacts", contact)]);
      return contact;
    }),

  updateContact: (id, input) =>
    respond((db, scope) => {
      const current =
        db.contacts.find((x) => x.id === id && inScope(scope, x.accountId)) ?? notFound("Contact");
      const data = s.ContactInput.partial().parse(input);
      const at = nowIso();
      const changes = (Object.keys(data) as (keyof typeof data)[])
        .filter((k) => data[k] !== undefined && data[k] !== current[k])
        .map((k) =>
          pendingChange(
            scope,
            `contact:${current.name}:${k}`,
            String(current[k]),
            String(data[k]),
            at,
          ),
        );
      if (changes.length === 0) return current;
      const owner = account(db, current.accountId);
      commit("account.updateContact", [
        patch("contacts", id, { approvalStatus: "pending" }),
        patch("accounts", owner.id, { pendingChanges: [...owner.pendingChanges, ...changes] }),
      ]);
      return db.contacts.find((x) => x.id === id)!;
    }),

  documents: () =>
    respond((db, scope) =>
      db.documents.filter(
        (d) =>
          d.ownerAccountId &&
          inScope(scope, d.ownerAccountId) &&
          ["insurance", "compliance", "agreement"].includes(d.category),
      ),
    ),

  uploadDocument: (input) =>
    respond((db, scope) => {
      const data = s.DocumentUploadInput.parse(input);
      const doc: Document = {
        ...data,
        id: newId("doc"),
        relatedType: "account",
        relatedId: scope.viewAccount.id,
        ownerAccountId: scope.viewAccount.id,
        approvalStatus: "pending",
        modifiedAt: nowIso(),
      };
      commit("account.uploadDocument", [insert("documents", doc)]);
      return doc;
    }),

  stats: () =>
    respond((db, scope) => {
      requireCustomer(scope);
      const now = Date.now();
      const orders = db.salesOrders.filter(
        (o) => inScope(scope, o.accountId) && o.status !== "cancelled",
      );
      const byId = new Map(orders.map((o) => [o.id, o]));
      // The same 12 calendar months as the monthly charts, so totals and charts agree.
      const windowStart = monthlyOrders([], now)[0]!.month;
      const yearOrders = orders.filter((o) => o.createdAt.slice(0, 7) >= windowStart);
      const value = yearOrders.reduce((sum, o) => sum + netValue(o.lines), 0);
      const decided = db.quotes
        .filter((q) => inScope(scope, q.accountId) && now - Date.parse(q.createdAt) <= YEAR_MS)
        .map(quoteNow)
        .filter(
          (q) => q.status === "accepted" || q.status === "declined" || q.status === "expired",
        );
      const accepted = decided.filter((q) => q.status === "accepted").length;
      return {
        onTimeDelivery: onTimeDelivery(
          db.deliveries.filter((d) => d.orderType === "sales" && byId.has(d.orderId)),
          (orderId) => {
            const o = byId.get(orderId);
            return o ? (o.confirmedDate ?? o.requestedDate) : null;
          },
          now,
        ),
        orderValue: { amount: value, currency: "GBP" as const },
        orderCount: yearOrders.length,
        averageOrderValue: yearOrders.length
          ? { amount: Math.round(value / yearOrders.length), currency: "GBP" as const }
          : null,
        quoteConversion: {
          percent: decided.length ? Math.round((accepted / decided.length) * 100) : null,
          accepted,
          decided: decided.length,
        },
        monthly: monthlyOrders(orders, now),
        // A group contact viewing all sites can compare order figures site by site.
        sites:
          scope.persona.kind === "group" && !scope.persona.activeSiteId
            ? db.accounts
                .filter((a) => a.parentAccountId === scope.account.id)
                .map((site) => {
                  const siteOrders = yearOrders.filter((o) => o.accountId === site.id);
                  const siteValue = siteOrders.reduce((sum, o) => sum + netValue(o.lines), 0);
                  return {
                    accountId: site.id,
                    name: site.name,
                    orderValue: { amount: siteValue, currency: "GBP" as const },
                    orderCount: siteOrders.length,
                    averageOrderValue: siteOrders.length
                      ? {
                          amount: Math.round(siteValue / siteOrders.length),
                          currency: "GBP" as const,
                        }
                      : null,
                    monthly: monthlyOrders(siteOrders, now),
                  };
                })
                .sort((a, b) => b.orderValue.amount - a.orderValue.amount)
            : null,
        ...serviceStats(db, scope, orders, now),
      };
    }),
};

/** Order value, count and average for each of the last 12 calendar months, oldest first. */
function monthlyOrders(orders: SalesOrder[], now: number) {
  const d = new Date(now);
  return Array.from({ length: 12 }, (_, i) => {
    const month = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 11 + i, 1))
      .toISOString()
      .slice(0, 7);
    const list = orders.filter((o) => o.createdAt.startsWith(month));
    const total = list.reduce((sum, o) => sum + netValue(o.lines), 0);
    return {
      month,
      total: { amount: total, currency: "GBP" as const },
      orders: list.length,
      average: list.length
        ? { amount: Math.round(total / list.length), currency: "GBP" as const }
        : null,
    };
  });
}

/** Spend trend, fulfilment and service levels for the customer statistics. */
function serviceStats(db: MockDb, scope: Scope, orders: SalesOrder[], now: number) {
  const HALF = YEAR_MS / 2;
  const spend = (from: number, to: number) =>
    orders
      .filter((o) => {
        const age = now - Date.parse(o.createdAt);
        return age > from && age <= to;
      })
      .reduce((sum, o) => sum + netValue(o.lines), 0);
  const recent = spend(-1, HALF);
  const previous = spend(HALF, YEAR_MS);

  const windowStart = monthlyOrders([], now)[0]!.month;
  const yearOrders = orders.filter((o) => o.createdAt.slice(0, 7) >= windowStart);
  const deliveriesOf = (orderId: string) =>
    db.deliveries
      .filter((d) => d.orderType === "sales" && d.orderId === orderId && d.deliveredAt)
      .sort((a, b) => a.deliveredAt!.localeCompare(b.deliveredAt!));
  const fulfilled = yearOrders.filter((o) => deliveriesOf(o.id).length);
  const inFull = fulfilled.filter((o) => {
    const first = deliveriesOf(o.id)[0]!;
    return o.lines.every(
      (l) => first.lines.find((x) => x.productId === l.productId)?.qty === l.qty,
    );
  }).length;
  const completed = yearOrders.filter((o) => o.status === "delivered");
  const leadDays = completed.map(
    (o) =>
      (Date.parse(deliveriesOf(o.id).at(-1)!.deliveredAt!) - Date.parse(o.createdAt)) / 86_400_000,
  );
  const openBack = orders
    .filter((o) => ["confirmed", "picking", "dispatched", "part-delivered"].includes(o.status))
    .flatMap((o) => o.lines.filter((l) => l.backordered > 0));

  const resolved = db.cases.filter(
    (c) => inScope(scope, c.accountId) && (c.status === "resolved" || c.status === "closed"),
  );
  const resolveDays = resolved.map(
    (c) => (Date.parse(c.updatedAt) - Date.parse(c.createdAt)) / 86_400_000,
  );

  const gaps: number[] = [];
  for (const t of db.threads.filter((x) => inScope(scope, x.accountId))) {
    const messages = db.messages
      .filter((m) => m.threadId === t.id)
      .sort((a, b) => a.sentAt.localeCompare(b.sentAt));
    messages.forEach((m, i) => {
      if (m.senderSide !== "account" || now - Date.parse(m.sentAt) > YEAR_MS) return;
      // Count a reply once: only the first customer message before Brewfitt answers.
      if (i > 0 && messages[i - 1]!.senderSide === "account") return;
      const reply = messages.slice(i + 1).find((x) => x.senderSide === "brewfitt");
      if (reply) gaps.push((Date.parse(reply.sentAt) - Date.parse(m.sentAt)) / 3_600_000);
    });
  }
  const average = (xs: number[], dp = 1) =>
    xs.length
      ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10 ** dp) / 10 ** dp
      : null;

  return {
    spendTrend: {
      recent: { amount: recent, currency: "GBP" as const },
      previous: { amount: previous, currency: "GBP" as const },
      changePercent: previous ? Math.round(((recent - previous) / previous) * 100) : null,
    },
    fillRate: {
      percent: fulfilled.length ? Math.round((inFull / fulfilled.length) * 100) : null,
      inFull,
      total: fulfilled.length,
    },
    averageLeadDays: average(leadDays),
    backOrders: {
      lines: openBack.length,
      units: openBack.reduce((sum, l) => sum + l.backordered, 0),
    },
    caseResolution: { averageDays: average(resolveDays), resolved: resolved.length },
    responseTime: { averageHours: average(gaps), replies: gaps.length },
  };
}

// ---------------------------------------------------------------------------
// Products, price list, stock
// ---------------------------------------------------------------------------

function visibleProductIds(db: MockDb, scope: Scope): Set<string> {
  if (scope.isSupplier)
    return new Set(db.products.filter((p) => p.supplierId === scope.account.id).map((p) => p.id));
  const listId = priceListIdFor(db, scope.viewAccount.id);
  return new Set(db.priceListLines.filter((l) => l.priceListId === listId).map((l) => l.productId));
}

export const products: PortalApi["products"] = {
  list: (query) =>
    respond((db, scope) => {
      const q = s.ProductListQuery.parse(query ?? {});
      const visible = visibleProductIds(db, scope);
      const term = q.search?.trim().toLowerCase();
      const sectionCats = q.section
        ? new Set(db.categories.filter((c) => c.section === q.section).map((c) => c.id))
        : null;
      return db.products.filter(
        (p) =>
          p.active &&
          visible.has(p.id) &&
          (!q.category || p.category === q.category || p.subcategory === q.category) &&
          (!sectionCats || sectionCats.has(p.category)) &&
          (!term ||
            p.name.toLowerCase().includes(term) ||
            p.sku.toLowerCase().includes(term) ||
            p.description.toLowerCase().includes(term)),
      );
    }),
  get: (id) =>
    respond((db, scope) => {
      const p = db.products.find((x) => x.id === id);
      if (!p || !visibleProductIds(db, scope).has(id)) notFound("Product");
      return p;
    }),
  categories: () =>
    respond((db, scope) => {
      const visible = visibleProductIds(db, scope);
      const used = new Set(
        db.products.filter((p) => visible.has(p.id)).flatMap((p) => [p.category, p.subcategory]),
      );
      return db.categories.filter((c) => used.has(c.id));
    }),
};

export const priceList: PortalApi["priceList"] = {
  get: () =>
    respond((db, scope) => {
      const listId = scope.isSupplier
        ? scope.account.priceListId
        : priceListIdFor(db, scope.viewAccount.id);
      const list = db.priceLists.find((l) => l.id === listId) ?? notFound("Price list");
      const productById = new Map(db.products.map((p) => [p.id, p]));
      const stockById = new Map(db.stock.map((x) => [x.productId, x]));
      return {
        priceList: list,
        lines: db.priceListLines
          .filter((l) => l.priceListId === list.id)
          .map((l) => ({
            ...l,
            product: productById.get(l.productId)!,
            stock: stockById.get(l.productId) ?? null,
          })),
      };
    }),
  export: () =>
    respond((db, scope) => {
      const listId = scope.isSupplier
        ? scope.account.priceListId
        : priceListIdFor(db, scope.viewAccount.id);
      const list = db.priceLists.find((l) => l.id === listId) ?? notFound("Price list");
      const categoryName = (id: string | null) =>
        db.categories.find((c) => c.id === id)?.name ?? "";
      const cell = (v: string | number) =>
        typeof v === "number" ? String(v) : /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
      const header = scope.isSupplier
        ? [
            "SKU",
            "Product",
            "Category",
            "Unit",
            "Pack size",
            "Agreed cost (GBP)",
            "Lead time (days)",
            "Brewfitt stock",
          ]
        : [
            "SKU",
            "Product",
            "Category",
            "Unit",
            "Pack size",
            "List price (GBP)",
            "Discount %",
            "Your price (GBP)",
            "Stock status",
          ];
      const rows = db.priceListLines
        .filter((l) => l.priceListId === list.id)
        .map((l) => {
          const p = db.products.find((x) => x.id === l.productId)!;
          const st = db.stock.find((x) => x.productId === p.id);
          return scope.isSupplier
            ? [
                p.sku,
                p.name,
                categoryName(p.subcategory ?? p.category),
                p.unit,
                p.packSize,
                (l.price.amount / 100).toFixed(2),
                p.leadTimeDays,
                st?.onHand ?? 0,
              ]
            : [
                p.sku,
                p.name,
                categoryName(p.subcategory ?? p.category),
                p.unit,
                p.packSize,
                (p.listPrice.amount / 100).toFixed(2),
                l.discountPercent,
                (l.price.amount / 100).toFixed(2),
                st?.status ?? "",
              ];
        });
      const content = [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
      const slug = scope.viewAccount.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
      return {
        filename: `brewfitt-price-list-${slug}-${isoDate(today())}.csv`,
        mimeType: "text/csv" as const,
        content,
        generatedAt: nowIso(),
      };
    }),
};

export const stock: PortalApi["stock"] = {
  list: () =>
    respond((db, scope) => {
      const visible = visibleProductIds(db, scope);
      return db.stock.filter((x) => visible.has(x.productId));
    }),
  forecast: () =>
    respond((db, scope) => {
      requireSupplier(scope);
      return supplierForecast(scope.account.id, insightInputs(db));
    }),
};

// ---------------------------------------------------------------------------
// Configurator
// ---------------------------------------------------------------------------

function priceConfiguration(
  db: MockDb,
  accountId: string,
  input: Pick<Configuration, "venueType" | "siteAddressId" | "selections">,
) {
  const bom = buildBillOfMaterials(input, db.configuratorRules, (pid) =>
    priceFor(db, accountId, pid),
  );
  if (bom.unpriced.length) {
    const names = bom.unpriced
      .map((id) => db.products.find((p) => p.id === id)?.name ?? id)
      .join(", ");
    badRequest(
      `These items are not on your price list, so Brewfitt needs to quote them separately: ${names}.`,
    );
  }
  return bom;
}

export const configurator: PortalApi["configurator"] = {
  rules: () =>
    respond((db, scope) => {
      requireCustomer(scope);
      return db.configuratorRules;
    }),
  list: () =>
    respond((db, scope) => {
      requireCustomer(scope);
      return db.configurations
        .filter((c) => inScope(scope, c.accountId))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    }),
  get: (id) =>
    respond(
      (db, scope) =>
        db.configurations.find((c) => c.id === id && inScope(scope, c.accountId)) ??
        notFound("Dispense design"),
    ),
  create: (input) =>
    respond((db, scope) => {
      requireCustomer(scope);
      const data = s.ConfigurationInput.parse(input);
      const bom = priceConfiguration(db, scope.viewAccount.id, data);
      const at = nowIso();
      const config: Configuration = {
        ...data,
        id: newId("cfg"),
        accountId: scope.viewAccount.id,
        lines: bom.lines,
        total: bom.total,
        status: "draft",
        quoteId: null,
        createdAt: at,
        updatedAt: at,
      };
      commit("configurator.create", [insert("configurations", config)]);
      return config;
    }),
  update: (id, input) =>
    respond((db, scope) => {
      const current =
        db.configurations.find((c) => c.id === id && inScope(scope, c.accountId)) ??
        notFound("Dispense design");
      if (current.status === "quoted")
        badRequest("This design has been quoted. Duplicate it to make changes.");
      const data = s.ConfigurationPatch.parse(input);
      const next = { ...current, ...data };
      const bom = priceConfiguration(db, current.accountId, next);
      commit("configurator.update", [
        patch("configurations", id, {
          ...data,
          lines: bom.lines,
          total: bom.total,
          updatedAt: nowIso(),
        }),
      ]);
      return db.configurations.find((c) => c.id === id)!;
    }),
  requestQuote: (id) =>
    respond((db, scope) => {
      const config =
        db.configurations.find((c) => c.id === id && inScope(scope, c.accountId)) ??
        notFound("Dispense design");
      if (config.status === "quoted")
        badRequest("A quote has already been requested for this design.");
      const errors = validateConfiguration(config, db.configuratorRules);
      if (Object.keys(errors).length)
        badRequest(
          `Complete every step before requesting a quote: ${Object.values(errors).flat()[0]}`,
        );
      const { quote, changes } = createQuoteChanges(db, scope, {
        accountId: config.accountId,
        lines: config.lines,
        configurationId: config.id,
        request: `Quote requested for the design "${config.name}" from the Dispense Designer.${config.selections.font.artwork.length ? ` Artwork provided: ${config.selections.font.artwork.join(", ")}.` : ""}`,
      });
      commit("configurator.requestQuote", [
        ...changes,
        patch("configurations", config.id, {
          status: "quoted",
          quoteId: quote.id,
          updatedAt: quote.createdAt,
        }),
      ]);
      return quote;
    }),
};

/**
 * A quote built in the portal, from a configuration or the basket, at the
 * account's prices. Decision 11: it is ready to accept straight away, with its
 * PDF and a conversation, and accepting it creates the sales order.
 */
export function createQuoteChanges(
  db: MockDb,
  scope: Scope,
  args: {
    accountId: string;
    lines: { productId: string; qty: number; price?: Quote["subtotal"] }[];
    configurationId: string | null;
    request: string;
  },
): { quote: Quote; changes: Change[] } {
  const at = nowIso();
  const lines = args.lines.map((l) => {
    const product = db.products.find((p) => p.id === l.productId) ?? notFound("Product");
    const price = l.price ?? priceFor(db, args.accountId, l.productId);
    if (!price) badRequest(`${product.name} is not on your price list.`);
    return {
      productId: l.productId,
      description: product.name,
      qty: l.qty,
      unitPrice: price,
      discountPercent: Math.max(0, Math.round((1 - price.amount / product.listPrice.amount) * 100)),
      lineTotal: { amount: l.qty * price.amount, currency: price.currency },
    };
  });
  const subtotal = lines.reduce((sum, l) => sum + l.lineTotal.amount, 0);
  const { vat, gross } = withVat(db, args.accountId, subtotal);
  const quote: Quote = {
    id: newId("quo"),
    accountId: args.accountId,
    number: nextNumber("QU-", db.quotes),
    status: "sent",
    lines,
    subtotal: { amount: subtotal, currency: "GBP" },
    vat: { amount: vat, currency: "GBP" },
    total: { amount: gross, currency: "GBP" },
    validUntil: isoDate(new Date(Date.now() + 30 * 86_400_000)),
    configurationId: args.configurationId,
    pdfDocumentId: newId("doc"),
    threadId: "",
    salesOrderId: null,
    declineReason: null,
    lastViewedAt: at,
    createdAt: at,
    updatedAt: at,
  };
  const pdf: Document = {
    id: quote.pdfDocumentId!,
    name: `Quote ${quote.number}.pdf`,
    category: "quote",
    relatedType: "quote",
    relatedId: quote.id,
    ownerAccountId: args.accountId,
    fileType: "pdf",
    fileSize: 96_000,
    expiresAt: null,
    approvalStatus: null,
    modifiedAt: at,
  };
  const opened = openThreadChanges(db, scope, {
    accountId: args.accountId,
    subject: `Quote ${quote.number}`,
    relatedType: "quote",
    relatedId: quote.id,
    brewfittRole: "account-manager",
    first: { side: "account", channel: "portal", body: args.request, at },
  });
  quote.threadId = opened.thread.id;
  const brewfitt = opened.thread.participants.find((p) => p.side === "brewfitt")!;
  const readyAt = new Date(Date.parse(at) + 1000).toISOString();
  const ready: Message = {
    id: newId("msg"),
    threadId: opened.thread.id,
    senderId: brewfitt.id,
    senderSide: "brewfitt",
    channel: "portal",
    body: `Quote ${quote.number} is attached at your prices: ${formatMoney(quote.total)} including VAT, valid until ${formatDate(quote.validUntil)}. Accept it here and we will confirm the order.`,
    attachments: [pdf.id],
    sentAt: readyAt,
  };
  return {
    quote,
    changes: [
      insert("quotes", quote),
      insert("documents", pdf),
      ...opened.changes,
      insert("messages", ready),
      patch("threads", opened.thread.id, { lastMessageAt: readyAt }),
      insert("notifications", {
        id: newId("ntf"),
        accountId: args.accountId,
        kind: "quote-awaiting-acceptance",
        title: `Quote ${quote.number} ready to accept`,
        body: `${formatMoney(quote.total)} including VAT, valid until ${formatDate(quote.validUntil)}.`,
        relatedType: "quote",
        relatedId: quote.id,
        read: false,
        dismissed: false,
        createdAt: readyAt,
      }),
    ],
  };
}

// ---------------------------------------------------------------------------
// Shop, checkout and order creation
// ---------------------------------------------------------------------------

function basketFor(db: MockDb, accountId: string): Basket {
  return (
    db.baskets.find((b) => b.accountId === accountId) ?? {
      id: `bsk_${accountId}`,
      accountId,
      lines: [],
      deliveryAddressId:
        db.addresses.find((a) => a.accountId === accountId && a.isDefault)?.id ?? null,
      requestedDate: null,
      poReference: null,
      notes: null,
    }
  );
}

function saveBasket(db: MockDb, basket: Basket): Change {
  return db.baskets.some((b) => b.id === basket.id)
    ? patch("baskets", basket.id, basket)
    : insert("baskets", basket);
}

/**
 * Builds a sales order with its thread, stock allocation and, for customers
 * paying by card, the paid invoice and payment. Used by checkout and quote acceptance.
 */
export function createOrderChanges(
  db: MockDb,
  scope: Scope,
  args: {
    accountId: string;
    lines: { productId: string; qty: number }[];
    deliveryAddressId: string;
    requestedDate: string;
    poReference: string | null;
    quoteId: string | null;
    card: { nameOnCard: string; last4: string } | null;
    notes: string | null;
  },
): { order: SalesOrder; invoice: Invoice | null; changes: Change[] } {
  const at = nowIso();
  const lines = args.lines.map((l) => {
    const price = priceFor(db, args.accountId, l.productId);
    if (!price)
      badRequest(
        `${db.products.find((p) => p.id === l.productId)?.name ?? "An item"} is not on your price list.`,
      );
    return { productId: l.productId, qty: l.qty, delivered: 0, backordered: 0, price };
  });
  const net = lines.reduce((sum, l) => sum + l.qty * l.price.amount, 0);
  const { gross } = withVat(db, args.accountId, net);
  const address =
    db.addresses.find((a) => a.id === args.deliveryAddressId && a.accountId === args.accountId) ??
    notFound("Delivery address");
  const order: SalesOrder = {
    id: newId("so"),
    accountId: args.accountId,
    number: nextNumber("SO-", db.salesOrders),
    status: "confirmed",
    lines,
    deliveryAddressId: address.id,
    requestedDate: args.requestedDate,
    confirmedDate: args.requestedDate,
    poReference: args.poReference,
    quoteId: args.quoteId,
    total: { amount: gross, currency: "GBP" },
    threadId: "",
    createdAt: at,
  };
  const opened = openThreadChanges(db, scope, {
    accountId: args.accountId,
    subject: `Order ${order.number}`,
    relatedType: "sales-order",
    relatedId: order.id,
    brewfittRole: "sales-office",
    first: {
      side: "brewfitt",
      channel: "email",
      body: `Thank you for your order. ${order.number} is confirmed for delivery on ${formatDate(order.confirmedDate!)} to ${address.label.toLowerCase()} (${address.town}).`,
      at,
    },
  });
  order.threadId = opened.thread.id;
  const changes: Change[] = [insert("salesOrders", order), ...opened.changes, startJourney(order)];

  if (args.notes) {
    const note: Message = {
      id: newId("msg"),
      threadId: opened.thread.id,
      senderId: scope.persona.contactId,
      senderSide: "account",
      channel: "portal",
      body: args.notes,
      attachments: [],
      sentAt: new Date(Date.parse(at) + 1000).toISOString(),
    };
    changes.push(
      insert("messages", note),
      patch("threads", opened.thread.id, { lastMessageAt: note.sentAt }),
    );
  }

  // Allocate stock (mock; real stock calculation happens in TOTA360v5).
  for (const l of lines) {
    const st = db.stock.find((x) => x.productId === l.productId);
    if (!st) continue;
    const allocated = st.allocated + l.qty;
    changes.push(
      patch(
        "stock",
        st.productId,
        {
          allocated,
          available: st.onHand - allocated,
          status: stockStatus(st.onHand, allocated, st.onOrder, st.minimumLevel),
        },
        "productId",
      ),
    );
  }

  changes.push(
    insert("notifications", {
      id: newId("ntf"),
      accountId: args.accountId,
      kind: "order-confirmed",
      title: `Order ${order.number} confirmed`,
      body: `Delivery due ${formatDate(order.confirmedDate!)}.`,
      relatedType: "sales-order",
      relatedId: order.id,
      read: false,
      dismissed: false,
      createdAt: at,
    }),
  );

  let invoice: Invoice | null = null;
  const onAccount = account(db, args.accountId).onAccount;
  if (!onAccount) {
    // Customers without credit terms are invoiced when they order; card orders are paid at once.
    invoice = {
      id: newId("inv"),
      accountId: args.accountId,
      number: nextNumber("INV-", db.invoices),
      kind: "invoice",
      status: args.card ? "paid" : "open",
      issuedAt: at,
      dueAt: at,
      total: order.total,
      outstanding: args.card ? { amount: 0, currency: "GBP" } : order.total,
      ageingBand: "current",
      orderId: order.id,
      orderType: "sales",
      pdfDocumentId: newId("doc"),
    };
    changes.push(
      insert("invoices", invoice),
      insert("documents", {
        id: invoice.pdfDocumentId!,
        name: `Invoice ${invoice.number}.pdf`,
        category: "invoice",
        relatedType: "invoice",
        relatedId: invoice.id,
        ownerAccountId: args.accountId,
        fileType: "pdf",
        fileSize: 64_000,
        expiresAt: null,
        approvalStatus: null,
        modifiedAt: at,
      } satisfies Document),
    );
    if (args.card) {
      const payment: Payment = {
        id: newId("pay"),
        accountId: args.accountId,
        amount: order.total,
        method: "card",
        reference: `Card ending ${args.card.last4}`,
        paidAt: at,
        allocatedTo: [{ invoiceId: invoice.id, amount: order.total }],
        remittanceDocumentId: null,
      };
      changes.push(insert("payments", payment));
    }
  }
  changes.push(
    insert("documents", {
      id: newId("doc"),
      name: `Order confirmation ${order.number}.pdf`,
      category: "order",
      relatedType: "sales-order",
      relatedId: order.id,
      ownerAccountId: args.accountId,
      fileType: "pdf",
      fileSize: 58_000,
      expiresAt: null,
      approvalStatus: null,
      modifiedAt: at,
    } satisfies Document),
  );
  return { order, invoice, changes };
}

export const shop: PortalApi["shop"] = {
  basket: () =>
    respond((db, scope) => {
      requireCustomer(scope);
      return basketFor(db, scope.viewAccount.id);
    }),
  addToBasket: (input) =>
    respond((db, scope) => {
      requireCustomer(scope);
      const line = s.BasketLine.parse(input);
      if (!priceFor(db, scope.viewAccount.id, line.productId))
        badRequest("That product is not on your price list.");
      const basket = basketFor(db, scope.viewAccount.id);
      const existing = basket.lines.find((l) => l.productId === line.productId);
      const next: Basket = {
        ...basket,
        lines: existing
          ? basket.lines.map((l) =>
              l.productId === line.productId ? { ...l, qty: l.qty + line.qty } : l,
            )
          : [...basket.lines, line],
      };
      commit("shop.addToBasket", [saveBasket(db, next)]);
      return next;
    }),
  updateBasket: (input) =>
    respond((db, scope) => {
      requireCustomer(scope);
      const data = s.BasketPatch.parse(input);
      const basket = basketFor(db, scope.viewAccount.id);
      const next: Basket = {
        ...basket,
        ...data,
        lines: (data.lines ?? basket.lines).filter((l) => l.qty > 0),
      };
      commit("shop.updateBasket", [saveBasket(db, next)]);
      return next;
    }),
  checkout: (input) =>
    respond((db, scope) => {
      requireCustomer(scope);
      const data = s.CheckoutRequest.parse(input);
      const basket = basketFor(db, scope.viewAccount.id);
      if (basket.lines.length === 0) badRequest("Your basket is empty.");
      if (scope.viewAccount.isGroup) badRequest("Switch into a site to place an order for it.");
      const onAccount = account(db, scope.viewAccount.id).onAccount;
      if (onAccount && data.paymentMethod !== "account")
        badRequest("Your account has credit terms; confirm the order on account.");
      if (!onAccount && (data.paymentMethod !== "card" || !data.card))
        forbidden("Your account has no credit terms, so the order needs card payment.");
      const { order, changes } = createOrderChanges(db, scope, {
        accountId: scope.viewAccount.id,
        lines: basket.lines,
        deliveryAddressId: data.deliveryAddressId,
        requestedDate: data.requestedDate,
        poReference: data.poReference,
        quoteId: null,
        card: data.card,
        notes: data.notes,
      });
      commit("shop.checkout", [
        ...changes,
        saveBasket(db, {
          ...basket,
          lines: [],
          poReference: null,
          notes: null,
          requestedDate: null,
        }),
      ]);
      return order;
    }),
  requestQuote: (input) =>
    respond((db, scope) => {
      requireCustomer(scope);
      const data = s.BasketQuoteRequest.parse(input);
      const basket = basketFor(db, scope.viewAccount.id);
      if (basket.lines.length === 0) badRequest("Your basket is empty.");
      if (scope.viewAccount.isGroup) badRequest("Switch into a site to request a quote for it.");
      const items = `${basket.lines.length} basket ${basket.lines.length === 1 ? "item" : "items"}`;
      const { quote, changes } = createQuoteChanges(db, scope, {
        accountId: scope.viewAccount.id,
        lines: basket.lines,
        configurationId: null,
        request: data.notes
          ? `Quote requested for ${items}. ${data.notes}`
          : `Quote requested for ${items}.`,
      });
      commit("shop.requestQuote", [
        ...changes,
        saveBasket(db, {
          ...basket,
          lines: [],
          poReference: null,
          notes: null,
          requestedDate: null,
        }),
      ]);
      return quote;
    }),
};

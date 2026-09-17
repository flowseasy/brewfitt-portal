/**
 * npm run check:data
 *
 * Verifies the seeded mock data against BLUEPRINT.md: schema validity, volumes,
 * every consistency rule, and that every AI insight has real conditions behind
 * it. Runs for today and for dates months ahead, because all mock dates are
 * relative to today (decision 3).
 */
import { existsSync } from "node:fs";
import { z } from "zod";
import * as s from "@/schemas";
import type { MockDb } from "@/lib/mock/db";
import { generateDb } from "@/lib/mock/seed";
import { addDays, daysBetween, today as clockToday } from "@/lib/mock/clock";
import { deriveInvoice } from "@/lib/mock/seed/finance";
import { effectivePriceListId } from "@/lib/mock/seed/context";
import { MENTIONS_ATTACHMENT } from "@/lib/mock/seed/comms";
import {
  customerInsights,
  RULES,
  supplierInsights,
  supplierForecast,
  type InsightInputs,
} from "@/lib/ai/rules";
import { buildBillOfMaterials, validateConfiguration } from "@/lib/configurator/engine";
import { DEFAULT_PERSONA } from "@/stores/persona-store";

type Failure = { rule: string; detail: string };

function check(db: MockDb, today: Date): { failures: Failure[]; stats: Record<string, number> } {
  const failures: Failure[] = [];
  const fail = (rule: string, detail: string) => failures.push({ rule, detail });
  const nowMs = today.getTime() + 86_400_000;

  // ---- 1. Schemas ------------------------------------------------------------
  const collections: [string, unknown[], z.ZodType][] = [
    ["team", db.team, s.BrewfittTeamMember],
    ["accounts", db.accounts, s.Account],
    ["contacts", db.contacts, s.Contact],
    ["addresses", db.addresses, s.Address],
    ["categories", db.categories, s.Category],
    ["products", db.products, s.Product],
    ["priceLists", db.priceLists, s.PriceList],
    ["priceListLines", db.priceListLines, s.PriceListLine],
    ["stock", db.stock, s.StockPosition],
    ["configurations", db.configurations, s.Configuration],
    ["baskets", db.baskets, s.Basket],
    ["quotes", db.quotes, s.Quote],
    ["rfqs", db.rfqs, s.Rfq],
    ["supplierQuotes", db.supplierQuotes, s.SupplierQuote],
    ["salesOrders", db.salesOrders, s.SalesOrder],
    ["purchaseOrders", db.purchaseOrders, s.PurchaseOrder],
    ["deliveries", db.deliveries, s.Delivery],
    ["changeRequests", db.changeRequests, s.ChangeRequest],
    ["invoices", db.invoices, s.Invoice],
    ["payments", db.payments, s.Payment],
    ["paymentRuns", db.paymentRuns, s.PaymentRun],
    ["jobs", db.jobs, s.Job],
    ["cases", db.cases, s.Case],
    ["knowledge", db.knowledge, s.KnowledgeItem],
    ["documents", db.documents, s.Document],
    ["supplierProducts", db.supplierProducts, s.SupplierProduct],
    ["offers", db.offers, s.Offer],
    ["threads", db.threads, s.Thread],
    ["messages", db.messages, s.Message],
    ["notifications", db.notifications, s.Notification],
  ];
  for (const [name, items, schema] of collections) {
    items.forEach((item, i) => {
      const r = schema.safeParse(item);
      if (!r.success) fail(`schema:${name}`, `#${i} ${JSON.stringify(r.error.issues[0])}`);
    });
    const ids = items.map((x) => (x as { id?: string }).id).filter(Boolean);
    if (new Set(ids).size !== ids.length) fail(`unique-ids:${name}`, "duplicate ids");
  }
  if (!s.ConfiguratorRules.safeParse(db.configuratorRules).success)
    fail("schema:configuratorRules", "invalid");

  // ---- 2. Volumes --------------------------------------------------------------
  const customers = db.accounts.filter((a) => a.kind === "customer");
  const suppliers = db.accounts.filter((a) => a.kind === "supplier");
  const volumes: [string, number, number][] = [
    ["customer accounts", customers.length, 25],
    ["supplier accounts", suppliers.length, 10],
    ["contacts", db.contacts.length, 50],
    ["products", db.products.length, 120],
    ["price lists", db.priceLists.length, 6],
    ["saved configurations", db.configurations.length, 15],
    ["quotes", db.quotes.length, 40],
    ["sales orders", db.salesOrders.length, 60],
    ["purchase orders", db.purchaseOrders.length, 25],
    ["deliveries", db.deliveries.length, 80],
    ["invoices and credit notes", db.invoices.length, 100],
    ["jobs", db.jobs.length, 20],
    ["cases", db.cases.length, 15],
    ["knowledge items", db.knowledge.length, 40],
    ["documents", db.documents.length, 60],
    ["threads", db.threads.length, 30],
    ["messages", db.messages.length, 200],
  ];
  for (const [label, n, min] of volumes) if (n < min) fail("volume", `${label}: ${n} < ${min}`);
  if (db.team.length !== 8) fail("volume", `Brewfitt team members: ${db.team.length} ≠ 8`);

  // ---- 3. Consistency rules ----------------------------------------------------
  const accountById = new Map(db.accounts.map((a) => [a.id, a]));
  const productById = new Map(db.products.map((p) => [p.id, p]));
  const soById = new Map(db.salesOrders.map((o) => [o.id, o]));
  const poById = new Map(db.purchaseOrders.map((o) => [o.id, o]));
  const onList = new Set(db.priceListLines.map((l) => `${l.priceListId}|${l.productId}`));
  const listOf = (accountId: string) =>
    effectivePriceListId(accountById.get(accountId)!, db.accounts);
  const vat = (accountId: string) =>
    db.addresses.find((a) => a.id === accountById.get(accountId)!.billingAddressId)!.country ===
    "GB"
      ? 0.2
      : 0;

  const belongs = (
    kind: string,
    id: string,
    accountId: string,
    expected: "customer" | "supplier" | "any" = "customer",
  ) => {
    const a = accountById.get(accountId);
    if (!a) return fail("belongs-to-account", `${kind} ${id} → missing account ${accountId}`);
    if (expected !== "any" && a.kind !== expected)
      fail("belongs-to-account", `${kind} ${id} → ${a.kind} account ${accountId}`);
  };
  db.quotes.forEach((q) => belongs("quote", q.id, q.accountId));
  db.salesOrders.forEach((o) => belongs("sales order", o.id, o.accountId));
  db.invoices.forEach((i) =>
    belongs("invoice", i.id, i.accountId, i.orderType === "sales" ? "customer" : "supplier"),
  );
  db.cases.forEach((c) => belongs("case", c.id, c.accountId, "any"));
  db.threads.forEach((t) => belongs("thread", t.id, t.accountId, "any"));
  db.configurations.forEach((c) => belongs("configuration", c.id, c.accountId));
  db.jobs.forEach((j) => belongs("job", j.id, j.accountId));
  db.purchaseOrders.forEach((p) => belongs("purchase order", p.id, p.supplierId, "supplier"));
  db.purchaseOrders.forEach((p) => {
    if ((p.status === "issued") !== !p.acknowledgedAt) fail("po-acknowledged", p.id);
    if (p.acknowledgedAt && p.acknowledgedAt < p.createdAt) fail("po-acknowledged-order", p.id);
    if (p.acknowledgedAt && Date.parse(p.acknowledgedAt) > nowMs) fail("dates-not-future", `po ack ${p.id}`);
  });
  db.rfqs.forEach((r) => belongs("rfq", r.id, r.supplierId, "supplier"));
  db.contacts.forEach((c) => belongs("contact", c.id, c.accountId, "any"));
  db.accounts
    .filter((a) => a.parentAccountId)
    .forEach((a) => {
      const parent = accountById.get(a.parentAccountId!);
      if (!parent?.isGroup)
        fail("group-hierarchy", `${a.id} parent ${a.parentAccountId} is not a group`);
      if (a.priceListId || a.creditLimit || a.accountManagerId)
        fail(
          "group-hierarchy",
          `${a.id} should inherit price list, credit and team from the group (decision 10)`,
        );
    });

  const onPriceList = (kind: string, id: string, accountId: string, productIds: string[]) => {
    const list = listOf(accountId);
    for (const pid of productIds)
      if (!productById.has(pid) || !onList.has(`${list}|${pid}`))
        fail("line-on-price-list", `${kind} ${id}: ${pid} not on ${list}`);
  };
  db.salesOrders.forEach((o) =>
    onPriceList(
      "sales order",
      o.id,
      o.accountId,
      o.lines.map((l) => l.productId),
    ),
  );
  db.quotes.forEach((q) =>
    onPriceList(
      "quote",
      q.id,
      q.accountId,
      q.lines.map((l) => l.productId),
    ),
  );
  db.configurations.forEach((c) =>
    onPriceList(
      "configuration",
      c.id,
      c.accountId,
      c.lines.map((l) => l.productId),
    ),
  );
  db.baskets.forEach((b) =>
    onPriceList(
      "basket",
      b.id,
      b.accountId,
      b.lines.map((l) => l.productId),
    ),
  );
  db.salesOrders.forEach((o) => {
    for (const l of o.lines) {
      const listLine = db.priceListLines.find(
        (x) => x.priceListId === listOf(o.accountId) && x.productId === l.productId,
      );
      if (listLine && listLine.price.amount !== l.price.amount)
        fail("price-matches-list", `${o.number} ${l.productId}`);
    }
    const expected = Math.round(
      o.lines.reduce((sum, l) => sum + l.qty * l.price.amount, 0) * (1 + vat(o.accountId)),
    );
    if (Math.abs(expected - o.total.amount) > 1)
      fail("order-total", `${o.number}: ${o.total.amount} ≠ ${expected}`);
  });
  db.quotes.forEach((q) => {
    const sub = q.lines.reduce((sum, l) => sum + l.lineTotal.amount, 0);
    if (sub !== q.subtotal.amount || q.subtotal.amount + q.vat.amount !== q.total.amount)
      fail("quote-totals", q.number);
    if (Math.abs(Math.round(sub * vat(q.accountId)) - q.vat.amount) > 1)
      fail("quote-vat", q.number);
    if (q.status === "accepted" && !soById.get(q.salesOrderId ?? ""))
      fail("quote-accepted-has-order", q.number);
  });

  for (const d of db.deliveries) {
    const order = d.orderType === "sales" ? soById.get(d.orderId) : poById.get(d.orderId);
    if (!order) fail("delivery-references-order", `${d.number} → ${d.orderType} ${d.orderId}`);
  }
  for (const o of db.salesOrders) {
    for (const l of o.lines) {
      const delivered = db.deliveries
        .filter((d) => d.orderId === o.id && d.deliveredAt)
        .flatMap((d) => d.lines)
        .filter((x) => x.productId === l.productId)
        .reduce((sum, x) => sum + x.qty, 0);
      if (o.status !== "dispatched" && delivered !== l.delivered)
        fail(
          "delivered-quantities",
          `${o.number} ${l.productId}: ${delivered} delivered vs line ${l.delivered}`,
        );
      if (o.status === "delivered" && (l.delivered !== l.qty || l.backordered !== 0))
        fail("delivered-quantities", `${o.number} marked delivered with open quantity`);
      if (o.status === "part-delivered" && l.delivered + l.backordered !== l.qty)
        fail("back-order", `${o.number} ${l.productId}`);
    }
  }
  for (const po of db.purchaseOrders) {
    for (const l of po.lines) {
      const received = db.deliveries
        .filter((d) => d.orderId === po.id && d.deliveredAt)
        .flatMap((d) => d.lines)
        .filter((x) => x.productId === l.productId)
        .reduce((sum, x) => sum + x.qty, 0);
      if (received !== l.received)
        fail("received-quantities", `${po.number} ${l.productId}: ${received} vs ${l.received}`);
    }
  }

  for (const inv of db.invoices) {
    const order = inv.orderType === "sales" ? soById.get(inv.orderId) : poById.get(inv.orderId);
    if (!order) fail("invoice-references-order", `${inv.number} → ${inv.orderType} ${inv.orderId}`);
    else if (
      (inv.orderType === "sales"
        ? (order as { accountId: string }).accountId
        : (order as { supplierId: string }).supplierId) !== inv.accountId
    )
      fail("invoice-account-matches-order", inv.number);
    if (inv.outstanding.amount < 0 || inv.outstanding.amount > inv.total.amount)
      fail("invoice-outstanding", inv.number);
    if (inv.kind !== "credit-note") {
      const allocated = db.payments
        .flatMap((p) => p.allocatedTo)
        .filter((a) => a.invoiceId === inv.id)
        .reduce((sum, a) => sum + a.amount.amount, 0);
      if (allocated + inv.outstanding.amount !== inv.total.amount)
        fail(
          "invoice-reconciles-with-payments",
          `${inv.number}: total ${inv.total.amount} ≠ allocated ${allocated} + outstanding ${inv.outstanding.amount}`,
        );
    }
  }
  for (const p of db.payments) {
    const sum = p.allocatedTo.reduce((acc, a) => acc + a.amount.amount, 0);
    if (sum !== p.amount.amount)
      fail("payment-allocations", `${p.id}: ${sum} ≠ ${p.amount.amount}`);
    if (new Date(p.paidAt).getTime() > nowMs) fail("dates-not-future", `payment ${p.id}`);
  }
  // Ageing bands sum to the outstanding balance per account.
  for (const a of db.accounts) {
    const derived = db.invoices
      .filter((i) => i.accountId === a.id)
      .map((i) => deriveInvoice(i, today));
    const outstanding = derived.reduce(
      (sum, i) => sum + (i.kind === "credit-note" ? -1 : 1) * i.outstanding.amount,
      0,
    );
    const bands = ["current", "30", "60", "90+"].reduce(
      (sum, b) =>
        sum +
        derived
          .filter((i) => i.ageingBand === b)
          .reduce((x, i) => x + (i.kind === "credit-note" ? -1 : 1) * i.outstanding.amount, 0),
      0,
    );
    if (outstanding !== bands) fail("ageing-reconciles", a.id);
    const debits = db.invoices
      .filter((i) => i.accountId === a.id && i.kind !== "credit-note")
      .reduce((sum, i) => sum + i.total.amount, 0);
    const credits = db.invoices
      .filter((i) => i.accountId === a.id && i.kind === "credit-note")
      .reduce((sum, i) => sum + i.total.amount, 0);
    const cash = db.payments
      .filter((p) => p.accountId === a.id && p.method !== "credit-allocation")
      .reduce((sum, p) => sum + p.amount.amount, 0);
    if (debits - credits - cash !== outstanding)
      fail("statement-balance", `${a.id}: ${debits} − ${credits} − ${cash} ≠ ${outstanding}`);
  }
  for (const run of db.paymentRuns) {
    const total = run.invoiceIds.reduce(
      (sum, id) =>
        sum + (db.invoices.find((i) => i.id === id)?.orderType === "purchase" ? 1 : NaN) * 0,
      0,
    );
    if (Number.isNaN(total))
      fail("payment-run-invoices", `${run.id} includes a non-supplier invoice`);
  }

  // Stock reconciles with on-order purchase orders.
  for (const st of db.stock) {
    const open = db.purchaseOrders
      .filter((po) => po.status !== "received")
      .flatMap((po) => po.lines.map((l) => ({ ...l, expected: po.expectedDate })))
      .filter((l) => l.productId === st.productId && l.qty > l.received);
    const qty = open.reduce((sum, l) => sum + l.qty - l.received, 0);
    if (qty !== st.onOrder)
      fail("stock-reconciles-with-pos", `${st.productId}: onOrder ${st.onOrder} ≠ open PO ${qty}`);
    const expected = open.map((l) => l.expected).sort()[0] ?? null;
    if (expected !== st.expectedAt)
      fail("stock-expected-date", `${st.productId}: ${st.expectedAt} ≠ ${expected}`);
    if (st.available !== st.onHand - st.allocated) fail("stock-available", st.productId);
    if (!productById.has(st.productId)) fail("stock-product", st.productId);
  }
  if (db.stock.length !== db.products.length)
    fail("stock-coverage", "every product needs a stock position");

  db.supplierProducts.forEach((sp) => {
    if (accountById.get(sp.supplierId)?.kind !== "supplier")
      fail("supplier-product-references-supplier", sp.id);
    if (sp.productId && productById.get(sp.productId)?.supplierId !== sp.supplierId)
      fail("supplier-product-catalogue-link", sp.id);
  });
  db.products.forEach((p) => {
    if (accountById.get(p.supplierId)?.kind !== "supplier") fail("product-supplier", p.id);
    for (const img of p.images)
      if (!existsSync(`public${img}`)) fail("product-image-exists", `${p.id} ${img}`);
  });
  db.offers.forEach((o) =>
    o.productIds.forEach(
      (pid) => productById.get(pid)?.supplierId !== o.supplierId && fail("offer-products", o.id),
    ),
  );
  db.knowledge.forEach((k) => {
    if (k.productIds.length === 0) fail("knowledge-references-products", k.id);
    for (const pid of k.productIds)
      if (!productById.has(pid)) fail("knowledge-references-products", `${k.id} → ${pid}`);
    if (!db.categories.some((c) => c.id === k.category)) fail("knowledge-category", k.id);
    if (k.type === "video" && !k.body) fail("knowledge-video-walkthrough", k.id);
  });
  db.jobs.forEach(
    (j) => soById.get(j.orderId)?.accountId !== j.accountId && fail("job-order-account", j.id),
  );
  db.cases.forEach((c) => {
    if (c.orderId && soById.get(c.orderId)?.accountId !== c.accountId)
      fail("case-order-account", c.id);
    if (c.jobId && db.jobs.find((j) => j.id === c.jobId)?.accountId !== c.accountId)
      fail("case-job-account", c.id);
    if (c.purchaseOrderId && poById.get(c.purchaseOrderId)?.supplierId !== c.accountId)
      fail("case-purchase-order-account", c.id);
    const invoice = c.invoiceId ? db.invoices.find((i) => i.id === c.invoiceId) : undefined;
    if (c.invoiceId && invoice?.accountId !== c.accountId) fail("case-invoice-account", c.id);
    // Customer Support and Supplier Support use their own kinds and links.
    const supplier = accountById.get(c.accountId)?.kind === "supplier";
    if (supplier !== s.SupplierCaseKind.safeParse(c.kind).success) fail("case-kind-audience", c.id);
    if (supplier && (c.orderId || c.jobId)) fail("case-supplier-links", c.id);
    if (!supplier && (c.purchaseOrderId || c.invoiceId)) fail("case-customer-links", c.id);
    if (
      c.productId &&
      supplier &&
      db.products.find((p) => p.id === c.productId)?.supplierId !== c.accountId
    )
      fail("case-supplier-product", c.id);
  });

  // Threads, messages, notifications and documents point at real records.
  const exists: Record<string, (id: string) => boolean> = {
    account: (id) => accountById.has(id),
    product: (id) => productById.has(id),
    configuration: (id) => db.configurations.some((x) => x.id === id),
    quote: (id) => db.quotes.some((x) => x.id === id),
    rfq: (id) => db.rfqs.some((x) => x.id === id),
    "sales-order": (id) => soById.has(id),
    "purchase-order": (id) => poById.has(id),
    delivery: (id) => db.deliveries.some((x) => x.id === id),
    invoice: (id) => db.invoices.some((x) => x.id === id),
    payment: (id) => db.payments.some((x) => x.id === id),
    "payment-run": (id) => db.paymentRuns.some((x) => x.id === id),
    job: (id) => db.jobs.some((x) => x.id === id),
    case: (id) => db.cases.some((x) => x.id === id),
    "knowledge-item": (id) => db.knowledge.some((x) => x.id === id),
    "supplier-product": (id) => db.supplierProducts.some((x) => x.id === id),
    offer: (id) => db.offers.some((x) => x.id === id),
    document: (id) => db.documents.some((x) => x.id === id),
    thread: (id) => db.threads.some((x) => x.id === id),
  };
  const threadById = new Map(db.threads.map((t) => [t.id, t]));
  for (const t of db.threads) {
    if (t.relatedType && (!t.relatedId || !exists[t.relatedType]!(t.relatedId)))
      fail("thread-related-record", t.id);
    const msgs = db.messages.filter((m) => m.threadId === t.id);
    if (msgs.length === 0) fail("thread-has-messages", t.id);
    if (
      msgs.length &&
      msgs
        .map((m) => m.sentAt)
        .sort()
        .at(-1) !== t.lastMessageAt
    )
      fail("thread-last-message", t.id);
  }
  for (const m of db.messages) {
    const t = threadById.get(m.threadId);
    if (!t) fail("message-thread", m.id);
    else if (!t.participants.some((p) => p.id === m.senderId && p.side === m.senderSide))
      fail("message-sender", m.id);
    if (new Date(m.sentAt).getTime() > nowMs) fail("dates-not-future", `message ${m.id}`);
    if (/\{\{|\}\}/.test(m.body)) fail("message-placeholders", m.id);
    for (const docId of m.attachments) {
      const doc = db.documents.find((d) => d.id === docId);
      if (!doc || (t && doc.ownerAccountId !== null && doc.ownerAccountId !== t.accountId))
        fail("message-attachment-document", `${m.id} → ${docId}`);
    }
    if (
      MENTIONS_ATTACHMENT.test(m.body) &&
      m.attachments.length === 0 &&
      m.senderSide === "brewfitt"
    )
      fail("message-attachment-mentioned", m.id);
  }
  for (const [kind, list] of [
    ["quote", db.quotes],
    ["sales-order", db.salesOrders],
    ["purchase-order", db.purchaseOrders],
    ["case", db.cases],
    ["rfq", db.rfqs],
    ["supplier-product", db.supplierProducts],
  ] as const) {
    for (const r of list as { id: string; threadId: string }[])
      if (threadById.get(r.threadId)?.relatedId !== r.id)
        fail("record-has-thread", `${kind} ${r.id}`);
  }
  for (const n of db.notifications)
    if (!exists[n.relatedType]!(n.relatedId)) fail("notification-related-record", n.id);
  for (const d of db.documents)
    if (d.relatedType && (!d.relatedId || !exists[d.relatedType]!(d.relatedId)))
      fail("document-related-record", d.id);
  for (const [label, id] of [
    ...db.quotes.map((q) => ["quote pdf", q.pdfDocumentId] as const),
    ...db.invoices.map((i) => ["invoice pdf", i.pdfDocumentId] as const),
    ...db.deliveries.flatMap((d) => [
      ["delivery note", d.noteDocumentId] as const,
      ["proof of delivery", d.proofDocumentId] as const,
    ]),
    ...db.products.map((p) => ["spec sheet", p.specSheetDocumentId] as const),
  ]) {
    if (id && !exists.document!(id)) fail("document-exists", `${label} ${id}`);
  }
  if (
    !db.documents.some(
      (d) =>
        d.category === "insurance" &&
        d.expiresAt &&
        daysBetween(today, d.expiresAt) >= 0 &&
        daysBetween(today, d.expiresAt) <= 30,
    )
  )
    fail("expiring-insurance", "no insurance certificate expiring within 30 days");

  // Addresses: valid postcode formats and coordinates.
  const UK_POSTCODE = /^[A-Z]{1,2}\d[A-Z\d]? \d[A-Z]{2}$/;
  for (const a of db.addresses) {
    if (a.country === "GB" && (!a.postcode || !UK_POSTCODE.test(a.postcode)))
      fail("valid-postcode", `${a.id} ${a.postcode}`);
    if (
      a.country === "GB" &&
      (a.latitude < 49.8 || a.latitude > 60.9 || a.longitude < -8.7 || a.longitude > 1.8)
    )
      fail("valid-coordinates", a.id);
  }

  // Dates on created records are not in the future.
  for (const [label, list] of [
    ["quote", db.quotes],
    ["sales order", db.salesOrders],
    ["purchase order", db.purchaseOrders],
    ["case", db.cases],
    ["rfq", db.rfqs],
  ] as const) {
    for (const r of list as { id: string; createdAt: string }[])
      if (new Date(r.createdAt).getTime() > nowMs) fail("dates-not-future", `${label} ${r.id}`);
  }

  // Configurations validate and their BOM matches the rules.
  for (const c of db.configurations) {
    const state = {
      venueType: c.venueType,
      siteAddressId: c.siteAddressId,
      selections: c.selections,
    };
    const errors = validateConfiguration(state, db.configuratorRules);
    if (Object.keys(errors).length)
      fail("configuration-valid", `${c.id} ${JSON.stringify(errors)}`);
    const list = listOf(c.accountId);
    const bom = buildBillOfMaterials(
      state,
      db.configuratorRules,
      (pid) =>
        db.priceListLines.find((l) => l.priceListId === list && l.productId === pid)?.price ?? null,
    );
    if (bom.total.amount !== c.total.amount || bom.lines.length !== c.lines.length)
      fail("configuration-bom", c.id);
  }

  // ---- 4. AI insights correspond to real conditions ----------------------------
  const invoicesNow = db.invoices.map((i) => deriveInvoice(i, today));
  const inputs: InsightInputs = {
    today,
    accounts: db.accounts,
    products: db.products,
    priceListLines: db.priceListLines,
    stock: db.stock,
    salesOrders: db.salesOrders,
    purchaseOrders: db.purchaseOrders,
    quotes: db.quotes,
    threads: db.threads,
    messages: db.messages,
    invoices: invoicesNow,
    seasonality: db.seasonality,
  };
  const insights = db.accounts.flatMap((a) =>
    a.kind === "supplier"
      ? supplierInsights(a.id, inputs)
      : a.isGroup
        ? []
        : customerInsights(a.id, inputs),
  );
  const stockBy = new Map(db.stock.map((x) => [x.productId, x]));
  for (const i of insights) {
    if (!i.simulated) fail("insight-simulated", i.id);
    const orders = db.salesOrders.filter(
      (o) => o.accountId === i.accountId && o.status !== "cancelled",
    );
    switch (i.category) {
      case "reorder-due": {
        const dates = [
          ...new Set(
            orders
              .filter((o) => o.lines.some((l) => l.productId === i.relatedId))
              .map((o) => o.createdAt),
          ),
        ].sort();
        const gaps = dates.slice(1).map((d, k) => daysBetween(dates[k]!, d));
        const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length;
        const since = daysBetween(dates.at(-1)!, today);
        if (!(
          dates.length >= RULES.minOrdersForInterval && since > RULES.reorderDueFactor * avg - 1
        ))
          fail("insight-condition:reorder-due", `${i.id}: since ${since}, avg ${avg.toFixed(1)}`);
        break;
      }
      case "stock-out-risk": {
        const st = stockBy.get(i.relatedId)!;
        if (!(st.onHand < st.minimumLevel)) fail("insight-condition:stock-out-risk", i.id);
        const account = accountById.get(i.accountId)!;
        if (
          account.kind === "customer" &&
          !orders.some(
            (o) =>
              daysBetween(o.createdAt, today) <= 365 &&
              o.lines.some((l) => l.productId === i.relatedId),
          )
        )
          fail("insight-condition:stock-out-risk", `${i.id} not bought in 12 months`);
        if (account.kind === "supplier" && productById.get(i.relatedId)?.supplierId !== i.accountId)
          fail("insight-condition:stock-out-risk", `${i.id} not the supplier's product`);
        break;
      }
      case "product-suggestion": {
        const account = accountById.get(i.accountId)!;
        const peers = db.accounts.filter(
          (a) =>
            a.kind === "customer" &&
            !a.isGroup &&
            a.sector === account.sector &&
            a.id !== account.id,
        );
        const buyers = new Set(
          db.salesOrders
            .filter(
              (o) =>
                o.status !== "cancelled" &&
                peers.some((p) => p.id === o.accountId) &&
                o.lines.some((l) => l.productId === i.relatedId),
            )
            .map((o) => o.accountId),
        );
        if (buyers.size / peers.length < RULES.suggestionSectorShare)
          fail(
            "insight-condition:product-suggestion",
            `${i.id} share ${buyers.size}/${peers.length}`,
          );
        if (orders.some((o) => o.lines.some((l) => l.productId === i.relatedId)))
          fail("insight-condition:product-suggestion", `${i.id} already bought`);
        if (!onList.has(`${listOf(i.accountId)}|${i.relatedId}`))
          fail("insight-condition:product-suggestion", `${i.id} not on price list`);
        break;
      }
      case "quote-follow-up": {
        const q = db.quotes.find((x) => x.id === i.relatedId)!;
        const left = daysBetween(today, q.validUntil);
        const lastMsg = db.messages
          .filter((m) => m.threadId === q.threadId)
          .map((m) => m.sentAt)
          .sort()
          .at(-1);
        const recent = [lastMsg, q.lastViewedAt]
          .filter((d): d is string => !!d)
          .some((d) => daysBetween(d, today) <= RULES.quoteQuietDays);
        if (q.status !== "sent" || left < 0 || left > 7 || recent)
          fail("insight-condition:quote-follow-up", i.id);
        break;
      }
      case "invoice-ageing": {
        const inv = invoicesNow.find((x) => x.id === i.relatedId)!;
        if (
          inv.outstanding.amount <= 0 ||
          daysBetween(today, inv.dueAt) > RULES.invoiceDueWindowDays
        )
          fail("insight-condition:invoice-ageing", i.id);
        break;
      }
      case "demand-forecast": {
        if (!supplierForecast(i.accountId, inputs).some((f) => f.productId === i.relatedId))
          fail("insight-condition:demand-forecast", i.id);
        break;
      }
    }
  }
  for (const n of db.notifications.filter(
    (x) => x.kind === "product-suggestion" || x.kind === "stock-out-risk",
  )) {
    if (
      !insights.some(
        (i) => i.accountId === n.accountId && i.relatedId === n.relatedId && i.category === n.kind,
      )
    )
      fail("notification-insight-exists", n.id);
  }

  // Demo coverage: the personas have something to show.
  const byCategory = (accountIds: string[], category: string) =>
    insights.filter((i) => accountIds.includes(i.accountId) && i.category === category).length;
  const millraceSites = db.accounts
    .filter((a) => a.parentAccountId === "acc_millrace")
    .map((a) => a.id);
  for (const [label, ids, cats] of [
    [
      "customer personas",
      ["acc_harbourside", "acc_pennine", "acc_crown", "acc_saltember", ...millraceSites],
      ["reorder-due", "stock-out-risk", "product-suggestion", "quote-follow-up", "invoice-ageing"],
    ],
    ["supplier persona", ["sup_vireo"], ["stock-out-risk", "demand-forecast"]],
  ] as const) {
    for (const c of cats)
      if (byCategory([...ids], c) === 0) fail("demo-insight-coverage", `${label}: no ${c}`);
  }
  if (
    !db.contacts.some(
      (c) => c.id === DEFAULT_PERSONA.contactId && c.accountId === DEFAULT_PERSONA.accountId,
    )
  )
    fail("default-persona", "contact does not belong to account");
  if (!db.accounts.some((a) => a.kind === "customer" && !a.onAccount && !a.parentAccountId))
    fail("non-account-customer", "none (decision 4)");
  if (
    !db.salesOrders.some(
      (o) => o.status === "part-delivered" && o.lines.some((l) => l.backordered > 0),
    )
  )
    fail("demo-coverage", "no back-orders");
  if (!db.changeRequests.some((c) => c.status === "pending"))
    fail("demo-coverage", "no pending change requests");

  const stats = {
    insights: insights.length,
    reorderDue: insights.filter((i) => i.category === "reorder-due").length,
    stockOut: insights.filter((i) => i.category === "stock-out-risk").length,
    suggestions: insights.filter((i) => i.category === "product-suggestion").length,
    quoteFollowUp: insights.filter((i) => i.category === "quote-follow-up").length,
    invoiceAgeing: insights.filter((i) => i.category === "invoice-ageing").length,
    forecast: insights.filter((i) => i.category === "demand-forecast").length,
  };
  return { failures, stats };
}

// ---- Run ------------------------------------------------------------------------
const offsets = [0, 15, 45, 90, 120, 180, 250, 330];
let total = 0;
for (const offset of offsets) {
  const day = addDays(clockToday(), offset);
  const db = generateDb(day);
  const { failures, stats } = check(db, day);
  total += failures.length;
  const label = `today${offset ? ` + ${offset} days` : ""} (${day.toISOString().slice(0, 10)})`;
  if (failures.length === 0) {
    console.log(`✓ ${label}: all checks passed`, stats);
  } else {
    console.log(`✗ ${label}: ${failures.length} failures`, stats);
    const byRule = new Map<string, string[]>();
    for (const f of failures) byRule.set(f.rule, [...(byRule.get(f.rule) ?? []), f.detail]);
    for (const [rule, details] of byRule)
      console.log(`  - ${rule} (${details.length}): ${details.slice(0, 3).join(" | ")}`);
  }
}
process.exit(total === 0 ? 0 : 1);

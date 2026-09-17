import * as s from "@/schemas";
import type { PortalApi } from "@/lib/api/contract";
import type { AIInsight, Case, Document, KnowledgeItem, Offer, PersonaOption, SupplierProduct } from "@/types";
import { answerQuestion } from "@/lib/ai/assistant";
import { customerInsights, sortInsights, supplierInsights } from "@/lib/ai/rules";
import { commit, getDb, latency, newId, nextNumber, resetDb, type MockDb } from "../db";
import { insert, patch } from "../mutations";
import type { Scope } from "../scope";
import {
  account,
  badRequest,
  inScope,
  insightInputs,
  invoiceNow,
  notFound,
  nowIso,
  openThreadChanges,
  orderingAccountIds,
  postChanges,
  priceListIdFor,
  quoteNow,
  requireCustomer,
  requireSupplier,
  respond,
} from "./helpers";

// ---------------------------------------------------------------------------
// Jobs and cases
// ---------------------------------------------------------------------------

export const jobs: PortalApi["jobs"] = {
  list: () =>
    respond((db, scope) => {
      requireCustomer(scope);
      return db.jobs.filter((j) => inScope(scope, j.accountId)).sort((a, b) => b.scheduledDate.localeCompare(a.scheduledDate));
    }),
  get: (id) => respond((db, scope) => db.jobs.find((j) => j.id === id && inScope(scope, j.accountId)) ?? notFound("Job")),
};

export const cases: PortalApi["cases"] = {
  list: () =>
    respond((db, scope) => {
      requireCustomer(scope);
      return db.cases.filter((c) => inScope(scope, c.accountId)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    }),
  get: (id) => respond((db, scope) => db.cases.find((c) => c.id === id && inScope(scope, c.accountId)) ?? notFound("Case")),
  create: (input) =>
    respond((db, scope) => {
      requireCustomer(scope);
      const data = s.CaseInput.parse(input);
      const accountId = scope.viewAccount.id;
      if (data.orderId && !db.salesOrders.some((o) => o.id === data.orderId && inScope(scope, o.accountId))) notFound("Order");
      if (data.jobId && !db.jobs.some((j) => j.id === data.jobId && inScope(scope, j.accountId))) notFound("Job");
      if (data.productId && !db.products.some((p) => p.id === data.productId)) notFound("Product");
      const at = nowIso();
      const c: Case = { ...data, id: newId("case"), accountId, number: nextNumber("CS-", db.cases), status: "open", engineerNotes: [], resolution: null, threadId: "", createdAt: at, updatedAt: at };
      const opened = openThreadChanges(db, scope, { accountId, subject: `Case ${c.number}: ${c.subject}`, relatedType: "case", relatedId: c.id, brewfittRole: "technical-manager", first: { side: "account", channel: "portal", body: c.description, at } });
      c.threadId = opened.thread.id;
      commit("cases.create", [insert("cases", c), ...opened.changes]);
      return c;
    }),
  update: (id, input) =>
    respond((db, scope) => {
      const data = s.CasePatch.parse(input);
      const current = db.cases.find((c) => c.id === id && inScope(scope, c.accountId)) ?? notFound("Case");
      if (current.status === "closed") badRequest(`Case ${current.number} is already closed.`);
      const at = nowIso();
      const changes = [patch("cases", id, { ...data, updatedAt: at })];
      if (data.status === "closed") changes.push(...postChanges(db, scope, current.threadId, `Closing case ${current.number}; the issue is resolved for us.`, at).changes);
      commit("cases.update", changes);
      return db.cases.find((c) => c.id === id)!;
    }),
};

// ---------------------------------------------------------------------------
// Knowledge, supplier products and offers, documents
// ---------------------------------------------------------------------------

const knowledgeVisible = (scope: Scope, k: KnowledgeItem) => k.status === "approved" || (scope.isSupplier && k.submittedByAccountId === scope.account.id);

export const knowledge: PortalApi["knowledge"] = {
  list: () => respond((db, scope) => db.knowledge.filter((k) => knowledgeVisible(scope, k)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))),
  get: (id) => respond((db, scope) => db.knowledge.find((k) => k.id === id && knowledgeVisible(scope, k)) ?? notFound("Article")),
  submit: (input) =>
    respond((db, scope) => {
      requireSupplier(scope);
      const data = s.KnowledgeSubmissionInput.parse(input);
      if (!db.categories.some((c) => c.id === data.category)) notFound("Category");
      if (data.productIds.some((pid) => !db.products.some((p) => p.id === pid))) notFound("Product");
      const at = nowIso();
      const item: KnowledgeItem = {
        id: newId("kb"),
        title: data.title,
        type: data.type,
        category: data.category,
        productIds: data.productIds,
        summary: data.summary,
        body: null,
        documentId: null,
        videoUrl: data.videoUrl,
        source: "supplier",
        submittedByAccountId: scope.account.id,
        status: "submitted",
        reviewNote: null,
        updatedAt: at,
      };
      const changes = [insert("knowledge", item)];
      if (data.fileName) {
        const doc: Document = { id: newId("doc"), name: data.fileName, category: data.type === "spec" ? "spec" : "manual", relatedType: "knowledge-item", relatedId: item.id, ownerAccountId: scope.account.id, fileType: "pdf", fileSize: 480_000, expiresAt: null, approvalStatus: "pending", modifiedAt: at };
        item.documentId = doc.id;
        changes.push(insert("documents", doc));
      }
      commit("knowledge.submit", changes);
      return item;
    }),
};

export const supplierProducts: PortalApi["supplierProducts"] = {
  list: () =>
    respond((db, scope) => {
      requireSupplier(scope);
      return db.supplierProducts.filter((p) => p.supplierId === scope.account.id).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    }),
  create: (input) =>
    respond((db, scope) => {
      requireSupplier(scope);
      const data = s.SupplierProductInput.parse(input);
      const at = nowIso();
      const product: SupplierProduct = {
        id: newId("sp"),
        supplierId: scope.account.id,
        name: data.name,
        sku: data.sku,
        category: data.category,
        images: data.images,
        brandingAssets: data.brandingAssets,
        specSheetDocumentId: null,
        costPrice: data.costPrice,
        leadTimeDays: data.leadTimeDays,
        minimumOrder: data.minimumOrder,
        status: "submitted",
        reviewNote: null,
        productId: null,
        threadId: "",
        submittedAt: at,
        updatedAt: at,
      };
      const opened = openThreadChanges(db, scope, { accountId: scope.account.id, subject: `Product submission: ${data.name}`, relatedType: "supplier-product", relatedId: product.id, brewfittRole: "buyer", first: { side: "account", channel: "portal", body: `Submitted ${data.name} for review.`, at } });
      product.threadId = opened.thread.id;
      const changes = [insert("supplierProducts", product), ...opened.changes];
      if (data.specSheetFileName) {
        const doc: Document = { id: newId("doc"), name: data.specSheetFileName, category: "spec", relatedType: "supplier-product", relatedId: product.id, ownerAccountId: scope.account.id, fileType: "pdf", fileSize: 350_000, expiresAt: null, approvalStatus: "pending", modifiedAt: at };
        product.specSheetDocumentId = doc.id;
        changes.push(insert("documents", doc));
      }
      commit("supplierProducts.create", changes);
      return product;
    }),
  update: (id, input) =>
    respond((db, scope) => {
      requireSupplier(scope);
      const current = db.supplierProducts.find((p) => p.id === id && p.supplierId === scope.account.id) ?? notFound("Product submission");
      if (current.status === "approved" || current.status === "under-review") badRequest(`${current.name} is ${current.status.replace("-", " ")} and cannot be edited now.`);
      const { specSheetFileName, ...data } = s.SupplierProductPatch.parse(input);
      const at = nowIso();
      const changes = [patch("supplierProducts", id, { ...data, status: "submitted", reviewNote: null, updatedAt: at })];
      if (specSheetFileName) {
        const doc: Document = { id: newId("doc"), name: specSheetFileName, category: "spec", relatedType: "supplier-product", relatedId: id, ownerAccountId: scope.account.id, fileType: "pdf", fileSize: 350_000, expiresAt: null, approvalStatus: "pending", modifiedAt: at };
        changes.push(insert("documents", doc), patch("supplierProducts", id, { specSheetDocumentId: doc.id }));
      }
      changes.push(...postChanges(db, scope, current.threadId, `Resubmitted ${data.name ?? current.name} with updates.`, at).changes);
      commit("supplierProducts.update", changes);
      return db.supplierProducts.find((p) => p.id === id)!;
    }),
  offers: () =>
    respond((db, scope) => {
      requireSupplier(scope);
      return db.offers.filter((o) => o.supplierId === scope.account.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }),
  createOffer: (input) =>
    respond((db, scope) => {
      requireSupplier(scope);
      const data = s.OfferInput.parse(input);
      if (data.productIds.some((pid) => db.products.find((p) => p.id === pid)?.supplierId !== scope.account.id)) badRequest("Offers can only include products you supply to Brewfitt.");
      const offer: Offer = { ...data, id: newId("off"), supplierId: scope.account.id, status: "submitted", createdAt: nowIso() };
      commit("supplierProducts.createOffer", [insert("offers", offer)]);
      return offer;
    }),
};

/** Brewfitt's own documents and published spec sheets and manuals are visible to everyone. */
const PUBLIC_CATEGORIES = new Set<Document["category"]>(["company", "insurance", "spec", "manual"]);

function documentVisible(db: MockDb, scope: Scope, d: Document): boolean {
  if (d.ownerAccountId) return inScope(scope, d.ownerAccountId);
  if (!PUBLIC_CATEGORIES.has(d.category)) return false;
  if (d.relatedType === "knowledge-item") return db.knowledge.some((k) => k.id === d.relatedId && knowledgeVisible(scope, k));
  return d.approvalStatus !== "pending" && d.approvalStatus !== "rejected";
}

export const documents: PortalApi["documents"] = {
  list: () => respond((db, scope) => db.documents.filter((d) => documentVisible(db, scope, d)).sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt))),
  get: (id) => respond((db, scope) => db.documents.find((d) => d.id === id && documentVisible(db, scope, d)) ?? notFound("Document")),
};

// ---------------------------------------------------------------------------
// Messages and notifications
// ---------------------------------------------------------------------------

export const messages: PortalApi["messages"] = {
  threads: () => respond((db, scope) => db.threads.filter((t) => inScope(scope, t.accountId)).sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt))),
  thread: (id) =>
    respond((db, scope) => {
      const thread = db.threads.find((t) => t.id === id && inScope(scope, t.accountId)) ?? notFound("Conversation");
      if (thread.unreadCount > 0) commit("messages.read", [patch("threads", id, { unreadCount: 0 })]);
      return { ...db.threads.find((t) => t.id === id)!, messages: db.messages.filter((m) => m.threadId === id).sort((a, b) => a.sentAt.localeCompare(b.sentAt)) };
    }),
  send: (threadId, input) =>
    respond((db, scope) => {
      const data = s.NewMessageInput.parse(input);
      if (!db.threads.some((t) => t.id === threadId && inScope(scope, t.accountId))) notFound("Conversation");
      const { message, changes } = postChanges(db, scope, threadId, data.body, nowIso(), data.attachments);
      commit("messages.send", changes);
      return message;
    }),
  createThread: (input) =>
    respond((db, scope) => {
      const data = s.NewThreadInput.parse(input);
      const at = nowIso();
      const opened = openThreadChanges(db, scope, {
        accountId: scope.viewAccount.id,
        subject: data.subject,
        relatedType: data.relatedType,
        relatedId: data.relatedId,
        brewfittRole: scope.isSupplier ? "buyer" : "account-manager",
        first: { side: "account", channel: "portal", body: data.body, at },
      });
      commit("messages.createThread", opened.changes);
      return { ...opened.thread, messages: db.messages.filter((m) => m.threadId === opened.thread.id) };
    }),
};

export const notifications: PortalApi["notifications"] = {
  list: () =>
    respond((db, scope) => db.notifications.filter((n) => inScope(scope, n.accountId) && !n.dismissed && Date.parse(n.createdAt) <= Date.now()).sort((a, b) => b.createdAt.localeCompare(a.createdAt))),
  update: (id, input) =>
    respond((db, scope) => {
      const data = s.NotificationPatch.parse(input);
      if (!db.notifications.some((n) => n.id === id && inScope(scope, n.accountId))) notFound("Notification");
      commit("notifications.update", [patch("notifications", id, data)]);
      return db.notifications.find((n) => n.id === id)!;
    }),
};

// ---------------------------------------------------------------------------
// AI
// ---------------------------------------------------------------------------

/** At most this many product suggestions per account, strongest share first. */
const MAX_SUGGESTIONS = 3;

function scopedInsights(db: MockDb, scope: Scope): AIInsight[] {
  const inputs = insightInputs(db);
  const all = scope.isSupplier
    ? supplierInsights(scope.account.id, inputs)
    : orderingAccountIds(db, scope).flatMap((id) => {
        const list = customerInsights(id, inputs);
        const share = (i: AIInsight) => Number(i.whatIsHappening.match(/^(\d+)%/)?.[1] ?? 0);
        const suggestions = list.filter((i) => i.category === "product-suggestion").sort((a, b) => share(b) - share(a)).slice(0, MAX_SUGGESTIONS);
        return [...list.filter((i) => i.category !== "product-suggestion"), ...suggestions];
      });
  return sortInsights(all.filter((i) => !db.dismissedInsightIds.includes(i.id)));
}

export const ai: PortalApi["ai"] = {
  insights: () => respond((db, scope) => scopedInsights(db, scope)),
  productInsight: (productId) => respond((db, scope) => scopedInsights(db, scope).find((i) => i.relatedType === "product" && i.relatedId === productId) ?? null),
  ask: (input) =>
    respond((db, scope) => {
      const { question } = s.AskRequest.parse(input);
      const own = (accountId: string) => inScope(scope, accountId);
      const participantName = (id: string) => db.contacts.find((c) => c.id === id)?.name ?? db.team.find((t) => t.id === id)?.name ?? "Brewfitt";
      if (scope.isSupplier) {
        // Suppliers ask about purchase orders and their products; reuse the order template over POs.
        return answerQuestion(question, {
          today: new Date(),
          products: db.products.filter((p) => p.supplierId === scope.account.id),
          quotes: [],
          salesOrders: [],
          purchaseOrders: db.purchaseOrders.filter((p) => p.supplierId === scope.account.id),
          deliveries: [],
          jobs: [],
          cases: [],
          invoices: [],
          threads: db.threads.filter((t) => own(t.accountId)),
          messages: db.messages,
          stock: db.stock,
          participantName,
        });
      }
      const listId = priceListIdFor(db, scope.viewAccount.id);
      const listed = new Set(db.priceListLines.filter((l) => l.priceListId === listId).map((l) => l.productId));
      const orders = db.salesOrders.filter((o) => own(o.accountId));
      const orderIds = new Set(orders.map((o) => o.id));
      const threads = db.threads.filter((t) => own(t.accountId));
      const threadIds = new Set(threads.map((t) => t.id));
      return answerQuestion(question, {
        today: new Date(),
        products: db.products.filter((p) => listed.has(p.id)),
        quotes: db.quotes.filter((q) => own(q.accountId)).map(quoteNow),
        salesOrders: orders,
        purchaseOrders: [],
        deliveries: db.deliveries.filter((d) => d.orderType === "sales" && orderIds.has(d.orderId)),
        jobs: db.jobs.filter((j) => own(j.accountId)),
        cases: db.cases.filter((c) => own(c.accountId)),
        invoices: db.invoices.filter((i) => own(i.accountId)).map(invoiceNow),
        threads,
        messages: db.messages.filter((m) => threadIds.has(m.threadId)),
        stock: db.stock,
        participantName,
      });
    }),
};

// ---------------------------------------------------------------------------
// Phase 1 demo controls
// ---------------------------------------------------------------------------

const PERSONA_CHOICES: { kind: PersonaOption["persona"]["kind"]; accountId: string; contactName: string; description: string }[] = [
  { kind: "customer", accountId: "acc_harbourside", contactName: "Olivia Bennett", description: "Brand owner on account, running a Premium Lager font rollout" },
  { kind: "customer", accountId: "acc_pennine", contactName: "Sarah Crowther", description: "Brewery on account with regular consumables and a tap room" },
  { kind: "customer", accountId: "acc_crown", contactName: "Kerry Flanagan", description: "Independent pub with no credit terms: pays by card" },
  { kind: "customer", accountId: "acc_saltember", contactName: "Lucy Carrington", description: "London restaurant on account" },
  { kind: "customer", accountId: "acc_liffey", contactName: "Siobhan Kelly", description: "Export hotel in Dublin, invoiced without VAT" },
  { kind: "site", accountId: "acc_millrace_weavers", contactName: "Jess Armitage", description: "Site manager at one Mill Race Inns pub; sees their own site" },
  { kind: "group", accountId: "acc_millrace", contactName: "Andrew Hirst", description: "Mill Race Inns group contact; sees all sites and can switch into one" },
  { kind: "supplier", accountId: "sup_vireo", contactName: "Neil Chapman", description: "Font and tap manufacturer supplying Brewfitt" },
];

export const demo: PortalApi["demo"] = {
  personas: async () => {
    await latency(80, 160);
    const db = getDb();
    return PERSONA_CHOICES.map((choice) => {
      const contact = db.contacts.find((c) => c.accountId === choice.accountId && c.name === choice.contactName) ?? notFound("Persona contact");
      const acc = account(db, choice.accountId);
      return {
        persona: { kind: choice.kind, contactId: contact.id, accountId: acc.id, activeSiteId: null },
        label: `${contact.name}, ${acc.name}`,
        description: choice.description,
      };
    });
  },
  reset: async () => {
    await latency(200, 400);
    resetDb();
  },
};


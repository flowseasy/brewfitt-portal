import type {
  Account,
  Category,
  Delivery,
  Document,
  Invoice,
  KnowledgeItem,
  Payment,
  Product,
  PurchaseOrder,
  Quote,
  SalesOrder,
  SupplierProduct,
} from "@/types";
import knowledgeRaw from "../data/knowledge.json";
import { addDays, isoDate, isoDateTime } from "../clock";
import type { SeedContext } from "./context";
import { SELF_BILLING_SUPPLIERS } from "./purchasing";

type KnowledgeRaw = {
  key: string;
  title: string;
  type: KnowledgeItem["type"];
  categoryName: string;
  productSlugs: string[];
  summary: string;
  body: string[] | null;
  videoMinutes: number | null;
  fileType: "pdf" | null;
  source: KnowledgeItem["source"];
  supplierId: string | null;
  status: KnowledgeItem["status"];
  reviewNote: string | null;
  ageDays: number;
};

export type ContentSeed = { knowledge: KnowledgeItem[]; documents: Document[] };

export function seedContent(
  ctx: SeedContext,
  records: {
    quotes: Quote[];
    salesOrders: SalesOrder[];
    purchaseOrders: PurchaseOrder[];
    deliveries: Delivery[];
    invoices: Invoice[];
    payments: Payment[];
    supplierProducts: SupplierProduct[];
    products: Product[];
    categories: Category[];
  },
): ContentSeed {
  const { rng, today } = ctx;
  const documents: Document[] = [];
  const pdfSize = (min = 60, max = 420) => rng.int(min, max) * 1024;
  const addDoc = (doc: Omit<Document, "id">, id?: string): Document => {
    const full = { ...doc, id: id ?? `doc_${documents.length + 1}` };
    documents.push(full);
    return full;
  };

  // ---- Transactional PDFs ---------------------------------------------------
  for (const q of records.quotes.filter((x) => x.status !== "draft")) {
    q.pdfDocumentId = addDoc({ name: `Quote ${q.number}.pdf`, category: "quote", relatedType: "quote", relatedId: q.id, ownerAccountId: q.accountId, fileType: "pdf", fileSize: pdfSize(), expiresAt: null, approvalStatus: null, modifiedAt: q.createdAt }).id;
  }
  for (const o of records.salesOrders.filter((x) => x.status !== "cancelled")) {
    addDoc({ name: `Order confirmation ${o.number}.pdf`, category: "order", relatedType: "sales-order", relatedId: o.id, ownerAccountId: o.accountId, fileType: "pdf", fileSize: pdfSize(50, 180), expiresAt: null, approvalStatus: null, modifiedAt: o.createdAt });
  }
  for (const po of records.purchaseOrders) {
    addDoc({ name: `Purchase order ${po.number}.pdf`, category: "order", relatedType: "purchase-order", relatedId: po.id, ownerAccountId: po.supplierId, fileType: "pdf", fileSize: pdfSize(50, 160), expiresAt: null, approvalStatus: null, modifiedAt: po.createdAt });
  }
  const orderOwner = new Map<string, string>([
    ...records.salesOrders.map((o) => [o.id, o.accountId] as const),
    ...records.purchaseOrders.map((p) => [p.id, p.supplierId] as const),
  ]);
  for (const d of records.deliveries) {
    const owner = orderOwner.get(d.orderId)!;
    if (d.dispatchedAt) {
      d.noteDocumentId = addDoc({ name: `Delivery note ${d.number}.pdf`, category: "delivery-note", relatedType: "delivery", relatedId: d.id, ownerAccountId: owner, fileType: "pdf", fileSize: pdfSize(40, 120), expiresAt: null, approvalStatus: null, modifiedAt: d.dispatchedAt }).id;
    }
    if (d.deliveredAt) {
      d.proofDocumentId = addDoc({ name: `Proof of delivery ${d.number}.jpg`, category: "proof-of-delivery", relatedType: "delivery", relatedId: d.id, ownerAccountId: owner, fileType: "jpg", fileSize: pdfSize(180, 900), expiresAt: null, approvalStatus: null, modifiedAt: d.deliveredAt }).id;
    }
  }
  for (const inv of records.invoices) {
    const label = inv.kind === "credit-note" ? "Credit note" : inv.kind === "self-bill" ? "Self-billed invoice" : "Invoice";
    inv.pdfDocumentId = addDoc({ name: `${label} ${inv.number}.pdf`, category: inv.kind === "credit-note" ? "credit-note" : "invoice", relatedType: "invoice", relatedId: inv.id, ownerAccountId: inv.accountId, fileType: "pdf", fileSize: pdfSize(45, 140), expiresAt: null, approvalStatus: null, modifiedAt: inv.issuedAt }).id;
  }
  for (const p of records.payments.filter((x) => ctx.account(x.accountId).kind === "supplier")) {
    p.remittanceDocumentId = addDoc({ name: `Remittance advice ${p.reference.replace("Payment run ", "")}.pdf`, category: "remittance", relatedType: "payment", relatedId: p.id, ownerAccountId: p.accountId, fileType: "pdf", fileSize: pdfSize(30, 90), expiresAt: null, approvalStatus: null, modifiedAt: p.paidAt }).id;
  }

  // ---- Brewfitt company documents -------------------------------------------
  const companyDocs: [string, Document["category"], number | null, number][] = [
    ["Brewfitt public and products liability insurance certificate.pdf", "insurance", 214, 150],
    ["Brewfitt employers' liability insurance certificate.pdf", "insurance", 214, 150],
    ["Brewfitt conditions of sale.pdf", "company", null, 260],
    ["Returns procedure for trade customers.pdf", "company", null, 180],
    ["Credit account application form.pdf", "company", null, 320],
    ["Supplier onboarding requirements.pdf", "company", null, 140],
  ];
  for (const [name, category, expiresInDays, ageDays] of companyDocs) {
    addDoc({ name, category, relatedType: null, relatedId: null, ownerAccountId: null, fileType: "pdf", fileSize: pdfSize(90, 600), expiresAt: expiresInDays ? isoDate(addDays(today, expiresInDays)) : null, approvalStatus: null, modifiedAt: isoDateTime(addDays(today, -ageDays), 10) });
  }

  // ---- Supplier compliance uploads -----------------------------------------
  const suppliers = ctx.accounts.filter((a) => a.kind === "supplier");
  suppliers.forEach((s: Account, i) => {
    // One certificate expiring within the month, one already expired, the rest current.
    const expiresIn = s.id === "sup_vireo" ? 18 : s.id === "sup_polarflex" ? -9 : rng.int(60, 330);
    addDoc({ name: `${s.name} public liability insurance certificate.pdf`, category: "insurance", relatedType: "account", relatedId: s.id, ownerAccountId: s.id, fileType: "pdf", fileSize: pdfSize(120, 500), expiresAt: isoDate(addDays(today, expiresIn)), approvalStatus: "approved", modifiedAt: isoDateTime(addDays(today, -(365 - Math.max(expiresIn, 0)) + rng.int(0, 20)), 11) });
    if (i % 3 === 0) {
      addDoc({ name: `${s.name} product liability insurance certificate.pdf`, category: "insurance", relatedType: "account", relatedId: s.id, ownerAccountId: s.id, fileType: "pdf", fileSize: pdfSize(120, 500), expiresAt: isoDate(addDays(today, rng.int(90, 360))), approvalStatus: i === 0 ? "pending" : "approved", modifiedAt: isoDateTime(addDays(today, -rng.int(2, 40)), 11) });
    }
    if (i % 4 === 1) {
      addDoc({ name: `${s.name} ISO 9001 certificate.pdf`, category: "compliance", relatedType: "account", relatedId: s.id, ownerAccountId: s.id, fileType: "pdf", fileSize: pdfSize(80, 300), expiresAt: isoDate(addDays(today, rng.int(120, 700))), approvalStatus: i === 1 ? "pending" : "approved", modifiedAt: isoDateTime(addDays(today, -rng.int(3, 200)), 11) });
    }
    addDoc({ name: `Supply agreement: ${s.name}.pdf`, category: "agreement", relatedType: "account", relatedId: s.id, ownerAccountId: s.id, fileType: "pdf", fileSize: pdfSize(150, 450), expiresAt: isoDate(addDays(today, rng.int(120, 900))), approvalStatus: "approved", modifiedAt: isoDateTime(addDays(today, -rng.int(200, 700)), 10) });
    if (SELF_BILLING_SUPPLIERS.has(s.id)) {
      addDoc({ name: `Self-billing agreement: ${s.name}.pdf`, category: "agreement", relatedType: "account", relatedId: s.id, ownerAccountId: s.id, fileType: "pdf", fileSize: pdfSize(80, 200), expiresAt: isoDate(addDays(today, rng.int(60, 400))), approvalStatus: "approved", modifiedAt: isoDateTime(addDays(today, -rng.int(100, 500)), 10) });
    }
  });

  // ---- Customer agreements --------------------------------------------------
  for (const a of ctx.accounts.filter((x) => x.kind === "customer" && !x.parentAccountId && x.onAccount)) {
    addDoc({ name: `Trading terms agreement: ${a.name}.pdf`, category: "agreement", relatedType: "account", relatedId: a.id, ownerAccountId: a.id, fileType: "pdf", fileSize: pdfSize(120, 300), expiresAt: null, approvalStatus: "approved", modifiedAt: a.createdAt });
    if (a.sector === "brand-owner" || a.sector === "brewery") {
      addDoc({ name: `Branded dispense equipment agreement: ${a.name}.pdf`, category: "agreement", relatedType: "account", relatedId: a.id, ownerAccountId: a.id, fileType: "pdf", fileSize: pdfSize(150, 380), expiresAt: isoDate(addDays(today, rng.int(90, 700))), approvalStatus: "approved", modifiedAt: isoDateTime(addDays(today, -rng.int(60, 400)), 10) });
    }
  }

  // ---- Spec sheets arriving through supplier submissions --------------------
  const productById = new Map(records.products.map((p) => [p.id, p]));
  for (const sp of records.supplierProducts) {
    if (sp.status === "submitted") continue;
    const doc = addDoc({ name: `${sp.name} spec sheet.pdf`, category: "spec", relatedType: "supplier-product", relatedId: sp.id, ownerAccountId: sp.supplierId, fileType: "pdf", fileSize: pdfSize(150, 900), expiresAt: null, approvalStatus: sp.status === "approved" ? "approved" : sp.status === "rejected" ? "rejected" : "pending", modifiedAt: sp.submittedAt });
    sp.specSheetDocumentId = doc.id;
    if (sp.status === "approved" && sp.productId) {
      // Approved spec sheets are published against the catalogue product for every customer.
      const product = productById.get(sp.productId)!;
      product.specSheetDocumentId = addDoc({ name: `${product.name} spec sheet.pdf`, category: "spec", relatedType: "product", relatedId: product.id, ownerAccountId: null, fileType: "pdf", fileSize: doc.fileSize, expiresAt: null, approvalStatus: "approved", modifiedAt: sp.updatedAt }).id;
    }
  }

  // ---- Knowledge centre -----------------------------------------------------
  const categoryFor = (name: string, productIds: string[]) => {
    const matches = records.categories.filter((c) => c.name === name);
    const byProduct = matches.find((c) => productIds.some((pid) => productById.get(pid)?.category === c.id || productById.get(pid)?.subcategory === c.id));
    const chosen = byProduct ?? matches[0];
    if (!chosen) throw new Error(`Knowledge category not found: ${name}`);
    return chosen.id;
  };
  const knowledge: KnowledgeItem[] = (knowledgeRaw as KnowledgeRaw[]).map((k, i) => {
    const productIds = k.productSlugs.map((s) => `prd_${s}`).filter((id) => productById.has(id));
    if (productIds.length === 0) throw new Error(`Knowledge item ${k.key} references no known products`);
    const updatedAt = isoDateTime(addDays(today, -k.ageDays), 10 + (i % 6));
    const id = `kb_${k.key}`;
    let documentId: string | null = null;
    if (k.fileType) {
      documentId = addDoc({
        name: `${k.title}.pdf`,
        category: k.type === "spec" ? "spec" : "manual",
        relatedType: "knowledge-item",
        relatedId: id,
        ownerAccountId: k.source === "supplier" ? k.supplierId : null,
        fileType: "pdf",
        fileSize: pdfSize(300, 4200),
        expiresAt: null,
        approvalStatus: k.status === "approved" ? "approved" : k.status === "rejected" ? "rejected" : "pending",
        modifiedAt: updatedAt,
      }).id;
    }
    return {
      id,
      title: k.title,
      type: k.type,
      category: categoryFor(k.categoryName, productIds),
      productIds,
      summary: k.summary,
      body: k.body,
      documentId,
      // Phase 1 has no video hosting; videos carry a written walkthrough.
      videoUrl: null,
      source: k.source,
      submittedByAccountId: k.source === "supplier" ? k.supplierId : null,
      status: k.status,
      reviewNote: k.reviewNote,
      updatedAt,
    };
  });

  return { knowledge, documents };
}

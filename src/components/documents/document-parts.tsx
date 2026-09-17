import type { Document } from "@/types";

export const DOCUMENT_CATEGORY: Record<Document["category"], string> = {
  quote: "Quote",
  order: "Order",
  "delivery-note": "Delivery note",
  "proof-of-delivery": "Proof of delivery",
  invoice: "Invoice",
  "credit-note": "Credit note",
  remittance: "Remittance advice",
  insurance: "Insurance certificate",
  compliance: "Compliance certificate",
  agreement: "Agreement",
  company: "Company document",
  spec: "Spec sheet",
  manual: "Manual",
};

export type DocumentGroup = "transactional" | "compliance" | "agreements" | "company" | "product";

export const DOCUMENT_GROUP: Record<DocumentGroup, string> = {
  transactional: "Quotes, orders and invoices",
  compliance: "Insurance and compliance",
  agreements: "Agreements",
  company: "Brewfitt company",
  product: "Product documents",
};

export function documentGroup(d: Document): DocumentGroup {
  if (!d.ownerAccountId && (d.category === "company" || d.category === "insurance"))
    return "company";
  if (d.category === "insurance" || d.category === "compliance") return "compliance";
  if (d.category === "agreement") return "agreements";
  if (d.category === "spec" || d.category === "manual") return "product";
  return "transactional";
}

/** Categories whose PDF preview lives on the related record's page. */
export const RECORD_PREVIEW = new Set<Document["category"]>([
  "quote",
  "order",
  "invoice",
  "credit-note",
]);

/** Expired, or expiring within 30 days. */
export function isExpiring(d: Document, daysFromToday: (iso: string) => number): boolean {
  return !!d.expiresAt && daysFromToday(d.expiresAt) <= 30;
}

/** A newer certificate of the same kind has been uploaded and is waiting for Brewfitt. */
export function hasPendingRenewal(d: Document, all: Document[]): boolean {
  return all.some(
    (x) =>
      x.id !== d.id &&
      x.ownerAccountId === d.ownerAccountId &&
      x.category === d.category &&
      x.approvalStatus === "pending" &&
      !!x.expiresAt &&
      !!d.expiresAt &&
      x.expiresAt > d.expiresAt,
  );
}

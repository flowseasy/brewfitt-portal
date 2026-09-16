import { z } from "zod";
import { ApprovalStatus, Id, IsoDate, IsoDateTime, Money, RelatedType } from "./common";

// ---------- Knowledge centre ----------

export const KnowledgeType = z.enum(["manual", "guide", "video", "faq", "spec"]);

export const SubmissionStatus = z.enum(["submitted", "under-review", "approved", "rejected"]);

export const KnowledgeItem = z.object({
  id: Id,
  title: z.string().min(1),
  type: KnowledgeType,
  /** Category id. */
  category: Id,
  productIds: z.array(Id).min(1),
  summary: z.string().min(1),
  /** Article body for guides and FAQs, as plain paragraphs. */
  body: z.array(z.string()).nullable(),
  documentId: Id.nullable(),
  videoUrl: z.string().nullable(),
  source: z.enum(["brewfitt", "supplier"]),
  submittedByAccountId: Id.nullable(),
  status: SubmissionStatus,
  reviewNote: z.string().nullable(),
  updatedAt: IsoDateTime,
});

export const KnowledgeSubmissionInput = z.object({
  title: z.string().min(3),
  type: KnowledgeType,
  category: Id,
  productIds: z.array(Id).min(1, "Tag at least one product"),
  summary: z.string().min(20),
  fileName: z.string().nullable(),
  videoUrl: z.url().nullable(),
});

// ---------- Documents ----------

export const DocumentCategory = z.enum([
  "quote",
  "order",
  "delivery-note",
  "proof-of-delivery",
  "invoice",
  "credit-note",
  "remittance",
  "insurance",
  "compliance",
  "agreement",
  "company",
  "spec",
  "manual",
]);

export const FileType = z.enum(["pdf", "jpg", "png", "docx", "xlsx", "mp4"]);

export const Document = z.object({
  id: Id,
  name: z.string().min(1),
  category: DocumentCategory,
  relatedType: RelatedType.nullable(),
  relatedId: Id.nullable(),
  /** Null for Brewfitt's own company documents. */
  ownerAccountId: Id.nullable(),
  fileType: FileType,
  /** Bytes. */
  fileSize: z.int().positive(),
  expiresAt: IsoDate.nullable(),
  approvalStatus: ApprovalStatus.nullable(),
  modifiedAt: IsoDateTime,
});

export const DocumentUploadInput = z.object({
  name: z.string().min(1),
  category: z.enum(["insurance", "compliance"]),
  fileType: FileType,
  fileSize: z.int().positive(),
  expiresAt: IsoDate,
});

// ---------- Supplier products and offers ----------

export const SupplierProduct = z.object({
  id: Id,
  supplierId: Id,
  name: z.string().min(1),
  sku: z.string().min(1),
  /** Category id. */
  category: Id,
  images: z.array(z.string()),
  brandingAssets: z.array(z.string()),
  specSheetDocumentId: Id.nullable(),
  costPrice: Money,
  leadTimeDays: z.int().nonnegative(),
  minimumOrder: z.int().positive(),
  status: SubmissionStatus,
  reviewNote: z.string().nullable(),
  /** The catalogue product once approved and live in TOTA360v5. */
  productId: Id.nullable(),
  threadId: Id,
  submittedAt: IsoDateTime,
  updatedAt: IsoDateTime,
});

export const SupplierProductInput = z.object({
  name: z.string().min(3),
  sku: z.string().min(2),
  category: Id,
  images: z.array(z.string()).min(1, "Add at least one product image"),
  brandingAssets: z.array(z.string()),
  specSheetFileName: z.string().nullable(),
  costPrice: Money,
  leadTimeDays: z.int().nonnegative(),
  minimumOrder: z.int().positive(),
});

export const SupplierProductPatch = SupplierProductInput.partial();

export const OfferStatus = z.enum(["submitted", "under-review", "approved", "rejected", "expired"]);

export const Offer = z.object({
  id: Id,
  supplierId: Id,
  productIds: z.array(Id).min(1),
  description: z.string().min(1),
  price: Money,
  validFrom: IsoDate,
  validTo: IsoDate,
  status: OfferStatus,
  createdAt: IsoDateTime,
});

export const OfferInput = z
  .object({
    productIds: z.array(Id).min(1, "Choose at least one product"),
    description: z.string().min(10),
    price: Money,
    validFrom: IsoDate,
    validTo: IsoDate,
  })
  .refine((o) => o.validTo >= o.validFrom, {
    message: "The offer must end after it starts",
    path: ["validTo"],
  });

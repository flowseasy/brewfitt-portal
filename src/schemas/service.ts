import { z } from "zod";
import { Id, IsoDate, IsoDateTime } from "./common";

export const JobStatus = z.enum(["scheduled", "in-progress", "completed", "signed-off"]);

export const Job = z.object({
  id: Id,
  accountId: Id,
  orderId: Id,
  siteAddressId: Id,
  name: z.string().min(1),
  engineerName: z.string().min(1),
  scheduledDate: IsoDate,
  status: JobStatus,
  completionPercent: z.int().min(0).max(100),
  signedOffAt: IsoDateTime.nullable(),
  warrantyStart: IsoDate.nullable(),
  warrantyEnd: IsoDate.nullable(),
});

export const CaseKind = z.enum(["fault", "warranty", "return", "query"]);
export const CaseUrgency = z.enum(["low", "normal", "high", "critical"]);
export const CaseStatus = z.enum(["open", "in-progress", "awaiting-parts", "resolved", "closed"]);

export const EngineerNote = z.object({
  author: z.string().min(1),
  note: z.string().min(1),
  at: IsoDateTime,
});

export const Case = z.object({
  id: Id,
  accountId: Id,
  number: z.string().min(1),
  productId: Id.nullable(),
  orderId: Id.nullable(),
  jobId: Id.nullable(),
  kind: CaseKind,
  urgency: CaseUrgency,
  status: CaseStatus,
  subject: z.string().min(1),
  description: z.string().min(1),
  /** Image paths. */
  photos: z.array(z.string()),
  engineerNotes: z.array(EngineerNote),
  resolution: z.string().nullable(),
  threadId: Id,
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
});

export const CaseInput = z
  .object({
    kind: CaseKind,
    urgency: CaseUrgency,
    subject: z.string().min(3, "Give the case a short subject"),
    description: z.string().min(20, "Describe the fault in a sentence or two so an engineer can triage it"),
    productId: Id.nullable(),
    orderId: Id.nullable(),
    jobId: Id.nullable(),
    photos: z.array(z.string()),
  })
  .refine((c) => c.productId || c.orderId || c.jobId, {
    message: "Link the case to a product, order or job",
    path: ["productId"],
  });

export const CasePatch = z.object({
  status: z.literal("closed").optional(),
  description: z.string().min(1).optional(),
});

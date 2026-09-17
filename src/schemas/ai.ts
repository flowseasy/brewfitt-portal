import { z } from "zod";
import { Confidence, Id, IsoDateTime, MoneyRange, RelatedType } from "./common";

export const InsightCategory = z.enum([
  "reorder-due",
  "stock-out-risk",
  "product-suggestion",
  "quote-follow-up",
  "invoice-ageing",
  "demand-forecast",
]);

export const InsightSeverity = z.enum(["info", "warning", "critical"]);

/** Computed by the deterministic rules in src/lib/ai; never seeded by hand. */
export const AIInsight = z.object({
  id: Id,
  accountId: Id,
  category: InsightCategory,
  severity: InsightSeverity,
  title: z.string().min(1),
  whatIsHappening: z.string().min(1),
  whyItMatters: z.string().min(1),
  valueAtStake: MoneyRange.nullable(),
  confidence: Confidence,
  recommendedAction: z.string().min(1),
  relatedType: RelatedType,
  relatedId: Id,
  createdAt: IsoDateTime,
  /** Always true in Phase 1; the UI labels these "Simulated insight". */
  simulated: z.literal(true),
});

export const AskRequest = z.object({
  question: z
    .string()
    .trim()
    .min(3, "Ask a question about your quotes, orders, deliveries or messages"),
});

export const AskSource = z.object({
  relatedType: RelatedType,
  relatedId: Id,
  label: z.string().min(1),
});

export const AskResponse = z.object({
  question: z.string(),
  answer: z.array(z.string()).min(1),
  sources: z.array(AskSource),
  simulated: z.literal(true),
});

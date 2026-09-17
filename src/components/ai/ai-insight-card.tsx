"use client";

import Link from "next/link";
import { SparkleIcon } from "@phosphor-icons/react";
import type { AIInsight } from "@/types";
import { formatMoneyRange } from "@/lib/format";
import { hrefFor } from "@/lib/links";
import { cn } from "@/lib/utils";
import { StatusPill, type Tone } from "@/components/shared/status-pill";

/** Every simulated AI output carries this label (BLUEPRINT.md, AI capabilities). */
export function SimulatedBadge({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full bg-brand-subtle px-2 py-0.5 text-[11px] font-medium text-brand-subtle-foreground", className)}>
      <SparkleIcon weight="fill" className="size-3" aria-hidden />
      Simulated insight
    </span>
  );
}

const SEVERITY_TONE: Record<AIInsight["severity"], Tone> = { info: "info", warning: "warning", critical: "danger" };
const CONFIDENCE: Record<AIInsight["confidence"], string> = { low: "Low confidence", medium: "Medium confidence", high: "High confidence" };

const ACTION_LABEL: Record<AIInsight["category"], string> = {
  "reorder-due": "Reorder",
  "stock-out-risk": "View product",
  "product-suggestion": "View product",
  "quote-follow-up": "Review quote",
  "invoice-ageing": "View invoice",
  "demand-forecast": "View forecast",
};

/** What is happening, why it matters, value at stake, confidence and recommended action. */
export function AIInsightCard({ insight, compact, supplier }: { insight: AIInsight; compact?: boolean; supplier?: boolean }) {
  const href = supplier && insight.relatedType === "product" ? "/stock" : hrefFor(insight.relatedType, insight.relatedId);
  return (
    <article className="rounded-xl border bg-surface-raised p-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <SimulatedBadge />
        <StatusPill tone={SEVERITY_TONE[insight.severity]} dot={false}>
          {CONFIDENCE[insight.confidence]}
        </StatusPill>
      </div>
      <h3 className="font-medium text-balance">{insight.title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{insight.whatIsHappening}</p>
      {!compact ? <p className="mt-1 text-sm text-muted-foreground">{insight.whyItMatters}</p> : null}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        {insight.valueAtStake ? (
          <p className="text-sm">
            <span className="text-muted-foreground">Value at stake </span>
            <span className="font-medium tabular-nums">{formatMoneyRange(insight.valueAtStake.low, insight.valueAtStake.high)}</span>
          </p>
        ) : (
          <span />
        )}
        <Link href={href} className="text-sm font-medium text-primary underline-offset-4 hover:underline">
          {ACTION_LABEL[insight.category]}
        </Link>
      </div>
      <p className="mt-2 border-t pt-2 text-sm">
        <span className="text-muted-foreground">Recommended: </span>
        {insight.recommendedAction}
      </p>
    </article>
  );
}

"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { SparkleIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/states";
import { useIsSupplier, usePersonaKey } from "@/features/session/use-session";
import { api, queryKeys } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useAssistantStore, type AssistantTab } from "@/stores/assistant-store";
import type { AIInsight } from "@/types";
import { AIInsightCard, SimulatedBadge } from "./ai-insight-card";
import { AssistantPrompt } from "./assistant-prompt";

const CATEGORY_LABEL: Record<AIInsight["category"], string> = {
  "reorder-due": "Reorder due",
  "stock-out-risk": "Stock-out risk",
  "product-suggestion": "Suggestions",
  "quote-follow-up": "Quote follow-up",
  "invoice-ageing": "Invoice ageing",
  "demand-forecast": "Demand forecast",
};

/** Header utility: opens the assistant from any screen. */
export function AssistantButton() {
  const openPanel = useAssistantStore((s) => s.openPanel);
  return (
    <Button variant="ghost" size="icon" className="rounded-full sm:w-auto sm:px-3" onClick={() => openPanel()} aria-label="Assistant and insights">
      <SparkleIcon weight="fill" className="size-5 text-primary" aria-hidden />
      <span className="hidden text-sm xl:inline">Assistant</span>
    </Button>
  );
}

/** Opens the assistant panel on the insights tab (for "all insights" links on dashboards). */
export function AllInsightsButton({ count, className }: { count?: number; className?: string }) {
  const openPanel = useAssistantStore((s) => s.openPanel);
  return (
    <Button variant="outline" size="sm" className={className} onClick={() => openPanel("insights")}>
      <SparkleIcon aria-hidden />
      {count ? `See all ${count} insights` : "See all insights"}
    </Button>
  );
}

export function AssistantPanel() {
  const { open, setOpen, tab, setTab } = useAssistantStore();
  const tabs: { value: AssistantTab; label: string }[] = [
    { value: "ask", label: "Ask" },
    { value: "insights", label: "Insights" },
  ];
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b pb-0">
          <SheetTitle className="flex items-center gap-2">
            <SparkleIcon weight="fill" className="size-5 text-primary" aria-hidden />
            Assistant
          </SheetTitle>
          <SheetDescription>Simulated insights and answers from your own records. Phase 1 uses fixed rules on demonstration data.</SheetDescription>
          <div role="tablist" aria-label="Assistant" className="-mb-px mt-2 flex gap-4">
            {tabs.map((t) => (
              <button
                key={t.value}
                role="tab"
                id={`assistant-tab-${t.value}`}
                aria-selected={tab === t.value}
                aria-controls={`assistant-panel-${t.value}`}
                tabIndex={tab === t.value ? 0 : -1}
                onClick={() => setTab(t.value)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                    const next = tab === "ask" ? "insights" : "ask";
                    setTab(next);
                    document.getElementById(`assistant-tab-${next}`)?.focus();
                  }
                }}
                className={cn("border-b-2 px-1 pb-2.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40", tab === t.value ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}
              >
                {t.label}
              </button>
            ))}
          </div>
        </SheetHeader>
        {tab === "ask" ? (
          <div role="tabpanel" id="assistant-panel-ask" aria-labelledby="assistant-tab-ask" className="flex min-h-0 flex-1 flex-col">
            <AssistantPrompt variant="panel" autoFocus />
          </div>
        ) : (
          <div role="tabpanel" id="assistant-panel-insights" aria-labelledby="assistant-tab-insights" className="min-h-0 flex-1 overflow-y-auto p-4">
            <InsightList />
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

/** Every simulated insight for the account, most severe first, filterable by category. */
export function InsightList() {
  const key = usePersonaKey();
  const supplier = useIsSupplier();
  const setOpen = useAssistantStore((s) => s.setOpen);
  const insights = useQuery({ queryKey: queryKeys.insights(key), queryFn: () => api.ai.insights() });
  const [category, setCategory] = useState<"all" | AIInsight["category"]>("all");

  if (insights.isPending) return <LoadingState rows={3} label="Loading insights" />;
  if (insights.isError) return <ErrorState error={insights.error} onRetry={() => insights.refetch()} />;

  const all = insights.data;
  const categories = [...new Set(all.map((i) => i.category))];
  const shown = category === "all" ? all : all.filter((i) => i.category === category);

  if (all.length === 0) {
    return <EmptyState icon={SparkleIcon} title="No insights right now" description={supplier ? "Insights appear when Brewfitt's stock of your items runs low or a purchase is likely." : "Insights appear when a regular item is due, stock is running low, a quote is about to expire or an invoice is due."} />;
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {shown.length} {shown.length === 1 ? "insight" : "insights"}
        </p>
        <SimulatedBadge />
      </div>
      {categories.length > 1 ? (
        <div className="mb-4 flex flex-wrap gap-1.5" role="group" aria-label="Filter by category">
          {(["all", ...categories] as const).map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={category === c}
              onClick={() => setCategory(c)}
              className={cn("rounded-full border px-2.5 py-1 text-xs transition", category === c ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground")}
            >
              {c === "all" ? "All" : `${CATEGORY_LABEL[c]} (${all.filter((i) => i.category === c).length})`}
            </button>
          ))}
        </div>
      ) : null}
      {/* Following an insight's action closes the panel so the record is visible. */}
      <ul className="space-y-3" onClickCapture={(e) => (e.target as HTMLElement).closest("a") && setOpen(false)}>
        {shown.map((i) => (
          <li key={i.id}>
            <AIInsightCard insight={i} supplier={supplier} />
          </li>
        ))}
      </ul>
    </div>
  );
}

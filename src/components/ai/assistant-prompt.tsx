"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpIcon, SparkleIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { useIsSupplier, usePersonaKey } from "@/features/session/use-session";
import { api, errorMessage, queryKeys } from "@/lib/api";
import { hrefFor } from "@/lib/links";
import type { AskResponse } from "@/types";
import { SimulatedBadge } from "./ai-insight-card";

/** Suggested questions drawn from the account's own active conversations. */
function useSuggestions(): string[] {
  const key = usePersonaKey();
  const supplier = useIsSupplier();
  const threads = useQuery({ queryKey: queryKeys.threads(key), queryFn: () => api.messages.threads() });
  const list = threads.data ?? [];
  // Project conversations make natural questions, e.g. "What's the latest on the Premium Lager font order?"
  const topical = list
    .filter((t) => t.relatedType === "sales-order" && /rollout|fit-out|refit|install/i.test(t.subject))
    .slice(0, 1)
    .map((t) => `What's the latest on the ${t.subject.replace(/\s*[-–]\s*SO-\d+$/, "").replace(/font rollout/i, "font order")}?`);
  const numbered = list
    .filter((t) => t.relatedType === (supplier ? "purchase-order" : "sales-order"))
    .slice(0, 1)
    .map((t) => `Where is ${t.subject.match(/(SO|PO)-\d+/)?.[0] ?? "my latest order"}?`);
  return [...topical, ...numbered, supplier ? "Cobra B 4 Out Chrome LED" : "Pipeline Purple cleaning powder"];
}

export function AssistantPrompt({ autoFocus }: { autoFocus?: boolean }) {
  const inputId = useId();
  const [question, setQuestion] = useState("");
  const suggestions = useSuggestions();
  const ask = useMutation({ mutationFn: (q: string) => api.ai.ask({ question: q }) });

  const submit = (q: string) => {
    const trimmed = q.trim();
    if (trimmed.length < 3) return;
    setQuestion(trimmed);
    ask.mutate(trimmed);
  };

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(question);
        }}
        className="relative"
      >
        <label htmlFor={inputId} className="sr-only">
          Ask about an order, quote or product
        </label>
        <SparkleIcon weight="fill" className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-primary" aria-hidden />
        <input
          id={inputId}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          autoFocus={autoFocus}
          placeholder="Ask about an order, quote or product…"
          className="h-12 w-full rounded-full border bg-background pr-14 pl-11 text-base shadow-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 sm:text-sm"
        />
        <Button type="submit" size="icon" className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded-full" disabled={ask.isPending || question.trim().length < 3} aria-label="Ask">
          <ArrowUpIcon weight="bold" aria-hidden />
        </Button>
      </form>

      <div className="mt-3 flex flex-wrap gap-2">
        {suggestions.map((s) => (
          <button key={s} type="button" onClick={() => submit(s)} className="rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground transition hover:border-primary/40 hover:text-foreground">
            {s}
          </button>
        ))}
      </div>

      <div aria-live="polite" className="mt-1">
        <AnimatePresence mode="wait">
          {ask.isPending ? (
            <motion.p key="pending" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-4 text-sm text-muted-foreground">
              Looking through your quotes, orders, deliveries and messages…
            </motion.p>
          ) : ask.isError ? (
            <motion.p key="error" role="alert" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 text-sm text-danger">
              {errorMessage(ask.error)}
            </motion.p>
          ) : ask.data ? (
            <motion.div key={ask.data.question} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              <AssistantAnswer answer={ask.data} />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}

export function AssistantAnswer({ answer }: { answer: AskResponse }) {
  const supplier = useIsSupplier();
  return (
    <div className="mt-4 rounded-2xl border bg-surface-raised p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-sm font-medium">{answer.question}</p>
        <SimulatedBadge />
      </div>
      <div className="space-y-2 text-sm leading-relaxed">
        {answer.answer.map((p) => (
          <p key={p}>{p}</p>
        ))}
      </div>
      {answer.sources.length ? (
        <div className="mt-3 border-t pt-3">
          <p className="mb-2 text-xs font-medium text-muted-foreground">Sources</p>
          <ul className="flex flex-wrap gap-1.5">
            {answer.sources.map((s) => (
              <li key={`${s.relatedType}-${s.relatedId}`}>
                <Link
                  href={supplier && s.relatedType === "product" ? "/stock" : hrefFor(s.relatedType, s.relatedId)}
                  className="inline-flex rounded-full border px-2.5 py-1 text-xs hover:border-primary/40 hover:bg-accent"
                >
                  {s.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

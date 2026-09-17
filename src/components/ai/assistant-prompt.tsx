"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpIcon, SparkleIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { useIsSupplier, usePersonaKey } from "@/features/session/use-session";
import { api, errorMessage, queryKeys } from "@/lib/api";
import { hrefFor } from "@/lib/links";
import { cn } from "@/lib/utils";
import { useAssistantStore } from "@/stores/assistant-store";
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
    .map((t) => (t.relatedType === (supplier ? "purchase-order" : "sales-order") ? t.subject.match(/\b(SO|PO)-\d+/)?.[0] : undefined))
    .filter((n): n is string => !!n)
    .slice(0, 1)
    .map((n) => `Where is ${n}?`);
  return [...topical, ...numbered, supplier ? "Cobra B 4 Out Chrome LED" : "Pipeline Purple cleaning powder"];
}

/**
 * Question box over the account's own records. `inline` (dashboard) shows the
 * latest answer beneath; `panel` shows the session's answers as a conversation.
 * Both add to the same session history, so the assistant panel carries on.
 */
export function AssistantPrompt({ autoFocus, variant = "inline" }: { autoFocus?: boolean; variant?: "inline" | "panel" }) {
  const inputId = useId();
  const key = usePersonaKey();
  const [question, setQuestion] = useState("");
  const [latest, setLatest] = useState<AskResponse | null>(null);
  const suggestions = useSuggestions();
  const addAnswer = useAssistantStore((s) => s.addAnswer);
  const allHistory = useAssistantStore((s) => s.history);
  const history = allHistory.filter((h) => h.personaKey === key).map((h) => h.response);
  const endRef = useRef<HTMLDivElement>(null);
  const ask = useMutation({
    mutationFn: (q: string) => api.ai.ask({ question: q }),
    onSuccess: (answer) => {
      addAnswer(key, answer);
      setLatest(answer);
      if (variant === "panel") setQuestion("");
    },
  });

  useEffect(() => {
    if (variant === "panel") endRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [variant, history.length, ask.isPending]);

  const submit = (q: string) => {
    const trimmed = q.trim();
    if (trimmed.length < 3) return;
    setQuestion(trimmed);
    ask.mutate(trimmed);
  };

  const form = (
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
  );

  const chips = (
    <div className="flex flex-wrap gap-2">
      {suggestions.map((s) => (
        <button key={s} type="button" onClick={() => submit(s)} disabled={ask.isPending} className="rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground transition hover:border-primary/40 hover:text-foreground disabled:opacity-60">
          {s}
        </button>
      ))}
    </div>
  );

  const status = ask.isPending ? (
    <motion.p key="pending" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-4 text-sm text-muted-foreground">
      Looking through your quotes, orders, deliveries and messages…
    </motion.p>
  ) : ask.isError ? (
    <motion.p key="error" role="alert" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 text-sm text-danger">
      {errorMessage(ask.error)}
    </motion.p>
  ) : null;

  if (variant === "panel") {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4" aria-live="polite">
          {history.length === 0 && !ask.isPending ? (
            <div className="py-6">
              <p className="text-sm font-medium">Ask about your own records</p>
              <p className="mt-1 text-sm text-muted-foreground">Answers are drawn from your quotes, orders, deliveries and messages, with links to each source. Try one of these:</p>
              <div className="mt-3">{chips}</div>
            </div>
          ) : (
            <ol className="space-y-1" aria-label="Answers this session">
              {history.map((h, i) => (
                <motion.li key={`${i}-${h.question}`} initial={i === history.length - 1 ? { opacity: 0, y: 6 } : false} animate={{ opacity: 1, y: 0 }}>
                  <AssistantAnswer answer={h} />
                </motion.li>
              ))}
            </ol>
          )}
          <AnimatePresence>{status}</AnimatePresence>
          <div ref={endRef} />
        </div>
        <div className="border-t bg-background p-4">
          {form}
          {history.length ? <div className="mt-3">{chips}</div> : null}
        </div>
      </div>
    );
  }

  return (
    <div>
      {form}
      <div className="mt-3">{chips}</div>
      <div aria-live="polite" className="mt-1">
        <AnimatePresence mode="wait">
          {status ??
            (latest ? (
              <motion.div key={latest.question} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                <AssistantAnswer answer={latest} />
              </motion.div>
            ) : null)}
        </AnimatePresence>
      </div>
    </div>
  );
}

export function AssistantAnswer({ answer, className }: { answer: AskResponse; className?: string }) {
  const supplier = useIsSupplier();
  const setOpen = useAssistantStore((s) => s.setOpen);
  return (
    <div className={cn("mt-4 rounded-2xl border bg-surface-raised p-4", className)}>
      <div className="mb-2 flex items-start justify-between gap-2">
        <p className="text-sm font-medium">{answer.question}</p>
        <SimulatedBadge className="shrink-0" />
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
                  onClick={() => setOpen(false)}
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

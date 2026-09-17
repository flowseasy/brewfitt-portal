"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeftIcon, ArrowRightIcon } from "@phosphor-icons/react";
import { RELATED_LABEL } from "@/components/messages/new-thread-sheet";
import { ThreadList } from "@/components/messages/thread-list";
import { ThreadView } from "@/components/messages/thread-view";
import { ErrorState, LoadingState } from "@/components/shared/states";
import { usePersonaKey } from "@/features/session/use-session";
import { api, queryKeys } from "@/lib/api";
import { initials } from "@/lib/format";
import { hrefFor } from "@/lib/links";

export default function ThreadPage() {
  return (
    <Suspense fallback={<LoadingState rows={6} />}>
      <ThreadPageInner />
    </Suspense>
  );
}

function ThreadPageInner() {
  const id = useSearchParams().get("id") ?? "";
  const key = usePersonaKey();
  const threads = useQuery({ queryKey: queryKeys.threads(key), queryFn: () => api.messages.threads() });
  const thread = useQuery({ queryKey: queryKeys.thread(key, id), queryFn: () => api.messages.thread(id), enabled: !!id });

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
      <aside className="hidden lg:block">
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">Conversations</h2>
        <div className="max-h-[calc(100dvh-12rem)] overflow-y-auto rounded-2xl">{threads.isPending ? <LoadingState rows={6} /> : threads.data ? <ThreadList threads={threads.data} activeId={id} dense /> : null}</div>
      </aside>
      <section className="min-w-0" aria-labelledby="thread-subject">
        <Link href="/messages" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground lg:hidden">
          <ArrowLeftIcon className="size-4" aria-hidden />
          Messages
        </Link>
        {thread.isPending ? (
          <LoadingState rows={5} label="Loading conversation" />
        ) : thread.isError ? (
          <ErrorState error={thread.error} onRetry={() => thread.refetch()} />
        ) : (
          <div className="rounded-2xl border bg-card p-4 sm:p-5">
            <header className="mb-4 flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <h1 id="thread-subject" className="text-lg font-semibold tracking-tight text-balance">
                  {thread.data.subject}
                </h1>
                <div className="mt-2 flex items-center gap-2">
                  <span className="flex -space-x-2" aria-hidden>
                    {thread.data.participants.map((p) => (
                      <span key={p.id} className="flex size-7 items-center justify-center rounded-full border-2 border-card bg-muted text-[10px] font-semibold text-muted-foreground">
                        {initials(p.name)}
                      </span>
                    ))}
                  </span>
                  <span className="text-sm text-muted-foreground">{thread.data.participants.map((p) => (p.side === "brewfitt" ? `${p.name} (Brewfitt)` : p.name)).join(", ")}</span>
                </div>
              </div>
              {thread.data.relatedType && thread.data.relatedId ? (
                <Link href={hrefFor(thread.data.relatedType, thread.data.relatedId)} className="inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm hover:border-primary/40">
                  Open {RELATED_LABEL[thread.data.relatedType].toLowerCase()}
                  <ArrowRightIcon className="size-4" aria-hidden />
                </Link>
              ) : null}
            </header>
            <ThreadView threadId={id} compact />
          </div>
        )}
      </section>
    </div>
  );
}

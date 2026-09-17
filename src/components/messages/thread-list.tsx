"use client";

import Link from "next/link";
import { ChatsCircleIcon } from "@phosphor-icons/react";
import { EmptyState } from "@/components/shared/states";
import { formatSince, initials } from "@/lib/format";
import { hrefFor } from "@/lib/links";
import { cn } from "@/lib/utils";
import type { ThreadSummary } from "@/types";
import { RELATED_LABEL } from "./new-thread-sheet";
import { ChannelIndicator } from "./thread-view";

export function ThreadList({
  threads,
  activeId,
  dense,
  emptyTitle = "No conversations here",
}: {
  threads: ThreadSummary[];
  activeId?: string;
  dense?: boolean;
  emptyTitle?: string;
}) {
  if (threads.length === 0) return <EmptyState icon={ChatsCircleIcon} title={emptyTitle} />;
  return (
    <ul className="divide-y overflow-hidden rounded-2xl border bg-card" aria-label="Conversations">
      {threads.map((t) => {
        const unread = t.unreadCount > 0;
        const last = t.lastMessage;
        const brewfitt = t.participants.find((p) => p.side === "brewfitt");
        const sender = last ? t.participants.find((p) => p.id === last.senderId) : undefined;
        return (
          <li key={t.id}>
            <Link
              href={hrefFor("thread", t.id)}
              aria-current={activeId === t.id ? "page" : undefined}
              className={cn(
                "flex gap-3 px-4 py-3 transition hover:bg-accent/50 focus-visible:bg-accent/50 focus-visible:outline-none",
                activeId === t.id && "bg-brand-subtle/50",
                dense && "py-2.5",
              )}
            >
              <span
                aria-hidden
                className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground"
              >
                {initials(brewfitt?.name ?? "Brewfitt")}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span
                    className={cn("truncate text-sm", unread ? "font-semibold" : "font-medium")}
                  >
                    {t.subject}
                  </span>
                  <time
                    dateTime={t.lastMessageAt}
                    className={cn(
                      "shrink-0 text-xs",
                      unread ? "font-medium text-primary" : "text-muted-foreground",
                    )}
                  >
                    {formatSince(t.lastMessageAt)}
                  </time>
                </span>
                {last ? (
                  <span
                    className={cn(
                      "mt-0.5 line-clamp-2 text-sm",
                      unread ? "text-foreground" : "text-muted-foreground",
                      dense && "line-clamp-1",
                    )}
                  >
                    <span className="font-medium">
                      {last.senderSide === "account"
                        ? "You"
                        : (sender?.name.split(" ")[0] ?? "Brewfitt")}
                      :{" "}
                    </span>
                    {last.body}
                  </span>
                ) : null}
                <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                  {t.relatedType ? (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                      {RELATED_LABEL[t.relatedType]}
                    </span>
                  ) : null}
                  {last ? <ChannelIndicator channel={last.channel} /> : null}
                  {unread ? (
                    <span className="ml-auto rounded-full bg-primary px-1.5 text-[11px] font-medium text-primary-foreground">
                      {t.unreadCount}
                      <span className="sr-only"> unread</span>
                    </span>
                  ) : null}
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ChatCircleTextIcon,
  EnvelopeSimpleIcon,
  PaperclipIcon,
  PaperPlaneRightIcon,
  WhatsappLogoIcon,
} from "@phosphor-icons/react";
import Link from "next/link";
import { toast } from "sonner";
import type { Document, Message, Thread } from "@/types";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { usePersonaKey } from "@/features/session/use-session";
import { api, errorMessage, queryKeys } from "@/lib/api";
import { formatDateTime, formatSince, initials } from "@/lib/format";
import { hrefFor } from "@/lib/links";
import { cn } from "@/lib/utils";

const CHANNEL = {
  portal: { label: "Portal", icon: ChatCircleTextIcon },
  email: { label: "Email", icon: EnvelopeSimpleIcon },
  whatsapp: { label: "WhatsApp", icon: WhatsappLogoIcon },
} as const;

/** Where a message arrived from (Phase 1: WhatsApp is an indicator only). */
export function ChannelIndicator({ channel }: { channel: Message["channel"] }) {
  const c = CHANNEL[channel];
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
      <c.icon className="size-3.5" aria-hidden />
      {c.label}
    </span>
  );
}

export function MessageBubble({
  message,
  thread,
  animateIn,
  documents,
}: {
  message: Message;
  thread: Thread;
  animateIn?: boolean;
  documents?: Map<string, Document>;
}) {
  const sender = thread.participants.find((p) => p.id === message.senderId);
  const mine = message.senderSide === "account";
  return (
    <motion.li
      initial={animateIn ? { opacity: 0, y: 6 } : false}
      animate={{ opacity: 1, y: 0 }}
      className={cn("flex gap-2.5", mine && "flex-row-reverse")}
    >
      <span
        aria-hidden
        className={cn(
          "mt-5 flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
          mine ? "bg-brand-subtle text-brand-subtle-foreground" : "bg-muted text-muted-foreground",
        )}
      >
        {initials(sender?.name ?? "Brewfitt")}
      </span>
      <div className={cn("flex max-w-[85%] flex-col sm:max-w-[75%]", mine && "items-end")}>
        <p
          className={cn(
            "mb-1 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground",
            mine && "justify-end",
          )}
        >
          <span className="font-medium text-foreground">{sender?.name ?? "Brewfitt"}</span>
          {!mine ? <span>Brewfitt</span> : null}
          <time dateTime={message.sentAt} title={formatDateTime(message.sentAt)}>
            {formatSince(message.sentAt)}
          </time>
        </p>
        <div
          className={cn(
            "rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-line",
            mine
              ? "rounded-tr-md bg-primary text-primary-foreground"
              : "rounded-tl-md border bg-card",
          )}
        >
          {message.body}
        </div>
        {message.attachments.length ? (
          <ul
            className={cn("mt-1.5 flex flex-wrap gap-1.5", mine && "justify-end")}
            aria-label="Attachments"
          >
            {message.attachments.map((docId) => (
              <li key={docId}>
                <Link
                  href={hrefFor("document", docId)}
                  className="inline-flex max-w-64 items-center gap-1.5 rounded-full border bg-card px-2.5 py-1 text-xs hover:border-primary/40"
                >
                  <PaperclipIcon className="size-3.5 shrink-0" aria-hidden />
                  <span className="truncate">{documents?.get(docId)?.name ?? "Attachment"}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
        <span className="mt-1">
          <ChannelIndicator channel={message.channel} />
        </span>
      </div>
    </motion.li>
  );
}

export function Composer({
  threadId,
  placeholder = "Write a message to Brewfitt",
  onSent,
}: {
  threadId: string;
  placeholder?: string;
  onSent?: () => void;
}) {
  const id = useId();
  const key = usePersonaKey();
  const queryClient = useQueryClient();
  const [body, setBody] = useState("");
  const send = useMutation({
    mutationFn: (text: string) => api.messages.send(threadId, { body: text, attachments: [] }),
    onSuccess: () => {
      setBody("");
      void queryClient.invalidateQueries({ queryKey: queryKeys.thread(key, threadId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.threads(key) });
      onSent?.();
    },
    onError: (error) =>
      toast.error("Your message was not sent", { description: errorMessage(error) }),
  });
  const submit = () => {
    if (body.trim()) send.mutate(body.trim());
  };
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="flex items-end gap-2 rounded-2xl border bg-background p-2 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30"
    >
      <label htmlFor={id} className="sr-only">
        Message
      </label>
      <textarea
        id={id}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            submit();
          }
        }}
        rows={Math.min(6, Math.max(1, body.split("\n").length))}
        placeholder={placeholder}
        className="min-h-9 flex-1 resize-none bg-transparent px-2 py-1.5 text-base outline-none placeholder:text-muted-foreground sm:text-sm"
      />
      <Button
        type="submit"
        size="icon"
        className="rounded-full"
        disabled={!body.trim() || send.isPending}
        aria-label="Send message"
      >
        <PaperPlaneRightIcon weight="fill" aria-hidden />
      </Button>
    </form>
  );
}

/** A record's conversation with Brewfitt: messages and a composer. */
export function ThreadView({
  threadId,
  compact,
  fill,
  emptyTitle = "No messages yet",
}: {
  threadId: string;
  compact?: boolean;
  fill?: boolean;
  emptyTitle?: string;
}) {
  const key = usePersonaKey();
  const queryClient = useQueryClient();
  const thread = useQuery({
    queryKey: queryKeys.thread(key, threadId),
    queryFn: () => api.messages.thread(threadId),
    enabled: !!threadId,
  });
  const hasAttachments = !!thread.data?.messages.some((m) => m.attachments.length);
  const documents = useQuery({
    queryKey: queryKeys.documents(key),
    queryFn: () => api.documents.list(),
    enabled: hasAttachments,
  });
  const documentById = new Map((documents.data ?? []).map((d) => [d.id, d]));
  const endRef = useRef<HTMLLIElement>(null);
  const count = thread.data?.messages.length ?? 0;

  useEffect(() => {
    // Opening a thread marks it read on the server; refresh unread counts.
    if (thread.data)
      void queryClient.invalidateQueries({ queryKey: queryKeys.threads(key), exact: true });
  }, [thread.data?.id, queryClient, key, thread.data]);

  useEffect(() => {
    if (count) endRef.current?.scrollIntoView({ block: "nearest" });
  }, [count]);

  if (thread.isPending) return <LoadingState rows={3} label="Loading conversation" />;
  if (thread.isError) return <ErrorState error={thread.error} onRetry={() => thread.refetch()} />;

  return (
    <div className={cn("flex flex-col gap-4", fill && "min-h-0 flex-1")}>
      {thread.data.messages.length === 0 ? (
        <EmptyState icon={ChatCircleTextIcon} title={emptyTitle} />
      ) : (
        <ol
          className={cn(
            "space-y-4 overflow-y-auto pr-1",
            compact ? "max-h-[420px]" : "",
            fill && "min-h-0 flex-1",
          )}
          aria-label={`Messages in ${thread.data.subject}`}
        >
          {thread.data.messages.map((m, i) => (
            <MessageBubble
              key={m.id}
              message={m}
              thread={thread.data}
              animateIn={i >= count - 1}
              documents={documentById}
            />
          ))}
          <li ref={endRef} aria-hidden />
        </ol>
      )}
      <Composer threadId={threadId} />
    </div>
  );
}

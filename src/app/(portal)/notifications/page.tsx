"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  BellSimpleIcon,
  CalendarCheckIcon,
  ChatCircleTextIcon,
  CheckCircleIcon,
  CheckIcon,
  ClockCountdownIcon,
  EnvelopeOpenIcon,
  EnvelopeSimpleIcon,
  FileTextIcon,
  LifebuoyIcon,
  LightbulbIcon,
  PackageIcon,
  ReceiptIcon,
  TruckIcon,
  WarningIcon,
  XCircleIcon,
  XIcon,
  type Icon,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/states";
import { StatusTabs } from "@/components/shared/status-tabs";
import { Button } from "@/components/ui/button";
import { usePersonaKey } from "@/features/session/use-session";
import { api, errorMessage, queryKeys } from "@/lib/api";
import { formatSince } from "@/lib/format";
import { hrefFor } from "@/lib/links";
import { cn } from "@/lib/utils";
import type { Notification } from "@/types";

const KIND: Record<Notification["kind"], { icon: Icon; tone: string }> = {
  "quote-awaiting-acceptance": { icon: FileTextIcon, tone: "bg-brand-subtle text-brand-subtle-foreground" },
  "quote-expiring": { icon: ClockCountdownIcon, tone: "bg-warning-subtle text-warning" },
  "order-confirmed": { icon: PackageIcon, tone: "bg-brand-subtle text-brand-subtle-foreground" },
  "order-dispatched": { icon: TruckIcon, tone: "bg-info-subtle text-info" },
  "order-delivered": { icon: CheckCircleIcon, tone: "bg-success-subtle text-success" },
  "delivery-date-changed": { icon: CalendarCheckIcon, tone: "bg-warning-subtle text-warning" },
  "invoice-due": { icon: ReceiptIcon, tone: "bg-info-subtle text-info" },
  "invoice-overdue": { icon: WarningIcon, tone: "bg-danger-subtle text-danger" },
  "new-message": { icon: ChatCircleTextIcon, tone: "bg-brand-subtle text-brand-subtle-foreground" },
  "product-suggestion": { icon: LightbulbIcon, tone: "bg-info-subtle text-info" },
  "stock-out-risk": { icon: WarningIcon, tone: "bg-warning-subtle text-warning" },
  "case-updated": { icon: LifebuoyIcon, tone: "bg-info-subtle text-info" },
  "submission-approved": { icon: CheckCircleIcon, tone: "bg-success-subtle text-success" },
  "submission-rejected": { icon: XCircleIcon, tone: "bg-danger-subtle text-danger" },
  "rfq-received": { icon: FileTextIcon, tone: "bg-brand-subtle text-brand-subtle-foreground" },
  "payment-run-scheduled": { icon: CalendarCheckIcon, tone: "bg-success-subtle text-success" },
};

type Tab = "all" | "unread";

export default function NotificationsPage() {
  const key = usePersonaKey();
  const queryClient = useQueryClient();
  const notifications = useQuery({ queryKey: queryKeys.notifications(key), queryFn: () => api.notifications.list() });
  const [tab, setTab] = useState<Tab>("all");

  const setLocal = (update: (list: Notification[]) => Notification[]) => queryClient.setQueryData<Notification[]>(queryKeys.notifications(key), (old) => (old ? update(old) : old));
  const refresh = () => void queryClient.invalidateQueries({ queryKey: queryKeys.notifications(key) });

  const update = useMutation({
    mutationFn: ({ ids, patch }: { ids: string[]; patch: { read?: boolean; dismissed?: boolean } }) => Promise.all(ids.map((id) => api.notifications.update(id, patch))),
    onMutate: ({ ids, patch }) => setLocal((list) => (patch.dismissed ? list.filter((n) => !ids.includes(n.id)) : list.map((n) => (ids.includes(n.id) ? { ...n, ...patch } : n)))),
    onError: (error) => {
      toast.error("That change was not saved", { description: errorMessage(error) });
      refresh();
    },
    onSettled: refresh,
  });

  const dismiss = (n: Notification) => {
    update.mutate({ ids: [n.id], patch: { dismissed: true } });
    toast("Notification dismissed", { action: { label: "Undo", onClick: () => update.mutate({ ids: [n.id], patch: { dismissed: false } }) } });
  };

  const all = notifications.data ?? [];
  const unread = all.filter((n) => !n.read);
  const shown = tab === "unread" ? unread : all;
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const groups = [
    { label: "Today", items: shown.filter((n) => new Date(n.createdAt) >= startOfToday) },
    { label: "Earlier", items: shown.filter((n) => new Date(n.createdAt) < startOfToday) },
  ].filter((g) => g.items.length);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Notifications"
        description="Things that need your attention. Open one to go straight to the record."
        actions={
          unread.length ? (
            <Button variant="outline" onClick={() => update.mutate({ ids: unread.map((n) => n.id), patch: { read: true } })}>
              <CheckIcon aria-hidden />
              Mark all read
            </Button>
          ) : null
        }
      />
      <StatusTabs
        tabs={[
          { value: "all" as Tab, label: "All", count: all.length },
          { value: "unread" as Tab, label: "Unread", count: unread.length },
        ]}
        value={tab}
        onChange={setTab}
      />
      {notifications.isPending ? (
        <LoadingState rows={6} label="Loading notifications" />
      ) : notifications.isError ? (
        <ErrorState error={notifications.error} onRetry={() => notifications.refetch()} />
      ) : groups.length === 0 ? (
        <EmptyState icon={BellSimpleIcon} title={tab === "unread" && all.length ? "You are all caught up" : "No notifications"} description="Quotes, orders, deliveries, invoices and messages that need you will show up here." />
      ) : (
        <div className="space-y-6">
          {groups.map((g) => (
            <section key={g.label} aria-labelledby={`group-${g.label}`}>
              <h2 id={`group-${g.label}`} className="mb-2 text-sm font-medium text-muted-foreground">
                {g.label}
              </h2>
              <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
                <AnimatePresence initial={false}>
                  {g.items.map((n) => {
                    const kind = KIND[n.kind];
                    return (
                      <motion.li key={n.id} layout exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.18 }} className={cn("group relative flex gap-3 px-4 py-3", !n.read && "bg-brand-subtle/30")}>
                        <span aria-hidden className={cn("mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full", kind.tone)}>
                          <kind.icon className="size-[18px]" />
                        </span>
                        <Link
                          href={hrefFor(n.relatedType, n.relatedId)}
                          onClick={() => {
                            if (!n.read) update.mutate({ ids: [n.id], patch: { read: true } });
                          }}
                          className="min-w-0 flex-1 rounded-md after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:ring-3 focus-visible:after:ring-ring/40"
                        >
                          <span className="flex items-baseline justify-between gap-2">
                            <span className={cn("text-sm", n.read ? "font-medium" : "font-semibold")}>
                              {!n.read ? <span className="sr-only">Unread: </span> : null}
                              {n.title}
                            </span>
                            <time dateTime={n.createdAt} className="shrink-0 text-xs text-muted-foreground">
                              {formatSince(n.createdAt)}
                            </time>
                          </span>
                          <span className="mt-0.5 line-clamp-2 block text-sm text-muted-foreground">{n.body}</span>
                        </Link>
                        <span className="relative z-10 flex shrink-0 items-start gap-0.5 self-center">
                          <Button variant="ghost" size="icon" className="size-8" onClick={() => update.mutate({ ids: [n.id], patch: { read: !n.read } })} aria-label={n.read ? `Mark "${n.title}" as unread` : `Mark "${n.title}" as read`} title={n.read ? "Mark as unread" : "Mark as read"}>
                            {n.read ? <EnvelopeSimpleIcon aria-hidden /> : <EnvelopeOpenIcon aria-hidden />}
                          </Button>
                          <Button variant="ghost" size="icon" className="size-8" onClick={() => dismiss(n)} aria-label={`Dismiss "${n.title}"`} title="Dismiss">
                            <XIcon aria-hidden />
                          </Button>
                        </span>
                        {!n.read ? <span aria-hidden className="absolute top-1/2 left-1.5 size-1.5 -translate-y-1/2 rounded-full bg-primary" /> : null}
                      </motion.li>
                    );
                  })}
                </AnimatePresence>
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ChatsCircleIcon, PlusIcon } from "@phosphor-icons/react";
import { NewThreadSheet, RELATED_LABEL } from "@/components/messages/new-thread-sheet";
import { ThreadList } from "@/components/messages/thread-list";
import { SearchInput } from "@/components/shared/filter-bar";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/states";
import { StatusTabs } from "@/components/shared/status-tabs";
import { Button } from "@/components/ui/button";
import { usePersonaKey } from "@/features/session/use-session";
import { api, queryKeys } from "@/lib/api";

export default function MessagesPage() {
  return (
    <Suspense fallback={<LoadingState rows={6} />}>
      <Messages />
    </Suspense>
  );
}

type Tab = "all" | "unread" | "records" | "general";

function Messages() {
  const key = usePersonaKey();
  const params = useSearchParams();
  const threads = useQuery({ queryKey: queryKeys.threads(key), queryFn: () => api.messages.threads() });
  const [tab, setTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");
  const [newOpen, setNewOpen] = useState(false);

  useEffect(() => {
    if (params.get("new")) setNewOpen(true);
  }, [params]);

  const all = threads.data ?? [];
  const inTab = (t: (typeof all)[number], which: Tab) => (which === "all" ? true : which === "unread" ? t.unreadCount > 0 : which === "records" ? !!t.relatedType : !t.relatedType);
  const q = search.trim().toLowerCase();
  const filtered = all.filter((t) => inTab(t, tab) && (!q || `${t.subject} ${t.lastMessage?.body ?? ""} ${t.relatedType ? RELATED_LABEL[t.relatedType] : ""} ${t.participants.map((p) => p.name).join(" ")}`.toLowerCase().includes(q)));

  return (
    <div>
      <PageHeader
        title="Messages"
        description="Every conversation with Brewfitt, whether it started in the portal, by email or on WhatsApp."
        actions={
          <Button onClick={() => setNewOpen(true)}>
            <PlusIcon aria-hidden />
            New message
          </Button>
        }
      />
      <StatusTabs
        tabs={[
          { value: "all" as Tab, label: "All", count: all.length },
          { value: "unread" as Tab, label: "Unread", count: all.filter((t) => inTab(t, "unread")).length },
          { value: "records" as Tab, label: "About a record", count: all.filter((t) => inTab(t, "records")).length },
          { value: "general" as Tab, label: "General", count: all.filter((t) => inTab(t, "general")).length },
        ]}
        value={tab}
        onChange={setTab}
      />
      <div className="mb-4">
        <SearchInput value={search} onChange={setSearch} placeholder="Search subjects, messages and people" label="Search conversations" />
      </div>
      {threads.isPending ? (
        <LoadingState rows={6} label="Loading conversations" />
      ) : threads.isError ? (
        <ErrorState error={threads.error} onRetry={() => threads.refetch()} />
      ) : all.length === 0 ? (
        <EmptyState icon={ChatsCircleIcon} title="No conversations yet" description="Ask your Brewfitt account team anything. Replies arrive here and by email." action={<Button onClick={() => setNewOpen(true)}>New message</Button>} />
      ) : (
        <ThreadList threads={filtered} emptyTitle={tab === "unread" && !q ? "You are all caught up" : "No conversations match"} />
      )}
      <NewThreadSheet open={newOpen} onOpenChange={setNewOpen} />
    </div>
  );
}

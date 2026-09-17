"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeftIcon,
  ChatsCircleIcon,
  CheckCircleIcon,
  PackageIcon,
  ShieldCheckIcon,
  TagIcon,
  WrenchIcon,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { CASE_KIND_LABEL } from "@/components/cases/case-sheet";
import { ThreadView } from "@/components/messages/thread-view";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { PageHeader } from "@/components/shared/page-header";
import { ErrorState, LoadingState, RecordIdGate } from "@/components/shared/states";
import { StatusPill } from "@/components/shared/status-pill";
import { Timeline } from "@/components/shared/timeline";
import { SubmissionImage, isUpload, uploadName } from "@/components/supplier/submission-forms";
import { Button } from "@/components/ui/button";
import { usePersonaKey } from "@/features/session/use-session";
import { api, errorMessage, queryKeys } from "@/lib/api";
import { daysFromToday, formatDate } from "@/lib/format";
import { hrefFor } from "@/lib/links";
import { CASE_STATUS, CASE_URGENCY } from "@/lib/status";

export default function CaseViewPage() {
  return (
    <Suspense fallback={<LoadingState rows={5} />}>
      <RecordIdGate backHref="/cases" backLabel="Back to cases">
        <CaseView />
      </RecordIdGate>
    </Suspense>
  );
}

function CaseView() {
  const id = useSearchParams().get("id") ?? "";
  const key = usePersonaKey();
  const queryClient = useQueryClient();
  const kase = useQuery({
    queryKey: queryKeys.case(key, id),
    queryFn: () => api.cases.get(id),
    enabled: !!id,
  });
  const priceList = useQuery({
    queryKey: queryKeys.priceList(key),
    queryFn: () => api.priceList.get(),
  });
  const orders = useQuery({
    queryKey: queryKeys.salesOrders(key),
    queryFn: () => api.orders.salesOrders(),
  });
  const jobs = useQuery({ queryKey: queryKeys.jobs(key), queryFn: () => api.jobs.list() });
  const [closeOpen, setCloseOpen] = useState(false);

  const close = useMutation({
    mutationFn: () => api.cases.update(id, { status: "closed" }),
    onSuccess: (c) => {
      for (const k of [
        queryKeys.case(key, id),
        queryKeys.cases(key),
        queryKeys.thread(key, c.threadId),
        queryKeys.threads(key),
      ])
        void queryClient.invalidateQueries({ queryKey: k });
      setCloseOpen(false);
      toast.success(`Case ${c.number} closed`);
    },
    onError: (error) =>
      toast.error("The case could not be closed", { description: errorMessage(error) }),
  });

  if (kase.isPending) return <LoadingState rows={5} label="Loading case" />;
  if (kase.isError) return <ErrorState error={kase.error} onRetry={() => kase.refetch()} />;

  const c = kase.data;
  const product = priceList.data?.lines.find((l) => l.productId === c.productId)?.product;
  const order = orders.data?.find((o) => o.id === c.orderId);
  const job = jobs.data?.find((j) => j.id === c.jobId);
  const warrantyActive = job?.warrantyEnd ? daysFromToday(job.warrantyEnd) >= 0 : null;
  const canClose = c.status !== "closed";

  return (
    <div>
      <Link
        href="/cases"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" aria-hidden />
        Cases
      </Link>
      <PageHeader
        eyebrow={`${c.number} · ${CASE_KIND_LABEL[c.kind]}`}
        title={c.subject}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <StatusPill tone={CASE_STATUS[c.status].tone}>{CASE_STATUS[c.status].label}</StatusPill>
            <StatusPill tone={CASE_URGENCY[c.urgency].tone} dot={false}>
              {CASE_URGENCY[c.urgency].label} urgency
            </StatusPill>
            <span>Raised {formatDate(c.createdAt)}</span>
          </span>
        }
        actions={
          canClose ? (
            <Button variant="outline" onClick={() => setCloseOpen(true)}>
              <CheckCircleIcon aria-hidden />
              Close case
            </Button>
          ) : null
        }
      />

      {c.resolution ? (
        <div className="mb-6 rounded-2xl border border-success/30 bg-success-subtle p-4 text-sm">
          <p className="font-medium">Resolution</p>
          <p className="mt-1">{c.resolution}</p>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-6">
          <section aria-labelledby="desc" className="rounded-2xl border bg-card p-5">
            <h2 id="desc" className="mb-2 font-medium">
              What was reported
            </h2>
            <p className="text-sm leading-relaxed whitespace-pre-line">{c.description}</p>
            {c.photos.length ? (
              <ul className="mt-4 flex flex-wrap gap-3" aria-label="Photos">
                {c.photos.map((p) => (
                  <li key={p} className="w-24">
                    <SubmissionImage src={p} className="size-24 rounded-xl border" />
                    {isUpload(p) ? (
                      <p className="mt-1 truncate text-xs text-muted-foreground">{uploadName(p)}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
          </section>

          <section aria-labelledby="notes" className="rounded-2xl border bg-card p-5">
            <h2 id="notes" className="mb-3 font-medium">
              Engineer notes
            </h2>
            {c.engineerNotes.length ? (
              <Timeline
                entries={c.engineerNotes.map((n, i) => ({
                  id: `${i}`,
                  at: n.at,
                  title: n.note,
                  detail: n.author,
                  icon: WrenchIcon,
                }))}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                No engineer notes yet. Brewfitt&apos;s technical team replies in the conversation
                below.
              </p>
            )}
          </section>

          <section aria-labelledby="case-thread" className="rounded-2xl border bg-card p-4 sm:p-5">
            <h2 id="case-thread" className="mb-4 flex items-center gap-2 font-medium">
              <ChatsCircleIcon className="size-5 text-primary" aria-hidden />
              Conversation
            </h2>
            <ThreadView threadId={c.threadId} compact />
          </section>
        </div>

        <aside className="space-y-3">
          {product ? (
            <Link
              href={hrefFor("product", product.id)}
              className="flex items-center gap-3 rounded-2xl border bg-card p-4 hover:border-primary/40"
            >
              <TagIcon className="size-5 shrink-0 text-primary" aria-hidden />
              <span className="min-w-0 text-sm">
                <span className="block text-xs text-muted-foreground">Product</span>
                <span className="block truncate font-medium">{product.name}</span>
              </span>
            </Link>
          ) : null}
          {order ? (
            <Link
              href={hrefFor("sales-order", order.id)}
              className="flex items-center gap-3 rounded-2xl border bg-card p-4 hover:border-primary/40"
            >
              <PackageIcon className="size-5 shrink-0 text-primary" aria-hidden />
              <span className="text-sm">
                <span className="block text-xs text-muted-foreground">Order</span>
                <span className="font-medium">
                  {order.number} · {formatDate(order.createdAt)}
                </span>
              </span>
            </Link>
          ) : null}
          {job ? (
            <Link
              href={hrefFor("job", job.id)}
              className="flex items-center gap-3 rounded-2xl border bg-card p-4 hover:border-primary/40"
            >
              <WrenchIcon className="size-5 shrink-0 text-primary" aria-hidden />
              <span className="min-w-0 text-sm">
                <span className="block text-xs text-muted-foreground">Install job</span>
                <span className="block truncate font-medium">{job.name}</span>
              </span>
            </Link>
          ) : null}
          {job?.warrantyEnd ? (
            <div className="flex items-center gap-3 rounded-2xl border bg-card p-4">
              <ShieldCheckIcon
                className={warrantyActive ? "size-5 text-success" : "size-5 text-muted-foreground"}
                aria-hidden
              />
              <span className="text-sm">
                <span className="block text-xs text-muted-foreground">Warranty</span>
                <span className="font-medium">
                  {warrantyActive
                    ? `Active until ${formatDate(job.warrantyEnd)}`
                    : `Ended ${formatDate(job.warrantyEnd)}`}
                </span>
              </span>
            </div>
          ) : null}
        </aside>
      </div>

      <ConfirmDialog
        open={closeOpen}
        onOpenChange={setCloseOpen}
        title={`Close case ${c.number}?`}
        description="Close it if the problem is fixed. You can raise a new case if it comes back."
        confirmLabel="Close case"
        pending={close.isPending}
        onConfirm={() => close.mutate()}
      />
    </div>
  );
}

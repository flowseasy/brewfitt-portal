"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeftIcon, ArrowSquareOutIcon, PlayIcon, TagIcon } from "@phosphor-icons/react";
import { KNOWLEDGE_TYPE, KnowledgeCard } from "@/components/knowledge/knowledge-parts";
import { DocumentCard } from "@/components/shared/document-card";
import { PageHeader } from "@/components/shared/page-header";
import { ErrorState, LoadingState, RecordIdGate } from "@/components/shared/states";
import { StatusPill } from "@/components/shared/status-pill";
import { useIsSupplier, usePersonaKey } from "@/features/session/use-session";
import { api, queryKeys } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { hrefFor } from "@/lib/links";
import { SUBMISSION_STATUS } from "@/lib/status";

export default function KnowledgeViewPage() {
  return (
    <Suspense fallback={<LoadingState rows={5} />}>
      <RecordIdGate backHref="/knowledge" backLabel="Back to the knowledge centre">
        <KnowledgeView />
      </RecordIdGate>
    </Suspense>
  );
}

function KnowledgeView() {
  const id = useSearchParams().get("id") ?? "";
  const key = usePersonaKey();
  const isSupplier = useIsSupplier();
  const item = useQuery({
    queryKey: queryKeys.knowledgeItem(key, id),
    queryFn: () => api.knowledge.get(id),
    enabled: !!id,
  });
  const all = useQuery({ queryKey: queryKeys.knowledge(key), queryFn: () => api.knowledge.list() });
  const products = useQuery({
    queryKey: queryKeys.products(key),
    queryFn: () => api.products.list(),
  });
  const categories = useQuery({
    queryKey: queryKeys.categories(key),
    queryFn: () => api.products.categories(),
  });
  const documentId = item.data?.documentId ?? "";
  const doc = useQuery({
    queryKey: queryKeys.document(key, documentId),
    queryFn: () => api.documents.get(documentId),
    enabled: !!documentId,
  });

  if (item.isPending) return <LoadingState rows={5} label="Loading article" />;
  if (item.isError) return <ErrorState error={item.error} onRetry={() => item.refetch()} />;

  const k = item.data;
  const type = KNOWLEDGE_TYPE[k.type];
  const categoryName = new Map((categories.data ?? []).map((c) => [c.id, c.name]));
  const visibleProducts = new Map((products.data ?? []).map((p) => [p.id, p]));
  const related = (all.data ?? [])
    .filter(
      (x) =>
        x.id !== k.id &&
        x.status === "approved" &&
        (x.category === k.category || x.productIds.some((pid) => k.productIds.includes(pid))),
    )
    .slice(0, 3);

  return (
    <div>
      <Link
        href="/knowledge"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" aria-hidden />
        Knowledge centre
      </Link>
      <PageHeader
        eyebrow={
          <span className="inline-flex items-center gap-1.5">
            <type.icon className="size-4" aria-hidden />
            {type.label}
            {categoryName.get(k.category) ? ` · ${categoryName.get(k.category)}` : ""}
          </span>
        }
        title={k.title}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {k.status !== "approved" || (isSupplier && k.source === "supplier") ? (
              <StatusPill tone={SUBMISSION_STATUS[k.status].tone}>
                {SUBMISSION_STATUS[k.status].label}
              </StatusPill>
            ) : null}
            <span>
              {k.source === "supplier" ? "Supplier content, reviewed by Brewfitt" : "Brewfitt"} ·
              updated {formatDate(k.updatedAt)}
            </span>
          </span>
        }
      />

      {k.reviewNote ? (
        <div
          className={
            k.status === "rejected"
              ? "mb-6 rounded-2xl border border-danger/30 bg-danger-subtle p-4 text-sm"
              : "mb-6 rounded-2xl border bg-muted/50 p-4 text-sm"
          }
        >
          <p className="font-medium">Note from Brewfitt</p>
          <p className="mt-1">{k.reviewNote}</p>
        </div>
      ) : k.status === "submitted" || k.status === "under-review" ? (
        <div className="mb-6 rounded-2xl border bg-info-subtle p-4 text-sm">
          Brewfitt is reviewing this. Customers will see it once it is approved.
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <article className="min-w-0 space-y-5">
          <p className="text-base leading-relaxed">{k.summary}</p>

          {k.type === "video" ? (
            <div className="overflow-hidden rounded-2xl border bg-gradient-to-br from-brand-subtle to-muted">
              <div className="flex aspect-video flex-col items-center justify-center gap-3 p-6 text-center">
                <span className="flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow">
                  <PlayIcon weight="fill" className="size-6" aria-hidden />
                </span>
                <p className="max-w-sm text-sm text-muted-foreground">
                  {k.videoUrl
                    ? "This video is hosted by the supplier."
                    : "Video playback arrives with the live portal. The walkthrough is written out below."}
                </p>
                {k.videoUrl ? (
                  <a
                    href={k.videoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                  >
                    Open the video
                    <ArrowSquareOutIcon className="size-4" aria-hidden />
                  </a>
                ) : null}
              </div>
            </div>
          ) : null}

          {k.body?.length ? (
            <div className="space-y-4 rounded-2xl border bg-card p-5 text-[15px] leading-relaxed sm:p-6">
              {k.type === "video" ? <h2 className="font-medium">Walkthrough</h2> : null}
              {k.body.map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>
          ) : null}

          {k.documentId ? (
            <section aria-labelledby="kb-doc">
              <h2 id="kb-doc" className="mb-2 font-medium">
                Document
              </h2>
              {doc.isPending ? (
                <LoadingState rows={1} />
              ) : doc.isError ? (
                <ErrorState error={doc.error} onRetry={() => doc.refetch()} />
              ) : (
                <DocumentCard doc={doc.data} showApproval={isSupplier} />
              )}
            </section>
          ) : null}
        </article>

        <aside className="space-y-6">
          <section aria-labelledby="kb-products" className="rounded-2xl border bg-card p-4">
            <h2 id="kb-products" className="mb-2 flex items-center gap-2 text-sm font-medium">
              <TagIcon className="size-4 text-primary" aria-hidden />
              Products covered
            </h2>
            <ul className="space-y-1.5 text-sm">
              {k.productIds.map((pid) => {
                const p = visibleProducts.get(pid);
                return (
                  <li key={pid}>
                    {p && !isSupplier ? (
                      <Link href={hrefFor("product", pid)} className="text-primary hover:underline">
                        {p.name}
                      </Link>
                    ) : (
                      <span>{p?.name ?? "A product outside your range"}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
          {related.length ? (
            <section aria-labelledby="kb-related">
              <h2 id="kb-related" className="mb-2 text-sm font-medium">
                Related
              </h2>
              <ul className="space-y-2">
                {related.map((r) => (
                  <li key={r.id}>
                    <KnowledgeCard item={r} />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

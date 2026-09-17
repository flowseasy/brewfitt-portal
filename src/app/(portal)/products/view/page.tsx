"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeftIcon, ChatsCircleIcon, CheckIcon, FileIcon, FilePdfIcon, PencilSimpleIcon, TagIcon } from "@phosphor-icons/react";
import { ThreadView } from "@/components/messages/thread-view";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/states";
import { StatusPill } from "@/components/shared/status-pill";
import { isUpload, SubmissionImage, SupplierProductSheet, uploadName } from "@/components/supplier/submission-forms";
import { Button } from "@/components/ui/button";
import { usePersonaKey } from "@/features/session/use-session";
import { api, queryKeys } from "@/lib/api";
import { daysFromToday, formatDate, formatMoney, plural } from "@/lib/format";
import { hrefFor } from "@/lib/links";
import { OFFER_STATUS, SUBMISSION_STATUS } from "@/lib/status";
import { cn } from "@/lib/utils";
import type { SupplierProduct } from "@/types";

export default function ProductViewPage() {
  return (
    <Suspense fallback={<LoadingState rows={5} />}>
      <ProductView />
    </Suspense>
  );
}

function Back() {
  return (
    <Link href="/products" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeftIcon className="size-4" aria-hidden />
      Products and offers
    </Link>
  );
}

const STEPS: { status: SupplierProduct["status"]; label: string }[] = [
  { status: "submitted", label: "Submitted" },
  { status: "under-review", label: "Under review" },
  { status: "approved", label: "Decision" },
];

function ProductView() {
  const id = useSearchParams().get("id") ?? "";
  const key = usePersonaKey();
  const submissions = useQuery({ queryKey: queryKeys.supplierProducts(key), queryFn: () => api.supplierProducts.list() });
  const offers = useQuery({ queryKey: queryKeys.offers(key), queryFn: () => api.supplierProducts.offers() });
  const priceList = useQuery({ queryKey: queryKeys.priceList(key), queryFn: () => api.priceList.get() });
  const categories = useQuery({ queryKey: queryKeys.categories(key), queryFn: () => api.products.categories() });
  const [editOpen, setEditOpen] = useState(false);
  const range = useMemo(() => (priceList.data?.lines ?? []).map((l) => l.product), [priceList.data]);

  if (id.startsWith("off_")) {
    if (offers.isPending) return <LoadingState rows={3} />;
    const offer = offers.data?.find((o) => o.id === id);
    if (!offer) return <EmptyState icon={TagIcon} title="This offer could not be found" />;
    const status = offer.status === "approved" && daysFromToday(offer.validTo) < 0 ? "expired" : offer.status;
    return (
      <div>
        <Back />
        <PageHeader
          eyebrow="Offer"
          title={
            <span className="flex flex-wrap items-center gap-3">
              {formatMoney(offer.price)} per unit
              <StatusPill tone={OFFER_STATUS[status].tone}>{OFFER_STATUS[status].label}</StatusPill>
            </span>
          }
          description={`${offer.description} Valid ${formatDate(offer.validFrom)} to ${formatDate(offer.validTo)}.`}
        />
        <section className="rounded-2xl border bg-card p-5" aria-labelledby="offer-products">
          <h2 id="offer-products" className="mb-3 font-medium">
            {plural(offer.productIds.length, "product")}
          </h2>
          <ul className="divide-y">
            {offer.productIds.map((pid) => {
              const line = priceList.data?.lines.find((l) => l.productId === pid);
              return (
                <li key={pid} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span>{line?.product.name ?? pid}</span>
                  {line ? (
                    <span className="text-muted-foreground tabular-nums">
                      agreed {formatMoney(line.price)} → offer {formatMoney(offer.price)}
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    );
  }

  if (submissions.isPending) return <LoadingState rows={5} label="Loading submission" />;
  if (submissions.isError) return <ErrorState error={submissions.error} onRetry={() => submissions.refetch()} />;
  const sp = submissions.data.find((x) => x.id === id);
  if (!sp) {
    return (
      <div>
        <Back />
        <EmptyState icon={TagIcon} title="This submission could not be found" />
      </div>
    );
  }
  const s = SUBMISSION_STATUS[sp.status];
  const reached = { submitted: 0, "under-review": 1, approved: 2, rejected: 2 }[sp.status];
  const canEdit = sp.status === "submitted" || sp.status === "rejected";
  const category = categories.data?.find((c) => c.id === sp.category);

  return (
    <div>
      <Back />
      <PageHeader
        eyebrow="Product submission"
        title={
          <span className="flex flex-wrap items-center gap-3">
            {sp.name}
            <StatusPill tone={s.tone}>{s.label}</StatusPill>
          </span>
        }
        description={`Submitted ${formatDate(sp.submittedAt)} · last updated ${formatDate(sp.updatedAt)}`}
        actions={
          canEdit ? (
            <Button onClick={() => setEditOpen(true)}>
              <PencilSimpleIcon aria-hidden />
              {sp.status === "rejected" ? "Update and resubmit" : "Edit submission"}
            </Button>
          ) : null
        }
      />

      <ol className="mb-6 flex items-center gap-2 rounded-2xl border bg-card p-4" aria-label={`Review progress: ${s.label}`}>
        {STEPS.map((step, i) => {
          const done = i <= reached;
          const label = i === 2 ? (sp.status === "rejected" ? "Rejected" : sp.status === "approved" ? "Approved" : "Decision") : step.label;
          return (
            <li key={step.status} className="flex flex-1 items-center gap-2">
              <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-full border-2 text-xs", done ? (i === 2 && sp.status === "rejected" ? "border-danger bg-danger text-white" : "border-primary bg-primary text-primary-foreground") : "border-border text-muted-foreground")}>
                {done ? <CheckIcon weight="bold" className="size-3.5" aria-hidden /> : i + 1}
              </span>
              <span className={cn("text-sm", done ? "font-medium" : "text-muted-foreground")}>{label}</span>
              {i < STEPS.length - 1 ? <span aria-hidden className={cn("h-0.5 flex-1", i < reached ? "bg-primary" : "bg-border")} /> : null}
            </li>
          );
        })}
      </ol>

      {sp.reviewNote ? (
        <div className={cn("mb-6 rounded-2xl border p-4 text-sm", sp.status === "rejected" ? "border-danger/30 bg-danger-subtle" : "border-success/30 bg-success-subtle")}>
          <p className="font-medium">{sp.status === "rejected" ? "Why it was not approved" : "Brewfitt's review"}</p>
          <p className="mt-1">{sp.reviewNote}</p>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-6">
          <section aria-labelledby="sp-images" className="rounded-2xl border bg-card p-5">
            <h2 id="sp-images" className="mb-3 font-medium">
              Images and branding
            </h2>
            <ul className="flex flex-wrap gap-3">
              {sp.images.map((src) => (
                <li key={src} className="w-24">
                  <SubmissionImage src={src} className="size-24 rounded-xl border" />
                  {isUpload(src) ? <p className="mt-1 truncate text-xs text-muted-foreground">{uploadName(src)}</p> : null}
                </li>
              ))}
            </ul>
            {sp.brandingAssets.length ? (
              <ul className="mt-4 flex flex-wrap gap-2">
                {sp.brandingAssets.map((a) => (
                  <li key={a} className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs">
                    <FileIcon aria-hidden />
                    {a}
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
          <section aria-labelledby="sp-thread" className="rounded-2xl border bg-card p-4 sm:p-5">
            <h2 id="sp-thread" className="mb-4 flex items-center gap-2 font-medium">
              <ChatsCircleIcon className="size-5 text-primary" aria-hidden />
              Conversation with the buyer
            </h2>
            <ThreadView threadId={sp.threadId} compact />
          </section>
        </div>
        <aside className="space-y-4">
          <section aria-label="Product data" className="rounded-2xl border bg-card p-5">
            <dl className="space-y-2 text-sm">
              {[
                ["SKU", sp.sku],
                ["Category", category?.name ?? "Not set"],
                ["Cost price", formatMoney(sp.costPrice)],
                ["Lead time", plural(sp.leadTimeDays, "working day")],
                ["Minimum order", String(sp.minimumOrder)],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="text-right font-medium">{value}</dd>
                </div>
              ))}
            </dl>
          </section>
          {sp.specSheetDocumentId ? (
            <Link href={hrefFor("document", sp.specSheetDocumentId)} className="flex items-center gap-3 rounded-2xl border bg-card p-4 text-sm hover:border-primary/40">
              <FilePdfIcon className="size-5 text-primary" aria-hidden />
              Spec sheet
            </Link>
          ) : (
            <p className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">No spec sheet attached. Add one when you resubmit to speed up approval.</p>
          )}
          {sp.status === "approved" && sp.productId ? <p className="rounded-2xl bg-success-subtle p-4 text-sm">Approved and live in Brewfitt&apos;s catalogue in TOTA360v5.</p> : null}
        </aside>
      </div>

      {canEdit ? <SupplierProductSheet open={editOpen} onOpenChange={setEditOpen} categories={categories.data ?? []} range={range} existing={sp} /> : null}
    </div>
  );
}

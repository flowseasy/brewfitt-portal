"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  EyeIcon,
  FilePdfIcon,
  WarningIcon,
} from "@phosphor-icons/react";
import { UploadDialog } from "@/components/account/account-panels";
import {
  DOCUMENT_CATEGORY,
  RECORD_PREVIEW,
  hasPendingRenewal,
  isExpiring,
} from "@/components/documents/document-parts";
import { ApprovalPill, ExpiryPill, fileSize } from "@/components/shared/document-card";
import {
  DocumentFooter,
  DocumentHeader,
  DocumentParty,
  PdfPreview,
} from "@/components/shared/pdf-preview";
import { PageHeader } from "@/components/shared/page-header";
import { ErrorState, LoadingState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { useIsSupplier, useMe, usePersonaKey } from "@/features/session/use-session";
import { api, queryKeys } from "@/lib/api";
import { daysFromToday, formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { hrefFor } from "@/lib/links";
import type { Document } from "@/types";

export default function DocumentViewPage() {
  return (
    <Suspense fallback={<LoadingState rows={5} />}>
      <DocumentView />
    </Suspense>
  );
}

const RELATED_LABEL: Partial<Record<NonNullable<Document["relatedType"]>, string>> = {
  quote: "Open the quote",
  "sales-order": "Open the order",
  "purchase-order": "Open the purchase order",
  delivery: "Open the delivery",
  invoice: "Open the invoice",
  payment: "Open the payment",
  account: "Open your account",
  product: "Open the product",
  "knowledge-item": "Open in the knowledge centre",
  "supplier-product": "Open the product submission",
};

function DocumentView() {
  const id = useSearchParams().get("id") ?? "";
  const key = usePersonaKey();
  const me = useMe();
  const isSupplier = useIsSupplier();
  const document = useQuery({
    queryKey: queryKeys.document(key, id),
    queryFn: () => api.documents.get(id),
    enabled: !!id,
  });
  const all = useQuery({
    queryKey: queryKeys.documents(key),
    queryFn: () => api.documents.list(),
    enabled: isSupplier,
  });
  const [previewOpen, setPreviewOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);

  if (document.isPending) return <LoadingState rows={4} label="Loading document" />;
  if (document.isError)
    return <ErrorState error={document.error} onRetry={() => document.refetch()} />;

  const d = document.data;
  const names = new Map<string, string>();
  if (me.data) {
    names.set(me.data.account.id, me.data.account.name);
    if (me.data.group)
      for (const a of [me.data.group.account, ...me.data.group.sites]) names.set(a.id, a.name);
  }
  const owner = d.ownerAccountId
    ? (names.get(d.ownerAccountId) ?? "Your account")
    : "Brewfitt Limited";
  const relatedHref =
    d.relatedType && d.relatedId && !(isSupplier && d.relatedType === "product")
      ? hrefFor(d.relatedType, d.relatedId)
      : null;
  const onRecord = RECORD_PREVIEW.has(d.category) && relatedHref;
  const renewable =
    isSupplier &&
    d.ownerAccountId &&
    (d.category === "insurance" || d.category === "compliance") &&
    isExpiring(d, daysFromToday);
  const renewalPending = renewable && hasPendingRenewal(d, all.data ?? []);

  const facts: [string, React.ReactNode][] = [
    ["Category", DOCUMENT_CATEGORY[d.category]],
    ["Owner", owner],
    ["File", `${d.fileType.toUpperCase()} · ${fileSize(d.fileSize)}`],
    ["Updated", formatDateTime(d.modifiedAt)],
  ];
  if (d.expiresAt) facts.push(["Expiry", <ExpiryPill key="e" expiresAt={d.expiresAt} />]);
  if (d.approvalStatus && d.ownerAccountId && d.category !== "agreement")
    facts.push(["Brewfitt approval", <ApprovalPill key="a" status={d.approvalStatus} />]);

  return (
    <div>
      <Link
        href="/documents"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" aria-hidden />
        Documents
      </Link>
      <PageHeader
        eyebrow={DOCUMENT_CATEGORY[d.category]}
        title={<span className="break-words">{d.name}</span>}
        actions={
          <>
            {onRecord ? (
              <Button asChild>
                <Link href={`${relatedHref}&pdf=1`}>
                  <EyeIcon aria-hidden />
                  Preview PDF
                </Link>
              </Button>
            ) : (
              <Button onClick={() => setPreviewOpen(true)}>
                <EyeIcon aria-hidden />
                Preview
              </Button>
            )}
            {relatedHref ? (
              <Button asChild variant="outline">
                <Link href={relatedHref}>
                  {RELATED_LABEL[d.relatedType!] ?? "Open related record"}
                  <ArrowRightIcon aria-hidden />
                </Link>
              </Button>
            ) : null}
          </>
        }
      />

      {renewalPending ? (
        <div role="status" className="mb-6 rounded-2xl border bg-info-subtle p-4 text-sm">
          A renewed certificate has been uploaded and is awaiting Brewfitt approval.
        </div>
      ) : renewable ? (
        <div
          role="status"
          className="mb-6 flex flex-col gap-3 rounded-2xl border border-warning/40 bg-warning-subtle p-4 sm:flex-row sm:items-center"
        >
          <WarningIcon className="size-5 shrink-0 text-warning" aria-hidden />
          <p className="flex-1 text-sm">
            {daysFromToday(d.expiresAt!) < 0
              ? "This certificate has expired. Brewfitt needs a current certificate on file for your supplier record."
              : "This certificate expires soon. Upload the renewal before it lapses."}
          </p>
          <Button size="sm" onClick={() => setUploadOpen(true)}>
            Upload renewal
          </Button>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <button
          type="button"
          onClick={() => (onRecord ? undefined : setPreviewOpen(true))}
          disabled={!!onRecord}
          className="group relative hidden min-h-80 overflow-hidden rounded-2xl border bg-muted/50 p-6 text-left enabled:cursor-zoom-in sm:block"
          aria-label={onRecord ? "Document thumbnail" : "Open preview"}
        >
          <div className="mx-auto aspect-[210/297] max-w-sm rounded bg-white p-6 shadow-sm ring-1 ring-black/5 transition group-enabled:group-hover:-translate-y-0.5 group-enabled:group-hover:shadow-md">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
              <FilePdfIcon className="size-6 text-[#1A75BC]" aria-hidden />
              <span className="text-[10px] font-semibold tracking-wide text-neutral-500 uppercase">
                {DOCUMENT_CATEGORY[d.category]}
              </span>
            </div>
            <p className="mt-4 line-clamp-3 text-sm font-semibold text-neutral-900">
              {d.name.replace(/\.(pdf|jpg|png|docx|xlsx|mp4)$/, "")}
            </p>
            <div className="mt-4 space-y-2" aria-hidden>
              {[92, 78, 85, 60, 88, 70, 40].map((w, i) => (
                <div key={i} className="h-1.5 rounded bg-neutral-100" style={{ width: `${w}%` }} />
              ))}
            </div>
          </div>
        </button>
        <aside>
          <dl className="divide-y rounded-2xl border bg-card">
            {facts.map(([label, value]) => (
              <div
                key={label}
                className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
              >
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="text-right font-medium">{value}</dd>
              </div>
            ))}
          </dl>
          {onRecord ? (
            <p className="mt-3 text-sm text-muted-foreground">
              The PDF is produced from the live record, so the preview always matches its current
              status.
            </p>
          ) : null}
        </aside>
      </div>

      {!onRecord ? (
        <PdfPreview open={previewOpen} onOpenChange={setPreviewOpen} title={d.name}>
          {previewOpen ? <PreviewBody doc={d} owner={owner} /> : null}
        </PdfPreview>
      ) : null}
      {isSupplier ? <UploadDialog open={uploadOpen} onOpenChange={setUploadOpen} /> : null}
    </div>
  );
}

function PreviewBody({ doc: d, owner }: { doc: Document; owner: string }) {
  const title = d.name.replace(/\.(pdf|jpg|png|docx|xlsx|mp4)$/, "");
  switch (d.category) {
    case "insurance":
    case "compliance":
      return (
        <>
          <DocumentHeader
            kind={
              d.category === "insurance" ? "Certificate of insurance" : "Compliance certificate"
            }
            date={d.modifiedAt}
            meta={d.expiresAt ? [{ label: "Valid until", value: formatDate(d.expiresAt) }] : []}
          />
          <div className="my-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
            <DocumentParty
              label={d.category === "insurance" ? "Insured" : "Certified organisation"}
              lines={[owner]}
            />
            <DocumentParty label="Certificate" lines={[title.replace(`${owner} `, "")]} />
          </div>
          <p>
            {d.category === "insurance"
              ? "This certificate confirms that the insured holds the cover named above"
              : "This certificate confirms that the organisation holds the certification named above"}
            {d.expiresAt ? `, valid until ${formatDate(d.expiresAt)}` : ""}.
          </p>
          {d.ownerAccountId ? (
            <p className="mt-3">
              Status with Brewfitt:{" "}
              {d.approvalStatus === "approved"
                ? "checked and approved"
                : d.approvalStatus === "rejected"
                  ? "rejected, please upload a replacement"
                  : "awaiting review"}
              .
            </p>
          ) : null}
          <DocumentFooter note="Summary of the certificate held on file in TOTA360v5." />
        </>
      );
    case "agreement":
      return (
        <>
          <DocumentHeader
            kind="Agreement"
            date={d.modifiedAt}
            meta={[
              {
                label: "Term",
                value: d.expiresAt ? `Until ${formatDate(d.expiresAt)}` : "Rolling",
              },
            ]}
          />
          <h2 className="mt-6 text-base font-semibold">{title}</h2>
          <div className="my-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
            <DocumentParty label="Between" lines={["Brewfitt Limited"]} />
            <DocumentParty label="And" lines={[owner]} />
          </div>
          <p>
            Signed on {formatDate(d.modifiedAt)} by both parties.{" "}
            {d.expiresAt
              ? `The agreement runs until ${formatDate(d.expiresAt)} and is reviewed with your account manager before renewal.`
              : "The agreement continues until either party gives notice."}
          </p>
          <DocumentFooter note="Signed copy held in TOTA360v5." />
        </>
      );
    case "remittance":
      return <RemittancePreview doc={d} owner={owner} />;
    case "delivery-note":
    case "proof-of-delivery":
      return <DeliveryPreview doc={d} />;
    case "spec":
    case "manual":
      return <ProductDocPreview doc={d} title={title} />;
    default:
      return (
        <>
          <DocumentHeader kind={DOCUMENT_CATEGORY[d.category]} date={d.modifiedAt} />
          <h2 className="mt-6 text-base font-semibold">{title}</h2>
          <p className="mt-3">
            Published by Brewfitt Limited. This version is dated {formatDate(d.modifiedAt)}
            {d.expiresAt ? ` and is valid until ${formatDate(d.expiresAt)}` : ""}.
          </p>
          <DocumentFooter />
        </>
      );
  }
}

function RemittancePreview({ doc: d, owner }: { doc: Document; owner: string }) {
  const key = usePersonaKey();
  const payments = useQuery({
    queryKey: queryKeys.payments(key),
    queryFn: () => api.invoices.payments(),
  });
  const invoices = useQuery({
    queryKey: queryKeys.invoices(key),
    queryFn: () => api.invoices.list(),
  });
  const p = payments.data?.find((x) => x.id === d.relatedId);
  if (payments.isPending || invoices.isPending) return <LoadingState rows={3} />;
  if (!p) return <p>The payment for this remittance is no longer available.</p>;
  const number = new Map((invoices.data ?? []).map((i) => [i.id, i.number]));
  return (
    <>
      <DocumentHeader
        kind="Remittance advice"
        date={p.paidAt}
        meta={[{ label: "Reference", value: p.reference }]}
      />
      <div className="my-6">
        <DocumentParty label="Paid to" lines={[owner]} />
      </div>
      <table className="w-full text-[12px]">
        <thead>
          <tr className="border-b border-neutral-300 text-left text-neutral-500">
            <th className="py-1.5 font-medium">Invoice</th>
            <th className="py-1.5 text-right font-medium">Amount paid</th>
          </tr>
        </thead>
        <tbody>
          {p.allocatedTo.map((a) => (
            <tr key={a.invoiceId} className="border-b border-neutral-100">
              <td className="py-1.5">{number.get(a.invoiceId) ?? a.invoiceId}</td>
              <td className="py-1.5 text-right">{formatMoney(a.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-4 ml-auto flex w-64 justify-between border-t border-neutral-300 pt-1 text-sm font-semibold">
        <span>Total paid</span>
        <span>{formatMoney(p.amount)}</span>
      </div>
      <DocumentFooter note="Paid by bank transfer to the account held on your supplier record." />
    </>
  );
}

function DeliveryPreview({ doc: d }: { doc: Document }) {
  const key = usePersonaKey();
  const delivery = useQuery({
    queryKey: [...queryKeys.deliveries(key), d.relatedId],
    queryFn: () => api.deliveries.get(d.relatedId ?? ""),
    enabled: !!d.relatedId,
  });
  const products = useQuery({
    queryKey: queryKeys.products(key),
    queryFn: () => api.products.list(),
  });
  if (delivery.isPending) return <LoadingState rows={3} />;
  if (delivery.isError) return <p>The delivery for this document is no longer available.</p>;
  const del = delivery.data;
  const name = new Map((products.data ?? []).map((p) => [p.id, p]));
  const pod = d.category === "proof-of-delivery";
  return (
    <>
      <DocumentHeader
        kind={pod ? "Proof of delivery" : "Delivery note"}
        number={del.number}
        date={pod ? (del.deliveredAt ?? d.modifiedAt) : (del.dispatchedAt ?? d.modifiedAt)}
        meta={[
          ...(del.carrier ? [{ label: "Carrier", value: del.carrier }] : []),
          ...(del.trackingRef ? [{ label: "Tracking", value: del.trackingRef }] : []),
        ]}
      />
      <table className="mt-6 w-full text-[12px]">
        <thead>
          <tr className="border-b border-neutral-300 text-left text-neutral-500">
            <th className="py-1.5 font-medium">SKU</th>
            <th className="py-1.5 font-medium">Description</th>
            <th className="py-1.5 text-right font-medium">Qty</th>
          </tr>
        </thead>
        <tbody>
          {del.lines.map((l) => (
            <tr key={l.productId} className="border-b border-neutral-100">
              <td className="py-1.5 pr-2 font-mono">{name.get(l.productId)?.sku}</td>
              <td className="py-1.5 pr-2">{name.get(l.productId)?.name ?? "Item"}</td>
              <td className="py-1.5 text-right">{l.qty}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {pod && del.deliveredAt ? (
        <p className="mt-6">
          Received in good condition and signed for on {formatDateTime(del.deliveredAt)}.
        </p>
      ) : null}
      <DocumentFooter
        note={
          pod
            ? "Signature captured on the driver's handset."
            : "Please check goods on arrival and report any shortage within 48 hours."
        }
      />
    </>
  );
}

function ProductDocPreview({ doc: d, title }: { doc: Document; title: string }) {
  const key = usePersonaKey();
  const relatedId = d.relatedId ?? "";
  const product = useQuery({
    queryKey: queryKeys.product(key, relatedId),
    queryFn: () => api.products.get(relatedId),
    enabled: d.relatedType === "product",
  });
  const article = useQuery({
    queryKey: queryKeys.knowledgeItem(key, relatedId),
    queryFn: () => api.knowledge.get(relatedId),
    enabled: d.relatedType === "knowledge-item",
  });
  const submissions = useQuery({
    queryKey: queryKeys.supplierProducts(key),
    queryFn: () => api.supplierProducts.list(),
    enabled: d.relatedType === "supplier-product",
  });
  const submission = submissions.data?.find((s) => s.id === relatedId);
  const kind = d.category === "spec" ? "Specification sheet" : "Manual";

  if (product.data) {
    const p = product.data;
    return (
      <>
        <DocumentHeader kind={kind} number={p.sku} date={d.modifiedAt} />
        <h2 className="mt-6 text-base font-semibold">{p.name}</h2>
        <p className="mt-3">{p.description}</p>
        <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-2 text-[12px]">
          <dt className="text-neutral-500">SKU</dt>
          <dd className="font-mono">{p.sku}</dd>
          <dt className="text-neutral-500">Unit</dt>
          <dd>
            {p.unit}
            {p.packSize > 1 ? `, pack of ${p.packSize}` : ""}
          </dd>
          <dt className="text-neutral-500">Typical lead time</dt>
          <dd>{p.leadTimeDays} working days</dd>
        </dl>
        <DocumentFooter note="Specifications may change; check with Brewfitt before ordering for a critical install." />
      </>
    );
  }
  if (article.data) {
    const k = article.data;
    return (
      <>
        <DocumentHeader kind={kind} date={d.modifiedAt} />
        <h2 className="mt-6 text-base font-semibold">{k.title}</h2>
        <p className="mt-3 font-medium">{k.summary}</p>
        {(k.body ?? []).map((para, i) => (
          <p key={i} className="mt-3">
            {para}
          </p>
        ))}
        <DocumentFooter />
      </>
    );
  }
  if (submission) {
    return (
      <>
        <DocumentHeader kind={kind} number={submission.sku} date={d.modifiedAt} />
        <h2 className="mt-6 text-base font-semibold">{submission.name}</h2>
        <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-2 text-[12px]">
          <dt className="text-neutral-500">SKU</dt>
          <dd className="font-mono">{submission.sku}</dd>
          <dt className="text-neutral-500">Minimum order</dt>
          <dd>{submission.minimumOrder}</dd>
          <dt className="text-neutral-500">Lead time</dt>
          <dd>{submission.leadTimeDays} working days</dd>
        </dl>
        <DocumentFooter note="Submitted to Brewfitt for approval." />
      </>
    );
  }
  if (product.isPending && d.relatedType === "product") return <LoadingState rows={3} />;
  if (article.isPending && d.relatedType === "knowledge-item") return <LoadingState rows={3} />;
  if (submissions.isPending && d.relatedType === "supplier-product")
    return <LoadingState rows={3} />;
  return (
    <>
      <DocumentHeader kind={kind} date={d.modifiedAt} />
      <h2 className="mt-6 text-base font-semibold">{title}</h2>
      <DocumentFooter />
    </>
  );
}

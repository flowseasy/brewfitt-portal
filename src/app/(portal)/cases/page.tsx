"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { LifebuoyIcon, PlusIcon } from "@phosphor-icons/react";
import { CASE_KIND_LABEL, RaiseCaseSheet, supportName } from "@/components/cases/case-sheet";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/states";
import { StatusPill } from "@/components/shared/status-pill";
import { StatusTabs } from "@/components/shared/status-tabs";
import { Button } from "@/components/ui/button";
import { useIsSupplier, usePersonaKey } from "@/features/session/use-session";
import { api, queryKeys } from "@/lib/api";
import { formatDate, formatSince } from "@/lib/format";
import { hrefFor } from "@/lib/links";
import { CASE_STATUS, CASE_URGENCY, OPEN_CASE_STATUSES } from "@/lib/status";

export default function CasesPage() {
  return (
    <Suspense fallback={<LoadingState rows={5} />}>
      <Cases />
    </Suspense>
  );
}

type Tab = "open" | "resolved" | "all";

function Cases() {
  const key = usePersonaKey();
  const supplier = useIsSupplier();
  const raiseLabel = supplier ? "Raise an issue" : "Raise a case";
  const params = useSearchParams();
  const cases = useQuery({ queryKey: queryKeys.cases(key), queryFn: () => api.cases.list() });
  const priceList = useQuery({
    queryKey: queryKeys.priceList(key),
    queryFn: () => api.priceList.get(),
  });
  const [tab, setTab] = useState<Tab>("open");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (params.get("new")) setOpen(true);
  }, [params]);

  const all = cases.data ?? [];
  const inTab = (status: (typeof all)[number]["status"], t: Tab) =>
    t === "all"
      ? true
      : t === "open"
        ? OPEN_CASE_STATUSES.includes(status)
        : !OPEN_CASE_STATUSES.includes(status);
  const filtered = all.filter((c) => inTab(c.status, tab));
  const productName = new Map(
    (priceList.data?.lines ?? []).map((l) => [l.productId, l.product.name]),
  );

  return (
    <div>
      <PageHeader
        title={supportName(supplier)}
        description={
          supplier
            ? "Raise anything you need Brewfitt to sort out: purchase orders, payments and remittances, delivery bookings or product listings."
            : "After-sales faults, warranty claims, returns and technical questions, with engineer notes and resolution."
        }
        actions={
          <Button onClick={() => setOpen(true)}>
            <PlusIcon aria-hidden />
            {raiseLabel}
          </Button>
        }
      />
      <StatusTabs
        tabs={[
          {
            value: "open" as Tab,
            label: "Open",
            count: all.filter((c) => inTab(c.status, "open")).length,
          },
          {
            value: "resolved" as Tab,
            label: "Resolved or closed",
            count: all.filter((c) => inTab(c.status, "resolved")).length,
          },
          { value: "all" as Tab, label: "All", count: all.length },
        ]}
        value={tab}
        onChange={setTab}
      />
      {cases.isPending ? (
        <LoadingState rows={4} label="Loading support" />
      ) : cases.isError ? (
        <ErrorState error={cases.error} onRetry={() => cases.refetch()} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={LifebuoyIcon}
          title={
            tab === "open"
              ? supplier
                ? "No issues open"
                : "No cases open"
              : supplier
                ? "No issues here"
                : "No cases here"
          }
          description={
            tab === "open"
              ? supplier
                ? "If a purchase order, payment or delivery needs sorting, raise an issue and Brewfitt's buyer will pick it up."
                : "If something is not pouring right, raise a case and Brewfitt's technical team will pick it up."
              : undefined
          }
          action={
            tab === "open" ? <Button onClick={() => setOpen(true)}>{raiseLabel}</Button> : undefined
          }
        />
      ) : (
        <ul className="space-y-2">
          {filtered.map((c) => (
            <li key={c.id}>
              <Link
                href={hrefFor("case", c.id)}
                className="flex flex-col gap-2 rounded-2xl border bg-card p-4 transition hover:border-primary/40 sm:flex-row sm:items-center"
              >
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{c.subject}</span>
                    <StatusPill tone={CASE_STATUS[c.status].tone}>
                      {CASE_STATUS[c.status].label}
                    </StatusPill>
                    {c.urgency === "high" || c.urgency === "critical" ? (
                      <StatusPill tone={CASE_URGENCY[c.urgency].tone}>
                        {CASE_URGENCY[c.urgency].label}
                      </StatusPill>
                    ) : null}
                  </p>
                  <p className="mt-1 truncate text-sm text-muted-foreground">
                    {c.number} · {CASE_KIND_LABEL[c.kind]}
                    {c.productId && productName.get(c.productId)
                      ? ` · ${productName.get(c.productId)}`
                      : ""}{" "}
                    · raised {formatDate(c.createdAt)}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground">
                  Updated {formatSince(c.updatedAt)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <RaiseCaseSheet
        open={open}
        onOpenChange={setOpen}
        defaults={{
          orderId: params.get("orderId") ?? undefined,
          jobId: params.get("jobId") ?? undefined,
          productId: params.get("productId") ?? undefined,
          purchaseOrderId: params.get("purchaseOrderId") ?? undefined,
          invoiceId: params.get("invoiceId") ?? undefined,
        }}
      />
    </div>
  );
}

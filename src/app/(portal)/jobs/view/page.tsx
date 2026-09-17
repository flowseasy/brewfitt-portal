"use client";

import { Suspense, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeftIcon, CalendarIcon, CheckCircleIcon, LifebuoyIcon, MapPinIcon, PackageIcon, ShieldCheckIcon, UserIcon, WrenchIcon } from "@phosphor-icons/react";
import { formatAddress } from "@/components/account/addresses";
import { PageHeader } from "@/components/shared/page-header";
import { ErrorState, LoadingState } from "@/components/shared/states";
import { StatusPill } from "@/components/shared/status-pill";
import { Button } from "@/components/ui/button";
import { usePersonaKey } from "@/features/session/use-session";
import { api, queryKeys } from "@/lib/api";
import { daysFromToday, formatDate, formatDateTime } from "@/lib/format";
import { hrefFor } from "@/lib/links";
import { CASE_STATUS, JOB_STATUS } from "@/lib/status";
import { cn } from "@/lib/utils";

export default function JobViewPage() {
  return (
    <Suspense fallback={<LoadingState rows={5} />}>
      <JobView />
    </Suspense>
  );
}

function JobView() {
  const id = useSearchParams().get("id") ?? "";
  const key = usePersonaKey();
  const job = useQuery({ queryKey: queryKeys.job(key, id), queryFn: () => api.jobs.get(id), enabled: !!id });
  const addresses = useQuery({ queryKey: queryKeys.addresses(key), queryFn: () => api.account.addresses() });
  const orders = useQuery({ queryKey: queryKeys.salesOrders(key), queryFn: () => api.orders.salesOrders() });
  const priceList = useQuery({ queryKey: queryKeys.priceList(key), queryFn: () => api.priceList.get() });
  const cases = useQuery({ queryKey: queryKeys.cases(key), queryFn: () => api.cases.list() });
  const product = useMemo(() => new Map((priceList.data?.lines ?? []).map((l) => [l.productId, l.product])), [priceList.data]);

  if (job.isPending) return <LoadingState rows={5} label="Loading job" />;
  if (job.isError) return <ErrorState error={job.error} onRetry={() => job.refetch()} />;

  const j = job.data;
  const site = addresses.data?.find((a) => a.id === j.siteAddressId);
  const order = orders.data?.find((o) => o.id === j.orderId);
  const jobCases = (cases.data ?? []).filter((c) => c.jobId === j.id);
  const warrantyActive = j.warrantyEnd ? daysFromToday(j.warrantyEnd) >= 0 : false;
  const steps = [
    { label: "Scheduled", done: true, at: j.scheduledDate },
    { label: "In progress", done: j.status !== "scheduled", at: null },
    { label: "Completed", done: j.status === "completed" || j.status === "signed-off", at: null },
    { label: "Signed off", done: j.status === "signed-off", at: j.signedOffAt },
  ];

  return (
    <div>
      <Link href="/jobs" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" aria-hidden />
        Jobs
      </Link>
      <PageHeader
        eyebrow="Supply and install"
        title={
          <span className="flex flex-wrap items-center gap-3">
            {j.name}
            <StatusPill tone={JOB_STATUS[j.status].tone}>{JOB_STATUS[j.status].label}</StatusPill>
          </span>
        }
        description={`${formatDate(j.scheduledDate)} with ${j.engineerName}`}
        actions={
          <Button asChild variant="outline">
            <Link href={`/cases?new=1&jobId=${j.id}&orderId=${j.orderId}`}>
              <LifebuoyIcon aria-hidden />
              Raise a case
            </Link>
          </Button>
        }
      />

      <section aria-label="Job progress" className="mb-6 rounded-2xl border bg-card p-5">
        <ol className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {steps.map((s) => (
            <li key={s.label} className="flex items-center gap-2">
              <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-full border-2", s.done ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground")}>
                {s.done ? <CheckCircleIcon weight="fill" className="size-4" aria-hidden /> : <span className="size-1.5 rounded-full bg-current" />}
              </span>
              <span className="text-sm">
                <span className={cn("block", s.done ? "font-medium" : "text-muted-foreground")}>{s.label}</span>
                {s.at ? <span className="block text-xs text-muted-foreground">{formatDate(s.at)}</span> : null}
              </span>
            </li>
          ))}
        </ol>
        <div className="mt-4 flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={j.completionPercent} aria-valuemin={0} aria-valuemax={100} aria-label="Job completion">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${j.completionPercent}%` }} />
          </div>
          <span className="text-sm font-medium tabular-nums">{j.completionPercent}% complete</span>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-6">
          <section aria-labelledby="installed" className="rounded-2xl border bg-card p-5">
            <h2 id="installed" className="mb-1 font-medium">
              Installed equipment
            </h2>
            <p className="mb-3 text-sm text-muted-foreground">From {order ? order.number : "the order"}, with warranty status per item.</p>
            {order ? (
              <ul className="divide-y">
                {order.lines.map((l) => {
                  const p = product.get(l.productId);
                  return (
                    <li key={l.productId} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                      <span className="min-w-0">
                        <span className="font-medium">{l.qty} ×</span> {p?.name ?? "Item"}
                      </span>
                      {j.warrantyEnd ? (
                        <StatusPill tone={warrantyActive ? "success" : "neutral"}>{warrantyActive ? `Warranty to ${formatDate(j.warrantyEnd)}` : "Warranty ended"}</StatusPill>
                      ) : (
                        <StatusPill tone="info">Warranty starts at sign-off</StatusPill>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <LoadingState rows={2} />
            )}
          </section>
          {jobCases.length ? (
            <section aria-labelledby="job-cases" className="rounded-2xl border bg-card p-5">
              <h2 id="job-cases" className="mb-3 font-medium">
                Cases about this install
              </h2>
              <ul className="space-y-2">
                {jobCases.map((c) => (
                  <li key={c.id}>
                    <Link href={hrefFor("case", c.id)} className="flex items-center justify-between gap-2 rounded-xl border p-3 text-sm hover:border-primary/40">
                      <span>
                        {c.number}: {c.subject}
                      </span>
                      <StatusPill tone={CASE_STATUS[c.status].tone}>{CASE_STATUS[c.status].label}</StatusPill>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
        <aside className="space-y-3">
          <Info icon={MapPinIcon} label="Site" value={site ? site.label : "Site"} detail={site ? formatAddress(site).join(", ") : undefined} />
          <Info icon={CalendarIcon} label="Scheduled" value={formatDate(j.scheduledDate)} />
          <Info icon={UserIcon} label="Engineer" value={j.engineerName} />
          <Info icon={ShieldCheckIcon} label="Warranty" value={j.warrantyStart && j.warrantyEnd ? `${formatDate(j.warrantyStart)} to ${formatDate(j.warrantyEnd)}` : "Starts when the install is signed off"} detail={j.signedOffAt ? `Signed off ${formatDateTime(j.signedOffAt)}` : undefined} />
          {order ? (
            <Link href={hrefFor("sales-order", order.id)} className="flex items-center gap-3 rounded-2xl border bg-card p-4 hover:border-primary/40">
              <PackageIcon className="size-5 text-primary" aria-hidden />
              <span className="text-sm">
                <span className="block text-xs text-muted-foreground">Order</span>
                <span className="font-medium">{order.number}</span>
              </span>
            </Link>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function Info({ icon: Icon, label, value, detail }: { icon: typeof WrenchIcon; label: string; value: string; detail?: string }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border bg-card p-4">
      <Icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
      <span className="min-w-0 text-sm">
        <span className="block text-xs text-muted-foreground">{label}</span>
        <span className="block font-medium">{value}</span>
        {detail ? <span className="block text-muted-foreground">{detail}</span> : null}
      </span>
    </div>
  );
}

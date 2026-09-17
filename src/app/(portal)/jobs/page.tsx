"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { MapPinIcon, WrenchIcon } from "@phosphor-icons/react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/states";
import { StatusPill } from "@/components/shared/status-pill";
import { StatusTabs } from "@/components/shared/status-tabs";
import { usePersonaKey } from "@/features/session/use-session";
import { api, queryKeys } from "@/lib/api";
import { daysFromToday, formatDate } from "@/lib/format";
import { hrefFor } from "@/lib/links";
import { JOB_STATUS } from "@/lib/status";
import type { Job } from "@/types";

type Tab = "upcoming" | "done" | "all";

export default function JobsPage() {
  const key = usePersonaKey();
  const jobs = useQuery({ queryKey: queryKeys.jobs(key), queryFn: () => api.jobs.list() });
  const addresses = useQuery({
    queryKey: queryKeys.addresses(key),
    queryFn: () => api.account.addresses(),
  });
  const [tab, setTab] = useState<Tab>("upcoming");
  const address = useMemo(
    () => new Map((addresses.data ?? []).map((a) => [a.id, a])),
    [addresses.data],
  );
  const all = jobs.data ?? [];
  const inTab = (j: Job, t: Tab) =>
    t === "all"
      ? true
      : t === "upcoming"
        ? j.status === "scheduled" || j.status === "in-progress"
        : j.status === "completed" || j.status === "signed-off";
  const filtered = all
    .filter((j) => inTab(j, tab))
    .sort((a, b) =>
      tab === "upcoming"
        ? a.scheduledDate.localeCompare(b.scheduledDate)
        : b.scheduledDate.localeCompare(a.scheduledDate),
    );

  return (
    <div>
      <PageHeader
        title="Jobs"
        description="Supply and install work Brewfitt is doing for you: dates, engineers, progress, sign-off and warranty."
      />
      <StatusTabs
        tabs={[
          {
            value: "upcoming" as Tab,
            label: "Scheduled and in progress",
            count: all.filter((j) => inTab(j, "upcoming")).length,
          },
          {
            value: "done" as Tab,
            label: "Completed",
            count: all.filter((j) => inTab(j, "done")).length,
          },
          { value: "all" as Tab, label: "All", count: all.length },
        ]}
        value={tab}
        onChange={setTab}
      />
      {jobs.isPending ? (
        <LoadingState rows={4} label="Loading jobs" />
      ) : jobs.isError ? (
        <ErrorState error={jobs.error} onRetry={() => jobs.refetch()} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={WrenchIcon}
          title={
            all.length === 0
              ? "No install jobs on your account"
              : tab === "upcoming"
                ? "Nothing scheduled"
                : "No completed jobs yet"
          }
          description={
            all.length === 0
              ? "When Brewfitt supplies and installs a system for you, the job appears here."
              : undefined
          }
        />
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {filtered.map((j) => {
            const site = address.get(j.siteAddressId);
            const days = daysFromToday(j.scheduledDate);
            return (
              <li key={j.id}>
                <Link
                  href={hrefFor("job", j.id)}
                  className="block h-full rounded-2xl border bg-card p-4 transition hover:border-primary/40"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium">{j.name}</p>
                    <StatusPill tone={JOB_STATUS[j.status].tone}>
                      {JOB_STATUS[j.status].label}
                    </StatusPill>
                  </div>
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                    <MapPinIcon className="size-4" aria-hidden />
                    {site ? `${site.label}, ${site.town}` : "Site"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(j.scheduledDate)}
                    {j.status === "scheduled" && days >= 0
                      ? ` (${days === 0 ? "today" : `in ${days} days`})`
                      : ""}{" "}
                    · {j.engineerName}
                  </p>
                  <div className="mt-3 flex items-center gap-3">
                    <div
                      className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
                      role="progressbar"
                      aria-valuenow={j.completionPercent}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label="Completion"
                    >
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${j.completionPercent}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {j.completionPercent}%
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

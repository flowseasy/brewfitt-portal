"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  CopyIcon,
  FadersHorizontalIcon,
  FileTextIcon,
  PencilSimpleIcon,
  PlusIcon,
} from "@phosphor-icons/react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/states";
import { StatusPill } from "@/components/shared/status-pill";
import { Button } from "@/components/ui/button";
import {
  describePoints,
  useConfiguratorData,
  VENUE_LABEL,
} from "@/features/configurator/use-configurator";
import { formatMoney, formatSince } from "@/lib/format";
import { hrefFor } from "@/lib/links";

export default function ConfiguratorPage() {
  const data = useConfiguratorData();
  const addressById = useMemo(
    () => new Map((data.addresses.data ?? []).map((a) => [a.id, a])),
    [data.addresses.data],
  );
  const list = data.configurations.data ?? [];

  return (
    <div>
      <PageHeader
        title="Configurator"
        description="Build a dispense system step by step at your prices, then request a quote. Brewfitt confirms installation and final pricing."
        actions={
          <Button asChild>
            <Link href="/configurator/build">
              <PlusIcon aria-hidden />
              New configuration
            </Link>
          </Button>
        }
      />

      {data.configurations.isPending ? (
        <LoadingState rows={4} label="Loading configurations" />
      ) : data.configurations.isError ? (
        <ErrorState
          error={data.configurations.error}
          onRetry={() => data.configurations.refetch()}
        />
      ) : list.length === 0 ? (
        <EmptyState
          icon={FadersHorizontalIcon}
          title="No saved configurations yet"
          description="Choose your venue, dispense points, font, cooling, gas and ancillaries. The bill of materials and price update as you go."
          action={
            <Button asChild>
              <Link href="/configurator/build">Start a configuration</Link>
            </Button>
          }
        />
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {list.map((c) => {
            const site = c.siteAddressId ? addressById.get(c.siteAddressId) : null;
            return (
              <li key={c.id} className="flex flex-col rounded-2xl border bg-card p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="truncate font-medium">
                      <Link href={`/configurator/build?id=${c.id}`} className="hover:underline">
                        {c.name}
                      </Link>
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {VENUE_LABEL[c.venueType]}
                      {site
                        ? ` · ${site.label}, ${site.town}`
                        : c.selections.venue.newSite
                          ? " · New site"
                          : ""}
                    </p>
                  </div>
                  <StatusPill tone={c.status === "quoted" ? "success" : "neutral"}>
                    {c.status === "quoted" ? "Quoted" : "Draft"}
                  </StatusPill>
                </div>
                <p className="mt-3 text-sm">{describePoints(c.selections.dispense.points)}</p>
                <p className="text-sm text-muted-foreground">
                  {c.lines.length} parts · updated {formatSince(c.updatedAt)}
                </p>
                <div className="mt-4 flex items-end justify-between gap-2">
                  <p>
                    <span className="block text-xs text-muted-foreground">Before VAT</span>
                    <span className="text-xl font-semibold tabular-nums">
                      {formatMoney(c.total, { whole: true })}
                    </span>
                  </p>
                  <div className="flex gap-1.5">
                    {c.status === "quoted" && c.quoteId ? (
                      <Button asChild size="sm" variant="outline">
                        <Link href={hrefFor("quote", c.quoteId)}>
                          <FileTextIcon aria-hidden />
                          Quote
                        </Link>
                      </Button>
                    ) : (
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/configurator/build?id=${c.id}`}>
                          <PencilSimpleIcon aria-hidden />
                          Edit
                        </Link>
                      </Button>
                    )}
                    <Button asChild size="sm" variant="ghost">
                      <Link
                        href={`/configurator/build?duplicate=${c.id}`}
                        aria-label={`Duplicate ${c.name}`}
                      >
                        <CopyIcon aria-hidden />
                      </Link>
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

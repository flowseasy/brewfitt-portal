"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CalculatorIcon, CopyIcon, PlusIcon, XIcon } from "@phosphor-icons/react";
import { toast } from "sonner";
import { CurrencyBadges, marginTone } from "@/components/internal/composite-parts";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/states";
import { StatusPill } from "@/components/shared/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCompositeBuilds, useInternalCustomers } from "@/features/internal/use-composite";
import { usePersonaKey } from "@/features/session/use-session";
import { api, errorMessage, queryKeys } from "@/lib/api";
import { BAND_LABEL, BAND_ORDER, bandFigures } from "@/lib/composite/pricing";
import { formatDate, formatMoney, formatSince } from "@/lib/format";
import { nativeSelectClass } from "@/components/internal/composite-parts";
import type { CompositeBuildSummary } from "@/types";

/** Composite Configurator (decision 14): Brewfitt staff's list of composite builds. */
export default function CompositeBuildsPage() {
  const builds = useCompositeBuilds();
  const [creating, setCreating] = useState(false);
  const list = builds.data ?? [];

  return (
    <div>
      <PageHeader
        title="Composite Configurator"
        description="Cost made-to-order items from catalogue products, components and supplier quotes, price each quantity band and add the result to a customer quote."
        actions={
          creating ? null : (
            <Button onClick={() => setCreating(true)}>
              <PlusIcon aria-hidden />
              New build
            </Button>
          )
        }
      />

      {creating ? <NewBuildForm onClose={() => setCreating(false)} /> : null}

      {builds.isPending ? (
        <LoadingState rows={5} label="Loading composite builds" />
      ) : builds.isError ? (
        <ErrorState error={builds.error} onRetry={() => builds.refetch()} />
      ) : list.length === 0 ? (
        <EmptyState
          icon={CalculatorIcon}
          title="No composite builds yet"
          description="Start a build for a customer, add its parts and price it per quantity band."
          action={<Button onClick={() => setCreating(true)}>New build</Button>}
        />
      ) : (
        <>
          <div className="relative hidden overflow-x-auto rounded-2xl border bg-card md:block">
            <table className="w-full text-sm">
              <caption className="sr-only">Composite builds, most recently updated first</caption>
              <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-medium">
                    Build
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-medium">
                    Customer
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-medium">
                    Bands
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-medium">
                    Bought in
                  </th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">
                    From
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-medium">
                    Status
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {list.map((b) => (
                  <BuildRow key={b.id} build={b} />
                ))}
              </tbody>
            </table>
          </div>
          <ul className="space-y-3 md:hidden">
            {list.map((b) => (
              <BuildCard key={b.id} build={b} />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

/** The lowest-priced band: what the customer pays per unit at the largest quantity. */
function fromPrice(build: CompositeBuildSummary) {
  const priced = build.bands
    .map((band) => ({ band, f: bandFigures(band, build) }))
    .filter((x) => x.band.sellPrice > 0);
  if (!priced.length) return null;
  return priced.reduce((min, x) => (x.band.sellPrice < min.band.sellPrice ? x : min));
}

function BandChips({ build }: { build: CompositeBuildSummary }) {
  const keys = BAND_ORDER.filter((k) => build.bands.some((b) => b.key === k));
  return (
    <span className="flex flex-wrap gap-1">
      {keys.map((k) => (
        <span key={k} className="rounded-md bg-muted px-1.5 py-0.5 text-xs tabular-nums">
          {BAND_LABEL[k]}
        </span>
      ))}
    </span>
  );
}

function useDuplicate() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const key = usePersonaKey();
  return useMutation({
    mutationFn: (id: string) => api.internal.duplicateCompositeBuild(id),
    onSuccess: (copy) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.compositeBuilds(key) });
      toast.success(`${copy.number} created`, { description: copy.name });
      router.push(`/internal/configurator/build?id=${copy.id}`);
    },
    onError: (error) =>
      toast.error("The build could not be duplicated", { description: errorMessage(error) }),
  });
}

function BuildRow({ build }: { build: CompositeBuildSummary }) {
  const duplicate = useDuplicate();
  const from = fromPrice(build);
  const href = `/internal/configurator/build?id=${build.id}`;
  return (
    <tr className="align-top">
      <td className="px-4 py-3">
        <Link href={href} className="font-medium hover:underline">
          {build.name}
        </Link>
        <span className="block text-xs text-muted-foreground">
          <span className="font-mono">{build.number}</span>
          {build.brand ? ` · ${build.brand}` : ""} · {build.creatorInitials},{" "}
          {formatDate(build.createdOn)}
        </span>
      </td>
      <td className="px-3 py-3">{build.accountName}</td>
      <td className="px-3 py-3">
        <BandChips build={build} />
      </td>
      <td className="px-3 py-3">
        <CurrencyBadges build={build} />
      </td>
      <td className="px-3 py-3 text-right tabular-nums">
        {from ? (
          <>
            <span className="font-medium">
              {formatMoney({ amount: from.band.sellPrice, currency: "GBP" })}
            </span>
            <span className={`block text-xs ${marginTone(from.f.marginPercent)}`}>
              {from.f.marginPercent.toFixed(2)}% margin
            </span>
          </>
        ) : (
          <span className="text-muted-foreground">Not priced</span>
        )}
      </td>
      <td className="px-3 py-3">
        <StatusPill tone={build.status === "quoted" ? "success" : "neutral"}>
          {build.status === "quoted" ? "Quoted" : "Draft"}
        </StatusPill>
        <span className="mt-1 block text-xs text-muted-foreground">
          Updated {formatSince(build.updatedAt)}
        </span>
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex justify-end gap-1">
          <Button asChild size="sm" variant="outline">
            <Link href={href}>Open</Link>
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => duplicate.mutate(build.id)}
            disabled={duplicate.isPending}
            aria-label={`Duplicate ${build.name}`}
          >
            <CopyIcon aria-hidden />
          </Button>
        </div>
      </td>
    </tr>
  );
}

function BuildCard({ build }: { build: CompositeBuildSummary }) {
  const duplicate = useDuplicate();
  const from = fromPrice(build);
  const href = `/internal/configurator/build?id=${build.id}`;
  return (
    <li className="rounded-2xl border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link href={href} className="font-medium hover:underline">
            {build.name}
          </Link>
          <p className="text-sm text-muted-foreground">{build.accountName}</p>
        </div>
        <StatusPill tone={build.status === "quoted" ? "success" : "neutral"}>
          {build.status === "quoted" ? "Quoted" : "Draft"}
        </StatusPill>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <BandChips build={build} />
        <CurrencyBadges build={build} />
      </div>
      <div className="mt-3 flex items-end justify-between gap-2">
        <p className="text-sm tabular-nums">
          {from ? (
            <>
              From{" "}
              <span className="font-semibold">
                {formatMoney({ amount: from.band.sellPrice, currency: "GBP" })}
              </span>{" "}
              <span className={marginTone(from.f.marginPercent)}>
                · {from.f.marginPercent.toFixed(2)}%
              </span>
            </>
          ) : (
            <span className="text-muted-foreground">Not priced</span>
          )}
        </p>
        <div className="flex gap-1">
          <Button asChild size="sm" variant="outline">
            <Link href={href}>Open</Link>
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => duplicate.mutate(build.id)}
            disabled={duplicate.isPending}
            aria-label={`Duplicate ${build.name}`}
          >
            <CopyIcon aria-hidden />
          </Button>
        </div>
      </div>
    </li>
  );
}

/** Inline, not a dialog: name, customer and brand, then straight into the costing sheet. */
function NewBuildForm({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const key = usePersonaKey();
  const customers = useInternalCustomers();
  const [name, setName] = useState("");
  const [accountId, setAccountId] = useState("");
  const [brand, setBrand] = useState("");
  const [touched, setTouched] = useState(false);

  const create = useMutation({
    mutationFn: () => api.internal.createCompositeBuild({ name, accountId, brand }),
    onSuccess: (build) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.compositeBuilds(key) });
      router.push(`/internal/configurator/build?id=${build.id}`);
    },
    onError: (error) =>
      toast.error("The build could not be created", { description: errorMessage(error) }),
  });

  const nameError =
    name.trim().length < 3 ? "Give the build a name of at least 3 characters" : null;
  const customerError = accountId ? null : "Choose the customer";

  return (
    <form
      className="mb-6 rounded-2xl border bg-card p-4 sm:p-5"
      onSubmit={(e) => {
        e.preventDefault();
        setTouched(true);
        if (!nameError && !customerError) create.mutate();
      }}
      aria-labelledby="new-build"
    >
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 id="new-build" className="font-medium">
          New composite build
        </h2>
        <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Cancel">
          <XIcon aria-hidden />
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="nb-name">Name</Label>
          <Input
            id="nb-name"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Branded tap handle"
            aria-invalid={touched && !!nameError}
            aria-describedby={touched && nameError ? "nb-name-error" : undefined}
          />
          {touched && nameError ? (
            <p id="nb-name-error" className="text-xs text-destructive">
              {nameError}
            </p>
          ) : null}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="nb-customer">Customer</Label>
          <select
            id="nb-customer"
            className={nativeSelectClass}
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            aria-invalid={touched && !!customerError}
            aria-describedby={touched && customerError ? "nb-customer-error" : undefined}
          >
            <option value="">
              {customers.isPending ? "Loading customers" : "Choose a customer"}
            </option>
            {(customers.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {touched && customerError ? (
            <p id="nb-customer-error" className="text-xs text-destructive">
              {customerError}
            </p>
          ) : null}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="nb-brand">Brand or project</Label>
          <Input
            id="nb-brand"
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            placeholder="Optional"
          />
        </div>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={create.isPending}>
          {create.isPending ? "Creating" : "Create and open"}
        </Button>
      </div>
    </form>
  );
}

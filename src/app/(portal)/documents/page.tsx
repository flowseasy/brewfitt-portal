"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { FileArrowUpIcon, FolderOpenIcon, WarningIcon } from "@phosphor-icons/react";
import { UploadDialog } from "@/components/account/account-panels";
import { DOCUMENT_CATEGORY, DOCUMENT_GROUP, documentGroup, hasPendingRenewal, isExpiring, type DocumentGroup } from "@/components/documents/document-parts";
import { ApprovalPill, DocumentCard, ExpiryPill, fileSize } from "@/components/shared/document-card";
import { FilterBar, FilterSelect, SearchInput } from "@/components/shared/filter-bar";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/states";
import { StatusTabs } from "@/components/shared/status-tabs";
import { Button } from "@/components/ui/button";
import { useIsSupplier, useMe, usePersonaKey } from "@/features/session/use-session";
import { api, queryKeys } from "@/lib/api";
import { daysFromToday, formatShortDate, plural } from "@/lib/format";
import { hrefFor } from "@/lib/links";
import type { Document } from "@/types";

export default function DocumentsPage() {
  return (
    <Suspense fallback={<LoadingState rows={6} />}>
      <Documents />
    </Suspense>
  );
}

type Tab = "all" | DocumentGroup;
type Period = "all" | "30" | "90" | "365";
const PAGE = 40;

function Documents() {
  const key = usePersonaKey();
  const params = useSearchParams();
  const me = useMe();
  const isSupplier = useIsSupplier();
  const documents = useQuery({ queryKey: queryKeys.documents(key), queryFn: () => api.documents.list() });
  const initialTab = params.get("category");
  const [tab, setTab] = useState<Tab>(initialTab && initialTab in DOCUMENT_GROUP ? (initialTab as DocumentGroup) : "all");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<"all" | Document["category"]>("all");
  const [period, setPeriod] = useState<Period>("all");
  const [shown, setShown] = useState(PAGE);
  const [uploadOpen, setUploadOpen] = useState(false);

  const ownerName = useMemo(() => {
    const names = new Map<string, string>();
    if (me.data) {
      names.set(me.data.account.id, me.data.account.name);
      if (me.data.group) for (const a of [me.data.group.account, ...me.data.group.sites]) names.set(a.id, a.name);
    }
    return (d: Document) => (d.ownerAccountId ? (names.get(d.ownerAccountId) ?? "Your account") : "Brewfitt");
  }, [me.data]);

  const all = documents.data ?? [];
  const inTab = all.filter((d) => tab === "all" || documentGroup(d) === tab);
  const categories = [...new Set(inTab.map((d) => d.category))];
  const q = search.trim().toLowerCase();
  const filtered = inTab.filter(
    (d) =>
      (category === "all" || d.category === category) &&
      (period === "all" || -daysFromToday(d.modifiedAt) <= Number(period)) &&
      (!q || `${d.name} ${DOCUMENT_CATEGORY[d.category]} ${ownerName(d)}`.toLowerCase().includes(q)),
  );
  // Only the account's own certificates and agreements need action; Brewfitt renews its own.
  const expiring = all.filter((d) => d.ownerAccountId && (d.category === "insurance" || d.category === "compliance" || d.category === "agreement") && isExpiring(d, daysFromToday) && !hasPendingRenewal(d, all));
  const activeCount = (category !== "all" ? 1 : 0) + (period !== "all" ? 1 : 0);
  const clear = () => {
    setCategory("all");
    setPeriod("all");
  };
  const changeTab = (t: Tab) => {
    setTab(t);
    setCategory("all");
    setShown(PAGE);
  };

  const filters = (
    <>
      <FilterSelect<"all" | Document["category"]> label="Category" value={category} onChange={setCategory} options={[{ value: "all", label: "All categories" }, ...categories.map((c) => ({ value: c, label: DOCUMENT_CATEGORY[c] }))]} />
      <FilterSelect<Period>
        label="Date"
        value={period}
        onChange={setPeriod}
        options={[
          { value: "all", label: "Any date" },
          { value: "30", label: "Last 30 days" },
          { value: "90", label: "Last 90 days" },
          { value: "365", label: "Last 12 months" },
        ]}
      />
    </>
  );

  return (
    <div>
      <PageHeader
        title="Documents"
        description={isSupplier ? "Purchase orders, remittances, your insurance and compliance certificates, agreements and spec sheets." : "Quotes, orders, delivery notes, invoices, agreements, Brewfitt's certificates and product documents in one place."}
        actions={
          isSupplier ? (
            <Button onClick={() => setUploadOpen(true)}>
              <FileArrowUpIcon aria-hidden />
              Upload certificate
            </Button>
          ) : null
        }
      />

      {expiring.length ? (
        <div role="status" className="mb-5 rounded-2xl border border-warning/40 bg-warning-subtle p-4">
          <p className="flex items-center gap-2 font-medium">
            <WarningIcon className="size-5 text-warning" aria-hidden />
            {plural(expiring.length, "document")} {expiring.length === 1 ? "needs" : "need"} renewing
          </p>
          <ul className="mt-2 space-y-1 text-sm">
            {expiring.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-2">
                <Link href={hrefFor("document", d.id)} className="font-medium hover:underline">
                  {d.name.replace(/\.pdf$/, "")}
                </Link>
                <ExpiryPill expiresAt={d.expiresAt} />
              </li>
            ))}
          </ul>
          {isSupplier ? <p className="mt-2 text-sm text-muted-foreground">Upload the renewed certificate so your supplier record stays current.</p> : <p className="mt-2 text-sm text-muted-foreground">Your account manager will send the renewal for signature.</p>}
        </div>
      ) : null}

      <StatusTabs
        tabs={[{ value: "all" as Tab, label: "All", count: all.length }, ...(Object.keys(DOCUMENT_GROUP) as DocumentGroup[]).map((g) => ({ value: g as Tab, label: DOCUMENT_GROUP[g], count: all.filter((d) => documentGroup(d) === g).length }))].filter((t) => t.value === "all" || t.count > 0)}
        value={tab}
        onChange={changeTab}
      />
      <FilterBar search={<SearchInput value={search} onChange={setSearch} placeholder="Search by name, number or type" label="Search documents" />} filters={filters} activeCount={activeCount} onClear={clear} />

      {documents.isPending ? (
        <LoadingState rows={6} label="Loading documents" />
      ) : documents.isError ? (
        <ErrorState error={documents.error} onRetry={() => documents.refetch()} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={FolderOpenIcon}
          title={inTab.length === 0 ? "No documents here yet" : "No documents match"}
          description={inTab.length === 0 ? "Documents appear here as quotes, orders and invoices are produced." : "Try another search term or clear the filters."}
          action={
            inTab.length > 0 && (q || activeCount) ? (
              <Button
                variant="outline"
                onClick={() => {
                  setSearch("");
                  clear();
                }}
              >
                Clear search and filters
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <p className="mb-3 text-sm text-muted-foreground" aria-live="polite">
            {plural(filtered.length, "document")}
          </p>
          {/* Phones: compact cards. Wider screens: a table with owner and related record. */}
          <ul className="grid grid-cols-1 gap-2 md:hidden">
            {filtered.slice(0, shown).map((d) => (
              <li key={d.id}>
                <DocumentCard doc={d} showApproval={!!d.ownerAccountId && d.approvalStatus !== "approved"} />
              </li>
            ))}
          </ul>
          <div className="hidden overflow-hidden rounded-2xl border bg-card md:block">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Name</th>
                  <th className="px-4 py-2.5 font-medium">Category</th>
                  <th className="px-4 py-2.5 font-medium">Owner</th>
                  <th className="px-4 py-2.5 font-medium">Updated</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.slice(0, shown).map((d) => (
                  <tr key={d.id} className="hover:bg-accent/40">
                    <td className="max-w-80 px-4 py-2.5">
                      <Link href={hrefFor("document", d.id)} className="block truncate font-medium hover:text-primary hover:underline">
                        {d.name}
                      </Link>
                      <span className="text-xs text-muted-foreground uppercase">
                        {d.fileType} · {fileSize(d.fileSize)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{DOCUMENT_CATEGORY[d.category]}</td>
                    <td className="max-w-48 truncate px-4 py-2.5 text-muted-foreground">{ownerName(d)}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap text-muted-foreground">{formatShortDate(d.modifiedAt)}</td>
                    <td className="px-4 py-2.5">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <ExpiryPill expiresAt={d.expiresAt} />
                        {d.ownerAccountId ? <ApprovalPill status={d.approvalStatus === "approved" ? null : d.approvalStatus} /> : null}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length > shown ? (
            <div className="mt-4 flex justify-center">
              <Button variant="outline" onClick={() => setShown((n) => n + PAGE)}>
                Show more ({filtered.length - shown} remaining)
              </Button>
            </div>
          ) : null}
        </>
      )}
      {isSupplier ? <UploadDialog open={uploadOpen} onOpenChange={setUploadOpen} /> : null}
    </div>
  );
}

"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { PlusIcon, TagIcon, TicketIcon } from "@phosphor-icons/react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/states";
import { StatusPill } from "@/components/shared/status-pill";
import { StatusTabs } from "@/components/shared/status-tabs";
import { StockPill } from "@/components/shared/stock-pill";
import { SearchInput } from "@/components/shared/filter-bar";
import { OfferSheet, SubmissionImage, SupplierProductSheet } from "@/components/supplier/submission-forms";
import { Button } from "@/components/ui/button";
import { usePersonaKey } from "@/features/session/use-session";
import { api, queryKeys } from "@/lib/api";
import { daysFromToday, formatDate, formatMoney, formatSince, plural } from "@/lib/format";
import { hrefFor } from "@/lib/links";
import { OFFER_STATUS, SUBMISSION_STATUS } from "@/lib/status";

export default function ProductsPage() {
  return (
    <Suspense fallback={<LoadingState rows={5} />}>
      <Products />
    </Suspense>
  );
}

type Tab = "submissions" | "offers" | "range";

function Products() {
  const key = usePersonaKey();
  const params = useSearchParams();
  const submissions = useQuery({ queryKey: queryKeys.supplierProducts(key), queryFn: () => api.supplierProducts.list() });
  const offers = useQuery({ queryKey: queryKeys.offers(key), queryFn: () => api.supplierProducts.offers() });
  const priceList = useQuery({ queryKey: queryKeys.priceList(key), queryFn: () => api.priceList.get() });
  const categories = useQuery({ queryKey: queryKeys.categories(key), queryFn: () => api.products.categories() });
  const [tab, setTab] = useState<Tab>(params.get("new") === "offer" ? "offers" : "submissions");
  const [productOpen, setProductOpen] = useState(false);
  const [offerOpen, setOfferOpen] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (params.get("new") === "product") setProductOpen(true);
    if (params.get("new") === "offer") setOfferOpen(true);
  }, [params]);

  const range = useMemo(() => (priceList.data?.lines ?? []).map((l) => l.product), [priceList.data]);
  const productName = useMemo(() => new Map(range.map((p) => [p.id, p.name])), [range]);
  const categoryName = useMemo(() => new Map((categories.data ?? []).map((c) => [c.id, c.name])), [categories.data]);

  return (
    <div>
      <PageHeader
        title="Products and offers"
        description="Submit new products with images, branding and spec sheets, make time-limited offers, and see your range with agreed cost prices and lead times."
        actions={
          <>
            <Button variant="outline" onClick={() => setOfferOpen(true)}>
              <TicketIcon aria-hidden />
              New offer
            </Button>
            <Button onClick={() => setProductOpen(true)}>
              <PlusIcon aria-hidden />
              Submit product
            </Button>
          </>
        }
      />

      <StatusTabs
        tabs={[
          { value: "submissions" as Tab, label: "Submissions", count: submissions.data?.length ?? 0 },
          { value: "offers" as Tab, label: "Offers", count: offers.data?.length ?? 0 },
          { value: "range" as Tab, label: "Your range at Brewfitt", count: range.length },
        ]}
        value={tab}
        onChange={setTab}
        label="Products and offers"
      />

      {tab === "submissions" ? (
        submissions.isPending ? (
          <LoadingState rows={4} />
        ) : submissions.isError ? (
          <ErrorState error={submissions.error} onRetry={() => submissions.refetch()} />
        ) : submissions.data.length === 0 ? (
          <EmptyState icon={TagIcon} title="No products submitted yet" action={<Button onClick={() => setProductOpen(true)}>Submit a product</Button>} />
        ) : (
          <ul className="space-y-2">
            {submissions.data.map((sp) => {
              const s = SUBMISSION_STATUS[sp.status];
              return (
                <li key={sp.id}>
                  <Link href={hrefFor("supplier-product", sp.id)} className="flex items-center gap-3 rounded-2xl border bg-card p-3 hover:border-primary/40 sm:p-4">
                    <SubmissionImage src={sp.images[0]} className="size-14 shrink-0 rounded-xl border" />
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{sp.name}</span>
                        <StatusPill tone={s.tone}>{s.label}</StatusPill>
                      </p>
                      <p className="truncate text-sm text-muted-foreground">
                        <span className="font-mono">{sp.sku}</span> · {categoryName.get(sp.category) ?? "Category"} · cost {formatMoney(sp.costPrice)} · {sp.specSheetDocumentId ? "spec sheet attached" : "no spec sheet"}
                      </p>
                      {sp.status === "rejected" && sp.reviewNote ? <p className="mt-1 text-sm text-danger">{sp.reviewNote}</p> : null}
                    </div>
                    <span className="hidden shrink-0 text-xs text-muted-foreground sm:block">Updated {formatSince(sp.updatedAt)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )
      ) : tab === "offers" ? (
        offers.isPending ? (
          <LoadingState rows={4} />
        ) : offers.isError ? (
          <ErrorState error={offers.error} onRetry={() => offers.refetch()} />
        ) : offers.data.length === 0 ? (
          <EmptyState icon={TicketIcon} title="No offers yet" action={<Button onClick={() => setOfferOpen(true)}>Make an offer</Button>} />
        ) : (
          <ul className="space-y-2">
            {offers.data.map((o) => {
              const status = o.status === "approved" && daysFromToday(o.validTo) < 0 ? "expired" : o.status;
              const s = OFFER_STATUS[status];
              return (
                <li key={o.id}>
                  <Link href={hrefFor("offer", o.id)} className="flex flex-col gap-2 rounded-2xl border bg-card p-4 hover:border-primary/40 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{o.description}</span>
                        <StatusPill tone={s.tone}>{s.label}</StatusPill>
                      </p>
                      <p className="truncate text-sm text-muted-foreground">
                        {o.productIds.map((id) => productName.get(id) ?? "Product").join(", ")} · {formatDate(o.validFrom)} to {formatDate(o.validTo)}
                      </p>
                    </div>
                    <p className="text-lg font-semibold tabular-nums">{formatMoney(o.price)}</p>
                  </Link>
                </li>
              );
            })}
          </ul>
        )
      ) : priceList.isPending ? (
        <LoadingState rows={6} />
      ) : priceList.isError ? (
        <ErrorState error={priceList.error} onRetry={() => priceList.refetch()} />
      ) : (
        <>
          <SearchInput value={search} onChange={setSearch} placeholder="Search your range" label="Search your range" className="mb-4 max-w-md" />
          <div className="overflow-x-auto rounded-2xl border bg-card">
            <table className="w-full min-w-[640px] text-sm">
              <caption className="sr-only">Products you supply to Brewfitt with agreed cost prices</caption>
              <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-medium">Product</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">Agreed cost</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">Lead time</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Spec sheet</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Brewfitt stock</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {priceList.data.lines
                  .filter((l) => !search || l.product.name.toLowerCase().includes(search.toLowerCase()) || l.product.sku.toLowerCase().includes(search.toLowerCase()))
                  .map((l) => (
                    <tr key={l.productId}>
                      <td className="px-4 py-2.5">
                        <span className="font-medium">{l.product.name}</span>
                        <span className="block font-mono text-xs text-muted-foreground">{l.product.sku}</span>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{formatMoney(l.price)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{plural(l.product.leadTimeDays, "day")}</td>
                      <td className="px-3 py-2.5">{l.product.specSheetDocumentId ? <StatusPill tone="success">On file</StatusPill> : <span className="text-muted-foreground">Not yet provided</span>}</td>
                      <td className="px-4 py-2.5">
                        <StockPill stock={l.stock} />
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <SupplierProductSheet open={productOpen} onOpenChange={setProductOpen} categories={categories.data ?? []} range={range} />
      <OfferSheet open={offerOpen} onOpenChange={setOfferOpen} range={range} />
    </div>
  );
}

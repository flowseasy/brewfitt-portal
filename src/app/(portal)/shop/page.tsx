"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowsClockwiseIcon, BuildingsIcon, MagnifyingGlassIcon } from "@phosphor-icons/react";
import { toast } from "sonner";
import { FilterBar, FilterSelect, SearchInput } from "@/components/shared/filter-bar";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/states";
import { ProductCard, ProductImage } from "@/components/shop/product-card";
import { BasketButton } from "@/components/shop/shop-header-actions";
import { Button } from "@/components/ui/button";
import { frequentProducts } from "@/features/dashboard/use-customer-dashboard";
import { useMe, usePersonaKey } from "@/features/session/use-session";
import {
  categoryTree,
  filterCatalogue,
  SECTION_LABEL,
  useCatalogue,
  type SortKey,
} from "@/features/shop/use-catalogue";
import { api, errorMessage, queryKeys } from "@/lib/api";
import { formatDate, formatMoney, plural } from "@/lib/format";
import { hrefFor } from "@/lib/links";
import { cn } from "@/lib/utils";
import type { CatalogueSection, SalesOrder } from "@/types";

const PAGE = 24;

export default function ShopPage() {
  return (
    <Suspense fallback={<LoadingState rows={6} />}>
      <Shop />
    </Suspense>
  );
}

function Shop() {
  const params = useSearchParams();
  const me = useMe();
  const { priceList, categories } = useCatalogue();
  const [search, setSearch] = useState(params.get("q") ?? "");
  const [section, setSection] = useState<CatalogueSection | "all">(
    (params.get("section") as CatalogueSection) ?? "all",
  );
  const [category, setCategory] = useState(params.get("category") ?? "all");
  const [inStockOnly, setInStockOnly] = useState(false);
  const [sort, setSort] = useState<SortKey>("relevance");
  const [limit, setLimit] = useState(PAGE);
  const buyAgainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (params.get("reorder"))
      buyAgainRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [params]);

  const cats = useMemo(() => categories.data ?? [], [categories.data]);
  const tree = useMemo(() => categoryTree(cats), [cats]);
  const filtered = useMemo(
    () =>
      priceList.data
        ? filterCatalogue(priceList.data.lines, cats, {
            search,
            section,
            category,
            inStockOnly,
            sort,
          })
        : [],
    [priceList.data, cats, search, section, category, inStockOnly, sort],
  );
  const groupRollUp = me.data?.persona.kind === "group" && !me.data.persona.activeSiteId;
  const active = [search, section !== "all", category !== "all", inStockOnly].filter(
    Boolean,
  ).length;
  const clear = () => {
    setSearch("");
    setSection("all");
    setCategory("all");
    setInStockOnly(false);
    setLimit(PAGE);
  };
  const visibleTree = tree.filter((t) => section === "all" || t.category.section === section);

  return (
    <div>
      <PageHeader
        title="Shop"
        description="Brewfitt's trade range at your price. Orders on account need no payment; otherwise pay by card at checkout."
        actions={<BasketButton />}
      />

      {groupRollUp ? (
        <div className="mb-5 flex items-center gap-3 rounded-2xl border border-info/30 bg-info-subtle p-4 text-sm">
          <BuildingsIcon className="size-5 shrink-0 text-info" aria-hidden />
          <p>
            You are viewing all sites. Choose a site with the site switcher at the top to place an
            order for it.
          </p>
        </div>
      ) : null}

      <BuyAgain sectionRef={buyAgainRef} />

      <nav
        aria-label="Sections"
        className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0"
      >
        {(["all", ...Object.keys(SECTION_LABEL)] as (CatalogueSection | "all")[]).map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={section === s}
            onClick={() => {
              setSection(s);
              setCategory("all");
              setLimit(PAGE);
            }}
            className={cn(
              "shrink-0 rounded-full border px-4 py-2 text-sm transition",
              section === s
                ? "border-primary bg-primary text-primary-foreground"
                : "bg-card hover:border-primary/40",
            )}
          >
            {s === "all" ? "Everything" : SECTION_LABEL[s]}
          </button>
        ))}
      </nav>

      <FilterBar
        activeCount={active}
        onClear={clear}
        search={
          <SearchInput
            value={search}
            onChange={(v) => {
              setSearch(v);
              setLimit(PAGE);
            }}
            placeholder="Search couplers, fonts, coolers…"
            label="Search the shop"
          />
        }
        filters={
          <>
            <FilterSelect
              label="Category"
              value={category}
              onChange={(v) => {
                setCategory(v);
                setLimit(PAGE);
              }}
              options={[
                { value: "all", label: "All categories" },
                ...visibleTree.flatMap((t) => [
                  { value: t.category.id, label: t.category.name },
                  ...t.children.map((c) => ({
                    value: c.id,
                    label: `  ${t.category.name}: ${c.name}`,
                  })),
                ]),
              ]}
            />
            <FilterSelect
              label="Sort"
              value={sort}
              onChange={setSort}
              options={[
                { value: "relevance", label: "Best match" },
                { value: "name", label: "Name A to Z" },
                { value: "price-asc", label: "Price, low to high" },
                { value: "price-desc", label: "Price, high to low" },
              ]}
            />
            <label className="flex h-10 items-center gap-2 rounded-full border bg-background px-3.5 text-sm md:h-9">
              <input
                type="checkbox"
                checked={inStockOnly}
                onChange={(e) => setInStockOnly(e.target.checked)}
                className="size-4 accent-[var(--primary)]"
              />
              Available now
            </label>
          </>
        }
      />

      {priceList.isPending || categories.isPending ? (
        <LoadingState rows={6} label="Loading the catalogue" />
      ) : priceList.isError ? (
        <ErrorState error={priceList.error} onRetry={() => priceList.refetch()} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={MagnifyingGlassIcon}
          title="No products match"
          description="Try a different search, or browse everything."
          action={
            <Button variant="outline" onClick={clear}>
              Show everything
            </Button>
          }
        />
      ) : (
        <>
          <p className="mb-3 text-sm text-muted-foreground" role="status" aria-live="polite">
            {plural(filtered.length, "product")}
          </p>
          <ul className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.slice(0, limit).map((line, i) => (
              <li key={line.productId}>
                <ProductCard line={line} index={i} />
              </li>
            ))}
          </ul>
          {filtered.length > limit ? (
            <div className="mt-6 flex justify-center">
              <Button variant="outline" onClick={() => setLimit((n) => n + PAGE)}>
                Show more products
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

/** Quick reorder from order history: regular products and recent orders. */
function BuyAgain({ sectionRef }: { sectionRef: React.RefObject<HTMLElement | null> }) {
  const key = usePersonaKey();
  const router = useRouter();
  const queryClient = useQueryClient();
  const orders = useQuery({
    queryKey: queryKeys.salesOrders(key),
    queryFn: () => api.orders.salesOrders(),
  });
  const { priceList } = useCatalogue();

  const reorder = useMutation({
    mutationFn: async (order: SalesOrder) => {
      const available = new Set(priceList.data?.lines.map((l) => l.productId));
      const lines = order.lines.filter((l) => available.has(l.productId));
      let basket = await api.shop.basket();
      for (const l of lines)
        basket = await api.shop.addToBasket({ productId: l.productId, qty: l.qty });
      return { basket, count: lines.length, order };
    },
    onSuccess: ({ basket, count, order }) => {
      queryClient.setQueryData(queryKeys.basket(key), basket);
      toast.success(`${plural(count, "line")} from ${order.number} added to your basket`, {
        action: { label: "View basket", onClick: () => router.push("/shop/basket") },
      });
    },
    onError: (error) => toast.error("Could not reorder", { description: errorMessage(error) }),
  });

  const frequent =
    orders.data && priceList.data ? frequentProducts(orders.data, priceList.data, 6) : [];
  const recent = (orders.data ?? []).filter((o) => o.status !== "cancelled").slice(0, 3);
  if (orders.isPending || priceList.isPending) return null;
  if (!frequent.length && !recent.length) return null;

  return (
    <section
      ref={sectionRef}
      aria-labelledby="buy-again"
      className="mb-8 scroll-mt-24 rounded-3xl border bg-gradient-to-br from-brand-subtle/70 to-card p-4 sm:p-6"
    >
      <div className="mb-4 flex items-center gap-2">
        <ArrowsClockwiseIcon className="size-5 text-primary" aria-hidden />
        <h2 id="buy-again" className="font-medium">
          Buy again
        </h2>
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        {frequent.length ? (
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {frequent.map((f) => (
              <li
                key={f.line.productId}
                className="flex items-center gap-3 rounded-xl border bg-card p-2.5"
              >
                <ProductImage
                  src={f.line.product.images[0]}
                  alt=""
                  sizes="48px"
                  className="size-12 shrink-0 rounded-lg border"
                />
                <div className="min-w-0 flex-1">
                  <Link
                    href={hrefFor("product", f.line.productId)}
                    className="line-clamp-1 text-sm font-medium hover:underline"
                  >
                    {f.line.product.name}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    Ordered {plural(f.orders, "time")} · last {f.lastQty}
                  </p>
                </div>
                <QuickAdd
                  productId={f.line.productId}
                  qty={f.lastQty}
                  name={f.line.product.name}
                  disabled={f.line.stock?.status === "out"}
                />
              </li>
            ))}
          </ul>
        ) : null}
        {recent.length ? (
          <ul className="space-y-2">
            {recent.map((o) => (
              <li key={o.id} className="flex items-center gap-3 rounded-xl border bg-card p-3">
                <div className="min-w-0 flex-1">
                  <Link
                    href={hrefFor("sales-order", o.id)}
                    className="text-sm font-medium hover:underline"
                  >
                    {o.number}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(o.createdAt)} · {plural(o.lines.length, "line")} ·{" "}
                    {formatMoney(o.total, { whole: true })}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => reorder.mutate(o)}
                  disabled={reorder.isPending}
                >
                  Reorder all
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}

function QuickAdd({
  productId,
  qty,
  name,
  disabled,
}: {
  productId: string;
  qty: number;
  name: string;
  disabled?: boolean;
}) {
  const key = usePersonaKey();
  const queryClient = useQueryClient();
  const add = useMutation({
    mutationFn: () => api.shop.addToBasket({ productId, qty }),
    onSuccess: (basket) => {
      queryClient.setQueryData(queryKeys.basket(key), basket);
      toast.success(`${qty} × ${name} added to your basket`);
    },
    onError: (error) =>
      toast.error("Could not add to basket", { description: errorMessage(error) }),
  });
  return (
    <Button
      size="sm"
      variant="outline"
      onClick={() => add.mutate()}
      disabled={disabled || add.isPending}
      aria-label={`Reorder ${qty} × ${name}`}
    >
      <ArrowsClockwiseIcon aria-hidden />
      Reorder ×{qty}
    </Button>
  );
}

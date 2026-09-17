"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeftIcon, BookOpenIcon, ClockIcon, FileDashedIcon, FilePdfIcon, PackageIcon, ShoppingCartSimpleIcon } from "@phosphor-icons/react";
import { AIInsightCard } from "@/components/ai/ai-insight-card";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/states";
import { StockPill } from "@/components/shared/stock-pill";
import { NotifyMeButton, ProductCard, ProductImage } from "@/components/shop/product-card";
import { QuantityStepper } from "@/components/shop/quantity-stepper";
import { BasketButton } from "@/components/shop/shop-header-actions";
import { Button } from "@/components/ui/button";
import { usePersonaKey } from "@/features/session/use-session";
import { useAddToBasket } from "@/features/shop/use-add-to-basket";
import { SECTION_LABEL, useCatalogue } from "@/features/shop/use-catalogue";
import { api, queryKeys } from "@/lib/api";
import { formatDate, formatMoney, plural } from "@/lib/format";
import { hrefFor } from "@/lib/links";
import { cn } from "@/lib/utils";

export default function ProductPage() {
  return (
    <Suspense fallback={<LoadingState rows={4} />}>
      <Product />
    </Suspense>
  );
}

function Product() {
  const id = useSearchParams().get("id") ?? "";
  const key = usePersonaKey();
  const { priceList, categories } = useCatalogue();
  const knowledge = useQuery({ queryKey: queryKeys.knowledge(key), queryFn: () => api.knowledge.list() });
  const orders = useQuery({ queryKey: queryKeys.salesOrders(key), queryFn: () => api.orders.salesOrders() });
  const insight = useQuery({ queryKey: queryKeys.productInsight(key, id), queryFn: () => api.ai.productInsight(id), enabled: !!id });
  const add = useAddToBasket();
  const [qty, setQty] = useState(1);
  const [imageIndex, setImageIndex] = useState(0);

  const line = priceList.data?.lines.find((l) => l.productId === id);
  const related = useMemo(() => {
    if (!line || !priceList.data) return [];
    return priceList.data.lines.filter((l) => l.productId !== id && (l.product.subcategory ?? l.product.category) === (line.product.subcategory ?? line.product.category)).slice(0, 4);
  }, [line, priceList.data, id]);
  const articles = (knowledge.data ?? []).filter((k) => k.productIds.includes(id));
  const history = (orders.data ?? []).filter((o) => o.status !== "cancelled" && o.lines.some((l) => l.productId === id));

  if (priceList.isPending || categories.isPending) return <LoadingState rows={4} label="Loading product" />;
  if (priceList.isError) return <ErrorState error={priceList.error} onRetry={() => priceList.refetch()} />;
  if (!line) {
    return <EmptyState icon={PackageIcon} title="This product is not on your price list" description="It may have been discontinued, or it is not part of your account's range." action={<Button asChild variant="outline"><Link href="/shop">Back to the shop</Link></Button>} />;
  }

  const p = line.product;
  const category = categories.data?.find((c) => c.id === p.category);
  const subcategory = categories.data?.find((c) => c.id === p.subcategory);
  const out = line.stock?.status === "out";
  const lastOrder = history[0];

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
          <Link href="/shop" className="flex items-center gap-1 hover:text-foreground">
            <ArrowLeftIcon className="size-4" aria-hidden />
            Shop
          </Link>
          {category ? (
            <>
              <span aria-hidden>/</span>
              <Link href={`/shop?section=${category.section}&category=${category.id}`} className="truncate hover:text-foreground">
                {SECTION_LABEL[category.section]}: {category.name}
              </Link>
            </>
          ) : null}
        </nav>
        <BasketButton />
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div>
          <ProductImage src={p.images[imageIndex] ?? p.images[0]} alt={p.name} sizes="(min-width: 1024px) 560px, 100vw" priority className="aspect-square rounded-3xl border" />
          {p.images.length > 1 ? (
            <div className="mt-3 flex gap-2" role="group" aria-label="Product images">
              {p.images.map((src, i) => (
                <button key={src} type="button" onClick={() => setImageIndex(i)} aria-label={`Image ${i + 1} of ${p.images.length}`} aria-pressed={i === imageIndex} className={cn("overflow-hidden rounded-xl border-2", i === imageIndex ? "border-primary" : "border-transparent")}>
                  <ProductImage src={src} alt="" sizes="72px" className="size-16" />
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div>
          <p className="font-mono text-xs text-muted-foreground">{p.sku}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-balance sm:text-3xl">{p.name}</h1>
          {subcategory ? <p className="mt-1 text-sm text-muted-foreground">{subcategory.name}</p> : null}

          <div className="mt-5 rounded-2xl border bg-card p-5">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-3xl font-semibold tracking-tight tabular-nums">{formatMoney(line.price)}</span>
              {line.discountPercent > 0 ? (
                <span className="text-sm text-muted-foreground">
                  <span className="line-through">{formatMoney(p.listPrice)}</span> list · {line.discountPercent}% off
                </span>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">
              Your price per {p.unit === "each" ? "item" : p.unit}
              {p.packSize > 1 ? ` (pack of ${p.packSize})` : ""}, excluding VAT
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
              <StockPill stock={line.stock} />
              {line.stock && line.stock.status !== "out" && line.stock.available > 0 ? <span className="text-muted-foreground">{line.stock.available} available</span> : null}
              {line.stock?.expectedAt ? <span className="text-muted-foreground">More expected {formatDate(line.stock.expectedAt)}</span> : null}
              <span className="flex items-center gap-1 text-muted-foreground">
                <ClockIcon className="size-4" aria-hidden />
                Usual lead time {plural(p.leadTimeDays, "working day")}
              </span>
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              {out ? (
                <>
                  <NotifyMeButton productId={p.id} name={p.name} size="default" />
                  <p className="text-sm text-muted-foreground">Out of stock. You can still order; Brewfitt will confirm the date.</p>
                </>
              ) : null}
              <QuantityStepper value={qty} onChange={setQty} label={p.name} />
              <Button size="lg" className="h-10 flex-1 rounded-full sm:flex-none sm:px-6" onClick={() => add.mutate({ productId: p.id, qty, name: p.name })} disabled={add.isPending}>
                <ShoppingCartSimpleIcon aria-hidden />
                Add to basket
              </Button>
            </div>
            {lastOrder ? (
              <p className="mt-4 text-sm text-muted-foreground">
                You last ordered this on{" "}
                <Link href={hrefFor("sales-order", lastOrder.id)} className="font-medium text-primary hover:underline">
                  {formatDate(lastOrder.createdAt)} ({lastOrder.number})
                </Link>
                .
              </p>
            ) : null}
          </div>

          <section aria-labelledby="about" className="mt-6">
            <h2 id="about" className="font-medium">
              About this product
            </h2>
            <p className="mt-2 leading-relaxed text-muted-foreground">{p.description}</p>
          </section>

          <section aria-labelledby="docs" className="mt-6 space-y-2">
            <h2 id="docs" className="font-medium">
              Documents and guides
            </h2>
            {p.specSheetDocumentId ? (
              <Link href={hrefFor("document", p.specSheetDocumentId)} className="flex items-center gap-3 rounded-xl border bg-card p-3 hover:border-primary/40">
                <FilePdfIcon className="size-5 text-primary" aria-hidden />
                <span className="text-sm font-medium">Spec sheet</span>
              </Link>
            ) : (
              <div className="flex items-center gap-3 rounded-xl border border-dashed p-3 text-sm text-muted-foreground">
                <FileDashedIcon className="size-5" aria-hidden />
                Spec sheet not yet available. Brewfitt is collecting spec sheets from suppliers.
              </div>
            )}
            {articles.map((a) => (
              <Link key={a.id} href={hrefFor("knowledge-item", a.id)} className="flex items-center gap-3 rounded-xl border bg-card p-3 hover:border-primary/40">
                <BookOpenIcon className="size-5 text-primary" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{a.title}</span>
                  <span className="block text-xs text-muted-foreground capitalize">{a.type}</span>
                </span>
              </Link>
            ))}
          </section>

          {insight.data ? (
            <section aria-label="Insight" className="mt-6">
              <AIInsightCard insight={insight.data} />
            </section>
          ) : null}
        </div>
      </div>

      {related.length ? (
        <section aria-labelledby="related" className="mt-12">
          <h2 id="related" className="mb-4 text-lg font-semibold tracking-tight">
            Related products
          </h2>
          <ul className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-4">
            {related.map((l, i) => (
              <li key={l.productId}>
                <ProductCard line={l} index={i} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

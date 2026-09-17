"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { DownloadSimpleIcon, FilePdfIcon, MagnifyingGlassIcon, PlusIcon, TagIcon } from "@phosphor-icons/react";
import { toast } from "sonner";
import { FilterBar, FilterSelect, SearchInput } from "@/components/shared/filter-bar";
import { PageHeader } from "@/components/shared/page-header";
import { DocumentFooter, DocumentHeader, DocumentParty, PdfPreview } from "@/components/shared/pdf-preview";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/states";
import { StockPill } from "@/components/shared/stock-pill";
import { ProductImage } from "@/components/shop/product-card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useMe } from "@/features/session/use-session";
import { useAddToBasket } from "@/features/shop/use-add-to-basket";
import { categoryTree, filterCatalogue, SECTION_LABEL, useCatalogue, type CatalogueLine } from "@/features/shop/use-catalogue";
import { api, errorMessage } from "@/lib/api";
import { downloadText } from "@/lib/download";
import { formatDate, formatMoney, plural } from "@/lib/format";
import { hrefFor } from "@/lib/links";
import type { CatalogueSection } from "@/types";

const PAGE = 60;

export default function PriceListPage() {
  const { priceList, categories } = useCatalogue();
  const me = useMe();
  const add = useAddToBasket();
  const [search, setSearch] = useState("");
  const [section, setSection] = useState<CatalogueSection | "all">("all");
  const [category, setCategory] = useState<string>("all");
  const [stockFilter, setStockFilter] = useState<"all" | "available">("all");
  const [limit, setLimit] = useState(PAGE);
  const [pdfOpen, setPdfOpen] = useState(false);

  const exportCsv = useMutation({
    mutationFn: () => api.priceList.export(),
    onSuccess: (file) => {
      downloadText(file.filename, file.content, file.mimeType);
      toast.success("Price list downloaded", { description: file.filename });
    },
    onError: (error) => toast.error("The download could not be prepared", { description: errorMessage(error) }),
  });

  const cats = useMemo(() => categories.data ?? [], [categories.data]);
  const filtered = useMemo(
    () => (priceList.data ? filterCatalogue(priceList.data.lines, cats, { search, section, category, inStockOnly: stockFilter === "available", sort: "name" }) : []),
    [priceList.data, cats, search, section, category, stockFilter],
  );
  const categoryName = useMemo(() => new Map(cats.map((c) => [c.id, c.name])), [cats]);
  const tree = useMemo(() => categoryTree(cats).filter((t) => section === "all" || t.category.section === section), [cats, section]);
  const active = [search, section !== "all", category !== "all", stockFilter !== "all"].filter(Boolean).length;
  const clear = () => {
    setSearch("");
    setSection("all");
    setCategory("all");
    setStockFilter("all");
  };

  const list = priceList.data?.priceList;

  return (
    <div>
      <PageHeader
        title="Price list"
        description={list ? `${list.name}, valid from ${formatDate(list.validFrom)}. Prices exclude VAT.` : "The prices that apply to your account."}
        actions={
          <>
            <Button variant="outline" onClick={() => setPdfOpen(true)} disabled={!priceList.data}>
              <FilePdfIcon aria-hidden />
              PDF
            </Button>
            <Button variant="outline" onClick={() => exportCsv.mutate()} disabled={exportCsv.isPending}>
              <DownloadSimpleIcon aria-hidden />
              {exportCsv.isPending ? "Preparing…" : "Download CSV"}
            </Button>
          </>
        }
      />

      <FilterBar
        activeCount={active}
        onClear={clear}
        search={<SearchInput value={search} onChange={(v) => { setSearch(v); setLimit(PAGE); }} placeholder="Search by product, SKU or category" label="Search the price list" />}
        filters={
          <>
            <FilterSelect
              label="Section"
              value={section}
              onChange={(v) => {
                setSection(v);
                setCategory("all");
              }}
              options={[{ value: "all", label: "All sections" }, ...(Object.keys(SECTION_LABEL) as CatalogueSection[]).map((s) => ({ value: s, label: SECTION_LABEL[s] }))]}
            />
            <FilterSelect
              label="Category"
              value={category}
              onChange={setCategory}
              options={[
                { value: "all", label: "All categories" },
                ...tree.flatMap((t) => [{ value: t.category.id, label: t.category.name }, ...t.children.map((c) => ({ value: c.id, label: `  ${t.category.name}: ${c.name}` }))]),
              ]}
            />
            <FilterSelect label="Stock" value={stockFilter} onChange={setStockFilter} options={[{ value: "all", label: "Any stock status" }, { value: "available", label: "Available now" }]} />
          </>
        }
      />

      {priceList.isPending ? (
        <LoadingState rows={8} label="Loading your price list" />
      ) : priceList.isError ? (
        <ErrorState error={priceList.error} onRetry={() => priceList.refetch()} />
      ) : filtered.length === 0 ? (
        <EmptyState icon={MagnifyingGlassIcon} title="No products match these filters" description="Try another search term or clear the filters." action={<Button variant="outline" onClick={clear}>Clear filters</Button>} />
      ) : (
        <>
          <p className="mb-2 text-sm text-muted-foreground" role="status" aria-live="polite">
            {plural(filtered.length, "product")}
          </p>

          <div className="hidden overflow-hidden rounded-2xl border bg-card md:block">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-4">Product</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead className="text-right">List price</TableHead>
                  <TableHead className="text-right">Your price</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead className="pr-4 text-right">
                    <span className="sr-only">Add to basket</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.slice(0, limit).map((l) => (
                  <TableRow key={l.productId}>
                    <TableCell className="max-w-[360px] pl-4">
                      <Link href={hrefFor("product", l.productId)} className="flex items-center gap-3">
                        <ProductImage src={l.product.images[0]} alt="" sizes="40px" className="size-10 shrink-0 rounded-md border" />
                        <span className="min-w-0">
                          <span className="block truncate font-medium hover:underline">{l.product.name}</span>
                          <span className="block truncate text-xs text-muted-foreground">{categoryName.get(l.product.subcategory ?? l.product.category)}</span>
                        </span>
                      </Link>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{l.product.sku}</TableCell>
                    <TableCell className="text-muted-foreground">{l.product.packSize > 1 ? `Pack of ${l.product.packSize}` : l.product.unit === "metre" ? "Per metre" : "Each"}</TableCell>
                    <TableCell className="text-right text-muted-foreground tabular-nums">
                      {l.discountPercent > 0 ? (
                        <>
                          <span className="line-through">{formatMoney(l.product.listPrice)}</span>
                          <span className="ml-1.5 text-xs text-success">−{l.discountPercent}%</span>
                        </>
                      ) : (
                        formatMoney(l.product.listPrice)
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{formatMoney(l.price)}</TableCell>
                    <TableCell>
                      <StockPill stock={l.stock} />
                    </TableCell>
                    <TableCell className="pr-4 text-right">
                      <Button size="icon-sm" variant="outline" onClick={() => add.mutate({ productId: l.productId, qty: 1, name: l.product.name })} disabled={add.isPending || l.stock?.status === "out"} aria-label={`Add ${l.product.name} to basket`}>
                        <PlusIcon aria-hidden />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <ul className="space-y-2 md:hidden">
            {filtered.slice(0, limit).map((l) => (
              <li key={l.productId} className="flex items-center gap-3 rounded-xl border bg-card p-3">
                <ProductImage src={l.product.images[0]} alt="" sizes="56px" className="size-14 shrink-0 rounded-lg border" />
                <div className="min-w-0 flex-1">
                  <Link href={hrefFor("product", l.productId)} className="line-clamp-2 text-sm font-medium">
                    {l.product.name}
                  </Link>
                  <p className="font-mono text-[11px] text-muted-foreground">{l.product.sku}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="font-semibold tabular-nums">{formatMoney(l.price)}</span>
                    <StockPill stock={l.stock} />
                  </div>
                </div>
                <Button size="icon" variant="outline" className="rounded-full" onClick={() => add.mutate({ productId: l.productId, qty: 1, name: l.product.name })} disabled={add.isPending || l.stock?.status === "out"} aria-label={`Add ${l.product.name} to basket`}>
                  <PlusIcon aria-hidden />
                </Button>
              </li>
            ))}
          </ul>

          {filtered.length > limit ? (
            <div className="mt-4 flex justify-center">
              <Button variant="outline" onClick={() => setLimit((n) => n + PAGE)}>
                Show {Math.min(PAGE, filtered.length - limit)} more
              </Button>
            </div>
          ) : null}
        </>
      )}

      {priceList.data ? (
        <PdfPreview open={pdfOpen} onOpenChange={setPdfOpen} title="Price list PDF">
          <PriceListDocument lines={priceList.data.lines} name={priceList.data.priceList.name} validFrom={priceList.data.priceList.validFrom} accountName={me.data?.group?.account.name ?? me.data?.account.name ?? ""} categoryName={categoryName} />
        </PdfPreview>
      ) : null}

      {priceList.data && !priceList.isPending && priceList.data.lines.length === 0 ? <EmptyState icon={TagIcon} title="No price list is assigned yet" description="Ask your Brewfitt account manager to set up your trade prices." /> : null}
    </div>
  );
}

function PriceListDocument({ lines, name, validFrom, accountName, categoryName }: { lines: CatalogueLine[]; name: string; validFrom: string; accountName: string; categoryName: Map<string, string> }) {
  const groups = new Map<string, CatalogueLine[]>();
  for (const l of [...lines].sort((a, b) => a.product.name.localeCompare(b.product.name))) {
    const key = categoryName.get(l.product.category) ?? "Other";
    groups.set(key, [...(groups.get(key) ?? []), l]);
  }
  return (
    <>
      <DocumentHeader kind="Price list" number={name} date={new Date().toISOString()} meta={[{ label: "Valid from", value: formatDate(validFrom) }]} />
      <div className="my-6">
        <DocumentParty label="Prepared for" lines={[accountName]} />
      </div>
      {[...groups.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([group, items]) => (
        <section key={group} className="mb-5 break-inside-avoid-page">
          <h3 className="mb-1 border-b border-neutral-300 pb-1 text-sm font-semibold">{group}</h3>
          <table className="w-full text-[11px]">
            <thead>
              <tr className="text-left text-neutral-500">
                <th className="py-1 font-medium">SKU</th>
                <th className="py-1 font-medium">Product</th>
                <th className="py-1 text-right font-medium">List</th>
                <th className="py-1 text-right font-medium">Your price</th>
              </tr>
            </thead>
            <tbody>
              {items.map((l) => (
                <tr key={l.productId} className="border-t border-neutral-100">
                  <td className="py-1 pr-2 font-mono whitespace-nowrap">{l.product.sku}</td>
                  <td className="py-1 pr-2">{l.product.name}</td>
                  <td className="py-1 text-right whitespace-nowrap text-neutral-500">{formatMoney(l.product.listPrice)}</td>
                  <td className="py-1 text-right font-medium whitespace-nowrap">{formatMoney(l.price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
      <DocumentFooter note="Prices are ex VAT and subject to Brewfitt's conditions of sale. Stock is confirmed at order." />
    </>
  );
}

"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, errorMessage, queryKeys } from "@/lib/api";
import type { Basket, Category, CatalogueSection, PriceListResponse } from "@/types";
import { usePersonaKey } from "@/features/session/use-session";

export type CatalogueLine = PriceListResponse["lines"][number];
export type SortKey = "relevance" | "name" | "price-asc" | "price-desc";

export const SECTION_LABEL: Record<CatalogueSection, string> = {
  cellar: "Cellar",
  bar: "Bar",
  "mobile-dispense": "Mobile dispense",
};

export function useCatalogue() {
  const key = usePersonaKey();
  const priceList = useQuery({
    queryKey: queryKeys.priceList(key),
    queryFn: () => api.priceList.get(),
  });
  const categories = useQuery({
    queryKey: queryKeys.categories(key),
    queryFn: () => api.products.categories(),
  });
  return { priceList, categories };
}

/** With no search, the catalogue leads with what trade buyers come for most. */
const FEATURED_CATEGORY_ORDER = [
  "Fonts",
  "Taps",
  "Keg Couplers",
  "Regulators",
  "Line Cleaning Equipment",
  "Beer Coolers",
  "Drip Trays",
  "CoolTube",
  "Coolants",
  "Lindr Dispenser",
  "Nitro Dispense",
  "Badge Holders",
  "Clamp Assemblies",
  "Foam Stop",
  "Gas Chain",
  "Bar Lighting",
  "Hot Drinks",
  "Wine Cooler",
];

export function filterCatalogue(
  lines: CatalogueLine[],
  categories: Category[],
  f: {
    search: string;
    section: CatalogueSection | "all";
    category: string | "all";
    inStockOnly: boolean;
    sort: SortKey;
  },
): CatalogueLine[] {
  const term = f.search.trim().toLowerCase();
  const catById = new Map(categories.map((c) => [c.id, c]));
  const words = term.split(/\s+/).filter(Boolean);
  const scored = lines
    .filter((l) => {
      const p = l.product;
      if (f.section !== "all" && catById.get(p.category)?.section !== f.section) return false;
      if (f.category !== "all" && p.category !== f.category && p.subcategory !== f.category)
        return false;
      if (f.inStockOnly && l.stock?.status !== "in-stock" && l.stock?.status !== "low")
        return false;
      if (!words.length) return true;
      const hay =
        `${p.name} ${p.sku} ${p.description} ${catById.get(p.category)?.name ?? ""} ${catById.get(p.subcategory ?? "")?.name ?? ""}`.toLowerCase();
      return words.every((w) => hay.includes(w));
    })
    .map((l) => ({
      l,
      score: words.length
        ? (l.product.name.toLowerCase().includes(term) ? 2 : 0) +
          (l.product.sku.toLowerCase() === term ? 3 : 0)
        : 0,
    }));
  const sorted = scored.sort((a, b) => {
    switch (f.sort) {
      case "name":
        return a.l.product.name.localeCompare(b.l.product.name);
      case "price-asc":
        return a.l.price.amount - b.l.price.amount;
      case "price-desc":
        return b.l.price.amount - a.l.price.amount;
      default: {
        if (words.length)
          return b.score - a.score || a.l.product.name.localeCompare(b.l.product.name);
        const rank = (l: CatalogueLine) => {
          const i = FEATURED_CATEGORY_ORDER.indexOf(catById.get(l.product.category)?.name ?? "");
          return i < 0 ? FEATURED_CATEGORY_ORDER.length : i;
        };
        // Within a category, higher-value items (fonts, coolers) before spares.
        return rank(a.l) - rank(b.l) || b.l.price.amount - a.l.price.amount;
      }
    }
  });
  return sorted.map((x) => x.l);
}

/** Top-level categories per section, with child categories, limited to what the account can buy. */
export function categoryTree(categories: Category[]) {
  const top = categories.filter((c) => !c.parentId);
  return top.map((c) => ({ category: c, children: categories.filter((x) => x.parentId === c.id) }));
}

export function useBasket() {
  const key = usePersonaKey();
  return useQuery({ queryKey: queryKeys.basket(key), queryFn: () => api.shop.basket() });
}

export function useBasketMutations() {
  const key = usePersonaKey();
  const queryClient = useQueryClient();
  const update = useMutation({
    mutationFn: (patch: Parameters<typeof api.shop.updateBasket>[0]) =>
      api.shop.updateBasket(patch),
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.basket(key) });
      const previous = queryClient.getQueryData<Basket>(queryKeys.basket(key));
      if (previous)
        queryClient.setQueryData<Basket>(queryKeys.basket(key), {
          ...previous,
          ...patch,
          lines: patch.lines ?? previous.lines,
        } as Basket);
      return { previous };
    },
    onError: (error, _patch, context) => {
      if (context?.previous) queryClient.setQueryData(queryKeys.basket(key), context.previous);
      toast.error("Your basket could not be updated", { description: errorMessage(error) });
    },
    onSuccess: (basket) => queryClient.setQueryData(queryKeys.basket(key), basket),
  });
  return { update };
}

export function useBasketCount(): number {
  const basket = useBasket();
  return useMemo(() => (basket.data?.lines ?? []).reduce((s, l) => s + l.qty, 0), [basket.data]);
}

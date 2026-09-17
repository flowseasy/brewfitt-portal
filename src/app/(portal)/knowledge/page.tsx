"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { BooksIcon, PlusIcon } from "@phosphor-icons/react";
import {
  KNOWLEDGE_TYPE,
  KnowledgeCard,
  KnowledgeSubmissionSheet,
} from "@/components/knowledge/knowledge-parts";
import { FilterBar, FilterSelect, SearchInput } from "@/components/shared/filter-bar";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/states";
import { StatusTabs } from "@/components/shared/status-tabs";
import { Button } from "@/components/ui/button";
import { useIsSupplier, usePersona, usePersonaKey } from "@/features/session/use-session";
import { api, queryKeys } from "@/lib/api";
import type { KnowledgeItem } from "@/types";

export default function KnowledgePage() {
  return (
    <Suspense fallback={<LoadingState rows={5} />}>
      <Knowledge />
    </Suspense>
  );
}

type Tab = "library" | "submissions";
type TypeFilter = "all" | KnowledgeItem["type"];

function Knowledge() {
  const key = usePersonaKey();
  const params = useSearchParams();
  const isSupplier = useIsSupplier();
  const persona = usePersona();
  const knowledge = useQuery({
    queryKey: queryKeys.knowledge(key),
    queryFn: () => api.knowledge.list(),
  });
  const categories = useQuery({
    queryKey: queryKeys.categories(key),
    queryFn: () => api.products.categories(),
  });
  const products = useQuery({
    queryKey: queryKeys.products(key),
    queryFn: () => api.products.list(),
  });
  const [tab, setTab] = useState<Tab>("library");
  const [search, setSearch] = useState(params.get("q") ?? "");
  const [type, setType] = useState<TypeFilter>("all");
  const [category, setCategory] = useState("all");
  const [submitOpen, setSubmitOpen] = useState(false);

  useEffect(() => {
    if (isSupplier && params.get("new")) setSubmitOpen(true);
  }, [isSupplier, params]);

  const categoryName = useMemo(
    () => new Map((categories.data ?? []).map((c) => [c.id, c.name])),
    [categories.data],
  );
  const productName = useMemo(
    () => new Map((products.data ?? []).map((p) => [p.id, p.name])),
    [products.data],
  );
  const all = knowledge.data ?? [];
  const library = all.filter((k) => k.status === "approved");
  const submissions = isSupplier
    ? all.filter((k) => k.submittedByAccountId === persona.accountId)
    : [];
  const base = tab === "library" ? library : submissions;
  const categoryOptions = [...new Set(library.map((k) => k.category))]
    .map((id) => ({ value: id, label: categoryName.get(id) ?? "Other" }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const q = search.trim().toLowerCase();
  const filtered = base.filter(
    (k) =>
      (type === "all" || k.type === type) &&
      (category === "all" || k.category === category) &&
      (!q ||
        [
          k.title,
          k.summary,
          categoryName.get(k.category) ?? "",
          ...k.productIds.map((id) => productName.get(id) ?? ""),
        ]
          .join(" ")
          .toLowerCase()
          .includes(q)),
  );
  const activeCount = (type !== "all" ? 1 : 0) + (category !== "all" ? 1 : 0);
  const clear = () => {
    setType("all");
    setCategory("all");
  };

  const filters = (
    <>
      <FilterSelect<TypeFilter>
        label="Type"
        value={type}
        onChange={setType}
        options={[
          { value: "all", label: "All types" },
          ...(Object.keys(KNOWLEDGE_TYPE) as KnowledgeItem["type"][]).map((t) => ({
            value: t,
            label: KNOWLEDGE_TYPE[t].label,
          })),
        ]}
      />
      <FilterSelect
        label="Category"
        value={category}
        onChange={setCategory}
        options={[{ value: "all", label: "All categories" }, ...categoryOptions]}
      />
    </>
  );

  return (
    <div>
      <PageHeader
        title="Knowledge centre"
        description={
          isSupplier
            ? "Manuals, guides, videos, FAQs and spec sheets, including what you have contributed for your products."
            : "Manuals, install guides, cleaning and maintenance guides, spec sheets, videos and FAQs for the equipment you use."
        }
        actions={
          isSupplier ? (
            <Button onClick={() => setSubmitOpen(true)}>
              <PlusIcon aria-hidden />
              Contribute
            </Button>
          ) : null
        }
      />
      {isSupplier ? (
        <StatusTabs
          tabs={[
            { value: "library" as Tab, label: "Library", count: library.length },
            { value: "submissions" as Tab, label: "Your contributions", count: submissions.length },
          ]}
          value={tab}
          onChange={setTab}
        />
      ) : null}
      <FilterBar
        search={
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search by title, product or topic"
            label="Search the knowledge centre"
          />
        }
        filters={filters}
        activeCount={activeCount}
        onClear={clear}
      />

      {knowledge.isPending ? (
        <LoadingState rows={6} label="Loading the knowledge centre" />
      ) : knowledge.isError ? (
        <ErrorState error={knowledge.error} onRetry={() => knowledge.refetch()} />
      ) : filtered.length === 0 ? (
        base.length === 0 && tab === "submissions" ? (
          <EmptyState
            icon={BooksIcon}
            title="You have not contributed anything yet"
            description="Share install guides, manuals or videos for your products. Brewfitt reviews them before customers see them."
            action={<Button onClick={() => setSubmitOpen(true)}>Contribute</Button>}
          />
        ) : (
          <EmptyState
            icon={BooksIcon}
            title="No results in the knowledge centre"
            description="Try a product name or a broader term, or clear the filters."
            action={
              q || activeCount ? (
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
        )
      ) : (
        <>
          <p className="mb-3 text-sm text-muted-foreground" aria-live="polite">
            {filtered.length} {filtered.length === 1 ? "item" : "items"}
          </p>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((k) => (
              <li key={k.id}>
                <KnowledgeCard
                  item={k}
                  categoryName={categoryName.get(k.category)}
                  showStatus={tab === "submissions"}
                />
              </li>
            ))}
          </ul>
        </>
      )}
      {isSupplier ? (
        <KnowledgeSubmissionSheet open={submitOpen} onOpenChange={setSubmitOpen} />
      ) : null}
    </div>
  );
}

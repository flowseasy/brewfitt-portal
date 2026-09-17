"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {
  BookOpenTextIcon,
  FileArrowUpIcon,
  FileTextIcon,
  ListChecksIcon,
  QuestionIcon,
  VideoIcon,
  type Icon,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { SelectField, TextareaField, TextField } from "@/components/forms/fields";
import { SearchInput } from "@/components/shared/filter-bar";
import { StatusPill } from "@/components/shared/status-pill";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { usePersonaKey } from "@/features/session/use-session";
import { api, errorMessage, queryKeys } from "@/lib/api";
import { formatShortDate } from "@/lib/format";
import { hrefFor } from "@/lib/links";
import { SUBMISSION_STATUS } from "@/lib/status";
import { cn } from "@/lib/utils";
import type { KnowledgeItem } from "@/types";

export const KNOWLEDGE_TYPE: Record<KnowledgeItem["type"], { label: string; icon: Icon }> = {
  manual: { label: "Manual", icon: BookOpenTextIcon },
  guide: { label: "Guide", icon: ListChecksIcon },
  video: { label: "Video", icon: VideoIcon },
  faq: { label: "FAQ", icon: QuestionIcon },
  spec: { label: "Spec sheet", icon: FileTextIcon },
};

export function KnowledgeCard({
  item,
  categoryName,
  showStatus,
}: {
  item: KnowledgeItem;
  categoryName?: string;
  showStatus?: boolean;
}) {
  const type = KNOWLEDGE_TYPE[item.type];
  return (
    <Link
      href={hrefFor("knowledge-item", item.id)}
      className="flex h-full flex-col rounded-2xl border bg-card p-4 transition hover:border-primary/40 hover:bg-accent/30"
    >
      <span className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-primary">
          <type.icon className="size-4" aria-hidden />
          {type.label}
        </span>
        {showStatus && item.status !== "approved" ? (
          <StatusPill tone={SUBMISSION_STATUS[item.status].tone}>
            {SUBMISSION_STATUS[item.status].label}
          </StatusPill>
        ) : null}
      </span>
      <span className="mt-2 leading-snug font-medium">{item.title}</span>
      <span className="mt-1 line-clamp-2 text-sm text-muted-foreground">{item.summary}</span>
      <span className="mt-auto pt-3 text-xs text-muted-foreground">
        {categoryName ? `${categoryName} · ` : ""}Updated {formatShortDate(item.updatedAt)}
        {item.source === "supplier" ? " · Supplier content" : ""}
      </span>
    </Link>
  );
}

const SubmissionForm = z
  .object({
    title: z.string().trim().min(3, "Give it a title"),
    type: z.enum(["manual", "guide", "video", "faq", "spec"]),
    category: z.string().min(1, "Choose a category"),
    productIds: z.array(z.string()).min(1, "Tag at least one product"),
    summary: z.string().trim().min(20, "Summarise it in a sentence or two (20 characters or more)"),
    fileName: z.string().nullable(),
    videoUrl: z.string().trim(),
  })
  .superRefine((v, ctx) => {
    if (v.type === "video") {
      if (!z.url().safeParse(v.videoUrl).success)
        ctx.addIssue({
          code: "custom",
          path: ["videoUrl"],
          message: "Enter the full link to the video, starting https://",
        });
    } else if (!v.fileName) {
      ctx.addIssue({ code: "custom", path: ["fileName"], message: "Attach the document" });
    }
  });
type SubmissionValues = z.infer<typeof SubmissionForm>;

/** Supplier contribution to the knowledge centre, reviewed by Brewfitt before customers see it. */
export function KnowledgeSubmissionSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const key = usePersonaKey();
  const router = useRouter();
  const queryClient = useQueryClient();
  const products = useQuery({
    queryKey: queryKeys.products(key),
    queryFn: () => api.products.list(),
    enabled: open,
  });
  const categories = useQuery({
    queryKey: queryKeys.categories(key),
    queryFn: () => api.products.categories(),
    enabled: open,
  });
  const [productSearch, setProductSearch] = useState("");

  const form = useForm<SubmissionValues>({
    resolver: zodResolver(SubmissionForm),
    defaultValues: {
      title: "",
      type: "guide",
      category: "",
      productIds: [],
      summary: "",
      fileName: null,
      videoUrl: "",
    },
  });
  const type = form.watch("type");
  const selected = form.watch("productIds");
  const fileName = form.watch("fileName");

  // Categories that the supplier's own products sit in.
  const categoryOptions = useMemo(() => {
    const used = new Set((products.data ?? []).flatMap((p) => [p.category, p.subcategory]));
    return (categories.data ?? [])
      .filter((c) => used.has(c.id))
      .map((c) => ({ value: c.id, label: c.name }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [products.data, categories.data]);
  const productMatches = (products.data ?? []).filter((p) =>
    `${p.name} ${p.sku}`.toLowerCase().includes(productSearch.trim().toLowerCase()),
  );

  const submit = useMutation({
    mutationFn: (v: SubmissionValues) =>
      api.knowledge.submit({
        title: v.title,
        type: v.type,
        category: v.category,
        productIds: v.productIds,
        summary: v.summary,
        fileName: v.type === "video" ? null : v.fileName,
        videoUrl: v.type === "video" ? v.videoUrl : null,
      }),
    onSuccess: (item) => {
      for (const k of [queryKeys.knowledge(key), queryKeys.documents(key)])
        void queryClient.invalidateQueries({ queryKey: k });
      onOpenChange(false);
      form.reset();
      toast.success("Submitted to Brewfitt", {
        description: "It appears in the knowledge centre once Brewfitt approves it.",
      });
      router.push(hrefFor("knowledge-item", item.id));
    },
    onError: (error) =>
      toast.error("The submission could not be sent", { description: errorMessage(error) }),
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Contribute to the knowledge centre</SheetTitle>
          <SheetDescription>
            Share a manual, guide, video, FAQ or spec sheet for your products. Brewfitt reviews it
            before customers can see it.
          </SheetDescription>
        </SheetHeader>
        <form
          onSubmit={form.handleSubmit((v) => submit.mutate(v))}
          className="flex flex-1 flex-col px-4"
          noValidate
        >
          <FieldGroup>
            <TextField
              control={form.control}
              name="title"
              label="Title"
              placeholder="Servicing the regulator diaphragm"
            />
            <Controller
              control={form.control}
              name="type"
              render={({ field }) => (
                <FieldSet>
                  <FieldLegend variant="label">Type</FieldLegend>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                    {(Object.keys(KNOWLEDGE_TYPE) as KnowledgeItem["type"][]).map((t) => (
                      <label
                        key={t}
                        className={cn(
                          "flex cursor-pointer items-center justify-center rounded-xl border p-2 text-sm focus-within:ring-3 focus-within:ring-ring/40",
                          field.value === t && "border-primary bg-brand-subtle/60 font-medium",
                        )}
                      >
                        <input
                          type="radio"
                          name="knowledge-type"
                          className="sr-only"
                          checked={field.value === t}
                          onChange={() => field.onChange(t)}
                        />
                        {KNOWLEDGE_TYPE[t].label}
                      </label>
                    ))}
                  </div>
                </FieldSet>
              )}
            />
            <SelectField
              control={form.control}
              name="category"
              label="Category"
              placeholder={
                categories.isPending || products.isPending
                  ? "Loading categories"
                  : "Choose a category"
              }
              options={categoryOptions}
            />
            <Controller
              control={form.control}
              name="productIds"
              render={({ field, fieldState }) => (
                <FieldSet data-invalid={fieldState.error ? true : undefined}>
                  <FieldLegend variant="label">Products it covers</FieldLegend>
                  <SearchInput
                    value={productSearch}
                    onChange={setProductSearch}
                    placeholder="Search your products"
                    label="Search your products"
                  />
                  <ul
                    className="max-h-48 overflow-y-auto rounded-xl border p-1"
                    aria-label="Your products"
                  >
                    {products.isPending ? (
                      <li className="p-2 text-sm text-muted-foreground">Loading your products</li>
                    ) : productMatches.length === 0 ? (
                      <li className="p-2 text-sm text-muted-foreground">No products match</li>
                    ) : (
                      productMatches.map((p) => (
                        <li key={p.id}>
                          <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-accent">
                            <input
                              type="checkbox"
                              className="accent-[var(--primary)]"
                              checked={field.value.includes(p.id)}
                              onChange={(e) =>
                                field.onChange(
                                  e.target.checked
                                    ? [...field.value, p.id]
                                    : field.value.filter((x) => x !== p.id),
                                )
                              }
                            />
                            <span className="min-w-0 flex-1 truncate">{p.name}</span>
                            <span className="font-mono text-xs text-muted-foreground">{p.sku}</span>
                          </label>
                        </li>
                      ))
                    )}
                  </ul>
                  <FieldDescription>
                    {selected.length
                      ? `${selected.length} selected`
                      : "Customers find it from these product pages."}
                  </FieldDescription>
                  {fieldState.error ? <FieldError>{fieldState.error.message}</FieldError> : null}
                </FieldSet>
              )}
            />
            <TextareaField
              control={form.control}
              name="summary"
              label="Summary"
              rows={3}
              placeholder="What it covers and who it is for"
            />
            {type === "video" ? (
              <TextField
                control={form.control}
                name="videoUrl"
                label="Video link"
                placeholder="https://"
                type="url"
              />
            ) : (
              <Field data-invalid={form.formState.errors.fileName ? true : undefined}>
                <FieldLabel htmlFor="knowledge-file">Document</FieldLabel>
                <label className="inline-flex h-9 w-fit cursor-pointer items-center gap-2 rounded-md border px-3 text-sm focus-within:ring-3 focus-within:ring-ring/40 hover:bg-accent">
                  <FileArrowUpIcon aria-hidden />
                  {fileName ? "Replace file" : "Choose file"}
                  <Input
                    id="knowledge-file"
                    type="file"
                    accept=".pdf"
                    className="sr-only"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) form.setValue("fileName", f.name, { shouldValidate: true });
                    }}
                  />
                </label>
                <FieldDescription>
                  {fileName
                    ? fileName
                    : "PDF. In this preview the file stays on your device; only its name is recorded."}
                </FieldDescription>
                {form.formState.errors.fileName ? (
                  <FieldError>{form.formState.errors.fileName.message}</FieldError>
                ) : null}
              </Field>
            )}
          </FieldGroup>
          <SheetFooter className="mt-auto px-0">
            <Button type="submit" disabled={submit.isPending}>
              {submit.isPending ? "Submitting…" : "Submit for approval"}
            </Button>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

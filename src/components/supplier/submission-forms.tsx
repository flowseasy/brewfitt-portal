"use client";

import { useState } from "react";
import Image from "next/image";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { FileIcon, ImageIcon, XIcon } from "@phosphor-icons/react";
import { toast } from "sonner";
import type { Category, Product, SupplierProduct } from "@/types";
import { SelectField, TextareaField, TextField } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
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
import { cn } from "@/lib/utils";

/** Uploaded files stay on the tester's device in Phase 1; their names are recorded with this prefix. */
export const UPLOAD_PREFIX = "upload:";
export const isUpload = (path: string) => path.startsWith(UPLOAD_PREFIX);
export const uploadName = (path: string) => path.slice(UPLOAD_PREFIX.length);

export function SubmissionImage({
  src,
  className,
}: {
  src: string | undefined;
  className?: string;
}) {
  if (!src || isUpload(src)) {
    return (
      <div
        className={cn("flex items-center justify-center bg-muted text-muted-foreground", className)}
        title={src ? uploadName(src) : undefined}
      >
        <ImageIcon className="size-6" aria-hidden />
      </div>
    );
  }
  return (
    <div className={cn("relative overflow-hidden bg-white", className)}>
      <Image src={src} alt="" fill sizes="96px" className="object-contain p-1.5" />
    </div>
  );
}

const money = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,2})?$/, "Enter a price, for example 185.00")
  .refine((v) => Number(v) > 0, "The price must be more than zero");

const ProductForm = z.object({
  name: z.string().trim().min(3, "Enter the product name"),
  sku: z.string().trim().min(2, "Enter your SKU"),
  category: z.string().min(1, "Choose the category it belongs in"),
  images: z.array(z.string()).min(1, "Add at least one product image"),
  brandingAssets: z.array(z.string()),
  specSheetFileName: z.string().nullable(),
  costPrice: money,
  leadTimeDays: z
    .string()
    .trim()
    .regex(/^\d{1,3}$/, "Enter the lead time in working days"),
  minimumOrder: z
    .string()
    .trim()
    .regex(/^[1-9]\d{0,4}$/, "Enter the minimum order quantity"),
});
type ProductValues = z.infer<typeof ProductForm>;

/** Product submission form (supplier). Used for new submissions and resubmissions. */
export function SupplierProductSheet({
  open,
  onOpenChange,
  categories,
  range,
  existing,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  categories: Category[];
  range: Product[];
  existing?: SupplierProduct | null;
}) {
  const key = usePersonaKey();
  const queryClient = useQueryClient();
  const form = useForm<ProductValues>({
    resolver: zodResolver(ProductForm),
    values: existing
      ? {
          name: existing.name,
          sku: existing.sku,
          category: existing.category,
          images: existing.images,
          brandingAssets: existing.brandingAssets,
          specSheetFileName: null,
          costPrice: (existing.costPrice.amount / 100).toFixed(2),
          leadTimeDays: String(existing.leadTimeDays),
          minimumOrder: String(existing.minimumOrder),
        }
      : {
          name: "",
          sku: "",
          category: "",
          images: [],
          brandingAssets: [],
          specSheetFileName: null,
          costPrice: "",
          leadTimeDays: "",
          minimumOrder: "1",
        },
  });
  const [pickerOpen, setPickerOpen] = useState(false);

  const save = useMutation({
    mutationFn: (v: ProductValues) => {
      const input = {
        ...v,
        costPrice: { amount: Math.round(Number(v.costPrice) * 100), currency: "GBP" as const },
        leadTimeDays: Number(v.leadTimeDays),
        minimumOrder: Number(v.minimumOrder),
      };
      return existing
        ? api.supplierProducts.update(existing.id, input)
        : api.supplierProducts.create(input);
    },
    onSuccess: (sp) => {
      for (const k of [
        queryKeys.supplierProducts(key),
        queryKeys.threads(key),
        queryKeys.documents(key),
      ])
        void queryClient.invalidateQueries({ queryKey: k });
      onOpenChange(false);
      form.reset();
      toast.success(existing ? `${sp.name} resubmitted` : `${sp.name} submitted`, {
        description: "Brewfitt's buyer reviews it and approves it into TOTA360v5.",
      });
    },
    onError: (error) =>
      toast.error("The submission could not be sent", { description: errorMessage(error) }),
  });

  const images = form.watch("images");
  const galleries = [...new Set(range.flatMap((p) => p.images))].slice(0, 24);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{existing ? `Resubmit ${existing.name}` : "Submit a product"}</SheetTitle>
          <SheetDescription>
            Brewfitt reviews product data, images, branding and spec sheet before listing it.
          </SheetDescription>
        </SheetHeader>
        <form
          onSubmit={form.handleSubmit((v) => save.mutate(v))}
          className="flex flex-1 flex-col px-4"
          noValidate
        >
          <FieldGroup>
            <TextField control={form.control} name="name" label="Product name" />
            <div className="grid grid-cols-2 gap-3">
              <TextField control={form.control} name="sku" label="Your SKU" />
              <SelectField
                control={form.control}
                name="category"
                label="Category"
                options={categories
                  .filter((c) => !c.parentId)
                  .map((c) => ({ value: c.id, label: c.name }))}
              />
            </div>

            <Controller
              control={form.control}
              name="images"
              render={({ fieldState }) => (
                <Field data-invalid={fieldState.invalid || undefined}>
                  <FieldLabel>Product images</FieldLabel>
                  <FieldDescription>
                    Upload photographs of the finished product, or reuse an image already in
                    Brewfitt&apos;s catalogue.
                  </FieldDescription>
                  <div className="flex flex-wrap gap-2">
                    {images.map((src) => (
                      <div key={src} className="relative">
                        <SubmissionImage src={src} className="size-16 rounded-lg border" />
                        {isUpload(src) ? (
                          <span className="absolute inset-x-0 bottom-0 truncate rounded-b-lg bg-black/60 px-1 text-[9px] text-white">
                            {uploadName(src)}
                          </span>
                        ) : null}
                        <button
                          type="button"
                          onClick={() =>
                            form.setValue(
                              "images",
                              images.filter((x) => x !== src),
                              { shouldValidate: true },
                            )
                          }
                          className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-foreground text-background"
                          aria-label="Remove image"
                        >
                          <XIcon className="size-3" aria-hidden />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border px-3 text-sm focus-within:ring-3 focus-within:ring-ring/40 hover:bg-accent">
                      <ImageIcon aria-hidden />
                      Upload images
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="sr-only"
                        onChange={(e) =>
                          form.setValue(
                            "images",
                            [
                              ...images,
                              ...[...(e.target.files ?? [])].map(
                                (f) => `${UPLOAD_PREFIX}${f.name}`,
                              ),
                            ],
                            { shouldValidate: true },
                          )
                        }
                      />
                    </label>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setPickerOpen((v) => !v)}
                      aria-expanded={pickerOpen}
                    >
                      Use a catalogue image
                    </Button>
                  </div>
                  {pickerOpen ? (
                    <div className="grid grid-cols-4 gap-2 rounded-xl border p-2 sm:grid-cols-6">
                      {galleries.map((src) => (
                        <button
                          key={src}
                          type="button"
                          aria-pressed={images.includes(src)}
                          onClick={() =>
                            form.setValue(
                              "images",
                              images.includes(src)
                                ? images.filter((x) => x !== src)
                                : [...images, src],
                              { shouldValidate: true },
                            )
                          }
                          className={cn(
                            "overflow-hidden rounded-lg border-2",
                            images.includes(src) ? "border-primary" : "border-transparent",
                          )}
                        >
                          <SubmissionImage src={src} className="aspect-square w-full" />
                        </button>
                      ))}
                    </div>
                  ) : null}
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />

            <Field>
              <FieldLabel htmlFor="branding">Branding assets (optional)</FieldLabel>
              <input
                id="branding"
                type="file"
                multiple
                onChange={(e) =>
                  form.setValue(
                    "brandingAssets",
                    [...(e.target.files ?? [])].map((f) => f.name),
                  )
                }
                className="text-sm file:mr-3 file:rounded-md file:border file:bg-background file:px-3 file:py-1.5"
              />
              {form.watch("brandingAssets").length ? (
                <ul className="flex flex-wrap gap-1.5">
                  {form.watch("brandingAssets").map((n) => (
                    <li
                      key={n}
                      className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs"
                    >
                      <FileIcon aria-hidden />
                      {n}
                    </li>
                  ))}
                </ul>
              ) : null}
            </Field>
            <Field>
              <FieldLabel htmlFor="spec">Spec sheet (PDF)</FieldLabel>
              <input
                id="spec"
                type="file"
                accept=".pdf"
                onChange={(e) =>
                  form.setValue("specSheetFileName", e.target.files?.[0]?.name ?? null)
                }
                className="text-sm file:mr-3 file:rounded-md file:border file:bg-background file:px-3 file:py-1.5"
              />
              <FieldDescription>
                No spec sheets are held in OMv4 yet, so submissions with one are listed sooner.
              </FieldDescription>
            </Field>

            <div className="grid grid-cols-3 gap-3">
              <TextField
                control={form.control}
                name="costPrice"
                label="Cost price (£)"
                inputMode="decimal"
              />
              <TextField
                control={form.control}
                name="leadTimeDays"
                label="Lead time (days)"
                inputMode="numeric"
              />
              <TextField
                control={form.control}
                name="minimumOrder"
                label="Minimum order"
                inputMode="numeric"
              />
            </div>
          </FieldGroup>
          <p className="mt-3 text-xs text-muted-foreground">
            In this preview, uploaded files stay on your device; only their names are sent.
          </p>
          <SheetFooter className="mt-auto px-0">
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? "Sending…" : existing ? "Resubmit for review" : "Submit for review"}
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

const OfferForm = z
  .object({
    productIds: z.array(z.string()).min(1, "Choose at least one product"),
    description: z.string().trim().min(10, "Describe the offer in a sentence"),
    price: money,
    validFrom: z.iso.date({ message: "Choose a start date" }),
    validTo: z.iso.date({ message: "Choose an end date" }),
  })
  .refine((o) => o.validTo >= o.validFrom, {
    message: "The offer must end after it starts",
    path: ["validTo"],
  });
type OfferValues = z.infer<typeof OfferForm>;

export function OfferSheet({
  open,
  onOpenChange,
  range,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  range: Product[];
}) {
  const key = usePersonaKey();
  const queryClient = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const form = useForm<OfferValues>({
    resolver: zodResolver(OfferForm),
    defaultValues: { productIds: [], description: "", price: "", validFrom: today, validTo: "" },
  });
  const [filter, setFilter] = useState("");
  const selected = form.watch("productIds");
  const create = useMutation({
    mutationFn: (v: OfferValues) =>
      api.supplierProducts.createOffer({
        ...v,
        price: { amount: Math.round(Number(v.price) * 100), currency: "GBP" },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.offers(key) });
      onOpenChange(false);
      form.reset();
      toast.success("Offer submitted", {
        description: "Brewfitt's buyer reviews it before it applies.",
      });
    },
    onError: (error) =>
      toast.error("The offer could not be submitted", { description: errorMessage(error) }),
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>New offer</SheetTitle>
          <SheetDescription>
            A time-limited price on products you supply to Brewfitt.
          </SheetDescription>
        </SheetHeader>
        <form
          onSubmit={form.handleSubmit((v) => create.mutate(v))}
          className="flex flex-1 flex-col px-4"
          noValidate
        >
          <FieldGroup>
            <Controller
              control={form.control}
              name="productIds"
              render={({ fieldState }) => (
                <Field data-invalid={fieldState.invalid || undefined}>
                  <FieldLabel htmlFor="offer-filter">Products</FieldLabel>
                  <input
                    id="offer-filter"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    placeholder="Filter your range"
                    className="h-9 rounded-md border bg-background px-3 text-base sm:text-sm"
                  />
                  <ul className="max-h-48 space-y-1 overflow-y-auto rounded-xl border p-2">
                    {range
                      .filter((p) => !filter || p.name.toLowerCase().includes(filter.toLowerCase()))
                      .map((p) => (
                        <li key={p.id}>
                          <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-sm hover:bg-accent">
                            <input
                              type="checkbox"
                              checked={selected.includes(p.id)}
                              onChange={(e) =>
                                form.setValue(
                                  "productIds",
                                  e.target.checked
                                    ? [...selected, p.id]
                                    : selected.filter((x) => x !== p.id),
                                  { shouldValidate: true },
                                )
                              }
                              className="accent-[var(--primary)]"
                            />
                            <span className="min-w-0 flex-1 truncate">{p.name}</span>
                          </label>
                        </li>
                      ))}
                  </ul>
                  <FieldDescription>{selected.length} selected</FieldDescription>
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
            <TextareaField
              control={form.control}
              name="description"
              label="Offer"
              rows={2}
              placeholder="For example: launch price on orders of six or more"
            />
            <TextField
              control={form.control}
              name="price"
              label="Offer price per unit (£)"
              inputMode="decimal"
            />
            <div className="grid grid-cols-2 gap-3">
              <TextField
                control={form.control}
                name="validFrom"
                label="Valid from"
                type="date"
                min={today}
              />
              <TextField
                control={form.control}
                name="validTo"
                label="Valid to"
                type="date"
                min={today}
              />
            </div>
          </FieldGroup>
          <SheetFooter className="mt-auto px-0">
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? "Submitting…" : "Submit offer"}
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

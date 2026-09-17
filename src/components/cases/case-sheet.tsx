"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { CameraIcon, PaperclipIcon, XIcon } from "@phosphor-icons/react";
import { toast } from "sonner";
import { SelectField, TextareaField, TextField } from "@/components/forms/fields";
import { UPLOAD_PREFIX, uploadName } from "@/components/supplier/submission-forms";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useIsSupplier, usePersonaKey } from "@/features/session/use-session";
import { api, errorMessage, queryKeys } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { hrefFor } from "@/lib/links";
import { cn } from "@/lib/utils";
import type { Case } from "@/types";

export const CASE_KIND_LABEL: Record<Case["kind"], string> = {
  fault: "Fault",
  warranty: "Warranty claim",
  return: "Return",
  query: "Technical question",
  "purchase-order": "Purchase order",
  payment: "Payment or remittance",
  delivery: "Delivery or booking",
  "product-listing": "Product listing",
  general: "General",
};

/** Customer Support and Supplier Support, named for the signed-in side. */
export function supportName(supplier: boolean): string {
  return supplier ? "Supplier Support" : "Customer Support";
}

const CUSTOMER_KINDS: Case["kind"][] = ["fault", "warranty", "return", "query"];
const SUPPLIER_KINDS: Case["kind"][] = [
  "purchase-order",
  "payment",
  "delivery",
  "product-listing",
  "general",
];

const URGENCY_HELP: Record<"customer" | "supplier", Record<Case["urgency"], string>> = {
  customer: {
    low: "No impact on service",
    normal: "Affects service but a workaround exists",
    high: "Affecting sales today",
    critical: "Unable to serve",
  },
  supplier: {
    low: "For information",
    normal: "Needs an answer this week",
    high: "Holding up a delivery or payment",
    critical: "Stopping supply to Brewfitt",
  },
};

const NONE = "none";
const CaseForm = z.object({
  kind: z.string().min(1),
  urgency: z.enum(["low", "normal", "high", "critical"]),
  subject: z.string().trim().min(3, "Give it a short subject"),
  description: z
    .string()
    .trim()
    .min(20, "Describe it in a sentence or two so the right person can pick it up"),
  productId: z.string(),
  orderId: z.string(),
  jobId: z.string(),
  purchaseOrderId: z.string(),
  invoiceId: z.string(),
  photos: z.array(z.string()),
});
type CaseValues = z.infer<typeof CaseForm>;

export function RaiseCaseSheet({
  open,
  onOpenChange,
  defaults,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  defaults?: {
    orderId?: string;
    jobId?: string;
    productId?: string;
    purchaseOrderId?: string;
    invoiceId?: string;
  };
}) {
  const key = usePersonaKey();
  const supplier = useIsSupplier();
  const router = useRouter();
  const queryClient = useQueryClient();
  const orders = useQuery({
    queryKey: queryKeys.salesOrders(key),
    queryFn: () => api.orders.salesOrders(),
    enabled: open && !supplier,
  });
  const jobs = useQuery({
    queryKey: queryKeys.jobs(key),
    queryFn: () => api.jobs.list(),
    enabled: open && !supplier,
  });
  const purchaseOrders = useQuery({
    queryKey: queryKeys.purchaseOrders(key),
    queryFn: () => api.orders.purchaseOrders(),
    enabled: open && supplier,
  });
  const invoices = useQuery({
    queryKey: queryKeys.invoices(key),
    queryFn: () => api.invoices.list(),
    enabled: open && supplier,
  });
  const priceList = useQuery({
    queryKey: queryKeys.priceList(key),
    queryFn: () => api.priceList.get(),
    enabled: open,
  });

  const kinds = supplier ? SUPPLIER_KINDS : CUSTOMER_KINDS;
  const urgencyHelp = URGENCY_HELP[supplier ? "supplier" : "customer"];

  const form = useForm<CaseValues>({
    resolver: zodResolver(
      CaseForm.refine(
        (c) =>
          c.kind === "general" ||
          [c.productId, c.orderId, c.jobId, c.purchaseOrderId, c.invoiceId].some((v) => v !== NONE),
        {
          message: supplier
            ? "Link the issue to a purchase order, invoice or product"
            : "Link the case to a product, order or install job",
          path: ["productId"],
        },
      ),
    ),
    values: {
      kind: kinds[0]!,
      urgency: "normal",
      subject: "",
      description: "",
      productId: defaults?.productId ?? NONE,
      orderId: defaults?.orderId ?? NONE,
      jobId: defaults?.jobId ?? NONE,
      purchaseOrderId: defaults?.purchaseOrderId ?? NONE,
      invoiceId: defaults?.invoiceId ?? NONE,
      photos: [],
    },
    resetOptions: { keepDirtyValues: true },
  });
  const orderId = form.watch("orderId");
  const purchaseOrderId = form.watch("purchaseOrderId");
  const photos = form.watch("photos");

  // Products from the chosen order first, then everything bought (customers) or supplied (suppliers).
  const productOptions = useMemo(() => {
    const names = new Map((priceList.data?.lines ?? []).map((l) => [l.productId, l.product.name]));
    let ids: string[];
    if (supplier) {
      const po = purchaseOrders.data?.find((p) => p.id === purchaseOrderId);
      ids = po ? po.lines.map((l) => l.productId) : [...names.keys()];
    } else {
      const order = orders.data?.find((o) => o.id === orderId);
      ids = order
        ? order.lines.map((l) => l.productId)
        : [...new Set((orders.data ?? []).flatMap((o) => o.lines.map((l) => l.productId)))];
    }
    return ids
      .filter((id) => names.has(id))
      .map((id) => ({ value: id, label: names.get(id)! }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [supplier, orders.data, purchaseOrders.data, priceList.data, orderId, purchaseOrderId]);

  const create = useMutation({
    mutationFn: (v: CaseValues) => {
      const id = (x: string) => (x === NONE ? null : x);
      return api.cases.create({
        kind: v.kind as Case["kind"],
        urgency: v.urgency,
        subject: v.subject,
        description: v.description,
        productId: id(v.productId),
        orderId: supplier ? null : id(v.orderId),
        jobId: supplier ? null : id(v.jobId),
        purchaseOrderId: supplier ? id(v.purchaseOrderId) : null,
        invoiceId: supplier ? id(v.invoiceId) : null,
        photos: v.photos,
      });
    },
    onSuccess: (c) => {
      for (const k of [queryKeys.cases(key), queryKeys.threads(key)])
        void queryClient.invalidateQueries({ queryKey: k });
      onOpenChange(false);
      form.reset();
      toast.success(`${supplier ? "Issue" : "Case"} ${c.number} raised`, {
        description: supplier
          ? "Brewfitt's buyer will reply in the conversation."
          : "Brewfitt's technical team will reply in the case conversation.",
      });
      router.push(hrefFor("case", c.id));
    },
    onError: (error) =>
      toast.error(`The ${supplier ? "issue" : "case"} could not be raised`, {
        description: errorMessage(error),
      }),
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{supplier ? "Raise an issue with Brewfitt" : "Raise a case"}</SheetTitle>
          <SheetDescription>
            {supplier
              ? "Query a purchase order, a payment or remittance, a delivery booking or a product listing. Brewfitt's buyer picks it up."
              : "Report a fault, claim under warranty, arrange a return or ask a technical question."}
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
              name="kind"
              render={({ field }) => (
                <FieldSet>
                  <FieldLegend variant="label">What is it about?</FieldLegend>
                  <div className="grid grid-cols-2 gap-2">
                    {kinds.map((k) => (
                      <label
                        key={k}
                        className={cn(
                          "flex cursor-pointer items-center justify-center rounded-xl border p-2.5 text-center text-sm focus-within:ring-3 focus-within:ring-ring/40",
                          field.value === k && "border-primary bg-brand-subtle/60 font-medium",
                        )}
                      >
                        <input
                          type="radio"
                          className="sr-only"
                          checked={field.value === k}
                          onChange={() => field.onChange(k)}
                        />
                        {CASE_KIND_LABEL[k]}
                      </label>
                    ))}
                  </div>
                </FieldSet>
              )}
            />
            <Controller
              control={form.control}
              name="urgency"
              render={({ field }) => (
                <FieldSet>
                  <FieldLegend variant="label">How urgent is it?</FieldLegend>
                  <div className="space-y-1.5">
                    {(Object.keys(urgencyHelp) as Case["urgency"][]).map((u) => (
                      <label
                        key={u}
                        className={cn(
                          "flex cursor-pointer items-center gap-3 rounded-xl border p-2.5 text-sm focus-within:ring-3 focus-within:ring-ring/40",
                          field.value === u && "border-primary bg-brand-subtle/60",
                        )}
                      >
                        <input
                          type="radio"
                          className="accent-[var(--primary)]"
                          checked={field.value === u}
                          onChange={() => field.onChange(u)}
                        />
                        <span className="font-medium capitalize">{u}</span>
                        <span className="text-muted-foreground">{urgencyHelp[u]}</span>
                      </label>
                    ))}
                  </div>
                </FieldSet>
              )}
            />
            <TextField
              control={form.control}
              name="subject"
              label="Subject"
              placeholder={
                supplier
                  ? "Remittance does not match our statement"
                  : "Lager font fobbing on every first pour"
              }
            />
            <TextareaField
              control={form.control}
              name="description"
              label={supplier ? "What do you need from Brewfitt?" : "What is happening?"}
              rows={4}
              placeholder={
                supplier
                  ? "Reference numbers, what you expected and what you received"
                  : "When it started, which taps or lines, what you have already checked"
              }
            />

            {supplier ? (
              <>
                <SelectField
                  control={form.control}
                  name="purchaseOrderId"
                  label="Purchase order"
                  options={[
                    { value: NONE, label: "Not about a purchase order" },
                    ...[...(purchaseOrders.data ?? [])]
                      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                      .slice(0, 40)
                      .map((p) => ({
                        value: p.id,
                        label: `${p.number} · ${formatDate(p.createdAt)}`,
                      })),
                  ]}
                />
                <SelectField
                  control={form.control}
                  name="invoiceId"
                  label="Invoice"
                  options={[
                    { value: NONE, label: "Not about an invoice" },
                    ...[...(invoices.data ?? [])]
                      .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt))
                      .slice(0, 40)
                      .map((i) => ({
                        value: i.id,
                        label: `${i.number} · ${formatDate(i.issuedAt)}`,
                      })),
                  ]}
                />
              </>
            ) : (
              <SelectField
                control={form.control}
                name="orderId"
                label="Order (if it came from one)"
                options={[
                  { value: NONE, label: "Not linked to an order" },
                  ...(orders.data ?? []).slice(0, 40).map((o) => ({
                    value: o.id,
                    label: `${o.number} · ${formatDate(o.createdAt)}`,
                  })),
                ]}
              />
            )}
            <SelectField
              control={form.control}
              name="productId"
              label="Product"
              options={[{ value: NONE, label: "Not a specific product" }, ...productOptions]}
            />
            {!supplier && (jobs.data ?? []).length ? (
              <SelectField
                control={form.control}
                name="jobId"
                label="Install job"
                options={[
                  { value: NONE, label: "Not linked to an install" },
                  ...(jobs.data ?? []).map((j) => ({
                    value: j.id,
                    label: `${j.name} · ${formatDate(j.scheduledDate)}`,
                  })),
                ]}
              />
            ) : null}
            {form.formState.errors.productId ? (
              <FieldError>{form.formState.errors.productId.message}</FieldError>
            ) : null}

            <Field>
              <FieldLabel htmlFor="case-photos">
                {supplier ? "Attachments (optional)" : "Photos (optional)"}
              </FieldLabel>
              <label className="inline-flex h-9 w-fit cursor-pointer items-center gap-2 rounded-md border px-3 text-sm focus-within:ring-3 focus-within:ring-ring/40 hover:bg-accent">
                {supplier ? <PaperclipIcon aria-hidden /> : <CameraIcon aria-hidden />}
                {supplier ? "Add files" : "Add photos"}
                <input
                  id="case-photos"
                  type="file"
                  accept={supplier ? "image/*,.pdf" : "image/*"}
                  capture={supplier ? undefined : "environment"}
                  multiple
                  className="sr-only"
                  onChange={(e) =>
                    form.setValue("photos", [
                      ...photos,
                      ...[...(e.target.files ?? [])].map((f) => `${UPLOAD_PREFIX}${f.name}`),
                    ])
                  }
                />
              </label>
              {photos.length ? (
                <ul className="flex flex-wrap gap-1.5">
                  {photos.map((p) => (
                    <li
                      key={p}
                      className="inline-flex items-center gap-1 rounded-full border py-0.5 pr-1 pl-2.5 text-xs"
                    >
                      {uploadName(p)}
                      <button
                        type="button"
                        onClick={() =>
                          form.setValue(
                            "photos",
                            photos.filter((x) => x !== p),
                          )
                        }
                        className="flex size-5 items-center justify-center rounded-full hover:bg-accent"
                        aria-label={`Remove ${uploadName(p)}`}
                      >
                        <XIcon className="size-3" aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              <FieldDescription>
                {supplier
                  ? "Statements, delivery notes or screenshots help the buyer resolve it quickly."
                  : "Photos of the fault help an engineer bring the right parts."}{" "}
                In this preview only file names are sent.
              </FieldDescription>
            </Field>
          </FieldGroup>
          <SheetFooter className="mt-auto px-0">
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? "Raising…" : supplier ? "Raise issue" : "Raise case"}
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

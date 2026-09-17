"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { CameraIcon, XIcon } from "@phosphor-icons/react";
import { toast } from "sonner";
import { SelectField, TextareaField, TextField } from "@/components/forms/fields";
import { UPLOAD_PREFIX, uploadName } from "@/components/supplier/submission-forms";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { usePersonaKey } from "@/features/session/use-session";
import { api, errorMessage, queryKeys } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { hrefFor } from "@/lib/links";
import { cn } from "@/lib/utils";
import type { Case } from "@/types";

export const CASE_KIND_LABEL: Record<Case["kind"], string> = { fault: "Fault", warranty: "Warranty claim", return: "Return", query: "Technical question" };
const URGENCY_HELP: Record<Case["urgency"], string> = {
  low: "No impact on service",
  normal: "Affects service but a workaround exists",
  high: "Affecting sales today",
  critical: "Unable to serve",
};

const NONE = "none";
const CaseForm = z
  .object({
    kind: z.enum(["fault", "warranty", "return", "query"]),
    urgency: z.enum(["low", "normal", "high", "critical"]),
    subject: z.string().trim().min(3, "Give the case a short subject"),
    description: z.string().trim().min(20, "Describe the problem in a sentence or two so an engineer can triage it"),
    productId: z.string(),
    orderId: z.string(),
    jobId: z.string(),
    photos: z.array(z.string()),
  })
  .refine((c) => c.productId !== NONE || c.orderId !== NONE || c.jobId !== NONE, { message: "Link the case to a product, order or install job", path: ["productId"] });
type CaseValues = z.infer<typeof CaseForm>;

export function RaiseCaseSheet({ open, onOpenChange, defaults }: { open: boolean; onOpenChange: (o: boolean) => void; defaults?: { orderId?: string; jobId?: string; productId?: string } }) {
  const key = usePersonaKey();
  const router = useRouter();
  const queryClient = useQueryClient();
  const orders = useQuery({ queryKey: queryKeys.salesOrders(key), queryFn: () => api.orders.salesOrders(), enabled: open });
  const jobs = useQuery({ queryKey: queryKeys.jobs(key), queryFn: () => api.jobs.list(), enabled: open });
  const priceList = useQuery({ queryKey: queryKeys.priceList(key), queryFn: () => api.priceList.get(), enabled: open });

  const form = useForm<CaseValues>({
    resolver: zodResolver(CaseForm),
    values: { kind: "fault", urgency: "normal", subject: "", description: "", productId: defaults?.productId ?? NONE, orderId: defaults?.orderId ?? NONE, jobId: defaults?.jobId ?? NONE, photos: [] },
    resetOptions: { keepDirtyValues: true },
  });
  const orderId = form.watch("orderId");
  const photos = form.watch("photos");

  // Products from the chosen order first, then everything the account has bought.
  const productOptions = useMemo(() => {
    const names = new Map((priceList.data?.lines ?? []).map((l) => [l.productId, l.product.name]));
    const order = orders.data?.find((o) => o.id === orderId);
    const bought = order ? order.lines.map((l) => l.productId) : [...new Set((orders.data ?? []).flatMap((o) => o.lines.map((l) => l.productId)))];
    return bought.filter((id) => names.has(id)).map((id) => ({ value: id, label: names.get(id)! }));
  }, [orders.data, priceList.data, orderId]);

  const create = useMutation({
    mutationFn: (v: CaseValues) => api.cases.create({ ...v, productId: v.productId === NONE ? null : v.productId, orderId: v.orderId === NONE ? null : v.orderId, jobId: v.jobId === NONE ? null : v.jobId }),
    onSuccess: (c) => {
      for (const k of [queryKeys.cases(key), queryKeys.threads(key)]) void queryClient.invalidateQueries({ queryKey: k });
      onOpenChange(false);
      form.reset();
      toast.success(`Case ${c.number} raised`, { description: "Brewfitt's technical team will reply in the case conversation." });
      router.push(hrefFor("case", c.id));
    },
    onError: (error) => toast.error("The case could not be raised", { description: errorMessage(error) }),
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Raise a case</SheetTitle>
          <SheetDescription>Report a fault, claim under warranty, arrange a return or ask a technical question.</SheetDescription>
        </SheetHeader>
        <form onSubmit={form.handleSubmit((v) => create.mutate(v))} className="flex flex-1 flex-col px-4" noValidate>
          <FieldGroup>
            <Controller
              control={form.control}
              name="kind"
              render={({ field }) => (
                <FieldSet>
                  <FieldLegend variant="label">What kind of case?</FieldLegend>
                  <div className="grid grid-cols-2 gap-2">
                    {(Object.keys(CASE_KIND_LABEL) as Case["kind"][]).map((k) => (
                      <label key={k} className={cn("flex cursor-pointer items-center justify-center rounded-xl border p-2.5 text-sm focus-within:ring-3 focus-within:ring-ring/40", field.value === k && "border-primary bg-brand-subtle/60 font-medium")}>
                        <input type="radio" className="sr-only" checked={field.value === k} onChange={() => field.onChange(k)} />
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
                    {(Object.keys(URGENCY_HELP) as Case["urgency"][]).map((u) => (
                      <label key={u} className={cn("flex cursor-pointer items-center gap-3 rounded-xl border p-2.5 text-sm focus-within:ring-3 focus-within:ring-ring/40", field.value === u && "border-primary bg-brand-subtle/60")}>
                        <input type="radio" className="accent-[var(--primary)]" checked={field.value === u} onChange={() => field.onChange(u)} />
                        <span className="font-medium capitalize">{u}</span>
                        <span className="text-muted-foreground">{URGENCY_HELP[u]}</span>
                      </label>
                    ))}
                  </div>
                </FieldSet>
              )}
            />
            <TextField control={form.control} name="subject" label="Subject" placeholder="Lager font fobbing on every first pour" />
            <TextareaField control={form.control} name="description" label="What is happening?" rows={4} placeholder="When it started, which taps or lines, what you have already checked" />

            <SelectField control={form.control} name="orderId" label="Order (if it came from one)" options={[{ value: NONE, label: "Not linked to an order" }, ...(orders.data ?? []).slice(0, 40).map((o) => ({ value: o.id, label: `${o.number} · ${formatDate(o.createdAt)}` }))]} />
            <SelectField control={form.control} name="productId" label="Product" options={[{ value: NONE, label: "Not a specific product" }, ...productOptions]} />
            {(jobs.data ?? []).length ? <SelectField control={form.control} name="jobId" label="Install job" options={[{ value: NONE, label: "Not linked to an install" }, ...(jobs.data ?? []).map((j) => ({ value: j.id, label: `${j.name} · ${formatDate(j.scheduledDate)}` }))]} /> : null}
            {form.formState.errors.productId ? <FieldError>{form.formState.errors.productId.message}</FieldError> : null}

            <Field>
              <FieldLabel htmlFor="case-photos">Photos (optional)</FieldLabel>
              <label className="inline-flex h-9 w-fit cursor-pointer items-center gap-2 rounded-md border px-3 text-sm focus-within:ring-3 focus-within:ring-ring/40 hover:bg-accent">
                <CameraIcon aria-hidden />
                Add photos
                <input id="case-photos" type="file" accept="image/*" capture="environment" multiple className="sr-only" onChange={(e) => form.setValue("photos", [...photos, ...[...(e.target.files ?? [])].map((f) => `${UPLOAD_PREFIX}${f.name}`)])} />
              </label>
              {photos.length ? (
                <ul className="flex flex-wrap gap-1.5">
                  {photos.map((p) => (
                    <li key={p} className="inline-flex items-center gap-1 rounded-full border py-0.5 pr-1 pl-2.5 text-xs">
                      {uploadName(p)}
                      <button type="button" onClick={() => form.setValue("photos", photos.filter((x) => x !== p))} className="flex size-5 items-center justify-center rounded-full hover:bg-accent" aria-label={`Remove ${uploadName(p)}`}>
                        <XIcon className="size-3" aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              <FieldDescription>Photos of the fault help an engineer bring the right parts. In this preview only file names are sent.</FieldDescription>
            </Field>
          </FieldGroup>
          <SheetFooter className="mt-auto px-0">
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? "Raising…" : "Raise case"}
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

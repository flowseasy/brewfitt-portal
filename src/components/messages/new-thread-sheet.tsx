"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import { SelectField, TextareaField, TextField } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
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
import { formatShortDate } from "@/lib/format";
import { hrefFor } from "@/lib/links";
import type { Thread } from "@/types";

export const RELATED_LABEL: Record<NonNullable<Thread["relatedType"]>, string> = {
  account: "Account",
  product: "Product",
  configuration: "Dispense design",
  quote: "Quote",
  rfq: "RFQ",
  "sales-order": "Order",
  "purchase-order": "Purchase order",
  delivery: "Delivery",
  invoice: "Invoice",
  payment: "Payment",
  "payment-run": "Payment run",
  job: "Job",
  case: "Case",
  "knowledge-item": "Knowledge item",
  "supplier-product": "Product submission",
  offer: "Offer",
  document: "Document",
  thread: "Conversation",
};

const NONE = "none";
const Form = z.object({
  subject: z.string().trim().min(3, "Add a subject"),
  body: z.string().trim().min(1, "Write a message"),
  related: z.string(),
});
type Values = z.infer<typeof Form>;

/** Start a conversation with Brewfitt, optionally about a specific record. */
export function NewThreadSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const key = usePersonaKey();
  const router = useRouter();
  const queryClient = useQueryClient();
  const isSupplier = useIsSupplier();
  const quotes = useQuery({
    queryKey: queryKeys.quotes(key),
    queryFn: () => api.quotes.list(),
    enabled: open && !isSupplier,
  });
  const orders = useQuery({
    queryKey: queryKeys.salesOrders(key),
    queryFn: () => api.orders.salesOrders(),
    enabled: open && !isSupplier,
  });
  const invoices = useQuery({
    queryKey: queryKeys.invoices(key),
    queryFn: () => api.invoices.list(),
    enabled: open,
  });
  const pos = useQuery({
    queryKey: queryKeys.purchaseOrders(key),
    queryFn: () => api.orders.purchaseOrders(),
    enabled: open && isSupplier,
  });
  const form = useForm<Values>({
    resolver: zodResolver(Form),
    defaultValues: { subject: "", body: "", related: NONE },
  });

  // Recent records a conversation is most likely to be about; values are "type:id".
  const options = useMemo(() => {
    const recent = <T,>(list: T[] | undefined, date: (x: T) => string) =>
      [...(list ?? [])].sort((a, b) => date(b).localeCompare(date(a))).slice(0, 8);
    const out: { value: string; label: string }[] = [{ value: NONE, label: "Nothing specific" }];
    if (isSupplier) {
      for (const p of recent(pos.data, (x) => x.createdAt))
        out.push({
          value: `purchase-order:${p.id}`,
          label: `Purchase order ${p.number} · ${formatShortDate(p.createdAt)}`,
        });
    } else {
      for (const o of recent(orders.data, (x) => x.createdAt))
        out.push({
          value: `sales-order:${o.id}`,
          label: `Order ${o.number} · ${formatShortDate(o.createdAt)}`,
        });
      for (const q of recent(quotes.data, (x) => x.createdAt))
        out.push({
          value: `quote:${q.id}`,
          label: `Quote ${q.number} · ${formatShortDate(q.createdAt)}`,
        });
    }
    for (const i of recent(invoices.data, (x) => x.issuedAt))
      out.push({
        value: `invoice:${i.id}`,
        label: `Invoice ${i.number} · ${formatShortDate(i.issuedAt)}`,
      });
    return out;
  }, [isSupplier, pos.data, orders.data, quotes.data, invoices.data]);

  const create = useMutation({
    mutationFn: (v: Values) => {
      const [relatedType, relatedId] =
        v.related === NONE
          ? [null, null]
          : (v.related.split(":") as [NonNullable<Thread["relatedType"]>, string]);
      return api.messages.createThread({
        subject: v.subject,
        body: v.body,
        relatedType,
        relatedId,
      });
    },
    onSuccess: (thread) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.threads(key) });
      onOpenChange(false);
      form.reset();
      toast.success("Message sent", { description: "Brewfitt replies here and by email." });
      router.push(hrefFor("thread", thread.id));
    },
    onError: (error) =>
      toast.error("Your message was not sent", { description: errorMessage(error) }),
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>New message</SheetTitle>
          <SheetDescription>
            Your account team at Brewfitt picks this up. Link a record so they have the context.
          </SheetDescription>
        </SheetHeader>
        <form
          onSubmit={form.handleSubmit((v) => create.mutate(v))}
          className="flex flex-1 flex-col px-4"
          noValidate
        >
          <FieldGroup>
            <SelectField control={form.control} name="related" label="About" options={options} />
            <TextField
              control={form.control}
              name="subject"
              label="Subject"
              placeholder={
                isSupplier ? "Delivery slot for next week" : "Change of delivery address"
              }
            />
            <TextareaField control={form.control} name="body" label="Message" rows={6} />
          </FieldGroup>
          <SheetFooter className="mt-auto px-0">
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? "Sending…" : "Send"}
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

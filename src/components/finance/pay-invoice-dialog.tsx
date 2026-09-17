"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { Invoice } from "@/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePersonaKey } from "@/features/session/use-session";
import { api, errorMessage, queryKeys } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import {
  CardFields,
  cardFieldsSchema,
  emptyCard,
  last4,
  validateCard,
  type CardFieldValues,
} from "./card-fields";

const PayForm = cardFieldsSchema.superRefine(validateCard);

/** Customers without credit terms pay an invoice by card (mock). */
export function PayInvoiceDialog({
  invoice,
  open,
  onOpenChange,
}: {
  invoice: Invoice;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const key = usePersonaKey();
  const queryClient = useQueryClient();
  const form = useForm<CardFieldValues>({
    resolver: zodResolver(PayForm),
    defaultValues: emptyCard,
  });
  const pay = useMutation({
    mutationFn: (v: CardFieldValues) =>
      api.invoices.pay(invoice.id, {
        card: { nameOnCard: v.nameOnCard, last4: last4(v.cardNumber) },
      }),
    onSuccess: ({ payment }) => {
      for (const k of [
        queryKeys.invoices(key),
        queryKeys.invoice(key, invoice.id),
        queryKeys.statement(key),
        queryKeys.payments(key),
        queryKeys.me(key),
        queryKeys.insights(key),
        queryKeys.notifications(key),
      ])
        void queryClient.invalidateQueries({ queryKey: k });
      form.reset(emptyCard);
      onOpenChange(false);
      toast.success(`${formatMoney(payment.amount)} paid`, {
        description: `${invoice.number} is settled. ${payment.reference}.`,
      });
    },
    onError: (error) =>
      toast.error("The payment did not go through", { description: errorMessage(error) }),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Pay invoice {invoice.number}</DialogTitle>
          <DialogDescription>{formatMoney(invoice.outstanding)} outstanding.</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit((v) => pay.mutate(v))} noValidate>
          <CardFields control={form.control} title="Card details" />
          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pay.isPending}>
              {pay.isPending ? "Paying…" : `Pay ${formatMoney(invoice.outstanding)}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { Controller, type Control, type FieldValues, type Path } from "react-hook-form";
import { CreditCardIcon, LockKeyIcon } from "@phosphor-icons/react";
import { z } from "zod";
import { TextField } from "@/components/forms/fields";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";

/** Luhn check, run only in the browser; card numbers never leave the page. */
export function luhn(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let n = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
  }
  return sum % 10 === 0;
}

export const cardFieldsSchema = z.object({
  nameOnCard: z.string().trim(),
  cardNumber: z.string(),
  expiry: z.string(),
  cvc: z.string(),
});
export type CardFieldValues = z.infer<typeof cardFieldsSchema>;
export const emptyCard: CardFieldValues = { nameOnCard: "", cardNumber: "", expiry: "", cvc: "" };

/** Adds card validation issues; call from a schema's superRefine when paying by card. */
export function validateCard(v: CardFieldValues, ctx: z.RefinementCtx) {
  if (v.nameOnCard.length < 2)
    ctx.addIssue({ code: "custom", path: ["nameOnCard"], message: "Enter the name on the card" });
  if (!luhn(v.cardNumber))
    ctx.addIssue({ code: "custom", path: ["cardNumber"], message: "Enter a valid card number" });
  const m = v.expiry.match(/^(\d{2})\s*\/\s*(\d{2})$/);
  if (
    !m ||
    Number(m[1]) < 1 ||
    Number(m[1]) > 12 ||
    new Date(2000 + Number(m[2]), Number(m[1])) <= new Date()
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["expiry"],
      message: "Enter a future expiry date as MM/YY",
    });
  }
  if (!/^\d{3,4}$/.test(v.cvc))
    ctx.addIssue({
      code: "custom",
      path: ["cvc"],
      message: "Enter the 3 or 4 digit security code",
    });
}

export const last4 = (cardNumber: string) => cardNumber.replace(/\D/g, "").slice(-4);

/** Mock card step (decision 4). Only the last four digits are recorded. */
export function CardFields<T extends FieldValues & CardFieldValues>({
  control,
  title = "Pay by card",
}: {
  control: Control<T>;
  title?: string;
}) {
  return (
    <FieldSet className="rounded-xl border bg-muted/40 p-4">
      <FieldLegend className="flex items-center gap-2">
        <CreditCardIcon aria-hidden />
        {title}
      </FieldLegend>
      <FieldDescription className="flex items-start gap-1.5">
        <LockKeyIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
        Preview only: card details are checked in your browser and never sent or stored. Phase 2
        uses a secure payment provider.
      </FieldDescription>
      <TextField
        control={control}
        name={"nameOnCard" as Path<T>}
        label="Name on card"
        autoComplete="off"
      />
      <Controller
        control={control}
        name={"cardNumber" as Path<T>}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid || undefined}>
            <FieldLabel htmlFor="cardNumber">Card number</FieldLabel>
            <input
              id="cardNumber"
              inputMode="numeric"
              autoComplete="off"
              value={field.value ?? ""}
              onBlur={field.onBlur}
              onChange={(e) => field.onChange(e.target.value.replace(/[^\d ]/g, "").slice(0, 23))}
              placeholder="4242 4242 4242 4242"
              aria-invalid={fieldState.invalid || undefined}
              className="h-9 w-full rounded-md border bg-background px-3 text-base tabular-nums outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 sm:text-sm"
            />
            <FieldError errors={[fieldState.error]} />
          </Field>
        )}
      />
      <div className="grid grid-cols-2 gap-3">
        <TextField
          control={control}
          name={"expiry" as Path<T>}
          label="Expiry (MM/YY)"
          inputMode="numeric"
          autoComplete="off"
          placeholder="09/28"
        />
        <TextField
          control={control}
          name={"cvc" as Path<T>}
          label="Security code"
          inputMode="numeric"
          autoComplete="off"
          maxLength={4}
        />
      </div>
    </FieldSet>
  );
}

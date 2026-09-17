"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { MapPinIcon, PencilSimpleIcon, PlusIcon } from "@phosphor-icons/react";
import * as s from "@/schemas";
import type { Address } from "@/types";
import { SelectField, TextareaField, TextField } from "@/components/forms/fields";
import { EmptyState } from "@/components/shared/states";
import { StatusPill } from "@/components/shared/status-pill";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useAccountMutations } from "@/features/account/use-account";

const COUNTRY: Record<Address["country"], string> = { GB: "United Kingdom", IE: "Ireland", NL: "Netherlands", AE: "United Arab Emirates" };

export function formatAddress(a: Address): string[] {
  return [a.line1, a.line2, a.town, a.county, a.postcode, a.country !== "GB" ? COUNTRY[a.country] : null].filter((x): x is string => !!x);
}

export function AddressCard({ address, onEdit, accountName }: { address: Address; onEdit?: () => void; accountName?: string }) {
  return (
    <div className="flex h-full items-start gap-3 rounded-xl border bg-card p-4">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <MapPinIcon className="size-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium">{address.label}</p>
          {address.isDefault ? <StatusPill tone="brand" dot={false}>Default</StatusPill> : null}
          {address.approvalStatus === "pending" ? <StatusPill tone="info">Pending approval</StatusPill> : null}
        </div>
        {accountName ? <p className="text-xs text-muted-foreground">{accountName}</p> : null}
        <address className="mt-1 text-sm not-italic text-muted-foreground">{formatAddress(address).join(", ")}</address>
        {address.deliveryNotes ? <p className="mt-2 rounded-lg bg-muted/60 px-2.5 py-1.5 text-sm">{address.deliveryNotes}</p> : null}
      </div>
      {onEdit ? (
        <Button variant="ghost" size="icon-sm" onClick={onEdit} aria-label={`Edit ${address.label}`}>
          <PencilSimpleIcon aria-hidden />
        </Button>
      ) : null}
    </div>
  );
}

const UK_POSTCODE = /^[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}$/i;

const AddressForm = s.AddressInput.omit({ latitude: true, longitude: true })
  .extend({
    label: z.string().trim().min(2, "Name the address, for example Cellar door or Main bar"),
    line1: z.string().trim().min(3, "Enter the first line of the address"),
    town: z.string().trim().min(2, "Enter the town or city"),
  })
  .superRefine((a, ctx) => {
    if (a.country === "GB" && (!a.postcode || !UK_POSTCODE.test(a.postcode.trim()))) ctx.addIssue({ code: "custom", path: ["postcode"], message: "Enter a valid UK postcode" });
    if (a.country !== "AE" && !a.postcode) ctx.addIssue({ code: "custom", path: ["postcode"], message: "Enter the postcode" });
  });
type AddressFormValues = z.infer<typeof AddressForm>;

export function AddressesPanel({ addresses, accountNames }: { addresses: Address[]; accountNames?: Map<string, string> }) {
  const [editing, setEditing] = useState<Address | "new" | null>(null);
  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Billing and delivery addresses, with notes for drivers and engineers.</p>
        <Button size="sm" onClick={() => setEditing("new")}>
          <PlusIcon aria-hidden />
          Add address
        </Button>
      </div>
      {addresses.length === 0 ? (
        <EmptyState icon={MapPinIcon} title="No addresses" />
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {addresses.map((a) => (
            <li key={a.id}>
              <AddressCard address={a} onEdit={() => setEditing(a)} accountName={accountNames?.get(a.accountId)} />
            </li>
          ))}
        </ul>
      )}
      <AddressSheet address={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

function AddressSheet({ address, onClose }: { address: Address | "new" | null; onClose: () => void }) {
  const { createAddress, updateAddress } = useAccountMutations();
  const isNew = address === "new";
  const form = useForm<AddressFormValues>({
    resolver: zodResolver(AddressForm),
    values:
      address && address !== "new"
        ? { label: address.label, line1: address.line1, line2: address.line2, town: address.town, county: address.county, postcode: address.postcode, country: address.country, isDefault: address.isDefault, deliveryNotes: address.deliveryNotes }
        : { label: "", line1: "", line2: null, town: "", county: null, postcode: "", country: "GB", isDefault: false, deliveryNotes: null },
  });
  const saving = createAddress.isPending || updateAddress.isPending;

  const submit = form.handleSubmit(async (values) => {
    const input = { ...values, postcode: values.postcode ? values.postcode.trim().toUpperCase() : null };
    if (isNew) await createAddress.mutateAsync(input);
    else if (address) await updateAddress.mutateAsync({ id: address.id, input });
    onClose();
  });

  return (
    <Sheet open={address !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{isNew ? "Add an address" : "Edit address"}</SheetTitle>
          <SheetDescription>New and changed addresses are checked by Brewfitt before deliveries use them.</SheetDescription>
        </SheetHeader>
        <form onSubmit={submit} className="flex flex-1 flex-col px-4" noValidate>
          <FieldGroup>
            <TextField control={form.control} name="label" label="Address name" placeholder="Cellar door" />
            <TextField control={form.control} name="line1" label="Address line 1" autoComplete="address-line1" />
            <TextField control={form.control} name="line2" label="Address line 2 (optional)" autoComplete="address-line2" nullable />
            <TextField control={form.control} name="town" label="Town or city" autoComplete="address-level2" />
            <TextField control={form.control} name="county" label="County (optional)" nullable />
            <div className="grid grid-cols-2 gap-3">
              <TextField control={form.control} name="postcode" label="Postcode" autoComplete="postal-code" nullable />
              <SelectField control={form.control} name="country" label="Country" options={Object.entries(COUNTRY).map(([value, label]) => ({ value, label }))} />
            </div>
            <TextareaField control={form.control} name="deliveryNotes" label="Delivery notes (optional)" placeholder="Cellar hatch at the rear; call ahead" nullable rows={3} />
          </FieldGroup>
          <SheetFooter className="mt-auto px-0">
            <Button type="submit" disabled={saving || (!isNew && !form.formState.isDirty)}>
              {saving ? "Sending…" : "Send for approval"}
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

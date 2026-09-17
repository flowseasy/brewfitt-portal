"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { EnvelopeSimpleIcon, PencilSimpleIcon, PhoneIcon, PlusIcon, UserIcon } from "@phosphor-icons/react";
import * as s from "@/schemas";
import type { Contact } from "@/types";
import { SelectField, TextField } from "@/components/forms/fields";
import { StatusPill } from "@/components/shared/status-pill";
import { EmptyState } from "@/components/shared/states";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FieldGroup } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useAccountMutations } from "@/features/account/use-account";
import { initials } from "@/lib/format";

export const CONTACT_ROLE_LABEL: Record<Contact["role"], string> = {
  buyer: "Buyer",
  "bar-manager": "Bar manager",
  technical: "Technical",
  finance: "Finance",
  sales: "Sales",
};

export function ContactCard({ contact, onEdit }: { contact: Contact; onEdit?: () => void }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border bg-card p-4">
      <Avatar className="size-10">
        <AvatarFallback className="bg-muted text-sm font-medium">{initials(contact.name)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium">{contact.name}</p>
          {contact.isPrimary ? <StatusPill tone="brand" dot={false}>Primary</StatusPill> : null}
          {contact.approvalStatus === "pending" ? <StatusPill tone="info">Pending approval</StatusPill> : null}
        </div>
        <p className="text-sm text-muted-foreground">
          {contact.title} · {CONTACT_ROLE_LABEL[contact.role]}
          {contact.canApprove ? " · can approve orders" : ""}
        </p>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <a href={`mailto:${contact.email}`} className="flex min-w-0 items-center gap-1.5 text-primary hover:underline">
            <EnvelopeSimpleIcon className="size-4 shrink-0" aria-hidden />
            <span className="truncate">{contact.email}</span>
          </a>
          <a href={`tel:${contact.phone.replace(/\s/g, "")}`} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
            <PhoneIcon className="size-4" aria-hidden />
            {contact.phone}
          </a>
        </div>
      </div>
      {onEdit ? (
        <Button variant="ghost" size="icon-sm" onClick={onEdit} aria-label={`Edit ${contact.name}`}>
          <PencilSimpleIcon aria-hidden />
        </Button>
      ) : null}
    </div>
  );
}

const ContactForm = s.ContactInput.extend({
  phone: z.string().trim().min(6, "Enter a phone number"),
  name: z.string().trim().min(2, "Enter the contact's name"),
  title: z.string().trim().min(2, "Enter their job title"),
  email: z.email("Enter a valid email address, like name@business.co.uk"),
});
type ContactFormValues = z.infer<typeof ContactForm>;

export function ContactsPanel({ contacts }: { contacts: Contact[] }) {
  const [editing, setEditing] = useState<Contact | "new" | null>(null);
  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">People at your business who use the portal or deal with Brewfitt.</p>
        <Button size="sm" onClick={() => setEditing("new")}>
          <PlusIcon aria-hidden />
          Add contact
        </Button>
      </div>
      {contacts.length === 0 ? (
        <EmptyState icon={UserIcon} title="No contacts" description="Add the people Brewfitt should deal with." />
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {contacts.map((c) => (
            <li key={c.id}>
              <ContactCard contact={c} onEdit={() => setEditing(c)} />
            </li>
          ))}
        </ul>
      )}
      <ContactSheet contact={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

function ContactSheet({ contact, onClose }: { contact: Contact | "new" | null; onClose: () => void }) {
  const { createContact, updateContact } = useAccountMutations();
  const isNew = contact === "new";
  const form = useForm<ContactFormValues>({
    resolver: zodResolver(ContactForm),
    values:
      contact && contact !== "new"
        ? { name: contact.name, title: contact.title, email: contact.email, phone: contact.phone, role: contact.role, isPrimary: contact.isPrimary, canApprove: contact.canApprove }
        : { name: "", title: "", email: "", phone: "", role: "buyer", isPrimary: false, canApprove: false },
  });
  const saving = createContact.isPending || updateContact.isPending;

  const submit = form.handleSubmit(async (values) => {
    if (isNew) await createContact.mutateAsync(values);
    else if (contact) await updateContact.mutateAsync({ id: contact.id, input: values });
    onClose();
  });

  return (
    <Sheet open={contact !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{isNew ? "Add a contact" : "Edit contact"}</SheetTitle>
          <SheetDescription>Brewfitt approves contact changes before they take effect.</SheetDescription>
        </SheetHeader>
        <form onSubmit={submit} className="flex flex-1 flex-col px-4" noValidate>
          <FieldGroup>
            <TextField control={form.control} name="name" label="Name" autoComplete="name" />
            <TextField control={form.control} name="title" label="Job title" autoComplete="organization-title" />
            <SelectField control={form.control} name="role" label="Role" options={Object.entries(CONTACT_ROLE_LABEL).map(([value, label]) => ({ value, label }))} />
            <TextField control={form.control} name="email" label="Email" type="email" autoComplete="email" />
            <TextField control={form.control} name="phone" label="Phone" type="tel" autoComplete="tel" />
            <div className="flex items-center gap-2">
              <Checkbox id="canApprove" checked={form.watch("canApprove")} onCheckedChange={(v) => form.setValue("canApprove", v === true, { shouldDirty: true })} />
              <Label htmlFor="canApprove">Can approve quotes and orders</Label>
            </div>
          </FieldGroup>
          <SheetFooter className="mt-auto px-0">
            <Button type="submit" disabled={saving || (!isNew && !form.formState.isDirty)}>
              {saving ? "Sending…" : isNew ? "Send for approval" : "Send changes for approval"}
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

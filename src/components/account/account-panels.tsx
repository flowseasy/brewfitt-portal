"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { ClockCountdownIcon, FileArrowUpIcon, ShieldCheckIcon } from "@phosphor-icons/react";
import type { Account, Document, PendingChange } from "@/types";
import { TextField } from "@/components/forms/fields";
import { DocumentCard } from "@/components/shared/document-card";
import { EmptyState } from "@/components/shared/states";
import { StatusPill } from "@/components/shared/status-pill";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useAccountMutations } from "@/features/account/use-account";
import { usePersona, usePersonaKey } from "@/features/session/use-session";
import { api, queryKeys } from "@/lib/api";
import { formatDate, formatMoney, formatShortDate } from "@/lib/format";
import { usePersonaStore } from "@/stores/persona-store";

// ---------------------------------------------------------------------------
// Company details
// ---------------------------------------------------------------------------

const CompanyForm = z.object({
  name: z.string().trim().min(2, "Enter the trading name"),
  companyNumber: z
    .string()
    .trim()
    .regex(/^([A-Z]{2})?\d{6,8}$/i, "Enter an 8-digit Companies House number")
    .nullable(),
  vatNumber: z.string().trim().min(6, "Enter the full VAT number").nullable(),
});

export function CompanyDetailsDialog({
  account,
  open,
  onOpenChange,
}: {
  account: Account;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { updateAccount } = useAccountMutations();
  const form = useForm<z.infer<typeof CompanyForm>>({
    resolver: zodResolver(CompanyForm),
    values: {
      name: account.name,
      companyNumber: account.companyNumber,
      vatNumber: account.vatNumber,
    },
  });
  const submit = form.handleSubmit(async (values) => {
    await updateAccount.mutateAsync(values);
    onOpenChange(false);
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Company details</DialogTitle>
          <DialogDescription>
            Changes are sent to Brewfitt and applied once approved.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate>
          <FieldGroup>
            <TextField
              control={form.control}
              name="name"
              label="Trading name"
              autoComplete="organization"
            />
            <TextField
              control={form.control}
              name="companyNumber"
              label="Company registration number"
              nullable
            />
            <TextField control={form.control} name="vatNumber" label="VAT number" nullable />
          </FieldGroup>
          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={updateAccount.isPending || !form.formState.isDirty}>
              {updateAccount.isPending ? "Sending…" : "Send for approval"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Pending changes
// ---------------------------------------------------------------------------

const FIELD_LABEL: Record<string, string> = {
  name: "Trading name",
  companyNumber: "Company number",
  vatNumber: "VAT number",
};

function describeField(field: string): string {
  if (FIELD_LABEL[field]) return FIELD_LABEL[field];
  const [kind, subject, key] = field.split(":");
  if (kind && subject && key)
    return `${kind === "address" ? "Address" : "Contact"} ${subject}: ${key.replace(/([A-Z])/g, " $1").toLowerCase()}`;
  return field;
}

export function PendingChanges({ changes }: { changes: PendingChange[] }) {
  const pending = changes.filter((c) => c.status === "pending");
  if (pending.length === 0) return null;
  return (
    <section
      aria-labelledby="pending"
      className="rounded-2xl border border-info/30 bg-info-subtle p-4"
    >
      <h2 id="pending" className="flex items-center gap-2 font-medium">
        <ClockCountdownIcon className="size-5 text-info" aria-hidden />
        {pending.length} {pending.length === 1 ? "change" : "changes"} awaiting Brewfitt approval
      </h2>
      <ul className="mt-2 space-y-1 text-sm">
        {pending.map((c) => (
          <li key={c.id} className="flex flex-wrap gap-x-2">
            <span className="font-medium">{describeField(c.field)}:</span>
            <span className="text-muted-foreground line-through">{c.from || "blank"}</span>
            <span>→ {c.to || "blank"}</span>
            <span className="text-muted-foreground">({formatShortDate(c.requestedAt)})</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Compliance documents and agreements
// ---------------------------------------------------------------------------

const UploadForm = z.object({
  category: z.enum(["insurance", "compliance"]),
  expiresAt: z.iso
    .date({ message: "Enter the expiry date" })
    .refine(
      (d) => d > new Date().toISOString().slice(0, 10),
      "The expiry date must be in the future",
    ),
});

export function ComplianceDocuments({
  documents,
  canUpload,
}: {
  documents: Document[];
  canUpload: boolean;
}) {
  const [open, setOpen] = useState(false);
  const compliance = documents.filter(
    (d) => d.category === "insurance" || d.category === "compliance",
  );
  const agreements = documents.filter((d) => d.category === "agreement");
  return (
    <div className="space-y-8">
      <section aria-labelledby="compliance">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 id="compliance" className="font-medium">
              Insurance and compliance
            </h2>
            <p className="text-sm text-muted-foreground">
              Certificates with expiry dates and Brewfitt approval status.
            </p>
          </div>
          {canUpload ? (
            <Button size="sm" onClick={() => setOpen(true)}>
              <FileArrowUpIcon aria-hidden />
              Upload certificate
            </Button>
          ) : null}
        </div>
        {compliance.length === 0 ? (
          <EmptyState
            icon={ShieldCheckIcon}
            title="No certificates on file"
            description={
              canUpload
                ? "Upload your insurance certificates so Brewfitt can keep your supplier record current."
                : "Brewfitt's own certificates are in Documents."
            }
          />
        ) : (
          <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {compliance.map((d) => (
              <li key={d.id}>
                <DocumentCard doc={d} />
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-sm text-muted-foreground">
          Brewfitt&apos;s own insurance certificates and conditions of sale are in{" "}
          <Link
            href="/documents?category=company"
            className="font-medium text-primary hover:underline"
          >
            Documents
          </Link>
          .
        </p>
      </section>
      <section aria-labelledby="agreements">
        <h2 id="agreements" className="font-medium">
          Agreements with Brewfitt
        </h2>
        <p className="mb-3 text-sm text-muted-foreground">
          Signed agreements that apply to your account.
        </p>
        {agreements.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No agreements on file. Brewfitt&apos;s standard conditions of sale apply.
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {agreements.map((d) => (
              <li key={d.id}>
                <DocumentCard doc={d} showApproval={false} />
              </li>
            ))}
          </ul>
        )}
      </section>
      <UploadDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}

export function UploadDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { uploadDocument } = useAccountMutations();
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const form = useForm<z.infer<typeof UploadForm>>({
    resolver: zodResolver(UploadForm),
    defaultValues: { category: "insurance", expiresAt: "" },
  });

  const submit = form.handleSubmit(async (values) => {
    if (!file) {
      setFileError("Choose the certificate file");
      return;
    }
    const ext = file.name.split(".").pop()?.toLowerCase();
    const fileType =
      ext === "png"
        ? "png"
        : ext === "jpg" || ext === "jpeg"
          ? "jpg"
          : ext === "docx"
            ? "docx"
            : "pdf";
    await uploadDocument.mutateAsync({
      name: file.name,
      category: values.category,
      fileType,
      fileSize: Math.max(1, file.size),
      expiresAt: values.expiresAt,
    });
    setFile(null);
    form.reset();
    onOpenChange(false);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload a certificate</DialogTitle>
          <DialogDescription>
            Brewfitt reviews each certificate. In this preview the file stays on your device; only
            its details are recorded.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate>
          <FieldGroup>
            <Field data-invalid={fileError ? true : undefined}>
              <FieldLabel htmlFor="certificate">Certificate file</FieldLabel>
              <Input
                id="certificate"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.docx"
                onChange={(e) => {
                  setFile(e.target.files?.[0] ?? null);
                  setFileError(null);
                }}
              />
              <FieldDescription>PDF, JPG, PNG or Word.</FieldDescription>
              {fileError ? <FieldError>{fileError}</FieldError> : null}
            </Field>
            <Field>
              <FieldLabel htmlFor="category">Type</FieldLabel>
              <select
                id="category"
                {...form.register("category")}
                className="h-9 rounded-md border bg-background px-3 text-sm"
              >
                <option value="insurance">Insurance certificate</option>
                <option value="compliance">Other compliance document</option>
              </select>
            </Field>
            <TextField control={form.control} name="expiresAt" label="Expiry date" type="date" />
          </FieldGroup>
          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={uploadDocument.isPending}>
              {uploadDocument.isPending ? "Uploading…" : "Upload for approval"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Pub group sites
// ---------------------------------------------------------------------------

export function GroupSites({ group, sites }: { group: Account; sites: Account[] }) {
  const key = usePersonaKey();
  const persona = usePersona();
  const setActiveSite = usePersonaStore((s) => s.setActiveSite);
  const orders = useQuery({
    queryKey: queryKeys.salesOrders(key),
    queryFn: () => api.orders.salesOrders(),
  });
  const invoices = useQuery({
    queryKey: queryKeys.invoices(key),
    queryFn: () => api.invoices.list(),
  });
  const canSwitch = persona.kind === "group";
  // Site figures come from the group roll-up; a site login only sees its own records.
  const showStats = persona.kind === "group" && !persona.activeSiteId;
  const since = new Date(Date.now() - 365 * 86_400_000).toISOString();

  return (
    <section aria-labelledby="sites">
      <h2 id="sites" className="font-medium">
        {sites.length} sites in {group.name}
      </h2>
      <p className="mb-3 text-sm text-muted-foreground">
        Sites share the group&apos;s price list, account team and credit.
      </p>
      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {sites.map((site) => {
          const siteOrders = (orders.data ?? []).filter((o) => o.accountId === site.id);
          const spend = siteOrders
            .filter((o) => o.status !== "cancelled" && o.createdAt >= since)
            .reduce((s, o) => s + o.lines.reduce((x, l) => x + l.qty * l.price.amount, 0), 0);
          const open = siteOrders.filter((o) =>
            ["confirmed", "picking", "dispatched", "part-delivered"].includes(o.status),
          ).length;
          const balance = (invoices.data ?? [])
            .filter((i) => i.accountId === site.id)
            .reduce((s, i) => s + i.outstanding.amount, 0);
          const overdue = (invoices.data ?? []).some(
            (i) => i.accountId === site.id && i.status === "overdue",
          );
          return (
            <li key={site.id} className="rounded-xl border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{site.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Customer since {formatDate(site.createdAt)}
                  </p>
                </div>
                {overdue ? <StatusPill tone="danger">Overdue invoice</StatusPill> : null}
              </div>
              {showStats && orders.data && invoices.data ? (
                <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <dt className="text-xs text-muted-foreground">12-month spend</dt>
                    <dd className="font-medium tabular-nums">
                      {formatMoney({ amount: spend, currency: "GBP" }, { whole: true })}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Open orders</dt>
                    <dd className="font-medium tabular-nums">{open}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Balance</dt>
                    <dd className="font-medium tabular-nums">
                      {formatMoney({ amount: balance, currency: "GBP" }, { whole: true })}
                    </dd>
                  </div>
                </dl>
              ) : null}
              {canSwitch ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => setActiveSite(site.id)}
                >
                  View as this site
                </Button>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

import Link from "next/link";
import {
  FileImageIcon,
  FilePdfIcon,
  FileTextIcon,
  FileVideoIcon,
  FileXlsIcon,
} from "@phosphor-icons/react/dist/ssr";
import type { Document } from "@/types";
import { daysFromToday, formatDate, formatShortDate } from "@/lib/format";
import { hrefFor } from "@/lib/links";
import { StatusPill } from "./status-pill";

const FILE_ICON = {
  pdf: FilePdfIcon,
  jpg: FileImageIcon,
  png: FileImageIcon,
  docx: FileTextIcon,
  xlsx: FileXlsIcon,
  mp4: FileVideoIcon,
};

export function fileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Expiry warnings for insurance and compliance documents. */
export function ExpiryPill({ expiresAt }: { expiresAt: string | null }) {
  if (!expiresAt) return null;
  const days = daysFromToday(expiresAt);
  if (days < 0) return <StatusPill tone="danger">Expired {formatShortDate(expiresAt)}</StatusPill>;
  if (days <= 30)
    return (
      <StatusPill tone="warning">
        Expires in {days} {days === 1 ? "day" : "days"}
      </StatusPill>
    );
  return <span className="text-xs text-muted-foreground">Expires {formatDate(expiresAt)}</span>;
}

export function ApprovalPill({ status }: { status: Document["approvalStatus"] }) {
  if (!status) return null;
  if (status === "pending") return <StatusPill tone="info">Awaiting Brewfitt approval</StatusPill>;
  if (status === "rejected") return <StatusPill tone="danger">Rejected</StatusPill>;
  return <StatusPill tone="success">Approved</StatusPill>;
}

export function DocumentCard({
  doc,
  showApproval = true,
}: {
  doc: Document;
  showApproval?: boolean;
}) {
  const Icon = FILE_ICON[doc.fileType];
  return (
    <Link
      href={hrefFor("document", doc.id)}
      className="flex items-center gap-3 rounded-xl border bg-card p-3 transition hover:border-primary/40 hover:bg-accent/40"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="size-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{doc.name}</span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <span className="uppercase">{doc.fileType}</span>
          <span>{fileSize(doc.fileSize)}</span>
          <span>Updated {formatShortDate(doc.modifiedAt)}</span>
          <ExpiryPill expiresAt={doc.expiresAt} />
          {showApproval ? <ApprovalPill status={doc.approvalStatus} /> : null}
        </span>
      </span>
    </Link>
  );
}

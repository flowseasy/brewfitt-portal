"use client";

import type { ReactNode } from "react";
import { PrinterIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDate } from "@/lib/format";
import { BrandLogo } from "./brand-logo";

/**
 * Styled on-screen document with print (decision 9: PDFs are previews; no
 * files are generated). The printed page shows only the document.
 */
export function PdfPreview({
  open,
  onOpenChange,
  title,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
}) {
  const print = () => {
    document.documentElement.classList.add("printing");
    const done = () => {
      document.documentElement.classList.remove("printing");
      window.removeEventListener("afterprint", done);
    };
    window.addEventListener("afterprint", done);
    window.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[94dvh] w-[calc(100vw-1rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
        <DialogHeader className="flex-row items-center justify-between gap-3 border-b px-5 py-3">
          <div>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription className="text-xs">
              Preview of the PDF produced by TOTA360v5
            </DialogDescription>
          </div>
          <Button size="sm" variant="outline" onClick={print} className="mr-8">
            <PrinterIcon aria-hidden />
            Print or save as PDF
          </Button>
        </DialogHeader>
        <div className="overflow-y-auto bg-muted/60 p-3 sm:p-6">
          <article
            data-print-root
            className="mx-auto max-w-[210mm] bg-white p-6 text-[13px] leading-relaxed text-neutral-900 shadow-sm ring-1 ring-black/5 sm:p-10"
          >
            {children}
          </article>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Standard document letterhead. */
export function DocumentHeader({
  kind,
  number,
  date,
  meta,
}: {
  kind: string;
  number?: string;
  date: string;
  meta?: { label: string; value: string }[];
}) {
  return (
    <header className="flex flex-col gap-6 border-b border-neutral-200 pb-6 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <BrandLogo className="h-9" />
        <p className="mt-3 text-xs text-neutral-500">
          Brewfitt Limited
          <br />
          Huddersfield, West Yorkshire
        </p>
      </div>
      <div className="sm:text-right">
        <p className="text-2xl font-semibold tracking-tight">{kind}</p>
        {number ? <p className="font-mono text-sm text-neutral-600">{number}</p> : null}
        <dl className="mt-2 space-y-0.5 text-xs text-neutral-600">
          <div className="flex gap-2 sm:justify-end">
            <dt>Date</dt>
            <dd className="font-medium text-neutral-900">{formatDate(date)}</dd>
          </div>
          {meta?.map((m) => (
            <div key={m.label} className="flex gap-2 sm:justify-end">
              <dt>{m.label}</dt>
              <dd className="font-medium text-neutral-900">{m.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </header>
  );
}

export function DocumentParty({ label, lines }: { label: string; lines: string[] }) {
  return (
    <div>
      <p className="text-[11px] font-semibold tracking-wide text-neutral-500 uppercase">{label}</p>
      <p className="mt-1">
        {lines.map((l, i) => (
          <span key={i} className={i === 0 ? "block font-medium" : "block text-neutral-600"}>
            {l}
          </span>
        ))}
      </p>
    </div>
  );
}

export function DocumentFooter({ note }: { note?: string }) {
  return (
    <footer className="mt-10 border-t border-neutral-200 pt-4 text-[11px] text-neutral-500">
      {note ? <p className="mb-1">{note}</p> : null}
      <p>
        Brewfitt Limited. Prices exclude VAT unless shown. Phase 1 preview generated from
        demonstration data.
      </p>
    </footer>
  );
}

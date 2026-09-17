import Link from "next/link";
import type { Icon } from "@phosphor-icons/react";
import { formatDateTime, formatSince } from "@/lib/format";

export type TimelineEntry = { id: string; at: string; title: string; detail?: string; href?: string; icon: Icon };

export function Timeline({ entries }: { entries: TimelineEntry[] }) {
  return (
    <ol className="relative space-y-1 before:absolute before:top-2 before:bottom-2 before:left-[15px] before:w-px before:bg-border">
      {entries.map((e) => {
        const body = (
          <>
            <span className="relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border bg-card text-muted-foreground">
              <e.icon className="size-4" aria-hidden />
            </span>
            <span className="min-w-0 flex-1 pt-1">
              <span className="block truncate text-sm font-medium">{e.title}</span>
              {e.detail ? <span className="block truncate text-xs text-muted-foreground">{e.detail}</span> : null}
            </span>
            <time dateTime={e.at} title={formatDateTime(e.at)} className="shrink-0 pt-1.5 text-xs text-muted-foreground">
              {formatSince(e.at)}
            </time>
          </>
        );
        return (
          <li key={e.id}>
            {e.href ? (
              <Link href={e.href} className="-mx-2 flex gap-3 rounded-lg px-2 py-1.5 hover:bg-accent/60">
                {body}
              </Link>
            ) : (
              <div className="flex gap-3 py-1.5">{body}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

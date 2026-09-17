import type { AgeingBand, Money } from "@/types";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Bands by due date: only money past its due date is amber or red. */
const BANDS: { band: AgeingBand; label: string; className: string }[] = [
  { band: "current", label: "Not yet due", className: "bg-chart-1" },
  { band: "30", label: "1–30 days overdue", className: "bg-warning/70" },
  { band: "60", label: "31–60 days overdue", className: "bg-warning" },
  { band: "90+", label: "Over 60 days overdue", className: "bg-danger" },
];

/** Outstanding balance split by how far past its due date it is, with the figures as text for screen readers. */
export function AgeingBar({
  ageing,
  className,
}: {
  ageing: Record<AgeingBand, Money>;
  className?: string;
}) {
  const total = BANDS.reduce((sum, b) => sum + Math.max(0, ageing[b.band].amount), 0);
  return (
    <div className={className}>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-muted" aria-hidden>
        {total > 0
          ? BANDS.map((b) => {
              const share = Math.max(0, ageing[b.band].amount) / total;
              return share > 0 ? (
                <div
                  key={b.band}
                  className={cn("h-full first:rounded-l-full last:rounded-r-full", b.className)}
                  style={{ width: `${share * 100}%` }}
                />
              ) : null;
            })
          : null}
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-4">
        {BANDS.map((b) => (
          <div
            key={b.band}
            className="flex items-center gap-1.5 sm:flex-col sm:items-start sm:gap-0"
          >
            <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span aria-hidden className={cn("size-2 rounded-full", b.className)} />
              {b.label}
            </dt>
            <dd className="ml-auto font-medium tabular-nums sm:ml-0">
              {formatMoney(ageing[b.band], { whole: true })}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

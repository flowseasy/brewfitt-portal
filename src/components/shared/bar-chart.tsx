import { cn } from "@/lib/utils";

export type Bar = { key: string; label: string; shortLabel?: string; value: number; display: string };

/** Compact bar chart. The summary is the accessible description; bars are decorative detail. */
export function BarChart({ bars, summary, className, height = "h-36" }: { bars: Bar[]; summary: string; className?: string; height?: string }) {
  const max = Math.max(1, ...bars.map((b) => b.value));
  return (
    <figure className={className}>
      <div className={cn("flex items-end gap-1.5", height)} aria-hidden>
        {bars.map((b) => (
          <div key={b.key} className="group relative flex h-full flex-1 flex-col items-center justify-end gap-1">
            <span className="pointer-events-none absolute -top-6 hidden rounded-md bg-popover px-1.5 py-0.5 text-[10px] whitespace-nowrap shadow ring-1 ring-border group-hover:block">
              {b.label}: {b.display}
            </span>
            <div className="w-full rounded-t-md bg-chart-1/85 transition-colors group-hover:bg-chart-1" style={{ height: `${Math.max(b.value > 0 ? 3 : 1, (b.value / max) * 100)}%` }} />
            <span className="text-[10px] text-muted-foreground">{b.shortLabel ?? b.label}</span>
          </div>
        ))}
      </div>
      <figcaption className="mt-3 text-sm text-muted-foreground">{summary}</figcaption>
    </figure>
  );
}

const monthShort = new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" });
const monthLong = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

export function monthBarLabels(month: string) {
  const d = new Date(`${month}-01T00:00:00Z`);
  return { label: monthLong.format(d), shortLabel: monthShort.format(d).slice(0, 1) };
}

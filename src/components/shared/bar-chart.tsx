import { cn } from "@/lib/utils";

export type Bar = {
  key: string;
  label: string;
  shortLabel?: string;
  value: number;
  display: string;
};

/** A top value and step that land on round numbers (1, 2, 2.5 or 5 × 10ⁿ) with about four gridlines. */
function niceScale(max: number, target = 4): { top: number; step: number } {
  if (max <= 0) return { top: 1, step: 1 };
  const raw = max / target;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / magnitude;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * magnitude;
  return { top: step * Math.ceil(max / step), step };
}

const compactGbp = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  notation: "compact",
  maximumFractionDigits: 1,
});

/** Axis labels for money held in pence, e.g. £2.5K. */
export const penceAxis = (pence: number) => compactGbp.format(pence / 100);

/** Axis labels for plain counts. */
export const countAxis = (n: number) =>
  new Intl.NumberFormat("en-GB", { notation: "compact", maximumFractionDigits: 1 }).format(n);

/**
 * Compact bar chart with a value axis and gridlines. The summary is the accessible
 * description; the bars, axis and gridlines are decorative detail.
 */
export function BarChart({
  bars,
  summary,
  className,
  height = "h-36",
  axis = countAxis,
}: {
  bars: Bar[];
  summary: string;
  className?: string;
  height?: string;
  /** Formats the value-axis labels. */
  axis?: (value: number) => string;
}) {
  const { top, step } = niceScale(Math.max(0, ...bars.map((b) => b.value)));
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);

  return (
    <figure className={className}>
      <div className="flex gap-2" aria-hidden>
        {/* Value axis: labels centred on their gridlines. */}
        <div className={cn("relative w-11 shrink-0", height)}>
          {ticks.map((t) => (
            <span
              key={t}
              className="absolute right-0 translate-y-1/2 text-[10px] leading-none text-muted-foreground tabular-nums"
              style={{ bottom: `${(t / top) * 100}%` }}
            >
              {axis(t)}
            </span>
          ))}
        </div>
        <div className="min-w-0 flex-1">
          <div className={cn("relative", height)}>
            {ticks.map((t) => (
              <div
                key={t}
                className={cn(
                  "absolute inset-x-0 border-t",
                  t === 0 ? "border-border" : "border-dashed border-border/70",
                )}
                style={{ bottom: `${(t / top) * 100}%` }}
              />
            ))}
            <div className="relative flex h-full items-end gap-1.5">
              {bars.map((b) => (
                <div key={b.key} className="group relative flex h-full flex-1 items-end">
                  <span className="pointer-events-none absolute -top-6 left-1/2 z-10 hidden -translate-x-1/2 rounded-md bg-popover px-1.5 py-0.5 text-[10px] whitespace-nowrap shadow ring-1 ring-border group-hover:block">
                    {b.label}: {b.display}
                  </span>
                  <div
                    className="w-full rounded-t-md bg-chart-1/85 transition-colors group-hover:bg-chart-1"
                    style={{
                      height: b.value > 0 ? `${Math.max(2, (b.value / top) * 100)}%` : "0%",
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
          <div className="mt-1 flex gap-1.5">
            {bars.map((b) => (
              <span key={b.key} className="flex-1 text-center text-[10px] text-muted-foreground">
                {b.shortLabel ?? b.label}
              </span>
            ))}
          </div>
        </div>
      </div>
      <figcaption className="mt-3 text-sm text-muted-foreground">{summary}</figcaption>
    </figure>
  );
}

const monthShort = new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" });
const monthLong = new Intl.DateTimeFormat("en-GB", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export function monthBarLabels(month: string) {
  const d = new Date(`${month}-01T00:00:00Z`);
  return { label: monthLong.format(d), shortLabel: monthShort.format(d).slice(0, 1) };
}

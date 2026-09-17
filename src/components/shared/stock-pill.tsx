import type { StockPosition } from "@/types";
import { formatShortDate } from "@/lib/format";
import { STOCK_STATUS } from "@/lib/status";
import { StatusPill } from "./status-pill";

export function StockPill({ stock, className }: { stock: StockPosition | null | undefined; className?: string }) {
  if (!stock) return null;
  const s = STOCK_STATUS[stock.status];
  const label = stock.status === "on-order" && stock.expectedAt ? `Due ${formatShortDate(stock.expectedAt)}` : s.label;
  return (
    <StatusPill tone={s.tone} className={className}>
      {label}
    </StatusPill>
  );
}

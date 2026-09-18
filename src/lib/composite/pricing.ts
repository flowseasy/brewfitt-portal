import type { CompositeBand, CompositeBandKey, CompositeLine, CostBasis, FxRates } from "@/types";

/**
 * Composite Configurator pricing (decision 14), shared by the costing sheet,
 * the mock API and the unit test. It follows Brewfitt's BOM costing sheet:
 *
 *   £ cost        = FX cost ÷ FX rate (GBP lines as entered)
 *   line total    = £ cost × qty
 *   cost total    = goods + shipping + duty + labour (hours × rate)
 *   price by margin = cost total ÷ (1 − margin %)
 *   margin        = (sell − cost total) ÷ sell;  markup = (sell − cost total) ÷ cost total
 *   gross profit  = sell − cost total
 *   total including carriage = sell + carriage (carriage is not marked up)
 *
 * Amounts are pence and are not rounded here: £ costs keep fractions of a
 * penny (e.g. $33.04 ÷ 1.25 = £26.432) exactly as the sheet shows them.
 */

export const BAND_LABEL: Record<CompositeBandKey, string> = {
  base: "Base",
  "50": "50+",
  "100": "100+",
  "200": "200+",
};

export const BAND_ORDER: CompositeBandKey[] = ["base", "50", "100", "200"];

/** Smallest quantity a band prices for. */
export function bandMinQty(key: CompositeBandKey): number {
  return key === "base" ? 1 : Number(key);
}

/** Unit cost in pence (GBP), converted at the build's rate for EUR and USD lines. */
export function lineUnitGbp(line: Pick<CompositeLine, "currency" | "unitCost">, fx: FxRates) {
  return line.currency === "GBP" ? line.unitCost : line.unitCost / fx[line.currency];
}

function basisAmount(basis: CostBasis, goods: number): number {
  return basis.mode === "percent" ? (goods * basis.value) / 100 : basis.value;
}

/** Sell price for a margin (% of sell price), in pence, unrounded. */
export function priceByMargin(cost: number, marginPercent: number): number {
  return marginPercent >= 100 ? Infinity : cost / (1 - marginPercent / 100);
}

/** Margin as a % of sell price, to two decimal places. */
export function marginPercent(cost: number, sell: number): number {
  return sell > 0 ? round2(((sell - cost) / sell) * 100) : 0;
}

/** Markup as a % of cost, to two decimal places. */
export function markupPercent(cost: number, sell: number): number {
  return cost > 0 ? round2(((sell - cost) / cost) * 100) : 0;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export type LineFigures = { id: string; unitGbp: number; total: number };

export type BandFigures = {
  lines: LineFigures[];
  goods: number;
  shipping: number;
  duty: number;
  labour: number;
  costTotal: number;
  priceByMargin: number;
  sellPrice: number;
  marginPercent: number;
  markupPercent: number;
  grossProfit: number;
  carriage: number;
  totalIncludingCarriage: number;
};

export function bandFigures(
  band: CompositeBand,
  build: { fxRates: FxRates; labourRate: number },
): BandFigures {
  const lines = band.lines.map((l) => {
    const unitGbp = lineUnitGbp(l, build.fxRates);
    return { id: l.id, unitGbp, total: unitGbp * l.qty };
  });
  const goods = lines.reduce((sum, l) => sum + l.total, 0);
  const shipping = basisAmount(band.shipping, goods);
  const duty = basisAmount(band.duty, goods);
  const labour = band.labourHours * build.labourRate;
  const costTotal = goods + shipping + duty + labour;
  const sell = band.sellPrice;
  return {
    lines,
    goods,
    shipping,
    duty,
    labour,
    costTotal,
    priceByMargin: priceByMargin(costTotal, band.targetMarginPercent),
    sellPrice: sell,
    marginPercent: marginPercent(costTotal, sell),
    markupPercent: markupPercent(costTotal, sell),
    grossProfit: sell - costTotal,
    carriage: band.carriage,
    totalIncludingCarriage: sell + band.carriage,
  };
}

/** A new band starts as a copy of the base band (or the first band when there is no base). */
export function copyBand(from: CompositeBand, key: CompositeBandKey, newId: () => string) {
  return {
    ...structuredClone(from),
    key,
    lines: from.lines.map((l) => ({ ...structuredClone(l), id: newId() })),
  };
}

/** £26.432: pounds with two decimals, or three where the sheet has fractions of a penny. */
export function formatCost(pence: number): string {
  const pounds = Math.round(pence * 10) / 1000;
  const sign = pounds < 0 ? "−" : "";
  return `${sign}£${Math.abs(pounds).toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 3,
  })}`;
}

/** Foreign unit cost for display, e.g. $33.04 or €12.50. */
export function formatForeign(minor: number, currency: "GBP" | "EUR" | "USD"): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(minor / 100);
}

import assert from "node:assert/strict";
import { test } from "node:test";
// The test checks the seeded Krusovice build itself, so it reads the seed directly.
// eslint-disable-next-line no-restricted-imports
import { krusoviceBands } from "@/lib/mock/seed/composite";
import { bandFigures, priceByMargin } from "./pricing";

/**
 * The Krusovice tap handle from Brewfitt's BOM costing sheet (decision 14):
 * USD at FX 1.25, labour £12/hr with no hours, no carriage. Amounts in pence.
 */
const build = { fxRates: { EUR: 1.17, USD: 1.25 }, labourRate: 1200 };

const expected = {
  "50": { unit: 2643.2, shipping: 550, cost: 3193.2, sell: 4500, margin: 29.04, gp: 1306.8 },
  "100": { unit: 1860.8, shipping: 500, cost: 2360.8, sell: 3400, margin: 30.56, gp: 1039.2 },
  "200": { unit: 1602.4, shipping: 490, cost: 2092.4, sell: 2900, margin: 27.85, gp: 807.6 },
} as const;

const close = (actual: number, want: number, what: string) =>
  assert.ok(Math.abs(actual - want) < 1e-6, `${what}: expected ${want}, got ${actual}`);

for (const band of krusoviceBands()) {
  test(`Krusovice ${band.key}+ band matches the costing sheet`, () => {
    const want = expected[band.key as keyof typeof expected];
    const f = bandFigures(band, build);
    close(f.lines[0]!.unitGbp, want.unit, "£ cost");
    close(f.lines[0]!.total, want.unit, "line total");
    close(f.shipping, want.shipping, "shipping");
    close(f.labour, 0, "labour");
    close(f.costTotal, want.cost, "cost total");
    assert.equal(f.sellPrice, want.sell);
    assert.equal(f.marginPercent, want.margin);
    close(f.grossProfit, want.gp, "gross profit");
    close(f.carriage, 0, "carriage");
    close(f.totalIncludingCarriage, want.sell, "total including carriage");
  });
}

test("Krusovice bands are 50+, 100+ and 200+, one USD Misc line each", () => {
  const bands = krusoviceBands();
  assert.deepEqual(
    bands.map((b) => b.key),
    ["50", "100", "200"],
  );
  for (const b of bands) {
    assert.equal(b.lines.length, 1);
    assert.equal(b.lines[0]!.kind, "misc");
    assert.equal(b.lines[0]!.currency, "USD");
    assert.equal(b.lines[0]!.qty, 1);
    assert.equal(b.lines[0]!.misc?.sellingName, "Krusovice branded tap handle");
  }
});

test("price by margin inverts margin", () => {
  // 50+ band: £31.932 at 29.04% gives £45.00 to the penny.
  assert.equal(Math.round(priceByMargin(3193.2, 29.04)), 4500);
  const f = bandFigures(
    {
      ...krusoviceBands()[0]!,
      shipping: { mode: "percent", value: 10 },
      labourHours: 2,
      carriage: 350,
    },
    build,
  );
  close(f.shipping, 264.32, "shipping as % of goods");
  close(f.labour, 2400, "labour");
  close(f.costTotal, 2643.2 + 264.32 + 2400, "cost total with labour");
  close(f.totalIncludingCarriage, 4850, "carriage added after margin");
});

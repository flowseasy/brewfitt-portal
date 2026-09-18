import type {
  Account,
  CompositeBand,
  CompositeBuild,
  CompositeLine,
  Contact,
  CostItem,
  PriceListLine,
  Product,
} from "@/types";
import { priceByMargin } from "@/lib/composite/pricing";
import { addDays, isoDate, isoDateTime } from "../clock";
import { createRng } from "../random";

/**
 * Composite Configurator seed (decision 14): an invented component
 * catalogue for the type-ahead, and six draft builds. Component codes use a
 * mock "MC-" prefix; they are not Brewfitt's stock codes.
 */

/** Mock system settings: FX as units per £1, and the default labour rate. */
export const SYSTEM_FX_RATES = { EUR: 1.17, USD: 1.3 } as const;
export const SYSTEM_LABOUR_RATE = 1200;

// ---- Component catalogue ------------------------------------------------------

type Family = {
  code: string;
  category: string;
  unit: string;
  /** Base cost range in minor units. */
  cost: [number, number];
  currency?: "GBP" | "EUR" | "USD";
  names: string[];
};

const cross = (a: string[], b: string[], join = " ") =>
  a.flatMap((x) => b.map((y) => `${x}${join}${y}`.trim()));

const FAMILIES: Family[] = [
  {
    code: "CPL",
    category: "Couplers",
    unit: "each",
    cost: [2600, 5400],
    currency: "EUR",
    names: cross(
      ["S Type", "A Type", "D Type", "G Type", "U Type", "M Type"],
      [
        "keg coupler body, chrome",
        "keg coupler body, stainless",
        "coupler with PRV, chrome",
        "coupler with PRV, stainless",
      ],
    ),
  },
  {
    code: "CLP",
    category: "Clamps",
    unit: "each",
    cost: [12, 180],
    names: [
      ...cross(
        ["Stepless ear clamp", "Double ear clamp", "Worm drive clamp, stainless"],
        [
          "9.5 mm",
          "11.3 mm",
          "12.8 mm",
          "13.3 mm",
          "15.7 mm",
          "17.8 mm",
          "19.2 mm",
          "21 mm",
          "23.5 mm",
        ],
      ),
      "Font clamp plate, 75 mm, black",
      "Font clamp plate, 75 mm, chrome",
      "Counter clamp studding kit, M8",
    ],
  },
  {
    code: "BHD",
    category: "Badge holders",
    unit: "each",
    cost: [180, 1450],
    names: cross(
      ["Round 60 mm", "Round 70 mm", "Round 80 mm", "Oval 90 x 60 mm", "Shield 75 mm"],
      ["badge holder, chrome", "badge holder, black", "badge holder, brushed brass", "lens cap"],
      " ",
    ),
  },
  {
    code: "TUB",
    category: "Tubing",
    unit: "metre",
    cost: [38, 420],
    names: [
      ...cross(
        ['Beer line 3/16"', 'Beer line 1/4"', 'Beer line 5/16"', 'Beer line 3/8"'],
        ["clear PE", "barrier, blue stripe", "barrier, red stripe", "braided PVC"],
      ),
      ...cross(['Gas line 5/16"', 'Gas line 3/8"'], ["red", "grey"]),
      'Cooling line 1/2", lagged',
      'Cooling line 3/8", lagged',
      "Drain hose 19 mm, clear",
      "Drain hose 25 mm, clear",
      "Insulation sleeve 13 mm",
      "Insulation sleeve 19 mm",
    ],
  },
  {
    code: "COL",
    category: "Coils",
    unit: "each",
    cost: [2400, 9800],
    names: cross(
      ["Stainless cooling coil"],
      [
        '15 m, 5/16"',
        '25 m, 5/16"',
        '40 m, 5/16"',
        '15 m, 3/8"',
        '25 m, 3/8"',
        '40 m, 3/8"',
        'twin 15 m, 5/16"',
        'twin 25 m, 5/16"',
        "font coil, 2-way",
        "font coil, 4-way",
        "python-ready, 6-line",
        "python-ready, 10-line",
      ],
      ", ",
    ),
  },
  {
    code: "TAP",
    category: "Taps",
    unit: "each",
    cost: [900, 4600],
    currency: "EUR",
    names: cross(
      [
        "Flow-control tap body",
        "Standard tap body",
        "Stout tap body",
        "Creamer tap body",
        "Compensator tap body",
        "Self-closing tap body",
      ],
      ["chrome", "stainless", "gold", "black"],
      ", ",
    ),
  },
  {
    code: "HDL",
    category: "Tap handles",
    unit: "each",
    cost: [150, 1800],
    currency: "USD",
    names: cross(
      ["Tap handle blank", "Tap handle ferrule"],
      [
        "short, black",
        "short, chrome",
        "tall, black",
        "tall, wood effect",
        "lever, stainless",
        "ceramic, white",
      ],
      ", ",
    ),
  },
  {
    code: "SPT",
    category: "Spouts",
    unit: "each",
    cost: [140, 1200],
    names: cross(
      ["Lager spout", "Stout nozzle", "Creamer spout", "Extended spout"],
      [
        "60 mm, stainless",
        "110 mm, stainless",
        "150 mm, stainless",
        "60 mm, chrome",
        "110 mm, chrome",
      ],
      " ",
    ),
  },
  {
    code: "WSH",
    category: "Washers",
    unit: "pack of 10",
    cost: [45, 520],
    names: [
      ...cross(
        ["Fibre washer", "Rubber washer", "Silicone washer", "Nitrile O-ring"],
        ['3/8" BSP', '1/2" BSP', '5/8" BSP', '3/4" BSP', '1" BSP'],
      ),
      "Tap body washer set",
      "Coupler seal kit",
      'Shank washer, 1/2"',
      'Shank washer, 5/8"',
    ],
  },
  {
    code: "SHK",
    category: "Shanks and tails",
    unit: "each",
    cost: [260, 1900],
    names: [
      ...cross(['Tap shank 1/2"'], ["80 mm", "100 mm", "125 mm", "150 mm"], " x "),
      ...cross(
        ["Tail and nut"],
        ['3/8" x 3/8" JG', '3/8" x 5/16" JG', '1/2" x 3/8" barb', '5/8" x 3/8" barb'],
        " ",
      ),
      'Tail and nut, 5/8" x 1/4" barb',
      "Wall bracket for shanks, 2-way",
      "Wall bracket for shanks, 4-way",
    ],
  },
  {
    code: "PSH",
    category: "Push-fit fittings",
    unit: "pack of 10",
    cost: [220, 1650],
    names: cross(
      ["Straight connector", "Equal tee", "Elbow", "Reducer", "Shut-off valve", "Non-return valve"],
      ['3/16"', '1/4"', '5/16"', '3/8"'],
      " ",
    ),
  },
  {
    code: "LED",
    category: "Lighting",
    unit: "each",
    cost: [320, 4200],
    currency: "USD",
    names: [
      ...cross(["LED ring module"], ["60 mm, warm white", "70 mm, cool white", "80 mm, RGB"], " "),
      ...cross(["LED strip, 24 V"], ["0.5 m", "1 m", "2 m"], " "),
      "Illuminated badge back-plate, 70 mm",
      "Driver, 24 V 12 W",
      "Driver, 24 V 30 W",
      "Driver, 24 V 60 W",
      "Dimmer module, 24 V",
      "Cable harness, 2-way",
      "Cable harness, 4-way",
      "Cable harness, 6-way",
      "Transformer enclosure",
    ],
  },
  {
    code: "MNT",
    category: "Mounting and trim",
    unit: "each",
    cost: [180, 2600],
    names: [
      "Font base gasket, 75 mm",
      "Font base gasket, 100 mm",
      "Drip tray mounting bracket, pair",
      "Counter grommet, 50 mm",
      "Counter grommet, 75 mm",
      "Trim ring, chrome",
      "Trim ring, black",
      "Branding collar, 80 mm",
      "Branding collar, 100 mm",
      "Security screw kit",
    ],
  },
  {
    code: "GAS",
    category: "Gas fittings",
    unit: "each",
    cost: [340, 3900],
    currency: "EUR",
    names: [
      ...cross(["Gas manifold"], ["2-way", "3-way", "4-way", "5-way", "6-way"], ", "),
      ...cross(
        ["Gas tee", "Gas isolation valve", "Gas non-return valve", "Gas hose tail"],
        ['5/16"', '3/8"'],
      ),
    ],
  },
  {
    code: "DRP",
    category: "Drip tray parts",
    unit: "each",
    cost: [210, 2800],
    names: [
      ...cross(
        ["Drip tray grille", "Drip tray insert"],
        ["20 cm", "30 cm", "40 cm", "50 cm", "60 cm", "80 cm"],
        ", ",
      ),
      "Drain tail, 19 mm",
      "Drain tail, 25 mm",
      "Drain elbow, 25 mm",
    ],
  },
  {
    code: "FSP",
    category: "Font spares",
    unit: "each",
    cost: [260, 3400],
    names: cross(
      [
        "Font python adaptor",
        "Font shank nut set",
        "Font top cap",
        "Font glycol return loop",
        "Font insulation jacket",
      ],
      ["1-way", "2-way", "3-way", "4-way"],
      ", ",
    ),
  },
];

/** About 300 component items with plausible cost prices, deterministic on every load. */
export function seedComponents(): CostItem[] {
  const rng = createRng(7219);
  const items: CostItem[] = [];
  for (const family of FAMILIES) {
    family.names.forEach((name, i) => {
      const [low, high] = family.cost;
      const cost = rng.int(low, high);
      items.push({
        id: `cmp_${family.code.toLowerCase()}_${i + 1}`,
        kind: "component",
        code: `MC-${family.code}-${String(101 + i).padStart(4, "0")}`,
        name,
        category: family.category,
        currency: family.currency && rng.chance(0.7) ? family.currency : "GBP",
        unitCost: cost,
        unit: family.unit,
      });
    });
  }
  return items;
}

/** A catalogue product at cost: the supplier's agreed price, or an estimate from list. */
export function productCostItem(
  product: Product,
  accounts: Account[],
  priceListLines: PriceListLine[],
  categoryName: string,
): CostItem {
  const supplier = accounts.find((a) => a.id === product.supplierId);
  const agreed = priceListLines.find(
    (l) => l.priceListId === supplier?.priceListId && l.productId === product.id,
  );
  return {
    id: product.id,
    kind: "catalogue",
    code: product.sku,
    name: product.name,
    category: categoryName,
    currency: "GBP",
    unitCost: agreed?.price.amount ?? Math.round(product.listPrice.amount * 0.55),
    unit: product.unit,
  };
}

// ---- Builds -------------------------------------------------------------------

type LineSpec =
  | { item: CostItem; qty: number; unitCost?: number }
  | {
      misc: CompositeLine["misc"] & object;
      currency: CompositeLine["currency"];
      unitCost: number;
      qty: number;
    };

function line(id: string, spec: LineSpec): CompositeLine {
  if ("item" in spec) {
    return {
      id,
      kind: spec.item.kind,
      itemId: spec.item.id,
      code: spec.item.code,
      description: spec.item.name,
      currency: spec.item.currency,
      unitCost: spec.unitCost ?? spec.item.unitCost,
      qty: spec.qty,
      misc: null,
    };
  }
  return {
    id,
    kind: "misc",
    itemId: null,
    code: "MISC",
    description: spec.misc.sellingName,
    currency: spec.currency,
    unitCost: spec.unitCost,
    qty: spec.qty,
    misc: spec.misc,
  };
}

const amount = (pence: number) => ({ mode: "amount" as const, value: pence });
const percent = (value: number) => ({ mode: "percent" as const, value });
const NONE = amount(0);

/**
 * The Krusovice tap handle, reproduced from Brewfitt's BOM costing sheet
 * (decision 14). The unit test in src/lib/composite/pricing.test.ts asserts its figures.
 */
export const KRUSOVICE_MISC = {
  sellingName: "Krusovice branded tap handle",
  sellingDescription: "Polyresin tap handle with Krusovice decals, 220 x 50 x 30 mm",
  buyingName: "Krusovice New Handle",
  buyingDescription:
    "QT.# Brewfitt-260602 Krusovice New Handle - 3 polyresin body, 4 decal stickers, 220 x 50 x 30mm, TOF Comps",
  supplierQuoteRef: "Brewfitt-260602",
};

export function krusoviceBands(): CompositeBand[] {
  const band = (
    key: CompositeBand["key"],
    cents: number,
    shipping: number,
    sell: number,
    margin: number,
  ): CompositeBand => ({
    key,
    lines: [
      line(`cbl_krus_${key}`, { misc: KRUSOVICE_MISC, currency: "USD", unitCost: cents, qty: 1 }),
    ],
    shipping: amount(shipping),
    duty: NONE,
    labourHours: 0,
    targetMarginPercent: margin,
    sellPrice: sell,
    carriage: 0,
  });
  return [
    band("50", 3304, 550, 4500, 29.04),
    band("100", 2326, 500, 3400, 30.56),
    band("200", 2003, 490, 2900, 27.85),
  ];
}

export function seedCompositeBuilds(args: {
  today: Date;
  accounts: Account[];
  products: Product[];
  components: CostItem[];
  catalogueItem: (product: Product) => CostItem;
}): CompositeBuild[] {
  const { today } = args;
  const product = (pattern: RegExp) => {
    const p = args.products.find((x) => pattern.test(x.name));
    if (!p) throw new Error(`Composite seed: no product matching ${pattern}`);
    return args.catalogueItem(p);
  };
  const component = (code: string) => {
    const c = args.components.find((x) => x.code === code);
    if (!c) throw new Error(`Composite seed: no component ${code}`);
    return c;
  };
  const account = (id: string) => {
    if (!args.accounts.some((a) => a.id === id)) throw new Error(`Composite seed: no ${id}`);
    return id;
  };
  let seq = 0;
  const lines = (specs: LineSpec[]) => specs.map((s) => line(`cbl_seed_${++seq}`, s));

  /** A band priced at its target margin, rounded to the pound as Brewfitt quotes. */
  const priced = (
    key: CompositeBand["key"],
    specs: LineSpec[],
    rest: Partial<Omit<CompositeBand, "key" | "lines">> & { margin: number },
    build: { fxRates: CompositeBuild["fxRates"]; labourRate: number },
  ): CompositeBand => {
    const band: CompositeBand = {
      key,
      lines: lines(specs),
      shipping: rest.shipping ?? NONE,
      duty: rest.duty ?? NONE,
      labourHours: rest.labourHours ?? 0,
      targetMarginPercent: rest.margin,
      sellPrice: 0,
      carriage: rest.carriage ?? 0,
    };
    const goods = band.lines.reduce(
      (sum, l) =>
        sum + (l.currency === "GBP" ? l.unitCost : l.unitCost / build.fxRates[l.currency]) * l.qty,
      0,
    );
    const basis = (b: CompositeBand["shipping"]) =>
      b.mode === "percent" ? (goods * b.value) / 100 : b.value;
    const cost =
      goods + basis(band.shipping) + basis(band.duty) + band.labourHours * build.labourRate;
    band.sellPrice = Math.ceil(priceByMargin(cost, rest.margin) / 100) * 100;
    return band;
  };

  const stamp = (daysAgo: number, hour: number) => isoDateTime(addDays(today, -daysAgo), hour, 15);
  const base = (
    n: number,
    daysAgo: number,
    fields: Pick<
      CompositeBuild,
      "name" | "description" | "accountId" | "brand" | "creatorInitials"
    >,
  ) => ({
    id: `cb_seed_${n}`,
    number: `CB-${1040 + n}`,
    ...fields,
    createdOn: isoDate(addDays(today, -daysAgo)),
    status: "draft" as const,
    quotes: [],
    createdAt: stamp(daysAgo, 10),
    updatedAt: stamp(Math.max(0, daysAgo - 2), 15),
  });

  const builds: CompositeBuild[] = [];

  // 1. Krusovice tap handle: the costing sheet example, exactly.
  builds.push({
    ...base(1, 15, {
      name: "Krusovice tap handle",
      description: "Branded polyresin tap handle, 220 x 50 x 30 mm, with Krusovice decals.",
      accountId: account("acc_tyne"),
      brand: "Krusovice",
      creatorInitials: "JP",
    }),
    fxRates: { ...SYSTEM_FX_RATES, USD: 1.25 },
    labourRate: SYSTEM_LABOUR_RATE,
    bands: krusoviceBands(),
  });

  // 2. Harbourside Premium Lager illuminated T-bar: EUR taps and couplers, three bands.
  {
    const fx = { EUR: 1.12, USD: SYSTEM_FX_RATES.USD };
    const build = { fxRates: fx, labourRate: SYSTEM_LABOUR_RATE };
    const specs = (scale: number): LineSpec[] => [
      {
        item: product(/^Angram T Bar/),
        qty: 1,
        unitCost: Math.round(product(/^Angram T Bar/).unitCost * scale),
      },
      { item: component("MC-TAP-0101"), qty: 2 },
      { item: component("MC-BHD-0109"), qty: 2 },
      { item: component("MC-LED-0101"), qty: 2 },
      { item: component("MC-WSH-0102"), qty: 1 },
      {
        misc: {
          sellingName: "Premium Lager illuminated lens, pair",
          sellingDescription: "Printed acrylic lens for the illuminated badge holders",
          buyingName: "Acrylic lens 70 mm, 4-colour print",
          buyingDescription: "70 mm cast acrylic, UV print both sides, artwork HDL-PL-03",
          supplierQuoteRef: "LQ-5521",
        },
        currency: "EUR",
        unitCost: Math.round(1850 * scale),
        qty: 1,
      },
    ];
    builds.push({
      ...base(2, 9, {
        name: "Premium Lager illuminated T-bar",
        description:
          "Angram T-bar with two flow-control taps, illuminated Premium Lager badges and fitting kit.",
        accountId: account("acc_harbourside"),
        brand: "Harbourside Premium Lager",
        creatorInitials: "SR",
      }),
      fxRates: fx,
      labourRate: SYSTEM_LABOUR_RATE,
      bands: [
        priced("base", specs(1), { margin: 32, shipping: amount(1800), labourHours: 1.5 }, build),
        priced("50", specs(0.93), { margin: 30, shipping: amount(1200), labourHours: 1 }, build),
        priced("100", specs(0.88), { margin: 28, shipping: amount(950), labourHours: 1 }, build),
      ],
    });
  }

  // 3. Northlight cider illuminated font: USD LED parts and a misc badge, two bands.
  {
    const build = { fxRates: { ...SYSTEM_FX_RATES }, labourRate: SYSTEM_LABOUR_RATE };
    const specs = (scale: number): LineSpec[] => [
      { item: product(/^Cobra PL 2 Out Chrome LED/), qty: 1 },
      {
        item: component("MC-LED-0104"),
        qty: 1,
        unitCost: Math.round(component("MC-LED-0104").unitCost * scale),
      },
      { item: component("MC-LED-0107"), qty: 1 },
      {
        misc: {
          sellingName: "Northlight 3D cider badge",
          sellingDescription: "Domed 3D badge in Northlight orchard green",
          buyingName: "3D resin dome badge 80 mm",
          buyingDescription: "80 mm resin dome on aluminium, 2 colours, adhesive back",
          supplierQuoteRef: "Q-88314",
        },
        currency: "USD",
        unitCost: Math.round(1290 * scale),
        qty: 2,
      },
    ];
    builds.push({
      ...base(3, 6, {
        name: "Northlight cider illuminated Cobra",
        description: "Two-way chrome Cobra with LED lighting and 3D Northlight badges.",
        accountId: account("acc_northlight"),
        brand: "Northlight Orchard",
        creatorInitials: "HB",
      }),
      ...build,
      bands: [
        priced("base", specs(1), { margin: 30, shipping: percent(6), duty: percent(4) }, build),
        priced("100", specs(0.82), { margin: 27, shipping: percent(4), duty: percent(4) }, build),
      ],
    });
  }

  // 4. Pennine Stack tap room python pack: GBP only, labour-heavy, base band.
  {
    const build = { fxRates: { ...SYSTEM_FX_RATES }, labourRate: SYSTEM_LABOUR_RATE };
    builds.push({
      ...base(4, 4, {
        name: "Tap room four-line install pack",
        description: "Four-line python run, couplers, tails and fittings for the tap room bar.",
        accountId: account("acc_pennine"),
        brand: "Pennine Stack tap room",
        creatorInitials: "MS",
      }),
      ...build,
      bands: [
        priced(
          "base",
          [
            { item: product(/^Cooltube 4 Way 10 Line C\/W PU Insulation & Fittings/), qty: 1 },
            { item: product(/^S Type Keg Coupler/), qty: 4 },
            { item: component("MC-SHK-0105"), qty: 4 },
            { item: component("MC-PSH-0102"), qty: 2 },
            { item: component("MC-CLP-0104"), qty: 12 },
            { item: component("MC-TUB-0102"), qty: 24 },
          ],
          { margin: 35, labourHours: 6, carriage: 2500 },
          build,
        ),
      ],
    });
  }

  // 5. Mill Race Inns estate refresh: EUR taps, carriage per unit, two bands.
  {
    const fx = { EUR: 1.14, USD: SYSTEM_FX_RATES.USD };
    const build = { fxRates: fx, labourRate: SYSTEM_LABOUR_RATE };
    const specs = (scale: number): LineSpec[] => [
      { item: product(/^Easy Tower Font Chrome Clamp On/), qty: 1 },
      {
        item: component("MC-TAP-0105"),
        qty: 2,
        unitCost: Math.round(component("MC-TAP-0105").unitCost * scale),
      },
      { item: component("MC-SPT-0102"), qty: 2 },
      { item: component("MC-BHD-0101"), qty: 2 },
      { item: component("MC-MNT-0101"), qty: 1 },
    ];
    builds.push({
      ...base(5, 3, {
        name: "Estate two-tap refresh kit",
        description: "Chrome two-tap tower refresh for Mill Race Inns sites, badges fitted.",
        accountId: account("acc_millrace"),
        brand: "Mill Race Inns estate",
        creatorInitials: "SR",
      }),
      fxRates: fx,
      labourRate: SYSTEM_LABOUR_RATE,
      bands: [
        priced("base", specs(1), { margin: 30, shipping: amount(900), carriage: 1500 }, build),
        priced("50", specs(0.9), { margin: 27.5, shipping: amount(700), carriage: 800 }, build),
      ],
    });
  }

  // 6. Wildfell seltzer conversion: GBP with duty on an imported misc item, base band.
  {
    const build = { fxRates: { ...SYSTEM_FX_RATES }, labourRate: SYSTEM_LABOUR_RATE };
    builds.push({
      ...base(6, 1, {
        name: "Seltzer on tap conversion",
        description: "Converts a two-way lager font to hard seltzer, with nitrogen-rated taps.",
        accountId: account("acc_wildfell"),
        brand: "Wildfell Seltzer",
        creatorInitials: "DO",
      }),
      ...build,
      bands: [
        priced(
          "base",
          [
            { item: product(/^Celtic Tap Chrome \(Nitro\)/), qty: 2 },
            { item: component("MC-WSH-0106"), qty: 1 },
            { item: component("MC-PSH-0119"), qty: 1 },
            {
              misc: {
                sellingName: "Wildfell seltzer lens badge",
                sellingDescription: "Clear lens badge with Wildfell seltzer artwork",
                buyingName: "Lens badge 60 mm, clear, digital print",
                buyingDescription: "60 mm polycarbonate lens, reverse printed, supplied in pairs",
                supplierQuoteRef: "",
              },
              currency: "GBP",
              unitCost: 740,
              qty: 2,
            },
          ],
          { margin: 33, shipping: amount(600), duty: percent(2.5), labourHours: 0.5 },
          build,
        ),
      ],
    });
  }

  return builds;
}

// ---- Staff persona --------------------------------------------------------------

/**
 * Brewfitt itself and the staff user behind the "Brewfitt staff" persona.
 * Not part of the customer and supplier data, so they sit outside the seed.
 */
export const BREWFITT_ACCOUNT: Account = {
  id: "acc_brewfitt",
  name: "Brewfitt Limited",
  kind: "internal",
  parentAccountId: null,
  isGroup: false,
  sector: "distributor",
  companyNumber: null,
  vatNumber: null,
  paymentTerms: "30-days",
  creditLimit: null,
  onAccount: false,
  priceListId: null,
  billingAddressId: "adr_brewfitt",
  accountManagerId: null,
  technicalContactId: null,
  buyerId: null,
  relationshipHealth: "strong",
  lastContactAt: "2026-01-05T09:00:00.000Z",
  createdAt: "2015-03-02T09:00:00.000Z",
  updatedAt: "2026-01-05T09:00:00.000Z",
  pendingChanges: [],
};

export const STAFF_CONTACT: Contact = {
  id: "stf_sam",
  accountId: BREWFITT_ACCOUNT.id,
  name: "Sam Ridley",
  title: "Sales Estimator",
  email: "sam.ridley@brewfitt.example",
  phone: "01484 530 240",
  role: "sales",
  isPrimary: false,
  canApprove: false,
  approvalStatus: "approved",
};

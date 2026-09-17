import type {
  Account,
  Address,
  Basket,
  ChangeRequest,
  Configuration,
  ConfigurationSelections,
  Delivery,
  DispensePoint,
  Job,
  PriceList,
  PriceListLine,
  Product,
  Quote,
  QuoteLine,
  SalesOrder,
  VenueType,
} from "@/types";
import {
  buildBillOfMaterials,
  checkCompatibility,
  type ConfigState,
} from "@/lib/configurator/engine";
import { CONFIGURATOR_RULES } from "../data/configurator-rules";
import { addDays, daysBetween, isoDate, isoDateTime } from "../clock";
import type { Rng } from "../random";
import { money, previousWorkingDay, workingDay, type SeedContext } from "./context";

// ---------------------------------------------------------------------------
// Price lists
// ---------------------------------------------------------------------------

const SELL_LISTS: {
  id: string;
  name: string;
  discount: (p: Product, roleIsConsumable: boolean, fontOrTap: boolean) => number;
  excludeLarge: boolean;
}[] = [
  { id: "pl_trade", name: "Trade price list", discount: () => 0, excludeLarge: true },
  { id: "pl_hospitality", name: "Hospitality price list", discount: () => 5, excludeLarge: false },
  {
    id: "pl_pubgroup",
    name: "Pub group price list",
    discount: (_p, consumable) => (consumable ? 12 : 10),
    excludeLarge: false,
  },
  { id: "pl_brewery", name: "Brewery partner price list", discount: () => 12, excludeLarge: false },
  {
    id: "pl_brand",
    name: "Brand owner price list",
    discount: (_p, _c, fontOrTap) => (fontOrTap ? 15 : 10),
    excludeLarge: false,
  },
  { id: "pl_export", name: "Export price list", discount: () => 8, excludeLarge: false },
];

const LARGE_EQUIPMENT =
  /Gamko Keg cooler .*(590|850|1200|1550|1840) litre|AS-160|AS-200|AS-450|CWP|Event Cooler|Water Cooled/i;

export function seedPriceLists(args: {
  today: Date;
  products: Product[];
  suppliers: Account[];
  isConsumable: (p: Product) => boolean;
  isFontOrTap: (p: Product) => boolean;
  rng: Rng;
}): { priceLists: PriceList[]; priceListLines: PriceListLine[] } {
  const { today, products, suppliers, rng } = args;
  const priceLists: PriceList[] = [];
  const priceListLines: PriceListLine[] = [];
  const validFrom = isoDate(addDays(today, -rng.int(150, 230)));

  for (const def of SELL_LISTS) {
    priceLists.push({
      id: def.id,
      name: def.name,
      currency: "GBP",
      kind: "sell",
      validFrom,
      validTo: null,
    });
    for (const p of products) {
      if (def.excludeLarge && LARGE_EQUIPMENT.test(p.name)) continue;
      const discountPercent = def.discount(p, args.isConsumable(p), args.isFontOrTap(p));
      priceListLines.push({
        priceListId: def.id,
        productId: p.id,
        price: money(p.listPrice.amount * (1 - discountPercent / 100)),
        discountPercent,
      });
    }
  }

  for (const s of suppliers) {
    if (!s.priceListId) continue;
    priceLists.push({
      id: s.priceListId,
      name: `Agreed cost prices: ${s.name}`,
      currency: "GBP",
      kind: "cost",
      validFrom,
      validTo: null,
    });
    for (const p of products.filter((x) => x.supplierId === s.id)) {
      priceListLines.push({
        priceListId: s.priceListId,
        productId: p.id,
        price: money(p.listPrice.amount * (0.5 + rng.next() * 0.12)),
        discountPercent: 0,
      });
    }
  }
  return { priceLists, priceListLines };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const slugId = (slug: string) => `prd_${slug}`;

const REGULAR_CONSUMABLES = [
  "coolflow-dtx-28-pre-mix-25-litres",
  "pipeline-purple-beer-line-cleaning-powder",
  "mini-n2-nitrogen-bottle-pack-2-cylinders",
  "fc4-tap-o-ring-repair-kit",
  "4flow-specialist-coolant-25-litres",
];
const REGULAR_SPARES = [
  "s-type-keg-coupler-c-w-jg-fittings-nrv-sankey",
  "s-type-cleaning-bottle",
  "fc4-tap-chrome-lager-1-2-x35x3-16jg",
  "secondary-regulator-c-w-shut-off-valve-wall-bracket-jg-fittings-gauge",
  "round-sticky-pads-for-badges-bag-of-10",
  "s-type-cleaning-socket-c-w-jg-fittings-3-8",
];

/** Accounts deliberately past their usual reorder interval (reorder-due insights). */
const OVERDUE_ACCOUNTS = new Set([
  "acc_pennine",
  "acc_crown",
  "acc_millrace_weavers",
  "acc_fleece",
  "acc_kelpie",
]);

const CYCLE_SECTORS = new Set(["brewery", "pub", "hotel"]);

const CARRIERS_UK = ["Brewfitt delivery", "DPD", "Palletline", "Brewfitt delivery"];
const CARRIERS_EXPORT = ["DHL Freight", "DSV Road"];

const ENGINEERS = ["Craig Lockwood", "Dean Sykes", "Tariq Mahmood", "Gary Ashworth"];

export type OrderOrigin =
  { kind: "cycle" } | { kind: "quote"; quoteId: string } | { kind: "rollout"; quoteId: string };

export type CommerceSeed = {
  configurations: Configuration[];
  quotes: Quote[];
  salesOrders: SalesOrder[];
  deliveries: Delivery[];
  changeRequests: ChangeRequest[];
  jobs: Job[];
  baskets: Basket[];
  /** Orders paid by card at checkout (customers not on account). */
  cardPaidOrderIds: Set<string>;
  /** The Premium Lager rollout order, used by the assistant demo and its thread. */
  rolloutOrderId: string;
  regularProductsByAccount: Map<string, string[]>;
  lowStockProductIds: string[];
};

type LineDraft = { productId: string; qty: number };

function orderTotal(lines: { qty: number; price: { amount: number } }[], vatRate: number) {
  const net = lines.reduce((s, l) => s + l.qty * l.price.amount, 0);
  return Math.round(net * (1 + vatRate));
}

function defaultAddress(addresses: Address[], accountId: string): Address {
  const a = addresses.find((x) => x.accountId === accountId && x.isDefault);
  if (!a) throw new Error(`No default address for ${accountId}`);
  return a;
}

// ---------------------------------------------------------------------------
// Configurations
// ---------------------------------------------------------------------------

type ConfigSpec = {
  accountId: string;
  name: string;
  venueType: VenueType;
  points: DispensePoint["taps"][];
  metres: number;
  prefer: string[];
  quote: "none" | "draft" | "sent" | "accepted";
  siteLabel?: string;
  branding?: string;
};

const CONFIG_SPECS: ConfigSpec[] = [
  {
    accountId: "acc_harbourside",
    name: "Harbourside flagship bar fit-out",
    venueType: "bar",
    points: [
      ["lager", "lager", "lager", "lager"],
      ["lager", "cider", "beer"],
    ],
    metres: 22,
    prefer: [
      "o-tap-fc4-chrome",
      "o-coupler-s",
      "o-font-cobra-b-led",
      "o-badge-extended-chrome",
      "o-cooler-v21",
      "o-python-8",
      "o-cooltube-pancake",
      "o-coolant-dtx-premix",
      "o-gas-both",
      "o-gas-secondary",
      "o-gas-chain",
      "o-drip-freshener",
      "o-clean-s",
      "o-fob-stop",
    ],
    quote: "sent",
    siteLabel: "Northern install store",
    branding: "Harbourside Premium Lager illuminated badges",
  },
  {
    accountId: "acc_harbourside",
    name: "Summer festival bar",
    venueType: "event",
    points: [
      ["lager", "lager"],
      ["lager", "cider"],
    ],
    metres: 0,
    prefer: [
      "o-tap-fc4-chrome",
      "o-coupler-s",
      "o-font-event",
      "o-cooler-kontakt-70k",
      "o-gas-co2",
      "o-drip-standard",
      "o-clean-s",
    ],
    quote: "accepted",
    siteLabel: "Midlands install store",
    branding: "Harbourside Premium Lager",
  },
  {
    accountId: "acc_harbourside",
    name: "Hotel lobby bar trial",
    venueType: "hotel",
    points: [["lager", "lager"]],
    metres: 12,
    prefer: [
      "o-tap-celtic-chrome",
      "o-coupler-s",
      "o-font-cobra-pl-led",
      "o-cooler-v15",
      "o-python-2",
      "o-gas-co2",
      "o-gas-chain",
      "o-drip-recessed",
    ],
    quote: "none",
    branding: "Harbourside Premium Lager",
  },
  {
    accountId: "acc_pennine",
    name: "Tap room back bar",
    venueType: "brewery-taproom",
    points: [
      ["beer", "beer", "beer"],
      ["lager", "cider", "beer"],
    ],
    metres: 9,
    prefer: [
      "o-tap-aceline-steel",
      "o-coupler-keykeg",
      "o-font-classic-cobra",
      "o-cooler-lindr-as200",
      "o-gas-both",
      "o-gas-secondary",
      "o-gas-chain",
      "o-drip-standard",
      "o-clean-keykeg",
    ],
    quote: "accepted",
    siteLabel: "Brewery tap room",
  },
  {
    accountId: "acc_pennine",
    name: "Beer festival stand",
    venueType: "event",
    points: [["beer", "beer"]],
    metres: 0,
    prefer: [
      "o-tap-aceline-steel",
      "o-coupler-keykeg",
      "o-font-event",
      "o-cooler-kontakt-70k",
      "o-gas-mixed",
    ],
    quote: "none",
  },
  {
    accountId: "acc_trent",
    name: "Trade partner starter system",
    venueType: "pub",
    points: [
      ["lager", "beer"],
      ["beer", "cider"],
    ],
    metres: 18,
    prefer: [
      "o-tap-fc4-chrome",
      "o-coupler-s",
      "o-font-cobra-pl-led",
      "o-badge-standard-chrome",
      "o-cooler-v21",
      "o-python-4",
      "o-coolant-4flow",
      "o-gas-both",
      "o-gas-secondary",
      "o-gas-chain",
      "o-drip-freshener",
      "o-clean-s",
      "o-fob-stop",
    ],
    quote: "accepted",
    siteLabel: "Trade dispense store",
  },
  {
    accountId: "acc_millrace_weavers",
    name: "Garden bar extension",
    venueType: "pub",
    points: [["lager", "cider"]],
    metres: 25,
    prefer: [
      "o-tap-fc4-chrome",
      "o-coupler-s",
      "o-font-cobra-pl",
      "o-cooler-v15",
      "o-python-2",
      "o-cooltube-single",
      "o-gas-co2",
      "o-gas-chain",
      "o-drip-standard",
      "o-clean-s",
    ],
    quote: "sent",
  },
  {
    accountId: "acc_millrace_plough",
    name: "Main bar refit",
    venueType: "pub",
    points: [
      ["lager", "lager", "cider"],
      ["beer", "beer", "lager"],
    ],
    metres: 14,
    prefer: [
      "o-tap-fc4-chrome",
      "o-coupler-s",
      "o-font-classic-cobra",
      "o-cooler-v21",
      "o-python-6",
      "o-gas-both",
      "o-gas-secondary",
      "o-gas-chain",
      "o-drip-freshener",
      "o-clean-s",
      "o-fob-stop",
    ],
    quote: "draft",
  },
  {
    accountId: "acc_neontiger",
    name: "Cocktail bar draught station",
    venueType: "bar",
    points: [
      ["lager", "lager"],
      ["soft", "water"],
    ],
    metres: 8,
    prefer: [
      "o-tap-compensator",
      "o-coupler-s",
      "o-postmix",
      "o-soda-water",
      "o-font-cobra-pl-led",
      "o-cooler-lindr-as200",
      "o-gas-co2",
      "o-gas-chain",
      "o-drip-recessed",
    ],
    quote: "accepted",
  },
  {
    accountId: "acc_saltember",
    name: "Restaurant bar counter",
    venueType: "restaurant",
    points: [["lager", "lager"], ["coffee"]],
    metres: 10,
    prefer: [
      "o-tap-celtic-chrome",
      "o-coupler-s",
      "o-hot-drinks",
      "o-font-cobra-pl-led",
      "o-cooler-v15",
      "o-python-2",
      "o-gas-co2",
      "o-gas-chain",
      "o-drip-recessed",
    ],
    quote: "sent",
  },
  {
    accountId: "acc_coachworks",
    name: "Ballroom bar",
    venueType: "hotel",
    points: [
      ["lager", "lager", "lager"],
      ["lager", "cider", "beer"],
    ],
    metres: 30,
    prefer: [
      "o-tap-fc4-gold",
      "o-coupler-s",
      "o-font-classic-cobra",
      "o-badge-standard-gold",
      "o-cooler-v21",
      "o-python-6",
      "o-cooltube-pancake",
      "o-coolant-dtx-premix",
      "o-gas-both",
      "o-gas-secondary",
      "o-gas-chain",
      "o-drip-freshener",
    ],
    quote: "draft",
  },
  {
    accountId: "acc_copperhouse",
    name: "Second taproom",
    venueType: "brewery-taproom",
    points: [["beer", "beer", "lager", "lager"]],
    metres: 6,
    prefer: [
      "o-tap-aceline-steel",
      "o-coupler-keykeg",
      "o-font-cobra-b-led",
      "o-cooler-v15",
      "o-python-4",
      "o-gas-both",
      "o-gas-secondary",
      "o-gas-chain",
      "o-drip-standard",
      "o-clean-keykeg",
    ],
    quote: "none",
  },
  {
    accountId: "acc_crown",
    name: "Replacement fonts",
    venueType: "pub",
    points: [
      ["lager", "lager"],
      ["beer", "cider"],
    ],
    metres: 12,
    prefer: [
      "o-tap-fc4-chrome",
      "o-coupler-s",
      "o-font-cobra-pl",
      "o-cooler-v15",
      "o-python-4",
      "o-gas-both",
      "o-gas-chain",
      "o-drip-standard",
    ],
    quote: "none",
  },
  {
    accountId: "acc_liffey",
    name: "Rooftop terrace bar",
    venueType: "hotel",
    points: [
      ["lager", "beer"],
      ["lager", "cider"],
    ],
    metres: 35,
    prefer: [
      "o-tap-celtic-chrome",
      "o-coupler-g",
      "o-font-cobra-pl-led",
      "o-cooler-v21",
      "o-python-4",
      "o-cooltube-single",
      "o-gas-both",
      "o-gas-secondary",
      "o-gas-chain",
      "o-drip-freshener",
      "o-clean-g",
    ],
    quote: "sent",
  },
  {
    accountId: "acc_wildfell",
    name: "Seltzer launch events",
    venueType: "event",
    points: [["lager", "lager"]],
    metres: 0,
    prefer: [
      "o-tap-fc4-chrome",
      "o-coupler-keykeg",
      "o-font-event",
      "o-cooler-kontakt-70k",
      "o-gas-co2",
    ],
    quote: "none",
  },
  {
    accountId: "acc_granitequay",
    name: "Hotel bar upgrade",
    venueType: "hotel",
    points: [["lager", "lager", "cider"]],
    metres: 16,
    prefer: [
      "o-tap-fc4-chrome",
      "o-coupler-s",
      "o-font-classic-cobra",
      "o-cooler-v15",
      "o-python-4",
      "o-gas-co2",
      "o-gas-secondary",
      "o-gas-chain",
      "o-drip-standard",
      "o-clean-s",
    ],
    quote: "none",
  },
];

function buildSelections(spec: ConfigSpec, siteAddressId: string): { state: ConfigState } {
  const rules = CONFIGURATOR_RULES;
  const selections: ConfigurationSelections = {
    venue: { newSite: null },
    dispense: {
      points: spec.points.map((taps, i) => ({
        id: `pt-${i + 1}`,
        name: `Dispense point ${i + 1}`,
        taps,
      })),
      optionIds: [],
    },
    font: { optionIds: [], branding: spec.branding ?? null, artwork: [] },
    cooling: { optionIds: [], pythonMetres: spec.metres },
    gas: { optionIds: [] },
    ancillaries: { optionIds: [] },
  };
  const state: ConfigState = { venueType: spec.venueType, siteAddressId, selections };
  const bucket = (stepId: string) =>
    stepId === "dispense"
      ? selections.dispense
      : stepId === "font"
        ? selections.font
        : stepId === "cooling"
          ? selections.cooling
          : stepId === "gas"
            ? selections.gas
            : selections.ancillaries;

  for (const optionId of spec.prefer) {
    const option = rules.options.find((o) => o.id === optionId);
    if (!option) throw new Error(`Unknown option ${optionId}`);
    const group = rules.groups.find((g) => g.id === option.groupId)!;
    if (checkCompatibility(option, state, rules).compatible)
      bucket(group.stepId).optionIds.push(optionId);
  }
  // Non-draught equipment is added automatically when compatible.
  for (const o of rules.options.filter((x) => x.groupId === "g-other-dispense")) {
    if (
      !selections.dispense.optionIds.includes(o.id) &&
      checkCompatibility(o, state, rules).compatible
    )
      selections.dispense.optionIds.push(o.id);
  }
  return { state };
}

// ---------------------------------------------------------------------------
// Main seed
// ---------------------------------------------------------------------------

export function seedCommerce(ctx: SeedContext, people: { addresses: Address[] }): CommerceSeed {
  const { rng, today } = ctx;
  const addresses = people.addresses;
  const customers = ctx.accounts.filter((a) => a.kind === "customer" && !a.isGroup);
  const vat = (accountId: string) => ctx.vatRate(accountId);

  const quotes: Quote[] = [];
  const salesOrders: SalesOrder[] = [];
  const configurations: Configuration[] = [];
  const origins = new Map<string, OrderOrigin>();
  const cardPaidOrderIds = new Set<string>();

  const priced = (accountId: string, lines: LineDraft[]) =>
    lines
      .filter((l) => l.qty > 0)
      .map((l) => {
        const price = ctx.priceFor(accountId, l.productId);
        if (!price)
          throw new Error(`Seed line ${l.productId} is not on the price list for ${accountId}`);
        return { ...l, price };
      });

  const makeQuote = (
    accountId: string,
    createdAt: Date,
    lineDrafts: LineDraft[],
    status: Quote["status"],
    configurationId: string | null,
  ): Quote => {
    const rate = vat(accountId);
    const lines: QuoteLine[] = priced(accountId, lineDrafts).map((l) => {
      const product = ctx.productById.get(l.productId)!;
      return {
        productId: l.productId,
        description: product.name,
        qty: l.qty,
        unitPrice: l.price,
        discountPercent: Math.max(
          0,
          Math.round((1 - l.price.amount / product.listPrice.amount) * 100),
        ),
        lineTotal: money(l.qty * l.price.amount),
      };
    });
    const subtotal = lines.reduce((s, l) => s + l.lineTotal.amount, 0);
    const vatAmount = Math.round(subtotal * rate);
    const created = previousWorkingDay(createdAt);
    return {
      id: `quo_${quotes.length + 1}`,
      accountId,
      number: "",
      status,
      lines,
      subtotal: money(subtotal),
      vat: money(vatAmount),
      total: money(subtotal + vatAmount),
      validUntil: isoDate(addDays(created, 30)),
      configurationId,
      pdfDocumentId: null,
      threadId: "",
      salesOrderId: null,
      declineReason: null,
      lastViewedAt: null,
      createdAt: isoDateTime(created, rng.int(9, 16), rng.pick([0, 10, 25, 40])),
      updatedAt: isoDateTime(created, 17),
    };
  };

  const makeOrder = (
    accountId: string,
    createdAt: Date,
    lineDrafts: LineDraft[],
    opts: { quoteId?: string; addressId?: string; po?: string | null; leadDays?: number },
  ): SalesOrder => {
    const created = previousWorkingDay(createdAt);
    const lines = priced(accountId, lineDrafts).map((l) => ({
      productId: l.productId,
      qty: l.qty,
      delivered: 0,
      backordered: 0,
      price: l.price,
    }));
    const requested = workingDay(addDays(created, opts.leadDays ?? rng.int(3, 8)));
    return {
      id: `so_${salesOrders.length + 1}`,
      accountId,
      number: "",
      status: "confirmed",
      lines,
      deliveryAddressId: opts.addressId ?? defaultAddress(addresses, accountId).id,
      requestedDate: isoDate(requested),
      confirmedDate: isoDate(workingDay(addDays(requested, rng.pick([0, 0, 0, 1, 2])))),
      poReference: opts.po ?? null,
      quoteId: opts.quoteId ?? null,
      total: money(orderTotal(lines, vat(accountId))),
      threadId: "",
      createdAt: isoDateTime(created, rng.int(8, 15), rng.pick([5, 20, 35, 50])),
    };
  };

  // ---- Regular consumable and spares cycles --------------------------------
  const regularProductsByAccount = new Map<string, string[]>();
  for (const account of customers) {
    const sector = account.parentAccountId ? "pub" : account.sector;
    if (!CYCLE_SECTORS.has(sector)) continue;
    const available = new Set(ctx.listProducts(account.id).map((p) => p.id));
    const consumables = rng.sample(
      REGULAR_CONSUMABLES.map(slugId).filter((id) => available.has(id)),
      2,
    );
    const spares = rng.sample(
      REGULAR_SPARES.map(slugId).filter((id) => available.has(id)),
      rng.int(1, 2),
    );
    const regular = [...consumables, ...spares];
    regularProductsByAccount.set(account.id, regular);

    const interval = rng.int(30, 54);
    const overdue = OVERDUE_ACCOUNTS.has(account.id);
    const accountStart = new Date(account.createdAt);
    let t = overdue
      ? addDays(today, -Math.round(interval * (1.3 + rng.next() * 0.4)))
      : addDays(today, -rng.int(2, Math.round(interval * 0.95)));
    const dates: Date[] = [];
    while (daysBetween(t, today) <= 365 && t > accountStart) {
      dates.push(t);
      t = addDays(t, -(interval + rng.int(-4, 4)));
    }
    for (const d of dates.reverse()) {
      const lines: LineDraft[] = regular
        .filter((id, i) => overdue || i === 0 || rng.chance(0.85))
        .map((productId) => ({
          productId,
          qty:
            ctx.roleOf(ctx.productById.get(productId)!) === "consumable"
              ? rng.int(1, 4)
              : rng.int(1, 3),
        }));
      if (rng.chance(0.15)) {
        const extra = rng.pick(
          REGULAR_SPARES.map(slugId).filter((id) => available.has(id) && !regular.includes(id)),
        );
        if (extra) lines.push({ productId: extra, qty: rng.int(1, 2) });
      }
      const order = makeOrder(account.id, d, lines, {
        po:
          account.onAccount && rng.chance(0.5)
            ? `${account.name.split(" ")[0]!.toUpperCase().slice(0, 4)}-${rng.int(1000, 9999)}`
            : null,
      });
      salesOrders.push(order);
      origins.set(order.id, { kind: "cycle" });
      if (!account.onAccount) cardPaidOrderIds.add(order.id);
    }
  }

  // Harbourside (the demo brand owner) supplies its outlets with branded dispense kit every
  // month, so its 12-month order history and average order value charts have no gaps.
  {
    const range = [
      ["extended-chrome-round-badge-holder", 12, 36],
      ["s-type-keg-coupler-c-w-jg-fittings-nrv-sankey", 6, 18],
      ["pipeline-purple-beer-line-cleaning-powder", 4, 12],
      ["s-type-cleaning-socket-c-w-jg-fittings-3-8", 6, 18],
      ["standard-chrome-badge-holder", 10, 30],
      ["2flow-specialist-coolant-25-litres", 2, 6],
    ] as const;
    for (let monthsAgo = 1; monthsAgo <= 11; monthsAgo++) {
      const first = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - monthsAgo, 1));
      const month = first.toISOString().slice(0, 7);
      if (
        salesOrders.some((o) => o.accountId === "acc_harbourside" && o.createdAt.startsWith(month))
      )
        continue;
      const picks = [0, 1, 2].map((k) => range[(monthsAgo + k * 2) % range.length]!);
      const order = makeOrder(
        "acc_harbourside",
        addDays(first, 4 + ((monthsAgo * 5) % 18)),
        picks.map(([slug, min, max]) => ({
          productId: slugId(slug),
          qty: min + ((monthsAgo * 7) % (max - min + 1)),
        })),
        { po: `HD-OUT-${2600 + monthsAgo}` },
      );
      salesOrders.push(order);
      origins.set(order.id, { kind: "cycle" });
    }
  }

  // Recent orders not yet dispatched, so open-order stages and change requests always have something to show.
  for (const [accountId, ageDays, slugs] of [
    [
      "acc_harbourside",
      1,
      ["extended-chrome-round-badge-holder", "standard-drip-tray-support-brackets"],
    ],
    [
      "acc_saltember",
      2,
      ["celtic-tap-chrome-lager-1-2-x14x3-16jg", "black-plastic-handle-for-celtic-tap"],
    ],
    // A pub without credit terms, awaiting card payment before dispatch (items outside its regular reorders).
    ["acc_crown", 2, ["standard-chrome-badge-holder", "st-st-drip-tray-30x18x3"]],
  ] as const) {
    const account = ctx.account(accountId);
    const order = makeOrder(
      accountId,
      addDays(today, -ageDays),
      slugs.map((slug) => ({ productId: slugId(slug), qty: rng.int(2, 6) })),
      { leadDays: 8, po: account.onAccount ? `PO${rng.int(20000, 89999)}` : null },
    );
    salesOrders.push(order);
    origins.set(order.id, { kind: "cycle" });
    if (!account.onAccount) cardPaidOrderIds.add(order.id);
  }

  // ---- Configurations ------------------------------------------------------
  const quoteForConfig = new Map<string, Quote>();
  CONFIG_SPECS.forEach((spec, i) => {
    const site = spec.siteLabel
      ? addresses.find((a) => a.accountId === spec.accountId && a.label === spec.siteLabel)!
      : defaultAddress(addresses, spec.accountId);
    const { state } = buildSelections(spec, site.id);
    const bom = buildBillOfMaterials(state, CONFIGURATOR_RULES, (pid) =>
      ctx.priceFor(spec.accountId, pid),
    );
    const createdAt =
      spec.quote === "accepted"
        ? ctx.seasonalDate(200, 45)
        : spec.quote === "sent"
          ? addDays(today, -rng.int(6, 20))
          : addDays(today, -rng.int(3, 40));
    const id = `cfg_${i + 1}`;
    const config: Configuration = {
      id,
      accountId: spec.accountId,
      name: spec.name,
      siteAddressId: site.id,
      venueType: spec.venueType,
      selections: state.selections,
      lines: bom.lines,
      total: bom.total,
      status: spec.quote === "none" ? "draft" : "quoted",
      quoteId: null,
      createdAt: isoDateTime(createdAt, 10, 15),
      updatedAt: isoDateTime(addDays(createdAt, rng.int(0, 2)), 14, 30),
    };
    configurations.push(config);
    if (spec.quote !== "none") {
      const quoteDate = addDays(createdAt, rng.int(1, 3));
      const q = makeQuote(
        spec.accountId,
        quoteDate > today ? today : quoteDate,
        bom.lines.map((l) => ({ productId: l.productId, qty: l.qty })),
        spec.quote,
        id,
      );
      quotes.push(q);
      config.quoteId = q.id;
      quoteForConfig.set(id, q);
    }
  });

  // ---- The Premium Lager font rollout (assistant demo) ----------------------
  const rolloutQuote = makeQuote(
    "acc_harbourside",
    addDays(today, -52),
    [
      { productId: slugId("cobra-4-out-chrome-led"), qty: 12 },
      { productId: slugId("fc4-tap-chrome-lager-1-2-x35x3-16jg"), qty: 48 },
      { productId: slugId("black-plastic-handle-for-fc4-tap-3-8"), qty: 48 },
      { productId: slugId("extended-chrome-round-badge-holder"), qty: 48 },
      { productId: slugId("st-st-drip-tray-50x22x3-c-w-glass-freshener-drain"), qty: 12 },
      { productId: slugId("glass-freshener-connection-kit-water"), qty: 12 },
      { productId: slugId("s-type-keg-coupler-c-w-jg-fittings-nrv-sankey"), qty: 48 },
    ],
    "accepted",
    null,
  );
  quotes.push(rolloutQuote);

  // ---- Project quotes by sector ---------------------------------------------
  const quotesPerSector: Record<string, number> = {
    "brand-owner": 3,
    brewery: 2,
    hotel: 2,
    restaurant: 1,
    pub: 1,
  };
  const projectPool = (accountId: string) =>
    ctx.listProducts(accountId).filter((p) => ctx.roleOf(p) === "project");
  const sparePool = (accountId: string) =>
    ctx.listProducts(accountId).filter((p) => ctx.roleOf(p) === "spare");
  for (const account of customers) {
    const sector = account.parentAccountId ? "pub" : account.sector;
    const n =
      (quotesPerSector[sector] ?? 1) + (account.sector === "restaurant" && rng.chance(0.5) ? 1 : 0);
    for (let i = 0; i < n; i++) {
      const created = ctx.seasonalDate(360, 3);
      const age = daysBetween(created, today);
      const status: Quote["status"] =
        age <= 30
          ? rng.weighted([
              ["sent", 6],
              ["draft", 1.5],
              ["accepted", 2.5],
            ] as const)
          : rng.weighted([
              ["accepted", 5.5],
              ["declined", 2],
              ["expired", 2.5],
            ] as const);
      const project = rng.sample(projectPool(account.id), rng.int(1, 2));
      const spares = rng.sample(sparePool(account.id), rng.int(1, 4));
      const lines: LineDraft[] = [
        ...project.map((p) => ({
          productId: p.id,
          qty: p.listPrice.amount > 150_000 ? 1 : rng.int(1, 4),
        })),
        ...spares.map((p) => ({ productId: p.id, qty: rng.int(2, 12) })),
      ];
      quotes.push(makeQuote(account.id, created, lines, status, null));
    }
  }

  // Quote follow-up demo: sent quotes close to expiry with no recent activity.
  for (const accountId of ["acc_pennine", "acc_harbourside", "acc_coachworks"]) {
    const project = rng.sample(projectPool(accountId), 1);
    const spares = rng.sample(sparePool(accountId), 3);
    const q = makeQuote(
      accountId,
      addDays(today, -rng.int(24, 27)),
      [
        ...project.map((p) => ({ productId: p.id, qty: 2 })),
        ...spares.map((p) => ({ productId: p.id, qty: rng.int(4, 10) })),
      ],
      "sent",
      null,
    );
    quotes.push(q);
  }

  // ---- Quote outcomes, views and conversions --------------------------------
  quotes.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  for (const q of quotes) {
    q.number = ctx.number("quote");
    const created = new Date(q.createdAt);
    const account = ctx.account(q.accountId);
    if (q.status === "sent") {
      const age = daysBetween(created, today);
      // Expiring follow-up quotes stay quiet; others were viewed recently.
      q.lastViewedAt =
        age >= 23
          ? null
          : rng.chance(0.7)
            ? isoDateTime(addDays(today, -rng.int(0, Math.min(age, 4))), rng.int(8, 18), 5)
            : null;
      q.updatedAt = q.createdAt;
    } else if (q.status === "draft") {
      q.validUntil = isoDate(addDays(created, 30));
    } else if (q.status === "expired") {
      q.lastViewedAt = isoDateTime(addDays(created, rng.int(1, 6)), 11);
      q.updatedAt = `${q.validUntil}T00:05:00.000Z`;
    } else if (q.status === "declined") {
      const decided = addDays(created, rng.int(3, 20));
      q.lastViewedAt = isoDateTime(decided, 10);
      q.updatedAt = isoDateTime(decided, 10, 20);
      q.declineReason = rng.pick([
        "The venue refurbishment has been postponed until next year.",
        "We have gone with the existing fonts and will replace the taps only.",
        "Budget for this site has been reallocated this quarter.",
        "The brand owner is supplying the font for this install.",
      ]);
    } else if (q.status === "accepted") {
      const decided =
        q.id === rolloutQuote.id
          ? addDays(created, 4)
          : addDays(created, rng.int(1, Math.min(14, Math.max(1, daysBetween(created, today)))));
      const decidedAt = decided > today ? today : decided;
      q.lastViewedAt = isoDateTime(decidedAt, 9, 40);
      q.updatedAt = isoDateTime(decidedAt, 10);
      const isRollout = q.id === rolloutQuote.id;
      const install = addresses.filter((a) => a.accountId === q.accountId && !a.isDefault);
      const config = configurations.find((c) => c.quoteId === q.id);
      const order = makeOrder(
        q.accountId,
        decidedAt,
        q.lines.map((l) => ({ productId: l.productId, qty: l.qty })),
        {
          quoteId: q.id,
          addressId:
            config?.siteAddressId ??
            (isRollout ? install.find((a) => a.label === "Midlands install store")!.id : undefined),
          po: account.onAccount
            ? isRollout
              ? "HD-PL-FONTS-Q3"
              : `PO${rng.int(20000, 89999)}`
            : null,
          leadDays: rng.int(10, 21),
        },
      );
      salesOrders.push(order);
      origins.set(
        order.id,
        isRollout ? { kind: "rollout", quoteId: q.id } : { kind: "quote", quoteId: q.id },
      );
      if (!account.onAccount) cardPaidOrderIds.add(order.id);
      q.salesOrderId = order.id;
    }
  }
  const rolloutOrder = salesOrders.find((o) => o.quoteId === rolloutQuote.id)!;

  // ---- Order status, deliveries --------------------------------------------
  salesOrders.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const deliveries: Delivery[] = [];
  const cancelled = new Set(
    rng
      .sample(
        salesOrders.filter(
          (o) => origins.get(o.id)?.kind === "cycle" && daysBetween(o.createdAt, today) > 60,
        ),
        2,
      )
      .map((o) => o.id),
  );
  const partDeliveredCandidates = new Set(
    rng
      .sample(
        salesOrders.filter(
          (o) =>
            origins.get(o.id)?.kind === "quote" &&
            daysBetween(o.createdAt, today) > 12 &&
            daysBetween(o.createdAt, today) < 60 &&
            o.lines.length > 1,
        ),
        2,
      )
      .map((o) => o.id),
  );

  const addDelivery = (
    order: SalesOrder,
    lines: { productId: string; qty: number }[],
    dispatched: Date,
    delivered: Date | null,
  ) => {
    const exportAccount = ctx.vatRate(order.accountId) === 0;
    const carrier = exportAccount ? rng.pick(CARRIERS_EXPORT) : rng.pick(CARRIERS_UK);
    deliveries.push({
      id: `del_${deliveries.length + 1}`,
      orderId: order.id,
      orderType: "sales",
      number: ctx.number("delivery"),
      status: delivered
        ? "delivered"
        : daysBetween(dispatched, today) >= 1
          ? "in-transit"
          : "dispatched",
      carrier,
      trackingRef:
        carrier === "Brewfitt delivery"
          ? null
          : `${carrier.slice(0, 3).toUpperCase()}${rng.int(10_000_000, 99_999_999)}`,
      dispatchedAt: isoDateTime(dispatched, rng.int(7, 9), rng.pick([0, 30])),
      deliveredAt: delivered
        ? isoDateTime(delivered, rng.int(10, 16), rng.pick([5, 25, 45]))
        : null,
      lines,
      noteDocumentId: null,
      proofDocumentId: null,
    });
  };

  for (const order of salesOrders) {
    order.number = ctx.number("salesOrder");
    const created = new Date(order.createdAt);
    const age = daysBetween(created, today);
    const origin = origins.get(order.id)!;
    const lead = daysBetween(created, order.confirmedDate!);

    if (cancelled.has(order.id)) {
      order.status = "cancelled";
      continue;
    }

    if (origin.kind === "rollout") {
      // First wave delivered in full except four fonts on back order from the manufacturer.
      const dispatched = workingDay(addDays(created, 14));
      order.lines = order.lines.map((l) =>
        l.productId === slugId("cobra-4-out-chrome-led")
          ? { ...l, delivered: 8, backordered: 4 }
          : { ...l, delivered: l.qty, backordered: 0 },
      );
      addDelivery(
        order,
        order.lines.map((l) => ({ productId: l.productId, qty: l.delivered })),
        dispatched,
        addDays(dispatched, 1),
      );
      order.status = "part-delivered";
      order.confirmedDate = isoDate(addDays(dispatched, 1));
      continue;
    }

    const dispatchAfter = Math.max(1, lead - 1);
    if (age < dispatchAfter - 1 || age <= 1) {
      order.status = age <= 1 ? "confirmed" : "picking";
      continue;
    }
    if (age < dispatchAfter + 1) {
      order.status = "dispatched";
      order.lines = order.lines.map((l) => ({ ...l }));
      addDelivery(
        order,
        order.lines.map((l) => ({ productId: l.productId, qty: l.qty })),
        workingDay(addDays(created, Math.min(age, dispatchAfter))),
        null,
      );
      continue;
    }

    const dispatched = workingDay(addDays(created, dispatchAfter));
    const delivered = addDays(dispatched, rng.pick([1, 1, 1, 2]));
    if (partDeliveredCandidates.has(order.id)) {
      const short = order.lines[order.lines.length - 1]!;
      order.lines = order.lines.map((l) =>
        l === short
          ? { ...l, delivered: Math.floor(l.qty / 2), backordered: l.qty - Math.floor(l.qty / 2) }
          : { ...l, delivered: l.qty },
      );
      addDelivery(
        order,
        order.lines
          .filter((l) => l.delivered > 0)
          .map((l) => ({ productId: l.productId, qty: l.delivered })),
        dispatched,
        delivered,
      );
      order.status = "part-delivered";
      continue;
    }
    order.lines = order.lines.map((l) => ({ ...l, delivered: l.qty }));
    if (order.lines.length > 2 && rng.chance(0.3) && age > 20) {
      const [first, ...rest] = order.lines;
      addDelivery(order, [{ productId: first!.productId, qty: first!.qty }], dispatched, delivered);
      const second = workingDay(addDays(delivered, rng.int(2, 6)));
      addDelivery(
        order,
        rest.map((l) => ({ productId: l.productId, qty: l.qty })),
        second,
        addDays(second, 1),
      );
    } else {
      addDelivery(
        order,
        order.lines.map((l) => ({ productId: l.productId, qty: l.qty })),
        dispatched,
        delivered,
      );
    }
    order.status = "delivered";
  }

  // ---- Delivery performance -------------------------------------------------
  // Brewfitt confirms the date the carrier can meet, so most deliveries arrive on the
  // confirmed date; about one in seven still lands late (weekends, carrier delays).
  for (const order of salesOrders) {
    if (order.status !== "delivered" && order.status !== "part-delivered") continue;
    const lastDelivered = deliveries
      .filter((d) => d.orderId === order.id && d.deliveredAt)
      .map((d) => d.deliveredAt!.slice(0, 10))
      .sort()
      .at(-1);
    if (!lastDelivered || !order.confirmedDate || lastDelivered <= order.confirmedDate) continue;
    const late = [...order.id].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % 7 === 0;
    if (!late) order.confirmedDate = lastDelivered;
  }

  // ---- Change requests ------------------------------------------------------
  const changeRequests: ChangeRequest[] = [];
  const open = salesOrders.filter((o) => o.status === "confirmed" || o.status === "picking");
  for (const order of rng.sample(open, Math.min(3, open.length))) {
    const current = order.confirmedDate ?? order.requestedDate;
    changeRequests.push({
      id: `chg_${changeRequests.length + 1}`,
      orderId: order.id,
      kind: "date",
      requested: isoDate(workingDay(addDays(new Date(`${current}T00:00:00Z`), rng.int(2, 6)))),
      current,
      status: "pending",
      reason: rng.pick([
        "Cellar refurbishment runs over, so we cannot take delivery that day.",
        "Our manager is on leave that week; please deliver after they return.",
        "We need the delivery after the weekend event.",
      ]),
      createdAt: isoDateTime(addDays(today, -rng.int(0, 1)), rng.int(9, 16)),
    });
  }
  const delivered = salesOrders.filter(
    (o) => o.status === "delivered" && daysBetween(o.createdAt, today) < 120,
  );
  for (const [i, order] of rng.sample(delivered, 3).entries()) {
    const altAddress = addresses.find(
      (a) => a.accountId === order.accountId && a.id !== order.deliveryAddressId,
    );
    const kind: ChangeRequest["kind"] = i === 2 && altAddress ? "address" : "date";
    const created = addDays(new Date(order.createdAt), 1);
    changeRequests.push({
      id: `chg_${changeRequests.length + 1}`,
      orderId: order.id,
      kind,
      requested: kind === "address" ? altAddress!.id : order.confirmedDate!,
      current:
        kind === "address"
          ? order.deliveryAddressId
          : isoDate(addDays(new Date(`${order.confirmedDate}T00:00:00Z`), -2)),
      status: i === 2 ? "rejected" : "approved",
      reason:
        i === 2
          ? "The order had already been picked for the original address."
          : "Approved; delivery moved to the requested date.",
      createdAt: isoDateTime(created, 11),
    });
  }

  // ---- Jobs (supply and install) -------------------------------------------
  const jobs: Job[] = [];
  const addJob = (
    order: SalesOrder,
    name: string,
    scheduled: Date,
    siteAddressId: string,
    engineer: string,
  ) => {
    const days = daysBetween(scheduled, today);
    let status: Job["status"] = "scheduled";
    let completionPercent = 0;
    let signedOffAt: string | null = null;
    let warrantyStart: string | null = null;
    let warrantyEnd: string | null = null;
    if (days === 0 || days === 1) {
      status = "in-progress";
      completionPercent = days === 0 ? 40 : 75;
    } else if (days > 1 && days <= 6) {
      status = "completed";
      completionPercent = 100;
    } else if (days > 6) {
      status = "signed-off";
      completionPercent = 100;
      const signed = addDays(scheduled, rng.int(1, 3));
      signedOffAt = isoDateTime(signed, 16, 30);
      warrantyStart = isoDate(signed);
      warrantyEnd = isoDate(addDays(signed, 365));
    }
    jobs.push({
      id: `job_${jobs.length + 1}`,
      accountId: order.accountId,
      orderId: order.id,
      siteAddressId,
      name,
      engineerName: engineer,
      scheduledDate: isoDate(scheduled),
      status,
      completionPercent,
      signedOffAt,
      warrantyStart,
      warrantyEnd,
    });
  };

  const rolloutStores = addresses.filter((a) => a.accountId === "acc_harbourside" && !a.isDefault);
  addJob(
    rolloutOrder,
    "Premium Lager font install: wave 1",
    workingDay(addDays(today, -16)),
    rolloutStores[0]!.id,
    "Craig Lockwood",
  );
  addJob(
    rolloutOrder,
    "Premium Lager font install: wave 2",
    workingDay(addDays(today, 0)),
    rolloutStores[1]!.id,
    "Dean Sykes",
  );
  addJob(
    rolloutOrder,
    "Premium Lager font install: wave 3 (back-ordered fonts)",
    workingDay(addDays(today, 19)),
    rolloutStores[0]!.id,
    "Craig Lockwood",
  );

  const installSectors = new Set(["brewery", "brand-owner", "hotel", "restaurant", "pub"]);
  const installOrders = salesOrders.filter((o) => {
    const origin = origins.get(o.id);
    if (origin?.kind !== "quote" || o.status === "cancelled") return false;
    const acc = ctx.account(o.accountId);
    const net = o.lines.reduce((s, l) => s + l.qty * l.price.amount, 0);
    return (
      installSectors.has(acc.parentAccountId ? "pub" : acc.sector) &&
      ctx.vatRate(o.accountId) > 0 &&
      net > 80_000
    );
  });
  for (const order of installOrders) {
    const lastDelivery = deliveries
      .filter((d) => d.orderId === order.id)
      .map((d) => d.deliveredAt ?? d.dispatchedAt)
      .sort()
      .pop();
    const base = lastDelivery
      ? new Date(lastDelivery)
      : new Date(`${order.confirmedDate}T00:00:00Z`);
    const scheduled = workingDay(addDays(base, rng.int(2, 7)));
    const config = configurations.find((c) => c.quoteId === order.quoteId);
    const label = config
      ? config.name
      : `${ctx.productById.get(order.lines[0]!.productId)!.name.split(" ").slice(0, 3).join(" ")} install`;
    const big = order.lines.reduce((s, l) => s + l.qty * l.price.amount, 0) > 400_000;
    if (big && jobs.length < 26) {
      addJob(order, `${label}: first fix`, scheduled, order.deliveryAddressId, rng.pick(ENGINEERS));
      addJob(
        order,
        `${label}: second fix and commissioning`,
        workingDay(addDays(scheduled, rng.int(3, 6))),
        order.deliveryAddressId,
        rng.pick(ENGINEERS),
      );
    } else {
      addJob(order, label, scheduled, order.deliveryAddressId, rng.pick(ENGINEERS));
    }
  }

  // ---- Baskets --------------------------------------------------------------
  const baskets: Basket[] = [
    {
      id: "bsk_acc_crown",
      accountId: "acc_crown",
      lines: [
        { productId: slugId("pipeline-purple-beer-line-cleaning-powder"), qty: 2 },
        { productId: slugId("s-type-keg-coupler-c-w-jg-fittings-nrv-sankey"), qty: 1 },
      ],
      deliveryAddressId: defaultAddress(addresses, "acc_crown").id,
      requestedDate: null,
      poReference: null,
      notes: null,
    },
  ];

  const lowStockProductIds = [
    slugId("pipeline-purple-beer-line-cleaning-powder"),
    slugId("s-type-keg-coupler-c-w-jg-fittings-nrv-sankey"),
  ];

  return {
    configurations,
    quotes,
    salesOrders,
    deliveries,
    changeRequests,
    jobs,
    baskets,
    cardPaidOrderIds,
    rolloutOrderId: rolloutOrder.id,
    regularProductsByAccount,
    lowStockProductIds,
  };
}

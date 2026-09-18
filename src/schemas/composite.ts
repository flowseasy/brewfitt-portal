import { z } from "zod";
import { Currency, Id, IsoDate, IsoDateTime } from "./common";

/**
 * Composite Configurator (decision 14): Brewfitt staff cost a made-to-order
 * composite item from catalogue products, component items and one-off
 * ("Misc") supplier lines, price it per quantity band and add it to a
 * customer quote. Internal only; customers and suppliers never see a build.
 */

/** Quantity bands: base, then 50+, 100+ and 200+. Each has its own costing. */
export const CompositeBandKey = z.enum(["base", "50", "100", "200"]);

/** Shipping and duty: a fixed amount per unit (pence) or a % of goods cost. */
export const CostBasis = z.object({
  mode: z.enum(["amount", "percent"]),
  value: z.number().min(0),
});

export const CompositeLineKind = z.enum(["catalogue", "component", "misc"]);

/** A one-off supplier item: how it is sold and how it is bought. */
export const CompositeMisc = z.object({
  sellingName: z.string(),
  sellingDescription: z.string(),
  buyingName: z.string(),
  buyingDescription: z.string(),
  /** The supplier's quote number, for the buyer. */
  supplierQuoteRef: z.string(),
});

export const CompositeLine = z.object({
  id: Id,
  kind: CompositeLineKind,
  /** Catalogue product or component item; null for Misc lines. */
  itemId: Id.nullable(),
  code: z.string(),
  description: z.string(),
  /** Currency the item is bought in; EUR and USD convert at the build's FX rate. */
  currency: Currency,
  /** Unit cost in minor units of `currency`. */
  unitCost: z.int().min(0),
  qty: z.number().positive(),
  misc: CompositeMisc.nullable(),
});

export const CompositeBand = z.object({
  key: CompositeBandKey,
  lines: z.array(CompositeLine),
  shipping: CostBasis,
  duty: CostBasis,
  labourHours: z.number().min(0),
  /** Margin as a % of sell price; "price by margin" is cost / (1 − margin). */
  targetMarginPercent: z.number().min(0).max(95),
  /** Unit sell price in pence, before carriage. */
  sellPrice: z.int().min(0),
  /** Carriage (CRG) per unit in pence, added after margin and not marked up. */
  carriage: z.int().min(0),
});

/** Units per GBP, e.g. USD 1.25 means £1 = $1.25. */
export const FxRates = z.object({
  EUR: z.number().positive(),
  USD: z.number().positive(),
});

export const CompositeQuoteRef = z.object({
  quoteId: Id,
  quoteNumber: z.string().min(1),
  bandKey: CompositeBandKey,
  qty: z.int().positive(),
  addedAt: IsoDateTime,
});

export const CompositeBuild = z.object({
  id: Id,
  number: z.string().min(1),
  name: z.string().min(1),
  /** Customer-facing description carried onto the quote line. */
  description: z.string(),
  accountId: Id,
  /** Brand or project the build is for. */
  brand: z.string(),
  createdOn: IsoDate,
  creatorInitials: z.string().min(1).max(4),
  status: z.enum(["draft", "quoted"]),
  fxRates: FxRates,
  /** Labour rate in pence per hour; hours are set per band. */
  labourRate: z.int().min(0),
  bands: z.array(CompositeBand).min(1),
  quotes: z.array(CompositeQuoteRef),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
});

/** Build list row: the build plus the customer's name. */
export const CompositeBuildSummary = CompositeBuild.extend({ accountName: z.string() });

/** POST /api/internal/composite-builds */
export const CompositeBuildInput = z.object({
  name: z.string().trim().min(3, "Give the build a name of at least 3 characters"),
  accountId: Id,
  brand: z.string().trim().default(""),
  description: z.string().trim().default(""),
});

/** PATCH /api/internal/composite-builds/:id */
export const CompositeBuildPatch = z.object({
  name: z.string().trim().min(1).optional(),
  description: z.string().optional(),
  accountId: Id.optional(),
  brand: z.string().optional(),
  fxRates: FxRates.optional(),
  labourRate: z.int().min(0).optional(),
  bands: z.array(CompositeBand).min(1).optional(),
});

/** POST /api/internal/composite-builds/:id/add-to-quote */
export const AddCompositeToQuoteRequest = z.object({
  bandKey: CompositeBandKey,
  qty: z.int().positive(),
  /** An open quote on the same account to add to; null starts a new quote. */
  quoteId: Id.nullable(),
});

/** Mock system settings: FX rates as at a date and the default labour rate. */
export const CompositeSettings = z.object({
  systemFxRates: FxRates,
  fxRatesAsOf: IsoDate,
  labourRate: z.int().min(0),
});

/** Type-ahead source: a catalogue product or a component item, at cost. */
export const CostItem = z.object({
  id: Id,
  kind: z.enum(["catalogue", "component"]),
  code: z.string().min(1),
  name: z.string().min(1),
  category: z.string().min(1),
  currency: Currency,
  unitCost: z.int().min(0),
  unit: z.string().min(1),
});

export const CostItemQuery = z.object({
  q: z.string().default(""),
  limit: z.int().positive().max(50).default(12),
});

/** Customer accounts a build can be for. */
export const InternalCustomer = z.object({
  id: Id,
  name: z.string().min(1),
  sector: z.string().min(1),
});

/** BOM carried on a quote line for Brewfitt only; stripped from customer responses. */
export const CompositeQuoteLineInternal = z.object({
  buildId: Id,
  buildNumber: z.string().min(1),
  bandKey: CompositeBandKey,
  bom: z.array(CompositeLine),
  fxRates: FxRates,
  /** Unit cost in pence (may be fractional). */
  unitCost: z.number().min(0),
  marginPercent: z.number(),
});

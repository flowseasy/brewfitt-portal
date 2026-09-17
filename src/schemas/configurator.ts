import { z } from "zod";
import { AddressInput } from "./account";
import { Id, IsoDateTime, Money } from "./common";

export const ConfiguratorStepId = z.enum([
  "venue",
  "dispense",
  "font",
  "cooling",
  "gas",
  "ancillaries",
]);

export const VenueType = z.enum([
  "pub",
  "bar",
  "restaurant",
  "hotel",
  "brewery-taproom",
  "event",
  "stadium",
]);

export const Beverage = z.enum(["beer", "cider", "lager", "soft", "water", "coffee"]);

export const ConfiguratorStep = z.object({
  id: ConfiguratorStepId,
  title: z.string().min(1),
  description: z.string().min(1),
});

/** A choice within a step, e.g. "Font style" or "Python length". */
export const ConfiguratorGroup = z.object({
  id: Id,
  stepId: ConfiguratorStepId,
  label: z.string().min(1),
  help: z.string().nullable(),
  selection: z.enum(["single", "multiple"]),
  required: z.boolean(),
});

/** How many of a product an option contributes to the bill of materials. */
export const QuantityBasis = z.enum(["fixed", "per-point", "per-draught-tap", "per-metre"]);

export const OptionLine = z.union([
  z.object({
    productId: Id,
    basis: QuantityBasis,
    quantity: z.number().positive(),
  }),
  /** One product per dispense point, chosen by that point's draught tap count (fonts, drip trays). */
  z.object({
    productIdByDraughtTaps: z.record(z.string().regex(/^\d+$/), Id),
    basis: z.literal("per-point"),
    quantity: z.number().positive(),
  }),
]);

export const OptionCompatibility = z.object({
  venueTypes: z.array(VenueType).optional(),
  /** At least one tap must serve one of these. */
  beverages: z.array(Beverage).optional(),
  /** No tap may serve these. */
  excludesBeverages: z.array(Beverage).optional(),
  minDraughtTapsPerPoint: z.int().nonnegative().optional(),
  maxDraughtTapsPerPoint: z.int().positive().optional(),
  minTotalDraughtTaps: z.int().nonnegative().optional(),
  maxTotalDraughtTaps: z.int().positive().optional(),
  minPythonMetres: z.number().nonnegative().optional(),
  maxPythonMetres: z.number().positive().optional(),
  /** Every one of these must be selected. */
  requiresOptionIds: z.array(Id).optional(),
  /** At least one of these must be selected. */
  requiresAnyOptionIds: z.array(Id).optional(),
  excludesOptionIds: z.array(Id).optional(),
});

export const ConfiguratorOption = z.object({
  id: Id,
  groupId: Id,
  label: z.string().min(1),
  description: z.string().min(1),
  image: z.string().nullable(),
  lines: z.array(OptionLine),
  compatibility: OptionCompatibility,
  /** Shown when the option is unavailable, e.g. "Needs 4 or more taps per point". */
  incompatibleReason: z.string().nullable(),
});

export const ConfiguratorRules = z.object({
  version: z.string().min(1),
  steps: z.array(ConfiguratorStep),
  groups: z.array(ConfiguratorGroup),
  options: z.array(ConfiguratorOption),
  limits: z.object({
    minPoints: z.int().positive(),
    maxPoints: z.int().positive(),
    maxTapsPerPoint: z.int().positive(),
    minPythonMetres: z.number().nonnegative(),
    maxPythonMetres: z.number().positive(),
  }),
  defaults: z.object({
    venueType: VenueType,
    points: z.int().positive(),
    beveragesPerPoint: z.array(Beverage),
    pythonMetres: z.number().nonnegative(),
    optionIds: z.array(Id),
  }),
});

export const DispensePoint = z.object({
  id: Id,
  name: z.string().min(1),
  /** One entry per tap. */
  taps: z.array(Beverage).min(1),
});

export const ConfigurationSelections = z.object({
  venue: z.object({
    newSite: AddressInput.nullable(),
  }),
  dispense: z.object({
    points: z.array(DispensePoint).min(1),
    /** Tap style, keg coupler and non-draught equipment. */
    optionIds: z.array(Id),
  }),
  font: z.object({
    optionIds: z.array(Id),
    branding: z.string().nullable(),
    /** Artwork file names for fonts and badges (Phase 1 keeps names, not files). */
    artwork: z.array(z.string().min(1)).max(20).default([]),
  }),
  cooling: z.object({
    optionIds: z.array(Id),
    pythonMetres: z.number().nonnegative(),
  }),
  gas: z.object({
    optionIds: z.array(Id),
  }),
  ancillaries: z.object({
    optionIds: z.array(Id),
  }),
});

export const ConfigurationLine = z.object({
  productId: Id,
  qty: z.int().positive(),
  /** Unit price at the account's price-list price. */
  price: Money,
});

export const Configuration = z.object({
  id: Id,
  accountId: Id,
  name: z.string().min(1),
  siteAddressId: Id.nullable(),
  venueType: VenueType,
  selections: ConfigurationSelections,
  lines: z.array(ConfigurationLine),
  total: Money,
  status: z.enum(["draft", "quoted"]),
  quoteId: Id.nullable(),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
});

export const ConfigurationInput = Configuration.pick({
  name: true,
  siteAddressId: true,
  venueType: true,
  selections: true,
});

export const ConfigurationPatch = ConfigurationInput.partial();

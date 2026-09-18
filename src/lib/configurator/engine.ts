import type {
  Beverage,
  ConfigurationLine,
  ConfigurationSelections,
  ConfiguratorOption,
  ConfiguratorRules,
  ConfiguratorStepId,
  DispensePoint,
  Money,
  VenueType,
} from "@/types";

/**
 * Configurator rule evaluation, shared by the configurator UI and the API.
 * Pure functions over the rules JSON: which options are compatible, whether a
 * step is valid, and the bill of materials a set of selections produces.
 */

export const DRAUGHT_BEVERAGES: readonly Beverage[] = ["beer", "cider", "lager"];

export type ConfigState = {
  venueType: VenueType;
  siteAddressId: string | null;
  selections: ConfigurationSelections;
};

export const draughtTaps = (point: DispensePoint) =>
  point.taps.filter((t) => DRAUGHT_BEVERAGES.includes(t)).length;

export function selectedOptionIds(selections: ConfigurationSelections): string[] {
  return [
    ...selections.dispense.optionIds,
    ...selections.font.optionIds,
    ...selections.cooling.optionIds,
    ...selections.gas.optionIds,
    ...selections.ancillaries.optionIds,
  ];
}

export type Compatibility = { compatible: true } | { compatible: false; reason: string };

/** Whether an option can be chosen given everything else in the configuration. */
export function checkCompatibility(
  option: ConfiguratorOption,
  state: ConfigState,
  rules: ConfiguratorRules,
): Compatibility {
  const c = option.compatibility;
  const points = state.selections.dispense.points;
  const allTaps = points.flatMap((p) => p.taps);
  const perPoint = points.map(draughtTaps);
  const totalDraught = perPoint.reduce((a, b) => a + b, 0);
  const maxPerPoint = Math.max(0, ...perPoint);
  const minPerPoint = Math.min(...perPoint.filter((n) => n > 0), Number.POSITIVE_INFINITY);
  const metres = state.selections.cooling.pythonMetres;
  const chosen = new Set(selectedOptionIds(state.selections));
  const label = (id: string) => rules.options.find((o) => o.id === id)?.label ?? id;
  const fail = (reason: string): Compatibility => ({
    compatible: false,
    reason: option.incompatibleReason ?? reason,
  });

  if (c.venueTypes && !c.venueTypes.includes(state.venueType))
    return fail("Not available for this venue type");
  if (c.beverages && !allTaps.some((t) => c.beverages!.includes(t)))
    return fail(`Needs a ${c.beverages.join(" or ")} tap`);
  if (c.excludesBeverages && allTaps.some((t) => c.excludesBeverages!.includes(t))) {
    return fail(`Not suitable with ${c.excludesBeverages.join(" or ")} taps`);
  }
  if (c.maxDraughtTapsPerPoint !== undefined && maxPerPoint > c.maxDraughtTapsPerPoint) {
    return fail(`Up to ${c.maxDraughtTapsPerPoint} draught taps per point`);
  }
  if (
    c.minDraughtTapsPerPoint !== undefined &&
    minPerPoint !== Number.POSITIVE_INFINITY &&
    minPerPoint < c.minDraughtTapsPerPoint
  ) {
    return fail(`Needs ${c.minDraughtTapsPerPoint} or more draught taps per point`);
  }
  if (c.maxTotalDraughtTaps !== undefined && totalDraught > c.maxTotalDraughtTaps)
    return fail(`Up to ${c.maxTotalDraughtTaps} draught taps in total`);
  if (c.minTotalDraughtTaps !== undefined && totalDraught < c.minTotalDraughtTaps)
    return fail(`Needs ${c.minTotalDraughtTaps} or more draught taps`);
  if (c.maxPythonMetres !== undefined && metres > c.maxPythonMetres)
    return fail(`Python runs up to ${c.maxPythonMetres} m`);
  if (c.minPythonMetres !== undefined && metres < c.minPythonMetres)
    return fail(`Python runs of ${c.minPythonMetres} m or more`);
  const missing = c.requiresOptionIds?.find((id) => !chosen.has(id));
  if (missing) return fail(`Requires ${label(missing)}`);
  if (c.requiresAnyOptionIds && !c.requiresAnyOptionIds.some((id) => chosen.has(id))) {
    return fail(`Requires ${c.requiresAnyOptionIds.map(label).join(" or ")}`);
  }
  const clash = c.excludesOptionIds?.find((id) => chosen.has(id));
  if (clash) return fail(`Cannot be combined with ${label(clash)}`);
  return { compatible: true };
}

export function stepOptionIds(
  stepId: ConfiguratorStepId,
  selections: ConfigurationSelections,
): string[] {
  switch (stepId) {
    case "dispense":
      return selections.dispense.optionIds;
    case "font":
      return selections.font.optionIds;
    case "cooling":
      return selections.cooling.optionIds;
    case "gas":
      return selections.gas.optionIds;
    case "ancillaries":
      return selections.ancillaries.optionIds;
    default:
      return [];
  }
}

/** Validation messages for one step; empty when the step is complete. */
export function validateStep(
  stepId: ConfiguratorStepId,
  state: ConfigState,
  rules: ConfiguratorRules,
): string[] {
  const errors: string[] = [];
  const { selections } = state;

  if (stepId === "venue") {
    if (!state.siteAddressId && !selections.venue.newSite)
      errors.push("Choose a delivery site or add a new one.");
    return errors;
  }

  if (stepId === "dispense") {
    const { points } = selections.dispense;
    if (points.length < rules.limits.minPoints)
      errors.push(`Add at least ${rules.limits.minPoints} dispense point.`);
    if (points.length > rules.limits.maxPoints)
      errors.push(`A design can have up to ${rules.limits.maxPoints} dispense points.`);
    for (const p of points) {
      if (p.taps.length === 0) errors.push(`${p.name} needs at least one product.`);
      if (draughtTaps(p) > rules.limits.maxTapsPerPoint)
        errors.push(`${p.name} has more than ${rules.limits.maxTapsPerPoint} draught taps.`);
    }
  }

  if (stepId === "cooling") {
    const m = selections.cooling.pythonMetres;
    // Length only matters when a per-metre option (a python) applies to this configuration.
    const needsPython = rules.options.some(
      (o) =>
        o.lines.some((l) => l.basis === "per-metre") &&
        checkCompatibility(o, state, rules).compatible,
    );
    if (needsPython && (m < rules.limits.minPythonMetres || m > rules.limits.maxPythonMetres)) {
      errors.push(
        `Python length must be between ${rules.limits.minPythonMetres} and ${rules.limits.maxPythonMetres} metres.`,
      );
    }
  }

  const chosen = new Set(selectedOptionIds(selections));
  for (const group of rules.groups.filter((g) => g.stepId === stepId)) {
    const options = rules.options.filter((o) => o.groupId === group.id);
    const compatible = options.filter((o) => checkCompatibility(o, state, rules).compatible);
    const picked = options.filter((o) => chosen.has(o.id));
    // A required group with nothing compatible does not apply to this configuration.
    if (group.required && compatible.length > 0 && picked.length === 0)
      errors.push(`Choose a ${group.label.toLowerCase()}.`);
    if (group.selection === "single" && picked.length > 1)
      errors.push(`Choose only one ${group.label.toLowerCase()}.`);
    for (const o of picked) {
      const result = checkCompatibility(o, state, rules);
      if (!result.compatible) errors.push(`${o.label}: ${result.reason}.`);
    }
  }
  return errors;
}

export function validateConfiguration(
  state: ConfigState,
  rules: ConfiguratorRules,
): Partial<Record<ConfiguratorStepId, string[]>> {
  const out: Partial<Record<ConfiguratorStepId, string[]>> = {};
  for (const step of rules.steps) {
    const errors = validateStep(step.id, state, rules);
    if (errors.length) out[step.id] = errors;
  }
  return out;
}

/** Bill of materials at the account's prices. `priceFor` returns null for products not on the price list. */
export function buildBillOfMaterials(
  state: ConfigState,
  rules: ConfiguratorRules,
  priceFor: (productId: string) => Money | null,
): { lines: ConfigurationLine[]; total: Money; unpriced: string[] } {
  const qty = new Map<string, number>();
  const add = (productId: string, n: number) => {
    if (n > 0) qty.set(productId, (qty.get(productId) ?? 0) + n);
  };
  const points = state.selections.dispense.points;
  const draughtTotal = points.reduce((sum, p) => sum + draughtTaps(p), 0);
  const chosen = new Set(selectedOptionIds(state.selections));

  for (const option of rules.options) {
    if (!chosen.has(option.id)) continue;
    for (const line of option.lines) {
      if ("productIdByDraughtTaps" in line) {
        for (const p of points) {
          const n = draughtTaps(p);
          if (n === 0) continue;
          const sizes = Object.keys(line.productIdByDraughtTaps)
            .map(Number)
            .sort((a, b) => a - b);
          const size = sizes.find((s) => s >= n) ?? sizes[sizes.length - 1]!;
          add(line.productIdByDraughtTaps[String(size)]!, line.quantity);
        }
        continue;
      }
      const multiplier =
        line.basis === "fixed"
          ? 1
          : line.basis === "per-point"
            ? points.filter((p) => draughtTaps(p) > 0).length
            : line.basis === "per-draught-tap"
              ? draughtTotal
              : Math.ceil(state.selections.cooling.pythonMetres);
      add(line.productId, Math.ceil(line.quantity * multiplier));
    }
  }

  const lines: ConfigurationLine[] = [];
  const unpriced: string[] = [];
  let currency: Money["currency"] = "GBP";
  for (const [productId, n] of qty) {
    const price = priceFor(productId);
    if (!price) {
      unpriced.push(productId);
      continue;
    }
    currency = price.currency;
    lines.push({ productId, qty: n, price });
  }
  const total = { amount: lines.reduce((sum, l) => sum + l.qty * l.price.amount, 0), currency };
  return { lines, total, unpriced };
}

"use client";

import { useMemo, useReducer } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, queryKeys } from "@/lib/api";
import { buildBillOfMaterials, checkCompatibility, draughtTaps, selectedOptionIds, stepOptionIds, validateConfiguration, type ConfigState } from "@/lib/configurator/engine";
import type { AddressInput, Beverage, Configuration, ConfigurationSelections, ConfiguratorRules, ConfiguratorStepId, DispensePoint, Money, VenueType } from "@/types";
import { usePersonaKey } from "@/features/session/use-session";

export type BuilderState = ConfigState & { name: string };

export const BEVERAGE_LABEL: Record<Beverage, string> = { lager: "Lager", beer: "Ale or stout", cider: "Cider", soft: "Soft drinks", water: "Water", coffee: "Coffee" };

export const VENUE_LABEL: Record<VenueType, string> = {
  pub: "Pub",
  bar: "Bar",
  restaurant: "Restaurant",
  hotel: "Hotel",
  "brewery-taproom": "Brewery taproom",
  event: "Event or mobile bar",
  stadium: "Stadium or arena",
};

export function useConfiguratorData() {
  const key = usePersonaKey();
  return {
    rules: useQuery({ queryKey: queryKeys.configuratorRules(key), queryFn: () => api.configurator.rules(), staleTime: Infinity }),
    configurations: useQuery({ queryKey: queryKeys.configurations(key), queryFn: () => api.configurator.list() }),
    addresses: useQuery({ queryKey: queryKeys.addresses(key), queryFn: () => api.account.addresses() }),
    priceList: useQuery({ queryKey: queryKeys.priceList(key), queryFn: () => api.priceList.get() }),
    me: useQuery({ queryKey: queryKeys.me(key), queryFn: () => api.session.me() }),
  };
}

export function initialState(rules: ConfiguratorRules, siteAddressId: string | null): BuilderState {
  const points: DispensePoint[] = Array.from({ length: rules.defaults.points }, (_, i) => ({ id: `pt-${i + 1}`, name: `Dispense point ${i + 1}`, taps: [...rules.defaults.beveragesPerPoint] }));
  const selections: ConfigurationSelections = {
    venue: { newSite: null },
    dispense: { points, optionIds: [] },
    font: { optionIds: [], branding: null },
    cooling: { optionIds: [], pythonMetres: rules.defaults.pythonMetres },
    gas: { optionIds: [] },
    ancillaries: { optionIds: [] },
  };
  const state: BuilderState = { name: "", venueType: rules.defaults.venueType, siteAddressId, selections };
  for (const id of rules.defaults.optionIds) {
    const option = rules.options.find((o) => o.id === id);
    const group = option && rules.groups.find((g) => g.id === option.groupId);
    if (group) bucket(state.selections, group.stepId).optionIds.push(id);
  }
  return prune(state, rules).state;
}

export function fromConfiguration(c: Configuration, copy = false): BuilderState {
  return { name: copy ? `Copy of ${c.name}` : c.name, venueType: c.venueType, siteAddressId: c.siteAddressId, selections: structuredClone(c.selections) };
}

function bucket(selections: ConfigurationSelections, stepId: ConfiguratorStepId): { optionIds: string[] } {
  switch (stepId) {
    case "dispense":
      return selections.dispense;
    case "font":
      return selections.font;
    case "cooling":
      return selections.cooling;
    case "gas":
      return selections.gas;
    default:
      return selections.ancillaries;
  }
}

/**
 * Removes selected options that are no longer compatible, repeating until
 * stable (removing one can invalidate another), and auto-selects non-draught
 * equipment that now applies. Returns what was removed so the UI can say so.
 */
export function prune(state: BuilderState, rules: ConfiguratorRules): { state: BuilderState; removed: string[] } {
  let next = structuredClone(state);
  const removed: string[] = [];
  for (let pass = 0; pass < 6; pass++) {
    let changed = false;
    for (const id of selectedOptionIds(next.selections)) {
      const option = rules.options.find((o) => o.id === id);
      if (!option) continue;
      if (!checkCompatibility(option, next, rules).compatible) {
        const group = rules.groups.find((g) => g.id === option.groupId)!;
        const b = bucket(next.selections, group.stepId);
        b.optionIds = b.optionIds.filter((x) => x !== id);
        removed.push(option.label);
        changed = true;
      }
    }
    if (!changed) break;
  }
  // Soft drinks, water and hot drinks equipment follows the taps chosen.
  const auto = rules.options.filter((o) => o.groupId === "g-other-dispense");
  const d = next.selections.dispense;
  d.optionIds = d.optionIds.filter((id) => !auto.some((o) => o.id === id));
  for (const o of auto) if (checkCompatibility(o, next, rules).compatible) d.optionIds.push(o.id);
  next = { ...next };
  return { state: next, removed };
}

export type BuilderAction =
  | { type: "reset"; state: BuilderState }
  | { type: "name"; name: string }
  | { type: "venue"; venueType: VenueType }
  | { type: "site"; siteAddressId: string | null; newSite?: AddressInput | null }
  | { type: "newSite"; newSite: AddressInput | null }
  | { type: "points"; points: DispensePoint[] }
  | { type: "select"; groupId: string; optionId: string; single: boolean; on: boolean }
  | { type: "python"; metres: number }
  | { type: "branding"; branding: string | null };

export function useBuilder(rules: ConfiguratorRules | undefined, init: () => BuilderState | null) {
  const [store, dispatch] = useReducer(
    (current: { state: BuilderState | null; removed: string[] }, action: BuilderAction) => {
      if (action.type === "reset") return { state: action.state, removed: [] };
      if (!current.state || !rules) return current;
      const s = structuredClone(current.state);
      switch (action.type) {
        case "name":
          s.name = action.name;
          return { state: s, removed: [] };
        case "branding":
          s.selections.font.branding = action.branding;
          return { state: s, removed: [] };
        case "venue":
          s.venueType = action.venueType;
          break;
        case "site":
          s.siteAddressId = action.siteAddressId;
          s.selections.venue.newSite = action.newSite ?? null;
          break;
        case "newSite":
          s.selections.venue.newSite = action.newSite;
          break;
        case "points":
          s.selections.dispense.points = action.points;
          break;
        case "python":
          s.selections.cooling.pythonMetres = action.metres;
          break;
        case "select": {
          const group = rules.groups.find((g) => g.id === action.groupId)!;
          const b = bucket(s.selections, group.stepId);
          const inGroup = rules.options.filter((o) => o.groupId === group.id).map((o) => o.id);
          if (action.on) b.optionIds = [...(action.single ? b.optionIds.filter((id) => !inGroup.includes(id)) : b.optionIds), action.optionId];
          else b.optionIds = b.optionIds.filter((id) => id !== action.optionId);
          break;
        }
      }
      const { state, removed } = prune(s, rules);
      return { state, removed };
    },
    undefined,
    () => ({ state: init(), removed: [] }),
  );
  return { state: store.state, removed: store.removed, dispatch };
}

export function useBillOfMaterials(state: BuilderState | null, rules: ConfiguratorRules | undefined, priceLines: { productId: string; price: Money }[] | undefined) {
  return useMemo(() => {
    if (!state || !rules || !priceLines) return null;
    const prices = new Map(priceLines.map((l) => [l.productId, l.price]));
    const bom = buildBillOfMaterials(state, rules, (id) => prices.get(id) ?? null);
    const errors = validateConfiguration(state, rules);
    return { ...bom, errors };
  }, [state, rules, priceLines]);
}

export function describePoints(points: DispensePoint[]): string {
  const taps = points.reduce((s, p) => s + p.taps.length, 0);
  const draught = points.reduce((s, p) => s + draughtTaps(p), 0);
  return `${points.length} ${points.length === 1 ? "point" : "points"}, ${taps} ${taps === 1 ? "product" : "products"}${draught !== taps ? ` (${draught} draught)` : ""}`;
}

export { stepOptionIds, checkCompatibility, draughtTaps };

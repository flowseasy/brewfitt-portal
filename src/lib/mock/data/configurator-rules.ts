import type { ConfiguratorRules } from "@/types";

/**
 * FIRST DRAFT of the TOTA360v5 configurator definition, written before the
 * rules workshop with Brewfitt. Brewfitt defines the real rules; thresholds
 * here (taps per cooler, python limits) are placeholders for that workshop to
 * confirm, built only from products in Brewfitt's trade catalogue.
 */

const p = (slug: string) => `prd_${slug}`;

const fontBySize = (sizes: Record<number, string>) =>
  Object.fromEntries(Object.entries(sizes).map(([k, slug]) => [k, p(slug)]));

const DRIP = {
  standard: fontBySize({ 1: "st-st-drip-tray-20x18x3", 2: "st-st-drip-tray-30x18x3", 3: "st-st-drip-tray-40x18x3", 4: "st-st-drip-tray-50x22x3", 5: "st-st-drip-tray-60x22x3", 6: "st-st-drip-tray-80x22x3" }),
  freshener: fontBySize({ 2: "st-st-drip-tray-30x18x3-c-w-glass-freshener-drain", 3: "st-st-drip-tray-40x18x3-c-w-glass-freshener-drain", 4: "st-st-drip-tray-50x22x3-c-w-glass-freshener-drain", 5: "st-st-drip-tray-60x22x3-c-w-glass-freshener-drain", 6: "st-st-drip-tray-80x22x3-c-w-glass-freshener-drain" }),
  recessed: fontBySize({ 1: "st-st-recessed-drip-tray-20x18x3-c-w-drain", 2: "st-st-recessed-drip-tray-30x18x3-c-w-drain", 3: "st-st-recessed-drip-tray-40x18x3-c-w-drain", 4: "st-st-recessed-drip-tray-50x22x3-c-w-drain", 5: "st-st-recessed-drip-tray-60x22x3-c-w-drain", 6: "st-st-recessed-drip-tray-80x22x3-c-w-drain" }),
};

const FIXED_VENUES = ["pub", "bar", "restaurant", "hotel", "brewery-taproom", "stadium"] as const;

export const CONFIGURATOR_RULES: ConfiguratorRules = {
  version: "draft-1 (pre-workshop)",
  steps: [
    { id: "venue", title: "Venue and site", description: "Where the system is going and what kind of venue it serves." },
    { id: "dispense", title: "Dispense points", description: "How many dispense points, and what each one pours." },
    { id: "font", title: "Font and branding", description: "The font style on the bar and how it carries your brand." },
    { id: "cooling", title: "Cooling", description: "Remote cooler, python run to the bar and cooling at the point of dispense." },
    { id: "gas", title: "Gas", description: "Gas type, regulators and safe cylinder storage." },
    { id: "ancillaries", title: "Ancillaries", description: "Drip trays, line cleaning and fob control." },
  ],
  groups: [
    { id: "g-taps", stepId: "dispense", label: "Tap style", help: "Fitted to every draught tap.", selection: "single", required: true },
    { id: "g-coupler", stepId: "dispense", label: "Keg coupler", help: "Match the keg type your brewery supplies. One coupler per draught line.", selection: "single", required: true },
    { id: "g-other-dispense", stepId: "dispense", label: "Soft drinks, water and hot drinks equipment", help: "Added automatically for non-draught products.", selection: "multiple", required: false },
    { id: "g-font", stepId: "font", label: "Font style", help: "One font per dispense point, sized to its number of draught taps.", selection: "single", required: true },
    { id: "g-badge", stepId: "font", label: "Badge holder", help: "Carries your brand badge on each tap.", selection: "single", required: false },
    { id: "g-remote-cooler", stepId: "cooling", label: "Remote cooler", help: "Cools product and coolant in the cellar.", selection: "single", required: true },
    { id: "g-python", stepId: "cooling", label: "Python", help: "Insulated loom from the cellar to the bar, priced per metre.", selection: "single", required: true },
    { id: "g-point-cooling", stepId: "cooling", label: "Cooling at the point of dispense", help: "Keeps the last metres of line cold.", selection: "single", required: false },
    { id: "g-coolant", stepId: "cooling", label: "Coolant", help: null, selection: "single", required: false },
    { id: "g-gas", stepId: "gas", label: "Gas supply", help: "Ales and stouts are normally served on mixed gas.", selection: "single", required: true },
    { id: "g-secondary", stepId: "gas", label: "Secondary regulators", help: "Sets the pressure for each product line.", selection: "single", required: false },
    { id: "g-gas-storage", stepId: "gas", label: "Cylinder storage", help: "Cylinders must be secured upright.", selection: "single", required: true },
    { id: "g-drip", stepId: "ancillaries", label: "Drip tray", help: "One per dispense point, sized to the font.", selection: "single", required: false },
    { id: "g-cleaning", stepId: "ancillaries", label: "Line cleaning kit", help: "Matched to your keg coupler.", selection: "single", required: false },
    { id: "g-fob", stepId: "ancillaries", label: "Fob control", help: null, selection: "single", required: false },
  ],
  options: [
    // ---------- Dispense: taps ----------
    { id: "o-tap-fc4-chrome", groupId: "g-taps", label: "FC4 chrome", description: "Brass-bodied chrome tap for lager and cider.", image: "/products/fc4-tap-chrome-lager-1-2-x35x3-16jg.jpg", lines: [{ productId: p("fc4-tap-chrome-lager-1-2-x35x3-16jg"), basis: "per-draught-tap", quantity: 1 }, { productId: p("black-plastic-handle-for-fc4-tap-3-8"), basis: "per-draught-tap", quantity: 1 }], compatibility: {}, incompatibleReason: null },
    { id: "o-tap-fc4-gold", groupId: "g-taps", label: "FC4 gold", description: "FC4 tap in a gold finish.", image: "/products/fc4-tap-gold-lager-1-2-x35x3-16jg.jpg", lines: [{ productId: p("fc4-tap-gold-lager-1-2-x35x3-16jg"), basis: "per-draught-tap", quantity: 1 }, { productId: p("black-plastic-handle-for-fc4-tap-3-8"), basis: "per-draught-tap", quantity: 1 }], compatibility: {}, incompatibleReason: null },
    { id: "o-tap-celtic-chrome", groupId: "g-taps", label: "Celtic chrome", description: "Traditional Celtic tap in chrome.", image: "/products/celtic-tap-chrome-lager-1-2-x14x3-16jg.jpg", lines: [{ productId: p("celtic-tap-chrome-lager-1-2-x14x3-16jg"), basis: "per-draught-tap", quantity: 1 }, { productId: p("black-plastic-handle-for-celtic-tap"), basis: "per-draught-tap", quantity: 1 }], compatibility: {}, incompatibleReason: null },
    { id: "o-tap-aceline-steel", groupId: "g-taps", label: "Aceline stainless steel", description: "Stainless steel Aceline tap with aluminium handle.", image: "/products/st-st-aceline-tap-lager-1-2-x20x3-16jg.jpg", lines: [{ productId: p("st-st-aceline-tap-lager-1-2-x20x3-16jg"), basis: "per-draught-tap", quantity: 1 }, { productId: p("aluminium-handle-for-aceline-tap-3-8"), basis: "per-draught-tap", quantity: 1 }], compatibility: {}, incompatibleReason: null },
    { id: "o-tap-compensator", groupId: "g-taps", label: "Stainless steel compensator", description: "Flow-adjustable compensator tap for lively continental lagers.", image: null, lines: [{ productId: p("stainless-steel-comapensator-tap-1-2-47-jg5-16"), basis: "per-draught-tap", quantity: 1 }], compatibility: { excludesBeverages: ["beer"] }, incompatibleReason: "Compensator taps suit lager and cider lines only" },

    // ---------- Dispense: couplers ----------
    ...([
      ["s", "S type (Sankey)", "s-type-keg-coupler-c-w-jg-fittings-nrv-sankey"],
      ["a", "A type", "a-type-keg-coupler-c-w-jg-fittings-nrv-73865"],
      ["d", "D type", "d-type-keg-coupler-c-w-jg-fittings-nrv"],
      ["g", "G type (Grundy)", "g-type-keg-coupler-c-w-jg-fittings-nrv-grundy"],
      ["u", "U type", "u-type-keg-coupler-c-w-jg-fittings-nrv"],
      ["keykeg", "KeyKeg", "keykeg-coupler-c-w-jg-fittings"],
    ] as const).map(([key, label, slug]) => ({
      id: `o-coupler-${key}`,
      groupId: "g-coupler",
      label,
      description: `${label} keg coupler with John Guest fittings.`,
      image: null,
      lines: [{ productId: p(slug), basis: "per-draught-tap" as const, quantity: 1 }],
      compatibility: {},
      incompatibleReason: null,
    })),

    // ---------- Dispense: non-draught ----------
    { id: "o-postmix", groupId: "g-other-dispense", label: "Adria post-mix tower", description: "Soft drinks tower with an illuminated branding panel.", image: "/products/adria-tower.jpg", lines: [{ productId: p("adria-tower"), basis: "fixed", quantity: 1 }], compatibility: { beverages: ["soft"] }, incompatibleReason: "Add a soft drinks tap to include post-mix" },
    { id: "o-soda-water", groupId: "g-other-dispense", label: "Soda Pygmy water machine", description: "Chilled still and sparkling water from mains supply. Needs its own regulator; Brewfitt confirms which when quoting.", image: "/products/soda-water-machine-soda-pygmy-2-tap.jpg", lines: [{ productId: p("soda-water-machine-soda-pygmy-2-tap"), basis: "fixed", quantity: 1 }], compatibility: { beverages: ["water"] }, incompatibleReason: "Add a water tap to include water dispense" },
    { id: "o-hot-drinks", groupId: "g-other-dispense", label: "Ciocab hot drinks dispenser", description: "Countertop hot drinks dispenser.", image: "/products/ciocab.png", lines: [{ productId: p("ciocab"), basis: "fixed", quantity: 1 }], compatibility: { beverages: ["coffee"] }, incompatibleReason: "Add a coffee point to include hot drinks" },

    // ---------- Font ----------
    { id: "o-font-cobra-pl-led", groupId: "g-font", label: "Cobra PL chrome with LED", description: "Chrome Cobra with LED badge holder, clamp, drip tray and carrier. 1 or 2 taps per point.", image: "/products/cobra-2-out-chrome-led.jpg", lines: [{ productIdByDraughtTaps: fontBySize({ 1: "cobra-1-out-chrome-led", 2: "cobra-2-out-chrome-led" }), basis: "per-point", quantity: 1 }], compatibility: { maxDraughtTapsPerPoint: 2, venueTypes: [...FIXED_VENUES] }, incompatibleReason: null },
    { id: "o-font-cobra-pl", groupId: "g-font", label: "Cobra PL chrome", description: "Chrome Cobra without lighting. 1 or 2 taps per point.", image: "/products/cobra-1-out-chrome-non-led.jpg", lines: [{ productIdByDraughtTaps: fontBySize({ 1: "cobra-1-out-chrome-non-led", 2: "cobra-2-out-chrome-non-led" }), basis: "per-point", quantity: 1 }], compatibility: { maxDraughtTapsPerPoint: 2, venueTypes: [...FIXED_VENUES] }, incompatibleReason: null },
    { id: "o-font-cobra-b-led", groupId: "g-font", label: "Cobra B chrome with LED", description: "Larger chrome Cobra with LED lighting for 3 or 4 taps per point.", image: "/products/cobra-3-out-chrome-led.jpg", lines: [{ productIdByDraughtTaps: fontBySize({ 3: "cobra-3-out-chrome-led", 4: "cobra-4-out-chrome-led" }), basis: "per-point", quantity: 1 }], compatibility: { minDraughtTapsPerPoint: 3, maxDraughtTapsPerPoint: 4, venueTypes: [...FIXED_VENUES] }, incompatibleReason: null },
    { id: "o-font-classic-cobra", groupId: "g-font", label: "Classic Cobra with LED", description: "Classic Cobra profile with LED, 1 to 3 taps per point.", image: "/products/classic-cobra-2-out-led.jpg", lines: [{ productIdByDraughtTaps: fontBySize({ 1: "classic-cobra-1-out-led", 2: "classic-cobra-2-out-led", 3: "classic-cobra-3-out-led" }), basis: "per-point", quantity: 1 }], compatibility: { maxDraughtTapsPerPoint: 3, venueTypes: [...FIXED_VENUES] }, incompatibleReason: null },
    { id: "o-font-event", groupId: "g-font", label: "Event tower", description: "Freestanding tower for events and mobile bars, 1 to 3 taps.", image: "/products/event-tower.png", lines: [{ productIdByDraughtTaps: fontBySize({ 1: "event-tower-1", 2: "event-tower", 3: "event-tower-3-out" }), basis: "per-point", quantity: 1 }], compatibility: { maxDraughtTapsPerPoint: 3, venueTypes: ["event", "stadium"] }, incompatibleReason: "Event towers are for event and stadium venues" },
    { id: "o-badge-standard-chrome", groupId: "g-badge", label: "Standard chrome badge holder", description: "One per draught tap.", image: null, lines: [{ productId: p("standard-chrome-badge-holder"), basis: "per-draught-tap", quantity: 1 }], compatibility: { requiresAnyOptionIds: ["o-tap-fc4-chrome", "o-tap-celtic-chrome", "o-tap-aceline-steel", "o-tap-compensator"] }, incompatibleReason: "Chrome badge holders match chrome and steel taps" },
    { id: "o-badge-standard-gold", groupId: "g-badge", label: "Standard gold badge holder", description: "One per draught tap.", image: null, lines: [{ productId: p("standard-gold-round-badge-holder"), basis: "per-draught-tap", quantity: 1 }], compatibility: { requiresAnyOptionIds: ["o-tap-fc4-gold"] }, incompatibleReason: "Gold badge holders match gold taps" },
    { id: "o-badge-extended-chrome", groupId: "g-badge", label: "Extended chrome badge holder", description: "Covers the longer backshaft on FC4 taps.", image: null, lines: [{ productId: p("extended-chrome-round-badge-holder"), basis: "per-draught-tap", quantity: 1 }], compatibility: { requiresAnyOptionIds: ["o-tap-fc4-chrome"] }, incompatibleReason: "Extended holders are for FC4 chrome taps" },

    // ---------- Cooling ----------
    { id: "o-cooler-v15", groupId: "g-remote-cooler", label: "Vision V15 mini remote cooler", description: "Compact remote cooler for smaller cellars.", image: "/products/vision-v15-mini-remote-cooler.jpg", lines: [{ productId: p("vision-v15-mini-remote-cooler"), basis: "fixed", quantity: 1 }], compatibility: { maxTotalDraughtTaps: 6, venueTypes: [...FIXED_VENUES] }, incompatibleReason: "The V15 is sized for up to 6 draught taps in this draft" },
    { id: "o-cooler-v21", groupId: "g-remote-cooler", label: "Vision V21 integral remote cooler", description: "Cellar remote cooler engineered for whole-life cost.", image: "/products/v21-integral-cooler.jpg", lines: [{ productId: p("v21-integral-cooler"), basis: "fixed", quantity: 1 }, { productId: p("energy-saviour-plug"), basis: "fixed", quantity: 1 }], compatibility: { minTotalDraughtTaps: 4, maxTotalDraughtTaps: 16, venueTypes: [...FIXED_VENUES] }, incompatibleReason: "The V21 is sized for 4 to 16 draught taps in this draft" },
    { id: "o-cooler-v21-water", groupId: "g-remote-cooler", label: "Vision V21 water-cooled remote cooler", description: "Water-cooled V21 for hot or enclosed cellars.", image: "/products/v21-water-cooled-cooler.jpg", lines: [{ productId: p("v21-water-cooled-cooler"), basis: "fixed", quantity: 1 }], compatibility: { minTotalDraughtTaps: 8, venueTypes: [...FIXED_VENUES] }, incompatibleReason: "The water-cooled V21 is for 8 or more draught taps in this draft" },
    { id: "o-cooler-lindr-as200", groupId: "g-remote-cooler", label: "Lindr AS-200 ice bank cooler", description: "Undercounter ice bank cooler; the pump allows it to sit in the cellar.", image: "/products/lindr-as-200-8x-coils.jpg", lines: [{ productId: p("lindr-as-200-8x-coils"), basis: "fixed", quantity: 1 }, { productId: p("lindr-to-tower-connection-kit"), basis: "per-point", quantity: 1 }], compatibility: { maxTotalDraughtTaps: 8, venueTypes: ["bar", "restaurant", "brewery-taproom"] }, incompatibleReason: "The AS-200 serves up to 8 lines in bars, restaurants and taprooms" },
    { id: "o-cooler-kontakt-70k", groupId: "g-remote-cooler", label: "Lindr Kontakt 70K mobile cooler", description: "Portable dry-block cooler with 2 taps per unit, one unit per dispense point.", image: "/products/lindr-kontakt-70k-2-taps.jpg", lines: [{ productId: p("lindr-kontakt-70k-2-taps"), basis: "per-point", quantity: 1 }], compatibility: { venueTypes: ["event"], maxDraughtTapsPerPoint: 2 }, incompatibleReason: "Kontakt coolers are for events with up to 2 taps per point" },
    ...([
      [2, "python-loom-2-line"],
      [4, "python-loom-4-line"],
      [6, "python-loom-6-line"],
      [8, "python-loom-8-line"],
      [12, "python-loom-12-line"],
    ] as const).map(([lines, slug], i, all) => ({
      id: `o-python-${lines}`,
      groupId: "g-python",
      label: `${lines} line python`,
      description: `Carries up to ${lines} product lines. Priced per metre of run.`,
      image: "/products/2-line-mini-python-loom-secondary-cooling-2-5mtr.png",
      lines: [{ productId: p(slug), basis: "per-metre" as const, quantity: 1 }],
      compatibility: {
        maxTotalDraughtTaps: lines,
        minTotalDraughtTaps: i === 0 ? 1 : all[i - 1]![0] + 1,
        venueTypes: [...FIXED_VENUES],
        // Under-counter and mobile coolers sit at the bar and need no python.
        requiresAnyOptionIds: ["o-cooler-v15", "o-cooler-v21", "o-cooler-v21-water"],
      },
      incompatibleReason: `A ${lines} line python suits ${i === 0 ? 1 : all[i - 1]![0] + 1} to ${lines} draught taps`,
    })),
    { id: "o-cooltube-pancake", groupId: "g-point-cooling", label: "CoolTube Pancake 4 way", description: "Compact heat exchanger at each font, running off the python recirculation.", image: "/products/cooltube-4-way-15-line-pancake.jpg", lines: [{ productId: p("cooltube-4-way-15-line-pancake"), basis: "per-point", quantity: 1 }], compatibility: { maxDraughtTapsPerPoint: 4, requiresAnyOptionIds: ["o-cooler-v15", "o-cooler-v21", "o-cooler-v21-water"] }, incompatibleReason: "CoolTube needs a remote cooler with a python" },
    { id: "o-cooltube-single", groupId: "g-point-cooling", label: "CoolTube single per line", description: "One CoolTube on each draught line for variable dispense temperature.", image: "/products/cooltube-single-10-line-c-w-pu-insulation-fittings.jpg", lines: [{ productId: p("cooltube-single-10-line-c-w-pu-insulation-fittings"), basis: "per-draught-tap", quantity: 1 }], compatibility: { requiresAnyOptionIds: ["o-cooler-v15", "o-cooler-v21", "o-cooler-v21-water"] }, incompatibleReason: "CoolTube needs a remote cooler with a python" },
    { id: "o-coolant-dtx-premix", groupId: "g-coolant", label: "Coolflow DTX 28% pre-mix, 25 litres", description: "Ready-mixed coolant for remote coolers.", image: null, lines: [{ productId: p("coolflow-dtx-28-pre-mix-25-litres"), basis: "fixed", quantity: 1 }], compatibility: { requiresAnyOptionIds: ["o-cooler-v15", "o-cooler-v21", "o-cooler-v21-water"] }, incompatibleReason: "Coolant is for remote coolers" },
    { id: "o-coolant-4flow", groupId: "g-coolant", label: "4FLOW+ specialist coolant, 25 litres", description: "Specialist coolant for remote cooling systems.", image: null, lines: [{ productId: p("4flow-specialist-coolant-25-litres"), basis: "fixed", quantity: 1 }], compatibility: { requiresAnyOptionIds: ["o-cooler-v15", "o-cooler-v21", "o-cooler-v21-water"] }, incompatibleReason: "Coolant is for remote coolers" },

    // ---------- Gas ----------
    { id: "o-gas-co2", groupId: "g-gas", label: "CO2 only", description: "Wall-mounted primary CO2 regulator.", image: null, lines: [{ productId: p("primary-co2-regulator-wall-mounted-3-8-45-psi-c-w-twin-gauge-jg-fittings-grey-hose"), basis: "fixed", quantity: 1 }], compatibility: { excludesBeverages: ["beer"] }, incompatibleReason: "Beer lines are served on mixed gas; choose mixed gas or CO2 and mixed gas" },
    { id: "o-gas-mixed", groupId: "g-gas", label: "Mixed gas only", description: "Wall-mounted primary mixed gas regulator.", image: null, lines: [{ productId: p("primary-mixed-gas-regulator-wall-mounted-3-8-55psi-c-w-twin-gauge-jg-fittings-twin-gauge"), basis: "fixed", quantity: 1 }], compatibility: { excludesBeverages: ["lager", "cider"] }, incompatibleReason: "Lager and cider lines need CO2; choose CO2 and mixed gas" },
    { id: "o-gas-both", groupId: "g-gas", label: "CO2 and mixed gas", description: "Primary CO2 and mixed gas regulators for venues pouring both.", image: null, lines: [{ productId: p("primary-co2-regulator-wall-mounted-3-8-45-psi-c-w-twin-gauge-jg-fittings-grey-hose"), basis: "fixed", quantity: 1 }, { productId: p("primary-mixed-gas-regulator-wall-mounted-3-8-55psi-c-w-twin-gauge-jg-fittings-twin-gauge"), basis: "fixed", quantity: 1 }], compatibility: { beverages: ["beer"] }, incompatibleReason: "Only needed when beer is poured alongside lager or cider" },
    { id: "o-gas-secondary", groupId: "g-secondary", label: "Secondary regulator per draught line", description: "Shut-off valve, wall bracket and gauge on every line.", image: null, lines: [{ productId: p("secondary-regulator-c-w-shut-off-valve-wall-bracket-jg-fittings-gauge"), basis: "per-draught-tap", quantity: 1 }], compatibility: { minTotalDraughtTaps: 2 }, incompatibleReason: "Secondary regulators are for systems with 2 or more lines" },
    { id: "o-gas-chain", groupId: "g-gas-storage", label: "Twin bottle holder with gas chain", description: "Secures two cylinders upright.", image: null, lines: [{ productId: p("twin-gas-bottle-holder-with-gas-chain"), basis: "fixed", quantity: 1 }], compatibility: { venueTypes: [...FIXED_VENUES] }, incompatibleReason: "Fixed installs only" },

    // ---------- Ancillaries ----------
    { id: "o-drip-standard", groupId: "g-drip", label: "Stainless steel drip tray", description: "Surface-mounted, sized to each font.", image: "/products/st-st-drip-tray-50x22x3.jpg", lines: [{ productIdByDraughtTaps: DRIP.standard, basis: "per-point", quantity: 1 }], compatibility: {}, incompatibleReason: null },
    { id: "o-drip-freshener", groupId: "g-drip", label: "Drip tray with glass freshener", description: "Surface-mounted tray with glass freshener and drain, plus a mains water connection kit.", image: "/products/st-st-drip-tray-50x22x3-c-w-glass-freshener-drain.jpg", lines: [{ productIdByDraughtTaps: DRIP.freshener, basis: "per-point", quantity: 1 }, { productId: p("glass-freshener-connection-kit-water"), basis: "per-point", quantity: 1 }], compatibility: { minDraughtTapsPerPoint: 2 }, incompatibleReason: "Glass freshener trays start at 2 taps per point" },
    { id: "o-drip-recessed", groupId: "g-drip", label: "Recessed drip tray", description: "Set into the bar top with a drain.", image: "/products/st-st-recessed-drip-tray-50x22x3-c-w-drain.jpg", lines: [{ productIdByDraughtTaps: DRIP.recessed, basis: "per-point", quantity: 1 }], compatibility: { venueTypes: [...FIXED_VENUES] }, incompatibleReason: "Recessed trays need a fixed bar" },
    ...([
      ["s", "S type", "s-type-cleaning-bottle", "s-type-cleaning-socket-c-w-jg-fittings-3-8"],
      ["a", "A type", "a-type-cleaning-bottle", "a-type-cleaning-socket-c-w-jg-fittings-3-8"],
      ["g", "G type", "g-type-cleaning-bottle", "g-type-cleaning-socket-c-w-jg-fittings-3-8"],
      ["u", "U type", "u-type-cleaning-bottle", "u-type-cleaning-socket-c-w-jg-fittings-3-8"],
      ["keykeg", "KeyKeg", "key-keg-cleaning-bottle", "keykeg-cleaning-socket-c-w-jg-fittings-3-8"],
    ] as const).map(([key, label, bottle, socket]) => ({
      id: `o-clean-${key}`,
      groupId: "g-cleaning",
      label: `${label} line cleaning kit`,
      description: "5 litre cleaning bottle, a cleaning socket per line and Pipeline Purple cleaning powder.",
      image: null,
      lines: [
        { productId: p(bottle), basis: "fixed" as const, quantity: 1 },
        { productId: p(socket), basis: "per-draught-tap" as const, quantity: 1 },
        { productId: p("pipeline-purple-beer-line-cleaning-powder"), basis: "fixed" as const, quantity: 1 },
      ],
      compatibility: { requiresOptionIds: [`o-coupler-${key}`] },
      incompatibleReason: `Matches ${label} couplers only`,
    })),
    { id: "o-fob-stop", groupId: "g-fob", label: "Foam Stop on every draught line", description: "Fits to the keg coupler to reduce beer lost as a keg empties.", image: "/products/beer-foam-fob-stop-1-2g-x-1-2bsp.png", lines: [{ productId: p("beer-foam-fob-stop-1-2g-x-1-2bsp"), basis: "per-draught-tap", quantity: 1 }], compatibility: { excludesOptionIds: ["o-coupler-keykeg"] }, incompatibleReason: "Not used with KeyKeg couplers in this draft" },
  ],
  limits: { minPoints: 1, maxPoints: 8, maxTapsPerPoint: 6, minPythonMetres: 3, maxPythonMetres: 60 },
  defaults: { venueType: "pub", points: 2, beveragesPerPoint: ["lager", "cider"], pythonMetres: 15, optionIds: ["o-tap-fc4-chrome", "o-coupler-s", "o-gas-chain"] },
};

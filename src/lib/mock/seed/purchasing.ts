import type {
  Delivery,
  Offer,
  Product,
  PurchaseOrder,
  Rfq,
  SalesOrder,
  StockPosition,
  SupplierProduct,
  SupplierQuote,
} from "@/types";
import { addDays, daysBetween, isoDate, isoDateTime } from "../clock";
import { money, previousWorkingDay, workingDay, type SeedContext } from "./context";

const slugId = (slug: string) => `prd_${slug}`;

/** Purchase orders per supplier over the last 12 months. */
const PO_COUNTS: Record<string, number> = {
  sup_vireo: 7,
  sup_tapmobile: 4,
  sup_brightbar: 4,
  sup_clearflow: 4,
  sup_glacier: 2,
  sup_northgas: 2,
  sup_couplingworks: 2,
  sup_polarflex: 2,
  sup_chillcase: 1,
  sup_aquapure: 1,
  sup_emerald: 1,
};

/** Suppliers on a self-billing agreement: Brewfitt raises the invoice. */
export const SELF_BILLING_SUPPLIERS = new Set(["sup_vireo", "sup_glacier", "sup_brightbar"]);

export type PurchasingSeed = {
  purchaseOrders: PurchaseOrder[];
  inboundDeliveries: Delivery[];
  rfqs: Rfq[];
  supplierQuotes: SupplierQuote[];
  supplierProducts: SupplierProduct[];
  offers: Offer[];
  stock: StockPosition[];
};

export function seedPurchasing(
  ctx: SeedContext,
  commerce: { salesOrders: SalesOrder[]; deliveries: Delivery[]; rolloutOrderId: string },
): PurchasingSeed {
  const { rng, today, products } = ctx;
  const suppliers = ctx.accounts.filter((a) => a.kind === "supplier");
  const costFor = (supplierId: string, productId: string) => {
    const s = ctx.account(supplierId);
    const line = ctx.priceListLines.find(
      (l) => l.priceListId === s.priceListId && l.productId === productId,
    );
    if (!line) throw new Error(`No cost price for ${productId} from ${supplierId}`);
    return line.price;
  };

  // How much of each product customers bought, to shape replenishment.
  const sold = new Map<string, number>();
  for (const o of commerce.salesOrders)
    for (const l of o.lines) sold.set(l.productId, (sold.get(l.productId) ?? 0) + l.qty);

  const purchaseOrders: PurchaseOrder[] = [];
  const makePo = (
    supplierId: string,
    created: Date,
    lines: { productId: string; qty: number }[],
  ): PurchaseOrder => {
    const priced = lines.map((l) => ({
      ...l,
      received: 0,
      price: costFor(supplierId, l.productId),
    }));
    const net = priced.reduce((s, l) => s + l.qty * l.price.amount, 0);
    const lead = Math.max(...priced.map((l) => ctx.productById.get(l.productId)!.leadTimeDays), 3);
    const po: PurchaseOrder = {
      id: `po_${purchaseOrders.length + 1}`,
      supplierId,
      number: "",
      status: "issued",
      lines: priced,
      expectedDate: isoDate(workingDay(addDays(created, lead + rng.int(0, 3)))),
      total: money(net * (ctx.vatRate(supplierId) ? 1.2 : 1)),
      threadId: "",
      createdAt: isoDateTime(
        previousWorkingDay(created),
        rng.int(9, 15),
        rng.pick([0, 15, 30, 45]),
      ),
    };
    purchaseOrders.push(po);
    return po;
  };

  for (const supplier of suppliers) {
    const range = products.filter((p) => p.supplierId === supplier.id);
    const ranked = [...range].sort((a, b) => (sold.get(b.id) ?? 0) - (sold.get(a.id) ?? 0));
    const count = PO_COUNTS[supplier.id] ?? 1;
    for (let i = 0; i < count; i++) {
      // Spread through the year, with the most recent PO for busy suppliers still open.
      const created =
        i === count - 1 && count >= 4 ? addDays(today, -rng.int(2, 9)) : ctx.seasonalDate(360, 25);
      const picks = rng.sample(
        ranked.slice(0, Math.max(4, Math.ceil(ranked.length / 3))),
        Math.min(ranked.length, rng.int(2, 5)),
      );
      makePo(
        supplier.id,
        created,
        picks.map((p) => ({
          productId: p.id,
          qty: Math.max(
            ctx.roleOf(p) === "project" ? rng.int(2, 8) : rng.int(10, 40),
            Math.ceil((sold.get(p.id) ?? 0) / 4),
          ),
        })),
      );
    }
  }

  // Replenishment of the Premium Lager back-ordered fonts.
  makePo("sup_vireo", addDays(today, -6), [
    { productId: slugId("cobra-4-out-chrome-led"), qty: 6 },
    { productId: slugId("cobra-3-out-chrome-led"), qty: 4 },
  ]).expectedDate = isoDate(workingDay(addDays(today, 9)));
  // A new order Vireo has not yet acknowledged (demonstrates acknowledgement).
  const awaitingAcknowledgement = makePo("sup_vireo", today, [
    { productId: slugId("classic-cobra-3-out-led"), qty: 6 },
    { productId: slugId("celtic-tap-chrome-lager-1-2-x14x3-16jg"), qty: 24 },
  ]);
  // Recently received font and tap orders, so Vireo has invoices awaiting a payment run.
  makePo("sup_vireo", addDays(today, -31), [
    { productId: slugId("classic-cobra-2-out-led"), qty: 8 },
    { productId: slugId("fc4-tap-chrome-lager-1-2-x35x3-16jg"), qty: 60 },
  ]);
  makePo("sup_vireo", addDays(today, -46), [
    { productId: slugId("cobra-2-out-chrome-led"), qty: 10 },
    { productId: slugId("celtic-tap-chrome-lager-1-2-x14x3-16jg"), qty: 40 },
  ]);
  // Cleaning powder is running low and a PO is on the way.
  makePo("sup_clearflow", addDays(today, -3), [
    { productId: slugId("pipeline-purple-beer-line-cleaning-powder"), qty: 60 },
    { productId: slugId("coolflow-dtx-28-pre-mix-25-litres"), qty: 20 },
  ]);

  // ---- Statuses and inbound deliveries --------------------------------------
  purchaseOrders.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const inboundDeliveries: Delivery[] = [];
  for (const po of purchaseOrders) {
    po.number = ctx.number("purchaseOrder");
    const age = daysBetween(po.createdAt, today);
    const expected = new Date(`${po.expectedDate}T00:00:00Z`);
    const toExpected = daysBetween(today, expected);
    const exporter = ctx.vatRate(po.supplierId) === 0;
    const carrier = exporter ? "DSV Road" : rng.pick(["Supplier transport", "Palletline", "DPD"]);
    const inbound = (
      lines: { productId: string; qty: number }[],
      dispatched: Date,
      delivered: Date | null,
    ) =>
      inboundDeliveries.push({
        id: `del_in_${inboundDeliveries.length + 1}`,
        orderId: po.id,
        orderType: "purchase",
        number: ctx.number("delivery"),
        status: delivered ? "delivered" : "in-transit",
        carrier,
        trackingRef:
          carrier === "Supplier transport"
            ? null
            : `${carrier.slice(0, 3).toUpperCase()}${rng.int(10_000_000, 99_999_999)}`,
        dispatchedAt: isoDateTime(dispatched, 8),
        deliveredAt: delivered ? isoDateTime(delivered, rng.int(9, 14)) : null,
        lines,
        noteDocumentId: null,
        proofDocumentId: null,
      });

    if (age <= 1 || po === awaitingAcknowledgement) {
      po.status = "issued";
    } else if (toExpected > 3) {
      po.status = "acknowledged";
    } else if (toExpected >= 0) {
      po.status = "in-transit";
      inbound(
        po.lines.map((l) => ({ productId: l.productId, qty: l.qty })),
        workingDay(addDays(expected, -2)),
        null,
      );
    } else if (age < 40 && po.lines.length > 2 && rng.chance(0.5)) {
      po.status = "part-received";
      po.lines = po.lines.map((l, i) =>
        i === 0 ? { ...l, received: Math.floor(l.qty / 2) } : { ...l, received: l.qty },
      );
      inbound(
        po.lines.map((l) => ({ productId: l.productId, qty: l.received })).filter((l) => l.qty > 0),
        workingDay(addDays(expected, -2)),
        expected,
      );
    } else {
      po.status = "received";
      po.lines = po.lines.map((l) => ({ ...l, received: l.qty }));
      inbound(
        po.lines.map((l) => ({ productId: l.productId, qty: l.qty })),
        workingDay(addDays(expected, -2)),
        expected,
      );
    }
  }

  // ---- Stock positions ------------------------------------------------------
  const onOrder = new Map<string, { qty: number; expected: string }>();
  for (const po of purchaseOrders) {
    if (po.status === "received") continue;
    for (const l of po.lines) {
      const outstanding = l.qty - l.received;
      if (outstanding <= 0) continue;
      const e = onOrder.get(l.productId);
      onOrder.set(l.productId, {
        qty: (e?.qty ?? 0) + outstanding,
        expected: e && e.expected < po.expectedDate ? e.expected : po.expectedDate,
      });
    }
  }
  const allocated = new Map<string, number>();
  for (const o of commerce.salesOrders) {
    if (o.status === "confirmed" || o.status === "picking" || o.status === "part-delivered") {
      for (const l of o.lines) {
        const open = o.status === "part-delivered" ? l.backordered : l.qty - l.delivered;
        if (open > 0) allocated.set(l.productId, (allocated.get(l.productId) ?? 0) + open);
      }
    }
  }

  /** Stock deliberately below minimum so stock-out insights have real conditions behind them. */
  const forced: Record<string, { onHand: number; minimumLevel: number }> = {
    [slugId("cobra-4-out-chrome-led")]: { onHand: 0, minimumLevel: 2 },
    [slugId("pipeline-purple-beer-line-cleaning-powder")]: { onHand: 9, minimumLevel: 30 },
    [slugId("s-type-keg-coupler-c-w-jg-fittings-nrv-sankey")]: { onHand: 5, minimumLevel: 12 },
    [slugId("fc4-tap-chrome-lager-1-2-x35x3-16jg")]: { onHand: 7, minimumLevel: 15 },
    [slugId("lindr-kontakt-70k-2-taps")]: { onHand: 1, minimumLevel: 2 },
  };

  const stock: StockPosition[] = products.map((p: Product) => {
    const role = ctx.roleOf(p);
    const minimumLevel =
      forced[p.id]?.minimumLevel ??
      (role === "consumable"
        ? rng.int(15, 30)
        : role === "spare"
          ? rng.int(4, 12)
          : p.listPrice.amount > 150_000
            ? 1
            : 2);
    const alloc = allocated.get(p.id) ?? 0;
    const order = onOrder.get(p.id);
    let onHand = forced[p.id]?.onHand;
    if (onHand === undefined) {
      const roll = rng.next();
      // A few items are out or low; most are comfortably stocked.
      onHand =
        roll < 0.015
          ? 0
          : roll < 0.04
            ? Math.max(0, minimumLevel - rng.int(1, 3))
            : minimumLevel +
              rng.int(
                role === "project" ? 0 : 5,
                role === "consumable" ? 120 : role === "spare" ? 50 : 8,
              );
      onHand = Math.max(onHand, alloc);
    }
    const available = onHand - alloc;
    const status: StockPosition["status"] =
      available <= 0
        ? order
          ? "on-order"
          : "out"
        : onHand < minimumLevel
          ? order
            ? "on-order"
            : "low"
          : "in-stock";
    return {
      productId: p.id,
      onHand,
      allocated: alloc,
      available,
      onOrder: order?.qty ?? 0,
      expectedAt: order?.expected ?? null,
      minimumLevel,
      status,
    };
  });

  // ---- RFQs and supplier quotes --------------------------------------------
  const rfqs: Rfq[] = [];
  const supplierQuotes: SupplierQuote[] = [];
  const rfqPlan: [string, Rfq["status"]][] = [
    ["sup_vireo", "open"],
    ["sup_vireo", "open"],
    ["sup_vireo", "responded"],
    ["sup_vireo", "awarded"],
    ["sup_tapmobile", "open"],
    ["sup_tapmobile", "not-awarded"],
    ["sup_brightbar", "open"],
    ["sup_brightbar", "awarded"],
    ["sup_clearflow", "responded"],
    ["sup_glacier", "open"],
    ["sup_polarflex", "closed"],
  ];
  const rfqNotes = [
    "Pricing for a brand owner's venue rollout in the new year; please quote your best price at these volumes.",
    "Replacement stock for the spring peak. Please confirm lead time from order.",
    "Split delivery to Huddersfield is acceptable if the full quantity cannot ship together.",
    null,
  ];
  rfqPlan.forEach(([supplierId, status], i) => {
    const created =
      status === "open" ? addDays(today, -rng.int(1, 6)) : addDays(today, -rng.int(20, 150));
    const range = products.filter((p) => p.supplierId === supplierId);
    const lines = rng.sample(range, Math.min(range.length, rng.int(1, 4))).map((p) => ({
      productId: p.id,
      qty: ctx.roleOf(p) === "project" ? rng.int(4, 24) : rng.int(20, 120),
      requiredBy: isoDate(workingDay(addDays(created, rng.int(25, 60)))),
    }));
    const rfq: Rfq = {
      id: `rfq_${i + 1}`,
      supplierId,
      number: "",
      lines,
      deadline: isoDate(workingDay(addDays(created, rng.int(7, 12)))),
      status,
      notes: rng.pick(rfqNotes),
      threadId: "",
      createdAt: isoDateTime(previousWorkingDay(created), 10, 30),
    };
    rfqs.push(rfq);
    if (status !== "open" && status !== "closed") {
      supplierQuotes.push({
        id: `sq_${supplierQuotes.length + 1}`,
        rfqId: rfq.id,
        lines: lines.map((l) => ({
          productId: l.productId,
          price: money(costFor(supplierId, l.productId).amount * (0.92 + rng.next() * 0.1)),
          leadTimeDays: ctx.productById.get(l.productId)!.leadTimeDays + rng.int(0, 7),
        })),
        notes: rng.pick([
          "Prices held for 60 days.",
          "Includes delivery to Huddersfield.",
          "Volume price applies if called off in two drops.",
          null,
        ]),
        submittedAt: isoDateTime(addDays(created, rng.int(2, 6)), 14),
      });
    }
  });
  rfqs
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .forEach((r) => (r.number = ctx.number("rfq")));

  // ---- Supplier product submissions ----------------------------------------
  const submissionPlan: {
    supplierId: string;
    slug: string | null;
    name: string;
    status: SupplierProduct["status"];
    note: string | null;
    ageDays: number;
  }[] = [
    {
      supplierId: "sup_vireo",
      slug: "classic-cobra-2-out-led",
      name: "Classic Cobra 2 Out LED",
      status: "approved",
      note: "Approved with spec sheet. Now live in TOTA360v5.",
      ageDays: 64,
    },
    {
      supplierId: "sup_vireo",
      slug: "cobra-4-out-chrome-led",
      name: "Cobra B 4 Out Chrome LED",
      status: "approved",
      note: "Spec sheet and images approved.",
      ageDays: 38,
    },
    {
      supplierId: "sup_vireo",
      slug: null,
      name: "Cobra B 5 Out Chrome LED",
      status: "under-review",
      note: null,
      ageDays: 6,
    },
    {
      supplierId: "sup_vireo",
      slug: null,
      name: "Matt Black FC4 Tap (Lager)",
      status: "submitted",
      note: null,
      ageDays: 2,
    },
    {
      supplierId: "sup_vireo",
      slug: null,
      name: "Brushed Brass Badge Holder",
      status: "rejected",
      note: "Images are renders only; please resubmit with photographs of the finished product and a spec sheet.",
      ageDays: 45,
    },
    {
      supplierId: "sup_brightbar",
      slug: "st-st-drip-tray-50x22x3-c-w-glass-freshener-drain",
      name: "St/St Drip Tray 50x22x3 C/W Glass Freshener & Drain",
      status: "approved",
      note: "Approved; spec sheet attached to the catalogue item.",
      ageDays: 90,
    },
    {
      supplierId: "sup_brightbar",
      slug: null,
      name: "Slimline LED Board 600mm",
      status: "under-review",
      note: null,
      ageDays: 9,
    },
    {
      supplierId: "sup_tapmobile",
      slug: "lindr-kontakt-70k-2-taps",
      name: "Lindr Kontakt 70K (2 Taps)",
      status: "approved",
      note: "Spec sheet approved.",
      ageDays: 120,
    },
    {
      supplierId: "sup_tapmobile",
      slug: null,
      name: "Lindr Kontakt 40K Green Line (2 Taps)",
      status: "submitted",
      note: null,
      ageDays: 4,
    },
    {
      supplierId: "sup_clearflow",
      slug: "pipeline-purple-beer-line-cleaning-powder",
      name: "Pipeline Purple Professional Beer Line Cleaning Powder (10 Sachets)",
      status: "approved",
      note: "Safety data and spec sheet approved.",
      ageDays: 150,
    },
    {
      supplierId: "sup_clearflow",
      slug: null,
      name: "Low-foam Line Cleaner Concentrate (5 Litres)",
      status: "rejected",
      note: "We need the safety data sheet before this can be listed.",
      ageDays: 30,
    },
    {
      supplierId: "sup_northgas",
      slug: null,
      name: "Secondary Mixed Gas Regulator Panel (4 Way)",
      status: "under-review",
      note: null,
      ageDays: 12,
    },
    {
      supplierId: "sup_polarflex",
      slug: null,
      name: "10 Line Python Loom (per metre)",
      status: "submitted",
      note: null,
      ageDays: 3,
    },
    {
      supplierId: "sup_emerald",
      slug: "coldfusion-nitro-infusion-system",
      name: "ColdFusion Nitro infusion system",
      status: "approved",
      note: "Approved.",
      ageDays: 200,
    },
  ];
  const supplierProducts: SupplierProduct[] = submissionPlan.map((s, i) => {
    const product = s.slug ? ctx.productById.get(slugId(s.slug)) : undefined;
    if (s.slug && !product) throw new Error(`Unknown submission product ${s.slug}`);
    const category =
      product?.category ?? rng.pick(products.filter((p) => p.supplierId === s.supplierId)).category;
    const similar = products.filter(
      (p) => p.supplierId === s.supplierId && p.category === category,
    );
    const cost = product
      ? costFor(s.supplierId, product.id)
      : money(rng.pick(similar).listPrice.amount * 0.55);
    const submitted = addDays(today, -s.ageDays);
    return {
      id: `sp_${i + 1}`,
      supplierId: s.supplierId,
      name: s.name,
      sku:
        product?.sku ??
        `${ctx.account(s.supplierId).name.slice(0, 3).toUpperCase()}-${rng.int(1000, 9999)}`,
      category,
      images: product ? product.images : rng.pick(similar).images.slice(0, 1),
      brandingAssets: s.status === "approved" ? [`${s.name} brand guidelines.pdf`] : [],
      specSheetDocumentId: null,
      costPrice: cost,
      leadTimeDays: product?.leadTimeDays ?? rng.int(5, 21),
      minimumOrder: rng.pick([1, 2, 5, 10]),
      status: s.status,
      reviewNote: s.note,
      productId: s.status === "approved" ? (product?.id ?? null) : null,
      threadId: "",
      submittedAt: isoDateTime(submitted, 11),
      updatedAt: isoDateTime(
        addDays(submitted, s.status === "submitted" ? 0 : Math.min(s.ageDays, rng.int(2, 10))),
        15,
      ),
    };
  });

  // ---- Offers ---------------------------------------------------------------
  const offerPlan: [string, Offer["status"], number, number, string][] = [
    [
      "sup_vireo",
      "approved",
      -10,
      40,
      "Spring rollout pricing on Cobra fonts ordered in multiples of six.",
    ],
    [
      "sup_vireo",
      "submitted",
      2,
      60,
      "Introductory price on FC4 chrome taps for orders of 50 or more.",
    ],
    ["sup_vireo", "expired", -120, -60, "Winter clearance on Classic Cobra fonts."],
    ["sup_tapmobile", "approved", -5, 55, "Event season bundle: Kontakt 70K with connection kit."],
    ["sup_tapmobile", "rejected", -30, 10, "Pygmy 25K price reduction for single-unit orders."],
    [
      "sup_brightbar",
      "under-review",
      0,
      45,
      "Recessed drip trays with glass freshener at volume pricing.",
    ],
    ["sup_clearflow", "approved", -20, 25, "Pipeline Purple multi-buy for orders of 20 packs."],
    ["sup_northgas", "submitted", 3, 90, "Primary CO2 and mixed gas regulator pair price."],
  ];
  const offers: Offer[] = offerPlan.map(
    ([supplierId, status, fromDays, toDays, description], i) => {
      const range = products.filter((p) => p.supplierId === supplierId);
      const productIds = rng.sample(range, Math.min(range.length, rng.int(1, 3))).map((p) => p.id);
      const base = costFor(supplierId, productIds[0]!);
      return {
        id: `off_${i + 1}`,
        supplierId,
        productIds,
        description,
        price: money(base.amount * 0.9),
        validFrom: isoDate(addDays(today, fromDays)),
        validTo: isoDate(addDays(today, toDays)),
        status,
        createdAt: isoDateTime(addDays(today, Math.min(fromDays, 0) - rng.int(2, 8)), 12),
      };
    },
  );

  return {
    purchaseOrders,
    inboundDeliveries,
    rfqs,
    supplierQuotes,
    supplierProducts,
    offers,
    stock,
  };
}

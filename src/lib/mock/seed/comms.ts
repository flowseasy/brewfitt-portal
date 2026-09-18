import type {
  Document,
  Payment,
  AIInsight,
  Address,
  BrewfittTeamMember,
  Case,
  ChangeRequest,
  Contact,
  Delivery,
  Invoice,
  Job,
  Message,
  Notification,
  PaymentRun,
  PurchaseOrder,
  Quote,
  Rfq,
  SalesOrder,
  SupplierProduct,
  Thread,
} from "@/types";
import { formatDate, formatMoney } from "@/lib/format";
import conversations from "../data/conversations.json";

/** Message text that says a document comes with it ("please find attached", "quote X attached"), not "attached to the order". */
export const MENTIONS_ATTACHMENT = /\battached(?! to )/i;
import { addDays, daysBetween, isoDateTime, toDate } from "../clock";
import { workingDay, type SeedContext } from "./context";

type Script = {
  key: string;
  relatedType: Thread["relatedType"];
  audience: "customer" | "supplier";
  subject: string;
  brewfittRole: BrewfittTeamMember["role"];
  endsWith: "brewfitt" | "account";
  messages: {
    side: "account" | "brewfitt";
    channel: Message["channel"];
    dayOffset: number;
    hour: number;
    body: string;
  }[];
};

const SCRIPTS = new Map((conversations.scripts as Script[]).map((s) => [s.key, s]));

type CaseSpec = {
  accountId: string;
  kind: Case["kind"];
  urgency: Case["urgency"];
  status: Case["status"];
  subject: string;
  description: string;
  /** Customer cases name the product; supplier issues use one of the supplier's own. */
  productSlug?: string;
  link: "order" | "job" | "product" | "purchase-order" | "invoice";
  ageDays: number;
  script?: string;
  resolution?: string;
  notes?: string[];
};

/** Supplier Support: issues suppliers raise with Brewfitt's buyers. */
const SUPPLIER_CASE_SPECS: CaseSpec[] = [
  {
    accountId: "sup_vireo",
    kind: "payment",
    urgency: "normal",
    status: "open",
    subject: "Remittance total does not match our statement",
    description:
      "The remittance for the last payment run is lower than the invoices we expected it to cover. Could you confirm which invoices were included and whether any were held back?",
    link: "invoice",
    ageDays: 3,
  },
  {
    accountId: "sup_vireo",
    kind: "purchase-order",
    urgency: "high",
    status: "in-progress",
    subject: "Purchase order quantities differ from our quote",
    description:
      "The quantities on the latest purchase order do not match the RFQ response we sent. Please confirm the quantities you need before we pick the order.",
    link: "purchase-order",
    ageDays: 2,
    notes: ["Buyer checking the purchase order lines against the RFQ response."],
  },
  {
    accountId: "sup_vireo",
    kind: "delivery",
    urgency: "normal",
    status: "resolved",
    subject: "Goods-in booking for our next delivery",
    description:
      "Our pallet delivery is ready to leave. Please book a goods-in slot at Huddersfield so the driver is not turned away.",
    link: "purchase-order",
    ageDays: 12,
    resolution: "Goods-in slot booked for 8am; the driver should report to the trade counter.",
  },
  {
    accountId: "sup_polarflex",
    kind: "product-listing",
    urgency: "low",
    status: "resolved",
    subject: "Updated product images not showing",
    description:
      "We sent new images for one of our coolers two weeks ago but the old images are still shown to your customers.",
    link: "product",
    ageDays: 20,
    resolution: "New images approved and published to the catalogue.",
  },
  {
    accountId: "sup_northgas",
    kind: "general",
    urgency: "low",
    status: "closed",
    subject: "New contact for purchase orders",
    description:
      "Our purchase order inbox has moved to our new sales office. Please send future purchase orders to the new contact on our account.",
    link: "product",
    ageDays: 40,
    resolution: "Account contact updated for purchase orders.",
  },
];

const CASE_SPECS: CaseSpec[] = [
  {
    accountId: "acc_harbourside",
    kind: "fault",
    urgency: "high",
    status: "resolved",
    subject: "Fobbing on new Cobra fonts after install",
    description:
      "Two of the new Cobra fonts installed in the first wave are fobbing on the first pint of every pour. The other fonts on the same cooler are pouring normally.",
    productSlug: "cobra-4-out-chrome-led",
    link: "job",
    ageDays: 4,
    script: "case-fobbing-after-install",
    resolution:
      "Kinked product line behind the bar replaced and secondary pressure re-set. Both fonts pouring normally on test.",
    notes: [
      "Checked secondary regulator settings on site; within range.",
      "Found a kinked product line behind the bar; replaced on the follow-up visit.",
    ],
  },
  {
    accountId: "acc_millrace_weavers",
    kind: "fault",
    urgency: "critical",
    status: "open",
    subject: "Warm beer from the remote cooler",
    description:
      "Lager on the back bar is pouring warm since this morning. The remote cooler is running but the python feels warm at the bar end.",
    productSlug: "v21-integral-cooler",
    link: "product",
    ageDays: 1,
    script: "case-warm-beer-remote-cooler",
  },
  {
    accountId: "acc_pennine",
    kind: "warranty",
    urgency: "normal",
    status: "awaiting-parts",
    subject: "Dripping FC4 tap on tap room bar",
    description:
      "One FC4 chrome tap keeps dripping after it is closed. We have tried tightening the tap but it still drips overnight.",
    productSlug: "fc4-tap-chrome-lager-1-2-x35x3-16jg",
    link: "order",
    ageDays: 6,
    script: "case-leaking-tap",
    notes: ["O-ring repair kit ordered for the next van run."],
  },
  {
    accountId: "acc_saltember",
    kind: "return",
    urgency: "normal",
    status: "resolved",
    subject: "Drip tray damaged on delivery",
    description:
      "The stainless drip tray arrived with a dent along the front edge. The packaging was also damaged.",
    productSlug: "st-st-recessed-drip-tray-30x18x3-c-w-drain",
    link: "order",
    ageDays: 18,
    script: "case-damaged-drip-tray-delivery",
    resolution:
      "Replacement tray delivered and the damaged tray collected by the carrier. Credit not required.",
  },
  {
    accountId: "acc_trent",
    kind: "query",
    urgency: "low",
    status: "closed",
    subject: "Coolant top-up interval",
    description:
      "How often should we top up coolant on the remote coolers in our trade dispense store?",
    productSlug: "coolflow-dtx-28-pre-mix-25-litres",
    link: "product",
    ageDays: 70,
    resolution:
      "Advised to check coolant levels at every line clean and follow the cooler manufacturer's service schedule.",
  },
  {
    accountId: "acc_coachworks",
    kind: "fault",
    urgency: "high",
    status: "resolved",
    subject: "Glass freshener not spraying",
    description:
      "The glass freshener in the ballroom bar drip tray is not spraying when a glass is pressed down.",
    productSlug: "st-st-drip-tray-50x22x3-c-w-glass-freshener-drain",
    link: "product",
    ageDays: 25,
    resolution: "Blocked inline filter cleared and spring replaced. Working normally on test.",
    notes: ["Mains water supply confirmed on.", "Repair kit fitted."],
  },
  {
    accountId: "acc_neontiger",
    kind: "fault",
    urgency: "normal",
    status: "closed",
    subject: "Compensator tap pouring too fast",
    description:
      "The compensator tap on the lager line is pouring very lively even with the compensator turned down.",
    productSlug: "stainless-steel-comapensator-tap-1-2-47-jg5-16",
    link: "order",
    ageDays: 48,
    resolution: "Gas pressure reduced at the secondary regulator; tap re-set with the bar team.",
  },
  {
    accountId: "acc_crown",
    kind: "return",
    urgency: "low",
    status: "resolved",
    subject: "Wrong coupler type delivered",
    description: "We ordered an S type coupler but received a G type. Our kegs are S type.",
    productSlug: "s-type-keg-coupler-c-w-jg-fittings-nrv-sankey",
    link: "order",
    ageDays: 60,
    resolution: "Correct S type coupler sent; G type returned.",
  },
  {
    accountId: "acc_liffey",
    kind: "warranty",
    urgency: "normal",
    status: "in-progress",
    subject: "LED badge holder flickering",
    description:
      "One LED badge holder on the rooftop bar flickers intermittently, mostly in the evening.",
    productSlug: "wall-mounted-led-badge-holder",
    link: "product",
    ageDays: 9,
    notes: ["Photos received; transformer check requested before sending a replacement."],
  },
  {
    accountId: "acc_kelpie",
    kind: "fault",
    urgency: "high",
    status: "resolved",
    subject: "Secondary regulator leaking gas",
    description:
      "We can hear gas escaping from one of the secondary regulators on the cellar wall.",
    productSlug: "secondary-regulator-c-w-shut-off-valve-wall-bracket-jg-fittings-gauge",
    link: "product",
    ageDays: 34,
    resolution: "Regulator replaced and joints leak-tested.",
  },
  {
    accountId: "acc_tyne_quayside",
    kind: "query",
    urgency: "low",
    status: "closed",
    subject: "Line cleaning frequency for cask and keg",
    description:
      "Can you confirm how often we should clean keg lines compared with our cask lines?",
    productSlug: "pipeline-purple-beer-line-cleaning-powder",
    link: "product",
    ageDays: 95,
    resolution: "Shared the line cleaning guide from the knowledge centre.",
  },
  {
    accountId: "acc_granitequay",
    kind: "fault",
    urgency: "normal",
    status: "open",
    subject: "Tap handle loose",
    description: "The handle on one of the FC4 taps has come loose and spins on the lever.",
    productSlug: "black-plastic-handle-for-fc4-tap-3-8",
    link: "product",
    ageDays: 2,
  },
  {
    accountId: "acc_marina",
    kind: "warranty",
    urgency: "high",
    status: "in-progress",
    subject: "Bottle cooler not reaching temperature",
    description:
      "The under-counter bottle cooler in the pool bar is not getting below 9°C in the afternoon.",
    productSlug: "maxiglass-3-x-hinged-315-litre-under-counter-bottle-cooler-2",
    link: "product",
    ageDays: 7,
    notes: ["Asked the venue to check the condenser is clear and the unit has ventilation space."],
  },
  {
    accountId: "acc_northlight",
    kind: "query",
    urgency: "low",
    status: "closed",
    subject: "KeyKeg coupler compatibility",
    description: "Will the KeyKeg coupler fit the kegs our new cider is going into?",
    productSlug: "keykeg-coupler-c-w-jg-fittings",
    link: "product",
    ageDays: 120,
    resolution: "Confirmed the keg supplier's fitting type matches the KeyKeg coupler.",
  },
  {
    accountId: "acc_millrace_plough",
    kind: "fault",
    urgency: "normal",
    status: "resolved",
    subject: "Foam Stop not resetting",
    description: "The Foam Stop on the lager line stays closed after a keg change.",
    productSlug: "beer-foam-fob-stop-1-2g-x-1-2bsp",
    link: "product",
    ageDays: 40,
    resolution: "Talked the cellar manager through the reset procedure over the phone.",
  },
  {
    accountId: "acc_copperhouse",
    kind: "return",
    urgency: "low",
    status: "open",
    subject: "Return unused cleaning sockets",
    description:
      "We ordered too many KeyKeg cleaning sockets and would like to return four unopened.",
    productSlug: "keykeg-cleaning-socket-c-w-jg-fittings-3-8",
    link: "product",
    ageDays: 3,
  },
];

const AUTO_TEXT = {
  quoteSent: (q: Quote) =>
    `Please find quote ${q.number} attached, totalling ${formatMoney(q.total)} including VAT. It is valid until ${formatDate(q.validUntil)}.`,
  quoteRequested: (q: Quote, configName: string | null) =>
    configName
      ? `Quote requested for the design "${configName}" from the Dispense Designer.`
      : `Please can you quote for the ${q.lines.length} items listed on ${q.number}?`,
  quoteAccepted: (q: Quote) => `Quote ${q.number} accepted. Please go ahead.`,
  quoteDeclined: (q: Quote) => `We are declining ${q.number}. ${q.declineReason ?? ""}`.trim(),
  order: (o: SalesOrder, address: Address) =>
    `Thank you for your order. ${o.number} is confirmed for delivery on ${formatDate(o.confirmedDate ?? o.requestedDate)} to ${address.label.toLowerCase()} (${address.town}).`,
  po: (po: PurchaseOrder) =>
    `Purchase order ${po.number} attached for ${po.lines.length} lines. Please confirm delivery for ${formatDate(po.expectedDate)}.`,
  rfq: (r: Rfq) =>
    `Please quote for the items on ${r.number} by ${formatDate(r.deadline)}.${r.notes ? ` ${r.notes}` : ""}`,
  submission: (sp: SupplierProduct) =>
    `Submitted ${sp.name} for review, with images and cost price.`,
};

export type CommsSeed = {
  cases: Case[];
  threads: Thread[];
  messages: Message[];
  notifications: Notification[];
};

export function seedComms(
  ctx: SeedContext,
  r: {
    team: BrewfittTeamMember[];
    contacts: Contact[];
    addresses: Address[];
    quotes: Quote[];
    configurations: { id: string; name: string; quoteId: string | null }[];
    salesOrders: SalesOrder[];
    deliveries: Delivery[];
    changeRequests: ChangeRequest[];
    jobs: Job[];
    purchaseOrders: PurchaseOrder[];
    documents: Document[];
    payments: Payment[];
    rfqs: Rfq[];
    supplierProducts: SupplierProduct[];
    invoices: Invoice[];
    paymentRuns: PaymentRun[];
    rolloutOrderId: string;
    insights: AIInsight[];
  },
): CommsSeed {
  const { rng, today } = ctx;
  const threads: Thread[] = [];
  const messages: Message[] = [];
  let messageSeq = 0;
  const nextMessageId = () => `msg_${++messageSeq}`;
  const nowMs = today.getTime() + 17 * 3600_000;

  const primaryContact = (accountId: string) =>
    r.contacts.find((c) => c.accountId === accountId && c.isPrimary) ??
    r.contacts.find((c) => c.accountId === accountId)!;
  const teamFor = (accountId: string, role: BrewfittTeamMember["role"]) => {
    const account = ctx.account(accountId);
    const commercial = account.parentAccountId ? ctx.account(account.parentAccountId) : account;
    if (role === "account-manager" && commercial.accountManagerId)
      return r.team.find((t) => t.id === commercial.accountManagerId)!;
    if (role === "buyer" && commercial.buyerId)
      return r.team.find((t) => t.id === commercial.buyerId)!;
    return r.team.find((t) => t.role === role) ?? r.team[0]!;
  };
  const first = (name: string) => name.split(" ")[0]!;

  const openThread = (
    accountId: string,
    subject: string,
    relatedType: Thread["relatedType"],
    relatedId: string | null,
    brewfitt: BrewfittTeamMember,
  ): Thread => {
    const contact = primaryContact(accountId);
    const thread: Thread = {
      id: `thr_${threads.length + 1}`,
      accountId,
      subject,
      relatedType,
      relatedId,
      participants: [
        { id: contact.id, name: contact.name, side: "account" },
        { id: brewfitt.id, name: brewfitt.name, side: "brewfitt" },
      ],
      lastMessageAt: "",
      unreadCount: 0,
    };
    threads.push(thread);
    return thread;
  };

  const post = (
    thread: Thread,
    side: Message["senderSide"],
    channel: Message["channel"],
    at: Date,
    body: string,
    attachments: string[] = [],
  ) => {
    const at_ = Math.min(at.getTime(), nowMs - 60_000);
    const sender = thread.participants.find((p) => p.side === side)!;
    messages.push({
      id: nextMessageId(),
      threadId: thread.id,
      senderId: sender.id,
      senderSide: side,
      channel,
      body,
      attachments,
      sentAt: new Date(at_).toISOString(),
    });
  };

  const at = (d: Date, hour: number, minute = rng.pick([2, 14, 27, 38, 51])) =>
    new Date(isoDateTime(d, hour, minute));

  // ---- Cases ----------------------------------------------------------------
  const cases: Case[] = [];
  let caseNo = 0;
  for (const spec of [...CASE_SPECS, ...SUPPLIER_CASE_SPECS].sort(
    (a, b) => b.ageDays - a.ageDays,
  )) {
    const supplier = ctx.account(spec.accountId).kind === "supplier";
    const created = addDays(today, -spec.ageDays);
    const suppliedProduct = supplier
      ? [...ctx.productById.values()].find((p) => p.supplierId === spec.accountId)
      : undefined;
    const productId = spec.productSlug ? `prd_${spec.productSlug}` : (suppliedProduct?.id ?? "");
    if (!ctx.productById.has(productId))
      throw new Error(`Case product not found: ${spec.productSlug ?? spec.accountId}`);
    const purchaseOrder = supplier
      ? r.purchaseOrders
          .filter((po) => po.supplierId === spec.accountId && new Date(po.createdAt) < created)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
      : undefined;
    const invoice = supplier
      ? r.invoices
          .filter(
            (i) =>
              i.accountId === spec.accountId &&
              i.orderType === "purchase" &&
              i.kind !== "credit-note" &&
              new Date(i.issuedAt) < created,
          )
          .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt))[0]
      : undefined;
    if (spec.link === "purchase-order" && !purchaseOrder)
      throw new Error(`No purchase order for supplier case: ${spec.subject}`);
    if (spec.link === "invoice" && !invoice)
      throw new Error(`No invoice for supplier case: ${spec.subject}`);
    const order = r.salesOrders
      .filter(
        (o) =>
          o.accountId === spec.accountId &&
          o.status !== "cancelled" &&
          new Date(o.createdAt) < created,
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    const job = r.jobs.find(
      (j) =>
        j.accountId === spec.accountId &&
        j.orderId === r.rolloutOrderId &&
        j.status === "signed-off",
    );
    caseNo += 1;
    const c: Case = {
      id: `case_${caseNo}`,
      accountId: spec.accountId,
      number: ctx.number("case"),
      // Supplier issues about a purchase order or invoice are not about one product.
      productId: supplier && spec.link !== "product" ? null : productId,
      orderId:
        spec.link === "order" || spec.link === "job"
          ? spec.link === "job" && job
            ? job.orderId
            : (order?.id ?? null)
          : null,
      jobId: spec.link === "job" ? (job?.id ?? null) : null,
      purchaseOrderId:
        spec.link === "purchase-order" || spec.link === "invoice"
          ? spec.link === "invoice"
            ? (invoice?.orderId ?? null)
            : (purchaseOrder?.id ?? null)
          : null,
      invoiceId: spec.link === "invoice" ? (invoice?.id ?? null) : null,
      kind: spec.kind,
      urgency: spec.urgency,
      status: spec.status,
      subject: spec.subject,
      description: spec.description,
      photos:
        spec.kind === "fault" || spec.kind === "return"
          ? [ctx.productById.get(productId)!.images[0]!]
          : [],
      engineerNotes: (spec.notes ?? []).map((note, i) => ({
        author: supplier
          ? teamFor(spec.accountId, "buyer").name
          : i === 0
            ? "Mark Sutcliffe"
            : "Craig Lockwood",
        note,
        at: isoDateTime(addDays(created, Math.min(i + 1, spec.ageDays)), 11 + i),
      })),
      resolution: spec.resolution ?? null,
      threadId: "",
      createdAt: isoDateTime(created, rng.int(8, 12), 20),
      updatedAt: isoDateTime(addDays(created, Math.min(spec.ageDays, rng.int(0, 3))), 15, 10),
    };
    cases.push(c);
  }

  // ---- Record threads with the ERP's mirrored email -------------------------
  const configNameByQuote = new Map(
    r.configurations.filter((c) => c.quoteId).map((c) => [c.quoteId!, c.name]),
  );
  const addressById = new Map(r.addresses.map((a) => [a.id, a]));
  const threadFor = new Map<string, Thread>();

  for (const q of r.quotes) {
    const manager = teamFor(q.accountId, "account-manager");
    const t = openThread(q.accountId, `Quote ${q.number}`, "quote", q.id, manager);
    q.threadId = t.id;
    threadFor.set(q.id, t);
    const created = new Date(q.createdAt);
    if (q.status === "draft") {
      post(
        t,
        "account",
        "portal",
        created,
        AUTO_TEXT.quoteRequested(q, configNameByQuote.get(q.id) ?? null),
      );
      continue;
    }
    post(
      t,
      "brewfitt",
      "email",
      created,
      AUTO_TEXT.quoteSent(q),
      q.pdfDocumentId ? [q.pdfDocumentId] : [],
    );
    if (q.status === "accepted")
      post(t, "account", "portal", new Date(q.updatedAt), AUTO_TEXT.quoteAccepted(q));
    if (q.status === "declined")
      post(t, "account", "portal", new Date(q.updatedAt), AUTO_TEXT.quoteDeclined(q));
  }
  for (const o of r.salesOrders) {
    const t = openThread(
      o.accountId,
      `Order ${o.number}`,
      "sales-order",
      o.id,
      teamFor(o.accountId, "sales-office"),
    );
    o.threadId = t.id;
    threadFor.set(o.id, t);
    post(
      t,
      "brewfitt",
      "email",
      new Date(new Date(o.createdAt).getTime() + 20 * 60_000),
      AUTO_TEXT.order(o, addressById.get(o.deliveryAddressId)!),
    );
  }
  for (const po of r.purchaseOrders) {
    const t = openThread(
      po.supplierId,
      `Purchase order ${po.number}`,
      "purchase-order",
      po.id,
      teamFor(po.supplierId, "buyer"),
    );
    po.threadId = t.id;
    threadFor.set(po.id, t);
    post(
      t,
      "brewfitt",
      "email",
      new Date(po.createdAt),
      AUTO_TEXT.po(po),
      r.documents
        .filter((d) => d.relatedType === "purchase-order" && d.relatedId === po.id)
        .map((d) => d.id),
    );
  }
  for (const rfq of r.rfqs) {
    const t = openThread(
      rfq.supplierId,
      `Request for quotation ${rfq.number}`,
      "rfq",
      rfq.id,
      teamFor(rfq.supplierId, "buyer"),
    );
    rfq.threadId = t.id;
    threadFor.set(rfq.id, t);
    post(t, "brewfitt", "email", new Date(rfq.createdAt), AUTO_TEXT.rfq(rfq));
  }
  for (const sp of r.supplierProducts) {
    const t = openThread(
      sp.supplierId,
      `Product submission: ${sp.name}`,
      "supplier-product",
      sp.id,
      teamFor(sp.supplierId, "buyer"),
    );
    sp.threadId = t.id;
    threadFor.set(sp.id, t);
    post(t, "account", "portal", new Date(sp.submittedAt), AUTO_TEXT.submission(sp));
    if ((sp.status === "approved" || sp.status === "rejected") && sp.reviewNote)
      post(t, "brewfitt", "portal", new Date(sp.updatedAt), sp.reviewNote);
  }
  for (const c of cases) {
    const t = openThread(
      c.accountId,
      `Case ${c.number}: ${c.subject}`,
      "case",
      c.id,
      teamFor(
        c.accountId,
        ctx.account(c.accountId).kind === "supplier" ? "buyer" : "technical-manager",
      ),
    );
    c.threadId = t.id;
    threadFor.set(c.id, t);
    post(t, "account", "portal", new Date(c.createdAt), c.description);
    if (c.resolution) post(t, "brewfitt", "portal", new Date(c.updatedAt), c.resolution);
  }

  // ---- Conversation scripts on chosen records ------------------------------
  const vars = (accountId: string, extra: Record<string, string>) => {
    const contact = primaryContact(accountId);
    const account = ctx.account(accountId);
    return {
      accountFirstName: first(contact.name),
      accountName: account.parentAccountId
        ? ctx.account(account.parentAccountId).name
        : account.name,
      siteName: account.name,
      ...extra,
    };
  };
  const fill = (text: string, v: Record<string, string>) =>
    text.replace(/\{\{(\w+)\}\}/g, (_, key: string) => v[key] ?? key);

  // Scripted messages that say a document is attached carry the thread record's PDF.
  const attachmentsFor = (thread: Thread): string[] => {
    const docs = (type: string, id: string) =>
      r.documents.filter((d) => d.relatedType === type && d.relatedId === id).map((d) => d.id);
    switch (thread.relatedType) {
      case "purchase-order":
      case "quote":
        return docs(thread.relatedType, thread.relatedId!);
      case "invoice": {
        const payment = r.payments.find(
          (p) =>
            p.remittanceDocumentId && p.allocatedTo.some((a) => a.invoiceId === thread.relatedId),
        );
        return payment ? [payment.remittanceDocumentId!] : [];
      }
      default:
        return [];
    }
  };

  const applyScript = (
    key: string,
    thread: Thread,
    recordDate: Date,
    v: Record<string, string>,
  ) => {
    const script = SCRIPTS.get(key);
    if (!script) throw new Error(`Unknown conversation script ${key}`);
    const brewfitt = teamFor(thread.accountId, script.brewfittRole);
    // Scripts may be answered by a different Brewfitt colleague than the record owner.
    if (!thread.participants.some((p) => p.id === brewfitt.id))
      thread.participants.push({ id: brewfitt.id, name: brewfitt.name, side: "brewfitt" });
    const values = { brewfittFirstName: first(brewfitt.name), ...v };
    const maxOffset = Math.max(...script.messages.map((m) => m.dayOffset));
    const latestStart = addDays(today, -maxOffset);
    const start =
      recordDate.getTime() > latestStart.getTime() ? latestStart : addDays(recordDate, 1);
    // Brewfitt messages come from the scripted role in this thread.
    const brewfittParticipantIndex = thread.participants.findIndex((p) => p.id === brewfitt.id);
    for (const m of script.messages) {
      const when = at(addDays(start, m.dayOffset), m.hour);
      if (m.side === "brewfitt") {
        const sender = thread.participants[brewfittParticipantIndex]!;
        const body = fill(m.body, values);
        messages.push({
          id: nextMessageId(),
          threadId: thread.id,
          senderId: sender.id,
          senderSide: "brewfitt",
          channel: m.channel,
          body,
          attachments: MENTIONS_ATTACHMENT.test(body) ? attachmentsFor(thread) : [],
          sentAt: new Date(Math.min(when.getTime(), nowMs - 60_000)).toISOString(),
        });
      } else {
        post(thread, "account", m.channel, when, fill(m.body, values));
      }
    }
    if (script.relatedType === null) thread.subject = fill(script.subject, values);
    else thread.subject = fill(script.subject, values);
  };

  const productName = (productId: string | null | undefined) =>
    productId ? ctx.productById.get(productId)!.name : "";
  const quoteVars = (q: Quote) =>
    vars(q.accountId, {
      quoteNumber: q.number,
      productName: productName(q.lines[0]?.productId),
      secondProductName: productName(q.lines[1]?.productId ?? q.lines[0]?.productId),
      amount: formatMoney(q.total),
    });
  const orderVars = (o: SalesOrder) => {
    const d = r.deliveries.find((x) => x.orderId === o.id);
    const site = addressById.get(o.deliveryAddressId)!;
    return vars(o.accountId, {
      orderNumber: o.number,
      productName: productName(o.lines[0]?.productId),
      secondProductName: productName(o.lines[1]?.productId ?? o.lines[0]?.productId),
      deliveryDate: formatDate(o.confirmedDate ?? o.requestedDate),
      carrier: d?.carrier ?? "our own vehicle",
      trackingRef: d?.trackingRef ?? d?.number ?? o.number,
      amount: formatMoney(o.total),
      siteName: site.isDefault ? ctx.account(o.accountId).name : site.label,
    });
  };

  const oldEnough = <T extends { createdAt: string }>(list: T[], days: number) =>
    list.filter((x) => daysBetween(x.createdAt, today) >= days);
  const pickQuote = (filter: (q: Quote) => boolean, minAge: number) => {
    const list = r.quotes.filter(filter);
    return oldEnough(list, minAge)[0] ?? list[0];
  };
  const used = new Set<string>();
  const claim = <T extends { id: string }>(x: T | undefined) => {
    if (!x || used.has(x.id)) return undefined;
    used.add(x.id);
    return x;
  };

  // Customer quote threads
  const configQuote = (name: string) =>
    r.quotes.find((q) => q.id === r.configurations.find((c) => c.name === name)?.quoteId);
  const quoteScripts: [string, Quote | undefined][] = [
    ["quote-font-lead-time", configQuote("Harbourside flagship bar fit-out")],
    ["quote-tap-finish-swap", configQuote("Garden bar extension")],
    ["quote-add-drip-trays", configQuote("Restaurant bar counter")],
    ["quote-revised-price", configQuote("Rooftop terrace bar")],
    [
      "quote-font-branding-artwork",
      configQuote("Summer festival bar") ?? pickQuote((q) => q.status === "accepted", 10),
    ],
  ];
  for (const [key, q] of quoteScripts) {
    const quote = claim(q);
    if (quote)
      applyScript(key, threadFor.get(quote.id)!, new Date(quote.createdAt), quoteVars(quote));
  }

  // Customer order threads
  const rollout = r.salesOrders.find((o) => o.id === r.rolloutOrderId)!;
  used.add(rollout.id);
  applyScript(
    "premium-lager-font-rollout",
    threadFor.get(rollout.id)!,
    new Date(rollout.createdAt),
    {
      ...orderVars(rollout),
      siteName: "The Brass Anchor in Birmingham",
      productName: productName(rollout.lines[0]!.productId),
    },
  );

  const ordersBy = (filter: (o: SalesOrder) => boolean) =>
    r.salesOrders
      .filter((o) => !used.has(o.id) && filter(o))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  // The date-change conversation ends with Brewfitt confirming, so it belongs on an approved request.
  const approvedDateChangeOrderIds = new Set(
    r.changeRequests
      .filter((c) => c.status === "approved" && c.kind === "date")
      .map((c) => c.orderId),
  );
  const orderScripts: [string, SalesOrder | undefined][] = [
    [
      "order-delivery-slot-cellar-access",
      ordersBy(
        (o) =>
          o.accountId === "acc_pennine" &&
          o.status === "delivered" &&
          daysBetween(o.createdAt, today) > 3,
      )[0],
    ],
    ["order-delivery-date-change", ordersBy((o) => approvedDateChangeOrderIds.has(o.id))[0]],
    ["order-part-delivery-back-order", ordersBy((o) => o.status === "part-delivered")[0]],
    [
      "order-carrier-tracking-query",
      ordersBy((o) => o.status === "dispatched")[0] ??
        ordersBy((o) => o.status === "delivered" && daysBetween(o.createdAt, today) < 20)[0],
    ],
    [
      "order-proof-of-delivery",
      ordersBy((o) => o.accountId === "acc_saltember" && o.status === "delivered")[0] ??
        ordersBy((o) => o.status === "delivered" && daysBetween(o.createdAt, today) > 10)[0],
    ],
  ];
  for (const [key, o] of orderScripts) {
    const order = claim(o);
    if (order)
      applyScript(key, threadFor.get(order.id)!, new Date(order.createdAt), orderVars(order));
  }

  // Case threads
  for (const spec of CASE_SPECS.filter((s) => s.script)) {
    const c = cases.find((x) => x.subject === spec.subject)!;
    const t = threadFor.get(c.id)!;
    // The scripted conversation replaces the generic opening message.
    for (let i = messages.length - 1; i >= 0; i--)
      if (messages[i]!.threadId === t.id) messages.splice(i, 1);
    applyScript(
      spec.script!,
      t,
      addDays(new Date(c.createdAt), -1),
      vars(c.accountId, { caseNumber: c.number, productName: productName(c.productId) }),
    );
  }

  // Invoice query on a credit note
  const credit =
    r.invoices.find((i) => i.kind === "credit-note" && i.accountId === "acc_harbourside") ??
    r.invoices.find((i) => i.kind === "credit-note");
  if (credit) {
    const original =
      r.invoices.find(
        (i) =>
          i.kind === "invoice" && i.orderId === credit.orderId && i.accountId === credit.accountId,
      ) ?? credit;
    const t = openThread(
      credit.accountId,
      "",
      "invoice",
      original.id,
      teamFor(credit.accountId, "credit-control"),
    );
    applyScript(
      "invoice-credit-note-return",
      t,
      new Date(original.issuedAt),
      vars(credit.accountId, {
        invoiceNumber: original.number,
        amount: formatMoney(credit.total),
        productName: productName(
          r.salesOrders.find((o) => o.id === credit.orderId)?.lines.at(-1)?.productId,
        ),
      }),
    );
  }

  // General account threads
  const siteThread = openThread(
    "acc_millrace",
    "",
    null,
    null,
    teamFor("acc_millrace", "account-manager"),
  );
  applyScript(
    "general-new-site-opening",
    siteThread,
    addDays(today, -4),
    vars("acc_millrace", { siteName: "The Mill Wheel, Holmfirth" }),
  );
  const contactThread = openThread(
    "acc_saltember",
    "",
    null,
    null,
    teamFor("acc_saltember", "account-manager"),
  );
  applyScript(
    "general-add-new-contact",
    contactThread,
    addDays(today, -12),
    vars("acc_saltember", {}),
  );

  // Supplier threads (Vireo is the supplier persona)
  const vireoRfq = (status: Rfq["status"]) =>
    r.rfqs.find((x) => x.supplierId === "sup_vireo" && x.status === status);
  const rfqVars = (rfq: Rfq) =>
    vars(rfq.supplierId, {
      rfqNumber: rfq.number,
      productName: productName(rfq.lines[0]?.productId),
      secondProductName: productName(rfq.lines[1]?.productId ?? rfq.lines[0]?.productId),
    });
  for (const [key, rfq] of [
    ["rfq-quantities-clarification", vireoRfq("open")],
    ["rfq-lead-time-price-breaks", vireoRfq("responded")],
  ] as const) {
    if (rfq) applyScript(key, threadFor.get(rfq.id)!, new Date(rfq.createdAt), rfqVars(rfq));
  }
  const vireoPos = r.purchaseOrders
    .filter((p) => p.supplierId === "sup_vireo")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const poVars = (po: PurchaseOrder) =>
    vars(po.supplierId, {
      poNumber: po.number,
      productName: productName(po.lines[0]?.productId),
      secondProductName: productName(po.lines[1]?.productId ?? po.lines[0]?.productId),
      deliveryDate: formatDate(po.expectedDate),
      amount: formatMoney(po.total),
    });
  const ackPo = vireoPos.find((p) => p.status === "acknowledged" || p.status === "issued");
  if (ackPo)
    applyScript(
      "po-acknowledgement-delivery-date",
      threadFor.get(ackPo.id)!,
      new Date(ackPo.createdAt),
      poVars(ackPo),
    );
  const splitPo =
    vireoPos.find((p) => p.status === "part-received") ??
    vireoPos.find((p) => p.status === "received");
  if (splitPo)
    applyScript(
      "po-split-delivery",
      threadFor.get(splitPo.id)!,
      new Date(splitPo.createdAt),
      poVars(splitPo),
    );
  const vireoSub = (status: SupplierProduct["status"]) =>
    r.supplierProducts.find((s) => s.supplierId === "sup_vireo" && s.status === status);
  for (const [key, sp] of [
    ["submission-spec-sheet-request", vireoSub("submitted")],
    ["submission-image-quality", vireoSub("under-review")],
    ["submission-review-approval", vireoSub("approved")],
  ] as const) {
    if (sp)
      applyScript(
        key,
        threadFor.get(sp.id)!,
        new Date(sp.submittedAt),
        vars(sp.supplierId, { submissionName: sp.name, productName: sp.name }),
      );
  }
  const paidSelfBill = r.invoices
    .filter((i) => i.accountId === "sup_vireo" && i.status === "paid")
    .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt))[0];
  if (paidSelfBill) {
    const t = openThread(
      "sup_vireo",
      "",
      "invoice",
      paidSelfBill.id,
      teamFor("sup_vireo", "credit-control"),
    );
    applyScript(
      "supplier-remittance-query",
      t,
      new Date(paidSelfBill.issuedAt),
      vars("sup_vireo", {
        invoiceNumber: paidSelfBill.number,
        amount: formatMoney(paidSelfBill.total),
      }),
    );
  }

  // ---- Thread summaries -----------------------------------------------------
  messages.sort((a, b) => a.sentAt.localeCompare(b.sentAt));
  const byThread = new Map<string, Message[]>();
  for (const m of messages) byThread.set(m.threadId, [...(byThread.get(m.threadId) ?? []), m]);
  for (const t of threads) {
    const list = byThread.get(t.id) ?? [];
    t.lastMessageAt = list[list.length - 1]!.sentAt;
    // Brewfitt messages in the last 10 days that the account has not replied to are unread.
    let unread = 0;
    for (
      let i = list.length - 1;
      i >= 0 && list[i]!.senderSide === "brewfitt" && daysBetween(list[i]!.sentAt, today) <= 10;
      i--
    )
      unread++;
    t.unreadCount =
      list[list.length - 1]!.channel === "email" &&
      list.length === 1 &&
      daysBetween(list[0]!.sentAt, today) > 2
        ? 0
        : unread;
  }

  // ---- Notifications --------------------------------------------------------
  const notifications: Notification[] = [];
  const notify = (n: Omit<Notification, "id" | "read" | "dismissed">) => {
    const age = daysBetween(n.createdAt, today);
    notifications.push({
      ...n,
      id: `ntf_${notifications.length + 1}`,
      read: age > 3,
      dismissed: false,
    });
  };
  const recent = (iso: string, days: number) =>
    daysBetween(iso, today) <= days && toDate(iso).getTime() <= nowMs;

  for (const q of r.quotes) {
    if (q.status !== "sent") continue;
    const daysLeft = daysBetween(today, q.validUntil);
    if (daysLeft >= 0 && daysLeft <= 7) {
      notify({
        accountId: q.accountId,
        kind: "quote-expiring",
        title: `Quote ${q.number} expires ${daysLeft === 0 ? "today" : `in ${daysLeft} days`}`,
        body: `${formatMoney(q.total)} quote, valid until ${formatDate(q.validUntil)}.`,
        relatedType: "quote",
        relatedId: q.id,
        createdAt: isoDateTime(addDays(today, -Math.min(1, daysLeft)), 7),
      });
    } else if (recent(q.createdAt, 21)) {
      notify({
        accountId: q.accountId,
        kind: "quote-awaiting-acceptance",
        title: `Quote ${q.number} is ready for you`,
        body: `${formatMoney(q.total)} including VAT. Review and accept it in the portal.`,
        relatedType: "quote",
        relatedId: q.id,
        createdAt: q.createdAt,
      });
    }
  }
  for (const o of r.salesOrders) {
    if (o.status === "cancelled") continue;
    if (recent(o.createdAt, 7))
      notify({
        accountId: o.accountId,
        kind: "order-confirmed",
        title: `Order ${o.number} confirmed`,
        body: `Delivery due ${formatDate(o.confirmedDate ?? o.requestedDate)}.`,
        relatedType: "sales-order",
        relatedId: o.id,
        createdAt: o.createdAt,
      });
  }
  const orderById = new Map(r.salesOrders.map((o) => [o.id, o]));
  for (const d of r.deliveries.filter((x) => x.orderType === "sales")) {
    const o = orderById.get(d.orderId)!;
    if (d.deliveredAt && recent(d.deliveredAt, 10))
      notify({
        accountId: o.accountId,
        kind: "order-delivered",
        title: `Order ${o.number} delivered`,
        body: `Delivery ${d.number} was signed for. Proof of delivery is on the order.`,
        relatedType: "sales-order",
        relatedId: o.id,
        createdAt: d.deliveredAt,
      });
    else if (!d.deliveredAt && d.dispatchedAt && recent(d.dispatchedAt, 10))
      notify({
        accountId: o.accountId,
        kind: "order-dispatched",
        title: `Order ${o.number} dispatched`,
        body: `${d.carrier ?? "Carrier"}${d.trackingRef ? ` tracking ${d.trackingRef}` : ""}.`,
        relatedType: "sales-order",
        relatedId: o.id,
        createdAt: d.dispatchedAt,
      });
  }
  for (const c of r.changeRequests.filter(
    (x) => x.status === "approved" && x.kind === "date" && recent(x.createdAt, 30),
  )) {
    const o = orderById.get(c.orderId)!;
    notify({
      accountId: o.accountId,
      kind: "delivery-date-changed",
      title: `Delivery date changed on ${o.number}`,
      body: `Now due ${formatDate(c.requested)}.`,
      relatedType: "sales-order",
      relatedId: o.id,
      createdAt: c.createdAt,
    });
  }
  for (const inv of r.invoices) {
    if (inv.kind !== "invoice" || inv.outstanding.amount <= 0 || inv.orderType !== "sales")
      continue;
    const daysToDue = daysBetween(today, inv.dueAt);
    if (daysToDue < 0)
      notify({
        accountId: inv.accountId,
        kind: "invoice-overdue",
        title: `Invoice ${inv.number} is overdue`,
        body: `${formatMoney(inv.outstanding)} was due ${formatDate(inv.dueAt)}.`,
        relatedType: "invoice",
        relatedId: inv.id,
        createdAt: isoDateTime(addDays(new Date(inv.dueAt), 1), 7),
      });
    else if (daysToDue <= 5)
      notify({
        accountId: inv.accountId,
        kind: "invoice-due",
        title: `Invoice ${inv.number} due ${daysToDue === 0 ? "today" : `in ${daysToDue} days`}`,
        body: `${formatMoney(inv.outstanding)} due ${formatDate(inv.dueAt)}.`,
        relatedType: "invoice",
        relatedId: inv.id,
        createdAt: isoDateTime(addDays(today, -1), 7),
      });
  }
  for (const t of threads.filter((x) => x.unreadCount > 0)) {
    notify({
      accountId: t.accountId,
      kind: "new-message",
      title: `New message: ${t.subject}`,
      body: messages
        .filter((m) => m.threadId === t.id)
        .at(-1)!
        .body.slice(0, 140),
      relatedType: "thread",
      relatedId: t.id,
      createdAt: t.lastMessageAt,
    });
  }
  for (const c of cases.filter((x) => recent(x.updatedAt, 14) && x.status !== "open")) {
    notify({
      accountId: c.accountId,
      kind: "case-updated",
      title: `Case ${c.number} is ${c.status.replace("-", " ")}`,
      body: c.subject,
      relatedType: "case",
      relatedId: c.id,
      createdAt: c.updatedAt,
    });
  }
  for (const sp of r.supplierProducts.filter(
    (x) => (x.status === "approved" || x.status === "rejected") && recent(x.updatedAt, 60),
  )) {
    notify({
      accountId: sp.supplierId,
      kind: sp.status === "approved" ? "submission-approved" : "submission-rejected",
      title: `${sp.name} ${sp.status}`,
      body: sp.reviewNote ?? "",
      relatedType: "supplier-product",
      relatedId: sp.id,
      createdAt: sp.updatedAt,
    });
  }
  for (const rfq of r.rfqs.filter((x) => x.status === "open")) {
    notify({
      accountId: rfq.supplierId,
      kind: "rfq-received",
      title: `Request for quotation ${rfq.number}`,
      body: `Respond by ${formatDate(rfq.deadline)}.`,
      relatedType: "rfq",
      relatedId: rfq.id,
      createdAt: rfq.createdAt,
    });
  }
  const invoiceById = new Map(r.invoices.map((i) => [i.id, i]));
  const nextRun = r.paymentRuns
    .filter((x) => x.status === "scheduled")
    .sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor))[0];
  if (nextRun) {
    const supplierIds = new Set(nextRun.invoiceIds.map((id) => invoiceById.get(id)!.accountId));
    for (const supplierId of supplierIds) {
      const mine = nextRun.invoiceIds
        .map((id) => invoiceById.get(id)!)
        .filter((i) => i.accountId === supplierId);
      notify({
        accountId: supplierId,
        kind: "payment-run-scheduled",
        title: `Payment run on ${formatDate(nextRun.scheduledFor)}`,
        body: `${mine.length} invoice${mine.length === 1 ? "" : "s"} totalling ${formatMoney({ amount: mine.reduce((s, i) => s + i.outstanding.amount, 0), currency: "GBP" })}.`,
        relatedType: "payment-run",
        relatedId: nextRun.id,
        createdAt: isoDateTime(workingDay(addDays(today, -1)), 8),
      });
    }
  }
  // Insight-backed notifications: one per account for the most important suggestion and stock risk.
  for (const kind of ["product-suggestion", "stock-out-risk"] as const) {
    const seen = new Set<string>();
    for (const i of r.insights.filter((x) => x.category === kind)) {
      if (seen.has(i.accountId)) continue;
      seen.add(i.accountId);
      notify({
        accountId: i.accountId,
        kind,
        title: i.title,
        body: i.recommendedAction,
        relatedType: i.relatedType,
        relatedId: i.relatedId,
        createdAt: isoDateTime(addDays(today, 0), 7),
      });
    }
  }

  return { cases, threads, messages, notifications };
}

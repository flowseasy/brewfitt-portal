/**
 * npm run check:api
 *
 * Drives every endpoint of the portal contract through the validated `api`
 * (Zod-parsed responses) as each persona, exercises every mutation, then
 * simulates a page reload to prove changes persist through the replay log.
 */
process.env.MOCK_LATENCY = "0";

const memory = new Map<string, string>();
const storage = {
  getItem: (k: string) => memory.get(k) ?? null,
  setItem: (k: string, v: string) => void memory.set(k, v),
  removeItem: (k: string) => void memory.delete(k),
  clear: () => memory.clear(),
  key: (i: number) => [...memory.keys()][i] ?? null,
  get length() {
    return memory.size;
  },
};
(globalThis as unknown as { window: unknown }).window = { localStorage: storage };
(globalThis as unknown as { localStorage: unknown }).localStorage = storage;

async function main() {
  const { api } = await import("@/lib/api");
  const { usePersonaStore } = await import("@/stores/persona-store");
  const { reloadDb } = await import("@/lib/mock/db");
  const { validateConfiguration } = await import("@/lib/configurator/engine");
  const { getDb } = await import("@/lib/mock/db");
  const { advanceJourneys, JOURNEY_MINUTES } = await import("@/lib/mock/api/journey");

  let passed = 0;
  const failures: string[] = [];
  const step = async <T>(label: string, fn: () => Promise<T>): Promise<T | undefined> => {
    try {
      const result = await fn();
      passed++;
      return result;
    } catch (error) {
      failures.push(`${label}: ${error instanceof Error ? error.message : String(error)}`);
      return undefined;
    }
  };
  const expect = (condition: unknown, message: string) => {
    if (!condition) throw new Error(message);
  };

  const personas = (await api.demo.personas())!;
  const as = (label: string) => {
    const option = personas.find((p) => p.label.includes(label));
    if (!option) throw new Error(`No persona ${label}`);
    usePersonaStore.getState().setPersona(option.persona);
    return option;
  };

  // ---- Reads for every persona ------------------------------------------------
  for (const option of personas) {
    usePersonaStore.getState().setPersona(option.persona);
    const who = option.label;
    const supplier = option.persona.kind === "supplier";
    await step(`${who} me`, async () =>
      expect((await api.session.me()).brewfittTeam.length > 0, "no Brewfitt team"),
    );
    await step(`${who} account`, () => api.account.get());
    await step(`${who} addresses`, async () =>
      expect((await api.account.addresses()).length > 0, "no addresses"),
    );
    await step(`${who} contacts`, async () =>
      expect((await api.account.contacts()).length > 0, "no contacts"),
    );
    await step(`${who} account documents`, () => api.account.documents());
    await step(`${who} products`, async () =>
      expect((await api.products.list()).length > 0, "no products"),
    );
    await step(`${who} categories`, () => api.products.categories());
    await step(`${who} price list`, async () =>
      expect((await api.priceList.get()).lines.length > 0, "empty price list"),
    );
    await step(`${who} price list export`, async () =>
      expect((await api.priceList.export()).content.split("\r\n").length > 2, "empty CSV"),
    );
    await step(`${who} stock`, () => api.stock.list());
    await step(`${who} deliveries`, () => api.deliveries.list());
    await step(`${who} invoices`, () => api.invoices.list());
    await step(`${who} credit notes`, () => api.invoices.creditNotes());
    await step(`${who} payments`, () => api.invoices.payments());
    await step(`${who} statement reconciles`, async () => {
      const [statement, invoices, credits] = await Promise.all([
        api.invoices.statement(),
        api.invoices.list(),
        api.invoices.creditNotes(),
      ]);
      const outstanding =
        invoices.reduce((s, i) => s + i.outstanding.amount, 0) -
        credits.reduce((s, i) => s + i.outstanding.amount, 0);
      expect(
        statement.closingBalance.amount === outstanding,
        `closing ${statement.closingBalance.amount} ≠ outstanding ${outstanding}`,
      );
      const bands = Object.values(statement.ageing).reduce((s, m) => s + m.amount, 0);
      expect(
        bands - statement.unallocatedCredit.amount === outstanding,
        `ageing ${bands} − credit ${statement.unallocatedCredit.amount} ≠ outstanding ${outstanding}`,
      );
      expect(
        Object.values(statement.ageing).every((m) => m.amount >= 0),
        "negative ageing band",
      );
    });
    await step(`${who} knowledge`, async () =>
      expect((await api.knowledge.list()).length >= 30, "too few knowledge items"),
    );
    await step(`${who} documents`, async () =>
      expect((await api.documents.list()).length > 0, "no documents"),
    );
    await step(`${who} threads`, async () => {
      const threads = await api.messages.threads();
      expect(threads.length > 0, "no threads");
      const detail = await api.messages.thread(threads[0]!.id);
      expect(detail.messages.length > 0 && detail.unreadCount === 0, "thread not readable");
    });
    await step(`${who} notifications`, () => api.notifications.list());
    await step(`${who} insights`, async () => {
      const insights = await api.ai.insights();
      expect(insights.length > 0, "no insights");
      expect(
        insights.every((i) => i.simulated),
        "insight not labelled simulated",
      );
    });
    if (supplier) {
      await step(`${who} rfqs`, async () =>
        expect((await api.quotes.rfqs()).length > 0, "no RFQs"),
      );
      await step(`${who} purchase orders`, async () => {
        const pos = await api.orders.purchaseOrders();
        expect(pos.length > 0, "no POs");
        await api.orders.purchaseOrder(pos[0]!.id);
      });
      await step(`${who} payment runs`, async () =>
        expect((await api.invoices.paymentRuns()).length > 0, "no payment runs"),
      );
      await step(`${who} forecast`, async () =>
        expect((await api.stock.forecast()).length > 0, "no forecast"),
      );
      await step(`${who} supplier products`, async () =>
        expect((await api.supplierProducts.list()).length > 0, "no submissions"),
      );
      await step(`${who} offers`, async () =>
        expect((await api.supplierProducts.offers()).length > 0, "no offers"),
      );
      await step(`${who} customer endpoints refused`, async () => {
        let refused = false;
        await api.quotes.list().catch(() => (refused = true));
        expect(refused, "supplier could list quotes");
      });
    } else {
      await step(`${who} quotes`, () => api.quotes.list());
      await step(`${who} sales orders`, async () => {
        const orders = await api.orders.salesOrders();
        expect(orders.length > 0, "no orders");
        await api.orders.salesOrder(orders[0]!.id);
      });
      await step(`${who} configurations`, () => api.configurator.list());
      await step(`${who} jobs`, () => api.jobs.list());
      await step(`${who} cases`, () => api.cases.list());
      await step(`${who} basket`, () => api.shop.basket());
    }
  }

  // ---- Customer journey on account: configurator → quote → order ----------------
  as("Olivia Bennett");
  await step("assistant answers the Premium Lager question", async () => {
    const answer = await api.ai.ask({
      question: "What's the latest on the Premium Lager font order?",
    });
    expect(
      answer.sources.some((s) => s.relatedType === "sales-order"),
      `no order source: ${answer.answer.join(" ")}`,
    );
    expect(
      answer.answer.some((a) => /back order/i.test(a)),
      "answer does not mention the back order",
    );
  });
  await step("assistant answers a product question", async () => {
    const answer = await api.ai.ask({ question: "Pipeline Purple cleaning powder" });
    expect(
      answer.sources.some((s) => s.relatedType === "product"),
      answer.answer.join(" "),
    );
  });
  await step("assistant summarises outstanding orders", async () => {
    const answer = await api.ai.ask({ question: "What's the latest on my outstanding orders?" });
    const open = (await api.orders.salesOrders()).filter((o) =>
      ["confirmed", "picking", "dispatched", "part-delivered"].includes(o.status),
    );
    expect(
      answer.sources.filter((s) => s.relatedType === "sales-order").length ===
        Math.min(open.length, 6),
      answer.answer.join(" "),
    );
  });
  await step("assistant lists a product range", async () => {
    const answer = await api.ai.ask({
      question: "Can you show me what Coolflow options are available?",
    });
    expect(
      answer.sources.length > 1 &&
        answer.sources.every((s) => s.relatedType === "product" && /coolflow/i.test(s.label)),
      answer.answer.join(" "),
    );
  });
  const createdConfig = await step("create configuration", async () => {
    const rules = await api.configurator.rules();
    const address = (await api.account.addresses()).find((a) => a.isDefault)!;
    const config = await api.configurator.create({
      name: "Smoke test bar",
      siteAddressId: address.id,
      venueType: "pub",
      selections: {
        venue: { newSite: null },
        dispense: {
          points: [{ id: "pt-1", name: "Main bar", taps: ["lager", "lager"] }],
          optionIds: ["o-tap-fc4-chrome", "o-coupler-s"],
        },
        font: { optionIds: ["o-font-cobra-pl-led"], branding: null },
        cooling: { optionIds: ["o-cooler-v15", "o-python-2"], pythonMetres: 12 },
        gas: { optionIds: ["o-gas-co2", "o-gas-chain"] },
        ancillaries: { optionIds: ["o-drip-standard", "o-clean-s"] },
      },
    });
    expect(Object.keys(validateConfiguration(config, rules)).length === 0, "configuration invalid");
    expect(config.lines.length >= 8 && config.total.amount > 0, "BOM empty");
    return config;
  });
  const draftQuote =
    createdConfig &&
    (await step("request quote from configuration", () =>
      api.configurator.requestQuote(createdConfig.id),
    ));
  await step("configuration quote is ready to accept with BOM lines and PDF", async () => {
    expect(
      draftQuote &&
        draftQuote.status === "sent" &&
        draftQuote.pdfDocumentId &&
        draftQuote.lines.length === createdConfig!.lines.length,
      "quote lines do not match BOM",
    );
    const doc = await api.documents.get(draftQuote!.pdfDocumentId!);
    expect(doc.relatedId === draftQuote!.id, "quote PDF not linked");
  });
  const sent = (await api.quotes.list()).filter((q) => q.status === "sent");
  const accepted = await step("accept a sent quote", async () => {
    const result = await api.quotes.accept(sent[0]!.id);
    expect(
      result.quote.status === "accepted" && result.salesOrder.quoteId === sent[0]!.id,
      "not converted",
    );
    return result;
  });
  await step("decline a sent quote", async () =>
    expect(
      (await api.quotes.decline(sent[1]!.id, { reason: "Postponed until the spring refit." }))
        .status === "declined",
      "not declined",
    ),
  );
  await step("change request before dispatch", async () => {
    const order = accepted!.salesOrder;
    const change = await api.orders.requestChange(order.id, {
      kind: "date",
      requested: new Date(Date.now() + 20 * 86_400_000).toISOString().slice(0, 10),
      reason: "Venue opening moved.",
    });
    expect(change.status === "pending", "not pending");
    const detail = await api.orders.salesOrder(order.id);
    expect(
      detail.changeRequests.some((c) => c.id === change.id),
      "change request not on order",
    );
  });
  await step("change request refused after dispatch", async () => {
    const delivered = (await api.orders.salesOrders()).find((o) => o.status === "delivered")!;
    let refused = false;
    await api.orders
      .requestChange(delivered.id, { kind: "date", requested: "2099-01-01", reason: null })
      .catch(() => (refused = true));
    expect(refused, "change accepted after delivery");
  });
  const onAccountOrder = await step("shop checkout on account", async () => {
    const product = (await api.priceList.get()).lines.find(
      (l) => l.stock?.status === "in-stock",
    )!.product;
    await api.shop.addToBasket({ productId: product.id, qty: 2 });
    await api.shop.updateBasket({ poReference: "SMOKE-1" });
    const address = (await api.account.addresses()).find((a) => a.isDefault)!;
    const order = await api.shop.checkout({
      deliveryAddressId: address.id,
      requestedDate: new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10),
      poReference: "SMOKE-1",
      notes: "Deliver to the goods-in door.",
      paymentMethod: "account",
      card: null,
    });
    expect(
      order.status === "confirmed" && (await api.shop.basket()).lines.length === 0,
      "checkout did not clear basket",
    );
    return order;
  });
  await step("quote the basket instead of checking out", async () => {
    const product = (await api.priceList.get()).lines.find(
      (l) => l.stock?.status === "in-stock",
    )!.product;
    await api.shop.addToBasket({ productId: product.id, qty: 6 });
    const quote = await api.shop.requestQuote({ notes: "Pricing for the summer terrace bar." });
    expect(
      quote.status === "sent" && quote.lines[0]!.productId === product.id,
      "basket not quoted",
    );
    expect((await api.shop.basket()).lines.length === 0, "basket not cleared");
    const result = await api.quotes.accept(quote.id);
    expect(result.salesOrder.status === "confirmed", "accepting basket quote made no order");
  });
  await step("Brewfitt packs, ships, invoices and delivers a portal order", async () => {
    const order = onAccountOrder!;
    const start = Date.parse(order.createdAt);
    const minute = 60_000;
    const statusAt = async (minutes: number) => {
      advanceJourneys(getDb(), start + minutes * minute);
      return api.orders.salesOrder(order.id);
    };
    expect((await statusAt(JOURNEY_MINUTES.pack - 1)).status === "confirmed", "packed too early");
    expect((await statusAt(JOURNEY_MINUTES.pack)).status === "picking", "not packed");
    const shipped = await statusAt(JOURNEY_MINUTES.ship);
    expect(shipped.status === "dispatched", "not dispatched");
    const deliveries = (await api.deliveries.list()).filter((d) => d.orderId === order.id);
    expect(deliveries.length === 1 && deliveries[0]!.trackingRef, "no delivery with tracking");
    const invoices = (await api.invoices.list()).filter((i) => i.orderId === order.id);
    expect(
      invoices.length === 1 && invoices[0]!.status === "open",
      "credit account not invoiced on dispatch",
    );
    const delivered = await statusAt(JOURNEY_MINUTES.deliver);
    expect(
      delivered.status === "delivered" && delivered.lines.every((l) => l.delivered === l.qty),
      "not delivered",
    );
    await statusAt(JOURNEY_MINUTES.deliver + 60);
    expect(
      (await api.invoices.list()).filter((i) => i.orderId === order.id).length === 1 &&
        (await api.deliveries.list()).filter((d) => d.orderId === order.id).length === 1,
      "journey stages applied twice",
    );
    // Stage times are simulated ahead of the real clock, so read the store (the API hides future notifications).
    const kinds = getDb()
      .notifications.filter((n) => n.relatedId === order.id)
      .map((n) => n.kind);
    expect(
      kinds.includes("order-dispatched") && kinds.includes("order-delivered"),
      "no notifications",
    );
  });
  await step("raise and close a case", async () => {
    const order = (await api.orders.salesOrders())[0]!;
    const c = await api.cases.create({
      kind: "fault",
      urgency: "high",
      subject: "Smoke test fault",
      description: "The font is fobbing on every first pour since installation.",
      productId: order.lines[0]!.productId,
      orderId: order.id,
      jobId: null,
      purchaseOrderId: null,
      invoiceId: null,
      photos: [],
    });
    expect((await api.cases.update(c.id, { status: "closed" })).status === "closed", "not closed");
  });
  await step("send a message and start a thread", async () => {
    const thread = await api.messages.createThread({
      subject: "Smoke test question",
      body: "Can you confirm the delivery window?",
      relatedType: null,
      relatedId: null,
    });
    const msg = await api.messages.send(thread.id, {
      body: "Following up on this.",
      attachments: [],
    });
    expect(
      (await api.messages.thread(thread.id)).messages.some((m) => m.id === msg.id),
      "message missing",
    );
  });
  await step("notification read and dismiss", async () => {
    const n = (await api.notifications.list())[0]!;
    expect((await api.notifications.update(n.id, { read: true })).read, "not read");
    await api.notifications.update(n.id, { dismissed: true });
    expect(!(await api.notifications.list()).some((x) => x.id === n.id), "not dismissed");
  });
  await step("account edits are pending approval", async () => {
    const account = await api.account.update({ vatNumber: "GB 999 9999 99" });
    expect(
      account.pendingChanges.some((c) => c.field === "vatNumber" && c.status === "pending") &&
        account.vatNumber !== "GB 999 9999 99",
      "edit applied without approval",
    );
    const address = await api.account.createAddress({
      label: "Pop-up bar",
      line1: "1 Market Street",
      line2: null,
      town: "Leeds",
      county: "West Yorkshire",
      postcode: "LS1 6DT",
      country: "GB",
      isDefault: false,
      deliveryNotes: null,
    });
    expect(address.approvalStatus === "pending", "address not pending");
  });

  // ---- Customer without credit terms: card checkout and invoice payment ---------
  as("Kerry Flanagan");
  await step("card checkout required", async () => {
    const address = (await api.account.addresses()).find((a) => a.isDefault)!;
    const basket = await api.shop.basket();
    expect(basket.lines.length > 0, "seeded basket empty");
    let refused = false;
    await api.shop
      .checkout({
        deliveryAddressId: address.id,
        requestedDate: "2099-01-10",
        poReference: null,
        notes: null,
        paymentMethod: "account",
        card: null,
      })
      .catch(() => (refused = true));
    expect(refused, "non-account customer checked out on account");
    const order = await api.shop.checkout({
      deliveryAddressId: address.id,
      requestedDate: new Date(Date.now() + 4 * 86_400_000).toISOString().slice(0, 10),
      poReference: null,
      notes: null,
      paymentMethod: "card",
      card: { nameOnCard: "K Flanagan", last4: "4242" },
    });
    const invoice = (await api.invoices.list()).find((i) => i.orderId === order.id);
    expect(invoice && invoice.status === "paid", "card order invoice not paid");
  });
  await step("pay an open invoice by card", async () => {
    const open = (await api.invoices.list()).find((i) => i.outstanding.amount > 0)!;
    expect(open, "no open invoice to pay");
    const { invoice } = await api.invoices.pay(open.id, {
      card: { nameOnCard: "K Flanagan", last4: "4242" },
    });
    expect(invoice.status === "paid" && invoice.outstanding.amount === 0, "not paid");
  });

  // ---- Pub group: site scope and group roll-up -----------------------------------
  as("Jess Armitage");
  const siteOrders = (await api.orders.salesOrders()).length;
  const group = as("Andrew Hirst");
  await step("group roll-up includes every site", async () => {
    const me = await api.session.me();
    expect(me.group && me.group.sites.length >= 4, "no sites");
    const all = await api.orders.salesOrders();
    expect(all.length > siteOrders, "roll-up not larger than one site");
    usePersonaStore.getState().setActiveSite("acc_millrace_weavers");
    expect(
      (await api.orders.salesOrders()).length === siteOrders,
      "switching into a site did not scope orders",
    );
    expect(
      (await api.priceList.get()).priceList.id === "pl_pubgroup",
      "site does not use the group price list",
    );
    usePersonaStore.getState().setPersona(group.persona);
  });

  // ---- Supplier journey --------------------------------------------------------
  as("Neil Chapman");
  await step("respond to an RFQ", async () => {
    const rfq = (await api.quotes.rfqs()).find((r) => r.status === "open")!;
    const response = await api.quotes.respondToRfq(rfq.id, {
      lines: rfq.lines.map((l) => ({
        productId: l.productId,
        price: { amount: 12_500, currency: "GBP" },
        leadTimeDays: 10,
      })),
      notes: "Price held for 60 days.",
    });
    expect(
      (await api.quotes.rfqs()).find((r) => r.id === rfq.id)?.response?.id === response.id,
      "response not recorded",
    );
  });
  await step("acknowledge a purchase order", async () => {
    const po = (await api.orders.purchaseOrders()).find((p) => p.status === "issued");
    if (po)
      expect((await api.orders.acknowledge(po.id)).status === "acknowledged", "not acknowledged");
  });
  await step("submit and resubmit a product", async () => {
    const category = (await api.products.categories())[0]!;
    const product = await api.supplierProducts.create({
      name: "Cobra B 6 Out Chrome LED",
      sku: "VIR-6OUT",
      category: category.id,
      images: ["/products/cobra-4-out-chrome-led.jpg"],
      brandingAssets: [],
      specSheetFileName: "Cobra B 6 Out spec sheet.pdf",
      costPrice: { amount: 38_000, currency: "GBP" },
      leadTimeDays: 14,
      minimumOrder: 2,
    });
    expect(
      product.status === "submitted" && product.specSheetDocumentId,
      "not submitted with spec sheet",
    );
    expect(
      (await api.supplierProducts.update(product.id, { leadTimeDays: 12 })).leadTimeDays === 12,
      "not updated",
    );
  });
  await step("create an offer", async () => {
    const own = await api.products.list();
    const offer = await api.supplierProducts.createOffer({
      productIds: [own[0]!.id],
      description: "Autumn price on single fonts.",
      price: { amount: 9_900, currency: "GBP" },
      validFrom: "2099-01-01",
      validTo: "2099-02-01",
    });
    expect(offer.status === "submitted", "offer not submitted");
  });
  await step("submit a knowledge article", async () => {
    const own = await api.products.list();
    const item = await api.knowledge.submit({
      title: "Fitting a Cobra font clamp",
      type: "guide",
      category: own[0]!.category,
      productIds: [own[0]!.id],
      summary: "How to fit and tighten the clamp assembly on a Cobra font.",
      fileName: null,
      videoUrl: null,
    });
    expect(
      (await api.knowledge.list()).some((k) => k.id === item.id),
      "supplier cannot see own submission",
    );
  });
  await step("supplier raises a Supplier Support issue", async () => {
    const po = (await api.orders.purchaseOrders())[0]!;
    const before = (await api.cases.list()).length;
    const issue = await api.cases.create({
      kind: "purchase-order",
      urgency: "normal",
      subject: "Delivery address on purchase order",
      description:
        "The purchase order shows the old warehouse address; please confirm where to deliver.",
      productId: null,
      orderId: null,
      jobId: null,
      purchaseOrderId: po.id,
      invoiceId: null,
      photos: [],
    });
    expect(issue.purchaseOrderId === po.id, "PO not linked");
    expect((await api.cases.list()).length === before + 1, "issue not listed");
    let refused = false;
    await api.cases
      .create({
        kind: "fault",
        urgency: "low",
        subject: "Wrong kind",
        description: "Suppliers should not be able to raise customer faults.",
        productId: null,
        orderId: null,
        jobId: null,
        purchaseOrderId: po.id,
        invoiceId: null,
        photos: [],
      })
      .catch(() => (refused = true));
    expect(refused, "supplier raised a customer fault");
  });
  await step("supplier assistant answers about a purchase order", async () => {
    const po = (await api.orders.purchaseOrders())[0]!;
    const answer = await api.ai.ask({ question: `Where is ${po.number}?` });
    expect(
      answer.sources.some((s) => s.relatedType === "purchase-order"),
      answer.answer.join(" "),
    );
  });

  // ---- Persistence: reload replays the change log ------------------------------------
  await step("changes survive a reload", async () => {
    reloadDb();
    as("Olivia Bennett");
    const orders = await api.orders.salesOrders();
    expect(
      onAccountOrder && orders.some((o) => o.id === onAccountOrder.id),
      "checkout order lost on reload",
    );
    expect(
      accepted && (await api.quotes.get(accepted.quote.id)).status === "accepted",
      "accepted quote lost on reload",
    );
    expect(
      createdConfig && (await api.configurator.get(createdConfig.id)).status === "quoted",
      "configuration lost on reload",
    );
    expect(
      onAccountOrder && (await api.orders.salesOrder(onAccountOrder.id)).status === "delivered",
      "journey progress lost on reload",
    );
  });
  await step("reset demo data clears changes", async () => {
    await api.demo.reset();
    as("Olivia Bennett");
    expect(
      !(await api.orders.salesOrders()).some((o) => o.id === onAccountOrder?.id),
      "reset did not clear changes",
    );
  });

  console.log(`${passed} checks passed, ${failures.length} failed`);
  for (const f of failures) console.log(`  ✗ ${f}`);
  process.exit(failures.length ? 1 : 0);
}

void main();

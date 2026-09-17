import type {
  AgeingBand,
  Delivery,
  Invoice,
  Payment,
  PaymentRun,
  PurchaseOrder,
  SalesOrder,
} from "@/types";
import { addDays, daysBetween, isoDate, isoDateTime, toDate } from "../clock";
import { dueDate, money, type SeedContext } from "./context";
import { SELF_BILLING_SUPPLIERS } from "./purchasing";

/** Aged by invoice date: current < 30 days, then 30, 60, 90+. */
export function ageingBandFor(issuedAt: string, today: Date): AgeingBand {
  const age = daysBetween(issuedAt, today);
  if (age < 30) return "current";
  if (age < 60) return "30";
  if (age < 90) return "60";
  return "90+";
}

/** Read-time status: an open or part-paid invoice past its due date is overdue. */
export function deriveInvoice(invoice: Invoice, today: Date): Invoice {
  const past = toDate(invoice.dueAt).getTime() < today.getTime();
  const open = invoice.kind !== "credit-note" && invoice.outstanding.amount > 0;
  const base =
    invoice.status === "overdue"
      ? invoice.outstanding.amount < invoice.total.amount
        ? "part-paid"
        : "open"
      : invoice.status;
  return {
    ...invoice,
    status: open && past ? "overdue" : base,
    ageingBand: ageingBandFor(invoice.issuedAt, today),
  };
}

export type FinanceSeed = { invoices: Invoice[]; payments: Payment[]; paymentRuns: PaymentRun[] };

const LATE_PAYERS = new Set(["acc_northlight", "acc_millrace_navigation"]);

export function seedFinance(
  ctx: SeedContext,
  args: {
    salesOrders: SalesOrder[];
    deliveries: Delivery[];
    purchaseOrders: PurchaseOrder[];
    inboundDeliveries: Delivery[];
    cardPaidOrderIds: Set<string>;
  },
): FinanceSeed {
  const { rng, today } = ctx;
  const invoices: Invoice[] = [];
  const payments: Payment[] = [];
  const orderById = new Map(args.salesOrders.map((o) => [o.id, o]));

  const gross = (accountId: string, net: number) => Math.round(net * (1 + ctx.vatRate(accountId)));

  const addInvoice = (inv: Omit<Invoice, "id" | "number" | "ageingBand">): Invoice => {
    const full: Invoice = {
      ...inv,
      id: `inv_${invoices.length + 1}`,
      number: "",
      ageingBand: ageingBandFor(inv.issuedAt, today),
    };
    invoices.push(full);
    return full;
  };

  // ---- Sales invoices ---------------------------------------------------------
  for (const order of args.salesOrders) {
    if (order.status === "cancelled") continue;
    const account = ctx.account(order.accountId);
    if (args.cardPaidOrderIds.has(order.id)) {
      // Not on account: invoiced and paid by card when the order is placed.
      const issued = new Date(order.createdAt);
      const net = order.lines.reduce((s, l) => s + l.qty * l.price.amount, 0);
      addInvoice({
        accountId: order.accountId,
        kind: "invoice",
        status: "paid",
        issuedAt: order.createdAt,
        dueAt: isoDateTime(issued, 23, 59),
        total: money(gross(order.accountId, net)),
        outstanding: money(0),
        orderId: order.id,
        orderType: "sales",
        pdfDocumentId: null,
      });
      continue;
    }
    for (const d of args.deliveries.filter((x) => x.orderId === order.id && x.deliveredAt)) {
      const net = d.lines.reduce(
        (s, l) => s + l.qty * order.lines.find((ol) => ol.productId === l.productId)!.price.amount,
        0,
      );
      const issued = new Date(d.deliveredAt!);
      addInvoice({
        accountId: order.accountId,
        kind: "invoice",
        status: "open",
        issuedAt: isoDateTime(issued, 18),
        dueAt: isoDateTime(dueDate(issued, account.paymentTerms), 23, 59),
        total: money(gross(order.accountId, net)),
        outstanding: money(gross(order.accountId, net)),
        orderId: order.id,
        orderType: "sales",
        pdfDocumentId: null,
      });
    }
  }

  // Customers not on account: the most recent Crown & Anchor order awaits card payment.
  const crownOrders = args.salesOrders
    .filter((o) => o.accountId === "acc_crown" && o.status !== "cancelled")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const crownInvoice = crownOrders[0]
    ? invoices.find((i) => i.orderId === crownOrders[0]!.id)
    : undefined;
  if (crownInvoice) {
    crownInvoice.status = "open";
    crownInvoice.outstanding = crownInvoice.total;
    crownInvoice.dueAt = isoDateTime(addDays(today, 3), 23, 59);
  }

  // ---- Customer payments ----------------------------------------------------
  const salesInvoices = invoices
    .filter((i) => i.orderType === "sales" && i.status === "open")
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  const lateHeld = new Set<string>();
  for (const accountId of LATE_PAYERS) {
    // Leave the late payer's oldest recent invoices unpaid, one of them more than 30 days overdue.
    const candidates = salesInvoices
      .filter((i) => i.accountId === accountId && daysBetween(i.dueAt, today) > 0)
      .slice(-3);
    for (const i of candidates) lateHeld.add(i.id);
  }
  const partPaid = salesInvoices.find(
    (i) => i.accountId === "acc_pennine" && daysBetween(i.dueAt, today) < 0,
  );

  const pendingByAccountDate = new Map<
    string,
    { accountId: string; paidAt: Date; invoices: Invoice[] }
  >();
  for (const inv of salesInvoices) {
    if (inv.id === crownInvoice?.id || lateHeld.has(inv.id)) continue;
    const account = ctx.account(inv.accountId);
    const due = new Date(inv.dueAt);
    const offset =
      account.relationshipHealth === "strong"
        ? rng.int(-4, 1)
        : account.relationshipHealth === "steady"
          ? rng.int(-2, 9)
          : rng.int(5, 25);
    const paidAt = addDays(due, offset);
    if (paidAt.getTime() > today.getTime()) continue;
    // Month-end payers settle a month's invoices in one payment.
    const key =
      account.paymentTerms === "30-days-eom"
        ? `${inv.accountId}|${isoDate(due)}`
        : `${inv.accountId}|${inv.id}`;
    const group = pendingByAccountDate.get(key) ?? {
      accountId: inv.accountId,
      paidAt,
      invoices: [],
    };
    group.invoices.push(inv);
    pendingByAccountDate.set(key, group);
  }

  const addPayment = (p: Omit<Payment, "id">) => {
    const payment: Payment = { ...p, id: `pay_${payments.length + 1}` };
    payments.push(payment);
    return payment;
  };

  for (const group of pendingByAccountDate.values()) {
    const allocations = group.invoices.map((inv) => {
      const amount = inv === partPaid ? Math.round(inv.total.amount / 2) : inv.outstanding.amount;
      inv.outstanding = money(inv.outstanding.amount - amount);
      inv.status = inv.outstanding.amount === 0 ? "paid" : "part-paid";
      return { invoiceId: inv.id, amount: money(amount) };
    });
    const total = allocations.reduce((s, a) => s + a.amount.amount, 0);
    addPayment({
      accountId: group.accountId,
      amount: money(total),
      method: rng.chance(0.2) ? "direct-debit" : "bacs",
      reference: "",
      paidAt: isoDateTime(
        group.paidAt.getTime() > today.getTime() ? today : group.paidAt,
        rng.int(8, 11),
        0,
      ),
      allocatedTo: allocations,
      remittanceDocumentId: null,
    });
  }
  // Card payments for orders placed without an account.
  for (const inv of invoices.filter(
    (i) =>
      i.status === "paid" &&
      args.cardPaidOrderIds.has(i.orderId) &&
      !payments.some((p) => p.allocatedTo.some((a) => a.invoiceId === i.id)),
  )) {
    addPayment({
      accountId: inv.accountId,
      amount: inv.total,
      method: "card",
      reference: "",
      paidAt: inv.issuedAt,
      allocatedTo: [{ invoiceId: inv.id, amount: inv.total }],
      remittanceDocumentId: null,
    });
  }

  // ---- Credit notes ---------------------------------------------------------
  const creditable = invoices.filter(
    (i) =>
      i.orderType === "sales" &&
      i.kind === "invoice" &&
      daysBetween(i.issuedAt, today) > 25 &&
      daysBetween(i.issuedAt, today) < 200,
  );
  const creditAccounts = new Set<string>();
  const creditTargets = rng.shuffle(creditable).filter((i) => {
    if (creditAccounts.has(i.accountId) || args.cardPaidOrderIds.has(i.orderId)) return false;
    creditAccounts.add(i.accountId);
    return true;
  });
  const harbourCredit = creditable.find((i) => i.accountId === "acc_harbourside");
  const targets = [...new Set([...(harbourCredit ? [harbourCredit] : []), ...creditTargets])].slice(
    0,
    7,
  );
  targets.forEach((original, index) => {
    const order = orderById.get(original.orderId)!;
    const line = order.lines[order.lines.length - 1]!;
    const net = line.price.amount;
    const total = money(gross(original.accountId, net));
    const issued = addDays(new Date(original.issuedAt), rng.int(4, 14));
    // The last credit stays unallocated as credit on account; the rest reduce the original invoice.
    const allocate = index < targets.length - 1;
    const credit = addInvoice({
      accountId: original.accountId,
      kind: "credit-note",
      status: allocate ? "allocated" : "open",
      issuedAt: isoDateTime(issued, 15),
      dueAt: isoDateTime(issued, 15),
      total,
      outstanding: allocate ? money(0) : total,
      orderId: original.orderId,
      orderType: "sales",
      pdfDocumentId: null,
    });
    if (allocate) {
      const applied = Math.min(total.amount, original.outstanding.amount);
      if (applied > 0) {
        // Any credit left after clearing the invoice stays on account.
        if (applied < total.amount) {
          credit.status = "open";
          credit.outstanding = money(total.amount - applied);
        }
        original.outstanding = money(original.outstanding.amount - applied);
        original.status = original.outstanding.amount === 0 ? "paid" : "part-paid";
        addPayment({
          accountId: original.accountId,
          amount: money(applied),
          method: "credit-allocation",
          reference: "",
          paidAt: credit.issuedAt,
          allocatedTo: [{ invoiceId: original.id, amount: money(applied) }],
          remittanceDocumentId: null,
        });
      } else {
        // Original already paid in full: the credit stays on account.
        credit.status = "open";
        credit.outstanding = total;
      }
    }
  });

  // ---- Supplier invoices and payment runs -----------------------------------
  const poById = new Map(args.purchaseOrders.map((p) => [p.id, p]));
  for (const d of args.inboundDeliveries.filter((x) => x.deliveredAt)) {
    const po = poById.get(d.orderId)!;
    const supplier = ctx.account(po.supplierId);
    const net = d.lines.reduce(
      (s, l) => s + l.qty * po.lines.find((pl) => pl.productId === l.productId)!.price.amount,
      0,
    );
    const issued = new Date(d.deliveredAt!);
    addInvoice({
      accountId: po.supplierId,
      kind: SELF_BILLING_SUPPLIERS.has(po.supplierId) ? "self-bill" : "invoice",
      status: "open",
      issuedAt: isoDateTime(issued, 17),
      dueAt: isoDateTime(dueDate(issued, supplier.paymentTerms), 23, 59),
      total: money(gross(po.supplierId, net)),
      outstanding: money(gross(po.supplierId, net)),
      orderId: po.id,
      orderType: "purchase",
      pdfDocumentId: null,
    });
  }

  // Brewfitt pays suppliers in a run every other Friday.
  const runDates: Date[] = [];
  let friday = addDays(today, (5 - today.getUTCDay() + 7) % 7 || 7);
  if (rng.chance(0.5)) friday = addDays(friday, 7);
  // Brewfitt's payment calendar runs about nine weeks ahead.
  for (
    let d = addDays(friday, 14 * 4);
    d.getTime() > addDays(today, -420).getTime();
    d = addDays(d, -14)
  )
    runDates.push(d);
  runDates.sort((a, b) => a.getTime() - b.getTime());

  const runInvoices = new Map<number, Invoice[]>();
  const supplierInvoices = invoices
    .filter((i) => i.orderType === "purchase")
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  for (const inv of supplierInvoices) {
    const due = new Date(inv.dueAt);
    // The last run on or before the due date (or the first after it).
    const index = runDates.findLastIndex((r) => r.getTime() <= due.getTime());
    const runIndex = index >= 0 ? index : 0;
    // Invoices due after the last planned run are not yet scheduled.
    if (due.getTime() > runDates[runDates.length - 1]!.getTime() + 14 * 86_400_000) continue;
    runInvoices.set(runIndex, [...(runInvoices.get(runIndex) ?? []), inv]);
  }

  const paymentRuns: PaymentRun[] = [];
  for (const [index, list] of [...runInvoices.entries()].sort((a, b) => a[0] - b[0])) {
    const date = runDates[index]!;
    const paid = date.getTime() <= today.getTime();
    const run: PaymentRun = {
      id: `run_${paymentRuns.length + 1}`,
      scheduledFor: isoDate(date),
      total: money(list.reduce((s, i) => s + i.outstanding.amount, 0)),
      invoiceIds: list.map((i) => i.id),
      status: paid ? "paid" : "scheduled",
    };
    paymentRuns.push(run);
    if (!paid) continue;
    const bySupplier = new Map<string, Invoice[]>();
    for (const inv of list)
      bySupplier.set(inv.accountId, [...(bySupplier.get(inv.accountId) ?? []), inv]);
    for (const [supplierId, supplierList] of bySupplier) {
      const allocations = supplierList.map((inv) => ({
        invoiceId: inv.id,
        amount: inv.outstanding,
      }));
      for (const inv of supplierList) {
        inv.outstanding = money(0);
        inv.status = "paid";
      }
      addPayment({
        accountId: supplierId,
        amount: money(allocations.reduce((s, a) => s + a.amount.amount, 0)),
        method: "bacs",
        reference: "",
        paidAt: isoDateTime(date, 10),
        allocatedTo: allocations,
        remittanceDocumentId: null,
      });
    }
  }

  // ---- Numbers --------------------------------------------------------------
  invoices.sort((a, b) => a.issuedAt.localeCompare(b.issuedAt));
  for (const inv of invoices) {
    inv.number =
      inv.kind === "credit-note"
        ? ctx.number("creditNote")
        : inv.kind === "self-bill"
          ? ctx.number("selfBill")
          : inv.orderType === "purchase"
            ? ctx.number("supplierInvoice")
            : ctx.number("invoice");
  }
  payments.sort((a, b) => a.paidAt.localeCompare(b.paidAt));
  const runNumber = new Map(paymentRuns.map((r) => [r.id, ctx.number("paymentRun")]));
  for (const p of payments) {
    const run = paymentRuns.find(
      (r) =>
        r.status === "paid" &&
        p.allocatedTo.every((a) => r.invoiceIds.includes(a.invoiceId)) &&
        ctx.account(p.accountId).kind === "supplier",
    );
    const invoiceNumbers = p.allocatedTo.map(
      (a) => invoices.find((i) => i.id === a.invoiceId)!.number,
    );
    p.reference =
      p.method === "credit-allocation"
        ? `Credit applied to ${invoiceNumbers.join(", ")}`
        : p.method === "card"
          ? `Card payment ${invoiceNumbers[0]}`
          : run
            ? `Payment run ${runNumber.get(run.id)}`
            : `${ctx.number("payment")} ${invoiceNumbers.length > 1 ? `(${invoiceNumbers.length} invoices)` : invoiceNumbers[0]}`;
  }

  return { invoices, payments, paymentRuns };
}

import type { Delivery, Document, Invoice, Message, Notification, SalesOrder } from "@/types";
import { formatDate } from "@/lib/format";
import { isoDateTime } from "../clock";
import { commit, newId, nextNumber, type MockDb } from "../db";
import { insert, patch, type Change } from "../mutations";
import { dueDate } from "../seed/context";
import { account, stockStatus, vatRate } from "./helpers";

/**
 * Decision 11: Brewfitt's side of a portal order. After a customer checks out
 * or accepts a quote, Brewfitt packs the order, ships it (delivery note,
 * tracking and, for credit accounts, the invoice) and it is delivered. In the
 * mock these happen on their own after short, demo-friendly delays measured
 * from the order time. Phase 2 replaces this with real status from TOTA360v5.
 */
export const JOURNEY_MINUTES = { pack: 2, ship: 5, deliver: 15 } as const;

const MINUTE = 60_000;

/** Start Brewfitt's handling for an order created in the portal. */
export function startJourney(order: SalesOrder): Change {
  return insert("journeys", { orderId: order.id, startedAt: order.createdAt });
}

/**
 * Apply any stage that has fallen due. Runs before every API response; each
 * stage checks the order's current status, so it is applied exactly once and
 * replays from the demo log like any other change.
 */
export function advanceJourneys(db: MockDb, nowMs = Date.now()): void {
  for (const journey of db.journeys) {
    const start = Date.parse(journey.startedAt);
    const at = (minutes: number) => new Date(start + minutes * MINUTE).toISOString();
    const current = () => db.salesOrders.find((o) => o.id === journey.orderId);

    let order = current();
    if (order?.status === "confirmed" && nowMs >= start + JOURNEY_MINUTES.pack * MINUTE) {
      commit("journey.pack", [patch("salesOrders", order.id, { status: "picking" })]);
      order = current();
    }
    if (order?.status === "picking" && nowMs >= start + JOURNEY_MINUTES.ship * MINUTE) {
      commit("journey.ship", shipChanges(db, order, at(JOURNEY_MINUTES.ship)));
      order = current();
    }
    if (order?.status === "dispatched" && nowMs >= start + JOURNEY_MINUTES.deliver * MINUTE) {
      commit("journey.deliver", deliverChanges(db, order, at(JOURNEY_MINUTES.deliver)));
    }
  }
}

function document(
  order: SalesOrder,
  fields: Pick<Document, "name" | "category" | "relatedType" | "relatedId" | "fileType">,
  at: string,
  size: number,
): Document {
  return {
    id: newId("doc"),
    ...fields,
    ownerAccountId: order.accountId,
    fileSize: size,
    expiresAt: null,
    approvalStatus: null,
    modifiedAt: at,
  };
}

function notification(
  order: SalesOrder,
  kind: Notification["kind"],
  title: string,
  body: string,
  at: string,
): Notification {
  return {
    id: newId("ntf"),
    accountId: order.accountId,
    kind,
    title,
    body,
    relatedType: "sales-order",
    relatedId: order.id,
    read: false,
    dismissed: false,
    createdAt: at,
  };
}

function brewfittMessage(
  db: MockDb,
  order: SalesOrder,
  body: string,
  at: string,
  attachments: string[],
): Change[] {
  const thread = db.threads.find((t) => t.id === order.threadId);
  const sender = thread?.participants.find((p) => p.side === "brewfitt");
  if (!thread || !sender) return [];
  const message: Message = {
    id: newId("msg"),
    threadId: thread.id,
    senderId: sender.id,
    senderSide: "brewfitt",
    channel: "email",
    body,
    attachments,
    sentAt: at,
  };
  return [
    insert("messages", message),
    patch("threads", thread.id, { lastMessageAt: at, unreadCount: thread.unreadCount + 1 }),
  ];
}

function shipChanges(db: MockDb, order: SalesOrder, at: string): Change[] {
  const exportAccount = vatRate(db, order.accountId) === 0;
  const carrier = exportAccount ? "DHL Freight" : "DPD";
  const trackingRef = `${carrier.slice(0, 3).toUpperCase()}${((Number(order.number.replace(/\D/g, "")) * 7919) % 90_000_000) + 10_000_000}`;
  const delivery: Delivery = {
    id: newId("del"),
    orderId: order.id,
    orderType: "sales",
    number: nextNumber("DN-", db.deliveries),
    status: "dispatched",
    carrier,
    trackingRef,
    dispatchedAt: at,
    deliveredAt: null,
    lines: order.lines.map((l) => ({ productId: l.productId, qty: l.qty })),
    noteDocumentId: null,
    proofDocumentId: null,
  };
  const note = document(
    order,
    {
      name: `Delivery note ${delivery.number}.pdf`,
      category: "delivery-note",
      relatedType: "delivery",
      relatedId: delivery.id,
      fileType: "pdf",
    },
    at,
    52_000,
  );
  delivery.noteDocumentId = note.id;
  const changes: Change[] = [
    insert("deliveries", delivery),
    insert("documents", note),
    patch("salesOrders", order.id, { status: "dispatched" }),
  ];

  // Stock leaves Brewfitt's warehouse: on hand and allocation both fall.
  for (const line of order.lines) {
    const st = db.stock.find((x) => x.productId === line.productId);
    if (!st) continue;
    const onHand = Math.max(0, st.onHand - line.qty);
    const allocated = Math.max(0, st.allocated - line.qty);
    changes.push(
      patch(
        "stock",
        st.productId,
        {
          onHand,
          allocated,
          available: onHand - allocated,
          status: stockStatus(onHand, allocated, st.onOrder, st.minimumLevel),
        },
        "productId",
      ),
    );
  }

  // Credit accounts are invoiced on dispatch; accounts without terms were invoiced when they ordered.
  const customer = account(db, order.accountId);
  const attachments = [note.id];
  let invoice: Invoice | null = null;
  if (customer.onAccount && !db.invoices.some((i) => i.orderId === order.id)) {
    const terms = customer.parentAccountId
      ? account(db, customer.parentAccountId).paymentTerms
      : customer.paymentTerms;
    invoice = {
      id: newId("inv"),
      accountId: order.accountId,
      number: nextNumber("INV-", db.invoices),
      kind: "invoice",
      status: "open",
      issuedAt: at,
      dueAt: isoDateTime(dueDate(new Date(at), terms), 23, 59),
      total: order.total,
      outstanding: order.total,
      ageingBand: "current",
      orderId: order.id,
      orderType: "sales",
      pdfDocumentId: null,
    };
    const pdf = document(
      order,
      {
        name: `Invoice ${invoice.number}.pdf`,
        category: "invoice",
        relatedType: "invoice",
        relatedId: invoice.id,
        fileType: "pdf",
      },
      at,
      61_000,
    );
    invoice.pdfDocumentId = pdf.id;
    attachments.push(pdf.id);
    changes.push(insert("invoices", invoice), insert("documents", pdf));
  }

  const tracking = trackingRef ? `, tracking ${trackingRef}` : "";
  changes.push(
    insert(
      "notifications",
      notification(
        order,
        "order-dispatched",
        `Order ${order.number} dispatched`,
        `Packed and on its way with ${carrier}${tracking}.`,
        at,
      ),
    ),
    ...brewfittMessage(
      db,
      order,
      `${order.number} has been packed and dispatched with ${carrier}${tracking}. The delivery note is attached${invoice ? `, with invoice ${invoice.number} due ${formatDate(invoice.dueAt)}` : ""}.`,
      at,
      attachments,
    ),
  );
  return changes;
}

function deliverChanges(db: MockDb, order: SalesOrder, at: string): Change[] {
  const delivery = db.deliveries.find((d) => d.orderId === order.id && !d.deliveredAt);
  if (!delivery) return [patch("salesOrders", order.id, { status: "delivered" })];
  const address = db.addresses.find((a) => a.id === order.deliveryAddressId);
  const proof = document(
    order,
    {
      name: `Proof of delivery ${delivery.number}.jpg`,
      category: "proof-of-delivery",
      relatedType: "delivery",
      relatedId: delivery.id,
      fileType: "jpg",
    },
    at,
    420_000,
  );
  return [
    insert("documents", proof),
    patch("deliveries", delivery.id, {
      status: "delivered",
      deliveredAt: at,
      proofDocumentId: proof.id,
    }),
    patch("salesOrders", order.id, {
      status: "delivered",
      lines: order.lines.map((l) => ({ ...l, delivered: l.qty, backordered: 0 })),
    }),
    insert(
      "notifications",
      notification(
        order,
        "order-delivered",
        `Order ${order.number} delivered`,
        `Signed for${address ? ` at ${address.label.toLowerCase()} (${address.town})` : ""}. Proof of delivery is on the order.`,
        at,
      ),
    ),
  ];
}

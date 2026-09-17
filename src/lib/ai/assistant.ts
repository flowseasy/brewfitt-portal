import type {
  AskResponse,
  AskSource,
  Case,
  Delivery,
  Invoice,
  Job,
  Message,
  Product,
  PurchaseOrder,
  Quote,
  SalesOrder,
  StockPosition,
  Thread,
} from "@/types";
import { formatDate, formatMoney, plural } from "@/lib/format";

/**
 * Deterministic assistant (BLUEPRINT.md: "Assistant answers are composed from
 * a template over the mock records matching the product or order named").
 * Only the account's own records are passed in, so answers never leak.
 */

export type AssistantRecords = {
  today: Date;
  products: Product[];
  quotes: Quote[];
  salesOrders: SalesOrder[];
  purchaseOrders: PurchaseOrder[];
  deliveries: Delivery[];
  jobs: Job[];
  cases: Case[];
  invoices: Invoice[];
  threads: Thread[];
  messages: Message[];
  stock: StockPosition[];
  participantName: (id: string) => string;
};

const STOP_WORDS = new Set([
  "what", "whats", "what's", "the", "latest", "on", "about", "with", "for", "is", "are", "my", "our", "an", "a", "of", "to",
  "where", "when", "status", "update", "order", "orders", "quote", "quotes", "any", "news", "how", "does", "did", "has",
  "have", "been", "this", "that", "there", "please", "tell", "me", "can", "you", "show", "give", "happening", "and", "it",
]);

const words = (text: string) =>
  text
    .toLowerCase()
    .replace(/[’']/g, "")
    .split(/[^a-z0-9/-]+/)
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w));

const STAGE: Record<SalesOrder["status"], string> = {
  confirmed: "confirmed",
  picking: "being picked",
  dispatched: "dispatched",
  "part-delivered": "part-delivered",
  delivered: "delivered",
  cancelled: "cancelled",
};

function latestMessage(r: AssistantRecords, threadId: string | null | undefined) {
  if (!threadId) return null;
  return r.messages.filter((m) => m.threadId === threadId).sort((a, b) => a.sentAt.localeCompare(b.sentAt)).at(-1) ?? null;
}

function snippet(body: string, max = 180) {
  const clean = body.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  return `${cut.slice(0, cut.lastIndexOf(" "))}…`;
}

function describeOrder(r: AssistantRecords, order: SalesOrder): { answer: string[]; sources: AskSource[] } {
  const productName = (id: string) => r.products.find((p) => p.id === id)?.name ?? "an item";
  const answer: string[] = [];
  const sources: AskSource[] = [{ relatedType: "sales-order", relatedId: order.id, label: `Order ${order.number}` }];

  const dateText = order.confirmedDate ? `confirmed for ${formatDate(order.confirmedDate)}` : `requested for ${formatDate(order.requestedDate)}`;
  answer.push(`Order ${order.number}${order.poReference ? ` (your reference ${order.poReference})` : ""} is ${STAGE[order.status]}, ${dateText}, with a value of ${formatMoney(order.total)}.`);

  const back = order.lines.filter((l) => l.backordered > 0);
  if (back.length) {
    const delivered = order.lines.reduce((s, l) => s + l.delivered, 0);
    const total = order.lines.reduce((s, l) => s + l.qty, 0);
    answer.push(`${delivered} of ${total} items have been delivered. On back order: ${back.map((l) => `${l.backordered} × ${productName(l.productId)}`).join("; ")}.`);
  }

  const deliveries = r.deliveries.filter((d) => d.orderId === order.id).sort((a, b) => (a.dispatchedAt ?? "").localeCompare(b.dispatchedAt ?? ""));
  for (const d of deliveries) {
    sources.push({ relatedType: "delivery", relatedId: d.id, label: `Delivery ${d.number}` });
  }
  const lastDelivery = deliveries.at(-1);
  if (lastDelivery) {
    answer.push(
      lastDelivery.deliveredAt
        ? `The latest delivery, ${lastDelivery.number}, arrived on ${formatDate(lastDelivery.deliveredAt)}${lastDelivery.carrier ? ` with ${lastDelivery.carrier}` : ""}.`
        : `Delivery ${lastDelivery.number} is on its way${lastDelivery.carrier ? ` with ${lastDelivery.carrier}` : ""}${lastDelivery.trackingRef ? `, tracking ${lastDelivery.trackingRef}` : ""}.`,
    );
  }

  const jobs = r.jobs.filter((j) => j.orderId === order.id).sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));
  if (jobs.length) {
    const done = jobs.filter((j) => j.status === "signed-off" || j.status === "completed").length;
    const next = jobs.find((j) => j.status === "scheduled" || j.status === "in-progress");
    answer.push(
      `${plural(jobs.length, "install job")}: ${done} complete${next ? `; next is "${next.name}" ${next.status === "in-progress" ? `in progress with ${next.engineerName}` : `on ${formatDate(next.scheduledDate)} with ${next.engineerName}`}` : ""}.`,
    );
    for (const j of jobs) sources.push({ relatedType: "job", relatedId: j.id, label: j.name });
  }

  const openCases = r.cases.filter((c) => c.orderId === order.id && c.status !== "closed" && c.status !== "resolved");
  if (openCases.length) {
    answer.push(`Open ${openCases.length === 1 ? "case" : "cases"}: ${openCases.map((c) => `${c.number} ${c.subject.toLowerCase()} (${c.status.replace("-", " ")})`).join("; ")}.`);
    for (const c of openCases) sources.push({ relatedType: "case", relatedId: c.id, label: `Case ${c.number}` });
  }

  const threads = r.threads.filter((t) => (t.relatedType === "sales-order" && t.relatedId === order.id) || t.id === order.threadId);
  const last = threads.map((t) => latestMessage(r, t.id)).filter((m): m is Message => !!m).sort((a, b) => a.sentAt.localeCompare(b.sentAt)).at(-1);
  if (last) {
    answer.push(`Latest message, from ${r.participantName(last.senderId)} on ${formatDate(last.sentAt)}: "${snippet(last.body)}"`);
    sources.push({ relatedType: "thread", relatedId: last.threadId, label: "Order conversation" });
  }

  const invoices = r.invoices.filter((i) => i.orderId === order.id && i.kind === "invoice");
  const outstanding = invoices.reduce((s, i) => s + i.outstanding.amount, 0);
  if (invoices.length) {
    answer.push(outstanding > 0 ? `${formatMoney({ amount: outstanding, currency: order.total.currency })} is outstanding on ${plural(invoices.length, "invoice")} for this order.` : `The ${plural(invoices.length, "invoice")} for this order ${invoices.length === 1 ? "is" : "are"} paid.`);
    for (const i of invoices) sources.push({ relatedType: "invoice", relatedId: i.id, label: `Invoice ${i.number}` });
  }
  return { answer, sources };
}

const PO_STAGE: Record<PurchaseOrder["status"], string> = {
  issued: "issued and awaiting your acknowledgement",
  acknowledged: "acknowledged",
  "in-transit": "in transit",
  "part-received": "part-received",
  received: "received in full",
};

function describePurchaseOrder(r: AssistantRecords, po: PurchaseOrder): { answer: string[]; sources: AskSource[] } {
  const productName = (id: string) => r.products.find((p) => p.id === id)?.name ?? "an item";
  const answer = [`Purchase order ${po.number} is ${PO_STAGE[po.status]}, expected ${formatDate(po.expectedDate)}, worth ${formatMoney(po.total)}.`];
  const open = po.lines.filter((l) => l.received < l.qty);
  if (po.status === "part-received" && open.length) {
    answer.push(`Still to deliver: ${open.map((l) => `${l.qty - l.received} × ${productName(l.productId)}`).join("; ")}.`);
  }
  const sources: AskSource[] = [{ relatedType: "purchase-order", relatedId: po.id, label: `Purchase order ${po.number}` }];
  const last = latestMessage(r, po.threadId);
  if (last) {
    answer.push(`Latest message, from ${r.participantName(last.senderId)} on ${formatDate(last.sentAt)}: "${snippet(last.body)}"`);
    sources.push({ relatedType: "thread", relatedId: po.threadId, label: "Purchase order conversation" });
  }
  return { answer, sources };
}

function describeQuote(r: AssistantRecords, quote: Quote): { answer: string[]; sources: AskSource[] } {
  const answer = [
    `Quote ${quote.number} is ${quote.status}, for ${formatMoney(quote.total)} including VAT across ${plural(quote.lines.length, "line")}.`,
    quote.status === "sent" ? `It is valid until ${formatDate(quote.validUntil)}.` : quote.status === "declined" && quote.declineReason ? `Reason given: ${quote.declineReason}` : "",
  ].filter(Boolean);
  const sources: AskSource[] = [{ relatedType: "quote", relatedId: quote.id, label: `Quote ${quote.number}` }];
  const last = latestMessage(r, quote.threadId);
  if (last) answer.push(`Latest message, from ${r.participantName(last.senderId)} on ${formatDate(last.sentAt)}: "${snippet(last.body)}"`);
  if (quote.salesOrderId) {
    const order = r.salesOrders.find((o) => o.id === quote.salesOrderId);
    if (order) {
      const detail = describeOrder(r, order);
      answer.push(...detail.answer);
      sources.push(...detail.sources);
    }
  }
  return { answer, sources };
}

function describeProduct(r: AssistantRecords, product: Product): { answer: string[]; sources: AskSource[] } {
  const answer: string[] = [];
  const sources: AskSource[] = [{ relatedType: "product", relatedId: product.id, label: product.name }];
  const orders = r.salesOrders.filter((o) => o.status !== "cancelled" && o.lines.some((l) => l.productId === product.id)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (orders.length) {
    const lastOrder = orders[0]!;
    answer.push(`You have ordered ${product.name} ${plural(orders.length, "time")}; most recently on ${formatDate(lastOrder.createdAt)} (order ${lastOrder.number}, ${STAGE[lastOrder.status]}).`);
    sources.push({ relatedType: "sales-order", relatedId: lastOrder.id, label: `Order ${lastOrder.number}` });
  } else {
    answer.push(`You have not ordered ${product.name} before.`);
  }
  const openOrders = orders.filter((o) => ["confirmed", "picking", "dispatched", "part-delivered"].includes(o.status));
  if (openOrders.length) answer.push(`${plural(openOrders.length, "open order")} include it: ${openOrders.map((o) => o.number).join(", ")}.`);
  const quotes = r.quotes.filter((q) => (q.status === "sent" || q.status === "draft") && q.lines.some((l) => l.productId === product.id));
  if (quotes.length) {
    answer.push(`It is on ${plural(quotes.length, "open quote")}: ${quotes.map((q) => `${q.number} (valid until ${formatDate(q.validUntil)})`).join(", ")}.`);
    for (const q of quotes) sources.push({ relatedType: "quote", relatedId: q.id, label: `Quote ${q.number}` });
  }
  const stock = r.stock.find((s) => s.productId === product.id);
  if (stock) {
    answer.push(
      stock.status === "in-stock"
        ? `Brewfitt has ${stock.available} available now.`
        : stock.status === "low"
          ? `Stock is low at Brewfitt: ${stock.available} available.`
          : stock.expectedAt
            ? `Brewfitt is expecting more on ${formatDate(stock.expectedAt)}.`
            : "It is currently out of stock at Brewfitt.",
    );
  }
  return { answer, sources };
}

export function answerQuestion(question: string, r: AssistantRecords): AskResponse {
  const q = question.trim();
  const upper = q.toUpperCase();

  // 1. A record number named explicitly.
  const number = upper.match(/\b(SO|QU|PO|INV|CS)-\d+\b/)?.[0];
  if (number) {
    const order = r.salesOrders.find((o) => o.number === number);
    if (order) return { question: q, ...describeOrder(r, order), simulated: true };
    const quote = r.quotes.find((x) => x.number === number);
    if (quote) return { question: q, ...describeQuote(r, quote), simulated: true };
    const po = r.purchaseOrders.find((x) => x.number === number);
    if (po) return { question: q, ...describePurchaseOrder(r, po), simulated: true };
  }

  const terms = words(q);
  if (terms.length === 0) return notFound(q);

  // 2. Conversations about an order or quote (subjects and message text, e.g. "Premium Lager font order").
  const phrase = terms.join(" ");
  const scoreText = (text: string) => {
    const lower = text.toLowerCase();
    return terms.filter((t) => lower.includes(t)).length + (lower.includes(phrase) ? terms.length : 0);
  };
  let best: { score: number; subjectScore: number; kind: "sales-order" | "quote" | "purchase-order"; id: string } | null = null;
  for (const t of r.threads) {
    if (t.relatedType !== "sales-order" && t.relatedType !== "quote" && t.relatedType !== "purchase-order") continue;
    const bodies = r.messages.filter((m) => m.threadId === t.id).map((m) => m.body).join(" ");
    const subjectScore = scoreText(t.subject);
    const score = subjectScore * 2 + Math.min(scoreText(bodies), terms.length * 2);
    if (score > (best?.score ?? 0)) best = { score, subjectScore, kind: t.relatedType, id: t.relatedId! };
  }
  for (const o of r.salesOrders) {
    const subjectScore = o.poReference ? scoreText(o.poReference) : 0;
    if (subjectScore * 2 > (best?.score ?? 0)) best = { score: subjectScore * 2, subjectScore, kind: "sales-order", id: o.id };
  }

  // 3. A product named.
  let bestProduct: { score: number; product: Product } | null = null;
  for (const p of r.products) {
    const score = scoreText(p.name) + (p.sku.toLowerCase() === phrase ? 3 : 0);
    if (score > (bestProduct?.score ?? 0)) bestProduct = { score, product: p };
  }

  const threshold = Math.max(2, Math.ceil(terms.length * 0.6));
  // A product whose name contains every word wins over conversations that merely mention it.
  const productNamed = !!bestProduct && bestProduct.score >= terms.length && (best?.subjectScore ?? 0) < terms.length;
  if (best && !productNamed && best.score >= threshold && best.score >= (bestProduct?.score ?? 0)) {
    if (best.kind === "purchase-order") {
      const po = r.purchaseOrders.find((x) => x.id === best.id);
      if (po) return { question: q, ...describePurchaseOrder(r, po), simulated: true };
    }
    if (best.kind === "sales-order") {
      const order = r.salesOrders.find((o) => o.id === best.id);
      if (order) return { question: q, ...describeOrder(r, order), simulated: true };
    }
    const quote = r.quotes.find((x) => x.id === best.id);
    if (quote) return { question: q, ...describeQuote(r, quote), simulated: true };
  }
  if (bestProduct && bestProduct.score >= Math.min(threshold, 2)) {
    return { question: q, ...describeProduct(r, bestProduct.product), simulated: true };
  }
  return notFound(q);
}

function notFound(question: string): AskResponse {
  return {
    question,
    answer: [
      "I could not match that to a quote, order or product on your account.",
      "Try naming an order, purchase order or quote number, a product such as \"FC4 chrome tap\", or words from the conversation.",
    ],
    sources: [],
    simulated: true,
  };
}

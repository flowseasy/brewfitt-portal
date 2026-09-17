import type { Delivery, Invoice, Money, PurchaseOrder, SalesOrder } from "@/types";

export type InvoiceLine = { productId: string; qty: number; unitPrice: Money; lineTotal: Money };

const gbp = (amount: number): Money => ({ amount, currency: "GBP" });

/**
 * Invoices bill a delivery (or, for customers paying by card, the whole order).
 * Lines are rebuilt from that delivery at the order's prices; a credit note
 * credits one unit of the order's last line, as issued for returns.
 */
export function invoiceLines(invoice: Invoice, order: SalesOrder | PurchaseOrder | undefined, deliveries: Delivery[]): InvoiceLine[] {
  if (!order) return [];
  const price = new Map(order.lines.map((l) => [l.productId, l.price]));
  const toLine = (productId: string, qty: number): InvoiceLine => {
    const unit = price.get(productId) ?? gbp(0);
    return { productId, qty, unitPrice: unit, lineTotal: gbp(qty * unit.amount) };
  };
  if (invoice.kind === "credit-note") {
    const last = order.lines[order.lines.length - 1];
    return last ? [toLine(last.productId, 1)] : [];
  }
  const day = invoice.issuedAt.slice(0, 10);
  const delivery = deliveries.find((d) => d.orderId === order.id && d.deliveredAt?.slice(0, 10) === day);
  if (delivery) return delivery.lines.map((l) => toLine(l.productId, l.qty));
  return order.lines.map((l) => toLine(l.productId, l.qty));
}

export function splitVat(total: Money, lines: InvoiceLine[]): { net: Money; vat: Money } {
  const net = lines.reduce((s, l) => s + l.lineTotal.amount, 0) || total.amount;
  return { net: gbp(net), vat: gbp(total.amount - net) };
}

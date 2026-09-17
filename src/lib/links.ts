import type { RelatedType } from "@/types";

/**
 * Detail routes use query strings because the static export cannot
 * pre-render records created at runtime (decision 1).
 */
export function hrefFor(type: RelatedType, id: string): string {
  const q = `?id=${encodeURIComponent(id)}`;
  switch (type) {
    case "quote":
    case "rfq":
      return `/quotes/view${q}`;
    case "sales-order":
    case "purchase-order":
      return `/orders/view${q}`;
    case "delivery":
      return `/orders/delivery${q}`;
    case "invoice":
    case "payment":
    case "payment-run":
      return `/invoices/view${q}`;
    case "job":
      return `/jobs/view${q}`;
    case "case":
      return `/cases/view${q}`;
    case "knowledge-item":
      return `/knowledge/view${q}`;
    case "thread":
      return `/messages/view${q}`;
    case "product":
      return `/shop/product${q}`;
    case "configuration":
      return `/configurator/build${q}`;
    case "supplier-product":
    case "offer":
      return `/products/view${q}`;
    case "document":
      return `/documents/view${q}`;
    case "account":
      return "/account";
  }
}

import type { Tone } from "@/components/shared/status-pill";
import type {
  Case,
  Invoice,
  Job,
  Offer,
  PurchaseOrder,
  Quote,
  Rfq,
  SalesOrder,
  StockPosition,
  SupplierProduct,
} from "@/types";

/**
 * One place for status labels and colours, so quote, order and case stages
 * look the same on every screen.
 */
type StatusMap<T extends string> = Record<T, { label: string; tone: Tone }>;

export const QUOTE_STATUS: StatusMap<Quote["status"]> = {
  draft: { label: "Draft", tone: "neutral" },
  sent: { label: "Awaiting acceptance", tone: "info" },
  accepted: { label: "Accepted", tone: "success" },
  declined: { label: "Declined", tone: "neutral" },
  expired: { label: "Expired", tone: "warning" },
};

export const ORDER_STATUS: StatusMap<SalesOrder["status"]> = {
  confirmed: { label: "Confirmed", tone: "info" },
  picking: { label: "Picking", tone: "info" },
  dispatched: { label: "Dispatched", tone: "brand" },
  "part-delivered": { label: "Part-delivered", tone: "warning" },
  delivered: { label: "Delivered", tone: "success" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};

/** Order stages in sequence, for stage trackers. */
export const ORDER_STAGES: SalesOrder["status"][] = ["confirmed", "picking", "dispatched", "delivered"];

export const PO_STATUS: StatusMap<PurchaseOrder["status"]> = {
  issued: { label: "Issued", tone: "info" },
  acknowledged: { label: "Acknowledged", tone: "brand" },
  "in-transit": { label: "In transit", tone: "brand" },
  "part-received": { label: "Part-received", tone: "warning" },
  received: { label: "Received", tone: "success" },
};

export const PO_STAGES: PurchaseOrder["status"][] = ["issued", "acknowledged", "in-transit", "received"];

export const RFQ_STATUS: StatusMap<Rfq["status"]> = {
  open: { label: "Awaiting your response", tone: "info" },
  responded: { label: "Responded", tone: "brand" },
  awarded: { label: "Awarded", tone: "success" },
  "not-awarded": { label: "Not awarded", tone: "neutral" },
  closed: { label: "Closed", tone: "neutral" },
};

export const INVOICE_STATUS: StatusMap<Invoice["status"]> = {
  open: { label: "Open", tone: "info" },
  "part-paid": { label: "Part-paid", tone: "warning" },
  paid: { label: "Paid", tone: "success" },
  overdue: { label: "Overdue", tone: "danger" },
  allocated: { label: "Allocated", tone: "neutral" },
};

export const CASE_STATUS: StatusMap<Case["status"]> = {
  open: { label: "Open", tone: "info" },
  "in-progress": { label: "In progress", tone: "brand" },
  "awaiting-parts": { label: "Awaiting parts", tone: "warning" },
  resolved: { label: "Resolved", tone: "success" },
  closed: { label: "Closed", tone: "neutral" },
};

export const CASE_URGENCY: StatusMap<Case["urgency"]> = {
  low: { label: "Low", tone: "neutral" },
  normal: { label: "Normal", tone: "info" },
  high: { label: "High", tone: "warning" },
  critical: { label: "Critical", tone: "danger" },
};

export const JOB_STATUS: StatusMap<Job["status"]> = {
  scheduled: { label: "Scheduled", tone: "info" },
  "in-progress": { label: "In progress", tone: "brand" },
  completed: { label: "Completed", tone: "success" },
  "signed-off": { label: "Signed off", tone: "success" },
};

export const STOCK_STATUS: StatusMap<StockPosition["status"]> = {
  "in-stock": { label: "In stock", tone: "success" },
  low: { label: "Low stock", tone: "warning" },
  out: { label: "Out of stock", tone: "danger" },
  "on-order": { label: "On order", tone: "info" },
};

export const SUBMISSION_STATUS: StatusMap<SupplierProduct["status"]> = {
  submitted: { label: "Submitted", tone: "info" },
  "under-review": { label: "Under review", tone: "brand" },
  approved: { label: "Approved", tone: "success" },
  rejected: { label: "Rejected", tone: "danger" },
};

export const OFFER_STATUS: StatusMap<Offer["status"]> = {
  ...SUBMISSION_STATUS,
  expired: { label: "Expired", tone: "neutral" },
};

export const OPEN_ORDER_STATUSES: SalesOrder["status"][] = ["confirmed", "picking", "dispatched", "part-delivered"];
export const OPEN_PO_STATUSES: PurchaseOrder["status"][] = ["issued", "acknowledged", "in-transit", "part-received"];
export const OPEN_CASE_STATUSES: Case["status"][] = ["open", "in-progress", "awaiting-parts"];

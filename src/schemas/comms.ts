import { z } from "zod";
import { Id, IsoDateTime, RelatedType } from "./common";

export const Side = z.enum(["brewfitt", "account"]);

export const Channel = z.enum(["portal", "email", "whatsapp"]);

export const Participant = z.object({
  id: Id,
  name: z.string().min(1),
  side: Side,
});

export const Thread = z.object({
  id: Id,
  accountId: Id,
  subject: z.string().min(1),
  relatedType: RelatedType.nullable(),
  relatedId: Id.nullable(),
  participants: z.array(Participant).min(1),
  lastMessageAt: IsoDateTime,
  unreadCount: z.int().nonnegative(),
});

export const Message = z.object({
  id: Id,
  threadId: Id,
  senderId: Id,
  senderSide: Side,
  channel: Channel,
  body: z.string().min(1),
  /** Document ids. */
  attachments: z.array(Id),
  sentAt: IsoDateTime,
});

/** Inbox row: the thread plus its latest message (contract defined by the mock). */
export const ThreadSummary = Thread.extend({
  lastMessage: Message.pick({
    senderId: true,
    senderSide: true,
    channel: true,
    body: true,
  }).nullable(),
});

export const ThreadDetail = Thread.extend({
  messages: z.array(Message),
});

export const NewMessageInput = z.object({
  body: z.string().trim().min(1, "Write a message"),
  attachments: z.array(Id),
});

export const NewThreadInput = z.object({
  subject: z.string().trim().min(3, "Add a subject"),
  body: z.string().trim().min(1, "Write a message"),
  relatedType: RelatedType.nullable(),
  relatedId: Id.nullable(),
});

export const NotificationKind = z.enum([
  "quote-awaiting-acceptance",
  "quote-expiring",
  "order-confirmed",
  "order-dispatched",
  "order-delivered",
  "delivery-date-changed",
  "invoice-due",
  "invoice-overdue",
  "new-message",
  "product-suggestion",
  "stock-out-risk",
  "case-updated",
  "submission-approved",
  "submission-rejected",
  "rfq-received",
  "payment-run-scheduled",
]);

export const Notification = z.object({
  id: Id,
  accountId: Id,
  kind: NotificationKind,
  title: z.string().min(1),
  body: z.string().min(1),
  relatedType: RelatedType,
  relatedId: Id,
  read: z.boolean(),
  dismissed: z.boolean(),
  createdAt: IsoDateTime,
});

export const NotificationPatch = z.object({
  read: z.boolean().optional(),
  dismissed: z.boolean().optional(),
});

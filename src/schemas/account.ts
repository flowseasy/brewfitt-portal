import { z } from "zod";
import { ApprovalStatus, Id, IsoDateTime, Money } from "./common";

export const AccountKind = z.enum(["customer", "supplier"]);

export const Sector = z.enum([
  "brewery",
  "brand-owner",
  "pub-group",
  "pub",
  "restaurant",
  "hotel",
  "manufacturer",
  "distributor",
]);

export const PaymentTerms = z.enum(["proforma", "7-days", "14-days", "30-days-eom", "30-days", "60-days"]);

export const RelationshipHealth = z.enum(["strong", "steady", "at-risk"]);

export const PendingChange = z.object({
  id: Id,
  field: z.string().min(1),
  from: z.string().nullable(),
  to: z.string().nullable(),
  requestedById: Id,
  requestedAt: IsoDateTime,
  status: ApprovalStatus,
});

export const Account = z.object({
  id: Id,
  name: z.string().min(1),
  kind: AccountKind,
  /** Site accounts point at their pub-group account. */
  parentAccountId: Id.nullable(),
  isGroup: z.boolean(),
  sector: Sector,
  companyNumber: z.string().nullable(),
  vatNumber: z.string().nullable(),
  paymentTerms: PaymentTerms,
  /** Customers only. Site accounts inherit the group's limit (decision 10), so this is null on sites. */
  creditLimit: Money.nullable(),
  /** False means no credit terms: card checkout and invoice payment (decision 4). */
  onAccount: z.boolean(),
  /** Customer sell price list, or supplier agreed cost price list. Sites inherit the group's. */
  priceListId: Id.nullable(),
  billingAddressId: Id,
  accountManagerId: Id.nullable(),
  technicalContactId: Id.nullable(),
  /** Brewfitt buyer (suppliers). */
  buyerId: Id.nullable(),
  relationshipHealth: RelationshipHealth,
  lastContactAt: IsoDateTime,
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
  /** Contact edits are shown as pending until Brewfitt approves them in TOTA360v5. */
  pendingChanges: z.array(PendingChange),
});

export const ContactRole = z.enum(["buyer", "bar-manager", "technical", "finance", "sales"]);

export const Contact = z.object({
  id: Id,
  accountId: Id,
  name: z.string().min(1),
  title: z.string().min(1),
  email: z.email(),
  phone: z.string().min(1),
  role: ContactRole,
  isPrimary: z.boolean(),
  canApprove: z.boolean(),
  approvalStatus: ApprovalStatus,
});

export const Country = z.enum(["GB", "IE", "NL", "AE"]);

export const Address = z.object({
  id: Id,
  accountId: Id,
  label: z.string().min(1),
  line1: z.string().min(1),
  line2: z.string().nullable(),
  town: z.string().min(1),
  county: z.string().nullable(),
  /** Null only where the country has no postcode system (UAE). Ireland uses the Eircode. */
  postcode: z.string().min(1).nullable(),
  country: Country,
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  isDefault: z.boolean(),
  deliveryNotes: z.string().nullable(),
  approvalStatus: ApprovalStatus,
});

export const BrewfittTeamRole = z.enum([
  "account-manager",
  "technical-manager",
  "buyer",
  "sales-office",
  "credit-control",
  "service-engineer",
  "managing-director",
]);

export const BrewfittTeamMember = z.object({
  id: Id,
  name: z.string().min(1),
  role: BrewfittTeamRole,
  email: z.email(),
  phone: z.string().min(1),
  /** Initials-based avatar in Phase 1; image path in Phase 2. */
  avatar: z.string().nullable(),
});

export const AccountPatch = z.object({
  name: z.string().min(1).optional(),
  companyNumber: z.string().nullable().optional(),
  vatNumber: z.string().nullable().optional(),
});

export const AddressInput = Address.omit({ id: true, accountId: true, approvalStatus: true }).extend({
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

export const ContactInput = Contact.omit({ id: true, accountId: true, approvalStatus: true });

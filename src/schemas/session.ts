import { z } from "zod";
import { Account, BrewfittTeamMember, Contact } from "./account";
import { Id, Money } from "./common";

/** Stands in for authentication in Phase 1. */
export const PersonaKind = z.enum(["customer", "site", "group", "supplier", "staff"]);

export const Persona = z.object({
  kind: PersonaKind,
  contactId: Id,
  /** The account the contact belongs to (the group account for group contacts). */
  accountId: Id,
  /** Group contacts can switch into one site; null means the group roll-up. */
  activeSiteId: Id.nullable(),
});

/** Credit position, held at group level for pub-group sites (decision 10). */
export const CreditPosition = z.object({
  heldByAccountId: Id,
  onAccount: z.boolean(),
  limit: Money.nullable(),
  /** Outstanding balance across every account sharing the credit. */
  balance: Money,
  available: Money.nullable(),
});

/** GET /api/me */
export const Me = z.object({
  credit: CreditPosition.nullable(),
  /** Mock VAT rate for the account's orders: 0.2 UK, 0 export (decision 8). */
  vatRate: z.number().min(0).max(1),
  contact: Contact,
  account: Account,
  persona: Persona,
  brewfittTeam: z.array(BrewfittTeamMember),
  /** Present for group and site personas. */
  group: z
    .object({
      account: Account,
      sites: z.array(Account),
    })
    .nullable(),
});

/** Options offered by the persona switcher. */
export const PersonaOption = z.object({
  persona: Persona,
  label: z.string().min(1),
  description: z.string().min(1),
});

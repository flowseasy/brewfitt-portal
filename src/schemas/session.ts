import { z } from "zod";
import { Account, BrewfittTeamMember, Contact } from "./account";
import { Id } from "./common";

/** Stands in for authentication in Phase 1. */
export const PersonaKind = z.enum(["customer", "site", "group", "supplier"]);

export const Persona = z.object({
  kind: PersonaKind,
  contactId: Id,
  /** The account the contact belongs to (the group account for group contacts). */
  accountId: Id,
  /** Group contacts can switch into one site; null means the group roll-up. */
  activeSiteId: Id.nullable(),
});

/** GET /api/me */
export const Me = z.object({
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

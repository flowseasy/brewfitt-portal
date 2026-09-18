import type { Account, Persona } from "@/types";
import { usePersonaStore } from "@/stores/persona-store";
import { ApiError } from "@/lib/api/errors";
import type { MockDb } from "./db";
import { BREWFITT_ACCOUNT, STAFF_CONTACT } from "./seed/composite";

export { ApiError };

/** Resolves what the active persona may see. Mirrors server-side scoping in Phase 2. */
export type Scope = {
  persona: Persona;
  /** The contact's own account (group account for group contacts). */
  account: Account;
  /** The account records are read from: a site when a group contact switched into one. */
  viewAccount: Account;
  /** Accounts whose records are visible: group + all sites for the roll-up, otherwise one. */
  accountIds: string[];
  /** Holds price list, account team and credit (decision 10). */
  commercialAccount: Account;
  isSupplier: boolean;
  /** Brewfitt staff (decision 14): internal tools only, no customer or supplier records. */
  isStaff: boolean;
};

export function currentPersona(): Persona {
  return usePersonaStore.getState().persona;
}

export function resolveScope(db: MockDb, persona: Persona = currentPersona()): Scope {
  if (persona.kind === "staff") {
    if (persona.contactId !== STAFF_CONTACT.id)
      throw new ApiError(401, "The selected staff persona no longer exists. Switch persona.");
    return {
      persona,
      account: BREWFITT_ACCOUNT,
      viewAccount: BREWFITT_ACCOUNT,
      accountIds: [],
      commercialAccount: BREWFITT_ACCOUNT,
      isSupplier: false,
      isStaff: true,
    };
  }
  const account = db.accounts.find((a) => a.id === persona.accountId);
  if (!account)
    throw new ApiError(
      401,
      "The selected persona's account no longer exists. Reset demo data or switch persona.",
    );

  const viewAccount =
    persona.kind === "group" && persona.activeSiteId
      ? (db.accounts.find(
          (a) => a.id === persona.activeSiteId && a.parentAccountId === account.id,
        ) ?? account)
      : account;

  const accountIds =
    persona.kind === "group" && viewAccount.id === account.id
      ? [
          account.id,
          ...db.accounts.filter((a) => a.parentAccountId === account.id).map((a) => a.id),
        ]
      : [viewAccount.id];

  const commercialAccount = viewAccount.parentAccountId
    ? (db.accounts.find((a) => a.id === viewAccount.parentAccountId) ?? viewAccount)
    : viewAccount;

  return {
    persona,
    account,
    viewAccount,
    accountIds,
    commercialAccount,
    isSupplier: account.kind === "supplier",
    isStaff: false,
  };
}

export function notFound(what: string): never {
  throw new ApiError(404, `${what} could not be found, or is not on your account.`);
}

export function forbidden(message: string): never {
  throw new ApiError(403, message);
}

export function badRequest(message: string): never {
  throw new ApiError(400, message);
}

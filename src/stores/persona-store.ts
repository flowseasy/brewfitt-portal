import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Persona } from "@/types";

/**
 * Phase 1 stand-in for authentication. The mock API reads the active persona
 * from here; Phase 2 replaces it with the Catalyst Authentication session.
 */
export const DEFAULT_PERSONA: Persona = {
  kind: "customer",
  contactId: "con_011",
  accountId: "acc_harbourside",
  activeSiteId: null,
};

type PersonaState = {
  persona: Persona;
  /** False until a persona is chosen on the start screen, and again after signing out. */
  signedIn: boolean;
  signIn: (persona: Persona) => void;
  setPersona: (persona: Persona) => void;
  /** Group contacts only: null returns to the group roll-up. */
  setActiveSite: (siteId: string | null) => void;
  signOut: () => void;
};

export const usePersonaStore = create<PersonaState>()(
  persist(
    (set) => ({
      persona: DEFAULT_PERSONA,
      signedIn: false,
      signIn: (persona) => set({ persona, signedIn: true }),
      setPersona: (persona) => set({ persona }),
      setActiveSite: (activeSiteId) =>
        set((s) => (s.persona.kind === "group" ? { persona: { ...s.persona, activeSiteId } } : s)),
      signOut: () => set({ signedIn: false }),
    }),
    { name: "brewfitt-persona" },
  ),
);

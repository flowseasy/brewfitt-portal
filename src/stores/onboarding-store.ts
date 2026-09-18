import { create } from "zustand";
import { persist } from "zustand/middleware";

/** Which contacts have finished or skipped the first-run tour in this browser. */
type OnboardingState = {
  seen: string[];
  markSeen: (contactId: string) => void;
};

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set, get) => ({
      seen: [],
      markSeen: (contactId) => {
        if (!get().seen.includes(contactId)) set({ seen: [...get().seen, contactId] });
      },
    }),
    { name: "brewfitt-onboarding" },
  ),
);

/**
 * Where to land after choosing a persona: the tour the first time, the dashboard after.
 * Brewfitt staff go straight to their tools (decision 14).
 */
export function landingFor(persona: { kind: string; contactId: string }): string {
  if (persona.kind === "staff") return "/internal/configurator";
  return useOnboardingStore.getState().seen.includes(persona.contactId)
    ? "/dashboard"
    : "/onboarding";
}

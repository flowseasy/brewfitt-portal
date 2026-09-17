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

/** Where to land after choosing a persona: the tour the first time, the dashboard after. */
export function landingFor(contactId: string): string {
  return useOnboardingStore.getState().seen.includes(contactId) ? "/dashboard" : "/onboarding";
}

import { create } from "zustand";
import type { AskResponse } from "@/types";

export type AssistantTab = "ask" | "insights";

/** Assistant panel state for this session: open tab and answers per persona (not persisted). */
type AssistantState = {
  open: boolean;
  tab: AssistantTab;
  history: { personaKey: string; response: AskResponse }[];
  openPanel: (tab?: AssistantTab) => void;
  setOpen: (open: boolean) => void;
  setTab: (tab: AssistantTab) => void;
  addAnswer: (personaKey: string, response: AskResponse) => void;
  clearHistory: (personaKey: string) => void;
};

export const useAssistantStore = create<AssistantState>()((set) => ({
  open: false,
  tab: "ask",
  history: [],
  openPanel: (tab) => set((s) => ({ open: true, tab: tab ?? s.tab })),
  setOpen: (open) => set({ open }),
  setTab: (tab) => set({ tab }),
  addAnswer: (personaKey, response) =>
    set((s) => ({ history: [...s.history, { personaKey, response }].slice(-20) })),
  clearHistory: (personaKey) =>
    set((s) => ({ history: s.history.filter((h) => h.personaKey !== personaKey) })),
}));

"use client";

import { useSyncExternalStore } from "react";
import { usePersonaStore } from "@/stores/persona-store";

/**
 * True once persisted client state (persona, theme) has loaded. The static
 * export is pre-rendered without it, so persona-dependent UI waits for this.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    (onChange) => usePersonaStore.persist.onFinishHydration(onChange),
    () => usePersonaStore.persist.hasHydrated(),
    () => false,
  );
}

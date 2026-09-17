"use client";

import { useQuery } from "@tanstack/react-query";
import { api, personaKey, queryKeys } from "@/lib/api";
import { usePersonaStore } from "@/stores/persona-store";

export function usePersona() {
  return usePersonaStore((s) => s.persona);
}

/** Cache namespace for the active persona; every query key starts with it. */
export function usePersonaKey(): string {
  return personaKey(usePersona());
}

export function useMe() {
  const key = usePersonaKey();
  return useQuery({
    queryKey: queryKeys.me(key),
    queryFn: () => api.session.me(),
    staleTime: 5 * 60_000,
  });
}

export function useIsSupplier(): boolean {
  return usePersona().kind === "supplier";
}

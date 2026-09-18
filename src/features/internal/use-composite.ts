"use client";

import { useQuery } from "@tanstack/react-query";
import { usePersonaKey } from "@/features/session/use-session";
import { api, queryKeys } from "@/lib/api";

/** Composite Configurator data for Brewfitt staff (decision 14). */
export function useCompositeBuilds() {
  const key = usePersonaKey();
  return useQuery({
    queryKey: queryKeys.compositeBuilds(key),
    queryFn: () => api.internal.compositeBuilds(),
  });
}

export function useCompositeBuild(id: string) {
  const key = usePersonaKey();
  return useQuery({
    queryKey: queryKeys.compositeBuild(key, id),
    queryFn: () => api.internal.compositeBuild(id),
    enabled: !!id,
  });
}

export function useCompositeSettings() {
  const key = usePersonaKey();
  return useQuery({
    queryKey: queryKeys.compositeSettings(key),
    queryFn: () => api.internal.compositeSettings(),
    staleTime: 10 * 60_000,
  });
}

export function useInternalCustomers() {
  const key = usePersonaKey();
  return useQuery({
    queryKey: queryKeys.internalCustomers(key),
    queryFn: () => api.internal.customers(),
    staleTime: 10 * 60_000,
  });
}

export function useInternalQuotes() {
  const key = usePersonaKey();
  return useQuery({
    queryKey: queryKeys.internalQuotes(key),
    queryFn: () => api.internal.quotes(),
  });
}

export function useCostItems(q: string) {
  const key = usePersonaKey();
  const term = q.trim();
  return useQuery({
    queryKey: queryKeys.costItems(key, term.toLowerCase()),
    queryFn: () => api.internal.costItems({ q: term, limit: 12 }),
    enabled: term.length >= 2,
    staleTime: 60_000,
    placeholderData: (previous) => previous,
  });
}

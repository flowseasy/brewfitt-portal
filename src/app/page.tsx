"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { BrandLogo } from "@/components/shared/brand-logo";
import { PersonaList } from "@/components/shared/persona-list";
import { useHydrated } from "@/hooks/use-hydrated";
import { usePersonaStore } from "@/stores/persona-store";

/** Phase 1 start screen: choosing a persona stands in for signing in. */
export default function StartPage() {
  const router = useRouter();
  const hydrated = useHydrated();
  const signedIn = usePersonaStore((s) => s.signedIn);
  const signIn = usePersonaStore((s) => s.signIn);

  useEffect(() => {
    if (hydrated && signedIn) router.replace("/dashboard");
  }, [hydrated, signedIn, router]);

  return (
    <main className="relative min-h-dvh overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-gradient-to-b from-brand-subtle to-transparent" />
      <div className="relative mx-auto flex max-w-3xl flex-col px-4 py-12 sm:py-20">
        <BrandLogo priority className="h-10 self-start" />
        <h1 className="mt-10 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">Customer and supplier portal</h1>
        <p className="mt-3 max-w-xl text-lg text-muted-foreground">
          Your prices, quotes, orders, deliveries, invoices and conversations with Brewfitt, in one place.
        </p>
        <section aria-labelledby="choose" className="mt-10 rounded-3xl border bg-card/80 p-4 shadow-sm backdrop-blur sm:p-6">
          <h2 id="choose" className="font-medium">
            Choose who to sign in as
          </h2>
          <p className="mt-1 mb-5 text-sm text-muted-foreground">
            This Phase 1 preview runs on demonstration data. The accounts and people are invented; products are from Brewfitt&apos;s trade range.
          </p>
          {hydrated ? (
            <PersonaList
              onChoose={(option) => {
                signIn(option.persona);
                router.push("/dashboard");
              }}
            />
          ) : null}
        </section>
      </div>
    </main>
  );
}

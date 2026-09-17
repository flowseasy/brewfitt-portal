"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useHydrated } from "@/hooks/use-hydrated";
import { usePersonaStore } from "@/stores/persona-store";
import { Skeleton } from "@/components/ui/skeleton";
import { Header } from "./header";
import { MobileBottomNav } from "./mobile-bottom-nav";
import { isRouteAllowed } from "./navigation";
import { PrimaryCta } from "./primary-cta";
import { Sidebar } from "./sidebar";

export function AppShell({ children }: { children: ReactNode }) {
  const hydrated = useHydrated();
  const signedIn = usePersonaStore((s) => s.signedIn);
  const kind = usePersonaStore((s) => s.persona.kind);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!hydrated) return;
    if (!signedIn) router.replace("/");
    else if (!isRouteAllowed(kind, pathname)) router.replace("/dashboard");
  }, [hydrated, signedIn, kind, pathname, router]);

  if (!hydrated || !signedIn) {
    return (
      <div className="flex min-h-dvh" aria-busy="true">
        <div className="hidden w-64 border-r bg-sidebar lg:block" />
        <div className="flex-1 space-y-4 p-8">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-40 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-primary px-3 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header />
        <main
          id="main"
          tabIndex={-1}
          className="mx-auto w-full max-w-7xl flex-1 px-4 pt-6 pb-28 outline-none sm:px-6 lg:px-8 lg:pb-12"
        >
          {children}
        </main>
      </div>
      <div className="fixed right-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 sm:hidden">
        <PrimaryCta compact />
      </div>
      <MobileBottomNav />
    </div>
  );
}

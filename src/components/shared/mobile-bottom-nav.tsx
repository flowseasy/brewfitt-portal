"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BellIcon, DotsThreeCircleIcon, UserCircleIcon } from "@phosphor-icons/react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { usePersona } from "@/features/session/use-session";
import { cn } from "@/lib/utils";
import { isActive, navFor } from "./navigation";

/** One-handed navigation for phones: four destinations plus More. */
export function MobileBottomNav() {
  const pathname = usePathname();
  const persona = usePersona();
  const [moreOpen, setMoreOpen] = useState(false);
  const items = navFor(persona.kind);
  const primary = items.filter((i) => i.mobile);
  const rest = items.filter((i) => !i.mobile);
  const moreActive = !primary.some((i) => isActive(pathname, i.href));

  return (
    <>
      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg lg:hidden">
        <ul className="grid grid-cols-5">
          {primary.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn("flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px]", active ? "font-medium text-primary" : "text-muted-foreground")}
                >
                  <item.icon className="size-6" weight={active ? "fill" : "regular"} aria-hidden />
                  {item.mobileLabel ?? item.label}
                </Link>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={moreOpen}
              className={cn("flex min-h-14 w-full flex-col items-center justify-center gap-0.5 text-[11px]", moreActive ? "font-medium text-primary" : "text-muted-foreground")}
            >
              <DotsThreeCircleIcon className="size-6" weight={moreActive ? "fill" : "regular"} aria-hidden />
              More
            </button>
          </li>
        </ul>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="max-h-[85dvh] rounded-t-3xl pb-[calc(env(safe-area-inset-bottom)+1rem)]">
          <SheetHeader>
            <SheetTitle>More</SheetTitle>
            <SheetDescription className="sr-only">Everything else in the portal</SheetDescription>
          </SheetHeader>
          <ul className="grid grid-cols-3 gap-2 overflow-y-auto px-4">
            {[...rest, { href: "/notifications", label: "Notifications", icon: BellIcon }, { href: "/account", label: "Account", icon: UserCircleIcon }].map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setMoreOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-2xl border p-2 text-center text-xs",
                      active ? "border-primary/40 bg-brand-subtle font-medium text-brand-subtle-foreground" : "bg-card",
                    )}
                  >
                    <item.icon className="size-6" aria-hidden />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </SheetContent>
      </Sheet>
    </>
  );
}

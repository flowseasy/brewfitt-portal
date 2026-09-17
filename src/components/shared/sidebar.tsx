"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { usePersona } from "@/features/session/use-session";
import { cn } from "@/lib/utils";
import { BrandLogo } from "./brand-logo";
import { isActive, navFor } from "./navigation";

export function Sidebar() {
  const pathname = usePathname();
  const persona = usePersona();
  const items = navFor(persona.kind);

  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r bg-sidebar lg:flex">
      <div className="px-4 pt-4 pb-3">
        <Link
          href="/dashboard"
          aria-label="Brewfitt, go to dashboard"
          className="block rounded-lg focus-visible:outline-offset-4"
        >
          <BrandLogo priority className="h-auto w-full rounded-lg shadow-sm" />
        </Link>
      </div>
      <nav aria-label="Main" className="flex-1 overflow-y-auto px-3 pb-6">
        <ul className="space-y-0.5">
          {items.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                    active
                      ? "font-medium text-sidebar-accent-foreground"
                      : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
                  )}
                >
                  {active ? (
                    <motion.span
                      layoutId="sidebar-active"
                      className="absolute inset-0 rounded-lg bg-sidebar-accent"
                      transition={{ type: "spring", stiffness: 500, damping: 40 }}
                    />
                  ) : null}
                  <item.icon
                    className="relative size-[18px]"
                    weight={active ? "fill" : "regular"}
                    aria-hidden
                  />
                  <span className="relative">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="border-t px-5 py-4 text-xs text-muted-foreground">
        Phase 1 preview on demonstration data. Powered by TOTA360v5.
      </div>
    </aside>
  );
}

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
      <div className="flex h-16 items-center gap-2.5 px-5">
        <Link
          href="/dashboard"
          className="flex items-center gap-2.5 rounded-md focus-visible:outline-offset-4"
        >
          <BrandLogo priority />
          <span className="text-sm font-medium text-muted-foreground">
            {persona.kind === "supplier" ? "Supplier portal" : "Trade portal"}
          </span>
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

"use client";

import Link from "next/link";
import { StorefrontIcon, TruckIcon } from "@phosphor-icons/react";
import { usePersona } from "@/features/session/use-session";
import { cn } from "@/lib/utils";

/** "Your Trade Portal" (or supplier) name, shown proudly in the header. */
export function PortalBadge({ className }: { className?: string }) {
  const supplier = usePersona().kind === "supplier";
  const Icon = supplier ? TruckIcon : StorefrontIcon;
  return (
    <Link
      href="/dashboard"
      className={cn(
        "inline-flex shrink-0 items-center gap-2 rounded-full bg-primary px-3.5 py-1.5 text-primary-foreground shadow-sm ring-1 ring-primary/20 transition hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        className,
      )}
    >
      <Icon weight="fill" className="size-4" aria-hidden />
      <span className="text-sm font-semibold tracking-tight whitespace-nowrap">
        {supplier ? "Your Supplier Portal" : "Your Trade Portal"}
      </span>
    </Link>
  );
}

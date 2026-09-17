"use client";

import Link from "next/link";
import { usePersona } from "@/features/session/use-session";
import { cn } from "@/lib/utils";

/** "Your Trade Portal" (or supplier) name, set as a bold heading in the header. */
export function PortalBadge({ className }: { className?: string }) {
  const supplier = usePersona().kind === "supplier";
  return (
    <Link
      href="/dashboard"
      className={cn(
        "shrink-0 rounded-md text-xl font-bold tracking-tight whitespace-nowrap text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        className,
      )}
    >
      {supplier ? "Your Supplier Portal" : "Your Trade Portal"}
    </Link>
  );
}

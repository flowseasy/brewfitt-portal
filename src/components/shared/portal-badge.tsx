"use client";

import Link from "next/link";
import { useMe } from "@/features/session/use-session";
import { homeFor } from "./navigation";
import { cn } from "@/lib/utils";

/** Who is signed in: the contact's name in bold, their company beneath. */
export function PortalBadge({ className }: { className?: string }) {
  const me = useMe();
  if (!me.data) return <span className={cn("h-10 w-48", className)} aria-hidden />;
  const { contact, account } = me.data;
  return (
    <Link
      href={me.data.persona.kind === "staff" ? homeFor("staff") : "/account"}
      className={cn(
        "min-w-0 rounded-md leading-tight focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        className,
      )}
      title={`${contact.name} from ${account.name}`}
    >
      <span className="block truncate text-base font-bold tracking-tight text-foreground">
        {contact.name}
      </span>
      <span className="block truncate text-sm text-muted-foreground">
        <span className="sr-only">from </span>
        {account.name}
      </span>
    </Link>
  );
}

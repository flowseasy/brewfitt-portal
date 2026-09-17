"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowsClockwiseIcon,
  ChatCircleTextIcon,
  FadersHorizontalIcon,
  LifebuoyIcon,
  PackageIcon,
  PaperPlaneTiltIcon,
  PlusCircleIcon,
  TagIcon,
  type Icon,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { usePersona } from "@/features/session/use-session";

type Cta = { label: string; href: string; icon: Icon };

/** BLUEPRINT.md "Primary CTA, context-aware". */
function ctaFor(kind: string, pathname: string): Cta {
  const section = pathname.split("/")[1] ?? "";
  if (kind === "supplier") {
    if (section === "products")
      return {
        label: pathname.includes("offer") ? "New offer" : "Submit product",
        href: "/products?new=product",
        icon: PlusCircleIcon,
      };
    if (section === "messages")
      return { label: "New message", href: "/messages?new=1", icon: ChatCircleTextIcon };
    if (section === "cases")
      return { label: "Raise an issue", href: "/cases?new=1", icon: LifebuoyIcon };
    if (section === "knowledge")
      return { label: "Submit product", href: "/products?new=product", icon: TagIcon };
    return { label: "Respond to RFQ", href: "/quotes?filter=open", icon: PaperPlaneTiltIcon };
  }
  switch (section) {
    case "configurator":
      return {
        label: "New configuration",
        href: "/configurator/build",
        icon: FadersHorizontalIcon,
      };
    case "orders":
    case "stock":
      return { label: "Reorder", href: "/shop?reorder=1", icon: ArrowsClockwiseIcon };
    case "cases":
    case "jobs":
      return { label: "Raise case", href: "/cases?new=1", icon: LifebuoyIcon };
    case "messages":
      return { label: "New message", href: "/messages?new=1", icon: ChatCircleTextIcon };
    default:
      return { label: "New order", href: "/shop", icon: PackageIcon };
  }
}

export function PrimaryCta({ compact }: { compact?: boolean }) {
  const pathname = usePathname();
  const persona = usePersona();
  const cta = ctaFor(persona.kind, pathname);
  return (
    <Button
      asChild
      size={compact ? "icon" : "default"}
      className={compact ? "rounded-full" : "h-9 rounded-full px-4"}
    >
      <Link href={cta.href} aria-label={compact ? cta.label : undefined}>
        <cta.icon weight="bold" aria-hidden />
        {compact ? null : cta.label}
      </Link>
    </Button>
  );
}

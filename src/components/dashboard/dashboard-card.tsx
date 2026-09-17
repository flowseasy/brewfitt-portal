"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRightIcon, type Icon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

/** A dashboard card: title, one clear action into the underlying records, and its content. */
export function DashboardCard({
  title,
  icon: IconComponent,
  action,
  children,
  className,
  index = 0,
  headerExtra,
}: {
  title: string;
  icon: Icon;
  action: { label: string; href: string };
  children: ReactNode;
  className?: string;
  index?: number;
  headerExtra?: ReactNode;
}) {
  const headingId = `card-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <motion.section
      aria-labelledby={headingId}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index, 8) * 0.03, ease: "easeOut" }}
      className={cn("flex flex-col rounded-2xl border bg-card p-5 shadow-[0_1px_2px_rgb(0_0_0/0.03)]", className)}
    >
      <div className="mb-4 flex items-center gap-2.5">
        <span className="flex size-8 items-center justify-center rounded-lg bg-brand-subtle text-brand-subtle-foreground">
          <IconComponent className="size-[18px]" aria-hidden />
        </span>
        <h2 id={headingId} className="font-medium">
          {title}
        </h2>
        {headerExtra ? <div className="ml-1">{headerExtra}</div> : null}
        <Link
          href={action.href}
          className="group ml-auto flex items-center gap-1 rounded-md text-sm font-medium text-primary hover:underline underline-offset-4"
        >
          {action.label}
          <ArrowRightIcon className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
        </Link>
      </div>
      <div className="flex-1">{children}</div>
    </motion.section>
  );
}

/** A tappable row inside a card that drills into one record. */
export function CardRow({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  return (
    <li>
      <Link href={href} className={cn("-mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-accent/60", className)}>
        {children}
      </Link>
    </li>
  );
}

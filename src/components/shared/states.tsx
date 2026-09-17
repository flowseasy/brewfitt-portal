"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowClockwiseIcon,
  MagnifyingGlassIcon,
  WarningCircleIcon,
  type Icon,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { errorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";

export function LoadingState({
  rows = 3,
  label = "Loading",
  className,
}: {
  rows?: number;
  label?: string;
  className?: string;
}) {
  return (
    <div role="status" aria-live="polite" className={cn("space-y-3", className)}>
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-16 w-full rounded-xl" />
      ))}
    </div>
  );
}

export function EmptyState({
  icon: IconComponent,
  title,
  description,
  action,
  className,
}: {
  icon: Icon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-12 text-center",
        className,
      )}
    >
      <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <IconComponent className="size-6" aria-hidden />
      </div>
      <p className="font-medium">{title}</p>
      {description ? (
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  error,
  onRetry,
  className,
}: {
  error: unknown;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-danger/30 bg-danger-subtle px-6 py-10 text-center",
        className,
      )}
    >
      <WarningCircleIcon className="mb-3 size-8 text-danger" aria-hidden />
      <p className="font-medium">This could not be loaded</p>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">{errorMessage(error)}</p>
      {onRetry ? (
        <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
          <ArrowClockwiseIcon aria-hidden />
          Try again
        </Button>
      ) : null}
    </div>
  );
}

/**
 * Detail pages read `?id=`; without one the record query never runs, so show
 * a way back instead of an endless loading state.
 */
export function RecordIdGate({
  backHref,
  backLabel,
  children,
}: {
  backHref: string;
  backLabel: string;
  children: ReactNode;
}) {
  const id = useSearchParams().get("id");
  if (id) return <>{children}</>;
  return (
    <EmptyState
      icon={MagnifyingGlassIcon}
      title="Nothing selected"
      description="This link is missing the record to show."
      action={
        <Button asChild variant="outline">
          <Link href={backHref}>{backLabel}</Link>
        </Button>
      }
    />
  );
}

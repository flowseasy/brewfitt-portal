"use client";

import { useId, type ReactNode } from "react";
import { FunnelSimpleIcon, MagnifyingGlassIcon, XIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export function SearchInput({
  value,
  onChange,
  placeholder,
  label,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  label: string;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={cn("relative min-w-0", className)}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <MagnifyingGlassIcon
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <input
        id={id}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded-full border bg-background pr-9 pl-9 text-base outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 sm:text-sm [&::-webkit-search-cancel-button]:hidden"
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute top-1/2 right-2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-accent"
          aria-label="Clear search"
        >
          <XIcon className="size-4" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

/** Desktop shows filters inline; phones get a Filters button that opens a bottom sheet. */
export function FilterBar({
  search,
  filters,
  activeCount,
  onClear,
  trailing,
}: {
  search: ReactNode;
  filters: ReactNode;
  activeCount: number;
  onClear: () => void;
  trailing?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">{search}</div>
        <div className="md:hidden">
          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                className="h-10 rounded-full"
                aria-label={activeCount ? `Filters, ${activeCount} active` : "Filters"}
              >
                <FunnelSimpleIcon aria-hidden />
                {activeCount ? (
                  <span className="rounded-full bg-primary px-1.5 text-[11px] text-primary-foreground">
                    {activeCount}
                  </span>
                ) : null}
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto rounded-t-3xl">
              <SheetHeader>
                <SheetTitle>Filters</SheetTitle>
                <SheetDescription className="sr-only">Narrow the list</SheetDescription>
              </SheetHeader>
              <div className="flex flex-col gap-4 px-4">{filters}</div>
              <SheetFooter>
                <Button variant="outline" onClick={onClear} disabled={!activeCount}>
                  Clear filters
                </Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>
        </div>
        {trailing}
      </div>
      <div className="hidden flex-wrap items-center gap-2 md:flex">
        {filters}
        {activeCount ? (
          <Button variant="ghost" size="sm" onClick={onClear}>
            Clear filters
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/** A compact labelled native select for filter bars (keyboard and screen-reader friendly). */
export function FilterSelect<T extends string>({
  label,
  value,
  onChange,
  options,
  className,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  className?: string;
}) {
  const id = useId();
  return (
    <div className={cn("flex flex-col gap-1 md:flex-row md:items-center md:gap-0", className)}>
      <label htmlFor={id} className="text-sm font-medium md:sr-only">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="h-10 w-full rounded-full border bg-background px-3.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 md:h-9 md:w-auto"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

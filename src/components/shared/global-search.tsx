"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  BookOpenIcon,
  ChatsCircleIcon,
  FileTextIcon,
  MagnifyingGlassIcon,
  PackageIcon,
  ReceiptIcon,
  TagIcon,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useIsSupplier, usePersona, usePersonaKey } from "@/features/session/use-session";
import { api, queryKeys } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import { hrefFor } from "@/lib/links";
import { navFor } from "./navigation";

/** Global search across the account's own records (Ctrl or Cmd + K). */
export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const key = usePersonaKey();
  const persona = usePersona();
  const supplier = useIsSupplier();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const enabled = open;
  const products = useQuery({
    queryKey: queryKeys.products(key),
    queryFn: () => api.products.list(),
    enabled,
  });
  const quotes = useQuery({
    queryKey: queryKeys.quotes(key),
    queryFn: () => api.quotes.list(),
    enabled: enabled && !supplier,
  });
  const orders = useQuery({
    queryKey: queryKeys.salesOrders(key),
    queryFn: () => api.orders.salesOrders(),
    enabled: enabled && !supplier,
  });
  const rfqs = useQuery({
    queryKey: queryKeys.rfqs(key),
    queryFn: () => api.quotes.rfqs(),
    enabled: enabled && supplier,
  });
  const pos = useQuery({
    queryKey: queryKeys.purchaseOrders(key),
    queryFn: () => api.orders.purchaseOrders(),
    enabled: enabled && supplier,
  });
  const invoices = useQuery({
    queryKey: queryKeys.invoices(key),
    queryFn: () => api.invoices.list(),
    enabled,
  });
  const knowledge = useQuery({
    queryKey: queryKeys.knowledge(key),
    queryFn: () => api.knowledge.list(),
    enabled,
  });
  const threads = useQuery({
    queryKey: queryKeys.threads(key),
    queryFn: () => api.messages.threads(),
    enabled,
  });

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };
  const loading = [products, quotes, orders, invoices, knowledge, threads].some(
    (q) => q.isFetching,
  );

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        className="h-9 w-full justify-start gap-2 rounded-full text-muted-foreground sm:w-64"
        aria-label="Search"
      >
        <MagnifyingGlassIcon aria-hidden />
        <span className="hidden sm:inline">Search</span>
        <kbd className="ml-auto hidden rounded border bg-muted px-1.5 font-mono text-[10px] sm:inline">
          Ctrl K
        </kbd>
      </Button>
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Search"
        description="Search pages, products, orders, quotes, invoices, knowledge and messages"
      >
        <Command>
          <CommandInput placeholder="Search products, orders, quotes, invoices…" />
          <CommandList className="max-h-[60dvh]">
            <CommandEmpty>{loading ? "Searching…" : "No matches on your account."}</CommandEmpty>
            <CommandGroup heading="Go to">
              {navFor(persona.kind).map((item) => (
                <CommandItem
                  key={item.href}
                  value={`page ${item.label}`}
                  onSelect={() => go(item.href)}
                >
                  <item.icon aria-hidden />
                  {item.label}
                </CommandItem>
              ))}
            </CommandGroup>
            {!supplier && orders.data?.length ? (
              <CommandGroup heading="Orders">
                {orders.data.slice(0, 60).map((o) => (
                  <CommandItem
                    key={o.id}
                    value={`order ${o.number} ${o.poReference ?? ""} ${o.status}`}
                    onSelect={() => go(hrefFor("sales-order", o.id))}
                  >
                    <PackageIcon aria-hidden />
                    <span>{o.number}</span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {o.status.replace("-", " ")} · {formatMoney(o.total)}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
            {!supplier && quotes.data?.length ? (
              <CommandGroup heading="Quotes">
                {quotes.data.map((q) => (
                  <CommandItem
                    key={q.id}
                    value={`quote ${q.number} ${q.status}`}
                    onSelect={() => go(hrefFor("quote", q.id))}
                  >
                    <FileTextIcon aria-hidden />
                    <span>{q.number}</span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {q.status} · {formatMoney(q.total)}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
            {supplier && rfqs.data?.length ? (
              <CommandGroup heading="Requests for quotation">
                {rfqs.data.map((r) => (
                  <CommandItem
                    key={r.id}
                    value={`rfq ${r.number} ${r.status}`}
                    onSelect={() => go(hrefFor("rfq", r.id))}
                  >
                    <FileTextIcon aria-hidden />
                    {r.number}
                    <span className="ml-auto text-xs text-muted-foreground">{r.status}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
            {supplier && pos.data?.length ? (
              <CommandGroup heading="Purchase orders">
                {pos.data.map((p) => (
                  <CommandItem
                    key={p.id}
                    value={`purchase order ${p.number} ${p.status}`}
                    onSelect={() => go(hrefFor("purchase-order", p.id))}
                  >
                    <PackageIcon aria-hidden />
                    {p.number}
                    <span className="ml-auto text-xs text-muted-foreground">
                      {p.status.replace("-", " ")}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
            {invoices.data?.length ? (
              <CommandGroup heading="Invoices">
                {invoices.data.slice(0, 60).map((i) => (
                  <CommandItem
                    key={i.id}
                    value={`invoice ${i.number} ${i.status}`}
                    onSelect={() => go(hrefFor("invoice", i.id))}
                  >
                    <ReceiptIcon aria-hidden />
                    {i.number}
                    <span className="ml-auto text-xs text-muted-foreground">
                      {i.status.replace("-", " ")} · {formatMoney(i.total)}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
            {products.data?.length ? (
              <CommandGroup heading="Products">
                {products.data.map((p) => (
                  <CommandItem
                    key={p.id}
                    value={`product ${p.name} ${p.sku}`}
                    onSelect={() => go(supplier ? "/stock" : hrefFor("product", p.id))}
                  >
                    <TagIcon aria-hidden />
                    <span className="truncate">{p.name}</span>
                    <span className="ml-auto font-mono text-xs text-muted-foreground">{p.sku}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
            {knowledge.data?.length ? (
              <CommandGroup heading="Knowledge">
                {knowledge.data.map((k) => (
                  <CommandItem
                    key={k.id}
                    value={`knowledge ${k.title} ${k.type}`}
                    onSelect={() => go(hrefFor("knowledge-item", k.id))}
                  >
                    <BookOpenIcon aria-hidden />
                    <span className="truncate">{k.title}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
            {threads.data?.length ? (
              <CommandGroup heading="Messages">
                {threads.data.slice(0, 60).map((t) => (
                  <CommandItem
                    key={t.id}
                    value={`message ${t.subject}`}
                    onSelect={() => go(hrefFor("thread", t.id))}
                  >
                    <ChatsCircleIcon aria-hidden />
                    <span className="truncate">{t.subject}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}

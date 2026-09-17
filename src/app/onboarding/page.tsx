"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  ChatsCircleIcon,
  CheckCircleIcon,
  CubeIcon,
  FileTextIcon,
  GaugeIcon,
  HandWavingIcon,
  PackageIcon,
  ShoppingCartIcon,
  SparkleIcon,
  StackIcon,
  type Icon,
} from "@phosphor-icons/react";
import { AIInsightCard } from "@/components/ai/ai-insight-card";
import { OrderStageTracker, purchaseOrderStages, salesOrderStages } from "@/components/orders/order-parts";
import { BrandLogo } from "@/components/shared/brand-logo";
import { LoadingState } from "@/components/shared/states";
import { TeamMemberCard } from "@/components/shared/team-member-card";
import { Button } from "@/components/ui/button";
import { useHydrated } from "@/hooks/use-hydrated";
import { useIsSupplier, useMe, usePersona, usePersonaKey } from "@/features/session/use-session";
import { api, queryKeys } from "@/lib/api";
import { formatDate, formatMoney, plural } from "@/lib/format";
import { OPEN_ORDER_STATUSES, OPEN_PO_STATUSES } from "@/lib/status";
import { cn } from "@/lib/utils";
import { useOnboardingStore } from "@/stores/onboarding-store";
import { usePersonaStore } from "@/stores/persona-store";

type Step = { id: string; icon: Icon; eyebrow: string; title: string; body: string; visual: ReactNode };

/** First-run tour on the persona's own demonstration data (BLUEPRINT.md, Onboarding). */
export default function OnboardingPage() {
  const hydrated = useHydrated();
  const signedIn = usePersonaStore((s) => s.signedIn);
  const router = useRouter();

  useEffect(() => {
    if (hydrated && !signedIn) router.replace("/");
  }, [hydrated, signedIn, router]);

  if (!hydrated || !signedIn) return <div className="min-h-dvh" aria-busy="true" />;
  return <Tour />;
}

function Tour() {
  const router = useRouter();
  const persona = usePersona();
  const supplier = useIsSupplier();
  const me = useMe();
  const markSeen = useOnboardingStore((s) => s.markSeen);
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);

  const steps = useSteps(supplier);
  const step = steps[index]!;
  const last = index === steps.length - 1;

  const finish = useCallback(() => {
    markSeen(persona.contactId);
    router.replace("/dashboard");
  }, [markSeen, persona.contactId, router]);

  const go = useCallback(
    (next: number) => {
      if (next < 0 || next >= steps.length) return;
      setDirection(next > index ? 1 : -1);
      setIndex(next);
    },
    [index, steps.length],
  );

  useEffect(() => {
    // Move focus to the new step's heading so screen readers announce it (not on first load).
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [index]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest("input, textarea, select, [role=dialog]")) return;
      if (e.key === "ArrowRight") go(index + 1);
      if (e.key === "ArrowLeft") go(index - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, index]);

  const firstName = me.data?.contact.name.split(" ")[0];

  return (
    <main className="relative flex min-h-dvh flex-col overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[380px] bg-gradient-to-b from-brand-subtle to-transparent" />
      <header className="relative flex items-center justify-between px-4 py-4 sm:px-8">
        <BrandLogo className="h-7" priority />
        <Button variant="ghost" onClick={finish}>
          Skip tour
        </Button>
      </header>

      <div className="relative mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-4 pb-6 sm:px-8">
        <p className="sr-only" aria-live="polite">
          Step {index + 1} of {steps.length}: {step.title}
        </p>
        {/* Enter-only transition: exit animations stall in throttled tabs and would leave two steps on screen. */}
        <motion.section
            key={step.id}
            initial={index === 0 && direction === 1 ? false : reduce ? { opacity: 0 } : { opacity: 0, x: direction * 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 36 }}
            className="grid w-full grid-cols-1 items-center gap-8 md:grid-cols-2 md:gap-12"
            aria-labelledby="tour-heading"
          >
            <div>
              <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-card px-3 py-1 text-xs font-medium text-primary shadow-sm ring-1 ring-border">
                <step.icon weight="fill" className="size-4" aria-hidden />
                {step.eyebrow}
              </p>
              <h1 id="tour-heading" ref={headingRef} tabIndex={-1} className="text-3xl font-semibold tracking-tight text-balance outline-none sm:text-4xl">
                {index === 0 && firstName ? `Welcome, ${firstName}` : step.title}
              </h1>
              <p className="mt-4 max-w-md text-lg text-muted-foreground">{step.body}</p>
            </div>
            <div className="min-w-0">{step.visual}</div>
          </motion.section>
      </div>

      <footer className="relative border-t bg-background/80 px-4 py-4 backdrop-blur sm:px-8">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <Button variant="outline" onClick={() => go(index - 1)} disabled={index === 0} aria-label="Previous step">
            <ArrowLeftIcon aria-hidden />
            <span className="hidden sm:inline">Back</span>
          </Button>
          <ol className="flex items-center gap-2" aria-label="Tour steps">
            {steps.map((s, i) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => go(i)}
                  aria-label={`Step ${i + 1}: ${s.title}`}
                  aria-current={i === index ? "step" : undefined}
                  className={cn("block h-2 rounded-full transition-all focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none", i === index ? "w-6 bg-primary" : "w-2 bg-border hover:bg-muted-foreground/40")}
                />
              </li>
            ))}
          </ol>
          {last ? (
            <Button onClick={finish}>
              <span className="sm:hidden">Finish</span>
              <span className="hidden sm:inline">Go to your dashboard</span>
              <ArrowRightIcon aria-hidden />
            </Button>
          ) : (
            <Button onClick={() => go(index + 1)}>
              Next
              <ArrowRightIcon aria-hidden />
            </Button>
          )}
        </div>
      </footer>
    </main>
  );
}

function useSteps(supplier: boolean): Step[] {
  const persona = usePersona();
  const me = useMe();
  const accountName = me.data?.group?.account.name ?? me.data?.account.name ?? "your account";
  const welcomeBody = supplier
    ? `The Brewfitt Portal is where ${accountName} and Brewfitt work together: requests for quotation, purchase orders, payments, your product range and your stock at Brewfitt, in one place.`
    : persona.kind === "group"
      ? `Everything ${accountName} does with Brewfitt, across ${me.data?.group ? plural(me.data.group.sites.length, "site") : "your sites"}. See the group roll-up or switch into any site from the header.`
      : persona.kind === "site"
        ? `Everything ${me.data?.account.name ?? "your site"} orders from Brewfitt. Pricing, credit and your account manager come from ${me.data?.group?.account.name ?? "your group"}.`
        : `Your prices, quotes, orders, deliveries, invoices and conversations with Brewfitt, in one place, for ${accountName}.`;

  return [
    { id: "welcome", icon: HandWavingIcon, eyebrow: "Brewfitt Portal", title: "Welcome", body: welcomeBody, visual: <TeamVisual /> },
    {
      id: "dashboard",
      icon: GaugeIcon,
      eyebrow: "Your dashboard",
      title: "What needs you, at a glance",
      body: supplier ? "Open requests for quotation, purchase orders by stage, what Brewfitt owes you and how your range is moving." : "Quotes waiting for you, orders on their way, your account balance and anything that needs a reply, the moment you sign in.",
      visual: supplier ? <SupplierKpis /> : <CustomerKpis />,
    },
    supplier
      ? { id: "products", icon: CubeIcon, eyebrow: "Products and RFQs", title: "Quote, submit and keep your range current", body: "Respond to Brewfitt's requests for quotation with price and lead time, submit new products and offers for approval, and see Brewfitt's stock of your items.", visual: <SupplierProductsVisual /> }
      : { id: "configurator", icon: StackIcon, eyebrow: "Configurator and shop", title: "Build a system or reorder in minutes", body: "The configurator checks every choice is compatible and prices the bill of materials. The shop shows your prices and live stock for quick reorders.", visual: <ShopVisual /> },
    {
      id: "orders",
      icon: supplier ? PackageIcon : FileTextIcon,
      eyebrow: supplier ? "Purchase orders" : "Quotes and orders",
      title: supplier ? "Acknowledge and track purchase orders" : "Accept quotes and follow every order",
      body: supplier ? "Acknowledge purchase orders, confirm delivery dates and see payment runs, with a conversation attached to each one." : "Accept a quote online and it becomes an order. Track it from confirmation to delivery, request changes and message Brewfitt about it.",
      visual: supplier ? <PurchaseOrderVisual /> : <OrderVisual />,
    },
    {
      id: "insights",
      icon: SparkleIcon,
      eyebrow: "Simulated insights",
      title: supplier ? "See what Brewfitt is likely to need" : "Know what to reorder before you run out",
      body: supplier ? "Insights flag low stock of your items and forecast demand. Ask the assistant about any purchase order or product. In this preview insights come from fixed rules on demonstration data." : "Insights flag regular items that are due, stock running low and quotes about to expire. Ask the assistant about any order or product. In this preview insights come from fixed rules on demonstration data.",
      visual: <InsightVisual />,
    },
    { id: "done", icon: CheckCircleIcon, eyebrow: "Ready", title: "You're all set", body: "Your dashboard is next. You can take this tour again from the user menu at any time.", visual: <DoneVisual /> },
  ];
}

function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("rounded-3xl border bg-card p-5 shadow-sm sm:p-6", className)}>{children}</div>;
}

function TeamVisual() {
  const me = useMe();
  if (me.isPending) return <LoadingState rows={2} />;
  const team = (me.data?.brewfittTeam ?? []).slice(0, 3);
  return (
    <Panel>
      <p className="mb-4 text-sm font-medium">Your team at Brewfitt</p>
      <ul className="space-y-4">
        {team.map((m) => (
          <li key={m.id}>
            <TeamMemberCard member={m} compact />
          </li>
        ))}
      </ul>
      <p className="mt-5 flex items-center gap-2 border-t pt-4 text-sm text-muted-foreground">
        <ChatsCircleIcon className="size-4 text-primary" aria-hidden />
        Message them from any quote, order or case.
      </p>
    </Panel>
  );
}

function Kpi({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-2xl border bg-background p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {detail ? <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p> : null}
    </div>
  );
}

function CustomerKpis() {
  const key = usePersonaKey();
  const me = useMe();
  const quotes = useQuery({ queryKey: queryKeys.quotes(key), queryFn: () => api.quotes.list() });
  const orders = useQuery({ queryKey: queryKeys.salesOrders(key), queryFn: () => api.orders.salesOrders() });
  const threads = useQuery({ queryKey: queryKeys.threads(key), queryFn: () => api.messages.threads() });
  if (quotes.isPending || orders.isPending || me.isPending) return <LoadingState rows={2} />;
  const credit = me.data?.credit;
  return (
    <Panel>
      <div className="grid grid-cols-2 gap-3">
        <Kpi label="Quotes awaiting you" value={String((quotes.data ?? []).filter((q) => q.status === "sent").length)} />
        <Kpi label="Orders in progress" value={String((orders.data ?? []).filter((o) => OPEN_ORDER_STATUSES.includes(o.status)).length)} />
        {credit?.onAccount && credit.available && credit.limit ? <Kpi label="Credit available" value={formatMoney(credit.available, { whole: true })} detail={`of ${formatMoney(credit.limit, { whole: true })}`} /> : <Kpi label="Payment" value="By card" detail="At checkout and on invoices" />}
        <Kpi label="Unread conversations" value={String((threads.data ?? []).filter((t) => t.unreadCount > 0).length)} />
      </div>
    </Panel>
  );
}

function SupplierKpis() {
  const key = usePersonaKey();
  const rfqs = useQuery({ queryKey: queryKeys.rfqs(key), queryFn: () => api.quotes.rfqs() });
  const pos = useQuery({ queryKey: queryKeys.purchaseOrders(key), queryFn: () => api.orders.purchaseOrders() });
  const statement = useQuery({ queryKey: queryKeys.statement(key), queryFn: () => api.invoices.statement() });
  const runs = useQuery({ queryKey: queryKeys.paymentRuns(key), queryFn: () => api.invoices.paymentRuns() });
  if (rfqs.isPending || pos.isPending || statement.isPending) return <LoadingState rows={2} />;
  const next = (runs.data ?? []).filter((r) => r.status === "scheduled").sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor))[0];
  return (
    <Panel>
      <div className="grid grid-cols-2 gap-3">
        <Kpi label="RFQs awaiting response" value={String((rfqs.data ?? []).filter((r) => r.status === "open").length)} />
        <Kpi label="Open purchase orders" value={String((pos.data ?? []).filter((p) => OPEN_PO_STATUSES.includes(p.status)).length)} />
        <Kpi label="Owed by Brewfitt" value={statement.data ? formatMoney(statement.data.closingBalance, { whole: true }) : "None"} />
        <Kpi label="Next payment run" value={next ? formatMoney(next.total, { whole: true }) : "None scheduled"} detail={next ? formatDate(next.scheduledFor) : undefined} />
      </div>
    </Panel>
  );
}

function ShopVisual() {
  const key = usePersonaKey();
  const priceList = useQuery({ queryKey: queryKeys.priceList(key), queryFn: () => api.priceList.get() });
  if (priceList.isPending) return <LoadingState rows={2} />;
  const picks = (priceList.data?.lines ?? []).filter((l) => l.product.images.length).filter((_, i) => i % 23 === 0).slice(0, 4);
  return (
    <Panel>
      <ul className="grid grid-cols-2 gap-3">
        {picks.map((l) => (
          <li key={l.productId} className="rounded-2xl border bg-background p-3">
            <div className="relative aspect-square overflow-hidden rounded-xl bg-white">
              <Image src={l.product.images[0]!} alt="" fill sizes="160px" className="object-contain p-2" />
            </div>
            <p className="mt-2 line-clamp-2 text-xs font-medium">{l.product.name}</p>
            <p className="text-xs text-muted-foreground tabular-nums">{formatMoney(l.price)}</p>
          </li>
        ))}
      </ul>
      <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
        <ShoppingCartIcon className="size-4 text-primary" aria-hidden />
        Your prices, not list prices.
      </p>
    </Panel>
  );
}

function SupplierProductsVisual() {
  const key = usePersonaKey();
  const submissions = useQuery({ queryKey: queryKeys.supplierProducts(key), queryFn: () => api.supplierProducts.list() });
  const rfqs = useQuery({ queryKey: queryKeys.rfqs(key), queryFn: () => api.quotes.rfqs() });
  if (submissions.isPending || rfqs.isPending) return <LoadingState rows={2} />;
  const next = (rfqs.data ?? []).filter((r) => r.status === "open").sort((a, b) => a.deadline.localeCompare(b.deadline))[0];
  const count = (s: string) => (submissions.data ?? []).filter((x) => x.status === s).length;
  return (
    <Panel className="space-y-3">
      {next ? (
        <div className="rounded-2xl border bg-background p-4">
          <p className="text-xs text-muted-foreground">Next RFQ due</p>
          <p className="mt-1 font-medium">
            {next.number} · {formatDate(next.deadline)}
          </p>
        </div>
      ) : null}
      <div className="grid grid-cols-3 gap-3">
        <Kpi label="Submitted" value={String(count("submitted"))} />
        <Kpi label="In review" value={String(count("under-review"))} />
        <Kpi label="Approved" value={String(count("approved"))} />
      </div>
    </Panel>
  );
}

function OrderVisual() {
  const key = usePersonaKey();
  const orders = useQuery({ queryKey: queryKeys.salesOrders(key), queryFn: () => api.orders.salesOrders() });
  const deliveries = useQuery({ queryKey: queryKeys.deliveries(key), queryFn: () => api.deliveries.list() });
  if (orders.isPending || deliveries.isPending) return <LoadingState rows={2} />;
  const sorted = [...(orders.data ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const order = sorted.find((o) => o.status === "dispatched" || o.status === "picking") ?? sorted.find((o) => OPEN_ORDER_STATUSES.includes(o.status)) ?? sorted[0];
  if (!order) return <Panel>Your orders will appear here with every stage from confirmation to delivery.</Panel>;
  return (
    <Panel>
      <p className="text-xs text-muted-foreground">Your order</p>
      <p className="mt-1 mb-5 font-medium">
        {order.number} · {formatMoney(order.total)}
      </p>
      <OrderStageTracker stages={salesOrderStages(order, (deliveries.data ?? []).filter((d) => d.orderId === order.id))} cancelled={order.status === "cancelled"} />
    </Panel>
  );
}

function PurchaseOrderVisual() {
  const key = usePersonaKey();
  const pos = useQuery({ queryKey: queryKeys.purchaseOrders(key), queryFn: () => api.orders.purchaseOrders() });
  const deliveries = useQuery({ queryKey: queryKeys.deliveries(key), queryFn: () => api.deliveries.list() });
  if (pos.isPending || deliveries.isPending) return <LoadingState rows={2} />;
  const po = [...(pos.data ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).find((p) => OPEN_PO_STATUSES.includes(p.status)) ?? pos.data?.[0];
  if (!po) return <Panel>Purchase orders from Brewfitt will appear here.</Panel>;
  return (
    <Panel>
      <p className="text-xs text-muted-foreground">Purchase order</p>
      <p className="mt-1 mb-5 font-medium">
        {po.number} · expected {formatDate(po.expectedDate)}
      </p>
      <OrderStageTracker stages={purchaseOrderStages(po, (deliveries.data ?? []).filter((d) => d.orderId === po.id))} />
    </Panel>
  );
}

function InsightVisual() {
  const key = usePersonaKey();
  const supplier = useIsSupplier();
  const insights = useQuery({ queryKey: queryKeys.insights(key), queryFn: () => api.ai.insights() });
  if (insights.isPending) return <LoadingState rows={2} />;
  const insight = insights.data?.[0];
  if (!insight) return <Panel>No insights right now. They appear when a regular item is due or stock runs low.</Panel>;
  return <AIInsightCard insight={insight} supplier={supplier} />;
}

function DoneVisual() {
  return (
    <Panel className="flex flex-col items-center py-10 text-center">
      <motion.span initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 300, damping: 18 }} className="flex size-16 items-center justify-center rounded-full bg-success-subtle text-success">
        <CheckCircleIcon weight="fill" className="size-9" aria-hidden />
      </motion.span>
      <p className="mt-4 font-medium">Tour complete</p>
      <p className="mt-1 text-sm text-muted-foreground">Go back to any step with Back or the arrow keys.</p>
    </Panel>
  );
}

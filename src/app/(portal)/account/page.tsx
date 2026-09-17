"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ChatsCircleIcon,
  CreditCardIcon,
  FileTextIcon,
  LifebuoyIcon,
  PackageIcon,
  PencilSimpleIcon,
  ReceiptIcon,
  TagIcon,
  TruckIcon,
} from "@phosphor-icons/react";
import { CompanyDetailsDialog, ComplianceDocuments, GroupSites, PendingChanges } from "@/components/account/account-panels";
import { AddressesPanel } from "@/components/account/addresses";
import { ContactsPanel } from "@/components/account/contacts";
import { BarChart, monthBarLabels } from "@/components/shared/bar-chart";
import { PageHeader } from "@/components/shared/page-header";
import { ErrorState, LoadingState } from "@/components/shared/states";
import { StatusPill } from "@/components/shared/status-pill";
import { TeamMemberCard } from "@/components/shared/team-member-card";
import { Timeline, type TimelineEntry } from "@/components/shared/timeline";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { customerSpend, useAccountActivity, useAccountQueries, type ActivityItem } from "@/features/account/use-account";
import { useIsSupplier, usePersonaKey } from "@/features/session/use-session";
import { api, queryKeys } from "@/lib/api";
import { formatDate, formatMoney, formatSince, plural } from "@/lib/format";
import { hrefFor } from "@/lib/links";
import type { Account } from "@/types";

const SECTOR: Record<Account["sector"], string> = {
  brewery: "Brewery",
  "brand-owner": "Brand owner",
  "pub-group": "Pub group",
  pub: "Pub and bar",
  restaurant: "Restaurant",
  hotel: "Hotel",
  manufacturer: "Manufacturer",
  distributor: "Distributor",
};

const TERMS: Record<Account["paymentTerms"], string> = {
  proforma: "Payment with order",
  "7-days": "7 days",
  "14-days": "14 days",
  "30-days": "30 days from invoice",
  "30-days-eom": "30 days end of month",
  "60-days": "60 days from invoice",
};

const HEALTH = { strong: { label: "Strong relationship", tone: "success" }, steady: { label: "Steady relationship", tone: "info" }, "at-risk": { label: "Needs attention", tone: "warning" } } as const;

const ACTIVITY_ICON: Record<ActivityItem["kind"], TimelineEntry["icon"]> = {
  order: PackageIcon,
  delivery: TruckIcon,
  invoice: ReceiptIcon,
  payment: CreditCardIcon,
  message: ChatsCircleIcon,
  case: LifebuoyIcon,
  submission: TagIcon,
  note: FileTextIcon,
};

export default function AccountPage() {
  const q = useAccountQueries();
  const supplier = useIsSupplier();
  const key = usePersonaKey();
  const activity = useAccountActivity(25);
  const performance = useQuery({ queryKey: queryKeys.supplierPerformance(key), queryFn: () => api.supplierProducts.performance(), enabled: supplier });
  const productsQuery = useQuery({ queryKey: queryKeys.products(key), queryFn: () => api.products.list() });
  const [editOpen, setEditOpen] = useState(false);

  const me = q.me.data;
  const account = q.account.data;
  const accountNames = useMemo(() => new Map([...(me?.group ? [me.group.account, ...me.group.sites] : []), ...(account ? [account] : [])].map((a) => [a.id, a.name])), [me, account]);
  const productName = useMemo(() => new Map((productsQuery.data ?? []).map((p) => [p.id, p.name])), [productsQuery.data]);

  const spend = useMemo(() => (activity.orders.data ? customerSpend(activity.orders.data) : null), [activity.orders.data]);

  if (q.account.isPending || q.me.isPending) return <LoadingState rows={4} label="Loading account" />;
  if (q.account.isError) return <ErrorState error={q.account.error} onRetry={() => q.account.refetch()} />;
  if (q.me.isError) return <ErrorState error={q.me.error} onRetry={() => q.me.refetch()} />;
  const a = q.account.data;
  const commercial = me?.group && a.parentAccountId ? me.group.account : a;
  const health = HEALTH[a.relationshipHealth];

  const chart = supplier
    ? performance.data
      ? {
          bars: performance.data.monthly.map((m) => ({ key: m.month, ...monthBarLabels(m.month), value: m.total.amount, display: formatMoney(m.total, { whole: true }) })),
          summary: `Brewfitt bought ${formatMoney(performance.data.last12Months, { whole: true })} from you over the last 12 months.`,
          top: performance.data.topProducts.map((t) => ({ id: t.productId, total: t.total.amount, qty: t.quantity })),
        }
      : null
    : spend
      ? {
          bars: spend.monthly.map((m) => ({ key: m.month, ...monthBarLabels(m.month), value: m.total, display: formatMoney({ amount: m.total, currency: "GBP" }, { whole: true }) })),
          summary: `You spent ${formatMoney({ amount: spend.total, currency: "GBP" }, { whole: true })} with Brewfitt over the last 12 months, excluding VAT, across ${plural(spend.monthly.reduce((s, m) => s + m.count, 0), "order")}.`,
          top: spend.top.map(([id, t]) => ({ id, total: t.total, qty: t.qty })),
        }
      : null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={SECTOR[a.sector]}
        title={a.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <StatusPill tone={health.tone}>{health.label}</StatusPill>
            <span>{supplier ? "Supplying" : "Customer of"} Brewfitt since {formatDate(a.createdAt)}</span>
            <span aria-hidden>·</span>
            <span>Last contact {formatSince(a.lastContactAt)}</span>
          </span>
        }
        actions={
          a.isGroup || !a.parentAccountId ? (
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <PencilSimpleIcon aria-hidden />
              Edit company details
            </Button>
          ) : null
        }
      />

      <PendingChanges changes={[...a.pendingChanges, ...(commercial.id !== a.id ? commercial.pendingChanges : [])]} />

      <Tabs defaultValue="overview">
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="contacts">Contacts</TabsTrigger>
            <TabsTrigger value="addresses">Addresses</TabsTrigger>
            <TabsTrigger value="documents">Compliance and agreements</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="mt-5">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <section aria-labelledby="identity" className="rounded-2xl border bg-card p-5">
              <h2 id="identity" className="mb-4 font-medium">
                Company
              </h2>
              <dl className="space-y-3 text-sm">
                <Row label="Company number" value={commercial.companyNumber ?? "Not held"} />
                <Row label="VAT number" value={commercial.vatNumber ?? "Not VAT registered in the UK"} />
                <Row label="Payment terms" value={TERMS[commercial.paymentTerms]} />
                {supplier ? (
                  <Row label="Agreed terms" value="Brewfitt pays in fortnightly payment runs" />
                ) : commercial.onAccount && commercial.creditLimit ? (
                  <>
                    <Row label="Credit limit" value={`${formatMoney(commercial.creditLimit, { whole: true })}${commercial.id !== a.id ? `, held by ${commercial.name}` : ""}`} />
                    {me?.credit?.available ? <Row label="Credit available" value={formatMoney(me.credit.available, { whole: true })} /> : null}
                  </>
                ) : (
                  <Row label="Credit" value="No credit terms; orders are paid by card" />
                )}
                <Row label="Price list" value={supplier ? "Agreed cost prices" : commercial.priceListId ? "Assigned trade price list" : "Standard"} href={supplier ? "/stock" : "/price-list"} />
              </dl>
            </section>

            <section aria-labelledby="relationship" className="rounded-2xl border bg-card p-5 lg:col-span-2">
              <h2 id="relationship" className="mb-4 font-medium">
                {supplier ? "Purchases by Brewfitt" : "Spend with Brewfitt"}
              </h2>
              {!chart ? (
                <LoadingState rows={2} />
              ) : (
                <div className="grid grid-cols-1 gap-5 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
                  <BarChart bars={chart.bars} summary={chart.summary} />
                  <div>
                    <p className="mb-2 text-xs font-medium text-muted-foreground">Top products</p>
                    <ol className="space-y-2 text-sm">
                      {chart.top.slice(0, 5).map((t) => (
                        <li key={t.id} className="flex justify-between gap-3">
                          <span className="line-clamp-1">{productName.get(t.id) ?? "Product"}</span>
                          <span className="shrink-0 tabular-nums text-muted-foreground">{formatMoney({ amount: t.total, currency: "GBP" }, { whole: true })}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>
              )}
            </section>

            <section aria-labelledby="team" className="rounded-2xl border bg-card p-5">
              <h2 id="team" className="mb-4 font-medium">
                Your Brewfitt team
              </h2>
              <ul className="space-y-3">
                {me?.brewfittTeam.map((m) => (
                  <li key={m.id}>
                    <TeamMemberCard member={m} compact />
                  </li>
                ))}
              </ul>
            </section>

            <section aria-labelledby="recent" className="rounded-2xl border bg-card p-5 lg:col-span-2">
              <h2 id="recent" className="mb-3 font-medium">
                Recent activity
              </h2>
              {activity.loading ? (
                <LoadingState rows={3} />
              ) : activity.error ? (
                <ErrorState error={activity.error} />
              ) : (
                <Timeline entries={activity.items.slice(0, 6).map((i) => ({ id: i.id, at: i.at, title: i.title, detail: i.detail, href: supplier && i.relatedType === "product" ? "/stock" : hrefFor(i.relatedType, i.relatedId), icon: ACTIVITY_ICON[i.kind] }))} />
              )}
            </section>

            {me?.group ? (
              <div className="lg:col-span-3">
                <GroupSites group={me.group.account} sites={me.group.sites} />
              </div>
            ) : null}
          </div>
        </TabsContent>

        <TabsContent value="contacts" className="mt-5">
          {q.contacts.isPending ? <LoadingState /> : q.contacts.isError ? <ErrorState error={q.contacts.error} onRetry={() => q.contacts.refetch()} /> : <ContactsPanel contacts={q.contacts.data} />}
        </TabsContent>

        <TabsContent value="addresses" className="mt-5">
          {q.addresses.isPending ? <LoadingState /> : q.addresses.isError ? <ErrorState error={q.addresses.error} onRetry={() => q.addresses.refetch()} /> : <AddressesPanel addresses={q.addresses.data} accountNames={accountNames.size > 1 ? accountNames : undefined} />}
        </TabsContent>

        <TabsContent value="documents" className="mt-5">
          {q.documents.isPending ? <LoadingState /> : q.documents.isError ? <ErrorState error={q.documents.error} onRetry={() => q.documents.refetch()} /> : <ComplianceDocuments documents={q.documents.data} canUpload />}
        </TabsContent>

        <TabsContent value="activity" className="mt-5">
          <section aria-label="Account activity" className="rounded-2xl border bg-card p-5">
            {activity.loading ? (
              <LoadingState rows={6} />
            ) : activity.error ? (
              <ErrorState error={activity.error} />
            ) : (
              <Timeline entries={activity.items.map((i) => ({ id: i.id, at: i.at, title: i.title, detail: i.detail, href: hrefFor(i.relatedType, i.relatedId), icon: ACTIVITY_ICON[i.kind] }))} />
            )}
          </section>
        </TabsContent>
      </Tabs>

      {editOpen ? <CompanyDetailsDialog account={commercial} open={editOpen} onOpenChange={setEditOpen} /> : null}
    </div>
  );
}

function Row({ label, value, href }: { label: string; value: string; href?: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">
        {href ? (
          <Link href={href} className="text-primary hover:underline">
            {value}
          </Link>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}

"use client";

import { PageHeader } from "@/components/shared/page-header";
import { useMe } from "@/features/session/use-session";

export default function DashboardPage() {
  const me = useMe();
  const firstName = me.data?.contact.name.split(" ")[0];
  return <PageHeader eyebrow={me.data?.account.name} title={firstName ? `Good to see you, ${firstName}` : "Dashboard"} description="Where you stand with Brewfitt and what needs your attention." />;
}

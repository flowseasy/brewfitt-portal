"use client";

import { CustomerDashboard } from "@/components/dashboard/customer-dashboard";
import { SupplierDashboard } from "@/components/dashboard/supplier-dashboard";
import { useIsSupplier } from "@/features/session/use-session";

export default function DashboardPage() {
  return useIsSupplier() ? <SupplierDashboard /> : <CustomerDashboard />;
}

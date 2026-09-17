"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ErrorState, LoadingState } from "@/components/shared/states";
import { usePersonaKey } from "@/features/session/use-session";
import { api } from "@/lib/api";
import { hrefFor } from "@/lib/links";

/** Deliveries live on their order; this route opens the order at that delivery. */
export default function DeliveryRedirectPage() {
  return (
    <Suspense fallback={<LoadingState rows={3} />}>
      <DeliveryRedirect />
    </Suspense>
  );
}

function DeliveryRedirect() {
  const id = useSearchParams().get("id") ?? "";
  const router = useRouter();
  const key = usePersonaKey();
  const delivery = useQuery({ queryKey: [key, "deliveries", id], queryFn: () => api.deliveries.get(id), enabled: !!id });

  useEffect(() => {
    if (delivery.data) router.replace(`${hrefFor(delivery.data.orderType === "sales" ? "sales-order" : "purchase-order", delivery.data.orderId)}#${delivery.data.id}`);
  }, [delivery.data, router]);

  if (delivery.isError) return <ErrorState error={delivery.error} onRetry={() => delivery.refetch()} />;
  return <LoadingState rows={3} label="Opening delivery" />;
}

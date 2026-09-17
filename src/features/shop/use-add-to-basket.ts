"use client";

import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, errorMessage, queryKeys } from "@/lib/api";
import { usePersonaKey } from "@/features/session/use-session";

export function useAddToBasket() {
  const key = usePersonaKey();
  const queryClient = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: (input: { productId: string; qty: number; name: string }) =>
      api.shop.addToBasket({ productId: input.productId, qty: input.qty }),
    onSuccess: (basket, input) => {
      queryClient.setQueryData(queryKeys.basket(key), basket);
      toast.success(`${input.qty} × ${input.name} added to your basket`, {
        action: { label: "View basket", onClick: () => router.push("/shop/basket") },
      });
    },
    onError: (error) =>
      toast.error("Could not add to basket", { description: errorMessage(error) }),
  });
}

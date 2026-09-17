"use client";

import Link from "next/link";
import { ShoppingCartSimpleIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { useBasketCount } from "@/features/shop/use-catalogue";

export function BasketButton() {
  const count = useBasketCount();
  return (
    <Button asChild variant={count ? "default" : "outline"} className="rounded-full">
      <Link href="/shop/basket" aria-label={count ? `Basket, ${count} items` : "Basket, empty"}>
        <ShoppingCartSimpleIcon aria-hidden />
        Basket
        {count ? <span className="rounded-full bg-primary-foreground/20 px-1.5 text-xs tabular-nums">{count}</span> : null}
      </Link>
    </Button>
  );
}

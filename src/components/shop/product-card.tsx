"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { BellRingingIcon, BellSimpleIcon, ShoppingCartSimpleIcon } from "@phosphor-icons/react";
import { toast } from "sonner";
import { StockPill } from "@/components/shared/stock-pill";
import { Button } from "@/components/ui/button";
import type { CatalogueLine } from "@/features/shop/use-catalogue";
import { useAddToBasket } from "@/features/shop/use-add-to-basket";
import { formatMoney } from "@/lib/format";
import { hrefFor } from "@/lib/links";
import { useShopStore } from "@/stores/shop-store";
import { QuantityStepper } from "./quantity-stepper";

export function ProductImage({
  src,
  alt,
  className,
  sizes = "240px",
  priority,
}: {
  src: string | undefined;
  alt: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
}) {
  return (
    <div className={`relative overflow-hidden bg-white ${className ?? ""}`}>
      {src ? (
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          priority={priority}
          className="object-contain p-3"
        />
      ) : null}
    </div>
  );
}

export function NotifyMeButton({
  productId,
  name,
  size = "sm",
}: {
  productId: string;
  name: string;
  size?: "sm" | "default";
}) {
  const on = useShopStore((s) => s.notifyMe.includes(productId));
  const toggle = useShopStore((s) => s.toggleNotify);
  return (
    <Button
      type="button"
      size={size}
      variant={on ? "secondary" : "outline"}
      aria-pressed={on}
      onClick={() => {
        const now = toggle(productId);
        toast.success(
          now ? `We will let you know when ${name} is back in stock` : "Stock alert removed",
        );
      }}
    >
      {on ? <BellRingingIcon weight="fill" aria-hidden /> : <BellSimpleIcon aria-hidden />}
      {on ? "Alert set" : "Notify me"}
    </Button>
  );
}

export function ProductCard({ line, index = 0 }: { line: CatalogueLine; index?: number }) {
  const [qty, setQty] = useState(1);
  const add = useAddToBasket();
  const p = line.product;
  const unavailable = line.stock?.status === "out";
  return (
    <motion.article
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: Math.min(index, 12) * 0.02 }}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border bg-card transition hover:border-primary/30 hover:shadow-sm"
    >
      <Link href={hrefFor("product", p.id)} className="block" tabIndex={-1} aria-hidden>
        <ProductImage
          src={p.images[0]}
          alt=""
          className="aspect-[4/3] border-b transition group-hover:scale-[1.01]"
        />
      </Link>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="line-clamp-2 min-h-[2.5rem] text-sm leading-snug font-medium">
          <Link href={hrefFor("product", p.id)} className="hover:underline">
            {p.name}
          </Link>
        </h3>
        <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">SKU {p.sku}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <StockPill stock={line.stock} />
          {p.packSize > 1 ? (
            <span className="text-xs text-muted-foreground">Pack of {p.packSize}</span>
          ) : null}
        </div>
        <div className="mt-auto pt-3">
          <p className="flex items-baseline gap-2">
            <span className="text-lg font-semibold tabular-nums">{formatMoney(line.price)}</span>
            {line.discountPercent > 0 ? (
              <span className="text-xs text-muted-foreground tabular-nums line-through">
                {formatMoney(p.listPrice)}
              </span>
            ) : null}
          </p>
          <p className="text-[11px] text-muted-foreground">
            Your price per {p.unit === "each" ? "item" : p.unit}, ex VAT
          </p>
          <div className="mt-3 flex items-center gap-2">
            {unavailable ? (
              <NotifyMeButton productId={p.id} name={p.name} />
            ) : (
              <>
                <QuantityStepper value={qty} onChange={setQty} label={p.name} size="sm" />
                <Button
                  size="sm"
                  className="flex-1"
                  disabled={add.isPending}
                  onClick={() => add.mutate({ productId: p.id, qty, name: p.name })}
                  aria-label={`Add ${qty} × ${p.name} to basket`}
                >
                  <ShoppingCartSimpleIcon aria-hidden />
                  Add
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </motion.article>
  );
}

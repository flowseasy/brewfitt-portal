import Image from "next/image";
import { cn } from "@/lib/utils";

/** Brewfitt master logo (white serif wordmark on brand blue). */
export function BrandLogo({ className, priority }: { className?: string; priority?: boolean }) {
  return (
    <Image
      src="/brand/brewfitt-logo.jpg"
      alt="Brewfitt"
      width={2230}
      height={560}
      priority={priority}
      className={cn("h-7 w-auto rounded-[5px]", className)}
    />
  );
}

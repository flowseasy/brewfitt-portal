"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MotionConfig } from "framer-motion";
import { ApiError } from "@/lib/api";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { ThemeSync } from "@/components/shared/theme-sync";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            // A missing or forbidden record will not appear on retry; other failures get one more try.
            retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 1,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <MotionConfig reducedMotion="user">
        <TooltipProvider delayDuration={300}>
          <ThemeSync />
          {children}
          <Toaster position="top-right" />
        </TooltipProvider>
      </MotionConfig>
    </QueryClientProvider>
  );
}

"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { BellIcon } from "@phosphor-icons/react";
import { AssistantButton, AssistantPanel } from "@/components/ai/assistant-panel";
import { Button } from "@/components/ui/button";
import { usePersonaKey } from "@/features/session/use-session";
import { api, queryKeys } from "@/lib/api";
import { BrandLogo } from "./brand-logo";
import { GlobalSearch } from "./global-search";
import { PrimaryCta } from "./primary-cta";
import { SiteSwitcher } from "./site-switcher";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";

export function Header() {
  const key = usePersonaKey();
  const notifications = useQuery({
    queryKey: queryKeys.notifications(key),
    queryFn: () => api.notifications.list(),
    refetchInterval: 60_000,
  });
  const unread = notifications.data?.filter((n) => !n.read).length ?? 0;

  return (
    <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur-lg">
      <div className="flex h-16 items-center gap-2 px-4 sm:gap-3 lg:px-8">
        <Link href="/dashboard" className="shrink-0 lg:hidden" aria-label="Brewfitt Portal home">
          <BrandLogo className="h-6" />
        </Link>
        <div className="hidden lg:block">
          <SiteSwitcher />
        </div>
        <div className="ml-auto flex min-w-0 items-center gap-1.5 sm:gap-2">
          <div className="w-9 sm:w-auto">
            <GlobalSearch />
          </div>
          <AssistantButton />
          <ThemeToggle />
          <Button asChild variant="ghost" size="icon" className="relative rounded-full">
            <Link
              href="/notifications"
              aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
            >
              <BellIcon className="size-5" aria-hidden />
              {unread ? (
                <span className="absolute top-1 right-1 flex min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] leading-4 font-semibold text-white">
                  {unread > 9 ? "9+" : unread}
                </span>
              ) : null}
            </Link>
          </Button>
          <div className="hidden sm:block">
            <PrimaryCta />
          </div>
          <UserMenu />
        </div>
      </div>
      <AssistantPanel />
      <div className="px-4 pb-3 lg:hidden [&:empty]:hidden">
        <SiteSwitcher />
      </div>
    </header>
  );
}

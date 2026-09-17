"use client";

import { MoonIcon, SunIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { useHydrated } from "@/hooks/use-hydrated";
import { resolveTheme, useThemeStore } from "@/stores/theme-store";

/** One-click light/dark switch. "Match device" stays available in the user menu. */
export function ThemeToggle({ className }: { className?: string }) {
  const hydrated = useHydrated();
  const preference = useThemeStore((s) => s.preference);
  const setPreference = useThemeStore((s) => s.setPreference);
  const dark = hydrated && resolveTheme(preference) === "dark";
  const label = dark ? "Switch to light mode" : "Switch to dark mode";

  return (
    <Button
      variant="ghost"
      size="icon"
      className={className ?? "rounded-full"}
      onClick={() => setPreference(dark ? "light" : "dark")}
      aria-label={label}
      title={label}
    >
      {dark ? (
        <SunIcon className="size-5" aria-hidden />
      ) : (
        <MoonIcon className="size-5" aria-hidden />
      )}
    </Button>
  );
}

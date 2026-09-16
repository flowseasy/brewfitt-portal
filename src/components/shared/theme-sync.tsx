"use client";

import { useEffect } from "react";
import { resolveTheme, THEME_STORAGE_KEY, useThemeStore } from "@/stores/theme-store";

/** Applies the persisted theme preference to <html> and follows the OS when set to system. */
export function ThemeSync() {
  const preference = useThemeStore((s) => s.preference);

  useEffect(() => {
    const apply = () => {
      const theme = resolveTheme(preference);
      document.documentElement.classList.toggle("dark", theme === "dark");
      document.documentElement.style.colorScheme = theme;
    };
    apply();
    if (preference !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [preference]);

  return null;
}

/** Inline script run before paint so the first frame uses the right theme. */
export const themeBootScript = `(function(){try{var p="system";var s=localStorage.getItem("${THEME_STORAGE_KEY}");if(s){p=JSON.parse(s).state.preference||p}var d=p==="dark"||(p==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);var e=document.documentElement;e.classList.toggle("dark",d);e.style.colorScheme=d?"dark":"light"}catch(_){}})();`;

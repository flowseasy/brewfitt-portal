"use client";

import { useEffect } from "react";

const APP = "Brewfitt Portal";

/** Static export pages share one <title>; set a unique one per screen for tabs and screen readers. */
export function useDocumentTitle(title: string | null | undefined) {
  useEffect(() => {
    document.title = title ? `${title} · ${APP}` : APP;
  }, [title]);
}

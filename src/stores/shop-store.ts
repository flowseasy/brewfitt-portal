import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Shop UI state kept in this browser: notify-me requests for out-of-stock
 * items (Phase 2 sends these to TOTA360v5) and the catalogue view preference.
 */
type ShopState = {
  notifyMe: string[];
  view: "grid" | "list";
  toggleNotify: (productId: string) => boolean;
  setView: (view: "grid" | "list") => void;
};

export const useShopStore = create<ShopState>()(
  persist(
    (set, get) => ({
      notifyMe: [],
      view: "grid",
      toggleNotify: (productId) => {
        const on = !get().notifyMe.includes(productId);
        set({ notifyMe: on ? [...get().notifyMe, productId] : get().notifyMe.filter((id) => id !== productId) });
        return on;
      },
      setView: (view) => set({ view }),
    }),
    { name: "brewfitt-shop" },
  ),
);

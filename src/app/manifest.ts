import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Brewfitt Portal",
    short_name: "Brewfitt",
    description: "Customer and supplier portal for Brewfitt Limited, powered by TOTA360v5.",
    start_url: "/",
    display: "standalone",
    background_color: "#FFFFFF",
    theme_color: "#1A75BC",
    icons: [{ src: "/brand/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}

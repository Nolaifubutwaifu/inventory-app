import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Warehouse Inventory",
    short_name: "Inventory",
    description: "Phone-first warehouse inventory counting",
    start_url: "/",
    display: "standalone",
    background_color: "#f8fafc",
    theme_color: "#2563eb",
    orientation: "portrait",
    icons: [
      {
        src: "/icon.svg",
        type: "image/svg+xml",
        sizes: "any",
        purpose: "any",
      },
      {
        src: "/apple-icon.svg",
        type: "image/svg+xml",
        sizes: "180x180",
        purpose: "maskable",
      },
    ],
  };
}

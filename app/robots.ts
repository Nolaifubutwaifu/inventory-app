import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/privacy", "/support"],
        disallow: [
          "/account",
          "/auth/",
          "/count",
          "/count/",
          "/export",
          "/items",
          "/items/",
          "/sessions",
          "/sessions/",
          "/welcome",
          "/api/",
        ],
      },
    ],
  };
}

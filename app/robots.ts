import type { MetadataRoute } from "next";
import { siteOrigin } from "@/lib/business";
export default function robots(): MetadataRoute.Robots {
  return {
    rules:
      process.env.SITE_INDEXABLE === "true"
        ? { userAgent: "*", allow: "/", disallow: ["/admin", "/api/"] }
        : { userAgent: "*", disallow: "/" },
    sitemap: `${siteOrigin}/sitemap.xml`,
  };
}

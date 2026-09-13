import type { MetadataRoute } from "next";
import { siteOrigin } from "@/lib/business";
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: siteOrigin, changeFrequency: "weekly", priority: 1 }];
}

import type { MetadataRoute } from "next";

const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://kanbedu.com";

// Public, indexable pages only. The app itself is behind auth and not listed.
// The bare "/" is omitted on purpose: it redirects unauthenticated visitors
// (including crawlers) to /landing, so /landing is the canonical homepage.
export default function sitemap(): MetadataRoute.Sitemap {
  const paths = ["/landing", "/terms", "/privacy", "/credits"];
  return paths.map((path) => ({
    url: `${baseUrl}${path}`,
    lastModified: new Date(),
    changeFrequency: "monthly",
    priority: path === "/landing" ? 1 : 0.6,
  }));
}

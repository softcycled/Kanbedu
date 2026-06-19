import type { MetadataRoute } from "next";

const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://kanbedu.com";

// Public, indexable pages only. The app itself is behind auth and not listed.
export default function sitemap(): MetadataRoute.Sitemap {
  const paths = ["", "/landing", "/terms", "/privacy", "/credits"];
  return paths.map((path) => ({
    url: `${baseUrl}${path}`,
    lastModified: new Date(),
    changeFrequency: "monthly",
    priority: path === "" ? 1 : 0.6,
  }));
}

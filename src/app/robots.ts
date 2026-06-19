import type { MetadataRoute } from "next";

const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://kanbedu.com";

// Allow crawling of public marketing/legal pages; keep the API, admin, and the
// Sentry monitoring tunnel out of the index. Authed app routes redirect to
// login for unauthenticated crawlers, so they expose no indexable content.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/admin", "/monitoring"],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}

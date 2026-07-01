import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Prevent Turbopack from bundling Prisma — required so the regenerated
  // client + native engine are loaded fresh at runtime instead of from a stale bundle.
  serverExternalPackages: ["@prisma/client", ".prisma/client"],

  // Reduce serverless function sizes by keeping heavy client-only libs out of SSR
  experimental: {
    optimizePackageImports: ["recharts", "@dnd-kit/core", "@dnd-kit/sortable", "@dnd-kit/utilities"],
  },

  // Disable x-powered-by header in production
  poweredByHeader: false,

  // Static security headers (non-CSP). CSP is set per-request in proxy.ts
  // with a fresh nonce so unsafe-inline is not required for scripts.
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
        ],
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: true,
  telemetry: false,
  tunnelRoute: "/monitoring",
  hideSourceMaps: true,
  widenClientFileUpload: false,
});

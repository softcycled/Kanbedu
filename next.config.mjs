/** @type {import('next').NextConfig} */
const nextConfig = {
  // Use SWC for minification (faster than Terser)
  swcMinify: true,

  // Reduce serverless function sizes by keeping heavy client-only libs out of SSR
  experimental: {
    optimizePackageImports: ["recharts"],
  },

  // Disable x-powered-by header in production
  poweredByHeader: false,
};

export default nextConfig;

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // better-sqlite3 is a native module and must not be bundled — it needs to be
  // traced and copied into the standalone output as-is. In Next.js 14+ this
  // option lives at the top level (it was promoted out of experimental in 14.0).
  serverComponentsExternalPackages: ['better-sqlite3'],
  experimental: {
    instrumentationHook: true,
  },
};

export default nextConfig;

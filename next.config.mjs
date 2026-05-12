/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    instrumentationHook: true,
    // better-sqlite3 is a native module and must not be bundled — it needs to
    // be traced and copied into the standalone output as-is. In Next.js 14
    // this option lives under `experimental`; it was only promoted to the
    // top level (and renamed `serverExternalPackages`) in Next.js 15.
    serverComponentsExternalPackages: ['better-sqlite3'],
  },
};

export default nextConfig;

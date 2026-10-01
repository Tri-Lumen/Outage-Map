const isDev = process.env.NODE_ENV !== 'production';

// A per-request nonce (via middleware) would be the stricter option for
// script-src, but it's incompatible with this app's statically-prerendered
// pages (/status, /maintenance, /dependencies, /incidents, /_not-found):
// their HTML is rendered once at build time with whatever nonce was current
// then, while middleware mints a brand new nonce on every request for the
// response header — the two can never match again after the first request,
// so every inline script and chunk load on those pages gets silently
// blocked. 'unsafe-inline' is the same tradeoff already made for style-src
// below, for the same reason: fixing it for real means forcing every static
// page to `export const dynamic = 'force-dynamic'`, losing prerendering.
const csp = [
  `default-src 'self'`,
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  `style-src 'self' 'unsafe-inline'`,
  `img-src 'self' data:`,
  `font-src 'self' data:`,
  `connect-src 'self'${isDev ? ' ws:' : ''}`,
  `object-src 'none'`,
  `base-uri 'self'`,
  `form-action 'self'`,
].join('; ');

// Deliberately omits frame-ancestors / X-Frame-Options: /embed is a
// cross-origin-embeddable <iframe> widget by design (see
// src/app/embed/route.ts), and scoping a restrictive frame directive to
// "every route except one" needs a fragile path regex, so this is left out
// everywhere rather than risk silently breaking the embed feature.
const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

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
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;

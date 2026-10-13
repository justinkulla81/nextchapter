import type { NextConfig } from "next";

// Same region as NEXT_PUBLIC_POSTHOG_HOST (e.g. https://us.i.posthog.com or
// https://eu.i.posthog.com) — set once here since next.config.ts runs in
// Node, not the browser bundle.
const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";
const posthogAssetHost = posthogHost.replace("https://", "https://").replace(/^https:\/\/(\w+)\./, "https://$1-assets.");

const nextConfig: NextConfig = {
  // Lets verification builds run into a throwaway directory
  // (NEXT_DIST_DIR=.next-verify-foo next build) instead of overwriting the
  // real .next a dev server or the deployed build might be using — this
  // var was referenced by verification steps throughout this project's
  // history but was never actually wired up here, so every "isolated"
  // build silently built into the normal .next instead (harmless, since
  // .next is gitignored, but not actually isolated). Defaults to Next's
  // own default when unset.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  experimental: {
    // Default is 1MB — a real LinkedIn "Connections.csv" export (the file
    // the Networking page's CSV import Server Action reads) can exceed that
    // for anyone with a few thousand connections, which fails with a 413
    // ("Body exceeded 1 MB limit") before the action code ever runs.
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  // Permanent redirect for the Hireability Report -> Market Reality rename
  // (the dashboard/hireability-report route moved to dashboard/market-reality).
  // Keeps old bookmarks/emails/external links working; internal links were
  // all updated to point at the new path directly rather than relying on this.
  //
  // Same pattern for the Crucible -> NEN rename (/crucible -> /noexperience):
  // :path* covers every sub-path uniformly, including the tokenized
  // /crucible/employers/contests/entry/[token] links already sitting in
  // candidates' inboxes from real contest-invite emails sent before this
  // rename — those keep working forever without any data migration. Every
  // internal link/redirect was updated to point at /noexperience directly;
  // this redirect exists only for already-external references.
  async redirects() {
    return [
      {
        source: '/dashboard/hireability-report',
        destination: '/dashboard/market-reality',
        permanent: true,
      },
      // Meeting Prep used to live under /crm/rap-sheets; links in already-sent
      // briefing emails still point there.
      {
        source: '/support/admin/crm/rap-sheets/:path*',
        destination: '/support/admin/crm/meeting-prep/:path*',
        permanent: true,
      },
      {
        source: '/support/admin/crm/rap-sheets',
        destination: '/support/admin/crm/meeting-prep',
        permanent: true,
      },
      {
        source: '/crucible/:path*',
        destination: '/noexperience/:path*',
        permanent: true,
      },
    ];
  },
  // Routes PostHog's client SDK through our own domain so ad blockers that
  // target posthog.com/i.posthog.com don't silently drop analytics.
  async rewrites() {
    return [
      {
        source: "/ingest/static/:path*",
        destination: `${posthogAssetHost}/static/:path*`,
      },
      {
        source: "/ingest/:path*",
        destination: `${posthogHost}/:path*`,
      },
      {
        source: "/ingest/decide",
        destination: `${posthogHost}/decide`,
      },
    ];
  },
  // Unhashed files in public/ otherwise get `max-age=0, must-revalidate`, so a returning
  // visitor re-checks every image and PDF on every page. A day plus a week of
  // stale-while-revalidate keeps them warm without pinning a replaced file for long.
  async headers() {
    const cacheable = "public, max-age=86400, stale-while-revalidate=604800";
    const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const supabaseWs = supabase.replace(/^https:/, "wss:");
    const isProd = process.env.NODE_ENV === "production";
    // Report-Only first: next/script and inline JSON-LD need 'unsafe-inline',
    // and admin-curated embeds can hit frame-src. Watch the console for
    // violations for a few days, then rename the header key to enforce.
    const csp = [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"} https://www.googletagmanager.com https://www.google-analytics.com`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      `media-src 'self' blob: ${supabase}`,
      `connect-src 'self' ${supabase} ${supabaseWs} https://www.google-analytics.com https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com https://stats.g.doubleclick.net`,
      "frame-src 'self' https:",
      "worker-src 'self' blob:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'self'",
      // Violations land in the Vercel logs as "CSP violation: ..." — see
      // src/app/api/csp-report/route.ts. Check them before enforcing.
      "report-uri /api/csp-report",
    ].join("; ");
    const security = [
      { key: "Content-Security-Policy-Report-Only", value: csp },
      { key: "Strict-Transport-Security", value: "max-age=63072000" },
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()" },
      { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
    ];
    return [
      { source: "/:path*", headers: security },
      { source: "/images/:path*", headers: [{ key: "Cache-Control", value: cacheable }] },
      { source: "/marketing/:path*", headers: [{ key: "Cache-Control", value: cacheable }] },
      { source: "/guides/:path*", headers: [{ key: "Cache-Control", value: cacheable }] },
      { source: "/reports/:path*", headers: [{ key: "Cache-Control", value: cacheable }] },
    ];
  },
  poweredByHeader: false,
  skipTrailingSlashRedirect: true,
};

export default nextConfig;

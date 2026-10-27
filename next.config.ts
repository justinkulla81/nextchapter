import type { NextConfig } from "next";

// Same region as NEXT_PUBLIC_POSTHOG_HOST (e.g. https://us.i.posthog.com or
// https://eu.i.posthog.com) — set once here since next.config.ts runs in
// Node, not the browser bundle.
const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";
const posthogAssetHost = posthogHost.replace("https://", "https://").replace(/^https:\/\/(\w+)\./, "https://$1-assets.");

const nextConfig: NextConfig = {
  // /places/sitemap.xml queries every state's counties and the qualifying cities while the build prerenders it, and takes
  // longer than Next's 60 second default; every production deploy since 2026-10-26 failed on it. It refreshes every 6 hours at runtime.
  staticPageGenerationTimeout: 300,
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
      // /feeds has no page of its own (the feeds are files under it); someone typing it wants the jobs.
      { source: '/feeds', destination: '/jobs', permanent: false },
      // Retired 2026-10-23: the website shows plans, not prices.
      {
        source: '/insights/outplacement-cost-per-employee',
        destination: '/outplacement',
        permanent: true,
      },
      // 2026-10-24: the coach platform page moved into the coaches page, which now carries its content.
      {
        source: '/coach-platform',
        destination: '/coaches',
        permanent: true,
      },
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
      // The report's former name: editions and files published before the
      // rename stay reachable from emails, LinkedIn posts and search results.
      {
        source: '/reports/displacement-report-september-2026',
        destination: '/reports/white-collar-employment-report-september-2026',
        permanent: true,
      },
      {
        source: '/reports/displacement-report-2026-:rest',
        destination: '/reports/white-collar-employment-report-2026-:rest',
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
      // College and workforce org portals: public addresses for the /i app
      // (its own login cookie; see src/lib/supabase/portal.ts).
      { source: "/highered/:path*", destination: "/i/:path*" },
      { source: "/workforce/:path*", destination: "/i/:path*" },
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
    // Enforcing since 2026-10-15 after a two-day report-only soak (violations
    // are still reported to /api/csp-report and show in the Vercel logs as
    // "CSP violation: ..."). next/script and inline JSON-LD need
    // 'unsafe-inline'; admin-curated embeds are covered by frame-src https:.
    // To roll back, rename the header key below to
    // Content-Security-Policy-Report-Only.
    const csp = [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"} https://www.googletagmanager.com https://www.google-analytics.com`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      `media-src 'self' blob: ${supabase}`,
      `connect-src 'self' ${supabase} ${supabaseWs} https://www.google-analytics.com https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com https://stats.g.doubleclick.net https://*.g.doubleclick.net https://www.google.com`,
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
      { key: "Content-Security-Policy", value: csp },
      // includeSubDomains since 2026-10-21 (CASA prep): every subdomain is the
      // Vercel wildcard or Resend's click-tracking host (links.updates), and
      // all of them serve valid HTTPS. Not preloaded; that is a separate,
      // hard-to-undo submission at hstspreload.org.
      { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()" },
      { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
    ];
    return [
      // /embed/* is meant to sit in other sites' iframes: same headers, but any site may frame it.
      { source: "/:path((?!embed/).*)", headers: security },
      {
        source: "/embed/:path*",
        headers: [
          ...security.filter((h) => h.key !== "Content-Security-Policy" && h.key !== "X-Frame-Options"),
          { key: "Content-Security-Policy", value: csp.replace("frame-ancestors 'self'", "frame-ancestors *") },
        ],
      },
      // Pages that read the job-title scan are rendered per request (not at build) and kept by the CDN for six hours.
      ...["/jobs/title", "/salaries", "/tools/pay-check"].map((source) => ({ source, headers: [{ key: "Cache-Control", value: "public, s-maxage=21600, stale-while-revalidate=86400" }] })),
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

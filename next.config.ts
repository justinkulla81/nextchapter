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
  skipTrailingSlashRedirect: true,
};

export default nextConfig;

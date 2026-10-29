// Pushing the public job pages (/jobs/[id], src/lib/jobs/public-job-page.ts) out to
// search engines and job aggregators. Pure — no I/O — so the planning and the XML are
// unit-tested (src/test/job-syndication.test.ts). The I/O lives next to it:
//   indexnow-server.ts        IndexNow (Bing, Yandex, Seznam, Naver): new and closed job URLs, daily
//   google-indexing-server.ts Google Indexing API (JobPosting pages): off unless GOOGLE_INDEXING_ENABLED
//
// Which jobs: exactly the public-page allowlist (isPublicJob / the sitemap SQL), never wider.
// Every URL sent anywhere is OUR job page, never the employer's.

import { SITE_URL } from '@/lib/seo/facts'

export const jobPageUrl = (id: string) => `${SITE_URL}/jobs/${id}`

// ── IndexNow ──────────────────────────────────────────────────────────────────
/** Served at https://launchyournextchapter.com/<key>.txt (public/<key>.txt) — also used by scripts/employment-report/indexnow.ts. */
export const INDEXNOW_KEY = '24d478db8c3dd0e0f650b53caba7befd'
export const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow'
/** IndexNow's limit per request. */
export const INDEXNOW_BATCH = 10_000
/** New URLs sent per run: the first backfill (~320k) goes out over ~4 daily runs. */
export const INDEXNOW_NEW_PER_RUN = 100_000

export function indexNowBody(urls: string[]) {
  return { host: new URL(SITE_URL).host, key: INDEXNOW_KEY, keyLocation: `${SITE_URL}/${INDEXNOW_KEY}.txt`, urlList: urls }
}

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

export interface LiveJob {
  id: string
  /** postedAt ?? createdAt, ms — "newest" sorts on it. */
  at: number
  /** Whether we ask search engines to take it (stated pay, entry-level or no experience). Only these are announced as new; a live job that is not offered is never announced as gone. Missing means yes. */
  offered?: boolean
}

/**
 * What to tell a search engine this run, given the jobs public now and the ones it was
 * already told about (and not since told were removed).
 *   removed: told about, no longer public — all of them (they 404 now)
 *   added:   public, not yet told — newest first, at most `newCap`
 */
export function planChanges(live: LiveJob[], announced: ReadonlySet<string>, newCap: number): { removed: string[]; added: string[]; waiting: number } {
  const liveIds = new Set(live.map((j) => j.id))
  const removed = [...announced].filter((id) => !liveIds.has(id)).sort()
  const fresh = live.filter((j) => !announced.has(j.id) && j.offered !== false).sort((a, b) => b.at - a.at || (a.id < b.id ? -1 : 1))
  const added = fresh.slice(0, Math.max(0, newCap)).map((j) => j.id)
  return { removed, added, waiting: fresh.length - added.length }
}

// ── Google Indexing API ───────────────────────────────────────────────────────
export const GOOGLE_INDEXING_DEFAULT_QUOTA = 200

/**
 * Keyless sign-in (Workload Identity Federation): the site proves who it is with the short-lived Vercel OIDC token, Google swaps it
 * for a token that acts as the service account. Used when the organization blocks service account keys. Needs the provider's
 * full resource name and the service account's email.
 */
export interface GoogleKeylessConfig {
  provider: string
  serviceAccountEmail: string
}

export function googleKeylessConfig(env: Record<string, string | undefined> = process.env): GoogleKeylessConfig | null {
  const provider = (env.GOOGLE_INDEXING_WIF_PROVIDER ?? '').trim().replace(/^https?:/, '')
  const serviceAccountEmail = (env.GOOGLE_INDEXING_SA_EMAIL ?? '').trim()
  if (!/^\/\/iam\.googleapis\.com\/projects\/\d+\/locations\/global\/workloadIdentityPools\/[^/]+\/providers\/[^/]+$/.test(provider)) return null
  if (!/^[^@\s]+@[^@\s]+\.iam\.gserviceaccount\.com$/.test(serviceAccountEmail)) return null
  return { provider, serviceAccountEmail }
}

export function googleIndexingEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return /^(1|true|on|yes)$/i.test(env.GOOGLE_INDEXING_ENABLED ?? '') && (!!env.GOOGLE_INDEXING_SA_JSON || googleKeylessConfig(env) !== null)
}

export const impersonationUrl = (serviceAccountEmail: string) =>
  `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${encodeURIComponent(serviceAccountEmail)}:generateAccessToken`

export function googleIndexingQuota(env: Record<string, string | undefined> = process.env): number {
  const n = Number(env.GOOGLE_INDEXING_DAILY_QUOTA)
  return Number.isInteger(n) && n > 0 ? n : GOOGLE_INDEXING_DEFAULT_QUOTA
}

/** Closed jobs first (URL_DELETED), then the newest public jobs Google hasn't been sent (URL_UPDATED), within `quota`. */
export function planGoogle(live: LiveJob[], sent: ReadonlySet<string>, quota: number): { deleted: string[]; updated: string[] } {
  const { removed } = planChanges(live, sent, 0)
  const deleted = removed.slice(0, quota)
  const updated = planChanges(live, sent, quota - deleted.length).added
  return { deleted, updated }
}

// ── Bing Webmaster URL submission ────────────────────────────────────────────
// Bing's own API (separate from IndexNow): submit URLs for crawling, within the site's daily quota. Needs an API key from
// the Bing Webmaster Tools account (BING_WEBMASTER_API_KEY); without one the daily run does nothing.
export const BING_API = 'https://ssl.bing.com/webmaster/api.svc/json'
export const BING_DEFAULT_DAILY_LIMIT = 50

export function bingDailyLimit(quota: number | null, env: Record<string, string | undefined> = process.env): number {
  const own = Number(env.BING_DAILY_LIMIT)
  const limit = Number.isInteger(own) && own > 0 ? own : BING_DEFAULT_DAILY_LIMIT
  return quota != null && Number.isFinite(quota) ? Math.max(0, Math.min(limit, Math.floor(quota))) : limit
}

export const bingSubmitBody = (urls: string[]) => ({ siteUrl: `${SITE_URL}/`, urlList: urls })

// ── XML helpers (Indeed-style <source><job>…</job></source>) ──────────────────
// Shared by NextChapter's own careers feeds (src/lib/careers/job-feed.ts).

// Characters XML 1.0 forbids (control characters, lone surrogates, U+FFFE/F).
// eslint-disable-next-line no-control-regex
const INVALID_XML = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uD800-\uDFFF￾￿]/g

export function cdata(value: string | null | undefined): string {
  const clean = (value ?? '').replace(INVALID_XML, '')
  return `<![CDATA[${clean.replace(/]]>/g, ']]]]><![CDATA[>')}]]>`
}

export const FEED_TAIL = '</source>\n'

// Jooble's root element (https://jooble.org/files/xml_feed_specifications.pdf).
export const JOOBLE_HEAD = '<?xml version="1.0" encoding="UTF-8"?>\n<jobs>\n'
export const JOOBLE_TAIL = '</jobs>\n'

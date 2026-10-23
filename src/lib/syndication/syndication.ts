// Pushing the public job pages (/jobs/[id], src/lib/jobs/public-job-page.ts) out to
// search engines and job aggregators. Pure — no I/O — so the planning and the XML are
// unit-tested (src/test/job-syndication.test.ts). The I/O lives next to it:
//   indexnow-server.ts        IndexNow (Bing, Yandex, Seznam, Naver): new and closed job URLs, daily
//   google-indexing-server.ts Google Indexing API (JobPosting pages): off unless GOOGLE_INDEXING_ENABLED
//   job-feed-server.ts        Indeed-style XML feed for aggregators, gzipped in Supabase Storage
//
// Which jobs: exactly the public-page allowlist (isPublicJob / the sitemap SQL), never wider.
// Every URL sent anywhere is OUR job page, never the employer's.

import { SITE_URL } from '@/lib/seo/facts'
import { datePostedOf, descriptionHtml, isRemoteJob, payLabel, placeLabel, validThroughOf, type PublicJobRow } from '@/lib/jobs/public-job-page'

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
  const fresh = live.filter((j) => !announced.has(j.id)).sort((a, b) => b.at - a.at || (a.id < b.id ? -1 : 1))
  const added = fresh.slice(0, Math.max(0, newCap)).map((j) => j.id)
  return { removed, added, waiting: fresh.length - added.length }
}

// ── Google Indexing API ───────────────────────────────────────────────────────
export const GOOGLE_INDEXING_DEFAULT_QUOTA = 200

export function googleIndexingEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return /^(1|true|on|yes)$/i.test(env.GOOGLE_INDEXING_ENABLED ?? '') && !!env.GOOGLE_INDEXING_SA_JSON
}

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

// ── XML feed (Indeed-style <source><job>…</job></source>) ─────────────────────
// The format Jooble, Talent.com, Adzuna, Careerjet, Jora, WhatJobs and others read.

// Characters XML 1.0 forbids (control characters, lone surrogates, U+FFFE/F).
// eslint-disable-next-line no-control-regex
const INVALID_XML = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uD800-\uDFFF￾￿]/g

export function cdata(value: string | null | undefined): string {
  const clean = (value ?? '').replace(INVALID_XML, '')
  return `<![CDATA[${clean.replace(/]]>/g, ']]]]><![CDATA[>')}]]>`
}

// Indeed's jobtype words; only exact matches (interim, fractional, … are left out).
const FEED_JOB_TYPE: Record<string, string> = { full_time: 'fulltime', part_time: 'parttime', contract: 'contract', temporary: 'temporary' }

export function feedHead(builtAt: Date): string {
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n<source>\n' +
    `<publisher>NextChapter</publisher>\n<publisherurl>${SITE_URL}</publisherurl>\n` +
    `<lastBuildDate>${builtAt.toUTCString()}</lastBuildDate>\n`
  )
}

export const FEED_TAIL = '</source>\n'

/** `url` overrides the job's link in the feed (the employer feed sends applicants to the employer's own apply link). */
export function feedJobXml(job: PublicJobRow, url: string = jobPageUrl(job.id)): string {
  const remote = isRemoteJob(job)
  const parts = [
    `<title>${cdata(job.title)}</title>`,
    `<date>${cdata(datePostedOf(job).toUTCString())}</date>`,
    // Talent.com's required name for the posted date (https://www.talent.com/integrations), ISO 8601.
    `<dateposted>${cdata(datePostedOf(job).toISOString())}</dateposted>`,
    `<referencenumber>${cdata(job.id)}</referencenumber>`,
    `<url>${cdata(url)}</url>`,
    `<company>${cdata(job.companyName)}</company>`,
    `<city>${cdata(job.locationCity)}</city>`,
    `<state>${cdata(job.locationState)}</state>`,
    `<country>${cdata('US')}</country>`,
    `<description>${cdata(descriptionHtml(job.description))}</description>`,
  ]
  const expires = validThroughOf(job)
  if (expires) parts.push(`<expirationdate>${cdata(expires.toISOString())}</expirationdate>`)
  parts.push(`<isremote>${cdata(remote ? 'yes' : 'no')}</isremote>`)
  const pay = payLabel(job.salaryMin, job.salaryMax, job.payPeriod)
  if (pay) parts.push(`<salary>${cdata(pay)}</salary>`)
  const type = job.employmentType ? FEED_JOB_TYPE[job.employmentType] : undefined
  if (type) parts.push(`<jobtype>${cdata(type)}</jobtype>`)
  if (remote) parts.push(`<remotetype>${cdata('Fully remote')}</remotetype>`)
  else if (job.workArrangement === 'hybrid') parts.push(`<remotetype>${cdata('Hybrid remote')}</remotetype>`)
  return `<job>\n${parts.join('\n')}\n</job>\n`
}

// ── Jooble feed ───────────────────────────────────────────────────────────────
// Jooble's own tag set (https://jooble.org/files/xml_feed_specifications.pdf): <job id="…">
// with <link>, <name>, <region>, <description>, <pubdate> in DD.MM.YYYY and optional
// <salary>, <company>, <expire>, <jobtype>. Jooble only indexes jobs published within 45
// days of first indexing, so the builder skips older ones.

export const JOOBLE_MAX_AGE_DAYS = 45
export const JOOBLE_HEAD = '<?xml version="1.0" encoding="UTF-8"?>\n<jobs>\n'
export const JOOBLE_TAIL = '</jobs>\n'

const ddmmyyyy = (d: Date) => `${String(d.getUTCDate()).padStart(2, '0')}.${String(d.getUTCMonth() + 1).padStart(2, '0')}.${d.getUTCFullYear()}`
const JOOBLE_JOB_TYPE: Record<string, string> = { full_time: 'full-time', part_time: 'part-time', contract: 'contract', temporary: 'temporary' }

/** True when Jooble would index the job (published within JOOBLE_MAX_AGE_DAYS of `nowMs`). */
export function isFreshForJooble(job: Pick<PublicJobRow, 'postedAt' | 'createdAt'>, nowMs: number): boolean {
  return nowMs - datePostedOf(job).getTime() <= JOOBLE_MAX_AGE_DAYS * 86_400_000
}

export function joobleJobXml(job: PublicJobRow, url: string): string {
  const parts = [
    `<link>${cdata(url)}</link>`,
    `<name>${cdata(job.title)}</name>`,
    `<region>${cdata(placeLabel(job) ?? job.locationState ?? 'United States')}</region>`,
    `<description>${cdata(descriptionHtml(job.description))}</description>`,
    `<pubdate>${cdata(ddmmyyyy(datePostedOf(job)))}</pubdate>`,
    `<company>${cdata(job.companyName)}</company>`,
  ]
  const expires = validThroughOf(job)
  if (expires) parts.push(`<expire>${cdata(ddmmyyyy(expires))}</expire>`)
  const pay = payLabel(job.salaryMin, job.salaryMax, job.payPeriod)
  if (pay) parts.push(`<salary>${cdata(pay)}</salary>`)
  const type = job.employmentType ? JOOBLE_JOB_TYPE[job.employmentType] : undefined
  if (type) parts.push(`<jobtype>${cdata(type)}</jobtype>`)
  return `<job id="${job.id}">\n${parts.join('\n')}\n</job>\n`
}

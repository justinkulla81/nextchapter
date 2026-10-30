import 'server-only'
import { PUBLIC_JOB_SITEMAP_SHARDS } from '@/lib/jobs/public-job-page'
import { feedJobIdsInShard, publicJobRowsByIds } from '@/lib/jobs/public-job-page-server'
import { FEED_BUCKET, getObject, gzip, publicObjectUrl, putObject } from '@/lib/syndication/storage'
import { chunk, FEED_TAIL, JOOBLE_HEAD, JOOBLE_TAIL } from '@/lib/syndication/syndication'
import { feedHead, feedJobXml, isFreshForJooble, joobleJobXml } from '@/lib/syndication/job-feed-xml'
import { feedOptOutSet, isFeedOptedOut } from '@/lib/syndication/feed-optout'

// The aggregator feed: every public job as Indeed-style XML, gzipped, in the public
// 'job-feeds' bucket. With full descriptions (since 2026-10-24) ~320k jobs is ~0.5 GB
// gzipped, far over Storage's 50 MB object limit and a function response, so each of the
// 16 sitemap shards is written as one or more parts of at most JOBS_PER_PART jobs
// (~2 KB gzipped a job, so ~12 MB a part) holding only <job> elements, plus a manifest. The feed URL
// (https://launchyournextchapter.com/feeds/jobs-direct.xml.gz, src/app/feeds/jobs-direct.xml.gz/route.ts)
// streams a gzipped header, the parts in order and a gzipped footer — gzip members
// concatenated are one valid .gz file — so aggregators get a single file.
//
// The daily cron rebuilds the oldest parts first until its time budget runs out, so a
// slow day finishes on the next run instead of failing; each part is ~20k jobs.

// Two feeds share this builder. 'direct': only jobs listed straight on the employer's own career
// system (directListing), each <url> the employer's apply link, so we aren't presented as
// the source (/feeds/jobs-direct.xml.gz) — the one to submit to aggregators.
// 'jooble': the direct jobs again, in Jooble's own tag set (/feeds/jobs-jooble.xml.gz).
export type FeedVariant = 'direct' | 'jooble'
const VARIANTS: Record<FeedVariant, { manifest: string; prefix: string; filename: string }> = {
  direct: { manifest: 'direct/manifest.json', prefix: 'direct/part-', filename: 'jobs-direct.xml.gz' },
  jooble: { manifest: 'jooble/manifest.json', prefix: 'jooble/part-', filename: 'jobs-jooble.xml.gz' },
}
export const FEED_MANIFEST_PATH = VARIANTS.direct.manifest
const ROW_CHUNK = 5_000
// Jobs per stored part. ~2 KB gzipped a job with a full description (6 KB average text),
// so a part is ~12 MB, well under Storage's 50 MB object limit even for long postings.
export const JOBS_PER_PART = 6_000

const httpUrl = (u: string | null | undefined) => (u && /^https?:\/\//i.test(u) ? u : null)

export interface FeedPart {
  shard: number
  /** Which part of the shard (0 when a shard fits in one). Older manifests leave it out. */
  sub?: number
  path: string
  jobs: number
  bytes: number
  builtAt: string
}

export interface FeedManifest {
  v: 1
  parts: FeedPart[]
  updatedAt: string
}

export async function readFeedManifest(variant: FeedVariant = 'direct'): Promise<FeedManifest | null> {
  const buf = await getObject(FEED_BUCKET, VARIANTS[variant].manifest)
  if (!buf) return null
  const m = JSON.parse(buf.toString('utf8')) as FeedManifest
  return m.v === 1 ? m : null
}

export const feedPartUrl = (p: FeedPart) => publicObjectUrl(FEED_BUCKET, p.path)

/** One shard's XML (its <job> elements) in pieces of at most JOBS_PER_PART jobs each. */
export async function buildShardXml(shard: number, variant: FeedVariant = 'direct'): Promise<{ parts: { xml: string; jobs: number }[]; jobs: number }> {
  const now = Date.now()
  const optOut = feedOptOutSet()
  const ids = (await feedJobIdsInShard(shard)).map((r) => r.id)
  const parts: { xml: string; jobs: number }[] = []
  let pieces: string[] = []
  let jobs = 0
  const push = (xml: string) => {
    pieces.push(xml)
    jobs++
    if (pieces.length >= JOBS_PER_PART) {
      parts.push({ xml: pieces.join(''), jobs: pieces.length })
      pieces = []
    }
  }
  for (const part of chunk(ids, ROW_CHUNK)) {
    const rows = await publicJobRowsByIds(part)
    rows.sort((a, b) => (a.id < b.id ? -1 : 1))
    for (const r of rows) {
      // Direct feed: the employer's apply link; a job without a usable one is left out.
      const url = r.directListing ? httpUrl(r.url) : null
      if (!url || isFeedOptedOut(r.companyName, optOut)) continue
      if (variant === 'jooble') {
        if (!isFreshForJooble(r, now)) continue
        push(joobleJobXml(r, url))
      } else push(feedJobXml(r, url))
    }
  }
  if (pieces.length > 0 || parts.length === 0) parts.push({ xml: pieces.join(''), jobs: pieces.length })
  return { parts, jobs }
}

export interface JobFeedResult {
  dryRun: boolean
  built: { shard: number; jobs: number; rawBytes: number; gzBytes: number; ms: number }[]
  partsFresh: number
  totalJobs: number
  totalGzBytes: number
  timedOut: boolean
  sampleXml?: string
}

/**
 * Rebuilds feed parts, oldest first, while `budgetMs` lasts (always at least one).
 * `shards` limits it to those parts (a dry run on one shard, say). Dry run: nothing written.
 */
export async function runJobFeed(opts: { dryRun?: boolean; budgetMs?: number; shards?: number[]; variant?: FeedVariant } = {}): Promise<JobFeedResult> {
  const variant = opts.variant ?? 'direct'
  const v = VARIANTS[variant]
  const started = Date.now()
  const dryRun = !!opts.dryRun
  const budget = opts.budgetMs ?? 600_000
  const manifest: FeedManifest = (await readFeedManifest(variant)) ?? { v: 1, parts: [], updatedAt: new Date(0).toISOString() }
  const builtAt = (s: number) => Date.parse(manifest.parts.find((p) => p.shard === s)?.builtAt ?? '') || 0
  const order = (opts.shards ?? Array.from({ length: PUBLIC_JOB_SITEMAP_SHARDS }, (_, i) => i)).sort((a, b) => builtAt(a) - builtAt(b) || a - b)
  const result: JobFeedResult = { dryRun, built: [], partsFresh: 0, totalJobs: 0, totalGzBytes: 0, timedOut: false }
  let slowest = 0

  for (const shard of order) {
    // Stop when another part (as slow as the slowest so far, plus slack) wouldn't fit.
    if (result.built.length > 0 && Date.now() - started + slowest * 1.5 > budget) {
      result.timedOut = true
      break
    }
    const t = Date.now()
    const { parts, jobs } = await buildShardXml(shard, variant)
    const written: FeedPart[] = []
    let rawBytes = 0
    let gzBytes = 0
    for (const [sub, part] of parts.entries()) {
      const raw = Buffer.from(part.xml, 'utf8')
      const gz = await gzip(raw, { level: 6 })
      rawBytes += raw.length
      gzBytes += gz.length
      if (!result.sampleXml && part.xml) result.sampleXml = part.xml.slice(0, part.xml.indexOf('</job>') + 7)
      const path = `${v.prefix}${String(shard).padStart(2, '0')}-${sub}.xml.gz`
      // Part names are stable, so they're read past the CDN cache by the feed route (?v=).
      if (!dryRun) await putObject(FEED_BUCKET, path, gz, 'application/gzip')
      written.push({ shard, sub, path, jobs: part.jobs, bytes: gz.length, builtAt: new Date().toISOString() })
    }
    if (!dryRun) {
      manifest.parts = [...manifest.parts.filter((p) => p.shard !== shard), ...written].sort((a, b) => a.shard - b.shard || (a.sub ?? 0) - (b.sub ?? 0))
      manifest.updatedAt = new Date().toISOString()
      await putObject(FEED_BUCKET, v.manifest, Buffer.from(JSON.stringify(manifest)), 'application/json')
    }
    const ms = Date.now() - t
    slowest = Math.max(slowest, ms)
    result.built.push({ shard, jobs, rawBytes, gzBytes, ms })
  }
  const parts = dryRun ? result.built.map((b) => ({ shard: b.shard, jobs: b.jobs, bytes: b.gzBytes, builtAt: new Date().toISOString() })) : manifest.parts
  // Counted per shard (a shard may be several parts).
  result.partsFresh = new Set(parts.filter((p) => Date.now() - Date.parse(p.builtAt) < 36 * 3600_000).map((p) => p.shard)).size
  result.totalJobs = parts.reduce((n, p) => n + p.jobs, 0)
  result.totalGzBytes = parts.reduce((n, p) => n + p.bytes, 0)
  console.log('Job feed run', { variant, ...result, sampleXml: undefined })
  return result
}

/** The feed's gzipped header and footer members (small; built per request). */
export async function feedHeadTail(m: FeedManifest, variant: FeedVariant = 'direct'): Promise<{ head: Buffer; tail: Buffer }> {
  const jooble = variant === 'jooble'
  const [head, tail] = await Promise.all([
    gzip(Buffer.from(jooble ? JOOBLE_HEAD : feedHead(new Date(m.updatedAt)))),
    gzip(Buffer.from(jooble ? JOOBLE_TAIL : FEED_TAIL)),
  ])
  return { head, tail }
}

// A feed download is hundreds of MB, so each address gets FEED_HITS_PER_HOUR downloads an hour (per server instance;
// the CDN's cache header and the Vercel firewall do the rest).
const FEED_HITS_PER_HOUR = 6
const feedHits = new Map<string, number[]>()
export function feedRateLimited(key: string, now = Date.now()): boolean {
  const recent = (feedHits.get(key) ?? []).filter((t) => now - t < 3600_000)
  if (recent.length >= FEED_HITS_PER_HOUR) {
    feedHits.set(key, recent)
    return true
  }
  recent.push(now)
  feedHits.set(key, recent)
  if (feedHits.size > 5_000) for (const k of feedHits.keys()) if (!(feedHits.get(k) ?? []).some((t) => now - t < 3600_000)) feedHits.delete(k)
  return false
}

/** The feed as one streamed .gz: gzipped header, the stored parts in order, gzipped footer (see the module note). */
export async function feedResponse(variant: FeedVariant, req?: Request): Promise<Response> {
  if (req && feedRateLimited(req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown')) {
    return new Response('Too many requests. The feed changes once a day.', { status: 429, headers: { 'Retry-After': '3600' } })
  }
  const m = await readFeedManifest(variant).catch(() => null)
  if (!m || m.parts.length === 0) return new Response('The job feed is being built. Try again later.', { status: 503, headers: { 'Retry-After': '3600' } })
  const { head, tail } = await feedHeadTail(m, variant)
  const length = head.length + tail.length + m.parts.reduce((n, p) => n + p.bytes, 0)

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        controller.enqueue(new Uint8Array(head))
        for (const part of m.parts) {
          // ?v= reads past the storage CDN's copy of an older build of the part.
          const res = await fetch(`${feedPartUrl(part)}?v=${encodeURIComponent(part.builtAt)}`, { cache: 'no-store' })
          if (!res.ok || !res.body) throw new Error(`feed part ${part.path}: ${res.status}`)
          const reader = res.body.getReader()
          for (;;) {
            const { done, value } = await reader.read()
            if (done) break
            controller.enqueue(value)
          }
        }
        controller.enqueue(new Uint8Array(tail))
        controller.close()
      } catch (error) {
        console.error('Job feed stream failed', error)
        controller.error(error)
      }
    },
  })

  return new Response(body, {
    headers: {
      'Content-Type': 'application/gzip',
      'Content-Length': String(length),
      'Content-Disposition': `attachment; filename="${VARIANTS[variant].filename}"`,
      'Last-Modified': new Date(m.updatedAt).toUTCString(),
      'Cache-Control': 'public, max-age=3600',
    },
  })
}

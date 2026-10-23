import 'server-only'
import { PUBLIC_JOB_SITEMAP_SHARDS } from '@/lib/jobs/public-job-page'
import { publicJobIdsInShard, publicJobRowsByIds } from '@/lib/jobs/public-job-page-server'
import { FEED_BUCKET, getObject, gzip, publicObjectUrl, putObject } from '@/lib/syndication/storage'
import { chunk, FEED_TAIL, feedHead, feedJobXml } from '@/lib/syndication/syndication'

// The aggregator feed: every public job as Indeed-style XML, gzipped, in the public
// 'job-feeds' bucket. ~320k jobs is ~80 MB gzipped, over Storage's 50 MB object limit
// and far over a function response, so it is kept as 16 parts (one per sitemap shard,
// ~5 MB each) holding only <job> elements, plus a manifest. The feed URL
// (https://launchyournextchapter.com/feeds/jobs.xml.gz, src/app/feeds/jobs.xml.gz/route.ts)
// streams a gzipped header, the parts in order and a gzipped footer — gzip members
// concatenated are one valid .gz file — so aggregators get a single file.
//
// The daily cron rebuilds the oldest parts first until its time budget runs out, so a
// slow day finishes on the next run instead of failing; each part is ~20k jobs.

// Two feeds share this builder. 'all': every public job, each <url> our job page
// (/feeds/jobs.xml.gz). 'direct': only jobs listed straight on the employer's own career
// system (directListing), each <url> the employer's apply link, so we aren't presented as
// the source (/feeds/jobs-direct.xml.gz) — the one to submit to aggregators.
export type FeedVariant = 'all' | 'direct'
const VARIANTS: Record<FeedVariant, { manifest: string; prefix: string; filename: string }> = {
  all: { manifest: 'jobs/manifest.json', prefix: 'jobs/part-', filename: 'jobs.xml.gz' },
  direct: { manifest: 'direct/manifest.json', prefix: 'direct/part-', filename: 'jobs-direct.xml.gz' },
}
export const FEED_MANIFEST_PATH = VARIANTS.all.manifest
const ROW_CHUNK = 5_000

const httpUrl = (u: string | null | undefined) => (u && /^https?:\/\//i.test(u) ? u : null)

export interface FeedPart {
  shard: number
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

export async function readFeedManifest(variant: FeedVariant = 'all'): Promise<FeedManifest | null> {
  const buf = await getObject(FEED_BUCKET, VARIANTS[variant].manifest)
  if (!buf) return null
  const m = JSON.parse(buf.toString('utf8')) as FeedManifest
  return m.v === 1 ? m : null
}

export const feedPartUrl = (p: FeedPart) => publicObjectUrl(FEED_BUCKET, p.path)

/** One part's XML (the <job> elements of one shard), and how many jobs it holds. */
export async function buildShardXml(shard: number, variant: FeedVariant = 'all'): Promise<{ xml: string; jobs: number }> {
  const direct = variant === 'direct'
  const ids = (await publicJobIdsInShard(shard, direct)).map((r) => r.id)
  const pieces: string[] = []
  let jobs = 0
  for (const part of chunk(ids, ROW_CHUNK)) {
    const rows = await publicJobRowsByIds(part)
    rows.sort((a, b) => (a.id < b.id ? -1 : 1))
    for (const r of rows) {
      if (!direct) {
        pieces.push(feedJobXml(r))
        jobs++
        continue
      }
      // Direct feed: the employer's apply link; a job without a usable one is left out.
      const url = r.directListing ? httpUrl(r.url) : null
      if (!url) continue
      pieces.push(feedJobXml(r, url))
      jobs++
    }
  }
  return { xml: pieces.join(''), jobs }
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
  const variant = opts.variant ?? 'all'
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
    const { xml, jobs } = await buildShardXml(shard, variant)
    const raw = Buffer.from(xml, 'utf8')
    const gz = await gzip(raw, { level: 9 })
    if (!result.sampleXml && xml) result.sampleXml = xml.slice(0, xml.indexOf('</job>') + 7)
    if (!dryRun) {
      const path = `${v.prefix}${String(shard).padStart(2, '0')}.xml.gz`
      // Part names are stable, so they're read past the CDN cache by the feed route (?v=).
      await putObject(FEED_BUCKET, path, gz, 'application/gzip')
      manifest.parts = [...manifest.parts.filter((p) => p.shard !== shard), { shard, path, jobs, bytes: gz.length, builtAt: new Date().toISOString() }].sort(
        (a, b) => a.shard - b.shard,
      )
      manifest.updatedAt = new Date().toISOString()
      await putObject(FEED_BUCKET, v.manifest, Buffer.from(JSON.stringify(manifest)), 'application/json')
    }
    const ms = Date.now() - t
    slowest = Math.max(slowest, ms)
    result.built.push({ shard, jobs, rawBytes: raw.length, gzBytes: gz.length, ms })
  }
  const parts = dryRun ? result.built.map((b) => ({ jobs: b.jobs, bytes: b.gzBytes, builtAt: new Date().toISOString() })) : manifest.parts
  result.partsFresh = parts.filter((p) => Date.now() - Date.parse(p.builtAt) < 36 * 3600_000).length
  result.totalJobs = parts.reduce((n, p) => n + p.jobs, 0)
  result.totalGzBytes = parts.reduce((n, p) => n + p.bytes, 0)
  console.log('Job feed run', { variant, ...result, sampleXml: undefined })
  return result
}

/** The feed's gzipped header and footer members (small; built per request). */
export async function feedHeadTail(m: FeedManifest): Promise<{ head: Buffer; tail: Buffer }> {
  const [head, tail] = await Promise.all([gzip(Buffer.from(feedHead(new Date(m.updatedAt)))), gzip(Buffer.from(FEED_TAIL))])
  return { head, tail }
}

/** The feed as one streamed .gz: gzipped header, the stored parts in order, gzipped footer (see the module note). */
export async function feedResponse(variant: FeedVariant): Promise<Response> {
  const m = await readFeedManifest(variant).catch(() => null)
  if (!m || m.parts.length === 0) return new Response('The job feed is being built. Try again later.', { status: 503, headers: { 'Retry-After': '3600' } })
  const { head, tail } = await feedHeadTail(m)
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

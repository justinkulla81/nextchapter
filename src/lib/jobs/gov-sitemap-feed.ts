import 'server-only'
import { prisma } from '@/lib/prisma'
import { screenImportedJob } from '@/lib/jobs/import-screen'
import { linkPostingsToCompanies } from '@/lib/companies/posting-company'
import { boardRow, collectFromPages, dedupeKey, fetchText, THIRTY_DAYS_MS, type CollectStats, type FeedSource, type SitemapJob } from '@/lib/jobs/gov-feed-core'

// A government job site that publishes a sitemap of its open jobs, with schema.org JobPosting data on each job page.
// Each run: re-confirms board rows still in the sitemap (so they stay on the board), archives rows that left it, and
// adds new jobs whose titles fit (up to maxNewPerRun, within a time budget; the next run continues).
//
// Database reads per run: one range read of the source's rows by url prefix (id, url and archivedAt only, served by the
// unique url index) and the company links for new jobs. Writes: re-confirmations in batches of 1,000, then the inserts.

export interface SitemapFeedConfig extends FeedSource {
  /** Every open job of the site, from its sitemap(s). */
  loadJobs: () => Promise<SitemapJob[]>
  /** Rows of this source start with this url prefix. */
  urlPrefix: string
  /** The title screen: only titles that pass are fetched. */
  titleOk: (title: string) => boolean
  /** A sitemap with fewer jobs than this is treated as broken and changes nothing. */
  minJobs: number
  /**
   * Job ids rise over time and the sitemap has no titles (EdJoin). Only ids above the highest id already on the board are
   * fetched, newest first, so jobs the board screen rejected are not fetched again every week.
   */
  numericIds?: boolean
  /** Skip a job whose employer and title match a live board row whose url starts with one of these (an indexed range read each). */
  dedupeAgainstUrlPrefixes?: string[]
  maxNewPerRun: number
  timeBudgetMs: number
  workers?: number
}

export interface SitemapFeedResult extends Partial<CollectStats> {
  sitemapJobs: number
  relevant: number
  confirmed: number
  archived: number
  created: number
  note?: string
}

export async function runSitemapFeed(cfg: SitemapFeedConfig): Promise<SitemapFeedResult> {
  const started = Date.now()
  const jobs = await cfg.loadJobs()
  if (jobs.length < cfg.minJobs) return { sitemapJobs: jobs.length, relevant: 0, confirmed: 0, archived: 0, created: 0, note: 'sitemap missing or short: nothing changed' }
  const inSitemap = new Set(jobs.map((j) => j.url))

  const existing = await prisma.exclusiveJobPosting.findMany({
    where: { url: { gte: cfg.urlPrefix, lt: cfg.urlPrefix + '￿', startsWith: cfg.urlPrefix }, addedBy: cfg.addedBy },
    select: { id: true, url: true, archivedAt: true },
  })
  const known = new Set(existing.map((e) => e.url))
  const live = existing.filter((e) => !e.archivedAt)
  const stay = live.filter((e) => inSitemap.has(e.url)).map((e) => e.id)
  const gone = live.filter((e) => !inSitemap.has(e.url)).map((e) => e.id)

  const now = new Date()
  const expiresAt = new Date(now.getTime() + THIRTY_DAYS_MS)
  for (let i = 0; i < stay.length; i += 1000) {
    await prisma.exclusiveJobPosting.updateMany({ where: { id: { in: stay.slice(i, i + 1000) } }, data: { expiresAt, lastConfirmedAt: now, lastVerifiedAt: now } })
  }
  for (let i = 0; i < gone.length; i += 1000) {
    await prisma.exclusiveJobPosting.updateMany({ where: { id: { in: gone.slice(i, i + 1000) } }, data: { archivedAt: now } })
  }

  const relevant = jobs.filter((j) => cfg.titleOk(j.title))
  let pool = relevant.filter((j) => !known.has(j.url))
  if (cfg.numericIds) {
    const maxKnown = Math.max(0, ...jobs.filter((j) => known.has(j.url)).map((j) => Number(j.id) || 0))
    pool = pool.filter((j) => Number(j.id) > maxKnown).sort((a, b) => Number(b.id) - Number(a.id))
  }
  // The same US and seniority screen on the slug title alone, so jobs the board would drop are not fetched.
  const candidates = pool.filter((j) => !j.title || screenImportedJob(j.title, 'United States').keep).slice(0, cfg.maxNewPerRun)
  const collected = await collectFromPages(candidates, { workers: cfg.workers ?? 6, fetchTimeoutMs: 15_000, deadline: started + cfg.timeBudgetMs, now })
  const stats = collected.stats
  let kept = collected.kept
  if (cfg.dedupeAgainstUrlPrefixes?.length && kept.length > 0) {
    const others = await prisma.exclusiveJobPosting.findMany({
      where: { archivedAt: null, OR: cfg.dedupeAgainstUrlPrefixes.map((p) => ({ url: { gte: p, lt: p + '\uffff' } })) },
      select: { title: true, companyName: true },
    })
    const seen = new Set(others.map((o) => dedupeKey(o.companyName, o.title)))
    kept = kept.filter((k) => !seen.has(dedupeKey(k.posting.employer, k.posting.title)))
  }

  let created = 0
  if (kept.length > 0) {
    const companyIds = await linkPostingsToCompanies(kept.map((k) => k.posting.employer))
    const result = await prisma.exclusiveJobPosting.createMany({
      skipDuplicates: true,
      data: kept.map((k) => ({ ...boardRow(k, cfg, now, expiresAt), companyId: companyIds.get(k.posting.employer) ?? null })),
    })
    created = result.count
  }
  return { sitemapJobs: jobs.length, relevant: relevant.length, confirmed: stay.length, archived: gone.length, created, ...stats }
}

export { fetchText }

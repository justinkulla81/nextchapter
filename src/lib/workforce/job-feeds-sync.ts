import 'server-only'
// Connected job boards, the part that reads the network and the database: fetch an employer's public board, keep the jobs near the region,
// and add, extend or take down the organization's group listings. Read-only against the employer's board (fixed API hosts, a validated
// board name); nothing is sent to anyone.

import { prisma } from '@/lib/prisma'
import { fixAllCapsCompanyName } from '@/lib/text/org-name-match'
import { linkPostingToCompany } from '@/lib/companies/posting-company'
import { GROUP_JOB_DAYS, groupPostingData } from '@/lib/workforce/group-jobs'
import { feedTag, keepNear, planRefresh, type BoardJob, type FeedProvider } from '@/lib/workforce/job-feeds'

const TIMEOUT_MS = 8000
const MAX_BYTES = 6_000_000

async function getJson(url: string): Promise<unknown | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { accept: 'application/json' } })
    if (!res.ok) return null
    if (Number(res.headers.get('content-length') ?? 0) > MAX_BYTES) return null
    return await res.json()
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

const num = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) && n > 0 ? Math.round(n) : null)
const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

/** Every open job on one employer board, or null when the board cannot be read (wrong name, down, private). */
export async function fetchBoard(provider: FeedProvider, token: string): Promise<BoardJob[] | null> {
  const t = encodeURIComponent(token)
  if (provider === 'GREENHOUSE') {
    const d = (await getJson(`https://boards-api.greenhouse.io/v1/boards/${t}/jobs`)) as { jobs?: { title?: unknown; absolute_url?: unknown; location?: { name?: unknown } }[] } | null
    if (!d || !Array.isArray(d.jobs)) return null
    return d.jobs.map((j) => ({ title: text(j.title), location: text(j.location?.name) || null, url: text(j.absolute_url) }))
  }
  if (provider === 'LEVER') {
    const d = (await getJson(`https://api.lever.co/v0/postings/${t}?mode=json`)) as { text?: unknown; hostedUrl?: unknown; categories?: { location?: unknown }; salaryRange?: { min?: unknown; max?: unknown } }[] | null
    if (!Array.isArray(d)) return null
    return d.map((j) => ({ title: text(j.text), location: text(j.categories?.location) || null, url: text(j.hostedUrl), salaryMin: num(j.salaryRange?.min), salaryMax: num(j.salaryRange?.max) }))
  }
  const d = (await getJson(`https://api.ashbyhq.com/posting-api/job-board/${t}`)) as { jobs?: { title?: unknown; location?: unknown; jobUrl?: unknown }[] } | null
  if (!d || !Array.isArray(d.jobs)) return null
  return d.jobs.map((j) => ({ title: text(j.title), location: text(j.location) || null, url: text(j.jobUrl) }))
}

export type SyncResult = { ok: true; matched: number; added: number; removed: number; alreadyElsewhere: number } | { ok: false; error: string }

/** Refresh one connected board: add new jobs near the region (waiting for review), extend ones still listed, take down ones that left. */
export async function syncFeed(feedId: string): Promise<SyncResult> {
  const feed = await prisma.groupJobFeed.findUnique({ where: { id: feedId } })
  if (!feed) return { ok: false, error: 'That board is not connected.' }
  const all = await fetchBoard(feed.provider as FeedProvider, feed.token)
  if (!all) {
    const error = 'We could not read that board. Check the link, or try again later.'
    await prisma.groupJobFeed.update({ where: { id: feed.id }, data: { lastError: error, lastSyncedAt: new Date() } })
    return { ok: false, error }
  }
  const near = keepNear(all, feed.locationFilter, feed.includeRemote)
  const tag = feedTag(feed.id)
  const known = await prisma.exclusiveJobPosting.findMany({ where: { institutionScopeId: feed.institutionId, addedBy: tag, archivedAt: null }, select: { id: true, url: true }, take: 500 })
  const urls = near.map((j) => j.url)
  const elsewhere = new Set(
    urls.length ? (await prisma.exclusiveJobPosting.findMany({ where: { url: { in: urls }, NOT: { addedBy: tag } }, select: { url: true } })).map((r) => r.url) : [],
  )
  const plan = planRefresh(near, known, elsewhere)

  if (plan.toAdd.length) {
    const companyName = fixAllCapsCompanyName(feed.companyName)
    const companyId = await linkPostingToCompany(companyName)
    await prisma.exclusiveJobPosting.createMany({
      data: plan.toAdd.map((j) => groupPostingData(feed.institutionId, tag, { title: j.title.slice(0, 160), companyName, companyId, location: j.location?.slice(0, 160) ?? null, url: j.url, salaryMin: j.salaryMin ?? null, salaryMax: j.salaryMax ?? null })),
      skipDuplicates: true,
    })
  }
  if (plan.toArchive.length) await prisma.exclusiveJobPosting.updateMany({ where: { id: { in: plan.toArchive } }, data: { archivedAt: new Date() } })
  // Jobs still on the board stay live: push their end date out.
  const stillListed = known.filter((k) => !plan.toArchive.includes(k.id)).map((k) => k.id)
  if (stillListed.length) await prisma.exclusiveJobPosting.updateMany({ where: { id: { in: stillListed } }, data: { expiresAt: new Date(Date.now() + GROUP_JOB_DAYS * 86_400_000) } })

  await prisma.groupJobFeed.update({ where: { id: feed.id }, data: { lastSyncedAt: new Date(), lastSeen: plan.matched, lastAdded: plan.toAdd.length, lastError: null } })
  return { ok: true, matched: plan.matched, added: plan.toAdd.length, removed: plan.toArchive.length, alreadyElsewhere: plan.alreadyElsewhere }
}

/** The daily refresh: every connected board once. Bounded: 25 boards an organization, one request each. */
export async function syncAllFeeds(): Promise<{ boards: number; added: number; removed: number; failed: number }> {
  const feeds = await prisma.groupJobFeed.findMany({ select: { id: true }, orderBy: { lastSyncedAt: 'asc' }, take: 400 })
  let added = 0
  let removed = 0
  let failed = 0
  for (const f of feeds) {
    const r = await syncFeed(f.id).catch(() => ({ ok: false as const, error: 'error' }))
    if (r.ok) {
      added += r.added
      removed += r.removed
    } else failed += 1
  }
  return { boards: feeds.length, added, removed, failed }
}

import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { displayCompanyName } from '@/lib/text/org-name-match'
import { screenJobTitle } from '@/lib/jobs/job-seniority'
import { isUsLocation } from '@/lib/jobs/us-location'
import { linkPostingsToCompanies } from '@/lib/companies/posting-company'

export const maxDuration = 300

// Bulk-import endpoint for the external `ncrawl` pipeline's import-jobs.py
// script — the only write path into ExclusiveJobPosting that accepts many
// records in one call (every other path, admin form and the ATS feed cron,
// writes one job at a time or from a hardcoded company list). Upserts on
// `url` (see the @unique on ExclusiveJobPosting.url).
//
// Every job is screened the same way NextChapter's own ATS feed screens:
// US (or remote) only, and manager-and-up plus senior individual roles
// (job-seniority.ts — the same rules ncrawl applies at crawl time). Its
// stored `level` is our own classification of the title, never the
// sender's, so every automated source is levelled identically.
//
// A full sync comes in two steps, since tens of thousands of jobs don't fit
// one request: batches of `jobs` (each confirming its rows), then one
// `finalizeSync` call that archives every 'ncrawl' row the run didn't
// confirm. The old single-call `fullSync: true` still works for small runs.
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

// A finalize that would archive more than this share of the live ncrawl
// rows almost always means a broken crawl, not a market that emptied —
// refuse unless the caller passes `force`.
const MAX_ARCHIVE_SHARE = 0.5

interface ImportJobInput {
  title: string
  companyName: string
  location?: string | null
  url: string
  description?: string | null
  level?: string | null
  sourceCategory?: string | null
  badges?: string[]
  salaryMin?: number | null
  salaryMax?: number | null
  salaryCurrency?: string | null
  postedAt?: string | null
  sourceCount?: number | null
  sourceName?: string | null
}

interface ImportRequestBody {
  jobs?: ImportJobInput[]
  dryRun?: boolean
  // Single-call full sync: archive every 'ncrawl' row whose url isn't in
  // this batch. A --limit test run or a partial batch MUST leave this
  // false/omitted, or it will archive every real listing that just isn't
  // in the small test batch.
  fullSync?: boolean
  // Batched full sync, last step: archive every 'ncrawl' row not confirmed
  // since `startedAt` (the moment the run's first batch was sent).
  finalizeSync?: { startedAt: string; force?: boolean }
}

function isValidJob(job: unknown): job is ImportJobInput {
  if (!job || typeof job !== 'object') return false
  const j = job as Record<string, unknown>
  return typeof j.title === 'string' && j.title.trim().length > 0 && typeof j.companyName === 'string' && j.companyName.trim().length > 0 && typeof j.url === 'string' && j.url.trim().length > 0
}

type Screened = { job: ImportJobInput; level: string }

function screen(jobs: unknown[]) {
  const kept: Screened[] = []
  const skipped: { url: string | null; reason: string }[] = []
  const seen = new Set<string>()
  for (const job of jobs) {
    if (!isValidJob(job)) {
      skipped.push({ url: (job as { url?: string })?.url ?? null, reason: 'missing required field (title, companyName, or url)' })
      continue
    }
    if (seen.has(job.url)) continue
    seen.add(job.url)
    if (!isUsLocation(cleanLocation(job.location))) {
      skipped.push({ url: job.url, reason: 'outside the US' })
      continue
    }
    const verdict = screenJobTitle(job.title)
    if (!verdict.keep) {
      skipped.push({ url: job.url, reason: verdict.reason })
      continue
    }
    kept.push({ job, level: verdict.level })
  }
  return { kept, skipped }
}

// Some sources fill unknown locations with placeholders ("UNAVAILABLE").
function cleanLocation(raw: string | null | undefined): string | null {
  const parts = (raw ?? '')
    .split(/\s*,\s*/)
    .filter((p) => p && !/^(unavailable|n\/?a|none|null|undefined|tbd)$/i.test(p))
  return parts.length ? parts.join(', ') : null
}

// The source's own posting date; ignored when unparseable or in the future.
function postedDate(raw: string | null | undefined): Date | null {
  if (!raw) return null
  const d = new Date(raw)
  return Number.isNaN(d.getTime()) || d.getTime() > Date.now() + 86_400_000 ? null : d
}

function rowData({ job, level }: Screened) {
  return {
    title: job.title.trim(),
    companyName: displayCompanyName(job.companyName.trim()),
    location: cleanLocation(job.location),
    description: job.description?.trim() || null,
    level,
    sourceCategory: job.sourceCategory?.trim() || null,
    badges: job.badges ?? [],
    salaryMin: job.salaryMin ?? null,
    salaryMax: job.salaryMax ?? null,
    salaryCurrency: job.salaryCurrency?.trim() || null,
    postedAt: postedDate(job.postedAt),
    sourceCount: typeof job.sourceCount === 'number' && job.sourceCount > 0 ? job.sourceCount : null,
    sourceName: job.sourceName?.trim() || null,
  }
}

type RowData = ReturnType<typeof rowData>

function changed(before: Record<string, unknown>, after: RowData): boolean {
  return (Object.keys(after) as (keyof RowData)[]).some((k) => JSON.stringify(before[k] ?? null) !== JSON.stringify(after[k] ?? null))
}

async function finalize(startedAt: Date, force: boolean, dryRun: boolean) {
  const stale = { addedBy: 'ncrawl', archivedAt: null, OR: [{ lastConfirmedAt: null }, { lastConfirmedAt: { lt: startedAt } }] }
  const [live, wouldArchive] = await Promise.all([
    prisma.exclusiveJobPosting.count({ where: { addedBy: 'ncrawl', archivedAt: null } }),
    prisma.exclusiveJobPosting.count({ where: stale }),
  ])
  if (!force && live > 0 && wouldArchive / live > MAX_ARCHIVE_SHARE) {
    return NextResponse.json(
      {
        error: `Refusing to archive ${wouldArchive} of ${live} live ncrawl jobs (over ${MAX_ARCHIVE_SHARE * 100}%). That usually means the crawl broke. Check the run, then re-send with force: true if the drop is real.`,
        wouldArchive,
        live,
      },
      { status: 409 }
    )
  }
  if (dryRun) return NextResponse.json({ dryRun: true, wouldArchive, live })
  const result = await prisma.exclusiveJobPosting.updateMany({ where: stale, data: { archivedAt: new Date() } })
  return NextResponse.json({ archived: result.count, live: live - result.count })
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.NC_ATS_API_KEY}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: ImportRequestBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (body.finalizeSync) {
    const startedAt = new Date(body.finalizeSync.startedAt)
    if (Number.isNaN(startedAt.getTime())) {
      return NextResponse.json({ error: 'finalizeSync.startedAt must be an ISO timestamp' }, { status: 400 })
    }
    return finalize(startedAt, !!body.finalizeSync.force, !!body.dryRun)
  }

  if (!Array.isArray(body.jobs)) {
    return NextResponse.json({ error: '"jobs" must be an array' }, { status: 400 })
  }

  const { kept, skipped } = screen(body.jobs)
  const urls = kept.map((k) => k.job.url)
  const existing = await prisma.exclusiveJobPosting.findMany({
    where: { url: { in: urls } },
    select: {
      id: true, url: true, title: true, companyName: true, location: true, description: true, level: true,
      sourceCategory: true, badges: true, salaryMin: true, salaryMax: true, salaryCurrency: true,
      postedAt: true, sourceCount: true, sourceName: true,
    },
  })
  const existingByUrl = new Map(existing.map((e) => [e.url, e]))
  const toCreate = kept.filter((k) => !existingByUrl.has(k.job.url))
  const toUpdate = kept.filter((k) => existingByUrl.has(k.job.url))

  if (body.dryRun) {
    return NextResponse.json({
      dryRun: true,
      wouldCreate: toCreate.length,
      wouldUpdate: toUpdate.length,
      wouldArchive: body.fullSync
        ? await prisma.exclusiveJobPosting.count({ where: { addedBy: 'ncrawl', archivedAt: null, url: { notIn: urls } } })
        : 0,
      skipped,
    })
  }

  const now = new Date()
  const expiresAt = new Date(now.getTime() + THIRTY_DAYS_MS)

  if (toCreate.length > 0) {
    const companyIds = await linkPostingsToCompanies(toCreate.map((k) => rowData(k).companyName))
    await prisma.exclusiveJobPosting.createMany({
      data: toCreate.map((k) => ({
        ...rowData(k),
        companyId: companyIds.get(rowData(k).companyName) ?? null,
        url: k.job.url,
        addedBy: 'ncrawl',
        source: 'ats_feed',
        status: 'approved',
        postingType: 'direct',
        contactName: null,
        expiresAt,
        lastConfirmedAt: now,
      })),
      skipDuplicates: true,
    })
  }

  // Every row still in the feed is reconfirmed in one statement; only rows
  // whose content actually changed get their own update.
  if (toUpdate.length > 0) {
    await prisma.exclusiveJobPosting.updateMany({
      where: { id: { in: toUpdate.map((k) => existingByUrl.get(k.job.url)!.id) } },
      data: { archivedAt: null, expiresAt, lastConfirmedAt: now },
    })
    const edits = toUpdate.filter((k) => changed(existingByUrl.get(k.job.url)!, rowData(k)))
    for (let i = 0; i < edits.length; i += 100) {
      await prisma.$transaction(
        edits.slice(i, i + 100).map((k) => prisma.exclusiveJobPosting.update({ where: { url: k.job.url }, data: rowData(k) }))
      )
    }
  }

  let archived = 0
  if (body.fullSync) {
    const result = await prisma.exclusiveJobPosting.updateMany({
      where: { addedBy: 'ncrawl', archivedAt: null, url: { notIn: urls } },
      data: { archivedAt: new Date() },
    })
    archived = result.count
  }

  return NextResponse.json({ created: toCreate.length, updated: toUpdate.length, archived, skipped })
}

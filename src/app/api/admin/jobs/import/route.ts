import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { fixAllCapsCompanyName } from '@/lib/text/org-name-match'

export const maxDuration = 60

// Bulk-import endpoint for the external `ncrawl` pipeline's import-jobs.py
// script — the only write path into ExclusiveJobPosting that accepts many
// records in one call (every other path, admin form and the ATS feed cron,
// writes one job at a time or from a hardcoded company list). Upserts on
// `url` (see the @unique on ExclusiveJobPosting.url). Rows this endpoint
// created (addedBy: 'ncrawl') that stop appearing in a `fullSync: true`
// call are archived — see the note on `fullSync` below for why partial
// runs must never set it.
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

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
}

interface ImportRequestBody {
  jobs: ImportJobInput[]
  dryRun?: boolean
  // True only for a complete, unfiltered run of the whole current source
  // list — triggers archiving any previously-imported ('ncrawl') row whose
  // url isn't in this batch. A --limit test run or a partial batch MUST
  // leave this false/omitted, or it will archive every real listing that
  // just isn't in the small test batch.
  fullSync?: boolean
}

function isValidJob(job: unknown): job is ImportJobInput {
  if (!job || typeof job !== 'object') return false
  const j = job as Record<string, unknown>
  return typeof j.title === 'string' && j.title.trim().length > 0 && typeof j.companyName === 'string' && j.companyName.trim().length > 0 && typeof j.url === 'string' && j.url.trim().length > 0
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

  if (!Array.isArray(body.jobs)) {
    return NextResponse.json({ error: '"jobs" must be an array' }, { status: 400 })
  }

  const errors: { url: string | null; reason: string }[] = []
  const validJobs = body.jobs.filter((job) => {
    if (isValidJob(job)) return true
    errors.push({ url: (job as { url?: string })?.url ?? null, reason: 'missing required field (title, companyName, or url)' })
    return false
  })

  if (body.dryRun) {
    const urls = validJobs.map((j) => j.url)
    const existing = await prisma.exclusiveJobPosting.findMany({
      where: { url: { in: urls } },
      select: { url: true },
    })
    const existingUrls = new Set(existing.map((e) => e.url))
    return NextResponse.json({
      dryRun: true,
      wouldCreate: validJobs.filter((j) => !existingUrls.has(j.url)).length,
      wouldUpdate: validJobs.filter((j) => existingUrls.has(j.url)).length,
      wouldArchive: body.fullSync
        ? await prisma.exclusiveJobPosting.count({
            where: { addedBy: 'ncrawl', archivedAt: null, url: { notIn: urls } },
          })
        : 0,
      skipped: errors,
    })
  }

  const expiresAt = new Date(Date.now() + THIRTY_DAYS_MS)
  const urls = validJobs.map((j) => j.url)
  const existingBefore = await prisma.exclusiveJobPosting.findMany({
    where: { url: { in: urls } },
    select: { url: true },
  })
  const existingUrlSet = new Set(existingBefore.map((e) => e.url))
  let created = 0
  let updated = 0

  for (const job of validJobs) {
    if (existingUrlSet.has(job.url)) updated++
    else created++

    const data = {
      title: job.title.trim(),
      companyName: fixAllCapsCompanyName(job.companyName.trim()),
      location: job.location?.trim() || null,
      description: job.description?.trim() || null,
      level: job.level?.trim() || null,
      sourceCategory: job.sourceCategory?.trim() || null,
      badges: job.badges ?? [],
      salaryMin: job.salaryMin ?? null,
      salaryMax: job.salaryMax ?? null,
      salaryCurrency: job.salaryCurrency?.trim() || null,
    }

    await prisma.exclusiveJobPosting.upsert({
      where: { url: job.url },
      create: {
        ...data,
        url: job.url,
        addedBy: 'ncrawl',
        source: 'ats_feed',
        status: 'approved',
        postingType: 'direct',
        contactName: null,
        expiresAt,
      },
      update: {
        ...data,
        archivedAt: null,
        expiresAt,
        lastConfirmedAt: new Date(),
      },
    })
  }

  let archived = 0
  if (body.fullSync) {
    const result = await prisma.exclusiveJobPosting.updateMany({
      where: { addedBy: 'ncrawl', archivedAt: null, url: { notIn: urls } },
      data: { archivedAt: new Date() },
    })
    archived = result.count
  }

  return NextResponse.json({ created, updated, archived, skipped: errors })
}

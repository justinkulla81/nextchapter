import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isBearerAuthorized } from '@/lib/auth/bearer-secret'
import { displayCompanyName } from '@/lib/text/org-name-match'
import { cleanJobLocation, parsePostedDate } from '@/lib/jobs/import-screen'
import { excerptOf } from '@/lib/jobs/posting-text'
import { classifyLocation } from '@/lib/jobs/us-location'
import { statesFromLocation } from '@/lib/pay/market-pay'
import { prepareInternship, type InternshipImportInput } from '@/lib/internships/import'

export const maxDuration = 300

// Bulk import for the ncrawl internship stream (import-jobs.py --internships).
// Writes only InternshipPosting — never ExclusiveJobPosting — so an internship
// can't reach a member's board, emails or counts; the Higher Ed portal's
// Internships tab is the only reader. Same bearer key as /api/admin/jobs/import.
//
// Like the jobs import, a full sync is batches of `internships` (each confirming
// its rows) and then one `finalizeSync` call that archives every ncrawl row the
// run didn't confirm, refusing to archive more than half unless `force`.

const SIXTY_DAYS_MS = 60 * 24 * 60 * 60 * 1000
const MAX_ARCHIVE_SHARE = 0.5

interface Body {
  internships?: unknown[]
  dryRun?: boolean
  finalizeSync?: { startedAt: string; force?: boolean }
}

async function finalize(startedAt: Date, force: boolean, dryRun: boolean) {
  const stale = { addedBy: 'ncrawl', archivedAt: null, OR: [{ lastConfirmedAt: null }, { lastConfirmedAt: { lt: startedAt } }] }
  const [live, wouldArchive] = await Promise.all([
    prisma.internshipPosting.count({ where: { addedBy: 'ncrawl', archivedAt: null } }),
    prisma.internshipPosting.count({ where: stale }),
  ])
  if (!force && live > 0 && wouldArchive / live > MAX_ARCHIVE_SHARE) {
    return NextResponse.json(
      { error: `Refusing to archive ${wouldArchive} of ${live} live internships (over ${MAX_ARCHIVE_SHARE * 100}%). Check the crawl, then re-send with force: true.`, wouldArchive, live },
      { status: 409 },
    )
  }
  if (dryRun) return NextResponse.json({ dryRun: true, wouldArchive, live })
  const result = await prisma.internshipPosting.updateMany({ where: stale, data: { archivedAt: new Date() } })
  return NextResponse.json({ archived: result.count, live: live - result.count })
}

export async function POST(request: NextRequest) {
  if (!isBearerAuthorized(request.headers.get('authorization'), process.env.NC_ATS_API_KEY)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  let body: Body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (body.finalizeSync) {
    const startedAt = new Date(body.finalizeSync.startedAt)
    if (Number.isNaN(startedAt.getTime())) return NextResponse.json({ error: 'finalizeSync.startedAt must be an ISO timestamp' }, { status: 400 })
    return finalize(startedAt, !!body.finalizeSync.force, !!body.dryRun)
  }
  if (!Array.isArray(body.internships)) return NextResponse.json({ error: '"internships" must be an array' }, { status: 400 })

  const kept: ReturnType<typeof rowOf>[] = []
  const skipped: { url: string | null; reason: string }[] = []
  const seen = new Set<string>()
  for (const raw of body.internships) {
    const r = prepareInternship(raw as InternshipImportInput, {
      cleanLocation: cleanJobLocation,
      isNonUs: (l) => classifyLocation(l) === 'non_us',
      statesOf: (l) => statesFromLocation(l),
    })
    if (!r.keep) {
      skipped.push({ url: r.url, reason: r.reason })
      continue
    }
    if (seen.has(r.row.url)) continue
    seen.add(r.row.url)
    kept.push(rowOf(r.row))
  }

  const existing = new Set(
    (await prisma.internshipPosting.findMany({ where: { url: { in: kept.map((k) => k.url) } }, select: { url: true } })).map((e) => e.url),
  )
  const toCreate = kept.filter((k) => !existing.has(k.url))
  const toUpdate = kept.filter((k) => existing.has(k.url))
  if (body.dryRun) return NextResponse.json({ dryRun: true, wouldCreate: toCreate.length, wouldUpdate: toUpdate.length, skipped })

  const now = new Date()
  const expiresAt = new Date(now.getTime() + SIXTY_DAYS_MS)
  if (toCreate.length) {
    await prisma.internshipPosting.createMany({
      data: toCreate.map((k) => ({ ...k, addedBy: 'ncrawl', lastConfirmedAt: now, expiresAt })),
      skipDuplicates: true,
    })
  }
  for (let i = 0; i < toUpdate.length; i += 100) {
    await prisma.$transaction(
      toUpdate.slice(i, i + 100).map((k) => {
        const data: Partial<typeof k> = { ...k }
        if (!data.description) delete data.description
        return prisma.internshipPosting.update({ where: { url: k.url }, data: { ...data, archivedAt: null, lastConfirmedAt: now, expiresAt } })
      }),
    )
  }
  return NextResponse.json({ created: toCreate.length, updated: toUpdate.length, skipped })
}

function rowOf(r: Extract<ReturnType<typeof prepareInternship>, { keep: true }>['row']) {
  return {
    ...r,
    companyName: displayCompanyName(r.companyName),
    description: excerptOf(r.description),
    postedAt: parsePostedDate(r.postedAt),
  }
}

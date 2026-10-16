import { after, NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { displayCompanyName } from '@/lib/text/org-name-match'
import { cleanJobLocation as cleanLocation, parsePostedDate as postedDate, screenImportedJob } from '@/lib/jobs/import-screen'
import { excerptOf, skillsFrom } from '@/lib/jobs/posting-text'
import { linkPostingsToCompanies } from '@/lib/companies/posting-company'
import { isBearerAuthorized } from '@/lib/auth/bearer-secret'
import { buildOpeningRow, closeArchivedOpenings, upsertOpenings, type OpeningRow } from '@/lib/companies/job-openings'
import { applyMarketPay } from '@/lib/companies/hiring-index'
import { importOptionalFields, importSpecFields, importText } from '@/lib/jobs/import-optional-fields'
import { statesFromLocation, US_STATE_CODES } from '@/lib/pay/market-pay'
import { parseYearsRequired } from '@/lib/jobs/years-required'
import { Prisma } from '@prisma/client'
import { reconcileBoardLightRows } from '@/lib/jobs/board-light-rows'
import { importBenefitsFields } from '@/lib/jobs/benefits'
import { writeJobBenefits } from '@/lib/jobs/great-employers-data'
import { isInternshipJob } from '@/lib/jobs/work-type'
import { FRESH_DAYS_DEFAULT, FRESH_DAYS_SENIOR, seniorWindowLevels } from '@/lib/jobs/job-status'
import { levelsInGroup, SENIORITY_GROUPS } from '@/lib/jobs/job-seniority'

const levelsInAnyGroup = () => SENIORITY_GROUPS.flatMap((g) => levelsInGroup(g.key))

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
  industry?: string | null
  // Posted on a school/district board (ncrawl k12 sources): bare
  // "Superintendent" there is the district head.
  schoolContext?: boolean
  // One-board fields, from ncrawl derive.py. All optional: an older exporter that
  // doesn't send them leaves the stored values untouched (see rowData).
  employmentType?: string | null // employment_type_norm
  payPeriod?: string | null // salary_period
  paySource?: string | null // salary_source
  workArrangement?: string | null // work_arrangement
  compensationType?: string | null // paid | equity_only | unpaid
  // Structured benefits (ncrawl benefits_json / benefits_strong). Optional: an
  // exporter that doesn't send them leaves stored benefits untouched.
  benefitsJson?: unknown // compact JSON string or object (src/lib/jobs/benefits.ts)
  benefitsStrong?: unknown // 0/1 or boolean
  // Location parts and ids (ncrawl derive.py), all optional like the fields above:
  // loc_city / loc_state (US 2-letter) / loc_country (ISO-2), every listed
  // location (locations_json → locationStates), the source's own job and
  // requisition ids, the repost key and the description hash.
  locationCity?: string | null
  locationState?: string | null
  locationCountry?: string | null
  locations?: string[] | null
  externalJobId?: string | null
  requisitionId?: string | null
  repostKey?: string | null
  descHash?: string | null
  // O*NET-SOC occupation matched by the crawler (optional like the fields above).
  socCode?: string | null
  socTitle?: string | null
  // Times the crawler saw this listing close and come back (jobs.reopen_count).
  reopenCount?: number | null
  // The same role seen before / listed twice (crawler repost_groups.py): times it came
  // back, its original first-seen date (ISO), how many other copies this one stands
  // for, and — on a second copy — the url of the copy shown. A second copy is never
  // put on the board: it is archived as 'duplicate' (a current job, not a past one).
  repostCount?: number | null
  repostFirstSeenAt?: string | null
  duplicateCount?: number | null
  duplicateOf?: string | null
  // The person the source names as the job's contact or poster (ncrawl jobs.recruiter_name).
  // Optional like the fields above: left out, the stored value is untouched.
  recruiterName?: string | null
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
    // Internships never go on the member board; they have their own table and
    // import (/api/admin/internships/import) and show only in Higher Ed portals.
    if (isInternshipJob({ title: job.title, employmentType: job.employmentType })) {
      skipped.push({ url: job.url, reason: 'internship (use /api/admin/internships/import)' })
      continue
    }
    const verdict = screenImportedJob(job.title, job.location, { schoolContext: job.schoolContext === true, description: job.description })
    if (!verdict.keep) {
      skipped.push({ url: job.url, reason: verdict.reason })
      continue
    }
    kept.push({ job, level: verdict.level })
  }
  return { kept, skipped }
}

// The salary columns are 32-bit integers; a garbled source value ("142037156822")
// used to fail the whole row. Anything that can't be a salary is dropped instead.
function storableSalary(n: number | null | undefined): number | null {
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 2_147_483_647 ? Math.round(n) : null
}

// The years-of-experience requirement, read from the FULL description the sender
// sent (only an excerpt is stored); null when the text names none. Left out when
// there is no description, so a row keeps what it holds.
function yearsRequiredOf(description: string | null | undefined) {
  if (!description?.trim()) return {}
  const years = parseYearsRequired(description)
  return { yearsRequired: years ? (years as unknown as Prisma.InputJsonValue) : Prisma.DbNull }
}

function rowData({ job, level }: Screened) {
  return {
    ...importOptionalFields(job),
    ...importSpecFields(job, (l) => statesFromLocation(l).states, US_STATE_CODES),
    ...yearsRequiredOf(job.description),
    ...('recruiterName' in job && job.recruiterName !== undefined ? { recruiterName: importText(job.recruiterName, 120) } : {}),
    title: job.title.trim(),
    companyName: displayCompanyName(job.companyName.trim()),
    location: cleanLocation(job.location),
    description: excerptOf(job.description),
    skills: skillsFrom(job.title, job.description),
    level,
    sourceCategory: job.sourceCategory?.trim() || null,
    badges: job.badges ?? [],
    salaryMin: storableSalary(job.salaryMin),
    salaryMax: storableSalary(job.salaryMax),
    salaryCurrency: job.salaryCurrency?.trim() || null,
    postedAt: postedDate(job.postedAt),
    sourceCount: typeof job.sourceCount === 'number' && job.sourceCount > 0 ? job.sourceCount : null,
    sourceName: job.sourceName?.trim() || null,
    industry: job.industry?.trim() || null,
  }
}

type RowData = ReturnType<typeof rowData>

// Prisma.DbNull (a JSON column set to SQL NULL) reads back as null, and jsonb
// hands objects back with its own key order — compare with keys sorted.
function comparable(v: unknown): string {
  const norm = (x: unknown): unknown => {
    if (x === Prisma.DbNull || x === undefined || x === null) return null
    if (Array.isArray(x)) return x.map(norm)
    if (x instanceof Date) return x.toISOString()
    if (typeof x === 'object') return Object.fromEntries(Object.keys(x as object).sort().map((k) => [k, norm((x as Record<string, unknown>)[k])]))
    return x
  }
  return JSON.stringify(norm(v))
}

function changed(before: Record<string, unknown>, after: RowData): boolean {
  return (Object.keys(after) as (keyof RowData)[]).some((k) => comparable(before[k]) !== comparable(after[k]))
}

// The company's job-opening history (CompanyJobOpening) and each job's market pay.
// Best-effort: a history write must never fail the import itself.
async function recordOpenings(kept: Screened[], companyIdOf: (k: Screened) => string | null, now: Date) {
  try {
    const rows: OpeningRow[] = []
    for (const k of kept) {
      const companyId = companyIdOf(k)
      if (!companyId) continue
      const data = rowData(k)
      const row = buildOpeningRow({ ...data, url: k.job.url }, companyId, 'import', { firstSeenAt: now, lastSeenAt: now, closedAt: null })
      if (row) rows.push(row)
    }
    await upsertOpenings(rows)
    await applyMarketPay(rows.map((r) => r.url))
  } catch (error) {
    console.error('jobs import: could not record company openings', error)
  }
}

// Structured benefits, for the jobs whose sender included them. Stored with raw
// SQL once the columns exist (great-employers-data.ts); best-effort, like the
// opening history — a benefits write must never fail the import.
async function recordBenefits(kept: Screened[]) {
  try {
    const rows = kept.flatMap((k) => {
      const f = importBenefitsFields(k.job)
      return 'benefitsStrong' in f ? [{ url: k.job.url, benefits: f.benefits ?? null, benefitsStrong: f.benefitsStrong ?? null }] : []
    })
    for (let i = 0; i < rows.length; i += 1000) await writeJobBenefits(rows.slice(i, i + 1000))
  } catch (error) {
    console.error('jobs import: could not record benefits', error)
  }
}

// A second copy of a listed role (job-status.ts 'duplicate'): a copy already on the
// board is archived with closeReason 'duplicate' (its company-history row follows at the
// next finalize or the nightly hiring index — closeArchivedOpenings); a new one is not created. Confirmed, so finalize leaves it be.
async function collapseDuplicates(urls: string[], now: Date): Promise<number> {
  if (urls.length === 0) return 0
  const result = await prisma.exclusiveJobPosting.updateMany({
    where: { url: { in: urls }, addedBy: 'ncrawl', OR: [{ archivedAt: null }, { closeReason: { not: 'duplicate' } }, { closeReason: null }] },
    data: { archivedAt: now, closeReason: 'duplicate', lastConfirmedAt: now },
  })
  return result.count
}

async function closeOpeningsSafely() {
  try {
    await closeArchivedOpenings()
  } catch (error) {
    console.error('jobs import: could not close archived openings', error)
  }
}

// Archives every ncrawl row the run didn't confirm and records WHY (job-status.ts):
// past its freshness window (director and above 60 days, others 30, from the posted
// date or else the import date) → 'aged_out', since the crawl's export drops it even
// if it is still up; otherwise the employer stopped listing it → 'removed'. One
// statement, the same rows the old updateMany archived.
async function archiveStale(startedAt: Date, now: Date): Promise<number> {
  const senior = seniorWindowLevels(levelsInAnyGroup())
  return prisma.$executeRaw`
    UPDATE "ExclusiveJobPosting"
    SET "archivedAt" = ${now},
        "closeReason" = CASE
          WHEN COALESCE("postedAt", "createdAt") < ${now}::timestamp - make_interval(days => CASE WHEN "level" = ANY(${senior}::text[]) THEN ${FRESH_DAYS_SENIOR}::int ELSE ${FRESH_DAYS_DEFAULT}::int END)
          THEN 'aged_out' ELSE 'removed' END
    WHERE "addedBy" = 'ncrawl' AND "archivedAt" IS NULL
      AND ("lastConfirmedAt" IS NULL OR "lastConfirmedAt" < ${startedAt})
  `
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
  const archivedCount = await archiveStale(startedAt, new Date())
  await closeOpeningsSafely()
  // The board's narrow copy of this table is kept in step by triggers; after a
  // full sync, check it (and repair any drift) once the response is sent.
  after(() =>
    reconcileBoardLightRows()
      .then((r) => console.log('jobs import: board light rows reconciled', r))
      .catch((error) => console.error('jobs import: board light rows reconcile failed', error))
  )
  return NextResponse.json({ archived: archivedCount, live: live - archivedCount })
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!isBearerAuthorized(authHeader, process.env.NC_ATS_API_KEY)) {
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

  const screened = screen(body.jobs)
  const skipped = screened.skipped
  // Second copies of a role already listed elsewhere: collapsed, never on the board.
  const isDuplicate = (k: Screened) => typeof k.job.duplicateOf === 'string' && !!k.job.duplicateOf.trim() && k.job.duplicateOf.trim() !== k.job.url
  const duplicates = screened.kept.filter(isDuplicate)
  const kept = screened.kept.filter((k) => !isDuplicate(k))
  const urls = kept.map((k) => k.job.url)
  const existing = await prisma.exclusiveJobPosting.findMany({
    where: { url: { in: urls } },
    select: {
      id: true, url: true, title: true, companyName: true, location: true, description: true, skills: true, level: true,
      sourceCategory: true, badges: true, salaryMin: true, salaryMax: true, salaryCurrency: true,
      postedAt: true, sourceCount: true, sourceName: true, industry: true, companyId: true,
      employmentType: true, payPeriod: true, paySource: true, workArrangement: true, compensationType: true,
      locationCity: true, locationState: true, locationCountry: true, locationStates: true, externalJobId: true,
      requisitionId: true, repostKey: true, descHash: true, yearsRequired: true, socCode: true, socTitle: true, reopenCount: true,
      repostCount: true, repostFirstSeenAt: true, duplicateCount: true, recruiterName: true,
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
      wouldCollapse: duplicates.length,
      wouldArchive: body.fullSync
        ? await prisma.exclusiveJobPosting.count({ where: { addedBy: 'ncrawl', archivedAt: null, url: { notIn: urls } } })
        : 0,
      skipped,
    })
  }

  const now = new Date()
  const expiresAt = new Date(now.getTime() + THIRTY_DAYS_MS)

  // Every job is tied to its directory Company: new rows at create, older rows that
  // were never linked on their next import.
  const unlinked = toUpdate.filter((k) => !existingByUrl.get(k.job.url)!.companyId)
  const companyIds = await linkPostingsToCompanies([...toCreate, ...unlinked].map((k) => rowData(k).companyName))

  if (toCreate.length > 0) {
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
      data: { archivedAt: null, closeReason: null, expiresAt, lastConfirmedAt: now },
    })
    for (const k of unlinked) {
      const companyId = companyIds.get(rowData(k).companyName)
      if (companyId) await prisma.exclusiveJobPosting.updateMany({ where: { url: k.job.url, companyId: null }, data: { companyId } })
    }
    const edits = toUpdate.filter((k) => changed(existingByUrl.get(k.job.url)!, rowData(k)))
    for (let i = 0; i < edits.length; i += 100) {
      await prisma.$transaction(
        edits.slice(i, i + 100).map((k) => {
          const data = rowData(k)
          // A payload with no description (an older exporter) must not erase one we already hold.
          if (!data.description) {
            delete (data as { description?: unknown }).description
            delete (data as { skills?: unknown }).skills
          }
          return prisma.exclusiveJobPosting.update({ where: { url: k.job.url }, data })
        })
      )
    }
  }

  const collapsed = await collapseDuplicates(duplicates.map((k) => k.job.url), now)
  await recordOpenings(kept, (k) => existingByUrl.get(k.job.url)?.companyId ?? companyIds.get(rowData(k).companyName) ?? null, now)
  await recordBenefits(kept)

  let archived = 0
  if (body.fullSync) {
    const result = await prisma.exclusiveJobPosting.updateMany({
      where: { addedBy: 'ncrawl', archivedAt: null, url: { notIn: urls } },
      // Small single-call runs only; the batched finalize below tells removed from aged out.
      data: { archivedAt: new Date(), closeReason: 'removed' },
    })
    archived = result.count
    await closeOpeningsSafely()
  }

  return NextResponse.json({ created: toCreate.length, updated: toUpdate.length, archived, collapsed, skipped })
}

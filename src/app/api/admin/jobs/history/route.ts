import { NextResponse, type NextRequest } from 'next/server'
import { isBearerAuthorized } from '@/lib/auth/bearer-secret'
import { parsePostedDate, screenImportedJob } from '@/lib/jobs/import-screen'
import { linkCompaniesBulk } from '@/lib/companies/posting-company'
import { buildOpeningRow, upsertOpenings, type OpeningRow } from '@/lib/companies/job-openings'
import { displayCompanyName } from '@/lib/text/org-name-match'

export const maxDuration = 300

// Crawler-history backfill for the company hiring index: every job the external
// ncrawl crawler has ever seen (open and closed, from its jobs.db) becomes a
// CompanyJobOpening row, so a company's past openings are kept even after they left
// the board. Sent in batches by ~/nextchapter-jobs/backfill-history.py; idempotent
// (upsert by URL, first/last-seen widen, never narrow). Same screen as the import:
// US or remote, manager-and-up plus senior individual roles. Writes nothing to the
// board itself.
const MAX_BATCH = 1000

interface HistoryJob {
  url: string
  title: string
  companyName: string
  location?: string | null
  salaryMin?: number | null
  salaryMax?: number | null
  salaryCurrency?: string | null
  postedAt?: string | null
  firstSeen?: string | null
  lastSeen?: string | null
  active?: boolean | null
  industry?: string | null
  sourceName?: string | null
}

function isValid(j: unknown): j is HistoryJob {
  if (!j || typeof j !== 'object') return false
  const r = j as Record<string, unknown>
  return [r.url, r.title, r.companyName].every((v) => typeof v === 'string' && v.trim().length > 0)
}

function date(raw: string | null | undefined): Date | null {
  if (!raw) return null
  const d = new Date(raw)
  return Number.isNaN(d.getTime()) ? null : d
}

export async function POST(request: NextRequest) {
  if (!isBearerAuthorized(request.headers.get('authorization'), process.env.NC_ATS_API_KEY)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  let body: { jobs?: unknown[]; dryRun?: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  if (!Array.isArray(body.jobs)) return NextResponse.json({ error: '"jobs" must be an array' }, { status: 400 })
  if (body.jobs.length > MAX_BATCH) return NextResponse.json({ error: `Send at most ${MAX_BATCH} jobs per request` }, { status: 400 })

  const skipped: Record<string, number> = {}
  const skip = (reason: string) => (skipped[reason] = (skipped[reason] ?? 0) + 1)
  const kept: { job: HistoryJob; level: string; location: string | null; companyName: string }[] = []
  for (const job of body.jobs) {
    if (!isValid(job)) {
      skip('missing required field')
      continue
    }
    const verdict = screenImportedJob(job.title, job.location)
    if (!verdict.keep) {
      skip(verdict.reason)
      continue
    }
    kept.push({ job, level: verdict.level, location: verdict.location, companyName: displayCompanyName(job.companyName.trim()) })
  }
  if (body.dryRun) return NextResponse.json({ dryRun: true, received: body.jobs.length, kept: kept.length, skipped })

  const companyIds = await linkCompaniesBulk(kept.map((k) => k.companyName))
  const now = new Date()
  const rows: OpeningRow[] = []
  for (const k of kept) {
    const companyId = companyIds.get(k.companyName)
    if (!companyId) {
      skip('company name could not be linked')
      continue
    }
    const lastSeen = date(k.job.lastSeen) ?? now
    const firstSeen = date(k.job.firstSeen) ?? lastSeen
    const row = buildOpeningRow(
      {
        url: k.job.url,
        title: k.job.title,
        companyName: k.companyName,
        location: k.location,
        level: k.level,
        industry: k.job.industry,
        salaryMin: typeof k.job.salaryMin === 'number' ? k.job.salaryMin : null,
        salaryMax: typeof k.job.salaryMax === 'number' ? k.job.salaryMax : null,
        salaryCurrency: k.job.salaryCurrency,
        postedAt: parsePostedDate(k.job.postedAt),
        sourceName: k.job.sourceName,
      },
      companyId,
      'crawler_history',
      { firstSeenAt: firstSeen < lastSeen ? firstSeen : lastSeen, lastSeenAt: lastSeen, closedAt: k.job.active === false ? lastSeen : null }
    )
    if (row) rows.push(row)
    else skip('unusable url or title')
  }
  const written = await upsertOpenings(rows)
  return NextResponse.json({ received: body.jobs.length, kept: kept.length, written, companies: new Set(companyIds.values()).size, skipped })
}

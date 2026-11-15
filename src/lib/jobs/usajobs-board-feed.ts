import 'server-only'
import { prisma } from '@/lib/prisma'
import { linkPostingsToCompanies } from '@/lib/companies/posting-company'
import { boardRow, THIRTY_DAYS_MS } from '@/lib/jobs/gov-feed-core'
import { fetchRecentJoas, joaToKept } from '@/lib/jobs/usajobs-board-core'

// Federal jobs on the job board, from USAJOBS's keyless Historic JOA API (see usajobs-board-core). Every run reads the
// announcements opened in the last 45 days (about 35,000 rows, paged 500 at a time from data.usajobs.gov, not our
// database), keeps those open to the public and still accepting applications that pass the board's import screen, and
// adds the ones the board does not hold yet. A row expires on its closing date (at most 60 days out), so the board's own
// expiry job retires closed announcements; nothing here archives.
//
// Database reads per run: one range read of this feed's rows by url prefix (id and url only, unique url index) and the
// company links for new jobs. Writes: the new rows, once a week.

const URL_PREFIX = 'https://www.usajobs.gov/job/'
const WINDOW_DAYS = 45
const TIME_BUDGET_MS = 70_000
const SRC = { addedBy: 'usajobs_feed', sourceName: 'USAJOBS' }

export interface UsajobsBoardResult {
  announcements: number
  complete: boolean
  kept: number
  alreadyOnBoard: number
  created: number
  skipped: Record<string, number>
}

export async function runUsajobsBoardFeed(): Promise<UsajobsBoardResult> {
  const now = new Date()
  const { joas, complete } = await fetchRecentJoas(WINDOW_DAYS, Date.now() + TIME_BUDGET_MS)
  const skipped: Record<string, number> = {}
  const keptRows: { row: ReturnType<typeof boardRow>; employer: string }[] = []
  for (const j of joas) {
    const v = joaToKept(j, now)
    if (!v.keep) { skipped[v.reason] = (skipped[v.reason] ?? 0) + 1; continue }
    const closes = v.closesAt ?? new Date(now.getTime() + THIRTY_DAYS_MS)
    const expiresAt = new Date(Math.min(closes.getTime(), now.getTime() + 2 * THIRTY_DAYS_MS))
    keptRows.push({ row: boardRow(v.kept, SRC, now, expiresAt), employer: v.kept.posting.employer })
  }
  const existing = await prisma.exclusiveJobPosting.findMany({
    where: { url: { gte: URL_PREFIX, lt: URL_PREFIX + '￿', startsWith: URL_PREFIX } },
    select: { url: true },
  })
  const have = new Set(existing.map((e) => e.url))
  const fresh = keptRows.filter((k) => !have.has(k.row.url))
  let created = 0
  if (fresh.length > 0) {
    const companyIds = await linkPostingsToCompanies(fresh.map((k) => k.employer))
    const result = await prisma.exclusiveJobPosting.createMany({
      skipDuplicates: true,
      data: fresh.map((k) => ({ ...k.row, companyId: companyIds.get(k.employer) ?? null })),
    })
    created = result.count
  }
  return { announcements: joas.length, complete, kept: keptRows.length, alreadyOnBoard: keptRows.length - fresh.length, created, skipped }
}

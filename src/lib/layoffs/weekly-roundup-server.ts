import 'server-only'
import { prisma } from '@/lib/prisma'
import { stateName } from '@/lib/seo/states'
import { buildRoundup, roundupDrafts, roundupWindow, type Roundup, type RoundupDrafts } from './weekly-roundup'

/** The last full week's layoffs from the tracker, and the drafts for it. layoffs.fyi rows are news, not filings, and are left out as in the public tracker's filing counts. */
export async function loadWeeklyRoundup(now: Date = new Date()): Promise<{ roundup: Roundup; drafts: RoundupDrafts }> {
  const window = roundupWindow(now)
  const rows = await prisma.warnNotice.findMany({
    where: {
      dismissedAt: null,
      noticeDate: { gte: window.from, lt: window.to },
      OR: [{ sourceUrl: null }, { NOT: { sourceUrl: { contains: 'layoffs.fyi', mode: 'insensitive' } } }],
    },
    select: { employer: true, state: true, source: true, employees: true, noticeDate: true, country: true, layoffType: true, company: { select: { name: true } } },
  })
  const roundup = buildRoundup(
    rows.flatMap((r) => (r.noticeDate ? [{ employer: r.company?.name ?? r.employer, state: r.state, source: r.source, workers: r.employees, noticeDate: r.noticeDate, country: r.country, layoffType: r.layoffType }] : [])),
    window,
  )
  return { roundup, drafts: roundupDrafts(roundup, (code) => stateName(code) ?? code) }
}

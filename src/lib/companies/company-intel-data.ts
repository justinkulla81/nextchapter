import 'server-only'
import { prisma } from '@/lib/prisma'
import { inferFunctionFromTitle } from '@/lib/jobs/infer-job-function'
import { isBoardPostingLockedForViewer } from '@/lib/jobs/job-board-visibility'
import { summarizePay, type PayGroup } from '@/lib/companies/pay-ranges'
import { buildLayoffTimeline, type LayoffTimeline } from '@/lib/companies/layoff-timeline'
import { getLikelyOpeningsForCompanies, type CompanyLikelyOpening } from '@/lib/likely-openings/for-companies'
import { summarizeHowToApply, type ApplyFacts } from '@/lib/companies/how-to-apply'

// The company page's intelligence panels: what it pays, its layoff history and whether
// it is hiring again, and how to approach applying. All from data we already hold; no
// AI call, so no per-view cost. Postings here are limited to ones THIS viewer could open
// and that name the company — a confidential search or a locked exclusive never feeds a
// panel, so a panel cannot reveal one.

export interface CompanyIntelPanels {
  pay: PayGroup[]
  /** Offered wages on public H-1B filings, by occupation. Empty when none are on file. */
  visaWages: { socTitle: string; filings: number; p25: number; median: number; p75: number; state: string | null; latest: Date }[]
  /** Public SEC filings that suggest a change: leadership moves and large private raises. */
  filings: CompanyLikelyOpening[]
  companyName: string
  payPostings: number
  layoffs: LayoffTimeline
  apply: ApplyFacts
  openPostings: number
}

let trackingStartCache: { at: number; value: Date | null } | null = null
async function boardTrackingStart(): Promise<Date | null> {
  if (trackingStartCache && Date.now() - trackingStartCache.at < 60 * 60 * 1000) return trackingStartCache.value
  const row = await prisma.exclusiveJobPosting.aggregate({ _min: { createdAt: true } })
  trackingStartCache = { at: Date.now(), value: row._min.createdAt }
  return row._min.createdAt
}

const TWO_YEARS_MS = 2 * 365 * 24 * 60 * 60 * 1000

export async function loadCompanyIntelPanels(companyId: string, isCandidatePlus: boolean): Promise<CompanyIntelPanels> {
  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { name: true } })
  const companyName = company?.name ?? ''
  const [postings, notices, trackingStart, wageRows, filingMap] = await Promise.all([
    prisma.exclusiveJobPosting.findMany({
      where: { companyId, status: 'approved', distribution: { not: 'EXCLUDED' }, disclosure: 'OPEN' },
      select: {
        title: true, url: true, createdAt: true, archivedAt: true, badges: true, postingType: true, sourceCategory: true,
        salaryMin: true, salaryMax: true, salaryCurrency: true, audienceTier: true, source: true,
      },
    }),
    prisma.warnNotice.findMany({
      where: { companyId, noticeDate: { gte: new Date(Date.now() - TWO_YEARS_MS) } },
      select: { noticeDate: true, employees: true, layoffType: true, sourceUrl: true },
      orderBy: { noticeDate: 'desc' },
    }),
    boardTrackingStart(),
    prisma.offeredWageSummary.findMany({ where: { companyId }, orderBy: { filings: 'desc' }, take: 8 }).catch(() => []),
    // Exact normalised-name match inside the SEC feed; expired signals are already excluded.
    companyName
      ? getLikelyOpeningsForCompanies([companyName], { perCompany: 4 }).catch(() => new Map<string, CompanyLikelyOpening[]>())
      : Promise.resolve(new Map<string, CompanyLikelyOpening[]>()),
  ])

  const openable = postings.filter((p) => !isBoardPostingLockedForViewer(p, isCandidatePlus))
  const live = openable.filter((p) => p.archivedAt === null)

  const pay = summarizePay(live)
  const layoffs = buildLayoffTimeline({
    notices: notices.filter((n): n is typeof n & { noticeDate: Date } => n.noticeDate !== null),
    // Hiring "since" counts every posting we have seen, open or since closed.
    postings: openable.map((p) => ({ createdAt: p.createdAt, function: inferFunctionFromTitle(p.title) })),
    trackingStart,
  })

  return {
    pay,
    visaWages: wageRows.map((w) => ({
      socTitle: w.socTitle,
      filings: w.filings,
      p25: w.wageP25,
      median: w.wageMedian,
      p75: w.wageP75,
      state: w.topState,
      latest: w.latestDecision,
    })),
    filings: filingMap.get(companyName) ?? [],
    companyName,
    payPostings: pay.reduce((s, g) => s + g.postings, 0),
    layoffs,
    apply: summarizeHowToApply(live),
    openPostings: live.length,
  }
}

import 'server-only'
import { noticeShare } from './layoff-share'
import { prisma } from '@/lib/prisma'
import { announceOfficial } from './layoff-alert'
import { sameEmployer } from './news-headline'

const COVERED_DAYS = 45
const DAY_MS = 86_400_000
const SITE = 'https://launchyournextchapter.com'

export interface OfficialFiling {
  kind: 'warn' | 'sec'
  employer: string
  normalizedEmployer: string
  state: string | null
  county?: string | null
  noticeDate: Date
  effectiveDate?: Date | null
  employees: number | null
  sourceUrl: string | null
}

/** A news-filed notice (layoffType "Reported by …") for the same employer near the filing's date, not yet confirmed. */
export async function findNewsRecord(f: Pick<OfficialFiling, 'normalizedEmployer' | 'noticeDate'>) {
  const rows = await prisma.warnNotice.findMany({
    where: {
      source: 'MANUAL_ANNOUNCEMENT', dismissedAt: null, layoffType: { startsWith: 'Reported by' },
      noticeDate: { gte: new Date(f.noticeDate.getTime() - COVERED_DAYS * DAY_MS), lte: new Date(f.noticeDate.getTime() + COVERED_DAYS * DAY_MS) },
    },
    select: { id: true, employer: true, normalizedEmployer: true, employees: true, state: true, layoffType: true, alertSentAt: true, promotedOrgId: true },
  })
  return rows.find((n) => sameEmployer(n.normalizedEmployer, f.normalizedEmployer)) ?? null
}

/**
 * A state WARN notice or an SEC 8-K arrives for a layoff we already hold from news. The filing goes on that same record: it is
 * marked confirmed (the label no longer says "unconfirmed"), and the place, county and date the filing gives are filled in.
 * The reported headcount stays: a state notice covers one site, so it can be smaller than the company's announcement. Justin is
 * told it is official only if the news record was already emailed to him, so a first alert never arrives twice.
 * Never throws; returns true when a news record was confirmed.
 */
export async function confirmNewsRecord(f: OfficialFiling): Promise<boolean> {
  try {
    const news = await findNewsRecord(f)
    if (!news) return false
    const label = f.kind === 'sec' ? 'SEC 8-K filing' : 'state WARN filing'
    await prisma.warnNotice.update({
      where: { id: news.id },
      data: {
        layoffType: (news.layoffType ?? '').replace(/^Reported by [^·]*/, `Confirmed by ${label} `).trim(),
        ...(news.state == null && f.state ? { state: f.state } : {}),
        ...(f.county ? { county: f.county } : {}),
        ...(f.effectiveDate ? { effectiveDate: f.effectiveDate } : {}),
        ...(news.employees == null && f.employees != null ? { employees: f.employees } : {}),
      },
    })
    if (news.alertSentAt) {
      await announceOfficial({
        employer: news.employer, kind: f.kind, state: f.state, filingEmployees: f.employees, reportedEmployees: news.employees,
        effectiveOn: f.effectiveDate ? f.effectiveDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : null,
        sourceUrl: f.sourceUrl,
        orgUrl: news.promotedOrgId ? `${SITE}/support/admin/crm/organizations/${news.promotedOrgId}` : null,
        ...noticeShare({ noticeId: news.id, employer: news.employer, employees: news.employees, state: news.state ?? f.state }),
      })
    }
    return true
  } catch (e) {
    console.error('Confirming a news layoff failed for', f.employer, e)
    return false
  }
}

import 'server-only'
import { prisma } from '@/lib/prisma'
import { normalizeOrgName } from '@/lib/text/org-name-match'
import { pageText } from '@/lib/workforce/college-pages'
import { matchOrCreateCompanyForEmployer } from './company-match'
import { sameEmployer, SEC_USER_AGENT } from './sec-8k'
import { alertNewLayoff } from './layoff-alert'
import { findLayoffContacts } from './layoff-contacts-run'
import { readFilingCosts } from './layoff-cost'

/** A notice already on file this close covers the layoff, the same window the SEC and news checks use. */
const COVERED_DAYS = 45

export interface AnnouncedLayoff {
  company: string
  state?: string | null
  employees?: number | null
  percent?: number | null
  /** YYYY-MM-DD */
  noticeDate: string
  sourceUrl: string
  kind: 'sec' | 'news'
  /** An 8-K or a second outlet confirms it; a single outlet does not. */
  confirmed: boolean
}

export interface AnnounceResult {
  filed: boolean
  reason?: 'already-filed' | 'covered'
  noticeId?: string
  contacts?: number
  alerted?: boolean
}

/**
 * Files a layoff found outside the app (the layoff-watch scheduled task reads news and EDGAR itself)
 * and runs it through the same steps the app's own SEC and news checks use: company match, costs read
 * from the filing, contact lookup, then the one full alert email (who to contact, local picture,
 * "Write email" buttons). The task sends no email of its own, so every alert looks the same.
 */
export async function announceLayoff(l: AnnouncedLayoff): Promise<AnnounceResult> {
  const key = normalizeOrgName(l.company)
  const when = new Date(`${l.noticeDate}T00:00:00Z`)

  if (await prisma.warnNotice.findFirst({ where: { sourceUrl: l.sourceUrl }, select: { id: true } })) {
    return { filed: false, reason: 'already-filed' }
  }
  const recent = await prisma.warnNotice.findMany({
    where: { dismissedAt: null, noticeDate: { gte: new Date(when.getTime() - COVERED_DAYS * 86_400_000) } },
    select: { normalizedEmployer: true, noticeDate: true },
  })
  if (recent.some((n) => sameEmployer(n.normalizedEmployer, key)
    && n.noticeDate && Math.abs(n.noticeDate.getTime() - when.getTime()) <= COVERED_DAYS * 86_400_000)) {
    return { filed: false, reason: 'covered' }
  }

  // A filing says what the cut costs and who runs the outplacement; a news story rarely does.
  let costs = {}
  if (l.kind === 'sec') {
    const res = await fetch(l.sourceUrl, { headers: { 'User-Agent': SEC_USER_AGENT }, signal: AbortSignal.timeout(20_000) }).catch(() => null)
    if (res?.ok) costs = readFilingCosts(pageText((await res.text()).slice(0, 400_000)))
  }

  const match = await matchOrCreateCompanyForEmployer(l.company).catch(() => null)
  const notice = await prisma.warnNotice.create({
    data: {
      ...(match ? {
        companyId: match.companyId,
        companyMatchStatus: match.status,
        ...(match.candidates ? { companyMatchCandidates: match.candidates } : {}),
      } : {}),
      employer: l.company,
      normalizedEmployer: key,
      source: 'MANUAL_ANNOUNCEMENT',
      state: l.state ?? null,
      noticeDate: when,
      employees: l.employees ?? null,
      sourceUrl: l.sourceUrl,
      layoffType: l.kind === 'sec'
        ? `SEC 8-K Item 2.05 (restructuring filing)${l.percent ? ` · ${l.percent}% of staff` : ''}`
        : `${l.confirmed ? 'Reported by 2+ publishers' : 'Reported by 1 publisher — unconfirmed'}${l.percent ? ` · ${l.percent}% of staff` : ''}`,
      ...costs,
    },
    select: { id: true },
  })

  let contacts = 0
  if (process.env.ANTHROPIC_API_KEY) {
    contacts = await findLayoffContacts({ employer: l.company, employees: l.employees ?? null, date: when, urls: [l.sourceUrl] })
      .then((r) => r.found).catch(() => 0)
  }
  const alerted = await alertNewLayoff({
    noticeId: notice.id, employer: l.company, normalizedEmployer: key, employees: l.employees ?? null, percent: l.percent ?? null,
    kind: l.kind, confirmed: l.confirmed, sourceUrl: l.sourceUrl, contactsFound: contacts,
  })
  return { filed: true, noticeId: notice.id, contacts, alerted }
}

import 'server-only'
import { prisma } from '@/lib/prisma'
import { normalizeOrgName } from '@/lib/text/org-name-match'
import { pageText } from '@/lib/workforce/college-pages'
import { fetchItem205, readLayoffFiling, sameEmployer, SEC_USER_AGENT } from './sec-8k'
import { alertNewLayoff } from './layoff-alert'

/** Filing documents read per run; each is one fetch, and Item 2.05 is a handful a day. */
const MAX_DOCS = 25
/** A filing or notice already on file this close covers the layoff (same as the news check). */
const COVERED_DAYS = 45

export interface Sec8kResult { filings: number; added: { company: string; employees: number | null }[]; covered: number; notLayoff: number; error?: string }

/**
 * Daily: files each recent Item 2.05 8-K that reads as a layoff and nothing
 * on file covers. It lands as an announcement, labelled with its source, and
 * the contact and primary-contact steps pick it up from there.
 */
export async function runSec8kCheck(): Promise<Sec8kResult> {
  const result: Sec8kResult = { filings: 0, added: [], covered: 0, notLayoff: 0 }
  let filings
  try {
    filings = await fetchItem205()
  } catch (e) {
    return { ...result, error: e instanceof Error ? e.message : String(e) }
  }
  result.filings = filings.length

  const recent = await prisma.warnNotice.findMany({
    where: { dismissedAt: null, noticeDate: { gte: new Date(Date.now() - (COVERED_DAYS + 7) * 86_400_000) } },
    select: { normalizedEmployer: true, noticeDate: true, sourceUrl: true },
  })

  let read = 0
  for (const f of filings) {
    if (recent.some((n) => n.sourceUrl === f.url)) { result.covered++; continue }
    const key = normalizeOrgName(f.company)
    const when = new Date(`${f.fileDate}T00:00:00Z`)
    const covering = recent.find((n) => sameEmployer(n.normalizedEmployer, key)
      && n.noticeDate && Math.abs(n.noticeDate.getTime() - when.getTime()) <= COVERED_DAYS * 86_400_000)
    if (covering) { result.covered++; continue }
    if (read >= MAX_DOCS) break
    read++

    const res = await fetch(f.url, { headers: { 'User-Agent': SEC_USER_AGENT }, signal: AbortSignal.timeout(20_000) }).catch(() => null)
    if (!res?.ok) continue
    const { isLayoff, employees, percent } = readLayoffFiling(pageText((await res.text()).slice(0, 400_000)))
    if (!isLayoff) { result.notLayoff++; continue }

    const notice = await prisma.warnNotice.create({
      data: {
        employer: f.company, normalizedEmployer: key, source: 'MANUAL_ANNOUNCEMENT', state: f.state,
        noticeDate: when, employees, sourceUrl: f.url,
        layoffType: `SEC 8-K Item 2.05 (restructuring filing)${percent ? ` · ${percent}% of staff` : ''}`,
      },
      select: { id: true },
    })
    // A filing is the company's own statement, so it counts as confirmed.
    await alertNewLayoff({
      noticeId: notice.id, employer: f.company, normalizedEmployer: key, employees, percent,
      kind: 'sec', confirmed: true, sourceUrl: f.url,
    })
    recent.push({ normalizedEmployer: key, noticeDate: when, sourceUrl: f.url })
    result.added.push({ company: f.company, employees })
  }
  return result
}

import 'server-only'
import { prisma } from '@/lib/prisma'
import { employerSlug } from '@/lib/warn/layoff-pages'
import { stateName } from '@/lib/seo/states'
import { readJsonGz, STATE_BUCKET, writeJsonGz } from '@/lib/syndication/storage'
import type { ChannelId } from '@/lib/social/channels'
import type { Fact } from '@/lib/social/facts'
import { announcementBasis, announcementPostText, filingPostText, isClosure, splitFilingEmployer } from '@/lib/social/posts'

export const LEDGER_PATH = 'social/filings-posted.json.gz'
const DAY_MS = 86_400_000
/** Layoffs are news: only those from the last few days are posted, so a long backlog never posts stale items. */
export const FILING_MAX_AGE_DAYS = 3
/** X bills each post, so it gets only the biggest layoffs and a small daily cap (3 a day is about $18 a month at $0.20 a post). Every other channel gets every layoff. */
export const FILING_RULES: Partial<Record<ChannelId, { minWorkers: number; perDay: number }>> = { x: { minWorkers: 250, perDay: 3 } }

export interface Ledger {
  v: 1
  /** `<notice id>:<channel>` -> ISO time sent. */
  sent: Record<string, string>
}

export const readLedger = async (): Promise<Ledger> => (await readJsonGz<Ledger>(STATE_BUCKET, LEDGER_PATH).catch(() => null)) ?? { v: 1, sent: {} }
export const writeLedger = (l: Ledger) => writeJsonGz(STATE_BUCKET, LEDGER_PATH, l)

export interface LayoffItem {
  /** WarnNotice id: the ledger key. */
  id: string
  kind: 'filing' | 'announcement'
  employer: string
  workers: number | null
  fact: Fact
}

const day = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
const n = (v: number) => v.toLocaleString('en-US')

/**
 * Every layoff in the window, newest first: emailed announcements (an SEC filing or two or more outlets back them; a single-outlet
 * story stays in the admin queue), then WARN filings (state records). No minimum headcount. A company with an announcement is not
 * posted again from its filing, and a shutdown is not "layoffs". The caller drops what each channel already has.
 */
export async function loadLayoffQueue(now: Date): Promise<LayoffItem[]> {
  const select = { id: true, companyId: true, employer: true, employees: true, state: true, noticeDate: true, companyMatchStatus: true, layoffType: true, company: { select: { name: true } } } as const
  const since = new Date(now.getTime() - FILING_MAX_AGE_DAYS * DAY_MS)
  const [filings, announced] = await Promise.all([
    prisma.warnNotice.findMany({
      where: { source: { not: 'MANUAL_ANNOUNCEMENT' }, dismissedAt: null, noticeDate: { gte: since, lte: now } },
      orderBy: [{ noticeDate: 'desc' }, { employees: 'desc' }], take: 200, select,
    }),
    // Layoffs the owner emailed in are published to the layoff RSS feed (rssPublishedAt), so they are cleared for the channels too.
    // The age counts from publication, since the story's date can be a day or two earlier.
    prisma.warnNotice.findMany({
      where: { source: 'MANUAL_ANNOUNCEMENT', dismissedAt: null, rssPublishedAt: { gte: since, lte: now } },
      orderBy: { rssPublishedAt: 'desc' }, take: 50, select,
    }),
  ])
  const announcedCompanies = new Set(announced.flatMap((x) => (x.companyId ? [x.companyId] : [])))
  const out: LayoffItem[] = []

  for (const row of [...announced.map((x) => ({ ...x, kind: 'announcement' as const })), ...filings.map((x) => ({ ...x, kind: 'filing' as const }))]) {
    const matchedName = row.companyMatchStatus === 'MATCHED' ? row.company?.name ?? null : null
    const slug = employerSlug(row.employer, matchedName)
    if (!slug || !row.noticeDate) continue
    if (row.kind === 'filing' && row.companyId && announcedCompanies.has(row.companyId)) continue
    const sourcing = announcementBasis(row.layoffType)
    if (row.kind === 'announcement' && (isClosure(row.layoffType) || sourcing.basis === 'unconfirmed')) continue
    // A filing's employer field can carry an address ("GEICO 3535 W Pipkin Road LAKELAND, FL"): say the city, with the matched company name.
    const site = splitFilingEmployer(row.employer)
    const name = matchedName ?? site.name
    const path = `/layoffs/company/${slug}`
    const where = row.state ? stateName(row.state) : null
    const date = row.noticeDate

    const lines = [
      `Employer: ${name}`,
      ...(site.city && where ? [`Site: ${site.city}, ${where}`] : where ? [`State: ${where}`] : []),
      ...(row.employees ? [row.kind === 'filing' ? `Workers named in the notice: ${n(row.employees)}` : `Workers affected, as reported: ${n(row.employees)}`] : []),
      ...(sourcing.percent ? [`Share of staff: ${sourcing.percent}% (a share of staff, not a headcount)`] : []),
      row.kind === 'filing'
        ? `Source: a WARN layoff notice${where ? ` filed with ${where}` : ' filed with a state'} on ${day(date)}`
        : `Source: ${sourcing.basis === 'sec' ? 'an SEC filing' : 'multiple news reports'}`,
      'Say nothing about how many people lose jobs beyond the figures above',
    ]
    out.push({
      id: row.id,
      kind: row.kind,
      employer: name,
      workers: row.employees,
      fact: {
        key: `layoff-${row.id}`,
        topic: 'layoff',
        lines,
        path,
        campaign: row.kind === 'announcement' ? 'layoff-announcement' : 'warn-filing',
        fallback: (link, short) => {
          const utm = link.split('?')[1] ?? ''
          return row.kind === 'announcement' && sourcing.basis !== 'unconfirmed'
            ? announcementPostText({ employer: name, state: row.state, workers: row.employees, percent: sourcing.percent, basis: sourcing.basis, path }, utm, short)
            : filingPostText({ employer: name, state: row.state, city: site.city, workers: row.employees, date, path }, utm, short)
        },
      },
    })
  }
  return out
}

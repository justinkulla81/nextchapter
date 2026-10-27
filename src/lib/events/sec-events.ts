import { prisma } from '@/lib/prisma'
import { listFilingsForDay, filingDocUrl, filingIndexUrl, type EftsHit } from '@/lib/likely-openings/edgar'
import { normalizeOrgName } from '@/lib/text/org-name-match'
import { strictOrgKey } from '@/lib/crm/normalize'

// Company events read from SEC filings: free, structured, no AI. An 8-K names what it reports by item number, so the item says
// what happened without reading the text: 2.01 completed an acquisition or sale of assets, 5.02 an executive or director left or
// joined, 3.02 shares sold outside a registered offering. A Form D is a private raise. Product launches have no such code and are
// not read here. An event is kept only for a company NextChapter already has a record for.

export type EventKind = 'ACQUISITION' | 'LEADERSHIP' | 'FUNDRAISE'

export interface SecEvent { kind: EventKind; headline: string }

/** What a filing reports, from its form and item numbers. A filing can report more than one. */
export function eventsOfFiling(hit: Pick<EftsHit, 'form' | 'items' | 'sics'>): SecEvent[] {
  if (hit.form === 'D') {
    // SIC 67xx are funds, trusts and blank-check shells, whose "raises" are not a company growing.
    if (hit.sics.some((s) => s.startsWith('67'))) return []
    return [{ kind: 'FUNDRAISE', headline: 'Raised capital (SEC Form D)' }]
  }
  const out: SecEvent[] = []
  if (hit.items.includes('2.01')) out.push({ kind: 'ACQUISITION', headline: 'Completed an acquisition or sale of assets' })
  if (hit.items.includes('5.02')) out.push({ kind: 'LEADERSHIP', headline: 'Executive or director change' })
  if (hit.items.includes('3.02')) out.push({ kind: 'FUNDRAISE', headline: 'Sold shares outside a registered offering' })
  return out
}

export type CompanyKeyIndex = Map<string, string>
export async function loadCompanyKeyIndex(): Promise<CompanyKeyIndex> {
  const rows = await prisma.company.findMany({ select: { id: true, name: true } })
  const by: CompanyKeyIndex = new Map()
  for (const c of rows) {
    const k = strictOrgKey(c.name, normalizeOrgName)
    // Two companies sharing a key are not told apart here, so neither gets events.
    if (k) by.set(k, by.has(k) ? '' : c.id)
  }
  return by
}

/** Reads one day's 8-Ks and Form Ds and stores the events for companies we have. Returns how many were stored. */
export async function ingestSecEventsForDay(day: string, index: CompanyKeyIndex): Promise<{ filings: number; stored: number }> {
  const hits = [...(await listFilingsForDay('8-K', day)), ...(await listFilingsForDay('D', day))]
  const rows: { companyId: string; kind: EventKind; headline: string; eventDate: Date; sourceUrl: string; accession: string; filerName: string }[] = []
  for (const h of hits) {
    const events = eventsOfFiling(h)
    if (events.length === 0) continue
    const key = strictOrgKey(h.companyName, normalizeOrgName)
    const companyId = key ? index.get(key) : undefined
    if (!companyId) continue
    for (const e of events) {
      rows.push({ companyId, kind: e.kind, headline: e.headline, eventDate: new Date(`${h.fileDate}T00:00:00Z`), sourceUrl: h.form === 'D' ? filingIndexUrl(h) : filingDocUrl(h), accession: h.accessionNumber, filerName: h.companyName })
    }
  }
  const res = rows.length ? await prisma.companyEvent.createMany({ data: rows, skipDuplicates: true }) : { count: 0 }
  return { filings: hits.length, stored: res.count }
}

const dayString = (d: Date) => d.toISOString().slice(0, 10)

/** The last `days` days (weekends skipped: EDGAR has no filings), newest first. */
export async function ingestRecentSecEvents(days: number, budgetMs = 240_000): Promise<{ days: number; filings: number; stored: number }> {
  const started = Date.now()
  const index = await loadCompanyKeyIndex()
  let filings = 0, stored = 0, done = 0
  for (let i = 0; i < days; i++) {
    if (Date.now() - started > budgetMs) break
    const d = new Date(Date.now() - i * 86_400_000)
    if (d.getUTCDay() === 0 || d.getUTCDay() === 6) continue
    const r = await ingestSecEventsForDay(dayString(d), index).catch(() => ({ filings: 0, stored: 0 }))
    filings += r.filings; stored += r.stored; done++
  }
  return { days: done, filings, stored }
}

/** Events a page shows for a company, newest first, within `months`. */
export async function eventsForCompanyIds(ids: string[], months = 12, limit = 6) {
  if (ids.length === 0) return []
  return prisma.companyEvent.findMany({
    where: { companyId: { in: ids }, eventDate: { gte: new Date(Date.now() - months * 30 * 86_400_000) } },
    orderBy: { eventDate: 'desc' },
    take: limit,
    select: { id: true, kind: true, headline: true, eventDate: true, sourceUrl: true, filerName: true, companyId: true, company: { select: { name: true } } },
  })
}

/** The same, for employers known only by name (the employers hiring most in an area). */
export async function eventsForEmployerNames(names: string[], months = 6, limit = 6) {
  const keys = [...new Set(names.map((n) => normalizeOrgName(n)).filter(Boolean))]
  if (keys.length === 0) return []
  const companies = await prisma.company.findMany({ where: { canonicalNameNormalized: { in: keys } }, select: { id: true } })
  return eventsForCompanyIds(companies.map((c) => c.id), months, limit)
}

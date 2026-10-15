import 'server-only'
import { prisma } from '@/lib/prisma'
import { searchTopic, searchGoogleNews, type DiscoveredArticle } from '@/lib/news/discover'
import { matchOrCreateCompanyForEmployer } from './company-match'
import { readLayoffHeadline, readPercent, publisherKey, sameEmployer } from './news-headline'
import { alertNewLayoff } from './layoff-alert'
import { layoffTypeLabel } from './layoff-alert-rules'
import { findLayoffContacts } from './layoff-contacts-run'
import { getOrCreateCompany } from '@/lib/companies/company-lookup'
import { discoverAtsBoards } from '@/lib/market/ats-discovery'
import { singleSourceQualifies } from './news-trust'

/**
 * The searches are Bing News RSS: free, no key. What they cost is cron time,
 * so they run a few at a time under a budget, and what they find downstream is
 * already capped (contact lookups per run, primary-contact sweep per run).
 *
 * Phrased the way headlines are, so each catches shapes the others miss: a
 * share of the workforce, a headcount reduction, a restructuring, a sector, an
 * acquirer cutting the company it bought.
 */
export const QUERIES = [
  'layoffs', 'lays off employees', 'to cut jobs', 'job cuts announced', 'announces layoffs',
  'laying off', 'workforce reduction', 'reduces workforce', 'cuts staff', 'headcount reduction',
  'restructuring job cuts', 'to lay off', 'eliminates positions', 'lays off percent of staff',
  'corporate job cuts', 'cutting corporate jobs', 'plans to cut jobs', 'to eliminate jobs', 'confirms layoffs',
  'reduction in force', 'layoffs AI automation', 'AI job cuts', 'layoffs after acquisition', 'new owner layoffs', 'private equity layoffs',
  'tech layoffs', 'healthcare layoffs', 'bank layoffs', 'retail layoffs', 'startup layoffs',
  'media entertainment layoffs', 'manufacturing layoffs', 'grocery layoffs',
]
/** Searches in flight at once. */
const SEARCH_CONCURRENCY = 4
/** No new search starts after this, so the filings, SEC check, sweep and boards keep their time. */
const SEARCH_BUDGET_MS = 75_000

/** Companies searched by name per run, rotating through the CRM so each is reached every few days. */
const COMPANY_SEARCHES_PER_RUN = 12
/** How far back a by-name search reads: the "laid off in the past year" figure. */
const COMPANY_SEARCH_DAYS = 365

/** Mentions this far apart still describe the same layoff. */
const WINDOW_DAYS = 7
/** A filing or notice already on file this close covers the layoff. */
const COVERED_DAYS = 45
/** Contact lookups (one small model call each) per run, so a burst of layoffs cannot run up a bill. */
const MAX_CONTACT_LOOKUPS = 10

export interface NewsCheckResult {
  headlines: number
  mentions: number
  added: { company: string; employees: number | null; publishers: number; contacts: number; unconfirmed?: boolean }[]
  covered: number
  waiting: number
  /** Contact lookups made (one small model call each) and people found across them. */
  lookups: number
  contacts: number
}

/**
 * The daily layoff news check: read the news for layoff announcements, and
 * add a layoff to the tracker once two different publishers have reported
 * it and nothing on file already covers it.
 *
 * Two publishers is the triangulation: one headline can be wrong, mis-read,
 * or about somewhere else; two independent reports of the same company
 * cutting jobs within a week are a layoff. Something already covered — a
 * WARN filing, a layoffs.fyi row, an earlier report — within 45 days is not
 * added again; the mention is kept so the filing shows as also reported.
 *
 * Each added layoff then looks for a real named contact in its coverage
 * (see layoff-contacts-run.ts): a spokesperson, HR lead, the executive who
 * announced it, not only a CHRO.
 *
 * Added rows are announcements, not filings: no state unless the reports
 * gave one, labelled with the publisher, and listed on the Layoff notices
 * admin page where one can be dismissed if it is wrong.
 */
/**
 * One query on both news searches. Either may fail or be blocked without
 * costing the other: a source that returns nothing today must not blind the check.
 * The same story from both is two mentions of one publisher, which the
 * two-publisher rule counts once, so a second search cannot confirm a layoff alone.
 */
async function searchBoth(q: string): Promise<DiscoveredArticle[]> {
  const [bing, google] = await Promise.allSettled([searchTopic(q), searchGoogleNews(q)])
  if (bing.status === 'rejected') console.error('Bing news search failed for', q, bing.reason)
  if (google.status === 'rejected') console.error('Google news search failed for', q, google.reason)
  return [...(bing.status === 'fulfilled' ? bing.value : []), ...(google.status === 'fulfilled' ? google.value : [])]
}

/**
 * The companies to search by name this run: CRM employers and outplacement
 * leads, rotated by the clock so a run takes the next slice of the list.
 * Generic searches return a short list per query, so a mid-size company
 * (Miro's 18% cut) is crowded out; a search for its own name is not.
 */
export function sliceForRun<T>(all: T[], now = Date.now(), perRun = COMPANY_SEARCHES_PER_RUN, runMs = 3 * 3_600_000): T[] {
  if (all.length <= perRun) return all
  const start = (Math.floor(now / runMs) * perRun) % all.length
  return Array.from({ length: perRun }, (_, i) => all[(start + i) % all.length])
}

/** One company's layoff coverage over the past year, kept only when the headline is about that company. */
async function searchCompany(name: string, key: string): Promise<DiscoveredArticle[]> {
  const q = `"${name}" layoffs`
  const [bing, google] = await Promise.allSettled([searchTopic(q, { anyTime: true }), searchGoogleNews(q, { days: COMPANY_SEARCH_DAYS })])
  const all = [...(bing.status === 'fulfilled' ? bing.value : []), ...(google.status === 'fulfilled' ? google.value : [])]
  return all.filter((a) => {
    const layoff = readLayoffHeadline(a.title)
    return layoff != null && sameEmployer(layoff.companyKey, key)
  })
}

/** Contacts found for one layoff, 0 if the lookup is off, over its cap, or fails. */
async function lookUpContacts(
  company: string, employees: number | null, date: Date, orgId: string | null | undefined, urls: string[], result: NewsCheckResult,
): Promise<number> {
  if (!process.env.ANTHROPIC_API_KEY || result.lookups >= MAX_CONTACT_LOOKUPS) return 0
  result.lookups++
  try {
    const r = await findLayoffContacts({ employer: company, employees, date, orgId, urls })
    result.contacts += r.found
    return r.found
  } catch (e) {
    console.error('Layoff contact lookup failed for', company, e)
    return 0
  }
}

/** A company in a confirmed layoff story: make sure it has a Company row and look for its job board. */
async function trackJobBoard(company: string): Promise<void> {
  try {
    const row = await getOrCreateCompany(company)
    await discoverAtsBoards([row.id])
  } catch (e) {
    console.error('Job board lookup failed for', company, e)
  }
}

export async function runLayoffNewsCheck(): Promise<NewsCheckResult> {
  const result: NewsCheckResult = { headlines: 0, mentions: 0, added: [], covered: 0, waiting: 0, lookups: 0, contacts: 0 }

  // 1. Search, a few at a time under a time budget, then read the headlines
  // and keep the ones that name a layoff.
  const searched: { q: string; articles: DiscoveredArticle[] }[] = []
  const started = Date.now()
  for (let i = 0; i < QUERIES.length; i += SEARCH_CONCURRENCY) {
    if (Date.now() - started > SEARCH_BUDGET_MS) break
    const chunk = QUERIES.slice(i, i + SEARCH_CONCURRENCY)
    const settled = await Promise.all(chunk.map(async (q) => {
      try {
        return { q, articles: await searchBoth(q) }
      } catch (e) {
        console.error('Layoff news search failed for', q, e)
        return { q, articles: [] as DiscoveredArticle[] }
      }
    }))
    searched.push(...settled)
  }
  // Companies by name, so one the generic searches bury is still read.
  const orgs = await prisma.crmOrganization.findMany({
    where: { orgTypes: { hasSome: ['EMPLOYER', 'OUTPLACEMENT_LEAD'] } },
    select: { name: true, canonicalNameNormalized: true },
    orderBy: { id: 'asc' },
  }).catch((e) => { console.error('Company list for news search failed', e); return [] })
  for (const org of sliceForRun(orgs)) {
    if (Date.now() - started > SEARCH_BUDGET_MS * 1.5) break
    try {
      searched.push({ q: org.name, articles: await searchCompany(org.name, org.canonicalNameNormalized) })
    } catch (e) {
      console.error('Company layoff search failed for', org.name, e)
    }
  }
  const seen = new Set<string>()
  for (const { articles } of searched) {
    for (const a of articles) {
      if (seen.has(a.url)) continue
      seen.add(a.url)
      result.headlines++
      const layoff = readLayoffHeadline(a.title)
      if (!layoff) continue
      const created = await prisma.layoffNewsMention.upsert({
        where: { url: a.url },
        update: {},
        create: {
          companyKey: layoff.companyKey, company: layoff.company, headline: a.title.slice(0, 300),
          url: a.url, publisher: a.source, employees: layoff.employees, publishedAt: a.publishedAt,
        },
        select: { createdAt: true },
      })
      if (Date.now() - created.createdAt.getTime() < 10_000) result.mentions++
    }
  }

  // 2. Triangulate the open mentions of the last week, company by company.
  const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000)
  const open = await prisma.layoffNewsMention.findMany({
    where: { noticeId: null, OR: [{ publishedAt: { gte: since } }, { publishedAt: null, createdAt: { gte: since } }] },
    orderBy: { publishedAt: 'asc' },
  })
  const byCompany = new Map<string, typeof open>()
  for (const m of open) {
    const key = [...byCompany.keys()].find((k) => sameEmployer(k, m.companyKey)) ?? m.companyKey
    byCompany.set(key, [...(byCompany.get(key) ?? []), m])
  }

  const recent = await prisma.warnNotice.findMany({
    where: { dismissedAt: null, noticeDate: { gte: new Date(Date.now() - (COVERED_DAYS + WINDOW_DAYS) * 86_400_000) } },
    select: { id: true, normalizedEmployer: true, noticeDate: true, employees: true, promotedOrgId: true },
  })

  for (const [key, mentions] of byCompany) {
    const publishers = new Set(mentions.map((m) => publisherKey(m.publisher)).filter(Boolean))
    const first = mentions[0]
    const when = first.publishedAt ?? first.createdAt

    const covering = recent.find((n) => sameEmployer(n.normalizedEmployer, key)
      && n.noticeDate && Math.abs(n.noticeDate.getTime() - when.getTime()) <= COVERED_DAYS * 86_400_000)
    if (covering) {
      result.covered++
      // Two publishers, like an added layoff: the story is real and the
      // contact lookup is worth its call. Linking the mentions to the filing
      // marks them done, so the check does not look again tomorrow, and a
      // filing that already has reports linked was looked up on an earlier day.
      if (publishers.size >= 2) {
        const looked = (await prisma.layoffNewsMention.count({ where: { noticeId: covering.id } })) > 0
        await prisma.layoffNewsMention.updateMany({ where: { id: { in: mentions.map((m) => m.id) } }, data: { noticeId: covering.id } })
        if (!looked) await trackJobBoard(mentions[0].company)
        if (!looked) await lookUpContacts(mentions[0].company, covering.employees, when, covering.promotedOrgId, mentions.map((m) => m.url), result)
      }
      continue
    }
    // One publisher is a rumour until a second reports it, except from an
    // outlet we trust or about an organization already in the CRM: those are
    // filed marked unconfirmed, so a person sees them the day they break.
    const confirmed = publishers.size >= 2
    if (!confirmed) {
      const inCrm = (await prisma.crmOrganization.count({ where: { canonicalNameNormalized: key } })) > 0
      if (!singleSourceQualifies(first.publisher, inCrm)) {
        result.waiting++
        continue
      }
    }

    // The headcount most of the reports agree on, if any give one.
    const counts = mentions.map((m) => m.employees).filter((n): n is number => n != null)
    const tally = new Map<number, number>()
    for (const n of counts) tally.set(n, (tally.get(n) ?? 0) + 1)
    const employees = [...tally.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0]?.[0] ?? null
    // The name as most headlines wrote it.
    const names = new Map<string, number>()
    for (const m of mentions) names.set(m.company, (names.get(m.company) ?? 0) + 1)
    const company = [...names.entries()].sort((a, b) => b[1] - a[1])[0][0]

    // The share of staff, from the first headline that gives one.
    const percent = mentions.map((m) => readPercent(m.headline)).find((p) => p != null) ?? null
    // The same company match a state filing gets, so the layoff is findable by
    // company and not only by name. A failure leaves it unmatched, never blocks it.
    const match = await matchOrCreateCompanyForEmployer(company).catch(() => null)
    const notice = await prisma.warnNotice.create({
      data: {
        ...(match ? {
          companyId: match.companyId,
          companyMatchStatus: match.status,
          ...(match.candidates ? { companyMatchCandidates: match.candidates } : {}),
        } : {}),
        employer: company,
        normalizedEmployer: key,
        source: 'MANUAL_ANNOUNCEMENT',
        noticeDate: new Date(Date.UTC(when.getUTCFullYear(), when.getUTCMonth(), when.getUTCDate())),
        employees,
        layoffType: layoffTypeLabel({ publishers: publishers.size, publisher: first.publisher, percent }),
        sourceUrl: first.url,
      },
      select: { id: true },
    })
    await prisma.layoffNewsMention.updateMany({ where: { id: { in: mentions.map((m) => m.id) } }, data: { noticeId: notice.id } })
    // The rule: every layoff we add looks for a real named contact in its own
    // coverage, once, here. A failure never blocks the layoff.
    await trackJobBoard(company)
    const contacts = await lookUpContacts(company, employees, when, null, mentions.map((m) => m.url), result)
    await alertNewLayoff({
      noticeId: notice.id, employer: company, normalizedEmployer: key, employees, percent,
      kind: 'news', confirmed, sourceUrl: first.url, contactsFound: contacts,
    })
    result.added.push({ company, employees, publishers: publishers.size, contacts, ...(confirmed ? {} : { unconfirmed: true }) })
  }
  return result
}

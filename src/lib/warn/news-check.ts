import 'server-only'
import { prisma } from '@/lib/prisma'
import { searchTopic } from '@/lib/news/discover'
import { readLayoffHeadline, publisherKey, sameEmployer } from './news-headline'
import { findLayoffContacts } from './layoff-contacts-run'

const QUERIES = ['layoffs', 'lays off employees', 'to cut jobs', 'job cuts announced', 'announces layoffs']

/** Mentions this far apart still describe the same layoff. */
const WINDOW_DAYS = 7
/** A filing or notice already on file this close covers the layoff. */
const COVERED_DAYS = 45
/** Contact lookups (one small model call each) per run, so a burst of layoffs cannot run up a bill. */
const MAX_CONTACT_LOOKUPS = 10

export interface NewsCheckResult {
  headlines: number
  mentions: number
  added: { company: string; employees: number | null; publishers: number; contacts: number }[]
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

export async function runLayoffNewsCheck(): Promise<NewsCheckResult> {
  const result: NewsCheckResult = { headlines: 0, mentions: 0, added: [], covered: 0, waiting: 0, lookups: 0, contacts: 0 }

  // 1. Read the headlines, keep the ones that name a layoff.
  const seen = new Set<string>()
  for (const q of QUERIES) {
    let articles: Awaited<ReturnType<typeof searchTopic>> = []
    try {
      articles = await searchTopic(q)
    } catch (e) {
      console.error('Layoff news search failed for', q, e)
      continue
    }
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
        if (!looked) await lookUpContacts(mentions[0].company, covering.employees, when, covering.promotedOrgId, mentions.map((m) => m.url), result)
      }
      continue
    }
    if (publishers.size < 2) {
      result.waiting++
      continue
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

    const notice = await prisma.warnNotice.create({
      data: {
        employer: company,
        normalizedEmployer: key,
        source: 'MANUAL_ANNOUNCEMENT',
        noticeDate: new Date(Date.UTC(when.getUTCFullYear(), when.getUTCMonth(), when.getUTCDate())),
        employees,
        layoffType: `Reported by ${publishers.size} publishers`,
        sourceUrl: first.url,
      },
      select: { id: true },
    })
    await prisma.layoffNewsMention.updateMany({ where: { id: { in: mentions.map((m) => m.id) } }, data: { noticeId: notice.id } })
    // The rule: every layoff we add looks for a real named contact in its own
    // coverage, once, here. A failure never blocks the layoff.
    const contacts = await lookUpContacts(company, employees, when, null, mentions.map((m) => m.url), result)
    result.added.push({ company, employees, publishers: publishers.size, contacts })
  }
  return result
}

import 'server-only'
import { prisma } from '@/lib/prisma'
import { searchTopic } from '@/lib/news/discover'
import { readLayoffHeadline, publisherKey, sameEmployer } from './news-headline'

const QUERIES = ['layoffs', 'lays off employees', 'to cut jobs', 'job cuts announced', 'announces layoffs']

/** Mentions this far apart still describe the same layoff. */
const WINDOW_DAYS = 7
/** A filing or notice already on file this close covers the layoff. */
const COVERED_DAYS = 45

export interface NewsCheckResult {
  headlines: number
  mentions: number
  added: { company: string; employees: number | null; publishers: number }[]
  covered: number
  waiting: number
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
 * Added rows are announcements, not filings: no state unless the reports
 * gave one, labelled with the publisher, and listed on the Layoff notices
 * admin page where one can be dismissed if it is wrong.
 */
export async function runLayoffNewsCheck(): Promise<NewsCheckResult> {
  const result: NewsCheckResult = { headlines: 0, mentions: 0, added: [], covered: 0, waiting: 0 }

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
    select: { normalizedEmployer: true, noticeDate: true },
  })

  for (const [key, mentions] of byCompany) {
    const publishers = new Set(mentions.map((m) => publisherKey(m.publisher)).filter(Boolean))
    const first = mentions[0]
    const when = first.publishedAt ?? first.createdAt

    const covered = recent.some((n) => sameEmployer(n.normalizedEmployer, key)
      && n.noticeDate && Math.abs(n.noticeDate.getTime() - when.getTime()) <= COVERED_DAYS * 86_400_000)
    if (covered) {
      result.covered++
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
    result.added.push({ company, employees, publishers: publishers.size })
  }
  return result
}

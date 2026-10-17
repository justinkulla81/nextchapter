// How many people a company has laid off in the past year, from filings and news.
// Pure; tested in src/test/layoff-year.test.ts.
//
// A filing (WARN notice or logged announcement) is the firm number. News mentions
// add only what no filing covers: a mention linked to a notice, or dated within
// COVERED_DAYS of one, is the same layoff. The rest are grouped into one event per
// CLUSTER_DAYS and counted once at the most-reported headcount, so five outlets on
// one story are not five layoffs. News-only events are reported separately from
// filings, since one headline can be wrong.

const DAY_MS = 24 * 60 * 60 * 1000
export const YEAR_DAYS = 365
const COVERED_DAYS = 45
const CLUSTER_DAYS = 14

export interface YearNotice { noticeDate: Date; employees: number | null }
export interface YearMention {
  noticeId: string | null
  publishedAt: Date | null
  employees: number | null
  publisher: string | null
}

export interface LayoffYear {
  /** Distinct layoffs in the window: filings plus news-only events. */
  events: number
  /** People across events that state a number. */
  employees: number
  fromFilings: number
  fromNewsOnly: number
  filingEvents: number
  newsOnlyEvents: number
  /** Events (of either kind) that give no headcount, so the total is a floor. */
  unstated: number
}

export function buildLayoffYear(input: { notices: YearNotice[]; mentions: YearMention[]; now?: Date }): LayoffYear {
  const now = (input.now ?? new Date()).getTime()
  const from = now - YEAR_DAYS * DAY_MS
  const notices = input.notices.filter((n) => n.noticeDate.getTime() >= from && n.noticeDate.getTime() <= now)

  const loose = input.mentions
    .filter((m) => m.noticeId === null && m.publishedAt && m.publishedAt.getTime() >= from && m.publishedAt.getTime() <= now)
    .filter((m) => !notices.some((n) => Math.abs(n.noticeDate.getTime() - m.publishedAt!.getTime()) <= COVERED_DAYS * DAY_MS))
    .sort((a, b) => a.publishedAt!.getTime() - b.publishedAt!.getTime())

  const clusters: YearMention[][] = []
  for (const m of loose) {
    const last = clusters[clusters.length - 1]
    if (last && m.publishedAt!.getTime() - last[last.length - 1].publishedAt!.getTime() <= CLUSTER_DAYS * DAY_MS) last.push(m)
    else clusters.push([m])
  }
  const clusterCount = (c: YearMention[]): number | null => {
    const tally = new Map<number, number>()
    for (const m of c) if (m.employees != null) tally.set(m.employees, (tally.get(m.employees) ?? 0) + 1)
    return [...tally.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0]?.[0] ?? null
  }

  const filingNumbers = notices.map((n) => n.employees)
  const newsNumbers = clusters.map(clusterCount)
  const sum = (xs: (number | null)[]) => xs.reduce<number>((s, n) => s + (n ?? 0), 0)
  return {
    events: notices.length + clusters.length,
    employees: sum(filingNumbers) + sum(newsNumbers),
    fromFilings: sum(filingNumbers),
    fromNewsOnly: sum(newsNumbers),
    filingEvents: notices.length,
    newsOnlyEvents: clusters.length,
    unstated: [...filingNumbers, ...newsNumbers].filter((n) => n == null).length,
  }
}

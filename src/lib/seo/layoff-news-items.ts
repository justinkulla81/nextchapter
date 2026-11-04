// The entries of the Google News sitemap for layoffs: company pages whose newest WARN filing or announcement is from the last two days.
// Pure so the window and the merge can be tested. Notice dates are whole days (midnight UTC), so the window starts at the beginning of
// the UTC day two days ago: a notice filed "yesterday" must count all of today, not only until the same hour two days later.

const DAY_MS = 86_400_000

export interface NewsCompany {
  slug: string
  name: string
  latest: Date
  states: string[]
  notices: { workers: number | null }[]
}

export interface NewsAnnouncement {
  slug: string
  name: string
  latest: Date
  /** The newest announcement is a buyout offer rather than a layoff report. */
  buyout?: boolean
}

export interface NewsItem {
  slug: string
  title: string
  date: Date
}

export function newsWindowStart(now: number): number {
  return Math.floor(now / DAY_MS) * DAY_MS - 2 * DAY_MS
}

export function layoffNewsItems(
  companies: NewsCompany[],
  announcements: NewsAnnouncement[],
  opts: { now: number; meetsBar: (c: NewsCompany) => boolean; stateName: (code: string) => string; limit?: number },
): NewsItem[] {
  const start = newsWindowStart(opts.now)
  const inWindow = (d: Date) => d.getTime() >= start && d.getTime() <= opts.now
  const by = new Map<string, NewsItem>()
  for (const c of companies) {
    if (!inWindow(c.latest) || !opts.meetsBar(c)) continue
    const where = c.states.length === 1 ? ` in ${opts.stateName(c.states[0])}` : ''
    by.set(c.slug, { slug: c.slug, title: `${c.name} layoff notice${where}`, date: c.latest })
  }
  // An announcement page is indexable on its own (a reported layoff or buyout in the last 12 months), so it needs no filing.
  for (const a of announcements) {
    if (!inWindow(a.latest)) continue
    const prev = by.get(a.slug)
    if (prev && prev.date.getTime() >= a.latest.getTime()) continue
    by.set(a.slug, { slug: a.slug, title: `${a.name}: ${a.buyout ? 'buyout offered' : 'layoffs reported'}`, date: a.latest })
  }
  return [...by.values()].sort((a, b) => b.date.getTime() - a.date.getTime() || (a.slug < b.slug ? -1 : 1)).slice(0, opts.limit ?? 1000)
}

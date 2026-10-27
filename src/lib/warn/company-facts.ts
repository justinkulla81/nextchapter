// An employer's own filing record in a few numbers, from its notices. Pure (no database, no server-only imports), so it is tested.

const TWELVE_MONTHS = 365 * 24 * 60 * 60 * 1000

export interface FactNotice {
  noticeDate: Date
  workers: number | null
}

export function companyWarnFacts(c: { notices: FactNotice[]; states: string[] }, now = Date.now()) {
  const cutoff = now - TWELVE_MONTHS
  const recent = c.notices.filter((n) => n.noticeDate.getTime() >= cutoff)
  const month = (n: FactNotice) => n.noticeDate.toISOString().slice(0, 7)
  const sum = (ns: FactNotice[]) => ns.reduce((t, n) => t + (n.workers ?? 0), 0)
  const dates = c.notices.map((n) => n.noticeDate.getTime())
  return {
    total: c.notices.length,
    recent: recent.length,
    recentWorkers: sum(recent),
    recentUnknown: recent.filter((n) => n.workers == null).length,
    allWorkers: sum(c.notices),
    monthsWithFilings: new Set(c.notices.map(month)).size,
    recentMonthsWithFilings: new Set(recent.map(month)).size,
    states: c.states,
    first: dates.length ? new Date(Math.min(...dates)) : null,
    latest: dates.length ? new Date(Math.max(...dates)) : null,
  }
}

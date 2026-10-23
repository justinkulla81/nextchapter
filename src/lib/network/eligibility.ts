// Which employers get a /network/company page. Kept free of server-only imports so the rule is unit-testable.
//
// A page exists only where it has something of its own to say: the employer filed a WARN notice in the
// last two years and the notices name at least NETWORK_MIN_WORKERS workers. Everything else redirects to
// the layoff page, so no thin page is ever left indexed.

export const NETWORK_MIN_WORKERS = 100
/** Open professional jobs a state needs before its page can promise "jobs near you". */
export const NETWORK_MIN_STATE_JOBS = 25
const TWENTY_FOUR_MONTHS_MS = 2 * 365 * 24 * 60 * 60 * 1000

export interface EligibilityInput {
  latest: Date
  notices: { workers: number | null }[]
}

export function totalWorkers(c: EligibilityInput): number {
  return c.notices.reduce((s, n) => s + (n.workers ?? 0), 0)
}

export function isNetworkCompany(c: EligibilityInput, now = Date.now()): boolean {
  return now - c.latest.getTime() <= TWENTY_FOUR_MONTHS_MS && totalWorkers(c) >= NETWORK_MIN_WORKERS
}

/** The state with the most named workers, ties broken by notice count then code, so the choice is stable. */
export function primaryState(notices: { state: string; workers: number | null }[]): string {
  const by = new Map<string, { workers: number; n: number }>()
  for (const n of notices) {
    const s = by.get(n.state) ?? { workers: 0, n: 0 }
    s.workers += n.workers ?? 0
    s.n++
    by.set(n.state, s)
  }
  return [...by.entries()].sort((a, b) => b[1].workers - a[1].workers || b[1].n - a[1].n || a[0].localeCompare(b[0]))[0][0]
}

/** "about 1,200", never a false-precision count. */
export function aboutCount(n: number): string {
  return `about ${n.toLocaleString('en-US')}`
}

/** Page title text; the site template adds " | NextChapter", so the whole title stays under about 60 characters. */
export function networkTitle(name: string): string {
  const long = `${name} layoffs and alumni: jobs and benefits`
  return long.length <= 46 ? long : `${name} layoffs and alumni`
}

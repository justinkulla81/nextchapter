// The week's layoff numbers and the drafts built from them: a LinkedIn post, an email and a three-line pitch for a reporter.
// Pure, so the counting and the wording are tested. State WARN filings are counted apart from press reports, and a press report is
// used in the drafts only when two or more outlets carried it; the rest are listed as held back, for a person to confirm.

const DAY_MS = 86_400_000

export interface RoundupRow {
  /** The employer as the company page names it. */
  employer: string
  state: string | null
  /** 'WARN_FILING' for a state filing, 'MANUAL_ANNOUNCEMENT' for a press-reported cut. */
  source: string
  workers: number | null
  noticeDate: Date
  country: string | null
  /** The tracker's one-line description, for example "Reported by 2 publishers". */
  layoffType: string | null
}

export interface RoundupEmployer {
  employer: string
  states: string[]
  workers: number
  filings: number
}

export interface RoundupReported {
  employer: string
  workers: number
  publishers: number
}

export interface Roundup {
  from: Date
  /** Exclusive: the start of the day after the last day counted. */
  to: Date
  filings: number
  employers: number
  workers: number
  top: RoundupEmployer[]
  states: { state: string; workers: number; filings: number }[]
  reported: RoundupReported[]
  held: (RoundupReported & { reason: string })[]
}

/** The last seven whole UTC days before `now`. A Monday run covers the Monday to Sunday that just ended. */
export function roundupWindow(now: Date): { from: Date; to: Date } {
  const to = new Date(Math.floor(now.getTime() / DAY_MS) * DAY_MS)
  return { from: new Date(to.getTime() - 7 * DAY_MS), to }
}

export function publishersIn(layoffType: string | null): number {
  const m = /Reported by (\d+) publishers?/i.exec(layoffType ?? '')
  return m ? Number(m[1]) : 0
}

export function buildRoundup(rows: RoundupRow[], window: { from: Date; to: Date }): Roundup {
  const inWindow = rows.filter((r) => r.noticeDate >= window.from && r.noticeDate < window.to)
  const filed = inWindow.filter((r) => r.source === 'WARN_FILING')
  const byEmployer = new Map<string, RoundupEmployer>()
  const byState = new Map<string, { state: string; workers: number; filings: number }>()
  for (const r of filed) {
    const e = byEmployer.get(r.employer) ?? { employer: r.employer, states: [], workers: 0, filings: 0 }
    e.workers += r.workers ?? 0
    e.filings += 1
    if (r.state && !e.states.includes(r.state)) e.states.push(r.state)
    byEmployer.set(r.employer, e)
    if (r.state) {
      const s = byState.get(r.state) ?? { state: r.state, workers: 0, filings: 0 }
      s.workers += r.workers ?? 0
      s.filings += 1
      byState.set(r.state, s)
    }
  }
  const reported: RoundupReported[] = []
  const held: Roundup['held'] = []
  const seen = new Set<string>()
  for (const r of [...inWindow.filter((x) => x.source === 'MANUAL_ANNOUNCEMENT')].sort((a, b) => (b.workers ?? 0) - (a.workers ?? 0))) {
    if (r.country && r.country !== 'US') continue
    if (!r.workers || seen.has(r.employer)) continue
    seen.add(r.employer)
    const item = { employer: r.employer, workers: r.workers, publishers: publishersIn(r.layoffType) }
    if (item.publishers >= 2) reported.push(item)
    else held.push({ ...item, reason: item.publishers === 1 ? 'one outlet' : 'source count unknown' })
  }
  return {
    ...window,
    filings: filed.length,
    employers: byEmployer.size,
    workers: [...byEmployer.values()].reduce((n, e) => n + e.workers, 0),
    top: [...byEmployer.values()].sort((a, b) => b.workers - a.workers || (a.employer < b.employer ? -1 : 1)).slice(0, 6),
    states: [...byState.values()].sort((a, b) => b.workers - a.workers || (a.state < b.state ? -1 : 1)).slice(0, 5),
    reported: reported.slice(0, 5),
    held: held.slice(0, 8),
  }
}

const n = (x: number) => x.toLocaleString('en-US')
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const day = (d: Date) => `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`
const plural = (count: number, one: string, many: string) => `${n(count)} ${count === 1 ? one : many}`

/** "Oct 28 to Nov 3": the first and last day counted. */
export function windowLabel(r: Pick<Roundup, 'from' | 'to'>): string {
  return `${day(r.from)} to ${day(new Date(r.to.getTime() - DAY_MS))}`
}

export interface RoundupDrafts {
  linkedin: string
  emailSubject: string
  emailBody: string
  /** Null when no state filed anything. */
  pitch: string | null
}

/** Plain words, no "WARN" or "filings": a reader who has never heard of the law should follow every line. */
export const ROUNDUP_HASHTAGS = '#layoffs #laidoff #jobsearch #careers #hiring'

export function roundupDrafts(r: Roundup, stateName: (code: string) => string, site = 'https://launchyournextchapter.com'): RoundupDrafts {
  const when = windowLabel(r)
  const where = (e: RoundupEmployer) => (e.states.length ? ` (${e.states.map(stateName).join(', ')})` : '')
  const topLine = r.top.slice(0, 3).map((e) => `${e.employer}${where(e)}, ${n(e.workers)}`).join('; ')
  const stateLine = r.states.slice(0, 3).map((s) => `${stateName(s.state)} ${n(s.workers)}`).join(', ')
  const reportedLine = r.reported.slice(0, 3).map((e) => `${e.employer} about ${n(e.workers)}`).join('; ')
  const headline = r.filings > 0 ? `${plural(r.workers, 'person', 'people')} found out this week that they are losing their jobs (${when}).` : `No new layoff notices came in this week (${when}).`
  const filedLine = r.filings > 0 ? `${plural(r.employers, 'company', 'companies')} told their states they are laying people off: ${plural(r.filings, 'notice', 'notices')} in all.` : ''
  const ask = 'Just got laid off? Here is what to do first, by company and state:'

  const linkedin = [
    headline,
    ...(filedLine ? ['', filedLine] : []),
    ...(r.top.length ? ['', `The biggest: ${topLine}.`] : []),
    ...(r.states.length ? ['', `Where most people were hit: ${stateLine}.`] : []),
    ...(r.reported.length ? ['', `Also in the news, reported by two or more outlets: ${reportedLine}.`] : []),
    '',
    `${ask} ${site}/layoffs/this-week`,
    '',
    'Source: notices companies sent their states, plus news reports.',
    '',
    ROUNDUP_HASHTAGS,
  ].join('\n')

  const emailSubject = r.filings > 0 ? `${n(r.workers)} people lost their jobs this week` : 'Layoffs this week'
  const emailBody = [
    headline,
    ...(filedLine ? ['', filedLine] : []),
    ...(r.top.length ? ['', 'The biggest:', ...r.top.map((e) => `- ${e.employer}${where(e)}: ${n(e.workers)} people${e.filings > 1 ? ` (${e.filings} notices)` : ''}`)] : []),
    ...(r.states.length ? ['', 'Where most people were hit:', ...r.states.map((s) => `- ${stateName(s.state)}: ${n(s.workers)} people`)] : []),
    ...(r.reported.length ? ['', 'Also in the news, reported by two or more outlets:', ...r.reported.map((e) => `- ${e.employer}: about ${n(e.workers)} people`)] : []),
    '',
    `${ask} ${site}/layoffs/this-week`,
    `Every state: ${site}/layoffs/by-state`,
  ].join('\n')

  const lead = r.states[0]
  const pitch = lead
    ? `${stateName(lead.state)} led state layoff notices ${when}, with ${plural(lead.workers, 'worker', 'workers')} named across ${plural(lead.filings, 'layoff notice', 'layoff notices')}${r.states[1] ? `, followed by ${r.states.slice(1, 3).map((s) => stateName(s.state)).join(' and ')}` : ''}. We track every state WARN notice and press-reported cut, free to download and embed with a link back: ${site}/data. The underlying rows for any state are available on request.`
    : null

  return { linkedin, emailSubject, emailBody, pitch }
}

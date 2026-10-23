import type { CommunityStats } from './community-stats'

const n0 = (n: number) => n.toLocaleString('en-US')
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "Apr 26, 2026" (UTC, so the same everywhere). */
export function formatDate(d: Date): string {
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`
}

export function formatWindow(w: { from: Date; to: Date }): string {
  return `${formatDate(w.from)} to ${formatDate(w.to)}`
}

/** "Jefferson County, KY" or "Kentucky", whichever the figures are for. */
export function placePhrase(s: CommunityStats): string {
  return s.scope === 'county' && s.place.countyName ? `${s.place.countyName}, ${s.place.state}` : s.place.stateName
}

/** One factual sentence for an email, or '' when we have no figure. Never a guess. */
export function communityStatSentence(s: CommunityStats | null): string {
  const w = s?.warn
  if (!s || !w || w.notices <= 0) return ''
  const notices = `${n0(w.notices)} layoff ${w.notices === 1 ? 'notice' : 'notices'}`
  const workers = `${n0(w.workers)} ${w.workers === 1 ? 'worker' : 'workers'}`
  return `In ${placePhrase(s)}, ${notices} covering ${workers} ${w.notices === 1 ? 'was' : 'were'} filed in the last six months (state WARN filings).`
}

export interface StatCard { value: string; label: string; note: string }

/** The numbers for the page, each with the reason it is shown. Empty when there is nothing we can stand behind. */
export function communityStatCards(s: CommunityStats | null): StatCard[] {
  const w = s?.warn
  if (!s || !w || w.notices <= 0) return []
  const where = placePhrase(s)
  const fallback = s.scope === 'state' && s.place.countyName ? ` We found no notices we could place in ${s.place.countyName}, so this is the whole state.` : ''
  return [
    { value: n0(w.notices), label: `layoff ${w.notices === 1 ? 'notice' : 'notices'} in ${where}`, note: `Why it is here: employers must file a notice before a large layoff, so it shows how many people nearby may be looking for work.${fallback}` },
    { value: n0(w.workers), label: `${w.workers === 1 ? 'worker' : 'workers'} covered`, note: 'Why it is here: the headcount employers gave in those notices, counted only where a number was filed.' },
    { value: n0(w.employers), label: `${w.employers === 1 ? 'employer' : 'employers'} filing`, note: 'Why it is here: it shows whether the layoffs come from one company or many.' },
  ]
}

/** What the numbers come from and the dates they cover. */
export function sourceLine(s: CommunityStats): string {
  return `Source: ${s.source}, ${formatWindow(s.window)} (the last six months).`
}

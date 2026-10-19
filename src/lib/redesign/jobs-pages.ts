// Plain-words helpers for the redesigned Jobs pages (docs/candidate-redesign.md): every claim says why,
// no letter grades or verdict labels, positive wording. Pure, so pages and tests share them.

export interface RankingText {
  reasons: string[]
  cautions: string[]
}

/** A company row carries one reason it is on the list, and at most one thing to know. Never a bare label. */
export function companyRowText(ranking: RankingText | null | undefined): { reason: string; note: string | null } {
  const reason = ranking?.reasons[0] ?? null
  const note = ranking?.cautions[0] ?? null
  if (reason) return { reason, note }
  return {
    reason: ranking ? 'Listed so you can look at it; nothing about it stands out yet.' : 'Add your location and target industries and we will say why a company fits.',
    note,
  }
}

export interface MarketCounts {
  marketReady: boolean
  local: number | null
  remote: number
  national: number
  trendPct: number | null
  placeLabel: string | null
}

const n = (x: number) => x.toLocaleString('en-US')

/** One sentence that sizes the market and says what it rests on. Slower markets are framed as a reason to widen. */
export function marketHeadline(m: MarketCounts): { headline: string; because: string } {
  if (!m.marketReady) return { headline: 'We are counting the jobs that fit you.', because: 'Live job counts update every night. Check back tomorrow.' }
  const fits = m.local !== null ? m.local + m.remote : m.national
  const where = m.local !== null && m.placeLabel ? `in ${m.placeLabel} and remote` : 'across the country'
  const headline = `${n(fits)} ${fits === 1 ? 'job fits' : 'jobs fit'} you ${where}.`
  let because = 'Counted from the live NextChapter job board, refreshed nightly, at your level and one below.'
  if (m.trendPct !== null) {
    const pct = Math.round(Math.abs(m.trendPct) * 100)
    if (m.trendPct > 0 && pct > 0) because = `New postings are up ${pct}% on before. ${because}`
    else if (m.trendPct < 0 && pct > 0) because = `New postings are ${pct}% slower than before, so widening your search is the quickest way to more options. ${because}`
  }
  return { headline, because }
}

export interface NextStep {
  label: string
  href: string
  why: string
}

// The one thing to build next in the portfolio, in the order a recruiter looks for it, with the reason.
const PORTFOLIO_STEPS: [string, NextStep][] = [
  ['hasResume', { label: 'Upload your résumé', href: '/dashboard/resume', why: 'It is the first thing a recruiter asks for.' }],
  ['hasNarrative', { label: 'Draft your story', href: '/dashboard/marketing-plan', why: 'One story, reused in your LinkedIn, résumé and interviews.' }],
  ['hasCompletedReference', { label: 'Request a reference', href: '/dashboard/references', why: 'Someone else’s word counts for more than your own.' }],
  ['hasWorkSample', { label: 'Add a work sample', href: '/dashboard/work-samples', why: 'Real work backs up your story.' }],
  ['hasLearningBadge', { label: 'Add a credential', href: '/dashboard/learning', why: 'A course or certification shows you keep growing.' }],
  ['hasCoverLetter', { label: 'Apply to a job', href: '/dashboard/find-my-job', why: 'A cover letter is written for you with each application.' }],
  ['hasMarketRealityReport', { label: 'See your market report', href: '/dashboard/market-reality', why: 'It shows where your search stands and what to do next.' }],
  ['hasMarketRealitySnapshot', { label: 'See your weekly progress', href: '/dashboard/stats#market-reality', why: 'Weekly snapshots show the trend behind your search.' }],
]

export function nextPortfolioStep(assets: { key: string; done: boolean }[]): NextStep | null {
  const open = new Set(assets.filter((a) => !a.done).map((a) => a.key))
  return PORTFOLIO_STEPS.find(([key]) => open.has(key))?.[1] ?? null
}

/** Where the "Sharpen this" line for Why hire me sends the member: the assessment, the references, the track record, or the résumé. */
export function strengthStepHref(missing: string): string {
  if (/How I Perform/.test(missing)) return '/dashboard/how-i-perform'
  if (/reference/i.test(missing)) return '/dashboard/references'
  if (/Track Record/.test(missing)) return '/dashboard/track-record'
  return '/dashboard/resume'
}

/** Counts a short list for the first view, with how many are tucked behind "Show more". */
export function splitFirstView<T>(items: T[], first: number): { shown: T[]; rest: T[] } {
  return { shown: items.slice(0, first), rest: items.slice(first) }
}

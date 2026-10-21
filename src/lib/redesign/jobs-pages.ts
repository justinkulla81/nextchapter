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

/** 245k for 245000, 950 for 950, with a dollar sign. */
export function shortMoney(n: number): string {
  return n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${n}`
}

export interface PayPositionInput {
  pay: number
  /** Share of advertised salaries below the member's pay, 0 to 1. */
  shareBelow: number | null
  role: string
  place: string | null
  p25: number | null
  p50: number | null
  p75: number | null
}

/** One headline for where the member's pay sits, and why it can be trusted only so far. Says "estimate" in words, not as a tag. */
export function payPositionText(i: PayPositionInput): { headline: string; because: string } {
  const where = i.place ?? 'the US'
  const pct = i.shareBelow === null ? null : Math.round(i.shareBelow * 100)
  const headline =
    pct === null
      ? `Your pay of ${shortMoney(i.pay)} sits among advertised salaries for ${i.role} in ${where}.`
      : `Your pay of ${shortMoney(i.pay)} is above about ${pct}% of advertised salaries for ${i.role} in ${where}.`
  const range = i.p25 !== null && i.p50 !== null && i.p75 !== null ? `The middle half runs ${shortMoney(i.p25)} to ${shortMoney(i.p75)}, around ${shortMoney(i.p50)} in the middle. ` : ''
  return { headline, because: `${range}This is an estimate from advertised pay, which is not what people are paid, so use it to start the conversation, not to end it.` }
}

/** What a member reads about their Offer Bonus claim: a plain heading and what happens next. No emoji, no promises beyond what we do. */
export function offerClaimStatusText(status: string): { heading: string; body: string } {
  switch (status) {
    case 'PENDING':
      return { heading: 'We are reviewing your claim', body: 'We have your offer letter and details. We will follow up once it is reviewed, usually within a few days.' }
    case 'APPROVED':
      return { heading: 'Your Offer Bonus is approved', body: 'Congratulations. We will send the $500 to the payment method you gave us.' }
    case 'REJECTED':
      return { heading: 'Your claim needs another look', body: 'This claim was not approved as submitted. Contact support if you think that is a mistake.' }
    default:
      return { heading: 'Your claim is in', body: 'We will follow up by email.' }
  }
}

export interface HiringSignalInput {
  openRolesTotal: number
  openRolesDirectorPlus: number
  rolesDelta12wk: number
  trajectory: string
  medianPostingAgeDays: number | null
  topFunctions: string[]
}

/** The company hiring signal as one verdict, the fact it rests on, and at most two follow-up lines. Never says anything about layoffs: posting activity only. */
export function hiringSignalText(s: HiringSignalInput): { headline: string; because: string; facts: string[] } {
  const headline = s.trajectory === 'growing' ? 'Hiring more than it was.' : s.trajectory === 'contracting' ? 'Hiring less than it was.' : 'Hiring at about the same pace.'
  const past = s.openRolesTotal - s.rolesDelta12wk
  const pct = past > 0 ? Math.round((s.rolesDelta12wk / past) * 100) : null
  const roles = `${s.openRolesTotal} open ${s.openRolesTotal === 1 ? 'role' : 'roles'}${s.openRolesDirectorPlus > 0 ? `, ${s.openRolesDirectorPlus} at director level and above` : ''}`
  const change = pct === null || pct === 0 ? '' : `, ${pct > 0 ? 'up' : 'down'} ${Math.abs(pct)}% in 12 weeks`
  const facts: string[] = []
  if (s.topFunctions.length > 0) facts.push(`Hiring most in ${s.topFunctions.slice(0, 3).join(', ')}.`)
  if (s.medianPostingAgeDays !== null) {
    facts.push(
      s.medianPostingAgeDays >= 90
        ? `Roles stay open a median ${s.medianPostingAgeDays} days. That can mean a slow process, not a bad one, so it is worth asking about.`
        : `Roles stay open a median ${s.medianPostingAgeDays} days.`
    )
  }
  return { headline, because: `${roles}${change}. Based on posting activity only, not layoff filings.`, facts: facts.slice(0, 2) }
}

export interface PortfolioAssetCounts {
  resumeName: string | null
  resumeVersions: number
  coverLetters: number
  narratives: number
  workSamples: number
  completedReferences: number
  credentials: number
}

export interface PortfolioAssetRow {
  key: string
  title: string
  /** Where this asset stands, in a plain sentence. */
  status: string
  /** Why it is worth having. Shown only while it is missing, so a finished row stays short. */
  why: string | null
  done: boolean
  actionLabel: string
  href: string
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** The six things a member can hand a recruiter, each with where it stands and the one action that moves it. */
export function portfolioAssetRows(c: PortfolioAssetCounts): PortfolioAssetRow[] {
  return [
    {
      key: 'resume',
      title: 'Résumé',
      status: c.resumeName ? `${c.resumeName}${c.resumeVersions > 1 ? `, ${plural(c.resumeVersions, 'version', 'versions')}` : ''}` : 'Not uploaded yet.',
      why: c.resumeName ? null : 'It is the first thing a recruiter asks for.',
      done: !!c.resumeName,
      actionLabel: c.resumeName ? 'View versions' : 'Upload your résumé',
      href: '/dashboard/resume',
    },
    {
      key: 'story',
      title: 'Your story',
      status: c.narratives > 0 ? `${plural(c.narratives, 'story', 'stories')} drafted, adapted for LinkedIn, résumés and interviews.` : 'Not drafted yet.',
      why: c.narratives > 0 ? null : 'One story, reused in your LinkedIn, résumé and interviews.',
      done: c.narratives > 0,
      actionLabel: c.narratives > 0 ? 'Manage' : 'Draft your story',
      href: '/dashboard/marketing-plan',
    },
    {
      key: 'references',
      title: 'References',
      status: c.completedReferences > 0 ? `${c.completedReferences} of 3 completed.` : 'None received yet.',
      why: c.completedReferences > 0 ? null : 'Someone else’s word counts for more than your own.',
      done: c.completedReferences > 0,
      actionLabel: c.completedReferences > 0 ? 'View' : 'Request a reference',
      href: '/dashboard/references',
    },
    {
      key: 'samples',
      title: 'Work samples',
      status: c.workSamples > 0 ? `${plural(c.workSamples, 'sample', 'samples')} uploaded.` : 'None added yet.',
      why: c.workSamples > 0 ? null : 'Real work backs up your story.',
      done: c.workSamples > 0,
      actionLabel: c.workSamples > 0 ? 'View' : 'Add a sample',
      href: '/dashboard/work-samples',
    },
    {
      key: 'credentials',
      title: 'Credentials',
      status: c.credentials > 0 ? `${plural(c.credentials, 'credential', 'credentials')} logged.` : 'None logged yet.',
      why: c.credentials > 0 ? null : 'A course or certification shows you keep growing.',
      done: c.credentials > 0,
      actionLabel: c.credentials > 0 ? 'View' : 'Add a credential',
      href: '/dashboard/learning',
    },
    {
      key: 'cover',
      title: 'Cover letters',
      status: c.coverLetters > 0 ? `${plural(c.coverLetters, 'letter', 'letters')} written, one per job you applied to.` : 'None yet.',
      why: c.coverLetters > 0 ? null : 'One is written for you with each application.',
      done: c.coverLetters > 0,
      actionLabel: c.coverLetters > 0 ? 'View' : 'Apply to a job',
      href: '/dashboard/find-my-job',
    },
  ]
}

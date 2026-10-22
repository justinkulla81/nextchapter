// Find a job, two panes (docs/candidate-redesign.md, "Job row"): the list says, for each job, a title, the
// company, ONE verdict with its ONE reason, and ONE fact. The detail beside it says why it fits, what to do
// next, and has one primary action. Everything here is pure and client-safe so the page, the components and
// the tests share it (src/test/find-list.test.ts). It reads results that scoring has already produced; it
// never scores or ranks anything itself.

import { CARD_VERDICT_LABEL, type CardVerdict } from '@/lib/jobs/job-card'
import { MATCH_DIMENSION_LABEL, MATCH_DIMENSION_ORDER, type JobMatch, type MatchDimensionKey } from '@/lib/jobs/job-match-types'
import { POSTING_SIGNAL_TAG, type PostingSignal } from '@/lib/jobs/posting-signals'
import type { OccupationExposure } from '@/lib/skills/ai-exposure'

export interface JobListItem {
  /** The id the URL (`?job=`) and PostHog carry: the board posting id, or the partner-search job id. */
  id: string
  kind: 'board' | 'surfaced'
  title: string
  /** 'Confidential search' for a confidential posting: the employer is never named. */
  company: string
  /** "New York, NY" / "Remote"; null when the listing gives none. */
  place: string | null
  verdict: CardVerdict | null
  verdictLabel: string | null
  /** One short sentence saying why the verdict is what it is. */
  reason: string
  /** The single fact that matters most for this job right now. */
  fact: string | null
  /** When the fact is a posting-signal tag ("Open to career changers"), which one — the row shows it as the tag. */
  signal?: PostingSignal | null
  /** AI exposure of the occupation this opening is placed in; null when it is not placed or not measured. The row shows it on its facts line. */
  exposure?: OccupationExposure | null
  /** The job's open page, used when the detail cannot render. */
  href: string
}

const sentence = (s: string) => (s ? `${s.charAt(0).toUpperCase()}${s.slice(1)}${/[.!?]$/.test(s) ? '' : '.'}` : s)

export const NO_REASON_YET = 'Matches your search. Answer a few more questions to see why.'

/**
 * The one-line reason behind a verdict, from the "why this job" read (personalization/why-this-job.ts).
 * A strong or good fit says what fits; a "Worth a look" job leads with its gap, because that is what
 * keeps it from being a better fit. Never a bare verdict: with nothing specific to say it says so.
 */
export function reasonLine(why: { fits: string[]; gap: string | null } | null | undefined, verdict: CardVerdict | null): string {
  const fits = (why?.fits ?? []).filter(Boolean)
  const gap = why?.gap?.trim() || null
  const fitText = fits.length > 0 ? `Fits you: ${fits.join(' · ')}` : null
  if (verdict === 'worth_a_look') {
    if (gap && fitText) return `${sentence(gap)} ${sentence(fitText)}`
    if (gap) return sentence(gap)
  }
  if (fitText && gap) return `${sentence(fitText)} One gap: ${gap.replace(/\.$/, '')}.`
  if (fitText) return sentence(fitText)
  if (gap) return sentence(gap)
  return NO_REASON_YET
}

/**
 * The one fact on a row: when the estimate says fewer people will apply, that, with the facts it rests on
 * (a competition claim is never a bare tag); otherwise when it was posted; otherwise the pay or work type.
 */
export function oneFact(input: {
  posted: string | null
  fewerApplicants?: { label: string; because: string } | null
  pay?: string | null
  extra?: string[]
  /**
   * The job's posting-signal tag (posting-signals.ts). It takes the fact's place from the posted date
   * (still shown in the open job), and from the fewer-applicants claim too when `signalFirst`.
   */
  signal?: PostingSignal | null
  signalFirst?: boolean
}): string | null {
  const { fewerApplicants, posted, pay, signal } = input
  if (signal && input.signalFirst) return POSTING_SIGNAL_TAG[signal]
  if (fewerApplicants) return `${fewerApplicants.label}: ${fewerApplicants.because.charAt(0).toLowerCase()}${fewerApplicants.because.slice(1)}`
  if (signal) return POSTING_SIGNAL_TAG[signal]
  if (posted) return posted
  if (pay) return pay
  return input.extra?.[0] ?? null
}

export function listItemOf(input: {
  id: string
  kind: JobListItem['kind']
  title: string
  companyName: string | null
  confidential?: boolean
  place: string | null
  verdict: CardVerdict | null
  why: { fits: string[]; gap: string | null } | null | undefined
  fact: string | null
  signal?: PostingSignal | null
  exposure?: OccupationExposure | null
}): JobListItem {
  return {
    id: input.id,
    kind: input.kind,
    title: input.title,
    company: input.confidential ? 'Confidential search' : (input.companyName ?? 'Company not listed'),
    place: input.place?.trim() || null,
    verdict: input.verdict,
    verdictLabel: input.verdict ? CARD_VERDICT_LABEL[input.verdict] : null,
    reason: reasonLine(input.why, input.verdict),
    fact: input.fact,
    signal: input.signal && input.fact === POSTING_SIGNAL_TAG[input.signal] ? input.signal : null,
    exposure: input.exposure ?? null,
    href: input.kind === 'board' ? `/dashboard/jobs/${input.id}?src=board` : '/dashboard/find-my-job',
  }
}

// ── Which job is open ────────────────────────────────────────────────────────

/**
 * The job shown in the detail pane. The URL's `?job=` wins when it is one of the listed jobs. Without it, a
 * wide screen opens the first job (the detail pane is always visible there), and a phone shows the list.
 */
export function selectedJobId(items: Pick<JobListItem, 'id'>[], param: string | null | undefined, wide: boolean): string | null {
  if (param && items.some((i) => i.id === param)) return param
  return wide && items.length > 0 ? items[0].id : null
}

/** Rows shown before "Show 10 more", and the step. */
export const LIST_PAGE_SIZE = 10

/** How many rows to render: a page at a time, and always enough to include the open job. */
export function visibleCount(items: Pick<JobListItem, 'id'>[], pages: number, openId: string | null): number {
  const base = Math.min(items.length, Math.max(1, pages) * LIST_PAGE_SIZE)
  const at = openId ? items.findIndex((i) => i.id === openId) : -1
  return at >= base ? at + 1 : base
}

// ── Why it fits ──────────────────────────────────────────────────────────────

export interface FitFactor {
  state: 'match' | 'gap'
  label: string
  note: string
}

const MAX_MATCHES = 3

/**
 * The factors under "Why this fits you": up to three things that line up, then the single most important
 * gap, each with the plain reason the scorer gave. A dimension we know nothing about is left out rather
 * than shown as a question mark (the Improve your search strip is where unknowns get answered).
 */
export function fitFactors(match: JobMatch | undefined): FitFactor[] {
  if (!match) return []
  const matches: FitFactor[] = []
  let gap: FitFactor | null = null
  for (const key of MATCH_DIMENSION_ORDER as MatchDimensionKey[]) {
    const d = match.dimensions[key]
    const note = d.evidence[0]
    if (!note) continue
    if ((d.status === 'strong' || d.status === 'partial') && matches.length < MAX_MATCHES) matches.push({ state: 'match', label: MATCH_DIMENSION_LABEL[key], note })
    else if (d.status === 'gap' && !gap) gap = { state: 'gap', label: 'One gap', note: `${MATCH_DIMENSION_LABEL[key]}: ${note}` }
  }
  return gap ? [...matches, gap] : matches
}

// ── What to do next ──────────────────────────────────────────────────────────

export interface NextStep {
  kind: 'check_requirement' | 'ask_contact' | 'apply_early' | 'apply'
  /** The step, as an instruction. */
  text: string
  /** Why this step: every claim says why. */
  because: string
}

/**
 * The one step to take before or with the application, in this order: a requirement the member does not
 * meet (checking it saves an application), someone they know there (an introduction beats a cold
 * application), a fresh posting (early applicants get most of the interviews), then just applying.
 */
export function nextStepFor(input: {
  blocker?: string | null
  contactName?: string | null
  insiderCount?: number
  fresh?: boolean
  past?: boolean
}): NextStep | null {
  if (input.past) return null
  if (input.blocker) return { kind: 'check_requirement', text: `Check this first: ${input.blocker}.`, because: 'The posting states it as a requirement, and your answers say you may not meet it.' }
  if (input.contactName) return { kind: 'ask_contact', text: `Ask ${input.contactName} for an introduction before you apply.`, because: 'You know them, and they work or worked at this employer.' }
  if ((input.insiderCount ?? 0) > 0) {
    const n = input.insiderCount!
    return { kind: 'ask_contact', text: `Ask a member who worked there (${n} ${n === 1 ? 'person' : 'people'}) what it is like.`, because: 'Members who worked at this company can tell you what the posting does not.' }
  }
  if (input.fresh) return { kind: 'apply_early', text: 'Apply now.', because: 'It was posted in the last 72 hours, and early applicants get most of the interviews.' }
  return { kind: 'apply', text: 'Apply, then mark it applied so it shows in My jobs.', because: 'We follow up with you when it has been a week with no reply.' }
}

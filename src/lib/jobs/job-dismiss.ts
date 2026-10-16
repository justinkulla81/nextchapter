// Passing on a board job with a reason, and what the board learns from it. Pure (no I/O),
// unit-tested in src/test/job-dismiss.test.ts; loading and saving live in
// job-dismiss-server.ts and src/app/dashboard/find-my-job/dismiss-actions.ts.
//
// Owner's rules (2026-10-16):
//   company   → that company is hidden at once (with an undo);
//   industry, title, level, location → similar jobs move down; after DISMISS_ASK_AFTER
//               dismissals the board asks "Hide all X?";
//   pay       → a pay floor: posted pay below it is hidden;
//   ghost / too good to be true → a member flag that feeds ghost risk and the admin list;
//   red flags → recorded for admin review.
// Everything is undoable; nothing is deleted.

import { normalizeOrgName } from '@/lib/text/org-name-match'
import { statesFromLocation } from '@/lib/pay/market-pay'
import { stageOfRung, type CareerStage } from '@/lib/jobs/career-stage'
import { annualPayForSort } from '@/lib/jobs/board-search'

export const DISMISS_REASONS = [
  { key: 'company', label: 'Company' },
  { key: 'industry', label: 'Industry' },
  { key: 'skills', label: "Skills don't fit" },
  { key: 'title', label: 'Title' },
  { key: 'level', label: 'Level' },
  { key: 'pay', label: 'Pay' },
  { key: 'location', label: 'Location' },
  { key: 'ghost', label: 'Think it’s a ghost job' },
  { key: 'too_good', label: 'Too good to be true' },
  { key: 'red_flags', label: 'Red flags' },
  { key: 'applied_elsewhere', label: 'Already applied elsewhere' },
  { key: 'other', label: 'Other' },
] as const
export type DismissReason = (typeof DISMISS_REASONS)[number]['key']
const REASON_KEYS = new Set<string>(DISMISS_REASONS.map((r) => r.key))

export function parseDismissReasons(raw: unknown): DismissReason[] {
  if (!Array.isArray(raw)) return []
  return [...new Set(raw.filter((r): r is DismissReason => typeof r === 'string' && REASON_KEYS.has(r)))]
}

/** Reasons that become a member flag on the posting (JobPostingFlag). */
export const FLAG_REASONS: DismissReason[] = ['ghost', 'too_good', 'red_flags']

export type PreferenceKind = 'company' | 'industry' | 'title' | 'level' | 'location' | 'pay_floor'
export type PreferenceAction = 'hide' | 'downweight' | 'floor'

/** After this many dismissals for the same industry / title / level / location, ask "Hide all X?". */
export const DISMISS_ASK_AFTER = 2

const STAGE_LABEL: Record<CareerStage, string> = {
  ENTRY: 'entry-level',
  EARLY: 'early-career',
  MID: 'mid-level',
  SENIOR_IC_MGR: 'manager and senior',
  SENIOR_MANAGER: 'senior manager',
  DIRECTOR: 'director',
  VP: 'VP',
  EXECUTIVE: 'executive',
}

/** "Senior Project Manager II (Remote)" → "project manager": the kind of job, without level words. */
export function titleCore(title: string): string {
  return title
    .toLowerCase()
    .replace(/\(.*?\)|\[.*?\]/g, ' ')
    .split(/\s[-–—|]\s|,/)[0]
    .replace(/\b(senior|sr|junior|jr|lead|principal|staff|associate|assistant|head|chief|executive|interim|global|regional|i{1,3}|iv|v|\d+)\b\.?/g, ' ')
    .replace(/[^a-z& ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** What a dismissed job says for each learnable reason: the preference key and its label. */
export interface DismissedJobFacts {
  companyName: string | null
  title: string
  level: string | null
  location: string | null
  /** Industry bucket (industry-buckets.ts), when known. */
  industry: string | null
  salaryMin: number | null
  salaryMax: number | null
}

export interface PreferenceChange {
  kind: PreferenceKind
  value: string
  label: string
  /** company: 'hide' at once; pay: 'floor'; the rest count up as 'downweight'. */
  action: PreferenceAction
}

/** The preferences one dismissal teaches, from its reasons. */
export function preferenceChanges(reasons: DismissReason[], job: DismissedJobFacts): PreferenceChange[] {
  const out: PreferenceChange[] = []
  for (const r of reasons) {
    if (r === 'company' && job.companyName) {
      const value = normalizeOrgName(job.companyName)
      if (value) out.push({ kind: 'company', value, label: job.companyName.trim(), action: 'hide' })
    } else if (r === 'industry' && job.industry) {
      out.push({ kind: 'industry', value: job.industry, label: `${job.industry} jobs`, action: 'downweight' })
    } else if (r === 'title') {
      const core = titleCore(job.title)
      if (core) out.push({ kind: 'title', value: core, label: `${core} roles`, action: 'downweight' })
    } else if (r === 'level') {
      const stage = stageOfRung(job.level)
      if (stage) out.push({ kind: 'level', value: stage, label: `${STAGE_LABEL[stage]} roles`, action: 'downweight' })
    } else if (r === 'location') {
      const { states, isRemote } = statesFromLocation(job.location)
      if (states.length > 0) out.push({ kind: 'location', value: states[0], label: `jobs in ${states[0]}`, action: 'downweight' })
      else if (isRemote) out.push({ kind: 'location', value: 'remote', label: 'remote jobs', action: 'downweight' })
    } else if (r === 'pay') {
      const pay = annualPayForSort(job.salaryMin, job.salaryMax)
      // Only a posted, plausible annual figure teaches a floor.
      if (pay && pay >= 20_000 && pay <= 2_000_000) {
        const floor = Math.round(pay / 1000) * 1000 + 1000
        out.push({ kind: 'pay_floor', value: String(floor), label: `posted pay under $${Math.round(floor / 1000)}k`, action: 'floor' })
      }
    }
  }
  return out
}

export interface ActivePreference {
  id: string
  kind: PreferenceKind
  value: string
  label: string
  count: number
  action: PreferenceAction
  askedAt: Date | null
}

/** Ask "Hide all X?" for a downweighted preference seen DISMISS_ASK_AFTER times and not asked in the last 2 weeks. */
export function shouldAskToHide(p: ActivePreference, now = new Date()): boolean {
  return p.action === 'downweight' && p.count >= DISMISS_ASK_AFTER && (!p.askedAt || now.getTime() - p.askedAt.getTime() > 14 * 86_400_000)
}

/** What the board needs to apply dismissals to a light row. */
export interface DismissRow {
  id: string
  companyName: string
  title: string
  level: string | null
  location: string | null
  salaryMin: number | null
  salaryMax: number | null
}

export interface DismissRules {
  /** Leave the job off the board and out of emails. */
  hidden: (p: DismissRow) => boolean
  /** Rank penalty: one per downweighted preference the job matches. */
  penalty: (p: DismissRow) => number
  /** The member's active preferences (for "Because you passed on …" and the review list). */
  preferences: ActivePreference[]
  /** Board job ids they passed on. */
  dismissedIds: ReadonlySet<string>
}

/**
 * The rules for one member. industryOf: a job's industry bucket (board-wide map);
 * flaggedGhost: jobs enough members flagged as ghosts / too good (ghost-risk.ts), hidden for everyone.
 */
export function buildDismissRules(input: {
  preferences: ActivePreference[]
  dismissedIds: Iterable<string>
  industryOf: (id: string) => string | undefined
  flaggedGhost?: (id: string) => boolean
}): DismissRules {
  const dismissedIds = new Set(input.dismissedIds)
  const by = (kind: PreferenceKind, action: PreferenceAction) =>
    new Set(input.preferences.filter((p) => p.kind === kind && p.action === action).map((p) => p.value))
  const hideCompany = by('company', 'hide')
  const kinds: ('industry' | 'title' | 'level' | 'location')[] = ['industry', 'title', 'level', 'location']
  const hide = Object.fromEntries(kinds.map((k) => [k, by(k, 'hide')])) as Record<(typeof kinds)[number], Set<string>>
  const down = Object.fromEntries(kinds.map((k) => [k, by(k, 'downweight')])) as Record<(typeof kinds)[number], Set<string>>
  const floors = input.preferences.filter((p) => p.kind === 'pay_floor').map((p) => Number(p.value)).filter((n) => Number.isFinite(n))
  const floor = floors.length > 0 ? Math.max(...floors) : null
  const anyTitle = hide.title.size + down.title.size > 0
  const anyLocation = hide.location.size + down.location.size > 0

  const valuesOf = (p: DismissRow) => {
    const loc = anyLocation ? statesFromLocation(p.location) : null
    return {
      industry: input.industryOf(p.id),
      title: anyTitle ? titleCore(p.title) : undefined,
      level: stageOfRung(p.level) ?? undefined,
      location: loc ? (loc.states.length > 0 ? loc.states : loc.isRemote ? ['remote'] : []) : [],
    }
  }
  const matches = (sets: Record<(typeof kinds)[number], Set<string>>, p: DismissRow) => {
    const v = valuesOf(p)
    let n = 0
    if (v.industry && sets.industry.has(v.industry)) n++
    if (v.title && sets.title.has(v.title)) n++
    if (v.level && sets.level.has(v.level)) n++
    if (v.location.some((s) => sets.location.has(s))) n++
    return n
  }
  const anyHide = kinds.some((k) => hide[k].size > 0)
  const anyDown = kinds.some((k) => down[k].size > 0)
  return {
    preferences: input.preferences,
    dismissedIds,
    hidden: (p) => {
      if (dismissedIds.has(p.id)) return true
      if (input.flaggedGhost?.(p.id)) return true
      if (hideCompany.size > 0 && hideCompany.has(normalizeOrgName(p.companyName))) return true
      if (floor !== null) {
        const pay = annualPayForSort(p.salaryMin, p.salaryMax)
        if (pay !== null && pay < floor) return true
      }
      return anyHide && matches(hide, p) > 0
    },
    penalty: (p) => (anyDown ? matches(down, p) : 0),
  }
}

/** "Because you passed on …": the active preferences, most specific first, as one plain sentence. Null when none. */
export function becauseLine(preferences: ActivePreference[]): string | null {
  const parts = preferences.map((p) => {
    if (p.kind === 'company') return `hid ${p.label}`
    if (p.kind === 'pay_floor') return `hid ${p.label}`
    return p.action === 'hide' ? `hid ${p.label}` : `moved ${p.label} down`
  })
  if (parts.length === 0) return null
  const shown = parts.slice(0, 3)
  const more = parts.length - shown.length
  return `Because you passed on some jobs, we ${shown.join(', ')}${more > 0 ? ` and ${more} more` : ''}.`
}

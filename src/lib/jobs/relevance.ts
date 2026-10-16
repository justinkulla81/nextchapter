// What "relevant" means for a member (owner's rule, 2026-10-16): a job counts only when it
// matches ALL of these, not any one —
//   seniority  inside their career-stage window (the board's level window, career-stage.ts);
//   function   their sub-function, or an occupation that is theirs or near-identical — a bare
//              broad function ("Operations") is not enough;
//   geography  within commuting distance of home, remote when they take remote, or a place
//              they said they'd move to;
//   skills     a real overlap between the job's skills (or occupation) and their skills matrix;
//   industry   their current or target industries count; outside them a job must fit strongly.
// Wide relaxes ONE of industry, function (to an adjacent one) or the skills bar at a time,
// never several, and each such job carries a bridge (what transfers, what's missing, how to
// close it). On top, market tiers raise the fit bar when even the strict set is large.
// Pure (no I/O): unit-tested in src/test/relevance.test.ts.

import { statesFromLocation } from '@/lib/pay/market-pay'

// ── Criteria ───────────────────────────────────────────────────────────────────

export type FunctionMatch = 'own' | 'adjacent' | 'none'
export type SkillsMatch = 'strong' | 'weak' | 'none' | 'unknown'

export interface JobCriteria {
  fn: FunctionMatch
  geo: boolean
  skills: SkillsMatch
  /** In one of their industries (true when they have none on file). */
  industry: boolean
}

/** The one criterion Wide relaxed to let a job in; null = relevant on every criterion. */
export type Relaxed = 'industry' | 'function' | 'skills'

/** Wide relaxes in this order, one at a time. */
export const RELAX_ORDER: Relaxed[] = ['industry', 'function', 'skills']

const skillsPass = (s: SkillsMatch) => s === 'strong' || s === 'unknown'

/** Relevant on every criterion except industry (which, when missing, needs a strong fit — decided once fit is known). */
export function relevantBeforeFit(c: JobCriteria): boolean {
  return c.fn === 'own' && c.geo && skillsPass(c.skills)
}

/**
 * The single criterion a job misses that Wide may relax, or null when it misses none
 * (relevant) or more than one / one Wide never relaxes (geography, seniority).
 */
export function relaxedCriterion(c: JobCriteria): Relaxed | null | 'out' {
  if (!c.geo) return 'out'
  const misses: Relaxed[] = []
  if (!c.industry) misses.push('industry')
  if (c.fn === 'adjacent') misses.push('function')
  else if (c.fn === 'none') return 'out'
  if (c.skills === 'weak') misses.push('skills')
  else if (c.skills === 'none') return 'out'
  if (misses.length === 0) return null
  return misses.length === 1 ? misses[0] : 'out'
}

// ── Skills ─────────────────────────────────────────────────────────────────────

/** A posting's skills the member shows: at least this many, and this share of what it asks. */
export const SKILLS_STRONG_MIN = 2
export const SKILLS_STRONG_SHARE = 0.25
/** Fewer skills than this in the member's matrix: the criterion can't be applied (reported as unknown). */
export const MEMBER_SKILLS_MIN = 3
/**
 * Fewer vocabulary skills than this (postings' skills come from a fixed ~150-term vocabulary,
 * skills-extraction.ts, so many members show only a handful of them): one shared skill is
 * enough, and none proves nothing — the posting's skills can't show a mismatch.
 */
export const MEMBER_SKILLS_FULL = 8

/**
 * Posting skills first (concrete); with none, the member's skills fit to the job's occupation
 * (O*NET, careers/skills-fit.ts bands). Unknown when neither says.
 */
export function skillsMatch(input: { jobSkills: readonly string[]; memberVocab: ReadonlySet<string>; occupationBand?: 'close' | 'good' | 'partial' | 'few' | null }): SkillsMatch {
  if (input.memberVocab.size < MEMBER_SKILLS_MIN) return 'unknown'
  if (input.jobSkills.length > 0) {
    let n = 0
    for (const s of input.jobSkills) if (input.memberVocab.has(s.toLowerCase())) n++
    if (input.memberVocab.size < MEMBER_SKILLS_FULL) return n >= 1 ? 'strong' : input.occupationBand ? bandMatch(input.occupationBand) : 'unknown'
    if (n >= SKILLS_STRONG_MIN && n / input.jobSkills.length >= SKILLS_STRONG_SHARE) return 'strong'
    return n >= 1 ? 'weak' : 'none'
  }
  return input.occupationBand ? bandMatch(input.occupationBand) : 'unknown'
}

function bandMatch(band: 'close' | 'good' | 'partial' | 'few'): SkillsMatch {
  return band === 'close' || band === 'good' ? 'strong' : band === 'partial' ? 'weak' : 'none'
}

// ── Geography ──────────────────────────────────────────────────────────────────

/** Commuting distance from home (miles), for "within commute". Tune here. */
export const COMMUTE_MILES = 40

/** Regions people write in relocation notes, to the states they mean. */
const REGIONS: [RegExp, string[]][] = [
  [/pacific northwest|\bpnw\b/, ['WA', 'OR', 'ID']],
  [/new england/, ['MA', 'CT', 'RI', 'NH', 'VT', 'ME']],
  [/mid-?atlantic/, ['NY', 'NJ', 'PA', 'DE', 'MD', 'DC', 'VA']],
  [/southeast/, ['FL', 'GA', 'NC', 'SC', 'TN', 'AL']],
  [/southwest/, ['AZ', 'NM', 'NV', 'TX']],
  [/midwest/, ['IL', 'IN', 'MI', 'OH', 'WI', 'MN', 'IA', 'MO']],
  [/mountain west|rockies/, ['CO', 'UT', 'MT', 'WY', 'ID']],
  [/west coast/, ['CA', 'OR', 'WA']],
  [/east coast/, ['ME', 'NH', 'MA', 'RI', 'CT', 'NY', 'NJ', 'PA', 'DE', 'MD', 'DC', 'VA', 'NC', 'SC', 'GA', 'FL']],
]

/** States a relocation note names, directly or as a region ("Pacific Northwest only" → WA, OR, ID). */
export function relocationStates(notes: string | null | undefined): string[] {
  if (!notes?.trim()) return []
  const lower = notes.toLowerCase()
  const out = new Set(statesFromLocation(notes).states)
  for (const [re, states] of REGIONS) if (re.test(lower)) for (const s of states) out.add(s)
  return [...out]
}

export interface MemberGeo {
  /** Home's commute area, as Census place keys (state|place), when we know their city. */
  homeArea: ReadonlySet<string> | null
  /** Their home state, when that's all we know. */
  homeState: string | null
  acceptsRemote: boolean
  /** States they'd move to (openToRelocation + their notes). */
  relocation: ReadonlySet<string>
  /** Nothing to go on (no home, onsite only): the criterion isn't applied. */
  unknown: boolean
}

export function memberGeo(m: {
  homeArea: ReadonlySet<string> | null
  currentState?: string | null
  remotePreference?: string | null
  openToRelocation?: boolean | null
  relocationNotes?: string | null
}): MemberGeo {
  const state = m.currentState?.trim().toUpperCase()
  const homeState = state && /^[A-Z]{2}$/.test(state) ? state : null
  const acceptsRemote = (m.remotePreference ?? '').toLowerCase() !== 'onsite'
  const relocation = new Set(m.openToRelocation ? relocationStates(m.relocationNotes) : [])
  return { homeArea: m.homeArea, homeState, acceptsRemote, relocation, unknown: !m.homeArea && !homeState && !acceptsRemote && relocation.size === 0 }
}

export interface JobPlace {
  remote: boolean
  /** state|place keys of the job's city (places.ts), empty when unknown. */
  placeKeys: readonly string[]
  states: readonly string[]
}

export function geoMatch(g: MemberGeo, job: JobPlace): boolean {
  if (g.unknown) return true
  if (job.remote && g.acceptsRemote) return true
  if (g.homeArea) {
    if (job.placeKeys.some((k) => g.homeArea!.has(k))) return true
  } else if (g.homeState && job.states.includes(g.homeState)) {
    return true
  }
  return job.states.some((s) => g.relocation.has(s))
}

// ── Market tiers ───────────────────────────────────────────────────────────────

/**
 * The bigger the strict relevant set, the higher the fit bar (owner's rule). maxFitRank is
 * FIT_BUCKET_SORT_RANK (0 strong, 1 good, 2 stretch). The strictest tier also needs the
 * job in their industry and at their own career stage. Tune here.
 */
export const MARKET_TIERS = [
  { key: 'base', upTo: 150, maxFitRank: 2, requireIndustryAndStage: false, label: 'base' },
  { key: 'higher', upTo: 1_000, maxFitRank: 1, requireIndustryAndStage: false, label: 'higher bar' },
  { key: 'much_higher', upTo: 10_000, maxFitRank: 0, requireIndustryAndStage: false, label: 'much higher bar' },
  { key: 'strictest', upTo: Infinity, maxFitRank: 0, requireIndustryAndStage: true, label: 'strictest' },
] as const
export type MarketTier = (typeof MARKET_TIERS)[number]

export function marketTierFor(relevantCount: number): MarketTier {
  return MARKET_TIERS.find((t) => relevantCount < t.upTo) ?? MARKET_TIERS[MARKET_TIERS.length - 1]
}

/** Narrow shows at most this many (best fit first); more good matches page in on request. Tune here. */
export const NARROW_SHOW = { min: 40, max: 150 } as const
/** Wide when Narrow is full: at most this many extras, and only strong fits. */
export const WIDE_EXTRAS_WHEN_FULL = 150
/** Wide when Narrow is short: Narrow plus extras up to this total, fits up to this rank (2 = stretch). */
export const WIDE_TOTAL_WHEN_SHORT = 250
export const WIDE_SHORT_MAX_FIT_RANK = 2

// ── Explanation ────────────────────────────────────────────────────────────────

/**
 * The line under the toggle: "There are 4,200 Operations roles at your level, so we're only
 * showing the 120 that fit you best." / "23 jobs match you on level, field, location and
 * skills. Widen for 140 more, each with how to bridge the gap."
 */
export function relevanceLine(input: { breadth: 'narrow' | 'wide'; relevant: number; shown: number; field: string; place: string | null; extras: number }): string {
  const n = (x: number) => x.toLocaleString()
  const where = input.place ? ` ${input.place}` : ''
  if (input.breadth === 'wide') {
    return `${n(input.shown - input.extras)} jobs that fit you on every count, plus ${n(input.extras)} that need one bridge — each says what transfers and how to close the gap.`
  }
  if (input.relevant > input.shown) {
    return `There are ${n(input.relevant)} ${input.field} roles at your level${where}, so we're only showing the ${n(input.shown)} that fit you best.`
  }
  if (input.shown < NARROW_SHOW.min) {
    return `${n(input.shown)} job${input.shown === 1 ? '' : 's'} match you on level, field, location and skills right now. Widen for more, each with how to bridge the gap.`
  }
  return `${n(input.shown)} ${input.field} roles at your level${where} match you on field, location and skills.`
}

// ── Bridges ────────────────────────────────────────────────────────────────────

export interface Bridge {
  relaxed: Relaxed
  /** What transfers, one line. */
  transfers: string
  /** What's missing, one line. */
  missing: string
  /** One concrete learning step. */
  learn: { label: string; href: string }
  /** One networking step. */
  network: { label: string; href: string }
}

/**
 * Why a Wide job is worth it although it misses one criterion, and how to close the gap.
 * Deterministic: shared and missing skills come from the posting (job-skill-gap.ts) or the
 * two occupations (O*NET); the steps link into Learning, the skills gap, and the company's
 * insiders or the Network page.
 */
export function buildBridge(input: {
  relaxed: Relaxed
  fieldLabel: string
  /** Posting skills the member shows / doesn't (job-skill-gap.ts). */
  have: string[]
  missing: string[]
  /** O*NET's words for what the two occupations share, when the posting lists none. */
  occupationShared?: string[]
  jobIndustry?: string | null
  companyName: string | null
  /** The company's page (insiders), when we have one. */
  companyHref?: string | null
}): Bridge {
  const list = (xs: string[], n = 3) => xs.slice(0, n).map((x) => x.toLowerCase()).join(', ')
  const shared = input.have.length > 0 ? input.have : (input.occupationShared ?? [])
  const transfers =
    input.relaxed === 'industry'
      ? `The same work as yours (${input.fieldLabel})${shared.length > 0 ? `, with your ${list(shared)}` : ''}.`
      : input.relaxed === 'skills'
        ? `Your field and level${input.have.length > 0 ? `, and your ${list(input.have)}` : ''}.`
        : shared.length > 0
          ? `Your ${list(shared)}.`
          : 'Most of the same core skills as your own work (O*NET).'
  const gaps = [...(input.relaxed === 'industry' && input.jobIndustry ? [`${input.jobIndustry} know-how`] : []), ...input.missing.slice(0, 3)]
  const missing = gaps.length > 0 ? `${gaps.map((g) => g.toLowerCase()).join(', ')}.` : 'Nothing specific in the posting — check the description.'
  const first = input.missing[0]
  const learn = first
    ? { label: `Learn ${first.toLowerCase()}`, href: `/dashboard/learning?q=${encodeURIComponent(first)}` }
    : input.relaxed === 'industry' && input.jobIndustry
      ? { label: `Get up to speed on ${input.jobIndustry}`, href: `/dashboard/learning?q=${encodeURIComponent(input.jobIndustry)}` }
      : { label: 'See your skills gap', href: '/dashboard/skills-assessments' }
  const network = input.companyName
    ? { label: `Who you know at ${input.companyName}`, href: input.companyHref ?? '/dashboard/network' }
    : { label: 'Find someone who does this work', href: '/dashboard/network' }
  return { relaxed: input.relaxed, transfers, missing, learn, network }
}

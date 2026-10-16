// What "relevant" means for a member (owner's rules, 2026-10-16): a job counts only when it
// matches ALL of these, not any one —
//   seniority  inside their career-stage window (the board's level window, career-stage.ts);
//   function   their sub-function, or an occupation that is theirs or near-identical — a bare
//              broad function ("Operations") is not enough;
//   geography  within commuting distance of home (40 mi), or remote when they take remote;
//   skills     a real overlap between the job's skills (or occupation) and their skills matrix;
//   industry   their current or target industries count; outside them a job must fit strongly.
// When that leaves too few, the board widens in concentric rings, one at a time, in a fixed
// order (simplest to explain): geography (75 mi → their state → next-door states and places
// they'd move to), then similar industries, then similar functions, then one level up or down.
// Every job a ring lets in says which ring ("45 mi away", "similar industry: Healthcare") and
// carries a bridge (what transfers, what's missing, how to close it). On top, market tiers
// raise the fit bar when even the strict set is large. Pure (no I/O): src/test/relevance.test.ts.

import { statesFromLocation } from '@/lib/pay/market-pay'

// ── Criteria ───────────────────────────────────────────────────────────────────

export type FunctionMatch = 'own' | 'adjacent' | 'none'
export type SkillsMatch = 'strong' | 'weak' | 'none' | 'unknown'

/** Where a job sits for the member: 0 = home (or remote), 1 = within 75 mi, 2 = their state, 3 = next door / where they'd move; null = farther. */
export type GeoRing = 0 | 1 | 2 | 3

export interface JobCriteria {
  fn: FunctionMatch
  geo: GeoRing | null
  /** "45 mi away", "elsewhere in CA", "in OR (you'd move there)"; null at home. */
  geoNote: string | null
  skills: SkillsMatch
  /** 'own': one of their industries (or none on file); 'similar': next to one of them; 'other'. */
  industry: 'own' | 'similar' | 'other'
  /** The job's industry, for labels. */
  industryName: string | null
}

/** Rings, in the order the board widens. Ring 0 = relevant on every criterion. */
export const RINGS = ['home', 'within_75', 'state', 'next_states', 'similar_industry', 'similar_function', 'level'] as const
export type Ring = (typeof RINGS)[number]
export const RING_INDEX = Object.fromEntries(RINGS.map((r, i) => [r, i])) as Record<Ring, number>

/** The kind of bridge a ring stands for (bridge copy and email labels). */
export type Relaxed = 'place' | 'industry' | 'function' | 'level'
export function ringKind(ring: number): Relaxed {
  if (ring <= RING_INDEX.next_states) return 'place'
  if (ring === RING_INDEX.similar_industry) return 'industry'
  if (ring === RING_INDEX.similar_function) return 'function'
  return 'level'
}

const skillsPass = (s: SkillsMatch) => s === 'strong' || s === 'unknown'

/**
 * The innermost ring a job is in for the member, or null when no ring reaches it. Rings are
 * concentric: a job in the similar-industry ring may also be up to next-door states away.
 * strongFit: outside their industries a strong fit still counts as their industry.
 * stage: 0 inside their level window, 1 one level beyond it, 2 farther.
 */
export function ringOf(c: JobCriteria, input: { strongFit: boolean; stage: 0 | 1 | 2 }): number | null {
  if (c.geo === null || c.fn === 'none' || !skillsPass(c.skills) || input.stage === 2) return null
  const industry = c.industry === 'own' || input.strongFit ? 0 : c.industry === 'similar' ? RING_INDEX.similar_industry : null
  if (industry === null) return null
  return Math.max(c.geo, industry, c.fn === 'adjacent' ? RING_INDEX.similar_function : 0, input.stage === 1 ? RING_INDEX.level : 0)
}

/** What brought a ring job in, briefly, outermost first: ["one level up", "similar industry: Healthcare", "45 mi away"]. */
export function ringNotes(c: JobCriteria, input: { strongFit: boolean; stageDirection: 'up' | 'down' | null; fieldNote?: string | null }): string[] {
  const notes: string[] = []
  if (input.stageDirection) notes.push(`one level ${input.stageDirection}`)
  if (c.fn === 'adjacent') notes.push(input.fieldNote ?? 'a field next to yours')
  if (c.industry === 'similar' && !input.strongFit) notes.push(`similar industry${c.industryName ? `: ${c.industryName}` : ''}`)
  if (c.geoNote) notes.push(c.geoNote)
  return notes
}

// ── Similar industries ─────────────────────────────────────────────────────────

/** Industries next to each other (industry-buckets.ts names), hand-listed both ways. Tune here. */
const INDUSTRY_NEIGHBOURS: [string, string[]][] = [
  ['Technology & Software', ['Telecommunications', 'Media & Entertainment', 'Professional Services & Consulting', 'Venture Capital & Private Equity']],
  ['Venture Capital & Private Equity', ['Financial Services & Banking', 'Technology & Software']],
  ['Financial Services & Banking', ['Insurance', 'Accounting & Audit', 'Venture Capital & Private Equity']],
  ['Healthcare & Hospital Systems', ['Pharmaceuticals & Biotech', 'Medical Devices', 'Insurance']],
  ['Pharmaceuticals & Biotech', ['Medical Devices', 'Healthcare & Hospital Systems']],
  ['Education & EdTech', ['Nonprofit & Social Impact', 'Government & Public Sector']],
  ['Nonprofit & Social Impact', ['Education & EdTech', 'Government & Public Sector']],
  ['Government & Public Sector', ['Aerospace & Defense', 'Nonprofit & Social Impact', 'Education & EdTech']],
  ['Manufacturing & Industrial', ['Automotive & Mobility', 'Aerospace & Defense', 'Energy & Utilities', 'Transportation & Logistics']],
  ['Retail & E-commerce', ['Consumer Packaged Goods', 'Hospitality, Travel & Food Service', 'Transportation & Logistics']],
  ['Professional Services & Consulting', ['Accounting & Audit', 'Legal Services', 'Technology & Software', 'Staffing & Human Capital']],
  ['Energy & Utilities', ['Construction & Real Estate', 'Manufacturing & Industrial']],
  ['Media & Entertainment', ['Advertising, Marketing & PR', 'Technology & Software']],
]
const NEIGHBOURS = new Map<string, Set<string>>()
for (const [a, bs] of INDUSTRY_NEIGHBOURS) {
  for (const b of bs) {
    NEIGHBOURS.set(a, (NEIGHBOURS.get(a) ?? new Set()).add(b))
    NEIGHBOURS.set(b, (NEIGHBOURS.get(b) ?? new Set()).add(a))
  }
}

export function industryRelation(memberIndustries: ReadonlySet<string>, jobIndustry: string | null): JobCriteria['industry'] {
  if (memberIndustries.size === 0) return 'own'
  if (!jobIndustry) return 'other'
  if (memberIndustries.has(jobIndustry)) return 'own'
  for (const m of memberIndustries) if (NEIGHBOURS.get(m)?.has(jobIndustry)) return 'similar'
  return 'other'
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
/** Posting tools (O*NET ids) and member tools needed before the tool overlap decides. */
export const JOB_TOOLS_MIN = 2
export const MEMBER_TOOLS_MIN = 3

export function skillsMatch(input: {
  jobSkills: readonly string[]
  memberVocab: ReadonlySet<string>
  occupationBand?: 'close' | 'good' | 'partial' | 'few' | null
  /** O*NET skill / tool ids the posting names (text-skill-ids.ts) and the member's skills map to. */
  jobSkillIds?: readonly string[]
  memberSkillIds?: ReadonlySet<string>
}): SkillsMatch {
  // The posting's named tools against the member's, through the same O*NET aliases: the widest
  // vocabulary, so it decides first when both sides name enough.
  const jobIds = input.jobSkillIds ?? []
  if (jobIds.length >= JOB_TOOLS_MIN && (input.memberSkillIds?.size ?? 0) >= MEMBER_TOOLS_MIN) {
    let n = 0
    for (const id of jobIds) if (input.memberSkillIds!.has(id)) n++
    if (n >= SKILLS_STRONG_MIN || (n >= 1 && n / jobIds.length >= 0.5)) return 'strong'
    return n >= 1 ? 'weak' : 'none'
  }
  if (input.memberVocab.size < MEMBER_SKILLS_MIN) return input.occupationBand ? bandMatch(input.occupationBand) : 'unknown'
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

/** Rings of distance from home: within COMMUTE_MILES is home; within this is the first ring. Tune here. */
export const NEAR_MILES = 75

/** States that share a border (US Census), both ways. For the "next-door states" ring. */
const BORDERS: Record<string, string> = {
  AL: 'FL GA MS TN', AZ: 'CA CO NM NV UT', AR: 'LA MO MS OK TN TX', CA: 'AZ NV OR', CO: 'AZ KS NE NM OK UT WY',
  CT: 'MA NY RI', DE: 'MD NJ PA', DC: 'MD VA', FL: 'AL GA', GA: 'AL FL NC SC TN', ID: 'MT NV OR UT WA WY',
  IL: 'IA IN KY MO WI', IN: 'IL KY MI OH', IA: 'IL MN MO NE SD WI', KS: 'CO MO NE OK', KY: 'IL IN MO OH TN VA WV',
  LA: 'AR MS TX', ME: 'NH', MD: 'DC DE PA VA WV', MA: 'CT NH NY RI VT', MI: 'IN OH WI', MN: 'IA ND SD WI',
  MS: 'AL AR LA TN', MO: 'AR IA IL KS KY NE OK TN', MT: 'ID ND SD WY', NE: 'CO IA KS MO SD WY', NV: 'AZ CA ID OR UT',
  NH: 'MA ME VT', NJ: 'DE NY PA', NM: 'AZ CO OK TX UT', NY: 'CT MA NJ PA VT', NC: 'GA SC TN VA', ND: 'MN MT SD',
  OH: 'IN KY MI PA WV', OK: 'AR CO KS MO NM TX', OR: 'CA ID NV WA', PA: 'DE MD NJ NY OH WV', RI: 'CT MA',
  SC: 'GA NC', SD: 'IA MN MT ND NE WY', TN: 'AL AR GA KY MO MS NC VA', TX: 'AR LA NM OK', UT: 'AZ CO ID NM NV WY',
  VT: 'MA NH NY', VA: 'DC KY MD NC TN WV', WA: 'ID OR', WV: 'KY MD OH PA VA', WI: 'IA IL MI MN', WY: 'CO ID MT NE SD UT',
}
export function borderingStates(state: string): string[] {
  return (BORDERS[state] ?? '').split(' ').filter(Boolean)
}

export interface MemberGeo {
  /** Home's coordinates, when we know their city (Census places). */
  anchor: { lat: number; lon: number } | null
  /** Their home state. */
  homeState: string | null
  acceptsRemote: boolean
  /** States they'd move to (openToRelocation + their notes). */
  relocation: ReadonlySet<string>
  /** Nothing to go on (no home, onsite only): the criterion isn't applied. */
  unknown: boolean
}

export function memberGeo(m: {
  anchor: { lat: number; lon: number } | null
  currentState?: string | null
  remotePreference?: string | null
  openToRelocation?: boolean | null
  relocationNotes?: string | null
}): MemberGeo {
  const state = m.currentState?.trim().toUpperCase()
  const homeState = state && /^[A-Z]{2}$/.test(state) ? state : null
  const acceptsRemote = (m.remotePreference ?? '').toLowerCase() !== 'onsite'
  const relocation = new Set(m.openToRelocation ? relocationStates(m.relocationNotes) : [])
  return { anchor: m.anchor, homeState, acceptsRemote, relocation, unknown: !m.anchor && !homeState && !acceptsRemote && relocation.size === 0 }
}

export interface JobPlace {
  remote: boolean
  /** Coordinates of the job's city (or cities), when we can place it. */
  coords: readonly { lat: number; lon: number }[]
  states: readonly string[]
}

function miles(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const r = 3958.8
  const rad = (d: number) => (d * Math.PI) / 180
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lon - a.lon) / 2) ** 2
  return 2 * r * Math.asin(Math.sqrt(h))
}

/**
 * The geography ring a job is in for the member, with a short note for labels: home (within
 * COMMUTE_MILES, or remote when they take remote), within NEAR_MILES, elsewhere in their
 * state, or a next-door state / a state they'd move to. Without a city on file, their state
 * counts as home.
 */
export function geoRing(g: MemberGeo, job: JobPlace): { ring: GeoRing; note: string | null } | null {
  if (g.unknown) return { ring: 0, note: null }
  if (job.remote && g.acceptsRemote) return { ring: 0, note: null }
  if (g.anchor && job.coords.length > 0) {
    const d = Math.min(...job.coords.map((c) => miles(g.anchor!, c)))
    if (d <= COMMUTE_MILES) return { ring: 0, note: null }
    if (d <= NEAR_MILES) return { ring: 1, note: `${Math.round(d)} mi away` }
  }
  if (g.homeState && job.states.includes(g.homeState)) return g.anchor ? { ring: 2, note: `elsewhere in ${g.homeState}` } : { ring: 0, note: null }
  const moveTo = job.states.find((s) => g.relocation.has(s))
  if (moveTo) return { ring: 3, note: `in ${moveTo}, where you'd move` }
  const nextDoor = g.homeState ? job.states.find((s) => borderingStates(g.homeState!).includes(s)) : undefined
  if (nextDoor) return { ring: 3, note: `in ${nextDoor}, next to ${g.homeState}` }
  return null
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
/** A Narrow under NARROW_SHOW.min widens on its own, with bridge jobs, up to this many. Tune here. */
export const AUTO_WIDEN_FILL = 60

// ── Explanation ────────────────────────────────────────────────────────────────

/**
 * The line under the toggle: "There are 4,200 Operations roles at your level, so we're only
 * showing the 120 that fit you best." / "23 jobs match you on level, field, location and
 * skills. Widen for 140 more, each with how to bridge the gap."
 */
export function relevanceLine(input: {
  breadth: 'narrow' | 'wide'
  relevant: number
  shown: number
  field: string
  place: string | null
  extras: number
  /** Narrow was short and widened with bridge jobs on its own. */
  autoWidened?: boolean
}): string {
  const n = (x: number) => x.toLocaleString()
  const where = input.place ? ` ${input.place}` : ''
  if (input.autoWidened) {
    const strong = input.shown - input.extras
    return `Only ${n(strong)} ${input.field} job${strong === 1 ? '' : 's'}${where} fit you on every count right now, so we added ${n(input.extras)} worth a look — each says what transfers and how to bridge the gap.`
  }
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
/**
 * O*NET items every desk job rates highly: naming them as "what transfers" or "what's missing"
 * says nothing. Left out of bridges.
 */
export const GENERIC_ONET = new Set([
  'english language', 'customer and personal service', 'administration and management', 'mathematics', 'administrative',
  'reading comprehension', 'active listening', 'speaking', 'writing', 'critical thinking', 'monitoring', 'coordination',
  'time management', 'social perceptiveness', 'judgment and decision making', 'complex problem solving', 'active learning',
  'service orientation', 'instructing', 'learning strategies', 'education and training', 'computers and electronics',
])
const specific = (xs: string[] | undefined) => (xs ?? []).filter((x) => !GENERIC_ONET.has(x.trim().toLowerCase()))

/** Function-relaxed Wide jobs that come in through O*NET similarity alone need at least this (search-breadth.ts scores). */
export const FUNCTION_RELAX_MIN_SIMILARITY = 0.86

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
  /** Geography ring note ("45 mi away"), for place bridges. */
  placeNote?: string | null
  /** "one level up" / "one level down", for level bridges. */
  levelNote?: string | null
}): Bridge {
  const list = (xs: string[], n = 3) => xs.slice(0, n).map((x) => x.toLowerCase()).join(', ')
  const have = specific(input.have)
  const missingSpecific = specific(input.missing)
  const shared = have.length > 0 ? have : specific(input.occupationShared)
  const transfers =
    input.relaxed === 'function'
      ? shared.length > 0
        ? `Your ${list(shared)}.`
        : 'Most of the same core skills as your own work (O*NET).'
      : `The same work as yours (${input.fieldLabel})${shared.length > 0 ? `, with your ${list(shared)}` : ''}.`
  const gaps = [
    ...(input.relaxed === 'industry' && input.jobIndustry ? [`${input.jobIndustry} know-how`] : []),
    ...(input.relaxed === 'place' && input.placeNote ? [`a longer commute or a move (${input.placeNote})`] : []),
    ...(input.relaxed === 'level' && input.levelNote ? [`the step ${input.levelNote.replace(/^one level /, '')} (${input.levelNote})`] : []),
    ...missingSpecific.slice(0, 3),
  ]
  const missing = gaps.length > 0 ? `${gaps.map((g) => g.toLowerCase()).join(', ')}.` : 'Nothing specific in the posting — check the description.'
  const first = missingSpecific[0]
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


// Search scope: which of a member's explored and opted-in areas the job board and job fit read.
// Pure (no I/O), unit-tested in src/test/search-scope.test.ts. It extends the breadth switch
// (search-breadth.ts) with a second question: not only how far past the member's field the board
// reaches, but whether it looks outside their HOME at all.
//
// Home: the member's default functions, industries and geography (profile, résumé, target
// function and industries, current state). A pivot is any step outside home, in function,
// industry or geography, tracked separately.
//
// Options come from two places and mean the same thing once on:
//   - SearchExpansion (search-expansion.ts): what the member opted into on the market page.
//     Those opt-ins stay valid and count as on.
//   - Explored options (journeyDetails.exploredOptions): saved from career exploration. Nothing
//     changes in the search or in fit scores until an option is switched on.
//
// Scope picks what is read:
//   narrow      home only
//   broader     home + expansion opt-ins + explored options that are on  (today's behavior, the default)
//   everything  home + expansion opt-ins + every explored option

import { readSearchExpansion, type SearchExpansion } from '@/lib/profile/search-expansion'

export const SEARCH_SCOPES = ['narrow', 'broader', 'everything'] as const
export type SearchScope = (typeof SEARCH_SCOPES)[number]

/** Broader is what the board did before scope existed, so nothing regresses. */
export const DEFAULT_SCOPE: SearchScope = 'broader'

export const SCOPE_LABEL: Record<SearchScope, string> = { narrow: 'Narrow', broader: 'Broader', everything: 'Everything' }
export const SCOPE_HINT: Record<SearchScope, string> = {
  narrow: 'Only your home field, industries and place',
  broader: 'Home, plus the options you switched on',
  everything: 'Home, plus every option you have explored',
}

export function parseScope(v: string | string[] | null | undefined): SearchScope | null {
  const s = Array.isArray(v) ? v[0] : v
  return s === 'narrow' || s === 'broader' || s === 'everything' ? s : null
}

/** The URL's choice, else the member's saved one, else Broader. */
export function scopeFor(saved: string | null | undefined, urlParam?: string | string[] | null): SearchScope {
  return parseScope(urlParam) ?? parseScope(saved) ?? DEFAULT_SCOPE
}

// ── Explored options ───────────────────────────────────────────────────────────

export const OPTION_KINDS = ['function', 'industry', 'place'] as const
export type OptionKind = (typeof OPTION_KINDS)[number]
export type OptionSource = 'exploration' | 'question' | 'market'

export interface ExploredOption {
  kind: OptionKind
  /** A function name, an industry bucket name, or a two-letter state code. */
  value: string
  on: boolean
  source: OptionSource
  at: string
}

const MAX_OPTIONS = 30
const optionKey = (o: Pick<ExploredOption, 'kind' | 'value'>) => `${o.kind}:${o.value.trim().toLowerCase()}`
const isKind = (v: unknown): v is OptionKind => OPTION_KINDS.includes(v as OptionKind)
const isSource = (v: unknown): v is OptionSource => v === 'exploration' || v === 'question' || v === 'market'

function cleanValue(kind: OptionKind, v: string): string | null {
  const t = v.trim().slice(0, 80)
  if (!t) return null
  return kind === 'place' ? (/^[A-Za-z]{2}$/.test(t) ? t.toUpperCase() : null) : t
}

/** Explored options from journeyDetails.exploredOptions, read defensively. */
export function readExploredOptions(journeyDetails: unknown): ExploredOption[] {
  const raw = (journeyDetails as { exploredOptions?: unknown } | null)?.exploredOptions
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const out: ExploredOption[] = []
  for (const r of raw) {
    const o = (r ?? {}) as Partial<Record<keyof ExploredOption, unknown>>
    if (!isKind(o.kind) || typeof o.value !== 'string') continue
    const value = cleanValue(o.kind, o.value)
    if (!value) continue
    const key = optionKey({ kind: o.kind, value })
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ kind: o.kind, value, on: o.on === true, source: isSource(o.source) ? o.source : 'exploration', at: typeof o.at === 'string' ? o.at : '' })
  }
  return out.slice(0, MAX_OPTIONS)
}

/** Save an option. A new one starts off: exploring never changes the search by itself. */
export function addExploredOption(list: ExploredOption[], o: { kind: OptionKind; value: string; source: OptionSource; on?: boolean }, now = new Date()): ExploredOption[] {
  const value = cleanValue(o.kind, o.value)
  if (!value) return list
  const key = optionKey({ kind: o.kind, value })
  if (list.some((x) => optionKey(x) === key)) return list
  return [...list, { kind: o.kind, value, on: o.on === true, source: o.source, at: now.toISOString() }].slice(-MAX_OPTIONS)
}

export function setExploredOptionOn(list: ExploredOption[], o: { kind: OptionKind; value: string }, on: boolean): ExploredOption[] {
  const key = optionKey(o)
  return list.map((x) => (optionKey(x) === key ? { ...x, on } : x))
}

export function removeExploredOption(list: ExploredOption[], o: { kind: OptionKind; value: string }): ExploredOption[] {
  const key = optionKey(o)
  return list.filter((x) => optionKey(x) !== key)
}

// ── Home ───────────────────────────────────────────────────────────────────────

export interface HomeProfile {
  primaryFunction?: string | null
  secondaryFunction?: string | null
  targetFunction?: string | null
  industryContext?: string | null
  secondaryIndustryContext?: string | null
  targetIndustries?: string[] | null
  currentState?: string | null
}

export interface Home {
  /** Lowercased. Empty = we do not know, so nothing counts as outside. */
  functions: string[]
  industries: string[]
  states: string[]
}

const low = (s: string | null | undefined) => (s ?? '').trim().toLowerCase()
const unique = (xs: string[]) => [...new Set(xs.filter(Boolean))]
const NOT_A_FUNCTION = new Set(['general', 'other'])

/**
 * Home from the profile. Industries a member added through the market page (expansion.industries)
 * are copied into targetIndustries so the fit score reads them; they are not home.
 */
export function homeOf(p: HomeProfile, expansion: SearchExpansion = readSearchExpansion({})): Home {
  const added = new Set(expansion.industries.map(low))
  return {
    functions: unique([p.primaryFunction, p.secondaryFunction, p.targetFunction].map(low).filter((f) => !NOT_A_FUNCTION.has(f))),
    industries: unique([p.industryContext, p.secondaryIndustryContext, ...(p.targetIndustries ?? [])].map(low).filter((i) => !added.has(i))),
    states: unique([low(p.currentState).toUpperCase()]),
  }
}

// ── Resolving a scope ──────────────────────────────────────────────────────────

/** What a scope turns on, by kind. Functions are names; roles are pivot-map keys. */
export interface ActiveAreas {
  functions: string[]
  roles: string[]
  industries: string[]
  places: string[]
  remote: boolean
}

export interface ResolvedScope {
  scope: SearchScope
  /** What the job fit reads in place of the stored expansion (job-fit-bucket.ts). */
  expansion: SearchExpansion
  /** Functions explored and on: counted like a secondary function by the fit score. */
  exploredFunctions: string[]
  /** Home industries plus on-industries, for the fit score's industry match. */
  targetIndustries: string[]
  active: ActiveAreas
}

/**
 * The areas the scope reads. `targetIndustries` is the stored list: it already holds the industries
 * from the market page, so Narrow takes those out and the others put them back.
 */
export function resolveScope(input: {
  scope: SearchScope
  expansion: SearchExpansion
  options: ExploredOption[]
  targetIndustries?: string[] | null
}): ResolvedScope {
  const { scope, expansion, options } = input
  const stored = input.targetIndustries ?? []
  const addedByMarket = new Set(expansion.industries.map(low))
  const homeIndustries = stored.filter((i) => !addedByMarket.has(low(i)))
  const used = scope === 'narrow' ? [] : options.filter((o) => scope === 'everything' || o.on)
  const of = (k: OptionKind) => used.filter((o) => o.kind === k).map((o) => o.value)

  const keep = scope === 'narrow' ? null : expansion
  const industries = unique([...(keep?.industries ?? []), ...of('industry')])
  const states = unique([...(keep?.states ?? []), ...of('place')])
  const effective: SearchExpansion = {
    remote: keep?.remote ?? false,
    states,
    roles: keep?.roles ?? [],
    industries,
    at: expansion.at,
  }
  return {
    scope,
    expansion: effective,
    exploredFunctions: unique(of('function')),
    targetIndustries: unique([...homeIndustries, ...industries]),
    active: { functions: unique(of('function')), roles: effective.roles, industries, places: states, remote: effective.remote },
  }
}

/** A profile as the fit score and the board should read it under the scope. */
export function applyScope<P extends { searchExpansion?: unknown; targetIndustries?: string[] }>(
  profile: P,
  r: ResolvedScope
): P & { searchExpansion: SearchExpansion; exploredFunctions: string[]; targetIndustries: string[] } {
  return { ...profile, searchExpansion: r.expansion, exploredFunctions: r.exploredFunctions, targetIndustries: r.targetIndustries }
}

// ── Outside home: the pivot flag ───────────────────────────────────────────────

export interface OutsideHome {
  functions: string[]
  industries: string[]
  places: string[]
}

export const NOTHING_OUTSIDE: OutsideHome = { functions: [], industries: [], places: [] }

export function hasOutside(o: OutsideHome): boolean {
  return o.functions.length + o.industries.length + o.places.length > 0
}

/**
 * Which active areas fall outside home. A kind home says nothing about (no function, no industry or
 * no state on the profile) has nothing outside it. Remote is not a place, so it is never outside.
 * `roleFunction` maps a pivot-map role key to the function it belongs to; a role with none counts
 * as outside because pivot paths are moves away from the member's own role.
 */
export function outsideHome(active: ActiveAreas, home: Home, roleFunction: (roleKey: string) => string | null = () => null): OutsideHome {
  const fnOut = (f: string) => home.functions.length > 0 && !home.functions.includes(low(f))
  const fromRoles = active.roles.flatMap((r) => {
    const f = roleFunction(r)
    return f === null ? [r] : fnOut(f) ? [f] : []
  })
  return {
    functions: unique([...active.functions.filter(fnOut), ...fromRoles]),
    industries: active.industries.filter((i) => home.industries.length > 0 && !home.industries.includes(low(i))),
    places: active.places.filter((s) => home.states.length > 0 && !home.states.includes(s.toUpperCase())),
  }
}

/**
 * The pivot flag the scope adds. The older flag (isPivotingProfile, pivot-target.ts) is a separate
 * fact that stays as it is; a member is pivoting when either is true.
 */
export function isPivotingNow(oldFlag: boolean, outside: OutsideHome): boolean {
  return oldFlag || hasOutside(outside)
}

/** "healthcare and hospital systems, marketing and NC" for the message. */
export function describeOutside(o: OutsideHome): string {
  const parts = [...o.functions.map((f) => `${f} work`), ...o.industries, ...o.places.map((s) => `jobs in ${s}`)]
  if (parts.length === 0) return ''
  return parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
}

/** What home is called in a sentence: "Finance in Financial Services & Banking, in CA". */
export function describeHome(home: Home, names: { function?: string | null; industry?: string | null; state?: string | null }): string {
  const parts = [names.function, names.industry ? `in ${names.industry}` : null, names.state ? `in ${names.state}` : null].filter(Boolean)
  return parts.length > 0 ? parts.join(' ') : 'your usual field'
}

// ── Lower-fit note on a job in a widened area ──────────────────────────────────

export interface JobAreaFacts {
  functions: string[]
  industry: string | null
  states: string[]
}

/**
 * Why a job in a widened area will often fit less, in one line, or null when the job is inside home
 * (or in no widened area). Jobs are never hidden: the label says why the fit is lower.
 */
export function widenedFitNote(job: JobAreaFacts, outside: OutsideHome, home: Home): string | null {
  if (!hasOutside(outside)) return null
  const fn = outside.functions.find((f) => job.functions.map(low).includes(low(f)))
  const homeFns = home.functions.length > 0
  if (fn && homeFns && !job.functions.some((f) => home.functions.includes(low(f)))) {
    return `Fits less today: this is ${fn} work, outside your usual field, so your experience counts for less here.`
  }
  const ind = outside.industries.find((i) => low(i) === low(job.industry))
  if (ind) return `Fits less today: this is in ${ind}, a new industry for you, so there is less proof you know it.`
  const place = outside.places.find((s) => job.states.map((x) => x.toUpperCase()).includes(s.toUpperCase()))
  if (place && home.states.length > 0 && !job.states.some((s) => home.states.includes(s.toUpperCase()))) {
    return `Fits less today: this job is in ${place}, outside the place you searched from.`
  }
  return null
}

// ── The pivot message (once) and the exploring question ───────────────────────

export interface PivotScopeState {
  /** ISO time the pivot message was shown. Set once; never cleared. */
  messageShownAt: string | null
  /** Answers to "Are you exploring a move into X?": key `${kind}:${value}`. */
  answers: Record<string, 'yes' | 'no'>
}

export function readPivotScopeState(journeyDetails: unknown): PivotScopeState {
  const raw = ((journeyDetails as { pivotScope?: unknown } | null)?.pivotScope ?? {}) as { messageShownAt?: unknown; answers?: unknown }
  const answers: PivotScopeState['answers'] = {}
  if (raw.answers && typeof raw.answers === 'object') {
    for (const [k, v] of Object.entries(raw.answers as Record<string, unknown>)) if (v === 'yes' || v === 'no') answers[k] = v
  }
  return { messageShownAt: typeof raw.messageShownAt === 'string' ? raw.messageShownAt : null, answers }
}

/** Show the pivot message when something is outside home and it has not been shown before. */
export function pivotMessageDue(state: PivotScopeState, outside: OutsideHome): boolean {
  return hasOutside(outside) && state.messageShownAt === null
}

export const exploreKey = (o: { kind: OptionKind; value: string }) => optionKey(o)

/** What a member's saves and contacts say about where they are looking. */
export interface BehaviorSignal {
  kind: OptionKind
  value: string
  /** How many saved jobs / contacts point there. */
  count: number
  source: 'saves' | 'contacts'
}

/** Saves or contacts that point at one place before we ask. */
export const EXPLORE_QUESTION_MIN = 3

export interface ExploreQuestion {
  kind: OptionKind
  value: string
  text: string
}

/**
 * One question at most: "Are you exploring a move into healthcare?" for the strongest signal outside
 * home that is not already an option, expansion opt-in or answered. Behavior never writes to the
 * profile: a yes saves an explored option (off), and until then the signal only reaches the coach offer.
 */
export function exploreQuestion(signals: BehaviorSignal[], home: Home, options: ExploredOption[], state: PivotScopeState, expansion: SearchExpansion): ExploreQuestion | null {
  const known = new Set([
    ...options.map(optionKey),
    ...expansion.industries.map((v) => optionKey({ kind: 'industry', value: v })),
    ...expansion.states.map((v) => optionKey({ kind: 'place', value: v })),
  ])
  const outside = (s: BehaviorSignal) =>
    s.kind === 'function' ? home.functions.length > 0 && !home.functions.includes(low(s.value))
    : s.kind === 'industry' ? home.industries.length > 0 && !home.industries.includes(low(s.value))
    : home.states.length > 0 && !home.states.includes(s.value.toUpperCase())
  const best = signals
    .filter((s) => s.count >= EXPLORE_QUESTION_MIN && outside(s) && !known.has(optionKey(s)) && !state.answers[optionKey(s)])
    .sort((a, b) => b.count - a.count)[0]
  if (!best) return null
  const what = best.kind === 'place' ? best.value.toUpperCase() : best.value
  return { kind: best.kind, value: best.value, text: `Are you exploring a move into ${best.kind === 'function' ? `${what} work` : best.kind === 'place' ? `jobs in ${what}` : what}?` }
}

/** Outside-home signals that have not become options: the coach offer's pivot fact. */
export function behaviorPointsOutside(signals: BehaviorSignal[], home: Home): boolean {
  return signals.some(
    (s) =>
      s.count >= EXPLORE_QUESTION_MIN &&
      (s.kind === 'function' ? home.functions.length > 0 && !home.functions.includes(low(s.value))
      : s.kind === 'industry' ? home.industries.length > 0 && !home.industries.includes(low(s.value))
      : home.states.length > 0 && !home.states.includes(s.value.toUpperCase()))
  )
}

// ── Career exploration feeds the list ──────────────────────────────────────────

/**
 * Functions on the member's radar (journeyDetails.pivot, set aside excluded) show as explored options,
 * off until the member switches them on. A radar idea the member already has an option for keeps it.
 */
export function withRadarFunctions(list: ExploredOption[], radarFunctions: string[]): ExploredOption[] {
  return radarFunctions.reduce((acc, fn) => addExploredOption(acc, { kind: 'function', value: fn, source: 'exploration' }, new Date(0)), list)
}

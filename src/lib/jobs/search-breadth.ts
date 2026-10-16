// How wide a member's job board is, and why each job is on it. Pure (no I/O), so the
// rules are unit-tested (src/test/search-breadth.test.ts); the data loading lives in
// search-breadth-server.ts.
//
// Owner's rule (2026-10-16). Employers judge a senior applicant on their experience,
// so a senior member's board shows only jobs with a credible path from it:
//   - "Your field": the member's own function (any industry), or their own occupation;
//   - "Pivot: …": a pivot-map path from their kind of work (pivot-map.ts / onet.ts edges,
//     the same paths the Pivot Paths page shows), the function they said they want to
//     move into, or the same function in a different industry;
//   - "Skills match: …": a job whose O*NET occupation shares most of the member's
//     occupation's skill profile (OccupationSimilarity), even across functions and
//     industries — a Project Scheduler fits Coordinator roles.
// A junior member's résumé isn't fixed by experience yet, so their board is wider:
// the same three kinds, with a lower bar for a skills match. Neither dumps the whole
// board: everything else is left out, and what is kept ranks field, then pivots,
// then skills matches, then by fit.
//
// No model call and no paid API: titles, functions, the crawler's O*NET occupation
// on each job, and the precomputed similarity table.

import { CAREER_STAGES, memberCareerStage, type CareerStage, type StageMember } from '@/lib/jobs/career-stage'
import { adjacentSubFunctions, hasSubFunctions, SUB_FUNCTION_BY_KEY, subFunctionLabel } from '@/lib/jobs/sub-functions'

export const BREADTHS = ['narrow', 'wide'] as const
export type Breadth = (typeof BREADTHS)[number]

export const BREADTH_LABEL: Record<Breadth, string> = { narrow: 'Narrow', wide: 'Wide' }
export const BREADTH_HINT: Record<Breadth, string> = {
  narrow: 'Your field, pivots and close skills matches',
  wide: 'Also roles that use many of your skills',
}

export function parseBreadth(v: string | string[] | null | undefined): Breadth | null {
  const s = Array.isArray(v) ? v[0] : v
  return s === 'narrow' || s === 'wide' ? s : null
}

/**
 * Senior: Manager and up, or about 8+ years. Junior: Entry / Early / Mid stage, or
 * under about 5 years. A member we can't place is treated as senior (the board's
 * level window does the same: unknown stage shows mid-level and up).
 */
export function isSeniorMember(m: StageMember): boolean {
  const stage = memberCareerStage(m)
  if (stage) return CAREER_STAGES.indexOf(stage) >= CAREER_STAGES.indexOf('SENIOR_IC_MGR')
  const years = typeof m.yearsExperience === 'number' ? m.yearsExperience : null
  return years === null || years >= 5
}

/** Narrow for senior members, Wide for junior ones. */
export function defaultBreadth(m: StageMember): Breadth {
  return isSeniorMember(m) ? 'narrow' : 'wide'
}

export type BreadthMember = StageMember & { boardBreadth?: string | null }

/** The board: the URL's choice, else the member's saved one, else the default for their stage. */
export function boardBreadthFor(m: BreadthMember, urlParam?: string | string[] | null): Breadth {
  return parseBreadth(urlParam) ?? parseBreadth(m.boardBreadth) ?? defaultBreadth(m)
}

/** Job emails: Narrow unless the member chose Wide. */
export function emailBreadthFor(m: BreadthMember): Breadth {
  return parseBreadth(m.boardBreadth) === 'wide' ? 'wide' : 'narrow'
}

// ── Skills-adjacent thresholds ─────────────────────────────────────────────────

/**
 * Lowest occupation similarity (OccupationSimilarity.score, 0-1) for a skills match, by
 * whether O*NET itself lists the two occupations as related. Narrow keeps only
 * near-twins of the member's own occupation (Education Administrator → Training and
 * Development Manager, Instructional Coordinator; HR Specialist → Labor Relations,
 * Comp and Benefits). Wide also takes the next ring, but an unrelated pair must still
 * be close: management occupations all rate "management" highly, so at a lower bar an
 * Education Administrator would match every Sales Manager.
 */
export const SKILLS_THRESHOLD: Record<Breadth, { related: number; unrelated: number }> = {
  narrow: { related: 0.86, unrelated: 0.86 },
  wide: { related: 0.72, unrelated: 0.8 },
}

export function passesSkillsThreshold(sim: { score: number; related?: boolean }, breadth: Breadth): boolean {
  const t = SKILLS_THRESHOLD[breadth]
  return sim.score >= (sim.related ? t.related : t.unrelated)
}

// ── Member and job vectors ─────────────────────────────────────────────────────

export interface SimilarOccupation {
  score: number
  /** O*NET lists the pair as related. */
  related: boolean
  title: string
  /** O*NET's words for what the two share, used when the posting's own skills say nothing. */
  shared: string[]
}

/** Everything the classifier needs about the member, worked out once per request. */
export interface MemberBreadthVector {
  /** Their functions, lowercased (primary, secondary). */
  functions: Set<string>
  /** The function they want to move into, lowercased, when it differs. */
  targetFunction: string | null
  targetFunctionLabel: string | null
  /** Their pivot-map role and its label ("Recruiter"). */
  sourceRole: string | null
  sourceLabel: string | null
  /** Pivot targets reachable from sourceRole: role key → label. */
  pivotTargets: Map<string, string>
  /**
   * The same targets by the function their roles belong to (lowercased), each list also
   * holding the targets with no function: a job's title is only tested against targets
   * in its own function (or every target when its function is unknown) — the title
   * patterns are the slow part of classifying the whole board. pivotTargetIndex builds it.
   */
  pivotTargetsByFunction: Map<string, string[]>
  /** Their O*NET occupation and the occupations close to it. */
  soc: string | null
  similar: Map<string, SimilarOccupation>
  /** Their own function label for "Pivot: Finance in Healthcare". */
  functionLabel: string | null
  /** Industry buckets they come from or target (industry-buckets.ts), for the industry pivot label. */
  industries: Set<string>
  /**
   * Their sub-function (sub-functions.ts) within a function that is split, from their
   * latest title or occupation; null when it isn't split or nothing on the lists matches.
   */
  subFunction: string | null
  /** Their occupation was read from their own title (not a stand-in for their function). */
  socFromTitle: boolean
  /** Their career stage (career-stage.ts), for Narrow's closest-level tier; null = unknown. */
  stage?: CareerStage | null
}

/** Functions too broad to say what kind of work it is. */
const NOT_A_FUNCTION = new Set(['general', 'other', ''])

const lower = (s: string | null | undefined) => (s ?? '').trim().toLowerCase()

/** Can we tell what a relevant job is for this member at all? Without a function or an occupation, nothing is narrowed. */
export function hasBreadthBasis(m: MemberBreadthVector): boolean {
  return m.functions.size > 0 || m.soc !== null || m.pivotTargets.size > 0
}

/** pivotTargetsByFunction from role key → its function (null = none). '*' holds the no-function targets alone. */
export function pivotTargetIndex(targets: [key: string, fn: string | null][]): Map<string, string[]> {
  const loose = targets.filter(([, fn]) => !fn).map(([k]) => k)
  const byFn = new Map<string, string[]>()
  for (const [key, fn] of targets) if (fn) byFn.set(fn.toLowerCase(), [...(byFn.get(fn.toLowerCase()) ?? []), key])
  return new Map([['*', loose], ...[...byFn].map(([f, keys]) => [f, [...keys, ...loose]] as [string, string[]])])
}

export function memberFunctions(fns: (string | null | undefined)[]): Set<string> {
  return new Set(fns.map(lower).filter((f) => !NOT_A_FUNCTION.has(f)))
}

/** What the classifier reads off a job. pivotRole is lazy (title patterns are the slow part). */
export interface JobBreadthFacts {
  /** The board's reading of the title's function, lowercased ('' when none). */
  titleFunction: string
  /** The function the import sent, when it did. */
  targetFunction: string | null
  /** The crawler's O*NET occupation for the title. */
  soc: string | null
  /** The first of these pivot-map roles whose title patterns the job's title matches, or null. */
  pivotRole: (roles: Iterable<string>) => string | null
  /** The job's sub-function within this function (stored at import, else read from its title / occupation); lazy. */
  subFunction: (fn: string) => string | null
}

export type MatchKind = 'field' | 'related_field' | 'pivot' | 'skills'

/** Field first, then pivots, then skills matches (owner's order). */
export const MATCH_KIND_RANK: Record<MatchKind, number> = { field: 0, related_field: 1, pivot: 2, skills: 3 }

/** Kinds Narrow keeps outright (a skills match must also pass Narrow's bar; a related field is Wide only). */
export function keptByNarrow(cls: JobClass): boolean {
  if (cls.kind === 'related_field') return false
  return cls.kind !== 'skills' || passesSkillsThreshold({ score: cls.score ?? 0, related: cls.related }, 'narrow')
}

export interface JobClass {
  kind: MatchKind
  /** Pivot: the target role key, or 'fn:<function>' for the target function. */
  pivot?: string
  /** Related field: the job's sub-function (null = its title doesn't say). */
  subFunction?: string | null
  /** Skills: the occupation similarity, and whether O*NET relates the two. */
  score?: number
  related?: boolean
}

/**
 * Why this job is on the member's board at this breadth, or null when it isn't.
 * Order matters: a job in the member's own field is "Your field" even when a pivot or
 * a skills match would also let it in.
 */
export function classifyJob(m: MemberBreadthVector, job: JobBreadthFacts, breadth: Breadth): JobClass | null {
  const fn = job.titleFunction || lower(job.targetFunction)
  const ownFn = fn && m.functions.has(fn) ? fn : job.targetFunction && m.functions.has(lower(job.targetFunction)) ? lower(job.targetFunction) : null
  const sameOccupation = !!job.soc && !!m.soc && job.soc === m.soc
  const sim = job.soc ? m.similar.get(job.soc) : undefined
  // Within the member's own function: "Your field" is their own sub-function when the
  // function is split (sub-functions.ts). The rest of the function isn't dropped: an
  // adjacent sub-function — or one we can't read — is a "Related field" on Wide, and any
  // job whose skills are close enough still comes in below as a skills match.
  let related: JobClass | null = null
  if (ownFn) {
    const memberSub = m.subFunction ? SUB_FUNCTION_BY_KEY.get(m.subFunction) : undefined
    if (!memberSub || memberSub.fn.toLowerCase() !== ownFn) {
      // Not split, or the member's sub-function is unknown: their occupation narrows a
      // split function instead (a job far from it is a related field), else the whole function.
      if (!hasSubFunctions(ownFn) || !m.soc || !m.socFromTitle || !job.soc || sameOccupation || (sim && passesSkillsThreshold(sim, 'wide'))) return { kind: 'field' }
      related = { kind: 'related_field', subFunction: job.subFunction(ownFn) }
    } else {
      const jobSub = job.subFunction(ownFn)
      if (jobSub === m.subFunction || sameOccupation) return { kind: 'field' }
      if (jobSub === null || adjacentSubFunctions(m.subFunction!, jobSub)) related = { kind: 'related_field', subFunction: jobSub }
    }
  } else if (sameOccupation) return { kind: 'field' }
  if (m.targetFunction && fn === m.targetFunction) return { kind: 'pivot', pivot: `fn:${m.targetFunction}` }
  // A near-twin occupation is a skills match before any title-pattern pivot is tried.
  if (sim && passesSkillsThreshold(sim, 'narrow')) return { kind: 'skills', score: sim.score, related: sim.related }
  if (m.pivotTargets.size > 0) {
    const candidates = fn ? (m.pivotTargetsByFunction.get(fn) ?? m.pivotTargetsByFunction.get('*')) : m.pivotTargets.keys()
    const role = candidates ? job.pivotRole(candidates) : null
    if (role) return { kind: 'pivot', pivot: role }
  }
  if (related && breadth === 'wide') return related
  if (sim && passesSkillsThreshold(sim, breadth)) return { kind: 'skills', score: sim.score, related: sim.related }
  return null
}

// ── Reason labels ──────────────────────────────────────────────────────────────

export interface MatchReason {
  kind: MatchKind | 'industry_pivot'
  /** Shown on the card: "Your field", "Pivot: Recruiter → HR business partner", "Skills match: scheduling, vendor coordination". */
  label: string
  /** Skills behind a skills match, for skills_adjacent_job_clicked. */
  sharedSkills?: string[]
}

export const MAX_REASON_SKILLS = 3

/**
 * The label for a job on the board. For a skills match, the posting's own skills the
 * member shows come first (concrete: "scheduling, vendor coordination"); when the posting
 * lists none of theirs, what the two occupations share in O*NET.
 */
export function matchReason(
  m: MemberBreadthVector,
  cls: JobClass,
  job: { soc: string | null; industry?: string | null; industryBucket?: string | null },
  memberHasSkill: (skill: string) => boolean,
  jobSkills: string[] = []
): MatchReason {
  if (cls.kind === 'field') {
    const bucket = job.industryBucket ?? null
    if (bucket && bucket !== 'Other' && m.industries.size > 0 && !m.industries.has(bucket) && m.functionLabel) {
      return { kind: 'industry_pivot', label: `Pivot: ${m.functionLabel} in ${bucket}` }
    }
    return { kind: 'field', label: 'Your field' }
  }
  if (cls.kind === 'related_field') {
    const sub = subFunctionLabel(cls.subFunction)
    return { kind: 'related_field', label: sub ? `Related field: ${sub}` : 'Related field' }
  }
  if (cls.kind === 'pivot') {
    const to = cls.pivot?.startsWith('fn:') ? m.targetFunctionLabel : m.pivotTargets.get(cls.pivot ?? '')
    const from = cls.pivot?.startsWith('fn:') ? m.functionLabel : m.sourceLabel
    return { kind: 'pivot', label: from && to ? `Pivot: ${from} → ${to}` : `Pivot: ${to ?? 'a related path'}` }
  }
  const fromPosting = [...new Set(jobSkills.map((s) => s.trim()).filter((s) => s && memberHasSkill(s)))].slice(0, MAX_REASON_SKILLS)
  const shared = fromPosting.length > 0 ? fromPosting : (job.soc ? (m.similar.get(job.soc)?.shared ?? []) : []).slice(0, MAX_REASON_SKILLS)
  const words = shared.map((s) => s.toLowerCase())
  return { kind: 'skills', label: words.length > 0 ? `Skills match: ${words.join(', ')}` : 'Skills match', sharedSkills: shared }
}

/** For the card's tooltip / screen readers: the reason in a sentence. */
export function matchReasonSentence(r: MatchReason): string {
  switch (r.kind) {
    case 'field':
      return 'Shown because it is in your field.'
    case 'related_field':
      return 'Shown because it is close to your own work, in the same function.'
    case 'industry_pivot':
      return `Shown because it is your kind of work in another industry (${r.label.replace(/^Pivot: /, '')}).`
    case 'pivot':
      return `Shown because it is a pivot path from your background (${r.label.replace(/^Pivot: /, '')}).`
    case 'skills':
      return r.sharedSkills && r.sharedSkills.length > 0
        ? `Shown because it uses skills you have: ${r.sharedSkills.map((s) => s.toLowerCase()).join(', ')}.`
        : 'Shown because this kind of work uses most of the same skills as yours.'
  }
}

// ── Adaptive Narrow ────────────────────────────────────────────────────────────
//
// Owner's rule (2026-10-16): Narrow is "as narrow as returns enough possible jobs". Each
// job carries flags for the filters it passes. The board starts from NARROW (field,
// pivots, close skills matches) and, while more than NARROW_BAND.max jobs would show, adds
// the tightening steps in order — near matches only, own field only, own industry, own
// career stage, closest occupation — skipping any step that would drop below
// NARROW_BAND.min. It loosens (related fields, then everything Wide shows) only when
// NARROW itself falls short of the band.

/** How many jobs Narrow aims to show for the current window. Tune here. */
export const NARROW_BAND = { min: 40, max: 150 } as const

export const NARROW_FLAG = {
  /** On Wide at all. */
  WIDE: 1,
  /** Narrow plus related fields. */
  RELATED: 2,
  /** Field, pivots, close skills matches. */
  NARROW: 4,
  /** Field, the function they want to move into, near-identical skills matches. */
  CLOSE: 8,
  /** Their own field (sub-function / occupation). */
  FIELD: 16,
  /** In one of their industries (always set when they have none on file). */
  INDUSTRY: 32,
  /** At their own career stage. */
  LEVEL: 64,
  /** The same O*NET occupation as theirs, or a near-identical one. */
  OCCUPATION: 128,
} as const

/** Tightening steps, in the owner's order. */
export const TIGHTEN_STEPS = [NARROW_FLAG.CLOSE, NARROW_FLAG.FIELD, NARROW_FLAG.INDUSTRY, NARROW_FLAG.LEVEL, NARROW_FLAG.OCCUPATION] as const

/** A skills match this close counts as "close" and as the same occupation. */
export const NEAR_TWIN_SCORE = 0.92

export function narrowFlagsOf(cls: JobClass, ctx: { industryOk: boolean; sameStage: boolean; closeOccupation: boolean }): number {
  const F = NARROW_FLAG
  const extra = (ctx.industryOk ? F.INDUSTRY : 0) | (ctx.sameStage ? F.LEVEL : 0) | (ctx.closeOccupation ? F.OCCUPATION : 0)
  switch (cls.kind) {
    case 'related_field':
      return F.WIDE | F.RELATED
    case 'skills': {
      if (!passesSkillsThreshold({ score: cls.score ?? 0, related: cls.related }, 'narrow')) return F.WIDE
      const near = (cls.score ?? 0) >= NEAR_TWIN_SCORE
      return F.WIDE | F.RELATED | F.NARROW | (near ? F.CLOSE | F.OCCUPATION : 0) | extra
    }
    case 'pivot':
      return F.WIDE | F.RELATED | F.NARROW | (cls.pivot?.startsWith('fn:') ? F.CLOSE : 0) | extra
    case 'field':
      return F.WIDE | F.RELATED | F.NARROW | F.CLOSE | F.FIELD | extra
  }
}

/** Jobs whose flags include every bit of `required`, from a count per flag set. */
export function jobsWith(hist: ReadonlyMap<number, number>, required: number): number {
  let n = 0
  for (const [flags, c] of hist) if ((flags & required) === required) n += c
  return n
}

/** The filter Narrow uses for this member and window: tighten while above the band, loosen only when short. */
export function chooseNarrowFilter(hist: ReadonlyMap<number, number>, band: { min: number; max: number } = NARROW_BAND): number {
  let req: number = NARROW_FLAG.NARROW
  if (jobsWith(hist, req) < band.min) return jobsWith(hist, NARROW_FLAG.RELATED) >= band.min ? NARROW_FLAG.RELATED : NARROW_FLAG.WIDE
  for (const step of TIGHTEN_STEPS) {
    if (jobsWith(hist, req) <= band.max) break
    if (jobsWith(hist, req | step) >= band.min) req |= step
  }
  return req
}

/**
 * The plain line under the toggle saying what Narrow did: "We narrowed to FP&A and corporate
 * finance roles in Healthcare at your level — 84 jobs."
 */
export function narrowExplanation(
  required: number,
  count: number,
  m: Pick<MemberBreadthVector, 'subFunction' | 'functionLabel' | 'industries'>
): string {
  const F = NARROW_FLAG
  const jobs = `${count.toLocaleString()} job${count === 1 ? '' : 's'}`
  if (!(required & F.NARROW)) {
    return required & F.RELATED ? `Few jobs fit tightly, so we added related fields — ${jobs}.` : `Few jobs fit tightly, so we added everything with shared skills — ${jobs}.`
  }
  const field = required & F.FIELD ? `${subFunctionLabel(m.subFunction) ?? m.functionLabel ?? 'your field'} roles` : required & F.CLOSE ? 'your field and its closest matches' : 'your field, pivots and close skills matches'
  const industry = required & F.INDUSTRY && m.industries.size > 0 ? ` in ${[...m.industries][0]}` : ''
  const level = required & F.LEVEL ? ' at your level' : ''
  const occupation = required & F.OCCUPATION ? ', closest to the work you do now' : ''
  const narrowed = required !== F.NARROW
  return `${narrowed ? 'We narrowed to ' : ''}${narrowed ? field : field.charAt(0).toUpperCase() + field.slice(1)}${industry}${level}${occupation} — ${jobs}.`
}

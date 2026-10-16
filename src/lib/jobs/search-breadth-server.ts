import 'server-only'
import { prisma } from '@/lib/prisma'
import { resolveCandidateOccupation } from '@/lib/careers/candidate-occupation'
import { jobIndustryBucket, memberIndustryBuckets } from '@/lib/profile/industry-reading'
import { skillTerms, type SkillMatrixInput } from '@/lib/profile/skill-matrix'
import { SKILL_TERMS } from '@/lib/companies/skills-extraction'
import { getTaxonomy } from '@/lib/careers/taxonomy'
import { skillIdsFromKeywords } from '@/lib/careers/alias-server'
import { computeSkillsFit, type SkillsFit } from '@/lib/careers/skills-fit'
import { cityState, localArea } from '@/lib/workforce/local'
import { placeKeys } from '@/lib/workforce/places'
import { statesFromLocation } from '@/lib/pay/market-pay'
import {
  COMMUTE_MILES,
  geoMatch,
  memberGeo,
  relaxedCriterion,
  skillsMatch,
  type FunctionMatch,
  type JobCriteria,
  type JobPlace,
  type Relaxed,
} from '@/lib/jobs/relevance'
import { SUB_FUNCTION_BY_KEY, subFunctionFor } from '@/lib/jobs/sub-functions'
import { memberCareerStage, stageOfRung, type StageMember } from '@/lib/jobs/career-stage'
import { inferFunctionFromTitle } from '@/lib/jobs/infer-job-function'
import { edgesFor } from '@/lib/pivots/onet'
import { onetSocForRole } from '@/lib/pivots/onet-soc'
import { detectSourceRole, ROLES, titleVariants } from '@/lib/pivots/pivot-map'
import {
  classifyJob,
  hasBreadthBasis,
  memberFunctions,
  pivotTargetIndex,
  MATCH_KIND_RANK,
  type Breadth,
  type JobBreadthFacts,
  type JobClass,
  type MemberBreadthVector,
  type SimilarOccupation,
  matchReason,
  type MatchReason,
} from '@/lib/jobs/search-breadth'
import { memberHasSkill } from '@/lib/jobs/job-skill-gap'

// The data behind search-breadth.ts, held in memory per server instance:
//
// - OccupationSimilarity (~30k rows), whole, for an hour: it changes only when the
//   builder script is re-run.
// - Each live job's O*NET occupation (the crawler's socCode), by id. Not a
//   BoardLightRow column (that copy is rebuilt by triggers another change owns), so
//   it is its own narrow read: ~230k ids, ~0.4 s in Postgres. Refreshed every ten
//   minutes; after that the held copy is served while a fresh one loads, and only a
//   cold instance waits — in parallel with the board's own load, never after it.
//   A job imported since the last refresh is classified by its title alone until then.

const SIMILARITY_TTL_MS = 60 * 60_000
const JOB_SOC_TTL_MS = 10 * 60_000
const JOB_SOC_STALE_MS = 60 * 60_000

type SimilarityIndex = Map<string, Map<string, SimilarOccupation>>
let similarityMemo: { at: number; value: Promise<SimilarityIndex> } | null = null

export function loadSimilarityIndex(): Promise<SimilarityIndex> {
  const now = Date.now()
  if (!similarityMemo || now - similarityMemo.at > SIMILARITY_TTL_MS) {
    const value = prisma.occupationSimilarity
      .findMany({ select: { socCode: true, similarSocCode: true, score: true, related: true, sharedSkills: true, similarTitle: true } })
      .then((rows) => {
        const index: SimilarityIndex = new Map()
        for (const r of rows) {
          let m = index.get(r.socCode)
          if (!m) index.set(r.socCode, (m = new Map()))
          m.set(r.similarSocCode, { score: r.score, related: r.related, title: r.similarTitle, shared: r.sharedSkills })
        }
        return index
      })
      .catch((error) => {
        // Table missing (SQL not applied yet) or unreadable: no skills matches, nothing else breaks.
        console.error('Occupation similarity unavailable:', error)
        similarityMemo = null
        return new Map() as SimilarityIndex
      })
    similarityMemo = { at: now, value }
  }
  return similarityMemo.value
}

/** Live job id → O*NET occupation, and → sub-function stored at import (sub-functions.ts). */
export interface JobOccupations {
  socs: Map<string, string>
  subs: Map<string, string>
  /** Live job id → industry bucket (industry-buckets.ts), when the job has one. */
  industries: Map<string, string>
  /** Live job id → the skills its posting asks for (lowercase), when it lists any. */
  skills: Map<string, readonly string[]>
}

let jobSocs: { at: number; value: Promise<JobOccupations> } | null = null
let jobSocsLoading: Promise<JobOccupations> | null = null

async function readJobSocs(): Promise<JobOccupations> {
  const rows = await prisma.$queryRaw<{ id: string; socCode: string | null; subFunction: string | null; industry: string | null; skills: string[] }[]>`
    SELECT "id", "socCode", "subFunction", "industry", "skills" FROM "ExclusiveJobPosting"
    WHERE "archivedAt" IS NULL AND ("socCode" IS NOT NULL OR "subFunction" IS NOT NULL OR "industry" IS NOT NULL OR cardinality("skills") > 0)`
  const pool = new Map<string, string>()
  const intern = (v: string) => {
    let hit = pool.get(v)
    if (hit === undefined) pool.set(v, (hit = v))
    return hit
  }
  const socs = new Map<string, string>()
  const subs = new Map<string, string>()
  const industries = new Map<string, string>()
  const skills = new Map<string, readonly string[]>()
  const bucketOf = new Map<string, string | null>()
  for (const r of rows) {
    if (r.socCode) socs.set(r.id, intern(r.socCode))
    if (r.subFunction) subs.set(r.id, intern(r.subFunction))
    if (r.industry) {
      let b = bucketOf.get(r.industry)
      if (b === undefined) bucketOf.set(r.industry, (b = jobIndustryBucket(r.industry)))
      if (b) industries.set(r.id, b)
    }
    if (r.skills && r.skills.length > 0) skills.set(r.id, r.skills.map((x) => intern(x.toLowerCase())))
  }
  return { socs, subs, industries, skills }
}

/** Live job id → O*NET occupation and stored sub-function. */
export function loadJobSocs(): Promise<JobOccupations> {
  const now = Date.now()
  if (jobSocs && now - jobSocs.at < JOB_SOC_TTL_MS) return jobSocs.value
  if (!jobSocsLoading) {
    const started = now
    const next = readJobSocs()
    jobSocsLoading = next
    next.then(
      () => {
        jobSocs = { at: started, value: next }
        jobSocsLoading = null
      },
      (error) => {
        console.error('Job occupations: load failed', error)
        jobSocsLoading = null
      }
    )
  }
  if (jobSocs && now - jobSocs.at < JOB_SOC_STALE_MS) return jobSocs.value
  return jobSocsLoading!.catch(() => ({ socs: new Map<string, string>(), subs: new Map<string, string>(), industries: new Map<string, string>(), skills: new Map<string, readonly string[]>() }))
}

// ── Member vector ──────────────────────────────────────────────────────────────

export type BreadthCandidate = StageMember & {
  id?: string | null
  primaryFunction?: string | null
  secondaryFunction?: string | null
  targetFunction?: string | null
  resumeLatestJobTitle?: string | null
  industryContext?: string | null
  secondaryIndustryContext?: string | null
  targetIndustries?: string[] | null
  /** Saved sub-function (sub-functions.ts); re-derived on each board view and saved when it changes. */
  subFunction?: string | null
  industryBuckets?: string[] | null
  currentCity?: string | null
  currentState?: string | null
  remotePreference?: string | null
  openToRelocation?: boolean | null
  relocationNotes?: string | null
} & SkillMatrixInput

const memberSocMemo = new Map<string, { at: number; soc: string | null }>()
const MEMBER_SOC_TTL_MS = 10 * 60_000

async function memberSoc(candidate: BreadthCandidate, sourceRole: string | null): Promise<string | null> {
  const fallback = sourceRole ? onetSocForRole(sourceRole) : null
  if (!candidate.id) return fallback
  const key = `${candidate.id}|${candidate.resumeLatestJobTitle ?? ''}|${candidate.primaryFunction ?? ''}`
  const hit = memberSocMemo.get(key)
  if (hit && Date.now() - hit.at < MEMBER_SOC_TTL_MS) return hit.soc
  const resolved = await resolveCandidateOccupation(candidate.id).catch(() => null)
  // A clear title match (or their own choice) beats the pivot role's stand-in; the function
  // proxy doesn't — the role read from their title is more specific than "their function".
  const soc = resolved?.status === 'resolved' && resolved.source !== 'FUNCTION_PROXY' ? resolved.socCode : (fallback ?? (resolved?.status === 'resolved' ? resolved.socCode : null))
  if (memberSocMemo.size > 5000) memberSocMemo.clear()
  memberSocMemo.set(key, { at: Date.now(), soc })
  return soc
}

/** Everything the classifier needs about one member. No model call; at most two small reads (their occupation), memoised. */
export async function memberBreadthVector(candidate: BreadthCandidate): Promise<MemberBreadthVector> {
  const functions = memberFunctions([candidate.primaryFunction, candidate.secondaryFunction])
  const target = (candidate.targetFunction ?? '').trim()
  const targetFunction = target && !functions.has(target.toLowerCase()) && !/^(general|other)$/i.test(target) ? target.toLowerCase() : null
  const sourceRole = detectSourceRole({ title: candidate.resumeLatestJobTitle, primaryFunction: candidate.primaryFunction })
  const pivotTargets = new Map<string, string>()
  for (const e of edgesFor(sourceRole)) {
    const role = ROLES.get(e.to)
    if (role) pivotTargets.set(role.key, role.label)
  }
  const [soc, similarity, homeArea, skills] = await Promise.all([
    memberSoc(candidate, sourceRole),
    loadSimilarityIndex(),
    homeCommuteArea(candidate),
    memberSkills(candidate),
  ])
  // Their current and target industries, read carefully (industry-reading.ts) or as they confirmed.
  const industries = new Set(memberIndustryBuckets(candidate))
  // Their sub-function: their latest title (or occupation) within their primary function, else their secondary one.
  // Their occupation only counts when it was read from a real title: with no title it is a
  // stand-in for their function, and a sub-function from a stand-in would be a guess.
  const hasTitle = !!candidate.resumeLatestJobTitle?.trim()
  const titleSoc = hasTitle ? soc : null
  const subFunction =
    subFunctionFor({ title: candidate.resumeLatestJobTitle, fn: candidate.primaryFunction, soc: titleSoc }) ??
    subFunctionFor({ title: candidate.resumeLatestJobTitle, fn: candidate.secondaryFunction, soc: titleSoc })
  if (candidate.id && (candidate.subFunction ?? null) !== subFunction && candidate.subFunction !== undefined) {
    prisma.candidateProfile.update({ where: { id: candidate.id }, data: { subFunction } }).catch(() => undefined)
  }
  return {
    subFunction,
    socFromTitle: hasTitle,
    stage: memberCareerStage(candidate),
    functions,
    targetFunction,
    targetFunctionLabel: targetFunction ? target : null,
    sourceRole,
    sourceLabel: sourceRole ? (ROLES.get(sourceRole)?.label ?? null) : null,
    pivotTargets,
    pivotTargetsByFunction: pivotTargetIndex([...pivotTargets.keys()].map((k) => [k, ROLES.get(k)?.fn ?? null])),
    soc,
    similar: (soc && similarity.get(soc)) || new Map(),
    functionLabel: candidate.primaryFunction && functions.has(candidate.primaryFunction.trim().toLowerCase()) ? candidate.primaryFunction.trim() : null,
    industries,
    geo: memberGeo({ homeArea, currentState: candidate.currentState, remotePreference: candidate.remotePreference, openToRelocation: candidate.openToRelocation, relocationNotes: candidate.relocationNotes }),
    vocab: skills.vocab,
    ...(await occupationBander(soc && hasTitle ? soc : null, skills.keywords)),
  }
}

/** Home's commute area (relevance.ts COMMUTE_MILES) from their city and state, via Census places; null when unknown. */
async function homeCommuteArea(c: BreadthCandidate): Promise<ReadonlySet<string> | null> {
  const city = c.currentCity?.trim()
  const state = c.currentState?.trim().toUpperCase()
  if (!city || !state || !/^[A-Z]{2}$/.test(state)) return null
  const area = await localArea({ anchorCity: city, anchorState: state, radiusMiles: COMMUTE_MILES, label: city }).catch(() => null)
  return area?.keys ?? null
}

const vocabMemo = new Map<string, { keywords: string[]; vocab: ReadonlySet<string> }>()
/** Their skills matrix as keywords, and the skill-vocabulary terms it shows (the words postings' skills use). */
async function memberSkills(c: BreadthCandidate): Promise<{ keywords: string[]; vocab: ReadonlySet<string> }> {
  const keywords = skillTerms(c)
  const key = keywords.join('|')
  const hit = vocabMemo.get(key)
  if (hit) return hit
  const vocab = new Set(SKILL_TERMS.filter((t) => memberHasSkill(t, keywords)).map((t) => t.toLowerCase()))
  const out = { keywords, vocab }
  if (vocabMemo.size > 2000) vocabMemo.clear()
  vocabMemo.set(key, out)
  return out
}

/** Their skills fit to any occupation (O*NET taxonomy), memoised per occupation; null when either side is unknown. */
async function occupationBander(
  memberSocCode: string | null,
  keywords: string[]
): Promise<{ occupationBand: (soc: string) => 'close' | 'good' | 'partial' | 'few' | null; occupationGaps: (soc: string) => string[] }> {
  const taxonomy = memberSocCode ? await getTaxonomy().catch(() => null) : null
  const source = taxonomy && memberSocCode ? (taxonomy.profiles.get(memberSocCode) ?? null) : null
  if (!taxonomy || !source) return { occupationBand: () => null, occupationGaps: () => [] }
  const haveSkillIds = await skillIdsFromKeywords(keywords).catch(() => new Set<string>())
  const memo = new Map<string, SkillsFit>()
  const fitFor = (soc: string) => {
    let fit = memo.get(soc)
    if (!fit) memo.set(soc, (fit = computeSkillsFit({ source, target: taxonomy.profiles.get(soc) ?? null, haveKeywords: keywords, haveSkillIds })))
    return fit
  }
  return {
    occupationBand: (soc) => {
      const fit = fitFor(soc)
      return fit.status === 'mapped' ? fit.band : null
    },
    // The knowledge that occupation leans on more than theirs (O*NET); its tool lists are too noisy to name.
    occupationGaps: (soc) => {
      const fit = fitFor(soc)
      return fit.status === 'mapped' ? fit.knowledgeToBuild : []
    },
  }
}

// ── Job facts ──────────────────────────────────────────────────────────────────

type BreadthRow = { id: string; title: string; targetFunction: string | null; level?: string | null; location?: string | null; targetRemotePolicy?: string | null }

// Per row (rows are shared by every request until the board reloads, and unchanged rows
// survive a reload): the title's function and its readings for the role patterns.
const factsByRow = new WeakMap<BreadthRow, { titleFunction: string; variants: string[] | null; subFn?: string; sub?: string | null }>()

/** A job's side of the classifier. Nothing here depends on the member, so it is worked out once per row. */
export function jobBreadthFacts(row: BreadthRow, occupations: JobOccupations): JobBreadthFacts {
  const { socs, subs } = occupations
  let f = factsByRow.get(row)
  if (!f) factsByRow.set(row, (f = { titleFunction: (inferFunctionFromTitle(row.title) ?? '').toLowerCase(), variants: null }))
  const facts = f
  return {
    titleFunction: facts.titleFunction,
    targetFunction: row.targetFunction,
    soc: socs.get(row.id) ?? null,
    subFunction: (fn) => {
      if (facts.subFn !== fn) {
        const stored = subs.get(row.id)
        const storedFn = stored ? SUB_FUNCTION_BY_KEY.get(stored)?.fn.toLowerCase() : undefined
        facts.sub = stored && (storedFn === fn || (fn === 'people' && storedFn === 'human resources')) ? stored : subFunctionFor({ title: row.title, fn, soc: socs.get(row.id) })
        facts.subFn = fn
      }
      return facts.sub ?? null
    },
    pivotRole: (roles) => {
      facts.variants ??= titleVariants(row.title)
      for (const key of roles) {
        const re = ROLES.get(key)?.titles
        if (re && facts.variants.some((v) => re.test(v))) return key
      }
      return null
    },
  }
}

// ── The board's classifier ─────────────────────────────────────────────────────

/**
 * A job's place on the member's board: its label kind and rank (field, related field,
 * pivot, skills), the relevance criteria it meets (relevance.ts), and — when it misses
 * exactly one Wide may relax — which one ('out' = on neither board).
 */
export interface BreadthPlacement {
  rank: number
  cls: JobClass
  crit: JobCriteria
  relaxed: Relaxed | null | 'out'
  /** At the member's own career stage (the strictest market tier). */
  sameStage: boolean
}

/** A skills-match occupation this close counts as the member's own (relevance.ts function criterion). */
export const NEAR_TWIN_SCORE = 0.92

/** The job's occupation is the member's own, or a near-identical one. */
function closeOccupation(m: MemberBreadthVector, soc: string | undefined): boolean {
  // A stand-in occupation (no title) says nothing about how close a job is to their own work.
  if (!soc || !m.soc || !m.socFromTitle) return false
  return soc === m.soc || (m.similar.get(soc)?.score ?? 0) >= NEAR_TWIN_SCORE
}

/**
 * Function criterion (relevance.ts): their sub-function or a near-identical occupation.
 * Members with neither on file (no title we can read) fall back to their function — the
 * only thing we know — and the report says so.
 */
function functionMatch(m: MemberBreadthVector, cls: JobClass | null, soc: string | undefined, facts: JobBreadthFacts): FunctionMatch {
  // The title says another function: never theirs, whatever the occupation tag says (the
  // crawler's tag can be wrong: "VP, Product Marketing" tagged as an HR occupation).
  const titleFn = facts.titleFunction || (facts.targetFunction ?? '').trim().toLowerCase()
  if (titleFn && !m.functions.has(titleFn)) return cls ? 'adjacent' : 'none'
  const close = closeOccupation(m, soc)
  if (m.subFunction) {
    const sub = SUB_FUNCTION_BY_KEY.get(m.subFunction)
    const jobSub = sub ? facts.subFunction(sub.fn.toLowerCase()) : null
    if (jobSub === m.subFunction) return 'own'
    // Another sub-function of their function (HR business partner for a recruiter): related, not theirs.
    if (jobSub) return 'adjacent'
    return close ? 'own' : cls ? 'adjacent' : 'none'
  }
  if (close) return 'own'
  if (!cls) return 'none'
  if (cls.kind !== 'field') return 'adjacent'
  if (m.soc && m.socFromTitle) return 'adjacent' // same function, but not their occupation
  return 'own' // no sub-function or title occupation on file: their function is all we know
}

// A job's place on the map, per location text (locations repeat across the board).
const placeMemo = new Map<string, JobPlace>()
function jobPlace(location: string | null | undefined, remotePolicy: string | null | undefined): JobPlace {
  const key = `${location ?? ''}|${remotePolicy ?? ''}`
  let hit = placeMemo.get(key)
  if (!hit) {
    const { states, isRemote } = statesFromLocation(location)
    const cs = cityState(location)
    hit = {
      remote: isRemote || (remotePolicy ?? '').toLowerCase() === 'remote',
      placeKeys: cs ? placeKeys(cs.city).map((k) => `${cs.state}|${k}`) : [],
      states,
    }
    if (placeMemo.size > 200_000) placeMemo.clear()
    placeMemo.set(key, hit)
  }
  return hit
}

export interface BreadthClassifier {
  member: MemberBreadthVector
  occupations: JobOccupations
  /** Classified at Wide; null = not on either board. */
  place: (row: BreadthRow) => BreadthPlacement | null
  /** Every criterion for a job, even one on neither board (reports and diagnostics; not memoised). */
  criteria: (row: BreadthRow) => { cls: JobClass | null; crit: JobCriteria }
}

// Placements per member (by what the classifier reads), kept across requests: a member's
// next board view only re-classifies rows that changed. Bounded; dropped with the job-occupation map.
// Each memo can hold a placement for every job in the member's market (the nav badge and the
// market-size count classify the whole level window), so keep few: 200 ran instances out of memory.
const PLACEMENT_MEMO_MAX = 10
const placementMemos = new Map<string, { occupations: JobOccupations; memo: WeakMap<object, BreadthPlacement | null> }>()
function placementMemo(m: MemberBreadthVector, occupations: JobOccupations): WeakMap<object, BreadthPlacement | null> {
  const key = JSON.stringify([
    [...m.functions], m.targetFunction, m.soc, m.subFunction, [...m.pivotTargets.keys()], m.similar.size, [...m.industries], m.stage,
    m.geo ? [m.geo.homeArea?.size ?? 0, m.geo.homeState, m.geo.acceptsRemote, [...m.geo.relocation], m.geo.unknown] : null,
    [...(m.vocab ?? [])],
  ])
  const hit = placementMemos.get(key)
  if (hit && hit.occupations === occupations) return hit.memo
  if (placementMemos.size >= PLACEMENT_MEMO_MAX) placementMemos.delete(placementMemos.keys().next().value as string)
  const memo = new WeakMap<object, BreadthPlacement | null>()
  placementMemos.set(key, { occupations, memo })
  return memo
}

/**
 * The classifier for one member, or null when there's nothing to narrow by (no
 * function, occupation or pivot role) — then the board stays as it was, every job in
 * the level window. Per-job placements are memoised on the row for this member.
 */
export async function loadBreadthClassifier(candidate: BreadthCandidate | null | undefined): Promise<BreadthClassifier | null> {
  if (!candidate) return null
  const [member, occupations] = await Promise.all([memberBreadthVector(candidate), loadJobSocs()])
  if (!hasBreadthBasis(member)) return null
  const memo = placementMemo(member, occupations)
  const criteria = (row: BreadthRow): { cls: JobClass | null; crit: JobCriteria } => {
    const facts = jobBreadthFacts(row, occupations)
    const cls = classifyJob(member, facts, 'wide')
    const soc = occupations.socs.get(row.id)
    return {
      cls,
      crit: {
        fn: functionMatch(member, cls, soc, facts),
        geo: member.geo ? geoMatch(member.geo, jobPlace(row.location, row.targetRemotePolicy)) : true,
        skills: skillsMatch({
          jobSkills: occupations.skills.get(row.id) ?? [],
          memberVocab: member.vocab ?? new Set(),
          occupationBand: soc && member.occupationBand ? member.occupationBand(soc) : null,
        }),
        industry: member.industries.size === 0 || member.industries.has(occupations.industries.get(row.id) ?? ''),
      },
    }
  }
  return {
    member,
    occupations,
    criteria,
    place: (row) => {
      const hit = memo.get(row)
      if (hit !== undefined) return hit
      const { cls, crit } = criteria(row)
      const fn = crit.fn
      let placed: BreadthPlacement | null = null
      if (fn !== 'none') {
        const relaxed = relaxedCriterion(crit)
        if (relaxed !== 'out') {
          const kind: JobClass = fn === 'own' && cls?.kind !== 'field' ? { kind: 'field' } : (cls ?? { kind: 'field' })
          placed = { cls: kind, rank: MATCH_KIND_RANK[kind.kind], crit, relaxed, sameStage: !!member.stage && stageOfRung(row.level) === member.stage }
        }
      }
      memo.set(row, placed)
      return placed
    },
  }
}

/**
 * Why each shown job is on the board ("Your field", "Pivot: …", "Skills match: …"), for
 * the full rows the board loaded. Skills matches name the posting's own skills the
 * member shows (skills matrix) before O*NET's shared skills. Jobs neither breadth keeps
 * (a search) get no label.
 */
export function breadthReasonsFor(
  classifier: BreadthClassifier,
  postings: (BreadthRow & { skills: string[]; industry: string | null })[],
  memberKeywords: string[]
): Map<string, MatchReason> {
  const out = new Map<string, MatchReason>()
  const has = (skill: string) => memberHasSkill(skill, memberKeywords)
  for (const p of postings) {
    const placed = classifier.place(p)
    const cls = placed?.cls ?? classifyJob(classifier.member, jobBreadthFacts(p, classifier.occupations), 'wide')
    if (!cls) continue
    const soc = classifier.occupations.socs.get(p.id) ?? null
    const industryBucket = jobIndustryBucket(p.industry)
    if (placed?.relaxed === 'skills') {
      out.set(p.id, { kind: 'field', label: 'Skills stretch: your field, fewer of the skills it lists' })
      continue
    }
    out.set(p.id, matchReason(classifier.member, cls, { soc, industryBucket }, has, p.skills))
  }
  return out
}

export type { Breadth }

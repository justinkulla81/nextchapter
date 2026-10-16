import 'server-only'
import { prisma } from '@/lib/prisma'
import { resolveCandidateOccupation } from '@/lib/careers/candidate-occupation'
import { normalizeIndustryBucket } from '@/lib/constants/industry-buckets'
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
  narrowFlagsOf,
  NEAR_TWIN_SCORE,
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
}

let jobSocs: { at: number; value: Promise<JobOccupations> } | null = null
let jobSocsLoading: Promise<JobOccupations> | null = null

async function readJobSocs(): Promise<JobOccupations> {
  const rows = await prisma.$queryRaw<{ id: string; socCode: string | null; subFunction: string | null; industry: string | null }[]>`
    SELECT "id", "socCode", "subFunction", "industry" FROM "ExclusiveJobPosting"
    WHERE "archivedAt" IS NULL AND ("socCode" IS NOT NULL OR "subFunction" IS NOT NULL OR "industry" IS NOT NULL)`
  const pool = new Map<string, string>()
  const intern = (v: string) => {
    let hit = pool.get(v)
    if (hit === undefined) pool.set(v, (hit = v))
    return hit
  }
  const socs = new Map<string, string>()
  const subs = new Map<string, string>()
  const industries = new Map<string, string>()
  const bucketOf = new Map<string, string | null>()
  for (const r of rows) {
    if (r.socCode) socs.set(r.id, intern(r.socCode))
    if (r.subFunction) subs.set(r.id, intern(r.subFunction))
    if (r.industry) {
      let b = bucketOf.get(r.industry)
      if (b === undefined) bucketOf.set(r.industry, (b = normalizeIndustryBucket(r.industry)))
      if (b && b !== 'Other') industries.set(r.id, b)
    }
  }
  return { socs, subs, industries }
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
  return jobSocsLoading!.catch(() => ({ socs: new Map<string, string>(), subs: new Map<string, string>(), industries: new Map<string, string>() }))
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
}

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
  const [soc, similarity] = await Promise.all([memberSoc(candidate, sourceRole), loadSimilarityIndex()])
  const industries = new Set(
    [candidate.industryContext, candidate.secondaryIndustryContext, ...(candidate.targetIndustries ?? [])]
      .map((s) => normalizeIndustryBucket(s ?? null))
      .filter((b): b is string => !!b && b !== 'Other')
  )
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
  }
}

// ── Job facts ──────────────────────────────────────────────────────────────────

type BreadthRow = { id: string; title: string; targetFunction: string | null; level?: string | null }

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
 * A job's place on the member's board: its rank (field, related field, pivot, skills) and
 * the Narrow filters it passes (search-breadth.ts NARROW_FLAG). The board picks the filter
 * per member and window (chooseNarrowFilter).
 */
export interface BreadthPlacement {
  rank: number
  flags: number
  cls: JobClass
}

/** The job's occupation is the member's own, or a near-identical one. */
function closeOccupation(m: MemberBreadthVector, soc: string | undefined): boolean {
  // A stand-in occupation (no title) says nothing about how close a job is to their own work.
  if (!soc || !m.soc || !m.socFromTitle) return false
  return soc === m.soc || (m.similar.get(soc)?.score ?? 0) >= NEAR_TWIN_SCORE
}

export interface BreadthClassifier {
  member: MemberBreadthVector
  occupations: JobOccupations
  /** Classified at Wide; null = not on either board. */
  place: (row: BreadthRow) => BreadthPlacement | null
}

// Placements per member (by what the classifier reads), kept across requests: a member's
// next board view only re-classifies rows that changed. Bounded; dropped with the job-occupation map.
const PLACEMENT_MEMO_MAX = 200
const placementMemos = new Map<string, { occupations: JobOccupations; memo: WeakMap<object, BreadthPlacement | null> }>()
function placementMemo(m: MemberBreadthVector, occupations: JobOccupations): WeakMap<object, BreadthPlacement | null> {
  const key = JSON.stringify([[...m.functions], m.targetFunction, m.soc, m.subFunction, [...m.pivotTargets.keys()], m.similar.size, [...m.industries], m.stage])
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
  return {
    member,
    occupations,
    place: (row) => {
      const hit = memo.get(row)
      if (hit !== undefined) return hit
      const cls = classifyJob(member, jobBreadthFacts(row, occupations), 'wide')
      const placed = cls
        ? {
            cls,
            rank: MATCH_KIND_RANK[cls.kind],
            flags: narrowFlagsOf(cls, {
              industryOk: member.industries.size === 0 || member.industries.has(occupations.industries.get(row.id) ?? ''),
              sameStage: !!member.stage && stageOfRung(row.level) === member.stage,
              closeOccupation: closeOccupation(member, occupations.socs.get(row.id)),
            }),
          }
        : null
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
  postings: { id: string; title: string; targetFunction: string | null; skills: string[]; industry: string | null }[],
  memberKeywords: string[]
): Map<string, MatchReason> {
  const out = new Map<string, MatchReason>()
  const has = (skill: string) => memberHasSkill(skill, memberKeywords)
  for (const p of postings) {
    const cls = classifyJob(classifier.member, jobBreadthFacts(p, classifier.occupations), 'wide')
    if (!cls) continue
    const soc = classifier.occupations.socs.get(p.id) ?? null
    out.set(p.id, matchReason(classifier.member, cls, { soc, industryBucket: normalizeIndustryBucket(p.industry) }, has, p.skills))
  }
  return out
}

export type { Breadth }

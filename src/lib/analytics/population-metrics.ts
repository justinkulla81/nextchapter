// Population-report metric computation — Phase 2 Master Script, Part B,
// Prompts 5 & 6. This module is the ONLY place that touches live tables
// for the population report; both the weekly snapshot cron
// (src/app/api/cron/population-snapshot/route.ts) and the manual
// "generate this week's snapshot now" admin trigger call
// `computePopulationSnapshotRows` and nothing else does. The
// `/support/admin/(portal)/population` page itself reads exclusively from
// the `PopulationSnapshot` rows this produces — "Trends read snapshots,
// never live tables" (Prompt 6).
//
// ── Segment types actually written ──────────────────────────────────────
// PopulationSnapshot.segmentType's doc comment lists 8 candidate values:
// "all" | "seniority" | "function" | "industry" | "metro" | "persona" |
// "employment_status" | "usage_tier". This module writes 7 of the 8 real
// segment types below, deliberately skipping `persona` as an INDEPENDENT
// segment type:
//
//   - Investigation (this build pass) confirmed there is no `persona`
//     field anywhere in the schema. The "Which of these sounds like you"
//     persona picker referenced in earlier session work writes directly
//     into `CandidateProfile.currentJobStatus` (the `CurrentJobStatus`
//     enum) — there is no second, independent column behind "persona."
//   - Writing a `persona` segmentType here would mean re-emitting the
//     exact same segmentValue set, memberCounts, and metrics as
//     `employment_status` under a different label — a duplicate table
//     that LOOKS like independent data but isn't. That's worse than
//     omitting it: an admin scanning "Composition by persona" next to
//     "Composition by employment status" would reasonably assume they're
//     different cuts of the population when they're identical.
//   - So: `employment_status` is written (real, from `currentJobStatus`),
//     and the page's Composition/Confidential-mode sections label that
//     same breakdown "Employment status / persona" with a note, rather
//     than rendering two identical tables. If a real, independent persona
//     field is ever added, split this back into two segment types then.
//
// `usage_tier` IS written, but it is a DERIVED classification, not a
// stored field (no such column exists) — see `deriveUsageTier` below.
// `background strength` (also asked for in Prompt 5's Composition list)
// is NOT one of the 8 canonical segmentType values in the schema comment,
// so it isn't written as a crossed segment; instead it's a sub-breakdown
// inside the `all`/`all` row's own metrics blob (`composition.backgroundStrength`),
// derived from the real `pedigreeBonus` field (see that section below).

import 'server-only'
import type { CurrentJobStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { EXCLUDE_SYSTEM_ACCOUNT } from '@/lib/admin/system-account-filter'
import { getActivationItems } from '@/lib/dashboard/activation-items'
import { computeDossierCompleteness, DOSSIER_REFERENCE_TARGET } from '@/lib/scoring/dossier-unlock'

const DAY_MS = 24 * 60 * 60 * 1000

export type SegmentType =
  | 'all'
  | 'seniority'
  | 'function'
  | 'industry'
  | 'metro'
  | 'employment_status'
  | 'usage_tier'

// ── Metrics blob shape ────────────────────────────────────────────────
// Documented TS interface per the phase brief ("keep the metrics blob
// shape well-documented ... since the page will need to read specific
// fields back out of it"), rather than untyped JSON.

export interface FunnelStepMetric {
  key: FunnelStepKey
  label: string
  count: number
  /** % of this segment's memberCount that reached this step. Null only when memberCount is 0. */
  conversionFromStart: number | null
  /** % of the PREVIOUS step's count that also reached this step. Null for the first step. */
  conversionFromPrevious: number | null
  /**
   * Median days between the previous step's timestamp and this step's
   * timestamp, for members who reached both. Null when either step has no
   * persisted per-candidate timestamp to measure from — see the two
   * exceptions noted at each step's definition in `FUNNEL_STEPS` below.
   */
  medianDaysFromPrevious: number | null
}

export type FunnelStepKey =
  | 'resume_uploaded'
  | 'registered'
  | 'activation_complete'
  | 'first_reference_requested'
  | 'five_references_returned'
  | 'both_assessments'
  | 'dossier_complete'

export interface GradeMetrics {
  /** Distribution of MarketRealityComponentScore.grade among segment members who have one computed. */
  compositeGradeDistribution: Record<string, number>
  /** How many segment members have no composite grade computed yet. */
  noCompositeGradeCount: number
  /** Average of each of the 5 components among non-null values (0-100 scale). Null when nobody in the segment has that component scored. */
  componentAverages: {
    experience: number | null
    resume: number | null
    evidence: number | null
    effort: number | null
    market: number | null
  }
  /**
   * Week-over-week grade movement — NOT computed from
   * MarketRealityComponentScore (that table holds only the CURRENT
   * composite grade, no weekly history is persisted for it in this
   * codebase). Computed instead from `MarketRealitySnapshot`, the
   * older six-category grade that IS archived weekly by the existing
   * `market-reality-snapshot` cron — real accumulated per-candidate
   * history already exists there. Null when there isn't yet a second
   * week of MarketRealitySnapshot data to compare against, or when this
   * segment has fewer than MIN_CELL_SIZE members with a movement result
   * (checked at render time, not here).
   */
  gradeMovement: { improved: number; same: number; declined: number; sampleSize: number } | null
}

export interface ActivityMetrics {
  /** Median/p90 computed over THIS WEEK's per-candidate counts (activity logged within [weekStartDate, weekStartDate+7d)), not lifetime totals — comparable week to week. */
  outreachThisWeek: { median: number; p90: number }
  applicationsThisWeek: { median: number; p90: number }
  linkedinPostsThisWeek: { median: number; p90: number }
  communityPostsThisWeek: { median: number; p90: number }
  /** % of segment members who earned the WEEKLY_SPRINT_TARGET_HIT badge for this week. A median/p90 of a 0/1-per-week value isn't meaningful, so this is a share instead — see file-level judgment-call note in the cron route. */
  sprintTargetHitShare: number | null
  /** % of segment members with any logged activity within this week's window. */
  activeThisWeekShare: number | null
  /** % of segment members whose most recent logged activity (any type) is 21+ days before this snapshot's week ends. */
  dormant21PlusShare: number | null
}

export interface SearchOutcomeMetrics {
  /**
   * "Response" has no dedicated timestamp field on JobPosting — proxied as
   * "interviewLandedAt OR declinedAt is set" (the candidate heard SOMETHING
   * back after applying), documented here so a reader of the raw JSON
   * knows this is a proxy, not a literal "response" column.
   */
  applicationToResponseRate: number | null
  responseToInterviewRate: number | null
  interviewToOfferRate: number | null
  appliedCount: number
  respondedCount: number
  interviewCount: number
  offerCount: number
  /** Median days from registrationCompletedAt to BountyClaim.startDate, for APPROVED claims only (self-reported "I got hired," admin-confirmed). Null when fewer than 1 such claim exists in this segment. */
  medianSearchDurationDaysForHired: number | null
  hiredSampleSize: number
}

export interface ConfidentialMetrics {
  /** Share of this segment with CandidateProfile.confidentialSearchMode === true. */
  shareConfidential: number | null
  confidentialCount: number
}

export interface TargetDemandMetrics {
  topTargetRoles: { value: string; count: number }[]
  topTargetIndustries: { value: string; count: number }[]
  topTargetMetros: { value: string; count: number }[]
  /**
   * Spec Prompt 5 asks to cross-reference this against ncrawl posting
   * volume to surface thin markets. Investigated and confirmed: no
   * aggregate-by-industry/metro posting-volume table exists anywhere in
   * this codebase (MarketDifficultySnapshot is per-candidate;
   * MarketConditionsSnapshot is a live non-history cache;
   * ExclusiveJobPosting is a small curated list, not raw market volume).
   * Deliberately left null rather than built — building a new ncrawl
   * aggregation pipeline is out of scope for this pass per the phase
   * brief. See this build's final report for the explicit confirmation.
   */
  ncrawlCrossReference: null
}

export interface CohortRetentionEntry {
  /** Monday 00:00 UTC of the week this cohort registered. */
  joinWeekStartDate: string
  cohortSize: number
  /** How many of that cohort are "active" (any logged activity) during THIS snapshot's week. */
  activeCount: number
}

export interface SegmentPopulationMetrics {
  funnel: FunnelStepMetric[]
  grades: GradeMetrics
  activity: ActivityMetrics
  searchOutcomes: SearchOutcomeMetrics
  confidential: ConfidentialMetrics
  /** Only present on the `all`/`all` row — not meaningful per-segment-slice. */
  targets?: TargetDemandMetrics
  /** Only present on the `all`/`all` row. One entry per join-week cohort seen so far, refreshed fresh each run (this week's "still active" count for every known cohort, not just the newest one) — the page assembles the full grid by reading this field across every historical PopulationSnapshot row. */
  cohortRetention?: CohortRetentionEntry[]
  /** Only present on the `all`/`all` row — derived pedigreeBonus buckets, not a stored field. See file-header comment. */
  backgroundStrength?: Record<string, number>
}

export interface PopulationSnapshotRow {
  segmentType: SegmentType
  segmentValue: string
  memberCount: number
  metrics: SegmentPopulationMetrics
}

// ── Small stats helpers ──────────────────────────────────────────────

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

function p90(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const idx = Math.min(sorted.length - 1, Math.ceil(0.9 * sorted.length) - 1)
  return sorted[Math.max(0, idx)]
}

function pct(numerator: number, denominator: number): number | null {
  if (denominator === 0) return null
  return Math.round((numerator / denominator) * 1000) / 10
}

function avg(values: number[]): number | null {
  if (values.length === 0) return null
  return Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 10) / 10
}

function daysBetween(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / DAY_MS
}

// ── Batch fact-gathering ──────────────────────────────────────────────
// One pass over live tables per cron run, not per segment — the segment
// breakdowns below all slice the same in-memory candidate-fact map.

interface CandidateFacts {
  id: string
  createdAt: Date
  registrationCompletedAt: Date | null
  confidentialSearchMode: boolean
  currentJobStatus: CurrentJobStatus | null
  primaryFunction: string | null
  industryContext: string | null
  metroArea: string | null
  pedigreeBonus: number
  seniorityBand: string | null

  firstResumeUploadedAt: Date | null
  firstReferenceRequestedAt: Date | null
  completedReferenceCount: number
  fifthReferenceReturnedAt: Date | null
  bothAssessmentsAt: Date | null
  allActivationComplete: boolean
  dossierComplete: boolean

  compositeGrade: string | null
  experienceScore: number | null
  resumeScore: number | null
  evidenceScore: number | null
  effortScore: number | null
  marketScore: number | null

  outreachTimestamps: Date[]
  linkedinTimestamps: Date[]
  communityTimestamps: Date[]
  jobPostingCreatedTimestamps: Date[]
  sprintTargetHitWeeks: Date[]

  appliedCount: number
  respondedCount: number
  interviewCount: number
  offerCount: number

  approvedBountyStartDates: Date[]

  usageActionsLifetime: number
}

async function loadCandidateFacts(): Promise<CandidateFacts[]> {
  const [
    profiles,
    resumeAnalyses,
    resumes,
    references,
    operatingProfiles,
    personalityProfiles,
    componentScores,
    outreachLogs,
    linkedinLogs,
    communityPosts,
    jobPostings,
    sprintBadges,
    bountyClaims,
  ] = await Promise.all([
    prisma.candidateProfile.findMany({
      where: EXCLUDE_SYSTEM_ACCOUNT,
      select: {
        id: true,
        createdAt: true,
        registrationCompletedAt: true,
        confidentialSearchMode: true,
        currentJobStatus: true,
        primaryFunction: true,
        industryContext: true,
        metroArea: true,
        pedigreeBonus: true,
      },
    }),
    prisma.resumeAnalysis.findMany({
      select: { candidateId: true, seniorityBand: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.resume.groupBy({ by: ['candidateId'], _min: { uploadedAt: true } }),
    prisma.reference.findMany({
      select: { candidateId: true, status: true, requestedAt: true, completedAt: true },
    }),
    prisma.candidateAssessmentResponse.findMany({ select: { candidateId: true, completedAt: true } }),
    prisma.performanceAssessmentResponse.findMany({ select: { candidateId: true, completedAt: true } }),
    prisma.marketRealityComponentScore.findMany({
      select: {
        candidateId: true,
        grade: true,
        experienceScore: true,
        resumeScore: true,
        evidenceScore: true,
        effortScore: true,
        marketScore: true,
      },
    }),
    prisma.outreachLog.findMany({ select: { candidateId: true, loggedAt: true } }),
    prisma.linkedInActivityLog.findMany({ select: { candidateId: true, loggedAt: true } }),
    prisma.communityPost.findMany({ select: { candidateId: true, createdAt: true } }),
    prisma.jobPosting.findMany({
      select: {
        candidateId: true,
        createdAt: true,
        appliedAt: true,
        interviewLandedAt: true,
        offerReceivedAt: true,
        declinedAt: true,
      },
    }),
    prisma.weeklyBadgeEarned.findMany({
      where: { badgeKey: 'WEEKLY_SPRINT_TARGET_HIT' },
      select: { candidateId: true, weekStartDate: true },
    }),
    prisma.bountyClaim.findMany({
      where: { status: 'APPROVED' },
      select: { candidateId: true, startDate: true },
    }),
  ])

  // Reduce each flat list into a per-candidateId map. Building these once
  // up front (rather than filtering the flat arrays per candidate inside
  // the main loop below) keeps this an O(n) pass instead of O(n * m).
  const seniorityByCandidate = new Map<string, string>()
  for (const a of resumeAnalyses) {
    if (!seniorityByCandidate.has(a.candidateId)) seniorityByCandidate.set(a.candidateId, a.seniorityBand)
  }

  const firstResumeByCandidate = new Map<string, Date>()
  for (const r of resumes) {
    if (r._min.uploadedAt) firstResumeByCandidate.set(r.candidateId, r._min.uploadedAt)
  }

  const referencesByCandidate = new Map<string, typeof references>()
  for (const r of references) {
    const list = referencesByCandidate.get(r.candidateId) ?? []
    list.push(r)
    referencesByCandidate.set(r.candidateId, list)
  }

  const operatingByCandidate = new Map<string, Date>()
  for (const r of operatingProfiles) operatingByCandidate.set(r.candidateId, r.completedAt)
  const personalityByCandidate = new Map<string, Date>()
  for (const r of personalityProfiles) personalityByCandidate.set(r.candidateId, r.completedAt)

  const componentScoreByCandidate = new Map<string, (typeof componentScores)[number]>()
  for (const c of componentScores) componentScoreByCandidate.set(c.candidateId, c)

  function groupTimestamps<T extends { candidateId: string }>(rows: T[], getDate: (r: T) => Date): Map<string, Date[]> {
    const map = new Map<string, Date[]>()
    for (const r of rows) {
      const list = map.get(r.candidateId) ?? []
      list.push(getDate(r))
      map.set(r.candidateId, list)
    }
    return map
  }
  const outreachByCandidate = groupTimestamps(outreachLogs, (r) => r.loggedAt)
  const linkedinByCandidate = groupTimestamps(linkedinLogs, (r) => r.loggedAt)
  const communityByCandidate = groupTimestamps(communityPosts, (r) => r.createdAt)
  const jobPostingCreatedByCandidate = groupTimestamps(jobPostings, (r) => r.createdAt)

  const sprintBadgeByCandidate = new Map<string, Date[]>()
  for (const b of sprintBadges) {
    const list = sprintBadgeByCandidate.get(b.candidateId) ?? []
    list.push(b.weekStartDate)
    sprintBadgeByCandidate.set(b.candidateId, list)
  }

  const jobPostingsByCandidate = new Map<string, typeof jobPostings>()
  for (const j of jobPostings) {
    const list = jobPostingsByCandidate.get(j.candidateId) ?? []
    list.push(j)
    jobPostingsByCandidate.set(j.candidateId, list)
  }

  const bountyByCandidate = new Map<string, Date[]>()
  for (const b of bountyClaims) {
    const list = bountyByCandidate.get(b.candidateId) ?? []
    list.push(b.startDate)
    bountyByCandidate.set(b.candidateId, list)
  }

  const facts: CandidateFacts[] = []

  // getActivationItems / computeDossierCompleteness each run several of
  // their own queries per candidate. Sequential, not Promise.all — this is
  // a weekly batch job with no user waiting on it, and sequential keeps
  // connection-pool pressure bounded regardless of population size (see
  // the cron route's per-item try/catch, same "log and continue" pattern
  // as the market-reality-snapshot precedent).
  //
  // Privacy note (Prompt 8, "enforce at the query layer"): getActivationItems
  // internally selects `blockers`/`motivations` (needed to compute the real
  // `searchStrategyQuestions` completion boolean) — but only the resulting
  // `allActivationComplete` boolean is read out of it below. The actual
  // blocker/motivation VALUES never leave this function scope, are never
  // aggregated, and are never written into PopulationSnapshot.metrics.
  for (const p of profiles) {
    let allActivationComplete = false
    let dossierComplete = false
    try {
      const activation = await getActivationItems(p.id)
      allActivationComplete = activation.allActivationComplete
    } catch (error) {
      console.error('population-metrics: getActivationItems failed for candidate', p.id, error)
    }
    try {
      const dossier = await computeDossierCompleteness(p.id)
      dossierComplete = dossier.isComplete
    } catch (error) {
      console.error('population-metrics: computeDossierCompleteness failed for candidate', p.id, error)
    }

    const candidateReferences = referencesByCandidate.get(p.id) ?? []
    const requestedDates = candidateReferences.map((r) => r.requestedAt)
    const completedDatesSorted = candidateReferences
      .filter((r) => r.status === 'COMPLETED' && r.completedAt !== null)
      .map((r) => r.completedAt as Date)
      .sort((a, b) => a.getTime() - b.getTime())

    const opAt = operatingByCandidate.get(p.id) ?? null
    const perfAt = personalityByCandidate.get(p.id) ?? null
    const bothAssessmentsAt = opAt && perfAt ? new Date(Math.max(opAt.getTime(), perfAt.getTime())) : null

    const componentScore = componentScoreByCandidate.get(p.id)

    const candidateJobPostings = jobPostingsByCandidate.get(p.id) ?? []
    const appliedCount = candidateJobPostings.filter((j) => j.appliedAt !== null).length
    const respondedCount = candidateJobPostings.filter(
      (j) => j.interviewLandedAt !== null || j.declinedAt !== null
    ).length
    const interviewCount = candidateJobPostings.filter((j) => j.interviewLandedAt !== null).length
    const offerCount = candidateJobPostings.filter((j) => j.offerReceivedAt !== null).length

    const outreachTimestamps = outreachByCandidate.get(p.id) ?? []
    const linkedinTimestamps = linkedinByCandidate.get(p.id) ?? []
    const communityTimestamps = communityByCandidate.get(p.id) ?? []
    const jobPostingCreatedTimestamps = jobPostingCreatedByCandidate.get(p.id) ?? []
    const sprintTargetHitWeeks = sprintBadgeByCandidate.get(p.id) ?? []

    const usageActionsLifetime =
      outreachTimestamps.length +
      appliedCount +
      linkedinTimestamps.length +
      communityTimestamps.length +
      sprintTargetHitWeeks.length

    facts.push({
      id: p.id,
      createdAt: p.createdAt,
      registrationCompletedAt: p.registrationCompletedAt,
      confidentialSearchMode: p.confidentialSearchMode,
      currentJobStatus: p.currentJobStatus,
      primaryFunction: p.primaryFunction,
      industryContext: p.industryContext,
      metroArea: p.metroArea,
      pedigreeBonus: p.pedigreeBonus,
      seniorityBand: seniorityByCandidate.get(p.id) ?? null,

      firstResumeUploadedAt: firstResumeByCandidate.get(p.id) ?? null,
      firstReferenceRequestedAt:
        requestedDates.length > 0 ? new Date(Math.min(...requestedDates.map((d) => d.getTime()))) : null,
      completedReferenceCount: completedDatesSorted.length,
      fifthReferenceReturnedAt: completedDatesSorted.length >= DOSSIER_REFERENCE_TARGET ? completedDatesSorted[DOSSIER_REFERENCE_TARGET - 1] : null,
      bothAssessmentsAt,
      allActivationComplete,
      dossierComplete,

      compositeGrade: componentScore?.grade ?? null,
      experienceScore: componentScore?.experienceScore ?? null,
      resumeScore: componentScore?.resumeScore ?? null,
      evidenceScore: componentScore?.evidenceScore ?? null,
      effortScore: componentScore?.effortScore ?? null,
      marketScore: componentScore?.marketScore ?? null,

      outreachTimestamps,
      linkedinTimestamps,
      communityTimestamps,
      jobPostingCreatedTimestamps,
      sprintTargetHitWeeks,

      appliedCount,
      respondedCount,
      interviewCount,
      offerCount,

      approvedBountyStartDates: bountyByCandidate.get(p.id) ?? [],

      usageActionsLifetime,
    })
  }

  return facts
}

// ── Derived "usage tier" (not a stored field) ──────────────────────────
// Tercile split of lifetime activity-action totals across the population
// being segmented right now (recomputed fresh every run, since the
// underlying totals change every week) — documented in this module's
// header comment and in TargetDemandMetrics-adjacent types above.
function deriveUsageTier(candidate: CandidateFacts, allCandidates: CandidateFacts[]): string {
  const sorted = [...allCandidates].map((c) => c.usageActionsLifetime).sort((a, b) => a - b)
  if (sorted.length === 0) return 'light'
  const lowCut = sorted[Math.floor(sorted.length / 3)]
  const highCut = sorted[Math.floor((2 * sorted.length) / 3)]
  if (candidate.usageActionsLifetime <= lowCut) return 'light'
  if (candidate.usageActionsLifetime <= highCut) return 'moderate'
  return 'power'
}

// ── Background-strength buckets (all/all row only, derived) ────────────
function deriveBackgroundStrengthBuckets(candidates: CandidateFacts[]): Record<string, number> {
  const buckets: Record<string, number> = { limited_signal: 0, some_signal: 0, strong_signal: 0 }
  for (const c of candidates) {
    if (c.pedigreeBonus <= 0) buckets.limited_signal++
    else if (c.pedigreeBonus <= 2) buckets.some_signal++
    else buckets.strong_signal++
  }
  return buckets
}

// ── Funnel ──────────────────────────────────────────────────────────

const FUNNEL_STEP_LABELS: Record<FunnelStepKey, string> = {
  resume_uploaded: 'Resume uploaded',
  registered: 'Registered',
  activation_complete: 'Activation complete',
  first_reference_requested: 'First reference requested',
  five_references_returned: '3 references returned',
  both_assessments: 'Both assessments complete',
  dossier_complete: 'Dossier complete',
}

function computeFunnel(candidates: CandidateFacts[]): FunnelStepMetric[] {
  const memberCount = candidates.length

  // Each entry: the timestamp getter used for median-days-from-previous.
  // `activation_complete` and `dossier_complete` have no persisted
  // per-candidate completion timestamp anywhere in the schema — both are
  // computed live from current state, never archived with a "completed at"
  // moment. Their conversion counts are real; their time-between-steps is
  // honestly null rather than invented.
  const steps: { key: FunnelStepKey; reached: (c: CandidateFacts) => boolean; at: (c: CandidateFacts) => Date | null }[] = [
    { key: 'resume_uploaded', reached: (c) => c.firstResumeUploadedAt !== null, at: (c) => c.firstResumeUploadedAt },
    { key: 'registered', reached: (c) => c.registrationCompletedAt !== null, at: (c) => c.registrationCompletedAt },
    { key: 'activation_complete', reached: (c) => c.allActivationComplete, at: () => null },
    {
      key: 'first_reference_requested',
      reached: (c) => c.firstReferenceRequestedAt !== null,
      at: (c) => c.firstReferenceRequestedAt,
    },
    {
      key: 'five_references_returned',
      reached: (c) => c.fifthReferenceReturnedAt !== null,
      at: (c) => c.fifthReferenceReturnedAt,
    },
    { key: 'both_assessments', reached: (c) => c.bothAssessmentsAt !== null, at: (c) => c.bothAssessmentsAt },
    { key: 'dossier_complete', reached: (c) => c.dossierComplete, at: () => null },
  ]

  const results: FunnelStepMetric[] = []
  let previousCount: number | null = null
  let previousStepIndex = -1

  steps.forEach((step, i) => {
    const reachedCandidates = candidates.filter(step.reached)
    const count = reachedCandidates.length
    const conversionFromStart = pct(count, memberCount)
    const conversionFromPrevious = previousCount === null ? null : pct(count, previousCount)

    let medianDaysFromPrevious: number | null = null
    if (previousStepIndex >= 0) {
      const prevStep = steps[previousStepIndex]
      const deltas: number[] = []
      for (const c of candidates) {
        const prevAt = prevStep.at(c)
        const thisAt = step.at(c)
        if (prevAt && thisAt && thisAt.getTime() >= prevAt.getTime()) {
          deltas.push(daysBetween(prevAt, thisAt))
        }
      }
      medianDaysFromPrevious = deltas.length > 0 ? Math.round(median(deltas) * 10) / 10 : null
    }

    results.push({
      key: step.key,
      label: FUNNEL_STEP_LABELS[step.key],
      count,
      conversionFromStart,
      conversionFromPrevious,
      medianDaysFromPrevious,
    })

    previousCount = count
    previousStepIndex = i
  })

  return results
}

// ── Grades ──────────────────────────────────────────────────────────

async function computeGradeMovement(candidateIds: Set<string>): Promise<GradeMetrics['gradeMovement']> {
  if (candidateIds.size === 0) return null

  const recentWeeks = await prisma.marketRealitySnapshot.findMany({
    select: { weekStartDate: true },
    distinct: ['weekStartDate'],
    orderBy: { weekStartDate: 'desc' },
    take: 2,
  })
  if (recentWeeks.length < 2) return null

  const [thisWeek, lastWeek] = recentWeeks.map((w) => w.weekStartDate)
  const [thisWeekRows, lastWeekRows] = await Promise.all([
    prisma.marketRealitySnapshot.findMany({
      where: { weekStartDate: thisWeek, candidateId: { in: [...candidateIds] } },
      select: { candidateId: true, grade: true },
    }),
    prisma.marketRealitySnapshot.findMany({
      where: { weekStartDate: lastWeek, candidateId: { in: [...candidateIds] } },
      select: { candidateId: true, grade: true },
    }),
  ])

  const GRADE_RANK: Record<string, number> = { F: 0, D: 1, C: 2, B: 3, A: 4 }
  const lastWeekByCandidate = new Map(lastWeekRows.map((r) => [r.candidateId, r.grade]))

  let improved = 0
  let same = 0
  let declined = 0
  for (const row of thisWeekRows) {
    const prevGrade = lastWeekByCandidate.get(row.candidateId)
    if (!prevGrade) continue
    const prevRank = GRADE_RANK[prevGrade] ?? -1
    const curRank = GRADE_RANK[row.grade] ?? -1
    if (prevRank < 0 || curRank < 0) continue
    if (curRank > prevRank) improved++
    else if (curRank < prevRank) declined++
    else same++
  }

  const sampleSize = improved + same + declined
  if (sampleSize === 0) return null
  return { improved, same, declined, sampleSize }
}

async function computeGrades(candidates: CandidateFacts[]): Promise<GradeMetrics> {
  const compositeGradeDistribution: Record<string, number> = {}
  let noCompositeGradeCount = 0
  for (const c of candidates) {
    if (c.compositeGrade) {
      compositeGradeDistribution[c.compositeGrade] = (compositeGradeDistribution[c.compositeGrade] ?? 0) + 1
    } else {
      noCompositeGradeCount++
    }
  }

  const componentAverages = {
    experience: avg(candidates.map((c) => c.experienceScore).filter((v): v is number => v !== null)),
    resume: avg(candidates.map((c) => c.resumeScore).filter((v): v is number => v !== null)),
    evidence: avg(candidates.map((c) => c.evidenceScore).filter((v): v is number => v !== null)),
    effort: avg(candidates.map((c) => c.effortScore).filter((v): v is number => v !== null)),
    market: avg(candidates.map((c) => c.marketScore).filter((v): v is number => v !== null)),
  }

  const gradeMovement = await computeGradeMovement(new Set(candidates.map((c) => c.id)))

  return { compositeGradeDistribution, noCompositeGradeCount, componentAverages, gradeMovement }
}

// ── Activity ────────────────────────────────────────────────────────

function countInWeek(timestamps: Date[], weekStart: Date, weekEnd: Date): number {
  return timestamps.filter((t) => t.getTime() >= weekStart.getTime() && t.getTime() < weekEnd.getTime()).length
}

function computeActivity(candidates: CandidateFacts[], weekStartDate: Date): ActivityMetrics {
  const weekEnd = new Date(weekStartDate.getTime() + 7 * DAY_MS)

  const outreachCounts = candidates.map((c) => countInWeek(c.outreachTimestamps, weekStartDate, weekEnd))
  const applicationCounts = candidates.map((c) => countInWeek(c.jobPostingCreatedTimestamps, weekStartDate, weekEnd))
  const linkedinCounts = candidates.map((c) => countInWeek(c.linkedinTimestamps, weekStartDate, weekEnd))
  const communityCounts = candidates.map((c) => countInWeek(c.communityTimestamps, weekStartDate, weekEnd))

  const sprintHitters = candidates.filter((c) =>
    c.sprintTargetHitWeeks.some((w) => w.getTime() === weekStartDate.getTime())
  ).length

  const activeThisWeek = candidates.filter((c) => {
    const allTimestamps = [
      ...c.outreachTimestamps,
      ...c.linkedinTimestamps,
      ...c.communityTimestamps,
      ...c.jobPostingCreatedTimestamps,
      ...c.sprintTargetHitWeeks,
    ]
    return allTimestamps.some((t) => t.getTime() >= weekStartDate.getTime() && t.getTime() < weekEnd.getTime())
  }).length

  const dormantCutoff = new Date(weekEnd.getTime() - 21 * DAY_MS)
  const dormant = candidates.filter((c) => {
    const allTimestamps = [
      ...c.outreachTimestamps,
      ...c.linkedinTimestamps,
      ...c.communityTimestamps,
      ...c.jobPostingCreatedTimestamps,
      ...c.sprintTargetHitWeeks,
    ]
    if (allTimestamps.length === 0) return true // never any logged activity — dormant by definition
    const lastActive = new Date(Math.max(...allTimestamps.map((t) => t.getTime())))
    return lastActive.getTime() < dormantCutoff.getTime()
  }).length

  return {
    outreachThisWeek: { median: median(outreachCounts), p90: p90(outreachCounts) },
    applicationsThisWeek: { median: median(applicationCounts), p90: p90(applicationCounts) },
    linkedinPostsThisWeek: { median: median(linkedinCounts), p90: p90(linkedinCounts) },
    communityPostsThisWeek: { median: median(communityCounts), p90: p90(communityCounts) },
    sprintTargetHitShare: pct(sprintHitters, candidates.length),
    activeThisWeekShare: pct(activeThisWeek, candidates.length),
    dormant21PlusShare: pct(dormant, candidates.length),
  }
}

// ── Search outcomes ────────────────────────────────────────────────

function computeSearchOutcomes(candidates: CandidateFacts[]): SearchOutcomeMetrics {
  const appliedCount = candidates.reduce((s, c) => s + c.appliedCount, 0)
  const respondedCount = candidates.reduce((s, c) => s + c.respondedCount, 0)
  const interviewCount = candidates.reduce((s, c) => s + c.interviewCount, 0)
  const offerCount = candidates.reduce((s, c) => s + c.offerCount, 0)

  const durations: number[] = []
  for (const c of candidates) {
    if (!c.registrationCompletedAt || c.approvedBountyStartDates.length === 0) continue
    const earliestStart = new Date(Math.min(...c.approvedBountyStartDates.map((d) => d.getTime())))
    const days = daysBetween(c.registrationCompletedAt, earliestStart)
    if (days >= 0) durations.push(days)
  }

  return {
    applicationToResponseRate: pct(respondedCount, appliedCount),
    responseToInterviewRate: pct(interviewCount, respondedCount),
    interviewToOfferRate: pct(offerCount, interviewCount),
    appliedCount,
    respondedCount,
    interviewCount,
    offerCount,
    medianSearchDurationDaysForHired: durations.length > 0 ? Math.round(median(durations)) : null,
    hiredSampleSize: durations.length,
  }
}

// ── Confidential mode ──────────────────────────────────────────────

function computeConfidential(candidates: CandidateFacts[]): ConfidentialMetrics {
  const confidentialCount = candidates.filter((c) => c.confidentialSearchMode).length
  return { shareConfidential: pct(confidentialCount, candidates.length), confidentialCount }
}

// ── Targets and demand (all/all row only) ──────────────────────────

function topN(values: string[], n = 10): { value: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const v of values) {
    if (!v) continue
    counts.set(v, (counts.get(v) ?? 0) + 1)
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([value, count]) => ({ value, count }))
}

async function computeTargetsAndDemand(): Promise<TargetDemandMetrics> {
  const profiles = await prisma.candidateProfile.findMany({
    where: EXCLUDE_SYSTEM_ACCOUNT,
    select: { targetRoleType: true, targetIndustries: true, metroArea: true },
  })
  return {
    topTargetRoles: topN(profiles.map((p) => p.targetRoleType).filter((v): v is string => !!v)),
    topTargetIndustries: topN(profiles.flatMap((p) => p.targetIndustries)),
    // "Target metro" doesn't exist as its own field (see investigation) —
    // metroArea is CURRENT location, not a stated target. Shown here as
    // "current metro concentration" rather than fabricating a target-metro
    // signal; the page labels this accordingly.
    topTargetMetros: topN(profiles.map((p) => p.metroArea).filter((v): v is string => !!v)),
    ncrawlCrossReference: null,
  }
}

// ── Retention cohort grid (all/all row only) ────────────────────────

function getMondayUTC(date: Date): Date {
  const d = new Date(date)
  d.setUTCHours(0, 0, 0, 0)
  const day = d.getUTCDay()
  const diffToMonday = day === 0 ? -6 : 1 - day
  d.setUTCDate(d.getUTCDate() + diffToMonday)
  return d
}

function computeCohortRetention(candidates: CandidateFacts[], weekStartDate: Date): CohortRetentionEntry[] {
  const weekEnd = new Date(weekStartDate.getTime() + 7 * DAY_MS)

  const cohorts = new Map<string, CandidateFacts[]>()
  for (const c of candidates) {
    if (!c.registrationCompletedAt) continue
    const joinWeek = getMondayUTC(c.registrationCompletedAt)
    if (joinWeek.getTime() > weekStartDate.getTime()) continue // hasn't joined yet as of this snapshot's week
    const key = joinWeek.toISOString()
    const list = cohorts.get(key) ?? []
    list.push(c)
    cohorts.set(key, list)
  }

  const entries: CohortRetentionEntry[] = []
  for (const [joinWeekIso, members] of cohorts) {
    const activeCount = members.filter((c) => {
      const allTimestamps = [
        ...c.outreachTimestamps,
        ...c.linkedinTimestamps,
        ...c.communityTimestamps,
        ...c.jobPostingCreatedTimestamps,
        ...c.sprintTargetHitWeeks,
      ]
      return allTimestamps.some((t) => t.getTime() >= weekStartDate.getTime() && t.getTime() < weekEnd.getTime())
    }).length
    entries.push({ joinWeekStartDate: joinWeekIso, cohortSize: members.length, activeCount })
  }

  return entries.sort((a, b) => a.joinWeekStartDate.localeCompare(b.joinWeekStartDate))
}

// ── Per-segment-slice metrics assembly ──────────────────────────────

async function computeMetricsForSlice(
  candidates: CandidateFacts[],
  weekStartDate: Date,
  isAllSegment: boolean
): Promise<SegmentPopulationMetrics> {
  const [funnel, grades, searchOutcomes] = [
    computeFunnel(candidates),
    await computeGrades(candidates),
    computeSearchOutcomes(candidates),
  ]
  const activity = computeActivity(candidates, weekStartDate)
  const confidential = computeConfidential(candidates)

  const metrics: SegmentPopulationMetrics = { funnel, grades, activity, searchOutcomes, confidential }

  if (isAllSegment) {
    metrics.targets = await computeTargetsAndDemand()
    metrics.cohortRetention = computeCohortRetention(candidates, weekStartDate)
    metrics.backgroundStrength = deriveBackgroundStrengthBuckets(candidates)
  }

  return metrics
}

// ── Entry point ──────────────────────────────────────────────────────

export async function computePopulationSnapshotRows(weekStartDate: Date): Promise<PopulationSnapshotRow[]> {
  const facts = await loadCandidateFacts()
  const rows: PopulationSnapshotRow[] = []

  // all/all
  rows.push({
    segmentType: 'all',
    segmentValue: 'all',
    memberCount: facts.length,
    metrics: await computeMetricsForSlice(facts, weekStartDate, true),
  })

  const dimensionGetters: { type: Exclude<SegmentType, 'all'>; get: (c: CandidateFacts) => string | null }[] = [
    { type: 'seniority', get: (c) => c.seniorityBand },
    { type: 'function', get: (c) => c.primaryFunction },
    { type: 'industry', get: (c) => c.industryContext },
    { type: 'metro', get: (c) => c.metroArea },
    { type: 'employment_status', get: (c) => c.currentJobStatus },
    { type: 'usage_tier', get: (c) => deriveUsageTier(c, facts) },
  ]

  for (const dim of dimensionGetters) {
    const grouped = new Map<string, CandidateFacts[]>()
    for (const c of facts) {
      const value = dim.get(c)
      if (!value) continue // no fabricated "Unknown" bucket — a candidate with no value for this dimension just isn't counted in this breakdown
      const list = grouped.get(value) ?? []
      list.push(c)
      grouped.set(value, list)
    }
    for (const [value, members] of grouped) {
      rows.push({
        segmentType: dim.type,
        segmentValue: value,
        memberCount: members.length,
        metrics: await computeMetricsForSlice(members, weekStartDate, false),
      })
    }
  }

  return rows
}

export async function upsertPopulationSnapshotRows(weekStartDate: Date, rows: PopulationSnapshotRow[]): Promise<number> {
  let written = 0
  for (const row of rows) {
    try {
      await prisma.populationSnapshot.upsert({
        where: {
          weekStartDate_segmentType_segmentValue: {
            weekStartDate,
            segmentType: row.segmentType,
            segmentValue: row.segmentValue,
          },
        },
        create: {
          weekStartDate,
          segmentType: row.segmentType,
          segmentValue: row.segmentValue,
          memberCount: row.memberCount,
          metrics: row.metrics as unknown as object,
        },
        update: {
          memberCount: row.memberCount,
          metrics: row.metrics as unknown as object,
          computedAt: new Date(),
        },
      })
      written++
    } catch (error) {
      console.error(
        'population-snapshot: upsert failed for',
        row.segmentType,
        row.segmentValue,
        weekStartDate.toISOString(),
        error
      )
    }
  }
  return written
}

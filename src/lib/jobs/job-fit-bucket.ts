import 'server-only'
import type { CandidateProfile, CompanySizeBand, ExclusiveJobPosting, SurfacedJob } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { computeMatchScore, priorityMultiplier } from '@/lib/matching/compute-match-score'
import { inferFunctionFromTitle, inferLevelFromTitle } from '@/lib/jobs/infer-job-function'
import { calibratedLevelRank, calibratedLevelDistance } from '@/lib/scoring/level-rank'
import { isVagueTargetRole } from '@/lib/constants/onboarding'
import { titlesShareRoleFamily } from '@/lib/constants/role-family-keywords'
import type { FitBucket } from '@/lib/jobs/fit-bucket-types'
import type { Grade } from '@/lib/scoring/grade'
import { detectRequiredCredential, candidateMeetsCredentialGate } from '@/lib/jobs/credential-gate'

// The "Quick-read" fit signal shown on every Discover card — free, no LLM
// call, computed for every candidate x listing pair. Deliberately a bucket,
// never a raw number, matching the sitewide rule against showing precise
// scores anywhere a candidate can see them. The real per-listing fit
// analysis (analyzeJobFit) only runs on demand, from the "See full fit"
// bridge action. See fit-bucket-types.ts for the FitBucket type/label
// (kept separate, with no 'server-only' import, so client components can
// render the label without pulling this file's server-only deps in).

// The score a listing needs to clear to count as a "strong" fit — used by
// every fit-bucket consumer below (candidate Discover badges, SurfacedJob
// badges, admin review). The ATS admission gate uses its own harder,
// two-part function+seniority check instead (see ats-job-board-feed.ts) —
// a continuous score maxed over a large, diverse candidate pool proved too
// easy to clear for that use case.
export const STRONG_FIT_THRESHOLD = 70
// Shared with the admin-side callers further down this file (formerly its
// own separate 45 constant there) so "good fit" means the same score cutoff
// everywhere, including the unconfident-function cap in
// computeEnrichedFitScore below.
const GOOD_FIT_THRESHOLD = 45

function bucketFromScore(score: number): FitBucket {
  if (score >= STRONG_FIT_THRESHOLD) return 'strong'
  if (score >= GOOD_FIT_THRESHOLD) return 'good'
  return 'stretch'
}

// Below the "good fit" bar, the label needs to know which direction the
// level mismatch runs — "Stretch" is only right when the ROLE reaches
// above the candidate (a real aim-higher case) or the comparison is
// inconclusive (missing level data on either side). When the candidate is
// actually above the role's level, "Stretch" reads as encouraging when
// it's the opposite problem — that gets its own bucket instead, split by
// how big the gap is: a small step down ('below_level') vs. a real
// overqualification case ('overqualified', e.g. a former CEO/Partner shown
// a Manager posting). Mirrors the same calibratedLevelRank/
// calibratedLevelDistance math computeMatchScore uses internally for its
// own level-match points, so this never disagrees with the score it's
// annotating.
function bucketFromScoreAndLevel(score: number, candidate: FitCandidate, posting: FitPostingLike): FitBucket {
  const bucket = bucketFromScore(score)
  if (bucket !== 'stretch') return bucket

  const candidateScore = candidate.levelRankScore ?? calibratedLevelRank(candidate.highestLevelReached, null)
  const roleLevel = posting.targetLevel ?? inferLevelFromTitle(posting.title)
  const roleScore = calibratedLevelRank(roleLevel, posting.companySizeBand ?? null)
  // Missing data on either side, or the role is at/above the candidate's
  // level — can't rule out a genuine aim-higher case, so "Stretch" stands.
  if (candidateScore === null || roleScore === null || roleScore >= candidateScore) return 'stretch'

  return calibratedLevelDistance(candidateScore, roleScore) >= 3 ? 'overqualified' : 'below_level'
}

// Widened to carry every signal the enriched scorer below uses — industry,
// years of experience, and resume keywords used to be admin-only
// (AdminFitCandidate), but the candidate-facing Discover/SurfacedJob
// buckets need the same signals now that they share one scoring path with
// the admin review queue instead of a thinner computeMatchScore-only call.
type FitCandidate = Pick<
  CandidateProfile,
  | 'primaryFunction'
  | 'secondaryFunction'
  | 'highestLevelReached'
  | 'levelRankScore'
  | 'remotePreference'
  | 'currentCity'
  | 'currentState'
  | 'openToRelocation'
  | 'targetCompMin'
  | 'compFlexible'
  | 'targetRoleType'
  | 'resumeKeywords'
  | 'yearsExperience'
  | 'industryContext'
  | 'secondaryIndustryContext'
  | 'targetIndustries'
  | 'hasJD'
  | 'hasMD'
  | 'hasDO'
  | 'targetCompanySize'
  | 'priorityMaxComp'
  | 'priorityWorkLife'
  | 'priorityBrandName'
  | 'priorityMission'
>

// Candidate's 3-bucket company-size preference (COMPANY_SIZE_OPTIONS in
// src/lib/constants/onboarding.ts) mapped to the resolver's 8-tier band
// (src/lib/market/company-size.ts) — 'Any' or null intentionally has no
// entry here, read as "no preference."
const COMPANY_SIZE_TARGET_BANDS: Record<string, CompanySizeBand[]> = {
  '1-50': ['MICRO', 'SMALL'],
  '50-500': ['SMALL_MID', 'MID'],
  '500+': ['MID_LARGE', 'LARGE', 'ENTERPRISE', 'MEGA'],
}

// Binary, same shape as industryMatchBonus below — a mismatch or an
// unresolved band both read as neutral (0), never a penalty, so a company
// outside the candidate's stated size preference still shows, just without
// this bonus. Scaled by how highly the candidate ranked a recognizable
// brand name (Part 3) — large/enterprise/mega bands double as the closest
// existing recognizability proxy, since there's no separate brand
// classifier.
function companySizeMatchBonus(
  targetCompanySize: string | null,
  companySizeBand: CompanySizeBand | null | undefined,
  priorityBrandNameRank: number | null
): number {
  if (!targetCompanySize || targetCompanySize === 'Any' || !companySizeBand) return 0
  const acceptable = COMPANY_SIZE_TARGET_BANDS[targetCompanySize]
  if (!acceptable || !acceptable.includes(companySizeBand)) return 0
  return Math.round(10 * priorityMultiplier(priorityBrandNameRank))
}

// id/firstName/lastName/email are only needed by admin-side display and the
// two candidate-centric ranking helpers below (rankPendingPostingsForCandidate,
// rankCandidatesByFitCoverage) — harmless to carry on every caller.
export type AdminFitCandidate = FitCandidate & Pick<CandidateProfile, 'id' | 'firstName' | 'lastName' | 'email'>

// Common enough across totally unrelated titles ("Corporate Accounting" vs
// "Corporate Development", "Senior Director, Business Development" vs
// "Senior Director, Product") that a shared hit on one of these alone
// shouldn't read as real title overlap — real bug, not hypothetical: it was
// letting "Corporate Accounting" register as a partial match against a
// stated target of "VP of Corporate Development" purely on the word
// "corporate", when the two have nothing else in common.
const GENERIC_TITLE_WORDS = new Set([
  'corporate', 'senior', 'director', 'manager', 'executive', 'head', 'global',
  'lead', 'chief', 'associate', 'vice', 'president', 'principal', 'partner',
  'officer', 'specialist', 'coordinator', 'analyst',
])

function significantWords(text: string): string[] {
  return text
    .split(/\s+/)
    .map((w) => w.replace(/[^a-z0-9&]/g, ''))
    .filter((w) => w.length > 2 && !GENERIC_TITLE_WORDS.has(w))
}

function titleSimilarityBonus(targetRoleType: string | null, postingTitle: string): number {
  if (!targetRoleType || isVagueTargetRole(targetRoleType)) return 0
  const target = targetRoleType.trim().toLowerCase()
  if (!target) return 0
  const title = postingTitle.toLowerCase()
  if (title === target) return 20
  if (title.includes(target) || target.includes(title)) return 16
  const targetWords = significantWords(target)
  const titleWords = new Set(significantWords(title))
  const sharedWordCount = targetWords.filter((w) => titleWords.has(w)).length
  const sameFamily = titlesShareRoleFamily(target, title)
  // A single shared word carries real signal when it's corroborated by a
  // shared role family (role-family-keywords.ts); alone, one common word is
  // too easy to hit by coincidence between otherwise-unrelated titles — real
  // bug, not hypothetical: "Corporate Development" and "Business
  // Development" share only "development" but sit in different families
  // (M&A/Corporate-Development vs. Sales/Business-Development), and that
  // one word was enough to register as a near-full title match.
  const wordOverlapBonus =
    targetWords.length === 0 || (sharedWordCount === 1 && targetWords.length === 1 && !sameFamily)
      ? 0
      : Math.round((sharedWordCount / targetWords.length) * 16)
  // Title text alone misses functionally-related roles that share no
  // words — "Corporate Development VP" and "Investment Partner" are both
  // M&A-adjacent but share no substring. A shared role-family keyword is a
  // weaker signal than literal title overlap, so it only matters when word
  // overlap didn't already beat it.
  const familyBonus = sameFamily ? 12 : 0
  return Math.max(wordOverlapBonus, familyBonus)
}

// A candidate with a substantial keyword set (6+, pulled from their resume)
// needs real corroboration from the posting text before that keyword
// signal counts as confident — one or two incidental matches out of a
// dozen skills isn't meaningfully "this role uses my skills." Below 6
// keywords there isn't enough volume for a ratio to mean anything, so no
// gate applies (the raw hit count still contributes via `bonus`).
const KEYWORD_GATE_MIN_COUNT = 6
const KEYWORD_GATE_MIN_RATIO = 0.25

function keywordMatchInfo(resumeKeywords: string[], postingText: string): { bonus: number; failsGate: boolean } {
  if (resumeKeywords.length === 0) return { bonus: 0, failsGate: false }
  const lower = postingText.toLowerCase()
  const hits = resumeKeywords.filter((kw) => kw && lower.includes(kw.toLowerCase())).length
  const ratio = hits / resumeKeywords.length
  const failsGate = resumeKeywords.length >= KEYWORD_GATE_MIN_COUNT && ratio < KEYWORD_GATE_MIN_RATIO
  return { bonus: Math.round(ratio * 10), failsGate }
}

// Binary, not ratio-based — postings rarely name an industry explicitly
// enough to score partial credit against, so this only rewards a real
// mention of one of the candidate's target industries (or their own
// resume-derived industry) somewhere in the title/company/description.
// Neutral (0, no penalty) when the candidate hasn't set any — most
// candidates haven't filled in targetIndustries, and an empty array
// shouldn't read as "targeting nothing."
function industryMatchBonus(
  candidate: Pick<FitCandidate, 'targetIndustries' | 'industryContext' | 'secondaryIndustryContext' | 'priorityMission'>,
  postingText: string
): number {
  const targets = [candidate.industryContext, candidate.secondaryIndustryContext, ...candidate.targetIndustries].filter(
    (s): s is string => !!s && s.trim().length > 0
  )
  if (targets.length === 0) return 0
  const lower = postingText.toLowerCase()
  const matches = targets.some((t) => lower.includes(t.toLowerCase()))
  // Approximate proxy for "mission alignment" (Part 3 of the tradeoff-
  // priority reweight) — industry match is the closest existing signal to
  // it; no separate mission classifier exists.
  return matches ? Math.round(10 * priorityMultiplier(candidate.priorityMission)) : 0
}

// "Ideal" match for the title/industry/geo tiering split (find-my-job
// recommendations + market digest, per the "88,099 open roles" complaint —
// a single unfiltered count/list reads as inflated, so real matches are
// split into a small "ideal" tier that meets all three criteria and a
// larger "broader" tier that's title-only). Every job in this pool is
// already title/function-filtered by the surfacing pipeline, so this only
// needs to check industry and geo — and geo deliberately means an actual
// local/remote fit, not "willing to relocate," since papering over that
// distinction is exactly what produced the inflated number in the first
// place.
function matchesTargetIndustry(
  candidate: Pick<FitCandidate, 'targetIndustries' | 'industryContext' | 'secondaryIndustryContext'>,
  postingText: string
): boolean {
  const targets = [candidate.industryContext, candidate.secondaryIndustryContext, ...candidate.targetIndustries].filter(
    (s): s is string => !!s && s.trim().length > 0
  )
  if (targets.length === 0) return false
  const lower = postingText.toLowerCase()
  return targets.some((t) => lower.includes(t.toLowerCase()))
}

function matchesTargetGeo(
  candidate: Pick<FitCandidate, 'remotePreference' | 'currentCity' | 'currentState'>,
  posting: FitPostingLike
): boolean {
  const role = postingToRole(posting)
  if (role.remotePolicy === 'remote' && (candidate.remotePreference === 'remote' || candidate.remotePreference === 'flexible')) {
    return true
  }
  const location = (role.locationRequirement ?? '').toLowerCase()
  if (candidate.currentCity && location.includes(candidate.currentCity.toLowerCase())) return true
  if (candidate.currentState && location.includes(candidate.currentState.toLowerCase())) return true
  return false
}

function isIdealMatch(candidate: FitCandidate, posting: FitPostingLike): boolean {
  const postingText = `${posting.title} ${posting.description ?? ''} ${posting.location ?? ''}`
  return matchesTargetIndustry(candidate, postingText) && matchesTargetGeo(candidate, posting)
}

// Best-effort extraction of a minimum-years requirement from free-text
// posting copy ("5+ years", "3-5 years of experience") — same
// regex-over-free-text approach already used for ATS salary parsing
// (parseSalaryRange in ats-job-board-feed.ts). Returns null when nothing
// matches, which callers treat as "no requirement stated," not "zero
// years required."
function parseMinYearsRequired(text: string): number | null {
  const match = text.match(/(\d{1,2})\+?\s*(?:-\s*\d{1,2}\s*)?\s*years?/i)
  if (!match) return null
  const years = parseInt(match[1], 10)
  return Number.isNaN(years) ? null : years
}

function yearsExperienceBonus(candidateYears: number | null, postingText: string): number {
  const required = parseMinYearsRequired(postingText)
  if (required === null || candidateYears === null) return 5 // insufficient data on one side — neutral, not a penalty
  if (candidateYears >= required) return 10
  if (candidateYears >= required - 2) return 5 // close enough to be worth surfacing, not a confident match
  return 0
}

// ATS-fed OPEN postings never have targetRemotePolicy set (that field only
// exists for recruiter TARGETED listings) — without this, a posting whose
// own location literally says "Remote" never gets read as remote-friendly,
// under-crediting fit for candidates who'd be a good match for it.
function inferRemoteFromLocation(location: string | null): boolean {
  return location != null && /\bremote\b/i.test(location)
}

// The full shape the enriched scorer below needs from a posting — deliberately
// a plain interface, not a Prisma Pick, so both ExclusiveJobPosting rows and
// adapted SurfacedJob rows (which have no targeting/comp fields at all) can
// satisfy it via a small object-literal adapter at the call site.
interface FitPostingLike {
  title: string
  description: string | null
  location: string | null
  salaryMin: number | null
  salaryMax: number | null
  targetFunction: string | null
  targetLevel: string | null
  targetRemotePolicy: string | null
  targetLocation: string | null
  // Pre-resolved by the caller (resolveCompanySizeBand in
  // src/lib/market/company-size.ts is async; this scorer is not) — omitted
  // or null both read as "unresolved," i.e. neutral, never a penalty.
  companySizeBand?: CompanySizeBand | null
}

// Deliberately no employerCompanySizeBand here — ExclusiveJobPosting has no
// synchronous path to a real company size (companyName is a denormalized
// free-text string, not an EmployerProfile relation), and this function is
// called synchronously from the candidate-facing Discover feed and
// SurfacedJob badges, where an async per-listing company-size lookup would
// be a much bigger change than this pass takes on. computeMatchScore treats
// the missing band as "unknown" (anchor, no adjustment) — see
// ats-job-board-feed.ts for the one place job-side company size IS applied
// (a small, fixed, known company list, resolved once per run).
function postingToRole(posting: FitPostingLike) {
  return {
    primaryFunction: posting.targetFunction ?? inferFunctionFromTitle(posting.title),
    roleLevel: posting.targetLevel ?? inferLevelFromTitle(posting.title),
    remotePolicy: posting.targetRemotePolicy ?? (inferRemoteFromLocation(posting.location) ? 'remote' : null),
    locationRequirement: posting.targetLocation ?? posting.location,
    compMin: posting.salaryMin,
    compMax: posting.salaryMax,
  }
}

// The one enriched fit score used everywhere — candidate Discover badges,
// SurfacedJob badges, and admin review all call this same function now, so
// "a good fit" means the same thing regardless of who's looking. Combines
// computeMatchScore's function/level/location/comp heuristic (falling back
// to title-inference for function/level when a posting has no explicit
// targeting — true for nearly every board posting) with title-similarity,
// a keyword-match bonus that's hard-capped below "strong" when a
// keyword-rich resume (6+ terms) doesn't clear a 25% hit rate, and two new
// signals: industry (binary — does the posting mention a target industry)
// and years-of-experience (parsed from posting text when stated).
function computeEnrichedFitScore(candidate: FitCandidate, posting: FitPostingLike): number {
  const postingText = `${posting.title} ${posting.description ?? ''}`

  // Hard, categorical gate — a law-firm attorney posting or a hospital
  // physician posting is simply not a fit for a candidate without the
  // license, no matter how well function/level/location/comp line up.
  // Short-circuits before any of the softer scoring below.
  const requiredCredential = detectRequiredCredential(postingText)
  if (!candidateMeetsCredentialGate(candidate, requiredCredential)) return 0

  const base = computeMatchScore(candidate, postingToRole(posting)).score
  const { bonus: keywordBonus, failsGate } = keywordMatchInfo(candidate.resumeKeywords, postingText)
  const titleBonus = titleSimilarityBonus(candidate.targetRoleType, posting.title)

  let score =
    base +
    titleBonus +
    keywordBonus +
    industryMatchBonus(candidate, postingText) +
    yearsExperienceBonus(candidate.yearsExperience, postingText) +
    companySizeMatchBonus(candidate.targetCompanySize, posting.companySizeBand, candidate.priorityBrandName)
  score = Math.min(100, score)

  // A keyword-rich resume with too few real hits can't be called a
  // "strong" fit no matter how well the other signals line up — this caps
  // the ceiling rather than zeroing the score, since the role can still be
  // a legitimate "good" fit on function/level/location alone.
  if (failsGate) score = Math.min(score, STRONG_FIT_THRESHOLD - 1)

  // computeMatchScore's neutral function-match credit (+20) assumes
  // `role.primaryFunction === null` means "this posting genuinely has no
  // function requirement" — true for an untargeted board listing, but not
  // for a title we tried and failed to classify (inferFunctionFromTitle
  // returning null just means the title was ambiguous, e.g. "Business
  // Partner Analyst" or "Administrative Business Partner, Office of the
  // CEO" — see the comments on those keyword tables). Letting that
  // unconfident state clear the "good" bar was exactly how those two
  // example titles were reading as good fits for any candidate at all.
  // Only applies when the function came from title inference (no explicit
  // targetFunction on the posting) — an explicitly untargeted listing still
  // gets the neutral credit as intended. Also skipped when the posting's
  // title itself strongly matches the candidate's own stated target role —
  // a real bug otherwise: PRIMARY_FUNCTION_OPTIONS has no "Corporate
  // Development"/M&A category, so a posting titled exactly the candidate's
  // own target ("VP, Corporate Development") failed function inference and
  // got capped here anyway, scoring worse than an unrelated "Corporate
  // Accounting" posting that happened to infer a (wrong) function with
  // false confidence.
  const hasConfidentFunction = posting.targetFunction != null || inferFunctionFromTitle(posting.title) != null
  const hasRealTitleSignal = titleBonus > 0
  if (!hasConfidentFunction && !hasRealTitleSignal) score = Math.min(score, GOOD_FIT_THRESHOLD - 1)

  // PRIMARY_FUNCTION_OPTIONS is a broad ~15-category taxonomy — "Finance"
  // alone spans everyone from a staff accountant to a Corporate
  // Development/M&A VP, so a function-category match alone doesn't mean
  // much for a candidate who's stated a specific target role. When they
  // have (a real, non-vague targetRoleType) and this posting's title has
  // zero real overlap with it — no shared words, no shared role family
  // (role-family-keywords.ts) — the only thing connecting them is that
  // coarse category, which isn't enough to call this a real recommendation.
  // Skipped for postings with an explicit targetFunction (distribution:
  // TARGETED) — there a human already curated this candidate/posting pair,
  // which the title-text heuristic shouldn't second-guess.
  const hasSpecificTarget = !!candidate.targetRoleType && !isVagueTargetRole(candidate.targetRoleType)
  if (posting.targetFunction == null && hasSpecificTarget && titleBonus === 0) {
    score = Math.min(score, GOOD_FIT_THRESHOLD - 1)
  }

  return score
}

// Reuses the shared enriched scorer, fed the board listing's own targeting
// fields (only meaningful when distribution = 'TARGETED'; an 'OPEN' listing
// has no targeting fields set, which reads through computeMatchScore's
// existing neutral-credit paths for missing data rather than penalizing
// anything).
export function computeBoardListingFitBucket(
  candidate: FitCandidate,
  posting: Pick<
    ExclusiveJobPosting,
    | 'title'
    | 'description'
    | 'targetFunction'
    | 'targetLevel'
    | 'targetRemotePolicy'
    | 'targetLocation'
    | 'location'
    | 'salaryMin'
    | 'salaryMax'
  >,
  companySizeBand?: CompanySizeBand | null
): FitBucket {
  const postingLike = { ...posting, companySizeBand }
  return bucketFromScoreAndLevel(computeEnrichedFitScore(candidate, postingLike), candidate, postingLike)
}

// Ideal-vs-broader tiering (see isIdealMatch above) for a board listing —
// same postingLike adapter as computeBoardListingFitBucket, so the two
// stay consistent for the same posting.
export function computeBoardListingIsIdealMatch(
  candidate: FitCandidate,
  posting: Pick<
    ExclusiveJobPosting,
    'title' | 'description' | 'targetFunction' | 'targetLevel' | 'targetRemotePolicy' | 'targetLocation' | 'location' | 'salaryMin' | 'salaryMax'
  >,
  companySizeBand?: CompanySizeBand | null
): boolean {
  return isIdealMatch(candidate, { ...posting, companySizeBand })
}

// How many candidates in the whole pool this pending posting is a
// plausible ('good' bucket or better) fit for — the admin review queue's
// quality signal. Unlike computeBoardListingFitBucket above, this doesn't
// wait for distribution: 'TARGETED' targeting fields to exist (most
// pending admin/ATS/self-submitted rows are 'OPEN' and never get those
// filled in); it falls back to inferring function/level from the posting's
// own title, same heuristic the ATS feed's fit-gate already relies on.
export interface PendingJobMatchCount {
  matched: number
  total: number
  grade: Grade
  // Raw matched/total expressed as 0-100 — the admin-facing display now
  // leads with this instead of the letter grade (still computed above for
  // any caller that wants a coarser bucket; nothing currently reads it).
  scorePercent: number
}

// Provisional thresholds on % of the whole candidate pool that's a plausible
// fit — this is an admin-only comparative signal (not the candidate-facing
// Grade scale in lib/scoring/grade.ts, which is calibrated against a single
// candidate's own Market Reality Grade). Reuses the same A-F type and color tokens
// purely for visual consistency; revisit these cutoffs once there's a real
// posting volume to calibrate against.
function fitRatioToGrade(matched: number, total: number): Grade {
  if (total === 0) return 'F'
  const ratio = matched / total
  if (ratio >= 0.5) return 'A'
  if (ratio >= 0.3) return 'B'
  if (ratio >= 0.15) return 'C'
  if (ratio >= 0.05) return 'D'
  return 'F'
}

function scorePercent(matched: number, total: number): number {
  return total === 0 ? 0 : Math.round((matched / total) * 100)
}

// Shared select shape for the admin fit-matching candidate pool — used by
// both the Job Board review queue (page.tsx) and the manual-add form's
// live fit preview, so the two never drift out of sync with each other.
export function loadAdminFitCandidates(): Promise<AdminFitCandidate[]> {
  return prisma.candidateProfile.findMany({
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      primaryFunction: true,
      secondaryFunction: true,
      highestLevelReached: true,
      levelRankScore: true,
      remotePreference: true,
      currentCity: true,
      currentState: true,
      openToRelocation: true,
      targetCompMin: true,
      compFlexible: true,
      targetRoleType: true,
      resumeKeywords: true,
      yearsExperience: true,
      industryContext: true,
      secondaryIndustryContext: true,
      targetIndustries: true,
      isPeopleManager: true,
      hasJD: true,
      hasMD: true,
      hasDO: true,
      targetCompanySize: true,
      priorityMaxComp: true,
      priorityWorkLife: true,
      priorityBrandName: true,
      priorityMission: true,
    },
  })
}

export type FitRankablePosting = Pick<
  ExclusiveJobPosting,
  | 'id'
  | 'title'
  | 'companyName'
  | 'description'
  | 'location'
  | 'salaryMin'
  | 'salaryMax'
  | 'targetFunction'
  | 'targetLevel'
  | 'targetRemotePolicy'
  | 'targetLocation'
>

// Thin wrapper kept for the admin-side callers below, which pass
// AdminFitCandidate (a superset of FitCandidate) and FitRankablePosting (a
// superset of FitPostingLike) — both satisfy the shared scorer's narrower
// parameter types structurally, so this is just a naming/readability layer,
// not a different scoring path.
function boostedMatchScore(candidate: AdminFitCandidate, posting: FitRankablePosting): number {
  return computeEnrichedFitScore(candidate, posting)
}

export function countPendingJobMatches(posting: FitRankablePosting, candidates: AdminFitCandidate[]): PendingJobMatchCount {
  const matched = candidates.filter((c) => boostedMatchScore(c, posting) >= GOOD_FIT_THRESHOLD).length
  return {
    matched,
    total: candidates.length,
    grade: fitRatioToGrade(matched, candidates.length),
    scorePercent: scorePercent(matched, candidates.length),
  }
}

// The reverse of countPendingJobMatches — for one candidate, how well does
// each pending posting fit them, highest first. Powers the "Job
// recommendations" section on the admin candidate detail page.
export function rankPendingPostingsForCandidate<T extends FitRankablePosting>(
  candidate: AdminFitCandidate,
  postings: T[]
): Array<{ posting: T; score: number }> {
  return postings
    .map((posting) => ({ posting, score: boostedMatchScore(candidate, posting) }))
    .sort((a, b) => b.score - a.score)
}

export interface CandidateFitCoverage {
  candidate: AdminFitCandidate
  goodFitCount: number
  totalPostings: number
}

// For every candidate, how many of the given (active) postings are a
// plausible fit — sorted ascending, so candidates with the fewest real
// options surface first. Powers the admin "Candidates with the fewest
// options" section, which flags who most needs manual sourcing attention
// rather than just showing which postings are popular.
export function rankCandidatesByFitCoverage<T extends FitRankablePosting>(
  candidates: AdminFitCandidate[],
  postings: T[]
): CandidateFitCoverage[] {
  return candidates
    .map((candidate) => ({
      candidate,
      goodFitCount: postings.filter((posting) => boostedMatchScore(candidate, posting) >= GOOD_FIT_THRESHOLD).length,
      totalPostings: postings.length,
    }))
    .sort((a, b) => a.goodFitCount - b.goodFitCount)
}

// SurfacedJob rows have no structured function/level/comp fields — only
// title/location free text, since the waterfall that generated them already
// searched using the candidate's own target role. Function/level are now
// inferred from the title (same helpers as the board-listing path above)
// rather than passed through as null — passing null unconditionally meant
// every surfaced job landed in the same "good fit" band by default
// regardless of actual seniority/function match, since the neutral credits
// for missing function+level plus a location match alone were already
// enough to clear the "good" threshold.
export function computeSurfacedJobFitBucket(
  candidate: FitCandidate,
  job: Pick<SurfacedJob, 'title' | 'location' | 'description'>,
  companySizeBand?: CompanySizeBand | null
): FitBucket {
  const postingLike = {
    title: job.title,
    description: job.description,
    location: job.location,
    salaryMin: null,
    salaryMax: null,
    targetFunction: null,
    targetLevel: null,
    targetRemotePolicy: null,
    targetLocation: null,
    companySizeBand,
  }
  const score = computeEnrichedFitScore(candidate, postingLike)
  return bucketFromScoreAndLevel(score, candidate, postingLike)
}

// Ideal-vs-broader tiering (see isIdealMatch above) for a surfaced job —
// same postingLike adapter as computeSurfacedJobFitBucket.
export function computeSurfacedJobIsIdealMatch(
  candidate: FitCandidate,
  job: Pick<SurfacedJob, 'title' | 'location' | 'description'>,
  companySizeBand?: CompanySizeBand | null
): boolean {
  return isIdealMatch(candidate, {
    title: job.title,
    description: job.description,
    location: job.location,
    salaryMin: null,
    salaryMax: null,
    targetFunction: null,
    targetLevel: null,
    targetRemotePolicy: null,
    targetLocation: null,
    companySizeBand,
  })
}

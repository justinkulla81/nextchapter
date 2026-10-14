import 'server-only'
import type { CandidateProfile, CompanySizeBand, ExclusiveJobPosting, SurfacedJob } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { priorityMultiplier } from '@/lib/matching/compute-match-score'
import { inferFunctionFromTitle } from '@/lib/jobs/infer-job-function'
import { classifyTitleRung, type RungName } from '@/lib/jobs/job-seniority'
import { calibratedLevelRank } from '@/lib/scoring/level-rank'
import { statesFromLocation } from '@/lib/pay/market-pay'
import { normalizeCandidateProfileFields } from '@/lib/constants/candidate-profile-normalize'
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

// ── Fit scoring v2 (2026-10-14) ─────────────────────────────────────────────
//
// One deterministic score per member x job, built from parts that can each be
// read back as a sentence (computeFitAssessment returns them):
//
//   function   30  the job's function is the member's own or target function
//              22  …their secondary function
//   level      25  at their level        17  one step up
//               8  one step down          0  two or more steps away
//              10  either level unknown
//   place      15  local, or a remote job  8  a move they said they're open to
//               6  can't tell (job or member location unknown)   0  doesn't work
//   title    0-20  overlap with the role they named (targetRoleType); a
//                  member with no specific target gets 10 for a job in
//                  their own function
//   industry 0-10  the posting names one of their industries
//   keywords  0-8  resume keywords found in the posting (2 per hit)
//   years     0-5  meets the stated years requirement
//   pay     -10-5  posted top of range vs their minimum
//   size      0-5  company size they asked for
//
// …and four gates that cap the score (so the bucket and every score-threshold
// caller agree):
//   - below "good" (44) when the place doesn't work, when neither the job's
//     function nor its title lines up with the member, or when the level is a
//     step or more down / two or more up — those read as Step Down / Step Up;
//   - below "strong" (69) when the member named a specific target role and the
//     title has nothing in common with it.
//
// What changed from v1 and why (measured on the live board, 156k jobs x 36
// members — see scripts/fit-scoring-report.ts):
//   - Level compared the member's company-size-calibrated levelRankScore with
//     an uncalibrated job, so a Director whose history calibrated to 87 saw
//     every Director job as two levels down. The member's stated level is the
//     anchor now; levelRankScore can only widen it by one step.
//   - The job's own seniority (ncrawl's rung, ExclusiveJobPosting.level) is
//     used instead of re-guessing from the title, and Senior IC sits level
//     with Manager instead of a full step below it.
//   - A keyword-rich resume (6+ keywords) needed 25% of them in the posting
//     or was capped below strong — senior resumes ("P&L ownership", "board
//     relations") almost never hit that, so senior members never reached
//     strong. Keywords are now a small bonus with no cap.
//   - A one-word target ("Director of Product" -> "product") never earned
//     title credit, and C-suite titles ("Chief Financial Officer") never
//     matched a Finance member. Both fixed below.
//   - "Good" no longer comes from a function category alone: the place and
//     the level have to work too, which is what cut good fits from tens of
//     thousands to hundreds.

// The score a listing needs to clear to count as a "strong" fit — used by
// every fit-bucket consumer below (candidate Discover badges, SurfacedJob
// badges, admin review).
export const STRONG_FIT_THRESHOLD = 70
// "Good fit" means the same score cutoff everywhere, including the gates in
// computeFitAssessment below.
const GOOD_FIT_THRESHOLD = 45

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
> & {
  // Optional so narrower selects keep compiling; absent reads as not set.
  targetFunction?: string | null
}

// id/firstName/lastName/email are only needed by admin-side display and the
// two candidate-centric ranking helpers below (rankPendingPostingsForCandidate,
// rankCandidatesByFitCoverage) — harmless to carry on every caller.
export type AdminFitCandidate = FitCandidate & Pick<CandidateProfile, 'id' | 'firstName' | 'lastName' | 'email'>

// The full shape the scorer needs from a posting — a plain interface, not a
// Prisma Pick, so both ExclusiveJobPosting rows and adapted SurfacedJob rows
// can satisfy it.
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
  // ncrawl's seniority rung (ExclusiveJobPosting.level). Absent: read from
  // the title with the same rules (classifyTitleRung).
  level?: string | null
  // Pre-resolved by the caller (resolveCompanySizeBand is async; this scorer
  // is not) — omitted or null both read as unknown, never a penalty.
  companySizeBand?: CompanySizeBand | null
}

// ── Level ────────────────────────────────────────────────────────────────────

// Both sides on one points scale, a step = 15. The member's stated level
// (HIGHEST_LEVEL_OPTIONS) and the job's rung. IC sits at 32 so a Senior IC
// job (38) is at an IC member's level, and Senior IC is level with Manager.
const STEP_POINTS = 15
const MEMBER_LEVEL_POINTS: Record<string, number> = { IC: 32, Manager: 40, Director: 55, VP: 70, 'C-Suite': 85 }
const RUNG_LEVEL_POINTS: Partial<Record<RungName, number>> = {
  SENIOR_IC: 38,
  MANAGER: 40,
  SR_MANAGER: 47,
  DIRECTOR: 55,
  PRINCIPAL: 55,
  CHIEF_OF_STAFF: 55,
  SCHOOL_LEADER: 55,
  HEAD: 63,
  PARTNER: 70,
  VP: 70,
  EVP_SVP: 78,
  C_SUITE: 85,
  BOARD: 90,
}

export type LevelStep = 'same' | 'up' | 'big_up' | 'down' | 'big_down' | 'unknown'

// The member's level as a window: their stated level, widened by one step
// toward their calibrated levelRankScore when that differs by 10+ points
// (e.g. a Director at a very large company also fits VP roles). Members with
// no stated level fall back to levelRankScore alone.
function memberLevelWindow(c: Pick<FitCandidate, 'highestLevelReached' | 'levelRankScore'>): { lo: number; hi: number } | null {
  const level = c.highestLevelReached
  const base = level ? MEMBER_LEVEL_POINTS[level] : undefined
  if (base === undefined) return c.levelRankScore == null ? null : { lo: c.levelRankScore, hi: c.levelRankScore }
  const anchor = calibratedLevelRank(level, null)
  if (c.levelRankScore == null || anchor === null) return { lo: base, hi: base }
  if (c.levelRankScore >= anchor + 10) return { lo: base, hi: base + STEP_POINTS }
  if (c.levelRankScore <= anchor - 10) return { lo: base - STEP_POINTS, hi: base }
  return { lo: base, hi: base }
}

// The seniority rules rank every "General Manager" as C-suite, but most are
// a store, restaurant, hotel or site GM — a manager. Only a GM title naming a
// business (a division, region, product line…) reads as an executive role,
// and then at VP level, not C-suite. Allowlist, not a blanket rule.
const GENERAL_MANAGER = /\bgeneral manager\b/i
const EXECUTIVE_WORDS = /\b(chief|ceo|president)\b/i
const BUSINESS_GM_QUALIFIER =
  /\b(business|division|divisional|business unit|unit|segment|region|regional|country|americas|emea|apac|north america|global|international|product|platform|portfolio|enterprise|payments|cloud|software|saas|category|brand|commercial|market)\b/i

function generalManagerPoints(title: string): number | null {
  if (!GENERAL_MANAGER.test(title) || EXECUTIVE_WORDS.test(title) || /\bassistant\b/i.test(title)) return null
  return BUSINESS_GM_QUALIFIER.test(title) ? RUNG_LEVEL_POINTS.VP! : RUNG_LEVEL_POINTS.MANAGER!
}

function postingLevelPoints(posting: Pick<FitPostingLike, 'title' | 'targetLevel' | 'level'>, fallbackLevel?: string | null): number | null {
  if (posting.targetLevel && MEMBER_LEVEL_POINTS[posting.targetLevel] !== undefined) return MEMBER_LEVEL_POINTS[posting.targetLevel]
  const gm = generalManagerPoints(posting.title)
  if (gm !== null) return gm
  const rung = (posting.level as RungName | null | undefined) ?? (fallbackLevel ? null : classifyTitleRung(posting.title).rung)
  if (rung && RUNG_LEVEL_POINTS[rung] !== undefined) return RUNG_LEVEL_POINTS[rung]!
  if (fallbackLevel && MEMBER_LEVEL_POINTS[fallbackLevel] !== undefined) return MEMBER_LEVEL_POINTS[fallbackLevel]
  return null
}

export function levelStep(
  c: Pick<FitCandidate, 'highestLevelReached' | 'levelRankScore'>,
  posting: Pick<FitPostingLike, 'title' | 'targetLevel' | 'level'>,
  fallbackLevel?: string | null
): LevelStep {
  const window = memberLevelWindow(c)
  const job = postingLevelPoints(posting, fallbackLevel)
  if (!window || job === null) return 'unknown'
  const gap = job < window.lo ? (job - window.lo) / STEP_POINTS : job > window.hi ? (job - window.hi) / STEP_POINTS : 0
  if (gap >= 1.6) return 'big_up'
  if (gap >= 0.5) return 'up'
  if (gap <= -1.6) return 'big_down'
  if (gap <= -0.5) return 'down'
  return 'same'
}

const LEVEL_POINTS: Record<LevelStep, number> = { same: 25, up: 17, down: 8, big_up: 0, big_down: 0, unknown: 10 }

// ── Function ─────────────────────────────────────────────────────────────────

// A C-suite title names its functional area as well as Executive Leadership —
// "Chief Financial Officer" is a Finance member's job, not only an executive's.
const EXEC_TITLE_AREA: { re: RegExp; fn: string }[] = [
  { re: /\b(cfo|chief financial officer|chief accounting officer)\b/, fn: 'Finance' },
  { re: /\b(coo|chief operating officer|chief operations officer)\b/, fn: 'Operations' },
  { re: /\b(cmo|chief marketing officer|chief brand officer|chief communications officer)\b/, fn: 'Marketing' },
  { re: /\b(cto|cio|ciso|chief technology officer|chief information officer|chief information security officer)\b/, fn: 'Engineering' },
  { re: /\bchief product officer\b/, fn: 'Product' },
  { re: /\b(chro|chief people officer|chief human resources officer|chief talent officer)\b/, fn: 'Human Resources' },
  { re: /\b(chief revenue officer|chief sales officer|chief commercial officer)\b/, fn: 'Sales' },
  { re: /\b(chief legal officer|general counsel|chief compliance officer)\b/, fn: 'Legal' },
  { re: /\b(chief data officer|chief analytics officer)\b/, fn: 'Data & Analytics' },
  { re: /\bchief customer officer\b/, fn: 'Customer Success' },
]

function titleFunctions(title: string): string[] {
  const lower = title.toLowerCase()
  const out: string[] = []
  const inferred = inferFunctionFromTitle(title)
  if (inferred) out.push(inferred)
  for (const { re, fn } of EXEC_TITLE_AREA) if (re.test(lower) && !out.includes(fn)) out.push(fn)
  return out
}

function postingFunctions(posting: Pick<FitPostingLike, 'title' | 'targetFunction'>): string[] {
  return posting.targetFunction ? [posting.targetFunction] : titleFunctions(posting.title)
}

function hasSpecificTarget(c: Pick<FitCandidate, 'targetRoleType'>): boolean {
  return !!c.targetRoleType?.trim() && !isVagueTargetRole(c.targetRoleType)
}

// The member's own functions — primary, a stated target function, and the
// function of the role they named — and their secondary function.
function memberFunctions(c: FitCandidate): { own: string[]; secondary: string[] } {
  const own = [c.primaryFunction, c.targetFunction].filter((f): f is string => !!f?.trim())
  if (hasSpecificTarget(c)) own.push(...titleFunctions(expandExecAcronyms(c.targetRoleType!)))
  const secondary = [c.secondaryFunction].filter((f): f is string => !!f?.trim())
  const norm = (list: string[]) => [...new Set(list.map((f) => f.trim().toLowerCase()))]
  return { own: norm(own), secondary: norm(secondary) }
}

export type FunctionFit = 'own' | 'secondary' | 'other' | 'unknown'

function functionFit(c: FitCandidate, posting: Pick<FitPostingLike, 'title' | 'targetFunction'>): FunctionFit {
  const jobFns = postingFunctions(posting).map((f) => f.toLowerCase())
  if (jobFns.length === 0) return 'unknown'
  const mine = memberFunctions(c)
  if (jobFns.some((f) => mine.own.includes(f))) return 'own'
  if (jobFns.some((f) => mine.secondary.includes(f))) return 'secondary'
  return 'other'
}

const FUNCTION_POINTS: Record<FunctionFit, number> = { own: 30, secondary: 22, other: 0, unknown: 0 }
const OPEN_TARGET_ROLE_CREDIT = 10

// ── Title vs the role they named ─────────────────────────────────────────────

// Common enough across unrelated titles that a shared hit on one alone isn't
// real overlap ("Corporate Accounting" vs "Corporate Development").
const GENERIC_TITLE_WORDS = new Set([
  'corporate', 'senior', 'director', 'manager', 'executive', 'head', 'global',
  'lead', 'chief', 'associate', 'vice', 'president', 'principal', 'partner',
  'officer', 'specialist', 'coordinator', 'analyst',
])

const EXEC_ACRONYMS: Record<string, string> = {
  ceo: 'chief executive officer',
  coo: 'chief operating officer',
  cfo: 'chief financial officer',
  cto: 'chief technology officer',
  cmo: 'chief marketing officer',
  cio: 'chief information officer',
  chro: 'chief human resources officer',
  cro: 'chief revenue officer',
  cpo: 'chief product officer',
}

// Expands C-suite acronyms ("CFO" -> "chief financial officer") and folds
// every vice-president spelling into "vp", a level word that never counts as
// overlap — "president" alone would put every VP title in the general-
// management role family.
function expandExecAcronyms(text: string): string {
  return text
    .toLowerCase()
    .replace(/\b(ceo|coo|cfo|cto|cmo|cio|chro|cro|cpo)\b/g, (m) => EXEC_ACRONYMS[m])
    .replace(/\b(senior|executive|group|regional|assistant|associate)?\s*vice[\s-]+president\b|\b[se]vp\b/g, ' vp ')
    .replace(/\s+/g, ' ')
    .trim()
}

function significantWords(text: string): string[] {
  return text
    .split(/[\s,/()|–—-]+/)
    .map((w) => w.replace(/[^a-z0-9&]/g, ''))
    .filter((w) => w.length > 2 && !GENERIC_TITLE_WORDS.has(w))
}

// 0-20. Exact title 20; one contains the other 16; otherwise the share of the
// target's significant words found in the title (x16), or 12 for a shared
// role family (role-family-keywords.ts). A one-word target ("Director of
// Product" -> "product") counts when the job's function agrees, so a
// "Product Marketing Director" doesn't match "Director of Product".
function titleSimilarityBonus(c: FitCandidate, posting: Pick<FitPostingLike, 'title' | 'targetFunction'>): number {
  if (!hasSpecificTarget(c)) return 0
  const target = expandExecAcronyms(c.targetRoleType!.trim())
  const title = expandExecAcronyms(posting.title)
  if (!target) return 0
  if (title === target) return 20
  if (title.includes(target) || (title.length >= 8 && target.includes(title))) return 16
  const targetWords = [...new Set(significantWords(target))]
  const titleWords = new Set(significantWords(title))
  const shared = targetWords.filter((w) => titleWords.has(w)).length
  const sameFamily = titlesShareRoleFamily(target, title)
  let wordOverlap = 0
  if (targetWords.length === 1 && shared === 1) {
    const targetFns = titleFunctions(target).map((f) => f.toLowerCase())
    const jobFns = postingFunctions(posting).map((f) => f.toLowerCase())
    wordOverlap = sameFamily || targetFns.length === 0 || jobFns.some((f) => targetFns.includes(f)) ? 16 : 0
  } else if (targetWords.length > 0) {
    wordOverlap = Math.round((shared / targetWords.length) * 16)
  }
  return Math.max(wordOverlap, sameFamily ? 12 : 0)
}

// ── Place ────────────────────────────────────────────────────────────────────

export type PlaceFit = 'local' | 'remote' | 'relocation' | 'unknown' | 'no'

function postingIsRemote(posting: Pick<FitPostingLike, 'targetRemotePolicy' | 'location' | 'description'>): boolean {
  if (posting.targetRemotePolicy) return posting.targetRemotePolicy === 'remote'
  if (posting.location && /\bremote\b/i.test(posting.location)) return true
  return !!posting.description && /\b(fully remote|100% remote|remote[- ]first|this (?:is a|role is) remote)\b/i.test(posting.description)
}

// States that share a commuting metro with a neighbour (New York/Hoboken,
// Washington/Arlington, Philadelphia/Camden, Boston/Nashua) — a job across
// that line is local, not a move.
const SHARED_METRO_STATES: Record<string, string[]> = {
  NY: ['NJ', 'CT'],
  NJ: ['NY', 'PA'],
  CT: ['NY'],
  PA: ['NJ', 'DE'],
  DE: ['PA'],
  DC: ['MD', 'VA'],
  MD: ['DC', 'VA'],
  VA: ['DC', 'MD'],
  MA: ['NH', 'RI'],
  NH: ['MA'],
  RI: ['MA'],
}

function placeFit(c: FitCandidate, posting: FitPostingLike): PlaceFit {
  if (postingIsRemote(posting)) return 'remote'
  const location = posting.targetLocation ?? posting.location ?? ''
  const jobStates = statesFromLocation(location).states
  // Whole words only: a plain substring test read "CA" inside "North Carolina".
  const word = (needle: string) => new RegExp(`(^|[^a-z])${needle.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z]|$)`, 'i')
  const cityHit = !!c.currentCity?.trim() && c.currentCity.trim().toLowerCase() !== 'remote' && word(c.currentCity).test(location)
  if (jobStates.length === 0 && !cityHit) return 'unknown'
  const homeStates = statesFromLocation([c.currentCity, c.currentState].filter(Boolean).join(', ')).states
  const myStates = [...homeStates, ...homeStates.flatMap((st) => SHARED_METRO_STATES[st] ?? [])]
  if (cityHit || jobStates.some((s) => myStates.includes(s))) return 'local'
  if (c.remotePreference === 'remote') return 'no'
  if (c.openToRelocation) return 'relocation'
  if (myStates.length === 0) return 'unknown'
  return 'no'
}

const PLACE_POINTS: Record<PlaceFit, number> = { local: 15, remote: 15, relocation: 8, unknown: 6, no: 0 }

// ── Smaller signals ──────────────────────────────────────────────────────────

// Candidate's 3-bucket company-size preference mapped to the resolver's
// 8-tier band — 'Any' or null has no entry, read as "no preference."
const COMPANY_SIZE_TARGET_BANDS: Record<string, CompanySizeBand[]> = {
  '1-50': ['MICRO', 'SMALL'],
  '50-500': ['SMALL_MID', 'MID'],
  '500+': ['MID_LARGE', 'LARGE', 'ENTERPRISE', 'MEGA'],
}

function companySizeMatchBonus(c: FitCandidate, band: CompanySizeBand | null | undefined): number {
  if (!c.targetCompanySize || c.targetCompanySize === 'Any' || !band) return 0
  return COMPANY_SIZE_TARGET_BANDS[c.targetCompanySize]?.includes(band) ? Math.round(5 * priorityMultiplier(c.priorityBrandName)) : 0
}

// Industries the member named, split into phrases a posting could actually
// contain: "Climate media, events, membership" -> three phrases.
function industryPhrases(c: Pick<FitCandidate, 'targetIndustries' | 'industryContext' | 'secondaryIndustryContext'>): string[] {
  const raw = [c.industryContext, c.secondaryIndustryContext, ...(c.targetIndustries ?? [])].filter((s): s is string => !!s?.trim())
  const phrases = raw.flatMap((s) => s.toLowerCase().split(/\s*(?:,|;|\/|\band\b|&)\s*/))
  return [...new Set(phrases.map((p) => p.trim()).filter((p) => p.length >= 4))]
}

function matchesTargetIndustry(c: FitCandidate, postingText: string): boolean {
  const phrases = industryPhrases(c)
  if (phrases.length === 0) return false
  const lower = postingText.toLowerCase()
  return phrases.some((p) => new RegExp(`\\b${p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(lower))
}

function keywordBonus(resumeKeywords: string[], postingText: string): number {
  if (!resumeKeywords?.length) return 0
  const lower = postingText.toLowerCase()
  const hits = resumeKeywords.filter((kw) => kw && lower.includes(kw.toLowerCase())).length
  return Math.min(8, hits * 2)
}

// "5+ years", "3-5 years of experience" — null when nothing matches.
function parseMinYearsRequired(text: string): number | null {
  const match = text.match(/(\d{1,2})\+?\s*(?:-\s*\d{1,2}\s*)?\s*years?/i)
  if (!match) return null
  const years = parseInt(match[1], 10)
  return Number.isNaN(years) ? null : years
}

function yearsBonus(candidateYears: number | null, postingText: string): number {
  const required = parseMinYearsRequired(postingText)
  if (required === null || candidateYears === null) return 2
  if (candidateYears >= required) return 5
  return candidateYears >= required - 2 ? 2 : 0
}

function payPoints(c: FitCandidate, posting: FitPostingLike): number {
  if (c.targetCompMin == null || posting.salaryMax == null) return 0
  if (posting.salaryMax >= c.targetCompMin) return Math.round(5 * priorityMultiplier(c.priorityMaxComp))
  return c.compFlexible ? 0 : -10
}

// ── The assessment ───────────────────────────────────────────────────────────

export interface FitAssessment {
  score: number
  functionFit: FunctionFit
  level: LevelStep
  place: PlaceFit
  titleBonus: number
  industryMatch: boolean
  // Which gate capped the score, if any.
  cappedBy: 'credential' | 'place' | 'function' | 'level' | 'target_role' | null
}

export function computeFitAssessment(
  candidateIn: FitCandidate,
  posting: FitPostingLike,
  fallbackLevel?: string | null
): FitAssessment {
  const c = normalizeCandidateProfileFields(candidateIn)
  const postingText = `${posting.title} ${posting.description ?? ''}`
  const fn = functionFit(c, posting)
  const level = levelStep(c, posting, fallbackLevel)
  const place = placeFit(c, posting)
  const titleBonus = titleSimilarityBonus(c, posting)
  const industryMatch = matchesTargetIndustry(c, `${postingText} ${posting.location ?? ''}`)
  const base = { functionFit: fn, level, place, titleBonus, industryMatch }

  // A law-firm attorney or hospital physician posting is not a fit without
  // the license, whatever else lines up.
  if (!candidateMeetsCredentialGate(c, detectRequiredCredential(postingText))) return { ...base, score: 0, cappedBy: 'credential' }

  // A member with no specific target ("Flexible") has told us their function
  // is the role — a job in it gets the credit a named role's title would.
  const roleCredit = hasSpecificTarget(c) ? titleBonus : fn === 'own' ? OPEN_TARGET_ROLE_CREDIT : 0

  let score =
    FUNCTION_POINTS[fn] +
    LEVEL_POINTS[level] +
    PLACE_POINTS[place] +
    roleCredit +
    (industryMatch ? Math.round(10 * priorityMultiplier(c.priorityMission)) : 0) +
    keywordBonus(c.resumeKeywords, postingText) +
    yearsBonus(c.yearsExperience, postingText) +
    payPoints(c, posting) +
    companySizeMatchBonus(c, posting.companySizeBand)
  score = Math.max(0, Math.min(100, score))

  let cappedBy: FitAssessment['cappedBy'] = null
  const cap = (limit: number, why: NonNullable<FitAssessment['cappedBy']>) => {
    if (score > limit) {
      score = limit
      cappedBy = cappedBy ?? why
    }
  }
  if (place === 'no') cap(GOOD_FIT_THRESHOLD - 1, 'place')
  // A job that needs a move, or whose place we can't read, is at most a
  // lateral fit — and only with something beyond the function behind it
  // (the role they named, or one of their industries).
  if (place === 'relocation' || place === 'unknown') {
    cap(titleBonus > 0 || industryMatch ? STRONG_FIT_THRESHOLD - 1 : GOOD_FIT_THRESHOLD - 1, 'place')
  }
  // Neither the function nor the title connects the job to this member. A
  // title that strongly matches the role they named stands on its own (no
  // function category covers Corporate Development, for one).
  if (fn !== 'own' && fn !== 'secondary' && titleBonus < 12) cap(GOOD_FIT_THRESHOLD - 1, 'function')
  if (level === 'down' || level === 'big_down' || level === 'big_up') cap(GOOD_FIT_THRESHOLD - 1, 'level')
  // A member who named a specific role: a title with nothing in common with
  // it can still be a lateral fit on function, never an on-target one. Not
  // applied to a recruiter-targeted posting (targetFunction set) — a human
  // already paired the two.
  if (posting.targetFunction == null && hasSpecificTarget(c) && titleBonus === 0) cap(STRONG_FIT_THRESHOLD - 1, 'target_role')

  return { ...base, score, cappedBy }
}

function computeEnrichedFitScore(candidate: FitCandidate, posting: FitPostingLike): number {
  return computeFitAssessment(candidate, posting).score
}

function bucketFromScore(score: number): FitBucket {
  if (score >= STRONG_FIT_THRESHOLD) return 'strong'
  if (score >= GOOD_FIT_THRESHOLD) return 'good'
  return 'stretch'
}

// Below the "good fit" bar the label says which way the level runs: a role
// a step or more below the member is Step Down ('below_level', or
// 'overqualified' two or more steps down); otherwise Step Up ('stretch'),
// which also covers missing level data.
function bucketFromAssessment(a: FitAssessment): FitBucket {
  const bucket = bucketFromScore(a.score)
  if (bucket !== 'stretch') return bucket
  if (a.level === 'big_down') return 'overqualified'
  if (a.level === 'down') return 'below_level'
  return 'stretch'
}

type BoardPostingFields = Pick<
  ExclusiveJobPosting,
  'title' | 'description' | 'targetFunction' | 'targetLevel' | 'targetRemotePolicy' | 'targetLocation' | 'location' | 'salaryMin' | 'salaryMax'
> & { level?: string | null }

export function computeBoardListingFitBucket(
  candidate: FitCandidate,
  posting: BoardPostingFields,
  companySizeBand?: CompanySizeBand | null
): FitBucket {
  return bucketFromAssessment(computeFitAssessment(candidate, { ...posting, companySizeBand }))
}

// The bar for an instant alert email — deliberately far above "strong":
// founder's call is fewer, better alerts over more, merely-OK ones. All of:
// a fit score of VERY_STRONG_FIT_SCORE+, a place that works (local, a remote
// job, or a move they said they're open to), the member's own function, a
// level at theirs or one step up, and — when the job has a description to
// judge it by and the member named industries — one of their industries.
export const VERY_STRONG_FIT_SCORE = 85

/** Which very-strong condition a posting fails first ('pass' if none) — for tuning. */
export function veryStrongFitFailure(
  candidate: FitCandidate,
  posting: BoardPostingFields,
  postingLevel: string | null
): 'score' | 'ideal' | 'function' | 'level' | 'pass' {
  const a = computeFitAssessment(candidate, { ...posting, companySizeBand: null }, postingLevel)
  if (a.score < VERY_STRONG_FIT_SCORE) return 'score'
  if (a.place !== 'local' && a.place !== 'remote' && a.place !== 'relocation') return 'ideal'
  if (posting.description && industryPhrases(candidate).length > 0 && !a.industryMatch) return 'ideal'
  if (a.functionFit !== 'own') return 'function'
  if (a.level !== 'same' && a.level !== 'up') return 'level'
  return 'pass'
}

// postingLevel: the job's level on the member scale (candidateScaleLevel of
// its rung) — only used when the posting carries no rung of its own.
export function isVeryStrongBoardFit(candidate: FitCandidate, posting: BoardPostingFields, postingLevel: string | null): boolean {
  return veryStrongFitFailure(candidate, posting, postingLevel) === 'pass'
}

// "Ideal" match (find-my-job tiering): the posting names one of the member's
// industries and the place works without a move.
function isIdealMatch(candidate: FitCandidate, posting: FitPostingLike): boolean {
  const c = normalizeCandidateProfileFields(candidate)
  const postingText = `${posting.title} ${posting.description ?? ''} ${posting.location ?? ''}`
  const place = placeFit(c, posting)
  return matchesTargetIndustry(c, postingText) && (place === 'local' || place === 'remote')
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
// candidate's own Market Reality Assessment). Reuses the same A-F type and color tokens
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
      targetFunction: true,
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
  return bucketFromAssessment(computeFitAssessment(candidate, postingLike))
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

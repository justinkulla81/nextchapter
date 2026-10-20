import { parseRelocation, wouldMoveTo } from '@/lib/journey/relocation'
import type { CompanyOwnershipType, CompanySizeBand } from '@prisma/client'
import { likesFit, readLikes, workFit, type WorkProfile } from '@/lib/profile/work-profile'
import { strengthNotes, type StrengthKeys } from '@/lib/profile/strengths'
import { roleForPosting } from '@/lib/pivots/pivot-map'
import { skillTerms } from '@/lib/profile/skill-matrix'
import { jobSkillGap } from '@/lib/jobs/job-skill-gap'
import { inferFunctionFromTitle, inferLevelFromTitle } from '@/lib/jobs/infer-job-function'
import { candidateScaleLevel } from '@/lib/jobs/job-seniority'
import { calibratedLevelRank, calibratedLevelDistance } from '@/lib/scoring/level-rank'
import { detectRequiredCredential, candidateMeetsCredentialGate } from '@/lib/jobs/credential-gate'
import { assessYearsFit, formatYearsRange, quickYearsRange } from '@/lib/jobs/years-fit'
import { titlesShareRoleFamily } from '@/lib/constants/role-family-keywords'
import { isVagueTargetRole } from '@/lib/constants/onboarding'
import { statesFromLocation, formatUsdK } from '@/lib/pay/market-pay'
import type { CultureProfile } from '@/lib/companies/culture-aggregate'
import {
  CULTURE_DIMENSION_BY_KEY,
  remotePreferenceToScale,
  type CultureAnswers,
  type CultureDimensionKey,
} from '@/lib/companies/culture-survey'
import { normalizeCandidateProfileFields } from '@/lib/constants/candidate-profile-normalize'
import { checkRequirements, parseRequirementFlags, requirementMemberOf, type RequirementCheck } from '@/lib/jobs/requirements'
import { memberVocabularyFunction } from '@/lib/jobs/job-functions'

// Per-job, per-member match with gaps: skills, culture fit, salary, goals and working
// style, each judged only from what the member told us and what the job itself says.
// Pure — no database, no AI, no per-view cost — so the rules are unit-tested
// (src/test/job-match.test.ts) and it runs for every card on the board.
//
// Rules of the road:
// - Never fabricate. A dimension with nothing to compare on either side is "unknown",
//   says what's missing, and is left out of the overall.
// - Never shame. Gaps are written as what to address in the application or interview.
// - Never a precise number on screen: the site shows labels, not scores. The numbers
//   here order and bucket; the UI renders the labels.
// - Confidential jobs: the caller passes no description (see toMatchJob), so nothing
//   here can quote text the card hides.

import {
  MATCH_DIMENSION_LABEL,
  MATCH_DIMENSION_ORDER,
  type JobMatch,
  type MatchDimension,
  type MatchDimensionKey,
  type MatchStatus,
  type OverallMatch,
} from '@/lib/jobs/job-match-types'

export type { JobMatch, MatchDimension, MatchDimensionKey, MatchStatus, OverallMatch }

const WEIGHTS: Record<MatchDimensionKey, number> = { skills: 30, goals: 25, workStyle: 20, salary: 15, culture: 10 }
// Culture counts double when it is judged from what at least 3 members who worked at the
// company said, compared with the member's own stated preferences. A posting's wording
// ("fast-paced", "startup") is a weak, self-promotional read of culture, so it stays at
// 10; first-hand reports from several people are the strongest culture evidence we have —
// still below skills (30) and goals (25), which decide whether the member can get and
// wants the job at all.
const INSIDER_CULTURE_WEIGHT = 20

const PROFILE = {
  skills: { label: 'Add your skills', href: '/dashboard/skills-assessments' },
  culture: { label: 'Add your culture preferences', href: '/dashboard/search-strategy#culture-preferences' },
  salary: { label: 'Add your minimum pay', href: '/dashboard/search-strategy' },
  goals: { label: 'Set your target role', href: '/dashboard/search-strategy' },
  workStyle: { label: 'Add your location preference', href: '/dashboard/search-strategy' },
} as const

export interface MatchCandidate {
  resumeKeywords: string[]
  confirmedSkillsHave: string[]
  certifications: string[]
  // The person's own levels and removals in the skills matrix.
  skillLevels?: unknown
  // The ten-dimension work profile, when the caller loaded it.
  workProfile?: WorkProfile | null
  // Standout strengths and weak spots, when the caller loaded them.
  strengthKeys?: StrengthKeys | null
  // Their this-or-that answers, incl. what they want less / more of.
  workStyleAnswers?: unknown
  yearsExperience: number | null
  hasJD: boolean
  hasMD: boolean
  hasDO: boolean
  isPeopleManager: boolean | null
  teamSizeManaged: number | null
  // culture
  targetCompanySize: string | null
  targetCompanyStage: string | null
  priorityMission: number | null
  priorityWorkLife: number | null
  priorityJobSecurity: number | null
  priorityBrandName: number | null
  equityImportant: boolean
  /** The member's culture preferences (CandidateCulturePreference); 0 = no preference. */
  culturePrefs?: CultureAnswers | null
  // salary
  targetCompMin: number | null
  compFlexible: boolean
  lastSalary: number | null
  // goals
  targetRoleType: string | null
  targetFunction: string | null
  primaryFunction: string | null
  secondaryFunction: string | null
  targetIndustries: string[]
  industryContext: string | null
  isPivoting: boolean
  highestLevelReached: string | null
  levelRankScore: number | null
  willingToStartLower: boolean
  // working style
  remotePreference: string | null
  currentCity: string | null
  currentState: string | null
  openToRelocation: boolean
  // journeyDetails.relocation says how far (src/lib/journey/relocation.ts).
  journeyDetails?: unknown
  travelWillingness: boolean
  interimConsultingInterest: boolean
  // Requirement answers (clearance, licenses, work authorization, max travel; requirements.ts).
  // Optional: a caller that didn't load them gets each job requirement shown as unanswered.
  maxTravelPct?: number | null
  clearanceLevel?: string | null
  clearanceActive?: boolean | null
  clearancePolygraph?: string | null
  licensesHeld?: string[]
  licensesAnsweredAt?: Date | null
  workAuthorization?: string | null
  searchStrategyConfirmedAt?: Date | null
  onboardingLocationConfirmedAt?: Date | null
  // A workforce program's region, when the member is in one: jobs inside it
  // rank first ("Stay local").
  local?: { label: string; isLocal: (location: string | null) => boolean } | null
}

export interface MatchJob {
  title: string
  /** Null for confidential jobs — the card never shows their text. */
  description: string | null
  skills: string[]
  location: string | null
  level: string | null
  industry: string | null
  sourceName?: string | null
  salaryMin: number | null
  salaryMax: number | null
  marketPayLow: number | null
  marketPayMid: number | null
  marketPayHigh: number | null
  targetFunction: string | null
  targetLevel: string | null
  targetRemotePolicy: string | null
  companySizeBand?: CompanySizeBand | null
  companyOwnership?: CompanyOwnershipType | null
  /** Aggregate from members who worked at the company (culture-profile.ts); used only when shown. */
  insiderCulture?: CultureProfile | null
  /** Hard requirements the crawler read from the full posting (requirements.ts); null/absent = none known. */
  requirementFlags?: unknown
  /** Primary US state, for "relocation required" against where the member lives. */
  locationState?: string | null
  /** AI skill item ids the crawler read from the full posting (ai-skills.ts); absent = not read. */
  aiSkillItems?: string[] | null
}

/** Board row -> match input. Drops the description of a confidential search. */
export function toMatchJob(
  p: Omit<MatchJob, 'description' | 'companySizeBand' | 'companyOwnership' | 'insiderCulture' | 'requirementFlags' | 'locationState' | 'aiSkillItems'> & {
    description: string | null
    disclosure: string
    requirementFlags?: unknown
    locationState?: string | null
    aiSkillItems?: string[] | null
  },
  company?: { sizeBand?: CompanySizeBand | null; ownershipType?: CompanyOwnershipType | null; insiderCulture?: CultureProfile | null } | null
): MatchJob {
  return {
    title: p.title,
    description: p.disclosure === 'CONFIDENTIAL' ? null : p.description,
    skills: p.skills,
    location: p.location,
    level: p.level,
    industry: p.industry,
    sourceName: p.sourceName ?? null,
    salaryMin: p.salaryMin,
    salaryMax: p.salaryMax,
    marketPayLow: p.marketPayLow,
    marketPayMid: p.marketPayMid,
    marketPayHigh: p.marketPayHigh,
    targetFunction: p.targetFunction,
    targetLevel: p.targetLevel,
    targetRemotePolicy: p.targetRemotePolicy,
    companySizeBand: company?.sizeBand ?? null,
    companyOwnership: company?.ownershipType ?? null,
    insiderCulture: company?.insiderCulture ?? null,
    requirementFlags: p.requirementFlags ?? null,
    locationState: p.locationState ?? null,
    aiSkillItems: p.aiSkillItems ?? null,
  }
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)))
const statusOf = (score: number): MatchStatus => (score >= 75 ? 'strong' : score >= 45 ? 'partial' : 'gap')
const has = (s: string | null | undefined): s is string => !!s && s.trim().length > 0
const jobText = (job: MatchJob) => `${job.title}\n${job.description ?? ''}`
const usd = (n: number) => formatUsdK(n)

// ── 1. Skills ────────────────────────────────────────────────────────────────

export function scoreSkills(c: MatchCandidate, job: MatchJob): MatchDimension & { missing: string[]; yearsShort: number | null } {
  const keywords = skillTerms(c)
  const text = jobText(job)
  const credential = detectRequiredCredential(text)
  const credentialOk = candidateMeetsCredentialGate(c, credential)
  const required = quickYearsRange(text)
  // Shared lenient rule (years-fit.ts): only a stretch or far-off gap counts as short.
  const years = assessYearsFit(c.yearsExperience, required)
  const yearsShort = years.band === 'stretch' || years.band === 'far' ? years.short : null

  const gap = jobSkillGap({ title: job.title, description: job.description, skills: job.skills, aiSkillItems: job.aiSkillItems, memberKeywords: keywords })
  const evidence: string[] = []
  if (!credentialOk) evidence.push(credential === 'JD' ? 'Requires a law license (JD)' : 'Requires a medical license (MD/DO)')

  if (keywords.length === 0) {
    return {
      key: 'skills',
      score: credentialOk ? null : 0,
      status: credentialOk ? 'unknown' : 'gap',
      evidence: [...evidence, "We don't have your skills yet, so we can't compare them to this job"],
      profilePrompt: PROFILE.skills,
      missing: [],
      yearsShort,
    }
  }
  if (gap.basis === 'none' && required === null && credentialOk) {
    return {
      key: 'skills',
      score: null,
      status: 'unknown',
      evidence: ["This posting doesn't list enough specific skills to compare"],
      missing: [],
      yearsShort: null,
    }
  }

  let score = gap.coveragePct ?? 70
  if (gap.basis === 'posting') {
    evidence.push(`You show ${gap.have.length} of ${gap.requested.length} skills it asks for`)
    if (gap.have.length > 0) evidence.push(`Matches: ${gap.have.slice(0, 4).join(', ')}`)
  }
  if (required !== null && c.yearsExperience !== null) {
    // In line: no penalty. Stretch (short, but at least half the minimum): mild.
    // Far off (under half the minimum): the real penalty.
    if (years.band === 'far') score -= 25
    else if (years.band === 'stretch') score -= 10
    evidence.push(`Asks for ${formatYearsRange(required)}; you have ${c.yearsExperience}`)
  }
  if (!credentialOk) score = 0
  score = clamp(score)
  return { key: 'skills', score, status: statusOf(score), evidence, missing: gap.missing, yearsShort }
}

// ── 2. Culture ───────────────────────────────────────────────────────────────

type Stage = 'startup' | 'growth' | 'enterprise' | 'non-profit' | 'government'
const STAGE_LABEL: Record<Stage, string> = {
  startup: 'a startup',
  growth: 'a growth-stage company',
  enterprise: 'a large established company',
  'non-profit': 'a nonprofit',
  government: 'a public-sector employer',
}

function jobStage(job: MatchJob): { stage: Stage; why: string } | null {
  const t = jobText(job).toLowerCase()
  if (job.industry === 'government' || /\b(usajobs)\b/i.test(job.sourceName ?? '') || /\b(state of|county of|city of|federal agency|department of)\b/.test(t))
    return { stage: 'government', why: 'public-sector employer' }
  if (job.industry === 'nonprofit' || job.industry === 'association' || /\b(non-?profit|501\(c\))/.test(t))
    return { stage: 'non-profit', why: 'non-profit' }
  if (/\b(seed|series a|series b|early[- ]stage|founding team|founding member|pre-ipo startup)\b/.test(t) || (/\bstartup\b/.test(t) && !/\bstartups?\b.*\bclients?\b/.test(t)))
    return { stage: 'startup', why: 'startup language in the posting' }
  if (/\b(series [c-f]|high[- ]growth|hyper-?growth|scale-?up|rapidly growing)\b/.test(t)) return { stage: 'growth', why: 'growth-stage language' }
  if (job.companyOwnership === 'VC_BACKED') return { stage: 'growth', why: 'venture-backed' }
  if (job.companyOwnership === 'PUBLIC' || /\b(fortune (?:100|500|1000)|publicly traded|nyse|nasdaq)\b/.test(t)) return { stage: 'enterprise', why: 'publicly traded / Fortune company' }
  if (job.companySizeBand && ['LARGE', 'ENTERPRISE', 'MEGA'].includes(job.companySizeBand)) return { stage: 'enterprise', why: 'large employer' }
  return null
}

const SIZE_BANDS: Record<string, CompanySizeBand[]> = {
  '1-50': ['MICRO', 'SMALL'],
  '50-500': ['SMALL_MID', 'MID'],
  '500+': ['MID_LARGE', 'LARGE', 'ENTERPRISE', 'MEGA'],
}

/** Rank 1-2 of the five forced tradeoffs = a top priority. */
const isTop = (rank: number | null) => rank !== null && rank <= 2

function scorePostingCulture(c: MatchCandidate, job: MatchJob): MatchDimension & { notes: string[] } {
  const prefs = c.culturePrefs ?? {}
  const wantsCalm = prefs.pace === 1 || prefs.workLife === 1
  const wantsMission = prefs.mission === 1
  // Only a stage we can name: an unrecognised stored value ('GROWTH' before
  // normalisation) used to crash the card on STAGE_LABEL[wantsStage].
  const wantsStage = has(c.targetCompanyStage) && c.targetCompanyStage in STAGE_LABEL ? (c.targetCompanyStage as Stage) : null
  const wantsSize = has(c.targetCompanySize) && c.targetCompanySize !== 'Any' ? c.targetCompanySize : null
  const priorities = [c.priorityMission, c.priorityWorkLife, c.priorityJobSecurity, c.priorityBrandName].some((p) => p !== null)
  const hasPrefs = Object.values(prefs).some((v) => v !== null && v !== undefined)
  if (!wantsStage && !wantsSize && !priorities && !c.equityImportant && !hasPrefs) {
    return {
      key: 'culture',
      score: null,
      status: 'unknown',
      evidence: ["Tell us what kind of company and pace you want, and we'll compare it here"],
      profilePrompt: PROFILE.culture,
      notes: [],
    }
  }

  const t = jobText(job).toLowerCase()
  const stage = jobStage(job)
  let score = 65
  let signals = 0
  const evidence: string[] = []
  const notes: string[] = []

  if (wantsStage && stage) {
    signals++
    if (stage.stage === wantsStage) {
      score += 20
      evidence.push(`Looks like ${STAGE_LABEL[stage.stage]}, which is what you're targeting`)
    } else {
      score -= 25
      evidence.push(`Looks like ${STAGE_LABEL[stage.stage]}${stage.why !== stage.stage ? ` (${stage.why})` : ''}; you're targeting ${STAGE_LABEL[wantsStage]}`)
      notes.push(`This looks like ${STAGE_LABEL[stage.stage]}, not the ${STAGE_LABEL[wantsStage].replace(/^an? /, '')} you're targeting — ask about pace and decision-making early`)
    }
  }
  if (wantsSize && job.companySizeBand) {
    signals++
    if (SIZE_BANDS[wantsSize]?.includes(job.companySizeBand)) {
      score += 10
      evidence.push(`Company size fits your ${wantsSize} employee target`)
    } else {
      score -= 15
      evidence.push(`Company size is outside your ${wantsSize} employee target`)
    }
  }
  const intense = /\b(fast[- ]paced|high[- ]pressure|on[- ]call|nights and weekends|evenings? and weekends?|24\/7|demanding (?:pace|environment))\b/.test(t)
  const balanced = /\b(work[- ]life balance|flexible (?:schedule|hours)|four[- ]day work ?week|generous pto)\b/.test(t)
  if ((isTop(c.priorityWorkLife) || wantsCalm) && (intense || balanced)) {
    signals++
    if (intense && !balanced) {
      score -= 15
      evidence.push(`Posting stresses a demanding pace; you want ${isTop(c.priorityWorkLife) ? 'work-life balance' : 'a steadier pace'}`)
      notes.push(`The posting stresses a demanding pace and you want ${isTop(c.priorityWorkLife) ? 'work-life balance' : 'a steadier pace'} — ask how the team really works week to week`)
    } else {
      score += 10
      evidence.push('Posting mentions flexibility or work-life balance, which you want')
    }
  }
  if (isTop(c.priorityMission) || wantsMission) {
    const mission = stage?.stage === 'non-profit' || stage?.stage === 'government' || /\b(mission[- ]driven|our mission|impact|public service)\b/.test(t)
    if (mission) {
      signals++
      score += 10
      evidence.push('Mission-led employer, and mission matters to you')
    }
  }
  if (isTop(c.priorityJobSecurity) && stage) {
    signals++
    if (stage.stage === 'startup') {
      score -= 15
      evidence.push('Startups carry more risk; job security is a top priority for you')
      notes.push('Job security is a top priority for you and this is a startup — ask about funding runway and revenue')
    } else if (stage.stage === 'government' || stage.stage === 'enterprise') {
      score += 10
      evidence.push('Established employer, and job security is a top priority for you')
    }
  }
  if (isTop(c.priorityBrandName) && stage?.stage === 'enterprise') {
    signals++
    score += 5
    evidence.push('Recognizable, established employer — brand matters to you')
  }
  if (c.equityImportant && /\b(equity|stock options|rsus?)\b/.test(t)) {
    signals++
    score += 5
    evidence.push('Mentions equity, which matters to you')
  }

  if (signals === 0) {
    return { key: 'culture', score: null, status: 'unknown', evidence: ["The posting says little about culture or company type — ask in a first conversation"], notes: [] }
  }
  score = clamp(score)
  return { key: 'culture', score, status: statusOf(score), evidence, notes }
}

/** The member's preference per culture dimension (1..3), with where-you-work from the profile. */
function culturePreferenceScale(c: MatchCandidate): Partial<Record<CultureDimensionKey, number>> {
  const out: Partial<Record<CultureDimensionKey, number>> = {}
  for (const [k, v] of Object.entries(c.culturePrefs ?? {})) if (v === 1 || v === 2 || v === 3) out[k as CultureDimensionKey] = v
  const remote = remotePreferenceToScale(c.remotePreference)
  if (remote !== null) out.remoteReality = remote
  return out
}

const membersSay = (n: number) => `${n} member${n === 1 ? '' : 's'} who worked here`

/**
 * Culture from what members who worked at the company said (at or above the privacy
 * floor), compared with the member's preferences. Null when there is nothing to compare.
 */
export function compareInsiderCulture(
  c: MatchCandidate,
  profile: CultureProfile
): { score: number; evidence: string[]; notes: string[]; compared: number } | null {
  if (!profile.shown) return null
  const prefs = culturePreferenceScale(c)
  const rows: { diff: number; text: string; note: string | null }[] = []
  for (const agg of profile.dimensions) {
    const want = prefs[agg.key]
    if (!want) continue
    const d = CULTURE_DIMENSION_BY_KEY[agg.key]
    const diff = d.direction === 'match' ? Math.abs(agg.mean - want) : Math.max(0, agg.mean - want)
    const said = agg.typical
      ? `${membersSay(agg.answered)} describe ${d.subject} as ${d.describe[agg.typical - 1]}`
      : `${membersSay(agg.answered)} are split on ${d.subject}`
    const wantText = d.prefPhrase[want - 1]
    if (diff < 0.5) rows.push({ diff, text: `${said}, which fits what you want`, note: null })
    else
      rows.push({
        diff,
        text: `${said}; you ${wantText}`,
        note:
          diff >= 1 && agg.typical
            ? `Members who worked here describe ${d.subject} as ${d.describe[agg.typical - 1]} and you ${wantText} — ${d.ask}`
            : null,
      })
  }
  if (rows.length === 0) return null
  rows.sort((a, b) => b.diff - a.diff)
  const avgDiff = rows.reduce((s, r) => s + r.diff, 0) / rows.length
  const worst = rows[0].diff
  // 0 apart = 100, a full step = 60, two steps = 20; one large mismatch pulls harder than the average.
  const score = clamp(100 - 40 * (avgDiff * 0.7 + worst * 0.3))
  // Mismatches first, then one fit, so the panel shows both sides.
  const mismatches = rows.filter((r) => r.diff >= 0.5)
  const fits = rows.filter((r) => r.diff < 0.5)
  const evidence = [...mismatches.slice(0, 2), ...fits.slice(0, mismatches.length > 0 ? 1 : 2)].map((r) => r.text)
  return { score, evidence, notes: rows.map((r) => r.note).filter((n): n is string => !!n), compared: rows.length }
}

/** One-line summary of an insider profile, for a member who hasn't set preferences. */
function insiderCultureSummary(profile: CultureProfile): string | null {
  const parts = profile.dimensions
    .filter((a) => a.typical)
    .slice(0, 3)
    .map((a) => {
      const d = CULTURE_DIMENSION_BY_KEY[a.key]
      return `${d.label.toLowerCase()} ${d.describe[a.typical! - 1]}`
    })
  return parts.length > 0 ? `${membersSay(profile.respondentCount)} describe it as: ${parts.join('; ')}` : null
}

export function scoreCulture(c: MatchCandidate, job: MatchJob): MatchDimension & { notes: string[]; insiderBased: boolean } {
  const posting = scorePostingCulture(c, job)
  const insider = job.insiderCulture?.shown ? job.insiderCulture : null
  if (!insider) return { ...posting, insiderBased: false }

  const cmp = compareInsiderCulture(c, insider)
  if (!cmp) {
    // Insider data exists but the member hasn't said what they want on any of its questions.
    const summary = insiderCultureSummary(insider)
    return {
      ...posting,
      evidence: summary ? [summary, ...posting.evidence.filter((e) => !e.startsWith('Tell us'))] : posting.evidence,
      profilePrompt: PROFILE.culture,
      insiderBased: false,
    }
  }
  // Insiders lead; the posting's own wording, when it says anything, nudges a quarter.
  const score = posting.score !== null ? clamp(cmp.score * 0.75 + posting.score * 0.25) : cmp.score
  return {
    key: 'culture',
    score,
    status: statusOf(score),
    evidence: [...cmp.evidence, ...posting.evidence.filter((e) => !e.startsWith('Tell us') && !e.startsWith('The posting says little'))],
    notes: [...cmp.notes, ...posting.notes],
    insiderBased: true,
  }
}

// ── 3. Salary ────────────────────────────────────────────────────────────────

/**
 * An annual range the posting text states ("$95,000 – 135,000", "$120K-$150K") when the
 * structured salary is empty. Annual-looking amounts only; hourly or ambiguous text is ignored.
 */
export function payFromText(text: string | null): { low: number; high: number } | null {
  if (!text) return null
  const m = text.match(/\$\s?(\d{2,3}(?:,\d{3})|\d{2,3}(?:\.\d)?\s?[kK])\s*(?:-|–|—|to)\s*\$?\s?(\d{2,3}(?:,\d{3})|\d{2,3}(?:\.\d)?\s?[kK])/)
  if (!m) return null
  const toNum = (s: string) => (/k/i.test(s) ? Math.round(parseFloat(s) * 1000) : parseInt(s.replace(/,/g, ''), 10))
  const low = toNum(m[1])
  const high = toNum(m[2])
  if (!(low >= 30_000 && high >= low && high <= 2_000_000)) return null
  const after = text.slice((m.index ?? 0) + m[0].length, (m.index ?? 0) + m[0].length + 20).toLowerCase()
  if (/^\s*(?:\/\s*h|per hour|an hour|hourly)/.test(after)) return null
  return { low, high }
}

export function scoreSalary(c: MatchCandidate, job: MatchJob): MatchDimension & { note: string | null } {
  const floor = c.targetCompMin ?? null
  const reference = floor ?? c.lastSalary ?? null
  const refLabel = floor ? 'your minimum' : 'your last salary'
  const posted =
    job.salaryMin || job.salaryMax ? { low: job.salaryMin ?? job.salaryMax!, high: job.salaryMax ?? job.salaryMin! } : payFromText(job.description)
  const market = job.marketPayLow && job.marketPayHigh ? { low: job.marketPayLow, high: job.marketPayHigh, mid: job.marketPayMid ?? Math.round((job.marketPayLow + job.marketPayHigh) / 2) } : null

  if (!reference) {
    return {
      key: 'salary',
      score: null,
      status: 'unknown',
      evidence: [
        posted ? `Posted pay ${usd(posted.low)}–${usd(posted.high)}; add your minimum to compare` : market ? `Market pay for this role ${usd(market.low)}–${usd(market.high)} (our estimate); add your minimum to compare` : 'No pay posted',
      ],
      profilePrompt: PROFILE.salary,
      note: null,
    }
  }
  if (!posted && !market) {
    return { key: 'salary', score: null, status: 'unknown', evidence: ['No pay posted and no market estimate for this role yet'], note: null }
  }

  const range = posted ?? market!
  const label = posted ? `Posted pay ${usd(range.low)}–${usd(range.high)}` : `Market pay ${usd(range.low)}–${usd(range.high)} (our estimate; no pay posted)`
  const flexible = c.compFlexible || c.willingToStartLower
  let score: number
  let note: string | null = null
  if (range.low >= reference) {
    score = 90
  } else if (range.high >= reference) {
    score = 65
    note = posted
      ? `Your ${floor ? 'minimum' : 'last salary'} (${usd(reference)}) sits inside the posted range — anchor toward the top in the pay conversation`
      : null
  } else {
    const shortBy = (reference - range.high) / reference
    score = shortBy <= 0.1 && flexible ? 50 : shortBy <= 0.1 ? 40 : 15
    note = posted
      ? `Posted top of ${usd(range.high)} is below ${refLabel} of ${usd(reference)} — decide your walk-away number before the first call, or ask whether the range has room`
      : `Our estimate for this role tops out near ${usd(range.high)}, below ${refLabel} of ${usd(reference)} — ask about the range in the first call`
  }
  if (!posted) score = Math.round(score * 0.9 + 5) // an estimate is softer evidence
  const evidence = [`${label} vs ${refLabel} of ${usd(reference)}`]
  if (flexible && score < 75) evidence.push("You said you're flexible on pay")
  return { key: 'salary', score: clamp(score), status: statusOf(clamp(score)), evidence, note }
}

// ── 4. Goals ─────────────────────────────────────────────────────────────────

const INDUSTRY_WORDS: Record<string, string[]> = {
  technology: ['tech', 'software', 'saas', 'ai', 'cyber', 'it', 'data', 'cloud', 'internet', 'edtech', 'fintech', 'enterprise software'],
  industrial: ['industrial', 'manufactur', 'aerospace', 'automotive', 'construction', 'chemical'],
  healthcare: ['health', 'hospital', 'medical', 'care'],
  financial_services: ['financ', 'bank', 'insurance', 'fintech', 'invest', 'capital', 'asset', 'wealth', 'venture', 'private equity'],
  education: ['educat', 'edtech', 'school', 'learning', 'university'],
  higher_education: ['higher ed', 'educat', 'university', 'college'],
  consumer: ['consumer', 'retail', 'cpg', 'e-commerce', 'ecommerce', 'food', 'beverage', 'hospitality'],
  life_sciences: ['biotech', 'pharma', 'life science', 'medtech', 'medical device'],
  energy: ['energy', 'oil', 'gas', 'utilit', 'renewable', 'power', 'climate'],
  government: ['government', 'public sector', 'federal', 'civic', 'public service'],
  nonprofit: ['nonprofit', 'non-profit', 'philanthrop', 'impact', 'social'],
  association: ['association', 'nonprofit', 'non-profit'],
  professional_services: ['consult', 'professional services', 'accounting', 'advisory'],
  logistics: ['logistic', 'supply chain', 'transport', 'shipping', 'freight'],
  real_estate: ['real estate', 'property', 'proptech'],
  media: ['media', 'entertainment', 'publishing', 'advertising'],
  agriculture: ['agri', 'farm', 'food'],
  aerospace_defense: ['aerospace', 'defense', 'defence', 'aviation', 'military', 'national security'],
  telecom: ['telecom', 'wireless', 'broadband'],
}
// Crawler keys whose words don't read well from the key itself.
const INDUSTRY_LABELS: Record<string, string> = {
  aerospace_defense: 'Aerospace & defense',
  telecom: 'Telecommunications',
}
const INDUSTRY_LABEL = (k: string) => {
  if (INDUSTRY_LABELS[k]) return INDUSTRY_LABELS[k]
  const t = k.replace(/_/g, ' ')
  return t.charAt(0).toUpperCase() + t.slice(1)
}

function industryMatches(job: MatchJob, targets: string[]): boolean | null {
  if (!job.industry || targets.length === 0) return null
  const words = INDUSTRY_WORDS[job.industry] ?? [job.industry]
  return targets.some((t) => {
    const tl = t.toLowerCase()
    return words.some((w) => (w.length <= 3 ? new RegExp(`\\b${w}\\b`).test(tl) : tl.includes(w)))
  })
}

const GENERIC = new Set(['senior', 'director', 'manager', 'head', 'lead', 'chief', 'vice', 'president', 'vp', 'officer', 'global', 'executive', 'of', 'and', 'the'])
const words = (s: string) => s.toLowerCase().split(/[^a-z0-9&]+/).filter((w) => w.length > 2 && !GENERIC.has(w))

function titleMatchesTarget(target: string | null, title: string): boolean | null {
  if (!has(target) || isVagueTargetRole(target)) return null
  const tw = words(target)
  const jw = new Set(words(title))
  return tw.some((w) => jw.has(w)) || titlesShareRoleFamily(target, title)
}

export function scoreGoals(c: MatchCandidate, job: MatchJob): MatchDimension & { notes: string[] } {
  // The crawler's function when it is one of the member's own options; otherwise the title's.
  const jobFunction = memberVocabularyFunction(job.targetFunction) ?? inferFunctionFromTitle(job.title)
  const targetFn = c.targetFunction ?? (c.isPivoting ? null : c.primaryFunction)
  const ownFns = [c.primaryFunction, c.secondaryFunction].filter(has)
  const candidateLevel = c.levelRankScore ?? calibratedLevelRank(c.highestLevelReached, null)
  const jobLevelName = job.targetLevel ?? candidateScaleLevel(job.level) ?? inferLevelFromTitle(job.title)
  const jobLevel = calibratedLevelRank(jobLevelName, job.companySizeBand ?? null)
  const titleHit = titleMatchesTarget(c.targetRoleType, job.title)
  const industryHit = industryMatches(job, [...c.targetIndustries, ...(c.industryContext ? [c.industryContext] : [])])

  if (!targetFn && ownFns.length === 0 && candidateLevel === null && titleHit === null) {
    return {
      key: 'goals',
      score: null,
      status: 'unknown',
      evidence: ["Set your target role and level so we can tell whether this moves you forward"],
      profilePrompt: PROFILE.goals,
      notes: [],
    }
  }

  let score = 60
  const evidence: string[] = []
  const notes: string[] = []

  // Direction of travel: the role/function they're aiming for.
  if (titleHit === true) {
    score += 20
    evidence.push(`Title lines up with your target role (${c.targetRoleType})`)
  } else if (jobFunction && targetFn && jobFunction.toLowerCase() === targetFn.toLowerCase()) {
    score += 15
    evidence.push(`${jobFunction} — the function you're targeting`)
    if (c.isPivoting && !ownFns.some((f) => f.toLowerCase() === jobFunction.toLowerCase())) {
      notes.push(`This is a move into ${jobFunction} from ${ownFns[0] ?? 'your current function'} — lead with the results that transfer, in their language`)
    }
  } else if (jobFunction && ownFns.some((f) => f.toLowerCase() === jobFunction.toLowerCase())) {
    if (c.isPivoting && c.targetFunction) {
      score -= 10
      evidence.push(`${jobFunction} is your background, not the ${c.targetFunction} you're moving toward`)
    } else {
      score += 10
      evidence.push(`${jobFunction} — your own function`)
    }
  } else if (titleHit === false || (jobFunction && (targetFn || ownFns.length > 0))) {
    score -= 25
    evidence.push(jobFunction ? `${jobFunction} role — outside your target` : "Title doesn't match your target role")
    notes.push(`This role sits outside the ${c.targetRoleType ?? targetFn ?? 'function'} you're targeting — be ready to say why it's a deliberate move`)
  }

  // Level: a step up, the same, or a step down. Never shows the underlying rank.
  if (candidateLevel !== null && jobLevel !== null) {
    const steps = calibratedLevelDistance(candidateLevel, jobLevel)
    const up = jobLevel > candidateLevel
    if (steps === 0) {
      score += 10
      evidence.push('At your level')
    } else if (up && steps === 1) {
      score += 10
      evidence.push('A step up from your level')
    } else if (up) {
      score -= 10
      evidence.push('A big step up from your level')
      notes.push('This is a big step up — show scope you have already carried at that level (team, budget, decisions)')
    } else if (c.willingToStartLower) {
      score -= 5
      evidence.push("Below your level — you said you're open to that")
      notes.push('This is below your last level — say why it fits now, so they don’t worry you’ll leave for the next senior offer')
    } else {
      score -= steps >= 2 ? 30 : 15
      evidence.push('Below your level')
      notes.push('This is below your last level — say why it fits now, so they don’t worry you’ll leave for the next senior offer')
    }
  }

  if (industryHit === true) {
    score += 10
    evidence.push(`${INDUSTRY_LABEL(job.industry!)} — an industry you're targeting`)
  } else if (industryHit === false && c.targetIndustries.length > 0) {
    score -= 5
    evidence.push(`${INDUSTRY_LABEL(job.industry!)} — not one of your target industries`)
  }

  score = clamp(score)
  return { key: 'goals', score, status: statusOf(score), evidence, notes }
}

// ── 5. Working style ─────────────────────────────────────────────────────────

type Arrangement = 'remote' | 'hybrid' | 'onsite'

export function jobArrangement(job: MatchJob): { arrangement: Arrangement; detail: string | null } | null {
  const policy = job.targetRemotePolicy?.toLowerCase()
  if (policy === 'remote' || policy === 'hybrid' || policy === 'onsite') return { arrangement: policy, detail: null }
  const loc = job.location ?? ''
  const t = `${job.title}\n${loc}\n${job.description ?? ''}`.toLowerCase()
  const days =
    t.match(/\b(\d)\s*(?:days?)\s*(?:per week\s*|a week\s*)?(?:in|on)[- ](?:the\s*)?(?:office|site)\b/) ??
    t.match(/\b(?:in[- ](?:the[- ])?office|on[- ]?site)\s+(\d)\s+days\b/)
  if (/\bhybrid\b/.test(t) || days) return { arrangement: 'hybrid', detail: days ? `${days[1]} days in the office` : null }
  if (/\b(fully remote|100% remote|remote[- ]first|remote)\b/.test(`${job.title}\n${loc}`.toLowerCase()) || /\b(fully remote|100% remote|remote[- ]first|this (?:is a|role is) remote)\b/.test(t))
    return { arrangement: 'remote', detail: null }
  if (/\b(on[- ]?site|in[- ]office|in person|in-person)\b/.test(t)) return { arrangement: 'onsite', detail: null }
  return null
}

const ARRANGEMENT_LABEL: Record<Arrangement, string> = { remote: 'Remote', hybrid: 'Hybrid', onsite: 'On-site' }

function candidateStates(c: MatchCandidate): string[] {
  const parsed = statesFromLocation([c.currentCity, c.currentState].filter(has).join(', ')).states
  if (parsed.length > 0) return parsed
  return has(c.currentState) && c.currentState.trim().length === 2 ? [c.currentState.trim().toUpperCase()] : []
}

export function scoreWorkStyle(c: MatchCandidate, job: MatchJob): MatchDimension & { notes: string[] } {
  const pref = has(c.remotePreference) ? (c.remotePreference as Arrangement | 'flexible') : null
  const myStates = candidateStates(c)
  if (!pref && myStates.length === 0) {
    return {
      key: 'workStyle',
      score: null,
      status: 'unknown',
      evidence: ['Tell us where you live and whether you want remote, hybrid or on-site'],
      profilePrompt: PROFILE.workStyle,
      notes: [],
    }
  }

  const arr = jobArrangement(job)
  const where = statesFromLocation(job.location)
  const t = jobText(job).toLowerCase()
  let score = 70
  let signals = 0
  const evidence: string[] = []
  const notes: string[] = []
  const place = job.location?.trim() || 'the posted location'

  if (arr && pref) {
    signals++
    const label = `${ARRANGEMENT_LABEL[arr.arrangement]}${arr.detail ? ` (${arr.detail})` : ''}`
    if (pref === 'flexible' || pref === arr.arrangement || arr.arrangement === 'remote') {
      score += 15
      evidence.push(`${label} — works with your preference`)
    } else if (pref === 'remote') {
      score -= arr.arrangement === 'onsite' ? 40 : 20
      evidence.push(`${label}; you prefer remote`)
      notes.push(`${label} in ${place}; you prefer remote — decide if that's a dealbreaker before you apply, or ask whether there's flexibility`)
    } else if (pref === 'hybrid' && arr.arrangement === 'onsite') {
      score -= 15
      evidence.push(`${label}; you prefer hybrid`)
    } else {
      evidence.push(`${label}; you prefer ${ARRANGEMENT_LABEL[pref as Arrangement]?.toLowerCase() ?? pref}`)
    }
  }

  const remoteJob = arr?.arrangement === 'remote' || where.isRemote
  if (c.local && !remoteJob && c.local.isLocal(job.location)) {
    signals++
    score += 15
    evidence.push(`In ${c.local.label}`)
  }
  if (!remoteJob && where.states.length > 0 && myStates.length > 0) {
    signals++
    if (where.states.some((s) => myStates.includes(s))) {
      score += 10
      evidence.push(`In your state (${where.states.find((s) => myStates.includes(s))})`)
    } else if (where.states.some((s) => wouldMoveTo(parseRelocation(c.journeyDetails, c.openToRelocation), s, myStates[0] ?? null))) {
      score -= 10
      evidence.push(`Based in ${place} — a move, which you said you're open to`)
    } else {
      score -= 35
      evidence.push(`Based in ${place}; you're in ${myStates[0]} and not looking to relocate`)
      const arrangementNote = notes.findIndex((n) => n.includes('you prefer remote'))
      const moveNote = `Based in ${place} and you're not looking to relocate — ask whether remote or a later move is possible before investing in the application`
      if (arrangementNote >= 0) {
        notes[arrangementNote] = `${ARRANGEMENT_LABEL[arr!.arrangement]} in ${place}; you prefer remote and aren't looking to relocate — ask early whether remote is possible, or decide it's a pass`
      } else notes.push(moveNote)
    }
  }

  const travel = t.match(/\btravel(?:ing)?\s+(?:up to\s+)?(\d{2})\s*%/) ?? t.match(/\b(\d{2})\s*%\s+travel/)
  const heavyTravel = (travel && parseInt(travel[1], 10) >= 25) || /\b(extensive|frequent|significant) travel\b/.test(t)
  if (heavyTravel) {
    signals++
    const what = travel ? `${travel[1]}% travel` : 'frequent travel'
    const maxTravel = c.maxTravelPct ?? null
    const travelOk = maxTravel !== null ? maxTravel >= 75 || (!!travel && parseInt(travel[1], 10) <= maxTravel) || (!travel && maxTravel >= 50) : c.travelWillingness
    if (travelOk) evidence.push(`Asks for ${what}; you're open to travel`)
    else {
      score -= 15
      evidence.push(`Asks for ${what}`)
      notes.push(`Asks for ${what} — you haven't said you're open to travel; confirm how much is real`)
    }
  }

  if (/\b(part[- ]time|contract(?:or)? role|interim|fractional|temporary|\d+[- ]month contract)\b/.test(t)) {
    signals++
    if (c.interimConsultingInterest) evidence.push("Part-time, contract or interim — you're open to that")
    else {
      score -= 10
      evidence.push('Part-time, contract or interim role')
    }
  }

  const team = t.match(/\b(?:manag(?:e|ing)|lead(?:ing)?|oversee(?:ing)?)\s+(?:a\s+)?(?:team|staff|organization)\s+of\s+(\d{1,4})\b/) ?? t.match(/\b(\d{1,4})\+?\s+direct reports\b/)
  if (team) {
    const n = parseInt(team[1], 10)
    signals++
    if (c.teamSizeManaged !== null && c.teamSizeManaged > 0) {
      if (n > c.teamSizeManaged * 2) {
        score -= 15
        evidence.push(`Leads a team of ${n}; your largest is ${c.teamSizeManaged}`)
        notes.push(`Leads a team of ${n}; your largest is ${c.teamSizeManaged} — lead with how you grew or ran teams through others`)
      } else evidence.push(`Leads a team of ${n}; you've led ${c.teamSizeManaged}`)
    } else if (c.isPeopleManager === false) {
      score -= 15
      evidence.push(`Leads a team of ${n}; you haven't managed people yet`)
      notes.push(`Leads a team of ${n} and you haven't managed people directly — show where you led through influence`)
    }
  }

  // How the kind of role suits how they like to work (work profile vs the role's usual shape).
  const likes = readLikes(c.workStyleAnswers)
  const roleKey = c.workProfile || c.strengthKeys || likes.less.length ? roleForPosting(job.title, job.description, inferFunctionFromTitle(job.title)) : null
  if (roleKey && likes.less.length) {
    const still = likesFit({ less: likes.less, more: [] }, null, roleKey).still
    if (still) {
      signals++
      score -= 10
      evidence.push(still)
      notes.push(`${still} Ask how much of the week that really is.`)
    }
  }
  if (roleKey && c.strengthKeys) {
    const sn = strengthNotes(c.strengthKeys, roleKey)
    if (sn.plays || sn.exposes) {
      signals++
      score += Math.round(100 * sn.delta)
      if (sn.plays) evidence.push(sn.plays)
      if (sn.exposes) {
        evidence.push(sn.exposes)
        notes.push(sn.exposes)
      }
    }
  }
  if (c.workProfile && roleKey) {
    const wf = workFit(c.workProfile, roleKey)
    if (wf.fits.length || wf.clashes.length) {
      signals++
      score += Math.round(15 * wf.score)
      if (wf.fits.length) evidence.push(`Suits how you work: ${wf.fits.slice(0, 2).map((f) => f.toLowerCase()).join('; ')}`)
      if (wf.clashes.length) {
        evidence.push(wf.clashes[0].line)
        notes.push(`${wf.clashes[0].line} Ask what a typical week looks like before you apply.`)
      }
    }
  }

  if (signals === 0) {
    return { key: 'workStyle', score: null, status: 'unknown', evidence: ["The posting doesn't say where or how the work happens — ask before you apply"], notes: [] }
  }
  score = clamp(score)
  return { key: 'workStyle', score, status: statusOf(score), evidence, notes }
}

// ── Overall + gaps ───────────────────────────────────────────────────────────

export function matchJobToCandidate(c: MatchCandidate, job: MatchJob): JobMatch {
  // Option-list fields stored as codes ('DIRECTOR', 'REMOTE') read as their canonical value.
  c = normalizeCandidateProfileFields(c)
  const skills = scoreSkills(c, job)
  const culture = scoreCulture(c, job)
  const salary = scoreSalary(c, job)
  const goals = scoreGoals(c, job)
  const workStyle = scoreWorkStyle(c, job)
  const strip = <T extends MatchDimension>(d: T): MatchDimension => ({
    key: d.key,
    score: d.score,
    status: d.status,
    evidence: d.evidence.slice(0, 3),
    ...(d.profilePrompt ? { profilePrompt: d.profilePrompt } : {}),
  })
  const dimensions = {
    skills: strip(skills),
    culture: strip(culture),
    salary: strip(salary),
    goals: strip(goals),
    workStyle: strip(workStyle),
  }

  const requirements = requirementChecksFor(c, job)
  const blockers = requirements.filter((r) => r.status === 'blocker')

  const known = MATCH_DIMENSION_ORDER.filter((k) => dimensions[k].score !== null)
  let overallScore: number | null = null
  let overall: OverallMatch = 'unknown'
  if (known.length >= 2) {
    const weights = { ...WEIGHTS, culture: culture.insiderBased ? INSIDER_CULTURE_WEIGHT : WEIGHTS.culture }
    const w = known.reduce((s, k) => s + weights[k], 0)
    overallScore = Math.round(known.reduce((s, k) => s + dimensions[k].score! * weights[k], 0) / w)
    // A hard gap (a required license, or a location the member has ruled out) caps the overall.
    const hardGap = known.some((k) => dimensions[k].score! < 25)
    if (hardGap) overallScore = Math.min(overallScore, 54)
    // A requirement the member told us they don't meet (an active clearance, citizenship, …): a red flag.
    if (blockers.length > 0) overallScore = Math.min(overallScore, 44)
    overall = overallScore >= 78 ? 'strong' : overallScore >= 62 ? 'good' : overallScore >= 45 ? 'mixed' : 'weak'
  }

  // Gaps: most consequential first — hard blockers, then location/arrangement, salary,
  // skills, level/direction, culture. Each is specific and says what to do.
  const gaps: string[] = []
  const push = (s: string | null | undefined) => {
    if (s && !gaps.includes(s) && gaps.length < 4) gaps.push(s)
  }
  for (const b of blockers) push(`${b.message}. Skip unless that has changed`)
  if (skills.score === 0 && skills.evidence[0]?.startsWith('Requires')) push(`${skills.evidence[0]} — not one you've listed. Skip unless you hold it`)
  if (workStyle.score !== null && workStyle.score < 60) push(workStyle.notes[0])
  if (salary.status === 'gap' || salary.status === 'partial') push(salary.note)
  if (skills.missing.length > 0 && (skills.status !== 'strong' || skills.missing.length >= 2)) {
    const top = skills.missing.slice(0, 3)
    push(`Asks for ${top.join(', ')} — not on your resume or skills list. If you have them, add them; if not, point to the closest work you've done`)
  }
  if (skills.yearsShort) push(`Asks for more years than you have (${skills.yearsShort} short) — lead with the scope and results, not the tenure`)
  for (const n of goals.notes) push(n)
  for (const n of culture.notes) push(n)
  for (const n of workStyle.notes) push(n)

  // Too little to go on: say what is unknown rather than inventing gaps.
  if (gaps.length < 2) {
    const unknown = MATCH_DIMENSION_ORDER.filter((k) => dimensions[k].status === 'unknown' && dimensions[k].profilePrompt)
    if (unknown.length > 0) push(`We can't judge ${unknown.map((k) => MATCH_DIMENSION_LABEL[k].toLowerCase()).join(', ')} yet — fill in your profile to see those gaps`)
  }

  // With a blocker and too little else known, the overall still reads as a weak fit.
  if (blockers.length > 0 && overall === 'unknown') overall = 'weak'
  return { overallScore, overall, dimensions, gaps, requirements }
}

/** The job's requirement flags against the member's answers (requirements.ts). */
export function requirementChecksFor(c: MatchCandidate, job: MatchJob): RequirementCheck[] {
  const flags = parseRequirementFlags(job.requirementFlags)
  if (flags.length === 0) return []
  const member = requirementMemberOf({
    clearanceLevel: c.clearanceLevel ?? null,
    clearanceActive: c.clearanceActive ?? null,
    clearancePolygraph: c.clearancePolygraph ?? null,
    licensesHeld: c.licensesHeld ?? [],
    licensesAnsweredAt: c.licensesAnsweredAt ?? null,
    workAuthorization: c.workAuthorization ?? null,
    maxTravelPct: c.maxTravelPct ?? null,
    travelWillingness: c.travelWillingness,
    openToRelocation: c.openToRelocation,
    searchStrategyConfirmedAt: c.searchStrategyConfirmedAt ?? null,
    onboardingLocationConfirmedAt: c.onboardingLocationConfirmedAt ?? null,
    remotePreference: c.remotePreference,
    currentState: c.currentState,
  })
  return checkRequirements(flags, member, { locationState: job.locationState ?? null })
}

/** Fields of CandidateProfile the match reads — for a Prisma select. */
export const MATCH_CANDIDATE_FIELDS = [
  'resumeKeywords', 'confirmedSkillsHave', 'certifications', 'skillLevels', 'yearsExperience', 'hasJD', 'hasMD', 'hasDO',
  'isPeopleManager', 'teamSizeManaged', 'targetCompanySize', 'targetCompanyStage', 'priorityMission',
  'priorityWorkLife', 'priorityJobSecurity', 'priorityBrandName', 'equityImportant', 'targetCompMin',
  'compFlexible', 'lastSalary', 'targetRoleType', 'targetFunction', 'primaryFunction', 'secondaryFunction',
  'targetIndustries', 'industryContext', 'isPivoting', 'highestLevelReached', 'levelRankScore',
  'willingToStartLower', 'remotePreference', 'currentCity', 'currentState', 'openToRelocation', 'journeyDetails',
  'travelWillingness', 'interimConsultingInterest', 'maxTravelPct', 'clearanceLevel', 'clearanceActive',
  'clearancePolygraph', 'licensesHeld', 'licensesAnsweredAt', 'workAuthorization', 'searchStrategyConfirmedAt',
  'onboardingLocationConfirmedAt',
] as const satisfies readonly (keyof MatchCandidate)[]

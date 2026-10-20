// Loads everything the Market Reality Report shows, live, from the tables
// that already hold it. No model call anywhere: every sentence is either
// the candidate's own data or a fixed rule applied to it, so the report can
// never describe a number differently from the place that computed it
// (Report Structure Spec §6 rule 1).
//
// Each section loads independently and degrades to null: a market-stats
// outage must not take the resume section down with it.

import 'server-only'
import type { CandidateProfile } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import type { Grade } from '@/lib/scoring/grade'
import { DIFFICULTY_LABEL } from '@/lib/scoring/market-reality/narrative'
import { NETWORKING_WEIGHT } from '@/lib/scoring/market-reality/attempts'
import {
  getAtsMatrix,
  getRecruiterReadItems,
  getResumeFixes,
  getWhereYouStand,
  type AtsMatrixSection,
  type RecruiterReadItem,
  type ResumeFixItem,
} from '@/lib/reports/market-reality-sections'
import { getSearchDiagnosis } from '@/lib/reports/search-diagnosis-data'
import type { DiagnosisCheck, SearchDiagnosis } from '@/lib/reports/search-diagnosis'
import { loadMarketSize } from '@/lib/market/market-size-server'
import { growthPhrase, type MarketArea, type MarketPrompt } from '@/lib/market/market-size'
import { getSearchStage, isSearchGoalsComplete, SEARCH_STAGE_LABELS } from '@/lib/search-strategy'
import { computeMatchState } from '@/lib/personalization/match-compute'
import { marketTierFor } from '@/lib/jobs/relevance'
import { loadMemberSkillGapByKind } from '@/lib/jobs/skill-gap-data'
import { getActiveCourses } from '@/lib/learning/courses'
import { courseForAiSkill } from '@/lib/learning/ai-course-tags'
import { aiMarketLine, suggestedAiTools } from '@/lib/skills/ai-skill-market'
import { loadAiMarket } from '@/lib/skills/ai-market-live'
import { loadPivotPaths } from '@/lib/pivots/load'
import { demandLine } from '@/lib/pivots/scoring'
import { analyzeExperience, type ExperienceAnalysis } from './experience'
import { buildEffortPlan, competitivenessFor, INTERVIEWS_PER_OFFER, PLAN_WEEKS, type EffortPlan } from './effort-plan'
import { buildPriorities } from './priorities'
import { computeDossierCompleteness } from '@/lib/scoring/dossier-unlock'
import { buildHiringCase, type HiringReason } from './hiring-case'
import { buildOverallRead } from './narrative'
import { buildSharpen, type SharpenItem } from './sharpen'
import { STALL_TEXT, parseSearchStallPoint, type SearchStallPoint } from '@/lib/onboarding/search-stall'
import { firstStep } from './launchpad'
import { buildCaseForYou, type CaseForYou } from './case'
import { buildProfile, type ProfileGroup } from './profile'
import { buildLaunchpad, type LaunchStep } from './launchpad'
import { effectiveJourney, effectiveStage } from '@/lib/journey/journey'
import { isPivotingProfile } from '@/lib/journey/pivot-target'
import { menuMode } from '@/lib/journey/menu'
import { isGmailConnected } from '@/lib/dashboard/access-gate'
import { buildEvaluatorViews, buildObjections, type EvaluatorView, type FirstGlance, type Objection } from './evaluators'
import type { Assessment, PriorityAction } from './types'

const DAY = 86_400_000

async function safe<T>(label: string, work: Promise<T>): Promise<T | null> {
  try {
    return await work
  } catch (error) {
    console.error(`Market Reality Report: ${label} unavailable`, error)
    return null
  }
}

// ── View models ────────────────────────────────────────────────────────────

export interface BasisRow {
  label: string
  value: string | null
  href: string
}

export interface MarketRow {
  label: string
  openRoles: number
  trend: string | null
  href: string | null
  /** The few that widen the market most, flagged only when the market needs widening. */
  recommended: boolean
}

export interface MarketSection {
  targetLabel: string
  prompt: MarketPrompt
  /** Open roles that fit on level, field, place and skills. */
  openRoles: number
  strongFits: number | null
  /** Open roles in the wider market for the same kind of work. */
  widerOpen: number
  trend: string | null
  readout: string
  /** Nearby areas, each with its count: what the market looks like if one limit is lifted. */
  rows: MarketRow[]
  /** For a market with too many roles: the biggest slices. */
  slices: { label: string; openRoles: number }[]
}

export interface CapacityNote {
  /** The weekly application goal the member set on Search Strategy. */
  goal: number | null
  /** What the balanced route asks of them each week. */
  neededApplications: number
  neededConversations: number
  /** Plain sentences tying the requirement to what they told us. */
  notes: string[]
}

export interface EffortSection {
  capacity: CapacityNote
  plan: EffortPlan
  competitiveness: { label: string; key: string }
  perAttemptPercent: number
  grade: Grade | null
}

export interface SkillRow {
  term: string
  employers: number
  have: boolean
  ai: boolean
  course: { title: string } | null
}

export interface SkillsSection {
  employers: number
  employersAskingAi: number
  marketLine: string | null
  tools: string[]
  ai: SkillRow[]
  other: SkillRow[]
}

export interface ResumeSection {
  fixes: ResumeFixItem[]
  moreFixes: number
  ats: AtsMatrixSection | null
}

export interface PivotOption {
  label: string
  fit: string
  time: string
  demand: string
  pay: string
  why: string
}

export interface PivotSection {
  /** Why a change of direction is on the table at all. */
  reasons: string[]
  functions: PivotOption[]
  industries: MarketRow[]
  places: MarketRow[]
}

export interface SearchSection {
  totals: SearchDiagnosis['totals']
  interviewRate: number | null
  checks: DiagnosisCheck[]
  focus: { label: string; value: string }[]
  rejections: { label: string; value: string }[]
}

/** What the member told us in onboarding about their search so far. Replaced by tracked activity once Gmail is connected. */
export interface SearchSnapshot {
  applied: string | null
  interviews: number | null
  offers: number | null
  stall: { point: SearchStallPoint; told: string; points: string } | null
}

export interface ScorecardRow {
  dimension: string
  assessment: Assessment
  basis: string
  anchor: string
}

export interface MarketRealityBrief {
  asOf: Date
  candidateName: string
  basis: { rows: BasisRow[]; unconfirmed: { label: string; href: string }[]; goalsComplete: boolean }
  summary: {
    grade: Grade | null
    difficulty: string | null
    headline: string | null
    /** A few paragraphs a consultant would open with, composed from the findings below. */
    overallRead: string[]
    scorecard: ScorecardRow[]
    priorities: PriorityAction[]
  }
  market: MarketSection | null
  effort: EffortSection | null
  experience: ExperienceAnalysis
  evaluators: EvaluatorView[]
  snapshot: SearchSnapshot | null
  sharpen: SharpenItem[]
  caseForYou: CaseForYou
  hiringCase: HiringReason[]
  profile: ProfileGroup[]
  objections: Objection[]
  recruiterRead: RecruiterReadItem[]
  skills: SkillsSection | null
  resume: ResumeSection | null
  pivots: PivotSection | null
  search: SearchSection | null
  weekActions: { text: string; isAStandard?: boolean }[]
  launchpad: LaunchStep[]
}

// ── Helpers ────────────────────────────────────────────────────────────────

const pct = (g: number | null): string | null => (g === null ? null : Math.abs(g) < 0.1 ? 'steady' : `${g > 0 ? '+' : '−'}${Math.round(Math.abs(g) * 100)}%`)

function money(n: number | null | undefined): string | null {
  return n ? `$${n.toLocaleString('en-US')}` : null
}

function gradeAssessment(g: Grade | undefined): Assessment {
  if (!g) return 'not_assessed'
  return g === 'A' || g === 'B' ? 'strength' : g === 'C' ? 'adequate' : 'development'
}

function toMarketRow(a: MarketArea, recommended: boolean): MarketRow {
  return { label: a.label, openRoles: a.openNow, trend: pct(a.growth), href: a.href ?? null, recommended }
}

function marketReadout(prompt: MarketPrompt, open: number, trend: string | null): string {
  const count = open.toLocaleString()
  switch (prompt) {
    case 'too_few':
      return `Only ${count} open role${open === 1 ? '' : 's'} fit the current target on level, field, place and skills. At this size the search rests on a handful of postings, so at least one limit should be lifted.`
    case 'shrinking':
      return `${count} open roles fit the current target, but this market is ${trend ?? 'shrinking'}. Position for the nearby areas that are not.`
    case 'too_many':
      return `${count} open roles fit the current target. That is more than anyone can work through well. The task is selection: choose the slices where the history is strongest.`
    default:
      return `${count} open roles fit the current target${trend ? `; the market is ${trend}` : ''}. The market is large enough to work without widening.`
  }
}

const APPLIED_LABEL: Record<string, string> = { '0-20': 'up to 20', '20-100': '20 to 100', '100+': 'over 100' }

function buildSnapshot(profile: CandidateProfile): SearchSnapshot | null {
  if (profile.justStartedSearch) return null
  const stallPoint = parseSearchStallPoint(profile.searchStallPoint)
  const snap: SearchSnapshot = {
    applied: profile.jobsAppliedBucket ? (APPLIED_LABEL[profile.jobsAppliedBucket] ?? null) : null,
    interviews: profile.interviewsReceivedCount,
    offers: profile.offersReceivedCount,
    stall: stallPoint ? { point: stallPoint, ...STALL_TEXT[stallPoint] } : null,
  }
  return snap.applied || snap.interviews !== null || snap.offers !== null || snap.stall ? snap : null
}

// ── Sections ───────────────────────────────────────────────────────────────

async function loadMarket(profile: CandidateProfile): Promise<{ section: MarketSection; prompt: MarketPrompt; widest: MarketRow | null } | null> {
  const state = await computeMatchState(profile, { live: true }).catch(() => null)
  const relevant = state ? { count: state.counts.matches, strong: state.counts.strong, tier: marketTierFor(state.counts.matches).key } : undefined
  const view = await loadMarketSize(profile, relevant)
  if (!view) return null

  const open = view.relevant?.count ?? view.counts.openNow
  const needWiden = view.prompt === 'too_few' || view.prompt === 'shrinking'
  const sorted = [...view.allAreas].filter((a) => a.openNow > 0).sort((a, b) => b.openNow - a.openNow).slice(0, 6)
  const widenTop = new Set(needWiden ? sorted.filter((a) => a.openNow > open).slice(0, 2).map((a) => a.label) : [])
  const rows = sorted.map((a) => toMarketRow(a, widenTop.has(a.label)))
  const trend = growthPhrase(view.growth)

  return {
    section: {
      targetLabel: view.target.label,
      prompt: view.prompt,
      openRoles: open,
      strongFits: view.relevant?.strong ?? null,
      widerOpen: view.counts.openNow,
      trend: pct(view.growth),
      readout: marketReadout(view.prompt, open, trend),
      rows,
      slices: view.slices.map((s) => ({ label: s.label, openRoles: s.openNow })),
    },
    prompt: view.prompt,
    widest: rows.find((r) => r.recommended) ?? rows[0] ?? null,
  }
}

async function loadSkills(candidateId: string, profile: CandidateProfile): Promise<SkillsSection | null> {
  const [data, catalog, live] = await Promise.all([loadMemberSkillGapByKind(candidateId), getActiveCourses(), loadAiMarket()])
  const fn = profile.targetFunction ?? profile.primaryFunction
  const marketLine = aiMarketLine(fn, live)?.text ?? null
  const tools = suggestedAiTools(fn, profile.targetIndustries, live).slice(0, 6)
  if (!data || data.rows.length === 0) {
    return marketLine || tools.length > 0 ? { employers: 0, employersAskingAi: 0, marketLine, tools, ai: [], other: [] } : null
  }
  const rows: SkillRow[] = data.rows.map((r) => ({
    term: r.term,
    employers: r.employers,
    have: r.have,
    ai: r.ai,
    course: r.ai && !r.have ? (() => { const c = courseForAiSkill(r.term, catalog); return c ? { title: c.title } : null })() : null,
  }))
  const byDemand = (a: SkillRow, b: SkillRow) => Number(a.have) - Number(b.have) || b.employers - a.employers
  return {
    employers: data.employersWithSkillData,
    employersAskingAi: data.employersAskingAi,
    marketLine,
    tools,
    ai: rows.filter((r) => r.ai).sort(byDemand),
    other: rows.filter((r) => !r.ai).sort(byDemand).slice(0, 6),
  }
}

async function loadSearchSection(diagnosis: SearchDiagnosis, jobSearchPattern: unknown): Promise<SearchSection | null> {
  if (diagnosis.totals.applications === 0) return null
  const label = (b: { label: string; count: number }[] | null) => (b && b.length > 0 ? b.map((x) => `${x.label} (${x.count})`).join(', ') : null)
  const FOCUS: Record<string, string> = { focused: 'Focused', mixed: 'Mixed', scattered: 'Scattered' }
  const focus: SearchSection['focus'] = []
  const rejections: SearchSection['rejections'] = []
  const p = jobSearchPattern as {
    applicationTrends?: { eligible: boolean; functionFocus: string | null; functionBreakdown: { label: string; count: number }[] | null; industryFocus: string | null; industryBreakdown: { label: string; count: number }[] | null; geographyFocus: string | null; geographyBreakdown: { label: string; count: number }[] | null } | null
    rejectionTrends?: { eligible: boolean; companySizeBreakdown: { label: string; count: number }[] | null; industryBreakdown: { label: string; count: number }[] | null; functionBreakdown: { label: string; count: number }[] | null; levelFitBreakdown: { label: string; count: number }[] | null } | null
  } | null
  const a = p?.applicationTrends
  if (a?.eligible) {
    for (const [name, f, b] of [['Function', a.functionFocus, a.functionBreakdown], ['Industry', a.industryFocus, a.industryBreakdown], ['Geography', a.geographyFocus, a.geographyBreakdown]] as const) {
      if (f) focus.push({ label: name, value: `${FOCUS[f] ?? f}${label(b) ? ` — ${label(b)}` : ''}` })
    }
  }
  const r = p?.rejectionTrends
  if (r?.eligible) {
    for (const [name, b] of [['Company size', r.companySizeBreakdown], ['Industry', r.industryBreakdown], ['Function', r.functionBreakdown], ['Level fit', r.levelFitBreakdown]] as const) {
      const v = label(b)
      if (v) rejections.push({ label: name, value: v })
    }
  }
  const rank: Record<DiagnosisCheck['verdict'], number> = { act: 0, watch: 1, unknown: 2, good: 3 }
  return {
    totals: diagnosis.totals,
    interviewRate: diagnosis.interviewRate,
    checks: [...diagnosis.checks].sort((x, y) => rank[x.verdict] - rank[y.verdict]),
    focus,
    rejections,
  }
}

// ── The brief ──────────────────────────────────────────────────────────────

export async function loadMarketRealityBrief(
  profile: CandidateProfile,
  opts: { resumeRewrites: unknown; jobSearchPattern: unknown; documentStrengths: unknown; suggestedActions: { text: string; isAStandard?: boolean }[] }
): Promise<MarketRealityBrief> {
  const id = profile.id
  const asOf = new Date()
  const d28 = new Date(asOf.getTime() - 28 * DAY)

  const [stand, latestAnalysis, dossierCompleteness, gmailConnected, completedReferences, workHistory, education, resumeFixes, ats, recruiterRead, marketLoaded, skills, diagnosis, applicationsLast28] = await Promise.all([
    safe('where you stand', getWhereYouStand(id)),
    prisma.resumeAnalysis.findFirst({ where: { candidateId: id }, orderBy: { createdAt: 'desc' }, select: { dimensionScores: true, dimensionFindings: true, firstGlanceResult: true, firstGlanceTopFix: true } }),
    safe('dossier', computeDossierCompleteness(id)),
    safe('gmail', isGmailConnected(id)),
    prisma.reference.count({ where: { candidateId: id, status: 'COMPLETED' } }),
    prisma.workHistoryEntry.findMany({ where: { candidateId: id } }),
    prisma.educationEntry.findMany({ where: { candidateId: id }, select: { startDate: true, graduationDate: true } }),
    safe('resume fixes', getResumeFixes(id, opts.resumeRewrites)),
    safe('ats matrix', getAtsMatrix(id)),
    safe('recruiter read', getRecruiterReadItems(id)),
    safe('market size', loadMarket(profile)),
    safe('skills gap', loadSkills(id, profile)),
    safe('search diagnosis', getSearchDiagnosis(id)),
    prisma.jobPosting.count({ where: { candidateId: id, appliedAt: { gte: d28 } } }),
  ])

  const experience = analyzeExperience({
    workHistory: workHistory.map((e) => ({
      companyName: e.companyName,
      roleTitle: e.roleTitle,
      startDate: e.startDate,
      endDate: e.endDate,
      isCurrent: e.isCurrent,
      departureReason: e.departureReason,
      engagementType: e.engagementType,
      teamSize: e.teamSize,
      companyIndustry: e.companyIndustry,
    })),
    education,
    targetRole: profile.targetRoleType,
    highestLevelReached: profile.highestLevelReached,
    asOf,
  })

  // Search requirements: the engine's per-attempt estimate against real pace.
  let effort: EffortSection | null = null
  if (stand?.perAttemptProbability && stand.perAttemptProbability > 0) {
    const plan = buildEffortPlan({
      perAttemptProbability: stand.perAttemptProbability,
      networkingWeight: NETWORKING_WEIGHT,
      applicationsPerWeek: applicationsLast28 / 4,
      conversationsPerWeek: (diagnosis?.outreach.last28 ?? 0) / 4,
    })
    const balanced = plan.routes.find((r) => r.key === 'balanced')!
    const notes: string[] = []
    const goal = profile.applicationVolumeGoal
    if (goal && balanced.applicationsPerWeek > goal) notes.push(`Your Search Strategy goal is ${goal} applications a week. The balanced route needs about ${balanced.applicationsPerWeek}, so either the goal rises or more of the work moves to conversations.`)
    else if (goal) notes.push(`Your Search Strategy goal of ${goal} applications a week covers the balanced route.`)
    if (profile.networkComfortLevel === 'NOT_VERY_COMFORTABLE' || profile.networkComfortLevel === 'RATHER_NOT')
      notes.push(`You said reaching out to people is not your comfort zone. Start with the ${balanced.conversationsPerWeek} conversations a week from former colleagues and warm contacts, where the first ask is lightest.`)
    if (profile.searchIntensity === 'CASUALLY_LOOKING' || profile.searchIntensity === 'EXPLORING')
      notes.push('You are looking casually, so read these volumes as the pace of a full search. A lighter pace stretches the timeline in proportion.')
    effort = {
      capacity: { goal, neededApplications: balanced.applicationsPerWeek, neededConversations: balanced.conversationsPerWeek, notes },
      plan,
      competitiveness: competitivenessFor(plan.applicationsPerInterview),
      perAttemptPercent: Math.round(stand.perAttemptProbability * 1000) / 10,
      grade: stand.grade,
    }
  }

  const market = marketLoaded?.section ?? null
  const grade = stand?.grade ?? null
  const widenNeeded = market?.prompt === 'too_few' || market?.prompt === 'shrinking'
  const lowGrade = grade === 'D' || grade === 'F'

  // Pivots, only when the case for a change of direction exists.
  let pivots: PivotSection | null = null
  const movingFunction = !!profile.targetFunction && !!profile.primaryFunction && profile.targetFunction.toLowerCase() !== profile.primaryFunction.toLowerCase()
  const pivoting = isPivotingProfile({ ...profile, journey: effectiveJourney(profile) })
  const pivotsNeeded = lowGrade || widenNeeded || pivoting || movingFunction
  const pivotResult = pivotsNeeded ? await safe('pivot paths', loadPivotPaths(profile)) : null
  if (pivotsNeeded) {
    const functionNeeded = pivoting || movingFunction || lowGrade || !!pivotResult?.contraction.contracting
    const reasons: string[] = []
    if (widenNeeded && market) reasons.push(`The current target has ${market.openRoles.toLocaleString()} open roles${market.trend ? ` and is trending ${market.trend}` : ''}.`)
    if (lowGrade) reasons.push('The estimated odds per application are low enough that a change of target may return more than more volume.')
    if (pivotResult?.contraction.headline) reasons.push(pivotResult.contraction.headline)
    if (movingFunction) reasons.push(`You told us you want to move from ${profile.primaryFunction} into ${profile.targetFunction}.`)
    else if (pivoting && reasons.length === 0) reasons.push('Your profile says you are changing direction.')
    pivots = {
      reasons,
      functions: functionNeeded
        ? (pivotResult?.suggestions ?? []).slice(0, 3).map((s) => ({
            label: s.label,
            fit: s.fitLabel,
            time: s.timeLabel,
            demand: demandLine(s.demand),
            pay: s.pay.summary,
            why: s.why,
          }))
        : [],
      industries: (market?.rows ?? []).filter((r) => /\bin\b/.test(r.label) || /any industry/i.test(r.label)).slice(0, 3),
      places: (market?.rows ?? []).filter((r) => /anywhere|remote/i.test(r.label)).slice(0, 2),
    }
    if (pivots.functions.length === 0 && pivots.industries.length === 0 && pivots.places.length === 0) pivots = null
  }

  // Profile completeness: what the estimates are reading but nobody confirmed.
  const unconfirmed = [
    { label: 'Profile details', done: profile.profileConfirmedAt !== null },
    { label: 'Industry', done: profile.industryConfirmedAt !== null },
    { label: 'Function, title and years', done: profile.functionConfirmedAt !== null },
    { label: 'Salary and work authorization', done: profile.salaryConfirmedAt !== null && profile.workAuthConfirmedAt !== null },
    { label: 'LinkedIn', done: profile.linkedInConfirmedAt !== null },
  ]
    .filter((x) => !x.done)
    .map((x) => ({ label: x.label, href: '/dashboard/profile' }))

  const where = [profile.currentCity, profile.currentState].filter(Boolean).join(', ')
  const stage = getSearchStage(profile)
  const COMFORT: Record<string, string> = { VERY_COMFORTABLE: 'Very comfortable', SOMEWHAT_COMFORTABLE: 'Somewhat comfortable', NOT_VERY_COMFORTABLE: 'Not very comfortable', RATHER_NOT: 'Would rather not' }
  const STRATEGY = '/dashboard/search-strategy'
  // The same answers Search Strategy and personalization collect, in the same words,
  // so the report reads the member's own brief rather than a parallel one.
  const basisRows: BasisRow[] = [
    { label: 'Target role', value: profile.targetRoleType ?? profile.targetFunction, href: STRATEGY },
    { label: 'Moving into', value: movingFunction ? profile.targetFunction : null, href: STRATEGY },
    { label: 'Level reached', value: profile.highestLevelReached, href: '/dashboard/profile' },
    { label: 'Function', value: profile.primaryFunction, href: '/dashboard/profile' },
    { label: 'Experience', value: profile.yearsExperience ? `${profile.yearsExperience} years` : experience.careerYears ? `${experience.careerYears} years` : null, href: '/dashboard/profile' },
    { label: 'Target industries', value: profile.targetIndustries.length > 0 ? profile.targetIndustries.join(', ') : null, href: STRATEGY },
    { label: 'Company size and stage', value: [profile.targetCompanySize, profile.targetCompanyStage].filter(Boolean).join(' · ') || null, href: STRATEGY },
    { label: 'Location', value: [where, profile.remotePreference, profile.openToRelocation ? 'open to relocating' : null].filter(Boolean).join(' · ') || null, href: STRATEGY },
    { label: 'Pay floor', value: money(profile.targetCompMin), href: STRATEGY },
    { label: 'Would start lower', value: profile.willingToStartLower ? 'Yes' : null, href: STRATEGY },
    { label: 'Deal breakers', value: profile.dealBreakers?.trim() || null, href: STRATEGY },
    { label: 'Search stage', value: stage ? SEARCH_STAGE_LABELS[stage] : null, href: STRATEGY },
    { label: 'Weekly application goal', value: profile.applicationVolumeGoal ? `${profile.applicationVolumeGoal} a week` : null, href: STRATEGY },
    { label: 'Comfort reaching out', value: profile.networkComfortLevel ? COMFORT[profile.networkComfortLevel] : null, href: STRATEGY },
  ]
  // Optional answers are not "missing" when the member has no reason to give them.
  const OPTIONAL = new Set(['Moving into', 'Would start lower', 'Deal breakers', 'Search stage'])
  const goalsComplete = isSearchGoalsComplete(profile)

  // Scorecard: the plain read of each dimension, one row each.
  const aiGaps = skills?.ai.filter((r) => !r.have) ?? []
  const otherGaps = skills?.other.filter((r) => !r.have) ?? []
  const skillsAssessment: Assessment = !skills || skills.employers === 0 ? 'not_assessed' : aiGaps.length === 0 && otherGaps.length === 0 ? 'strength' : otherGaps.length + aiGaps.length >= 3 || (aiGaps.length > 0 && skills.employersAskingAi / skills.employers >= 0.4) ? 'development' : 'adequate'
  const paceAssessment: Assessment = !effort ? 'not_assessed' : !effort.plan.pace.activityObserved ? 'development' : effort.plan.pace.coverage >= 1 ? 'strength' : effort.plan.pace.coverage >= 0.5 ? 'adequate' : 'development'
  const marketAssessment: Assessment = !market ? 'not_assessed' : market.prompt === 'too_few' || market.prompt === 'shrinking' ? 'development' : market.prompt === 'too_many' ? 'adequate' : 'strength'
  // The stored component grades drive the headline grade, so the scorecard reads them; the history checks are the fallback.
  const storedGrade = (label: string) => stand?.decomposition.find((d) => d.label === label)?.grade
  const experienceAssessment: Assessment = storedGrade('Experience')
    ? gradeAssessment(storedGrade('Experience'))
    : experience.assessable
      ? experience.developmentCount >= 2 ? 'development' : experience.developmentCount === 1 ? 'adequate' : 'strength'
      : 'not_assessed'
  const resumeAssessment: Assessment = gradeAssessment(storedGrade('Resume'))

  const scorecard: ScorecardRow[] = [
    {
      dimension: 'Market access',
      assessment: marketAssessment,
      basis: market ? `${market.openRoles.toLocaleString()} open roles fit${market.trend ? `; market ${market.trend} against the board` : ''}.` : 'Set a target function to size the market.',
      anchor: 'market',
    },
    {
      dimension: 'Experience',
      assessment: experienceAssessment,
      basis: experience.assessable ? (experience.developmentCount > 0 ? `${experience.developmentCount} of ${experience.findings.length} history checks need attention.` : 'The history reads cleanly on every check.') : 'Add work history to assess.',
      anchor: 'experience',
    },
    {
      dimension: 'Resume',
      assessment: resumeAssessment,
      basis: resumeFixes ? (resumeFixes.items.length > 0 ? `${resumeFixes.items.length} fix${resumeFixes.items.length === 1 ? '' : 'es'} identified.` : 'No high-impact issues found.') : 'Upload a resume to assess.',
      anchor: 'resume',
    },
    {
      dimension: 'Skills',
      assessment: skillsAssessment,
      basis: skills && skills.employers > 0 ? `${aiGaps.length} AI and ${otherGaps.length} other skills asked for by target employers are not on the profile.` : 'Not enough matching jobs yet to read the gap.',
      anchor: 'skills',
    },
    {
      dimension: 'Search activity',
      assessment: paceAssessment,
      basis: effort
        ? effort.plan.pace.activityObserved
          ? `About ${effort.plan.pace.expectedInterviews} interviews expected in ${PLAN_WEEKS} weeks at the current pace; ${INTERVIEWS_PER_OFFER} typically produce an offer.`
          : 'No applications or networking in the last four weeks.'
        : 'Needs a resume and a target to estimate.',
      anchor: 'requirements',
    },
  ]

  // How the screeners would read it, and what they would ask.
  const dims = (latestAnalysis?.dimensionScores ?? null) as Partial<Record<string, number>> | null
  const evaluatorInput = {
    targetRole: profile.targetRoleType,
    experience,
    firstGlance: (latestAnalysis?.firstGlanceResult ?? null) as FirstGlance | null,
    firstGlanceTopFix: latestAnalysis?.firstGlanceTopFix ?? null,
    dims,
    ai: skills && skills.employers > 0 ? { employersAsking: skills.employersAskingAi, of: skills.employers, haveAny: skills.ai.some((r) => r.have) } : null,
    conversationsPerWeek: effort ? effort.plan.pace.conversationsPerWeek : null,
    marketPrompt: market?.prompt ?? null,
    payFloor: profile.targetCompMin,
    searchStallPoint: parseSearchStallPoint(profile.searchStallPoint),
  }

  const priorities = buildPriorities({
    resume: resumeFixes && resumeFixes.items.length > 0 ? { topFix: { dimension: resumeFixes.items[0].dimension, fix: resumeFixes.items[0].fix, gain: resumeFixes.items[0].pointValue }, fixCount: resumeFixes.items.length } : null,
    experience: experience.assessable ? { openQuestions: experience.openQuestions } : null,
    unansweredReviewerQuestions: recruiterRead?.length ?? 0,
    effort: effort
      ? {
          coverage: effort.plan.pace.coverage,
          activityObserved: effort.plan.pace.activityObserved,
          conversationsPerWeek: effort.plan.pace.conversationsPerWeek,
          balancedConversationsPerWeek: effort.plan.routes.find((r) => r.key === 'balanced')!.conversationsPerWeek,
          balancedApplicationsPerWeek: effort.plan.routes.find((r) => r.key === 'balanced')!.applicationsPerWeek,
        }
      : null,
    market: market ? { prompt: market.prompt, openRoles: market.openRoles, widest: marketLoaded?.widest ? { label: marketLoaded.widest.label, openRoles: marketLoaded.widest.openRoles } : null } : null,
    skills: aiGaps[0] && skills ? { topAiGap: { term: aiGaps[0].term, employers: aiGaps[0].employers, of: skills.employers } } : null,
    unconfirmedProfileItems: unconfirmed.length,
    searchStrategyIncomplete: !goalsComplete,
    pivotsRecommended: !!pivots && (pivots.functions.length > 0 || lowGrade),
  })

  const brief: MarketRealityBrief = {
    asOf,
    candidateName: [profile.firstName, profile.lastName].filter(Boolean).join(' ') || 'Candidate',
    basis: { rows: basisRows.filter((r) => r.value || !OPTIONAL.has(r.label)), unconfirmed, goalsComplete },
    summary: {
      grade,
      difficulty: grade ? DIFFICULTY_LABEL[grade] : null,
      headline: stand ? `${stand.headline.strongestLine} ${stand.headline.constraintLine}` : null,
      overallRead: [],
      scorecard,
      priorities,
    },
    market,
    effort,
    experience,
    evaluators: buildEvaluatorViews(evaluatorInput),
    snapshot: buildSnapshot(profile),
    sharpen: buildSharpen({
      hasResume: latestAnalysis !== null,
      strategyComplete: goalsComplete,
      payFloor: profile.targetCompMin,
      hasApplied: (!profile.justStartedSearch && profile.jobsAppliedBucket !== null) || applicationsLast28 > 0 || (diagnosis?.totals.applications ?? 0) > 0,
      searchStallPoint: profile.searchStallPoint,
      linkedInConfirmed: profile.linkedInConfirmedAt !== null,
      skillsAssessmentDone: profile.skillsAssessmentCompletedAt !== null,
      roles: experience.roleCount,
      completedReferences,
      gmailConnected: !!gmailConnected,
    }),
    hiringCase: buildHiringCase({
      experience,
      dims,
      hasResume: latestAnalysis !== null,
      targetRole: profile.targetRoleType,
      ai: evaluatorInput.ai,
      completedReferences,
      skillsAssessmentDone: profile.skillsAssessmentCompletedAt !== null,
      linkedInConfirmed: profile.linkedInConfirmedAt !== null,
      dossier: dossierCompleteness ? { met: dossierCompleteness.metCount, total: dossierCompleteness.totalCount } : null,
      conversationsPerWeek: evaluatorInput.conversationsPerWeek,
      payFloor: profile.targetCompMin,
    }),
    caseForYou: buildCaseForYou({
      experience,
      dims,
      ai: evaluatorInput.ai,
      conversationsPerWeek: evaluatorInput.conversationsPerWeek,
      documentStrengths: (Array.isArray(opts.documentStrengths) ? opts.documentStrengths : []).filter(
        (x): x is { title: string; detail: string } => !!x && typeof (x as { title?: unknown }).title === 'string' && typeof (x as { detail?: unknown }).detail === 'string'
      ),
      targetRole: profile.targetRoleType,
      function: profile.primaryFunction,
      yearsExperience: profile.yearsExperience,
    }),
    profile: buildProfile(dims, (latestAnalysis?.dimensionFindings ?? null) as Parameters<typeof buildProfile>[1]),
    objections: buildObjections(evaluatorInput),
    recruiterRead: recruiterRead ?? [],
    skills,
    resume: resumeFixes
      ? { fixes: resumeFixes.items.slice(0, 6), moreFixes: Math.max(0, resumeFixes.items.length - 6), ats }
      : null,
    pivots,
    search: diagnosis ? await loadSearchSection(diagnosis, opts.jobSearchPattern) : null,
    weekActions: opts.suggestedActions.slice(0, 6),
    launchpad: buildLaunchpad({
      mode: menuMode(effectiveStage(profile), effectiveJourney(profile)),
      strategyComplete: goalsComplete,
      unconfirmedProfileItems: unconfirmed.length,
      hasResume: latestAnalysis !== null,
      resumeFixCount: resumeFixes?.items.length ?? 0,
      unansweredReviewerQuestions: recruiterRead?.length ?? 0,
      skillsAssessmentDone: profile.skillsAssessmentCompletedAt !== null,
      gmailConnected: !!gmailConnected,
      completedReferences,
      weekly: effort ? { applications: effort.capacity.neededApplications, conversations: effort.capacity.neededConversations } : null,
      activityObserved: effort?.plan.pace.activityObserved ?? false,
      topAiGap: aiGaps[0]?.term ?? null,
      market: market ? { prompt: market.prompt, widest: marketLoaded?.widest?.label ?? null } : null,
      pivotsShown: pivots !== null,
    }),
  }

  const overallRead = buildOverallRead({
    experience: brief.experience,
    strengths: brief.caseForYou.items,
    hiringCase: brief.hiringCase,
    market: market ? { prompt: market.prompt, openRoles: market.openRoles, trend: market.trend } : null,
    effort: effort ? { applicationsPerInterview: effort.plan.applicationsPerInterview, conversationsPerInterview: effort.plan.conversationsPerInterview, competitiveness: effort.competitiveness.label } : null,
    topPriority: brief.summary.priorities[0] ?? null,
    firstStep: firstStep(brief.launchpad),
    targetRole: profile.targetRoleType,
    stall: evaluatorInput.searchStallPoint ? STALL_TEXT[evaluatorInput.searchStallPoint] : null,
  })
  return { ...brief, summary: { ...brief.summary, overallRead } }
}

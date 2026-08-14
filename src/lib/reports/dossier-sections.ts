import 'server-only'
import { cache } from 'react'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getAnthropicClient } from '@/lib/anthropic'
import {
  computeCategoryGrades,
  GRADE_RELATIONS_INCLUDE,
  type CandidateWithGradeRelations,
} from '@/lib/scoring/dossier-competencies'
import { computeNamedReasons, type NamedReason } from '@/lib/scoring/named-reasons'
import type { CategoryGrade, CategoryKey } from '@/lib/scoring/grade'
import { translateDimensionVectors, type DimensionVectors } from '@/lib/scoring/assessment-vectors'
import { translateWorkStyleVectors } from '@/lib/scoring/work-style-vectors'
import { getCandidateLevelRank } from '@/lib/scoring/level-rank-service'
import {
  TOP_STRENGTH_OPTIONS,
  GROWTH_AREA_OPTIONS,
  LOCATION_PREFERENCE_OPTIONS,
  COMPANY_STAGE_OPTIONS,
} from '@/lib/constants/onboarding'
import { computeReferenceAlignment, computeGrowthAreaReferenceContext } from '@/lib/references/testimony-processing'
import { countOverDeliveringWeeks } from '@/lib/badges/milestone-badges'
import { countAGradeWeeks } from '@/lib/scoring/market-reality-history'
import { communityTierNarrative, computeCandidatePeerSupportCount } from '@/lib/reports/community-tier'
import { buildReferenceVerification, type ReferenceVerification } from '@/lib/reports/reference-verification'
import { generateJobPattern, MIN_SIGNALS_FOR_PATTERN } from '@/lib/network/job-discovery'
import { isInternshipRole } from '@/lib/resume/work-history-facts'

// The Executive Dossier's dynamic sections (Prompt 47) — everything beyond
// the existing Effort Summary / References / AI Projects / Learning /
// Availability sections already rendered by recruiter-report.ts. Built as
// its own module so the CORE MECHANIC (named-reasons-driven reweighting +
// closed-loop callout) has one clear home, and so each section can be
// sourced from real, existing data rather than invented.
//
// WHAT NEVER APPEARS HERE, under any circumstance: financial pressure/
// Benefits data, raw score numbers, mood/check-in data, coaching session
// notes, raw Support Network message content, raw calendar event details,
// Motivations (CandidateProfile.motivations/motivationsElaboration), and raw
// Blockers (blockers/blockersOpenText/consistencySelfRating). See
// prisma/schema.prisma's CoachSession/DailyCheckIn/EncouragementNote models
// and the Personal Context comment block — none of those fields are read in
// this file. The real enforcement mechanism: every section function below
// takes a narrow, explicitly-named parameter shape (never the full
// `candidate` object read at the bottom of this file) — a field can only
// reach DossierData by being named at a function signature in this file, so
// that signature list IS the reviewable boundary. The one broad fetch this
// file does perform (`candidate` in getDossierSections, via
// GRADE_RELATIONS_INCLUDE) exists for scoring purposes — computeCategoryGrades/
// computeNamedReasons need broad self-report inputs — and is never
// destructured directly into a section or into the returned DossierData.

export interface DossierSection {
  id: DossierSectionId
  title: string
}

export type DossierSectionId =
  | 'positioning'
  | 'howIOperate'
  | 'aiFluency'
  | 'impactOnPeople'
  | 'selfAwareness'
  | 'learningGrowth'
  | 'fit'
  | 'proofPoints'

const SECTION_TITLES: Record<DossierSectionId, string> = {
  positioning: 'Positioning Statement',
  howIOperate: 'How I Operate',
  aiFluency: 'AI Fluency',
  impactOnPeople: 'Impact on People',
  selfAwareness: 'Self-Awareness',
  learningGrowth: 'Learning & Growth Trajectory',
  fit: 'Fit — Where I Do My Best Work',
  proofPoints: 'Proof-Point Narratives',
}

// Base order "before dynamic reweighting is applied on top" (per spec),
// and which named-reason gap each section is best positioned to address —
// used both for reordering and for the closed-loop callout. Sections not
// listed here (selfAwareness, learningGrowth, proofPoints) have no direct
// gap mapping and stay in their base relative position. "What Drives Me"
// was removed entirely (not repurposed) — its one genuinely valuable piece,
// the verified sustained-effort stat, now lives inside howIOperate, next to
// Superpowers.
const SECTION_ORDER: DossierSectionId[] = [
  'positioning',
  'howIOperate',
  'aiFluency',
  'impactOnPeople',
  'selfAwareness',
  'learningGrowth',
  'fit',
  'proofPoints',
]

const SECTION_ADDRESSES_GAP: Partial<Record<DossierSectionId, string>> = {
  positioning: 'presentation_gap',
  howIOperate: 'experienceMatch_gap',
  aiFluency: 'ai_fluency_gap',
  impactOnPeople: 'socialProof_gap',
  fit: 'targetComplexity_gap',
}

export interface ClosedLoopCallout {
  namedReasonText: string
  sectionTitle: string
}

export interface DossierSuperpower {
  label: string
  referenceConfirmed: boolean
  confirmedByCount: number
  totalReferences: number
}

export interface DossierProofPoint {
  question: string
  response: string
  followUps: string[]
}

export interface DossierCareerStep {
  companyName: string
  roleTitle: string
  startDate: Date
}

// What they're targeting, not how they'd negotiate — see the fit field
// comment on DossierData for the full exclusion list.
export interface DossierTargetPreferences {
  targetRoleType: string | null
  targetIndustries: string[]
  companySizeLabel: string | null
  companyStageLabel: string | null
  locationPreferenceLabel: string | null
}

export interface DossierCategoryStrength {
  category: CategoryKey
  label: string
  text: string
  // Independently corroborated (a completed reference backs this category),
  // not just self-report — see grade.ts's confidence machinery. Shown as a
  // small "confirmed" marker rather than gating the strength in/out, since
  // most of what candidates report can't be independently checked at all.
  confirmed: boolean
}

export interface DossierData {
  namedReasons: NamedReason[]
  sections: DossierSection[] // dynamically reweighted, ready to render in order
  closedLoopCallouts: ClosedLoopCallout[]
  // Category strengths only, no grade — the Dossier is read by a hiring
  // manager, not the candidate, so it stays evidence-first rather than
  // showing a letter grade. Self-awareness only ever appears here in the
  // flattering direction (a match reads as a strength); a mismatch stays
  // private to Coaching Notes.
  categoryStrengths: DossierCategoryStrength[]
  // Real, countable backing for every "Confirmed" marker above — see
  // reference-verification.ts. Candidate-wide, not per-strength: there's no
  // per-strength reference attribution data to draw on honestly.
  verification: ReferenceVerification
  positioning: { draftText: string | null; approvedText: string | null }
  // gritStatText is the one thing the deleted "What Drives Me" section got
  // right — verified, hard-to-fake sustained effort — moved here to sit
  // right next to Superpowers, framed explicitly as evidence of persistence.
  howIOperate: { dimensionSummaries: string[]; superpowers: DossierSuperpower[]; gritStatText: string | null }
  aiFluencyExample: string | null
  impactOnPeople: {
    quotes: { theme: string; quoteText: string; refereeName: string }[]
    communityNarrative: string | null
  }
  // Same draft/approve shape as positioning above — a raw self-report growth
  // area never reaches approvedText directly; Victoria drafts a
  // professionally-positioned version first, and the candidate must
  // explicitly approve it (see approveSelfAwareness) before it's
  // Dossier-eligible.
  selfAwareness: { draftText: string | null; approvedText: string | null }
  learningGrowth: { items: { title: string; closedGapArea: string | null }[] }
  // targetPreferences is deliberately narrow — what they're targeting, not
  // how they'd negotiate. compFlexible, equityImportant, willingToStartLower
  // (+rationale), targetCompMin, dealBreakers, applicationVolumeGoal,
  // skillsToBuild, interimConsultingInterest, and the 5 tradeoff-priority
  // rankings never appear here — those are negotiating-sensitive and stay in
  // Coaching Notes only. See buildDossierTargetPreferences.
  fit: { patternSummary: string | null; targetPreferences: DossierTargetPreferences }
  proofPoints: DossierProofPoint[]
  // Only ever populated when careerTrajectory === 'PROMOTED' — mirrors the
  // rest of this document's evidence-first-positives-only convention (a
  // DEMOTED read never renders here, same as every other named-reason gap).
  careerTrajectory: DossierCareerStep[] | null
}

// Reuses the strength copy already computed for namedReasons (kind ===
// 'strength' entries exist exactly for categories graded B or better) —
// no separate copy to maintain. "Confirmed" mirrors the category's own
// confidence read (HIGH means at least one completed reference backs it).
function categoryStrengths(categories: CategoryGrade[], namedReasons: NamedReason[]): DossierCategoryStrength[] {
  const strengthTextByCategory = new Map(
    namedReasons.filter((r) => r.kind === 'strength').map((r) => [r.category, r.text])
  )
  return categories
    .filter((c) => strengthTextByCategory.has(c.key))
    .map((c) => ({
      category: c.key,
      label: c.label,
      text: strengthTextByCategory.get(c.key)!,
      confirmed: c.confidence === 'HIGH',
    }))
}

function reweightedSections(namedReasons: NamedReason[]): DossierSection[] {
  const gapIds = new Set(namedReasons.filter((r) => r.kind === 'gap').map((r) => r.id))
  const addressed: DossierSectionId[] = []
  const rest: DossierSectionId[] = []
  for (const id of SECTION_ORDER) {
    const mappedGap = SECTION_ADDRESSES_GAP[id]
    if (mappedGap && gapIds.has(mappedGap)) addressed.push(id)
    else rest.push(id)
  }
  return [...addressed, ...rest].map((id) => ({ id, title: SECTION_TITLES[id] }))
}

async function getCareerTrajectorySteps(candidateId: string, careerTrajectory: string | null): Promise<DossierCareerStep[] | null> {
  if (careerTrajectory !== 'PROMOTED') return null

  const workHistory = await prisma.workHistoryEntry.findMany({
    where: { candidateId },
    orderBy: { startDate: 'asc' },
  })
  const steps = workHistory
    .filter((entry) => !isInternshipRole(entry))
    .map((entry) => ({ companyName: entry.companyName, roleTitle: entry.roleTitle, startDate: entry.startDate }))

  return steps.length > 0 ? steps : null
}

// What they're targeting, surfaced for a recruiter's benefit — deliberately
// excludes anything negotiating-sensitive (comp flexibility, willingness to
// start lower, deal breakers, priority rankings). Those stay in Coaching
// Notes only; see the DossierData.fit comment.
function buildDossierTargetPreferences(candidate: {
  targetRoleType: string | null
  isPivoting: boolean
  targetIndustries: string[]
  targetCompanySize: string | null
  targetCompanyStage: string | null
  remotePreference: string | null
}): DossierTargetPreferences {
  return {
    targetRoleType: candidate.targetRoleType && candidate.targetRoleType !== 'Flexible' ? candidate.targetRoleType : null,
    targetIndustries: candidate.isPivoting ? candidate.targetIndustries : [],
    companySizeLabel:
      candidate.targetCompanySize && candidate.targetCompanySize !== 'Any' ? candidate.targetCompanySize : null,
    companyStageLabel:
      candidate.targetCompanyStage && candidate.targetCompanyStage !== 'any'
        ? (COMPANY_STAGE_OPTIONS.find((o) => o.value === candidate.targetCompanyStage)?.label ?? null)
        : null,
    locationPreferenceLabel: candidate.remotePreference
      ? (LOCATION_PREFERENCE_OPTIONS.find((o) => o.value === candidate.remotePreference)?.label ?? null)
      : null,
  }
}

function closedLoopCallouts(namedReasons: NamedReason[]): ClosedLoopCallout[] {
  const gapById = new Map(namedReasons.filter((r) => r.kind === 'gap').map((r) => [r.id, r]))
  const callouts: ClosedLoopCallout[] = []
  for (const [sectionId, gapId] of Object.entries(SECTION_ADDRESSES_GAP)) {
    const reason = gapById.get(gapId)
    if (reason) callouts.push({ namedReasonText: reason.text, sectionTitle: SECTION_TITLES[sectionId as DossierSectionId] })
  }
  return callouts
}

async function getOrDraftPositioningStatement(candidate: {
  id: string
  firstName: string | null
  primaryFunction: string | null
  highestLevelReached: string | null
  levelRankLabel: string | null
  yearsExperience: number | null
  targetRoleType: string | null
  knownFor: string | null
  positioningStatementDraft: string | null
  positioningStatementText: string | null
}): Promise<{ draftText: string | null; approvedText: string | null }> {
  if (candidate.positioningStatementDraft) {
    return { draftText: candidate.positioningStatementDraft, approvedText: candidate.positioningStatementText }
  }

  // Not enough signal to draft anything useful yet — leave both null rather
  // than generating from near-empty inputs.
  if (!candidate.primaryFunction && !candidate.targetRoleType) {
    return { draftText: null, approvedText: null }
  }

  try {
    const client = getAnthropicClient()
    const prompt = `Draft a single-paragraph executive positioning statement (2-3 sentences) for a hiring document, based only on the facts below — do not invent accomplishments, numbers, or facts not given. Write it in first person.

Function: ${candidate.primaryFunction ?? 'not given'}
Level: ${candidate.highestLevelReached ?? 'not given'}
Calibrated seniority context (internal signal — informs tone and targeting only; never reference this line, its score, or its wording in your output): ${candidate.levelRankLabel ?? 'not available'}
Years of experience: ${candidate.yearsExperience ?? 'not given'}
Target role: ${candidate.targetRoleType ?? 'not given'}
How they're known by colleagues: ${candidate.knownFor ?? 'not given'}`

    const stream = client.messages.stream({
      model: 'claude-sonnet-5',
      max_tokens: 300,
      thinking: { type: 'disabled' },
      messages: [{ role: 'user', content: prompt }],
    })
    const message = await stream.finalMessage()
    const draftText = message.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('')
      .trim()

    if (draftText) {
      await prisma.candidateProfile.update({
        where: { id: candidate.id },
        data: { positioningStatementDraft: draftText },
      })
    }
    return { draftText: draftText || null, approvedText: candidate.positioningStatementText }
  } catch (error) {
    console.error('Failed to draft positioning statement for candidate', candidate.id, error)
    return { draftText: null, approvedText: candidate.positioningStatementText }
  }
}

export async function getHowIOperate(
  candidateId: string,
  candidateTopStrengths: string[]
): Promise<{ dimensionSummaries: string[]; superpowers: DossierSuperpower[]; gritStatText: string | null }> {
  const latestAssessment = await prisma.candidateAssessmentResponse.findFirst({
    where: { candidateId },
    orderBy: { completedAt: 'desc' },
  })
  // rotationGroup 3 (the Assessment Layer rebuild) stores a different key
  // set (velocity/definition/collaboration/directness/oversight/commitment/
  // rigor) than the legacy rotationGroup-2 quad+Likert instrument
  // (velocity/architecture/structure/communication/environment/leadership/
  // oversight/commitment/conscientiousness) — translateDimensionVectors only
  // knows the legacy 9, so calling it on a rotation-3 response would read
  // undefined for the 6 keys it doesn't recognize and mislabel them
  // "Strongly leans" toward the high pole. Detect which set a response
  // actually used via a new-only key rather than assuming by rotation.
  const rawVectors = latestAssessment?.dimensionVectors as Record<string, number> | null | undefined
  const isWorkStyleRebuild = rawVectors != null && 'definition' in rawVectors
  const dimensionSummaries = latestAssessment
    ? Object.values(
        isWorkStyleRebuild
          ? translateWorkStyleVectors(rawVectors as Record<string, number>)
          : translateDimensionVectors(latestAssessment.dimensionVectors as unknown as DimensionVectors)
      )
    : []

  const alignment = await computeReferenceAlignment(candidateId)
  const alignmentByStrength = new Map(alignment.map((a) => [a.strength, a]))
  const strengthLabelByValue = new Map<string, string>(TOP_STRENGTH_OPTIONS.map((o) => [o.value, o.label]))

  const superpowers: DossierSuperpower[] = candidateTopStrengths.slice(0, 3).map((strength) => {
    const match = alignmentByStrength.get(strength)
    return {
      label: strengthLabelByValue.get(strength) ?? strength,
      referenceConfirmed: Boolean(match),
      confirmedByCount: match?.confirmedByCount ?? 0,
      totalReferences: match?.totalReferences ?? 0,
    }
  })

  // Verified, hard-to-fake sustained effort — moved here from the deleted
  // "What Drives Me" section, positioned right next to Superpowers. Grade
  // count comes from MarketRealitySnapshot (one row per closed-out week);
  // over-delivering count comes from the same full-history per-week
  // computation the OVER_DELIVERING_STREAK milestone badge already builds.
  const [aGradeWeeks, overDeliveringWeeks] = await Promise.all([
    countAGradeWeeks(candidateId),
    countOverDeliveringWeeks(candidateId),
  ])
  const gritStatText =
    aGradeWeeks.totalWeeks > 0
      ? `${aGradeWeeks.aWeeks} of ${aGradeWeeks.totalWeeks} weeks at an A${overDeliveringWeeks > 0 ? `, ${overDeliveringWeeks} week${overDeliveringWeeks === 1 ? '' : 's'} Over-Delivering` : ''}. This level of sustained, self-directed effort — without external accountability — is itself a signal of persistence.`
      : null

  return { dimensionSummaries, superpowers, gritStatText }
}

async function getGapAreasAndLearningItems(candidateId: string) {
  const [learningItems, latestReport] = await Promise.all([
    prisma.learningBadge.findMany({
      where: { candidateId, badgeType: { not: 'ai_project' } },
      orderBy: { completedAt: 'desc' },
      take: 10,
    }),
    prisma.marketRealityReport.findFirst({
      where: { candidateId },
      orderBy: { generatedAt: 'desc' },
      select: { gapAnalysis: true },
    }),
  ])
  const gapAreas = ((latestReport?.gapAnalysis as unknown as { gaps: { area: string }[] } | undefined)?.gaps ?? []).map(
    (g) => g.area
  )
  return { learningItems, gapAreas }
}

function matchClosedGapArea(itemTitle: string, gapAreas: string[]): string | null {
  const normalizedTitle = itemTitle.toLowerCase()
  return gapAreas.find((area) => normalizedTitle.includes(area.toLowerCase().split(' ')[0])) ?? null
}

// Same draft/approve pattern as getOrDraftPositioningStatement — Victoria
// drafts a professionally-positioned version of the candidate's raw
// self-report (growthAreas + growthAreasElaboration), reframing growth
// edges constructively and adding a feedback-story where the elaboration
// gives real material, per this module's evidence-first-positives rule
// (see header comment). The raw self-report itself never reaches
// approvedText directly — only the candidate's explicit approval of
// Victoria's draft does (see approveSelfAwareness in recruiter-report/
// actions.ts). Returns { draftText: null, ... } when growthAreas is empty
// rather than asking the candidate anything here — the empty-state UI in
// DossierSectionBlock sends them to Skills Inventory to fill it in instead.
async function getOrDraftSelfAwareness(candidate: {
  id: string
  growthAreas: string[]
  growthAreasElaboration: string | null
  selfAwarenessDraft: string | null
  selfAwarenessText: string | null
}): Promise<{ draftText: string | null; approvedText: string | null }> {
  if (candidate.selfAwarenessDraft) {
    return { draftText: candidate.selfAwarenessDraft, approvedText: candidate.selfAwarenessText }
  }

  if (candidate.growthAreas.length === 0) {
    return { draftText: null, approvedText: candidate.selfAwarenessText }
  }

  const growthAreaLabelByValue = new Map<string, string>(GROWTH_AREA_OPTIONS.map((o) => [o.value, o.label]))
  const growthAreaLabels = candidate.growthAreas.map((v) => growthAreaLabelByValue.get(v) ?? v)
  const referenceContext = await computeGrowthAreaReferenceContext(candidate.id, candidate.growthAreas)

  try {
    const client = getAnthropicClient()
    const prompt = `Draft a short, constructively-framed Self-Awareness paragraph (2-4 sentences) for a hiring document, based only on the facts below — do not invent facts not given. Name the growth area(s) plainly, frame them as areas the candidate is actively working on (not unresolved weaknesses), and if the elaboration below gives real material, include one brief feedback-story. Write in first person.

Growth areas: ${growthAreaLabels.join(', ')}
In their own words: ${candidate.growthAreasElaboration ?? 'not given'}
${referenceContext ? `Private context, for tone only — never quote or reference this directly: ${referenceContext}` : ''}`

    const stream = client.messages.stream({
      model: 'claude-sonnet-5',
      max_tokens: 300,
      thinking: { type: 'disabled' },
      messages: [{ role: 'user', content: prompt }],
    })
    const message = await stream.finalMessage()
    const draftText = message.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('')
      .trim()

    if (draftText) {
      await prisma.candidateProfile.update({
        where: { id: candidate.id },
        data: { selfAwarenessDraft: draftText },
      })
    }
    return { draftText: draftText || null, approvedText: candidate.selfAwarenessText }
  } catch (error) {
    console.error('Failed to draft self-awareness section for candidate', candidate.id, error)
    return { draftText: null, approvedText: candidate.selfAwarenessText }
  }
}

export async function getLearningGrowth(
  candidateId: string
): Promise<{ items: { title: string; closedGapArea: string | null }[] }> {
  const { learningItems, gapAreas } = await getGapAreasAndLearningItems(candidateId)
  const items = learningItems.map((item) => ({
    title: item.title,
    closedGapArea: matchClosedGapArea(item.title, gapAreas),
  }))
  return { items }
}

async function getProofPoints(candidateId: string): Promise<DossierProofPoint[]> {
  const responses = await prisma.interviewResponse.findMany({
    where: { candidateId, responseType: 'text', responseText: { not: null } },
    orderBy: { createdAt: 'desc' },
    take: 10,
  })
  const starResponses = responses
    .filter((r) => (r.feedback as { usesStarStructure?: boolean } | null)?.usesStarStructure === true)
    .slice(0, 3)
  if (starResponses.length === 0) return []

  try {
    const client = getAnthropicClient()
    const prompt = `For each of these interview practice answers (already well-structured as Situation/Task/Action/Result), write exactly 2 short follow-up questions that would deepen it for a hiring document: one asking "what was the judgment call," one asking "what would you do differently." Do not answer the questions, just write them.

Respond with ONLY a JSON array, same length and order as the input, no other text: [{"followUps": ["...", "..."]}]

${starResponses.map((r, i) => `Answer ${i + 1} (for: "${r.questionText}"):\n${r.responseText}`).join('\n\n')}`

    const stream = client.messages.stream({
      model: 'claude-sonnet-5',
      max_tokens: 500,
      thinking: { type: 'disabled' },
      messages: [{ role: 'user', content: prompt }],
    })
    const message = await stream.finalMessage()
    const text = message.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('')
      .trim()
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    const followUpSets: { followUps: string[] }[] = jsonMatch ? JSON.parse(jsonMatch[0]) : []

    return starResponses.map((r, i) => ({
      question: r.questionText,
      response: r.responseText as string,
      followUps: followUpSets[i]?.followUps ?? [],
    }))
  } catch (error) {
    console.error('Failed to generate proof-point follow-ups for candidate', candidateId, error)
    return starResponses.map((r) => ({ question: r.questionText, response: r.responseText as string, followUps: [] }))
  }
}

interface DossierGeneratedCache {
  proofPoints: DossierProofPoint[]
  patternSummary: string | null
}

// Read-through cache for the Dossier's two per-view LLM generations. These
// are the only two that don't self-cache (getOrDraftPositioningStatement
// already writes its draft back on first run), so without this every page
// view of the Dossier cost two Sonnet calls and the latency to match.
// Deliberately never auto-invalidates: a candidate refreshes explicitly via
// regenerateDossierSections, which keeps cost tied to intent.
async function getCachedGenerations(
  candidateId: string,
  cached: unknown
): Promise<{ proofPoints: DossierProofPoint[]; patternSummary: string | null }> {
  const parsed = cached as DossierGeneratedCache | null
  if (parsed && Array.isArray(parsed.proofPoints)) {
    return { proofPoints: parsed.proofPoints, patternSummary: parsed.patternSummary ?? null }
  }

  const [pattern, proofPoints] = await Promise.all([
    generateJobPattern(candidateId),
    getProofPoints(candidateId),
  ])
  const patternSummary = pattern.summary

  // Cache-write failure must never take the page down — the generated
  // content is already in hand, it just costs again next view.
  try {
    await prisma.candidateProfile.update({
      where: { id: candidateId },
      data: {
        dossierGeneratedCache: { proofPoints, patternSummary } as unknown as Prisma.InputJsonValue,
        dossierGeneratedAt: new Date(),
      },
    })
  } catch (error) {
    console.error('Failed to cache Dossier generations for candidate', candidateId, error)
  }

  return { patternSummary, proofPoints }
}

// Wrapped in React's cache() so multiple call sites within the same render
// (e.g. a completeness summary and the full dossier view on the same page)
// share one execution instead of re-running this LLM chain twice.
export const getDossierSections = cache(async function getDossierSections(candidateId: string): Promise<DossierData> {
  const candidate = await prisma.candidateProfile.findUniqueOrThrow({
    where: { id: candidateId },
    include: GRADE_RELATIONS_INCLUDE,
  })

  const [latestAiProject, levelRank] = await Promise.all([
    prisma.learningBadge.findFirst({
      where: { candidateId, badgeType: 'ai_project', judgmentCall: { not: null } },
      orderBy: { completedAt: 'desc' },
    }),
    getCandidateLevelRank(candidateId),
  ])

  const categories = await computeCategoryGrades(candidate as unknown as CandidateWithGradeRelations)
  const namedReasons = computeNamedReasons(categories, latestAiProject?.judgmentCall ?? null, {
    jobHoppingFlag: candidate.jobHoppingFlag,
    careerTrajectory: candidate.careerTrajectory,
    gapDuration: candidate.gapDuration,
  })

  const [positioning, howIOperate, impactQuotes, peerSupportCount, selfAwareness, learningGrowth, generated, careerTrajectorySteps] =
    await Promise.all([
      getOrDraftPositioningStatement({ ...candidate, levelRankLabel: levelRank.label }),
      getHowIOperate(candidateId, candidate.topStrengths),
      prisma.referenceQuote.findMany({
        where: { candidateId, approvedByCandidateAt: { not: null } },
        include: { reference: { select: { refereeName: true } } },
        orderBy: { approvedByCandidateAt: 'desc' },
      }),
      computeCandidatePeerSupportCount(candidateId),
      getOrDraftSelfAwareness(candidate),
      getLearningGrowth(candidateId),
      getCachedGenerations(candidateId, candidate.dossierGeneratedCache),
      getCareerTrajectorySteps(candidateId, candidate.careerTrajectory),
    ])
  const { patternSummary, proofPoints } = generated

  return {
    namedReasons,
    sections: reweightedSections(namedReasons),
    closedLoopCallouts: closedLoopCallouts(namedReasons),
    categoryStrengths: categoryStrengths(categories, namedReasons),
    verification: buildReferenceVerification(candidate.references),
    positioning,
    howIOperate,
    aiFluencyExample: latestAiProject?.judgmentCall ?? null,
    impactOnPeople: {
      quotes: impactQuotes.map((q) => ({ theme: q.theme, quoteText: q.quoteText, refereeName: q.reference.refereeName })),
      communityNarrative: communityTierNarrative(peerSupportCount),
    },
    selfAwareness,
    learningGrowth,
    fit: { patternSummary, targetPreferences: buildDossierTargetPreferences(candidate) },
    proofPoints,
    careerTrajectory: careerTrajectorySteps,
  }
})

// Prompt 67 — the Dossier completeness ring's per-section read, mirroring
// the exact same null-check each case in DossierSectionBlock (components/
// dashboard/DossierSections.tsx) uses to decide whether to render at all.
// Takes the DossierData already fetched by the page that renders the ring
// (getDossierSections is the expensive, LLM-generating call — this must
// never trigger a second one, only read fields off data that's already in
// memory).
export function getDossierSectionCompleteness(
  dossier: DossierData
): { id: DossierSectionId; title: string; hasContent: boolean }[] {
  return dossier.sections.map(({ id, title }) => {
    let hasContent: boolean
    switch (id) {
      case 'positioning':
        // Approved text only. An unapproved AI draft is explicitly NOT
        // Dossier-eligible (see the positioningStatement* comment in
        // schema.prisma), so counting a draft as "content" inflated the
        // completeness ring for a section a hiring manager can't actually see.
        hasContent = !!dossier.positioning.approvedText
        break
      case 'howIOperate':
        hasContent = dossier.howIOperate.dimensionSummaries.length > 0 || dossier.howIOperate.superpowers.length > 0
        break
      case 'aiFluency':
        hasContent = !!dossier.aiFluencyExample
        break
      case 'impactOnPeople':
        hasContent = dossier.impactOnPeople.quotes.length > 0 || !!dossier.impactOnPeople.communityNarrative
        break
      case 'selfAwareness':
        // Approved text only — same rule as positioning above. An
        // unapproved Victoria draft is explicitly not Dossier-eligible.
        hasContent = !!dossier.selfAwareness.approvedText
        break
      case 'learningGrowth':
        hasContent = dossier.learningGrowth.items.length > 0
        break
      case 'fit': {
        const tp = dossier.fit.targetPreferences
        hasContent =
          !!dossier.fit.patternSummary ||
          !!tp.targetRoleType ||
          tp.targetIndustries.length > 0 ||
          !!tp.companySizeLabel ||
          !!tp.companyStageLabel ||
          !!tp.locationPreferenceLabel
        break
      }
      case 'proofPoints':
        hasContent = dossier.proofPoints.length > 0
        break
    }
    return { id, title, hasContent }
  })
}

// A cheap, LLM-free equivalent of "would getDossierSections consider this
// dossier complete" — for the Dossier Complete badge (Prompt 51), which
// re-checks on every Stats page load. Calling the real getDossierSections
// there was triggering 3 real Anthropic generations per candidate per page
// view (positioning draft, proof-point follow-ups, job-reaction pattern
// summary) just to read a boolean, and any one of those failing used to take
// the whole Stats page down with it. This checks the same underlying
// existence conditions directly instead of generating anything.
export async function isDossierComplete(candidateId: string): Promise<boolean> {
  const candidate = await prisma.candidateProfile.findUniqueOrThrow({
    where: { id: candidateId },
    select: { positioningStatementText: true, topStrengths: true, selfAwarenessText: true },
  })
  if (!candidate.positioningStatementText) return false
  if (!candidate.selfAwarenessText) return false

  const [
    howIOperate,
    latestAiProject,
    impactQuoteCount,
    peerSupportCount,
    learningGrowth,
    reactedJobCount,
    appliedOrReviewedJobCount,
    starResponses,
  ] = await Promise.all([
    getHowIOperate(candidateId, candidate.topStrengths),
    prisma.learningBadge.findFirst({
      where: { candidateId, badgeType: 'ai_project', judgmentCall: { not: null } },
    }),
    prisma.referenceQuote.count({ where: { candidateId, approvedByCandidateAt: { not: null } } }),
    computeCandidatePeerSupportCount(candidateId),
    getLearningGrowth(candidateId),
    prisma.surfacedJob.count({ where: { candidateId, reaction: { not: null } } }),
    prisma.jobPosting.count({
      where: { candidateId, OR: [{ appliedAt: { not: null } }, { fitScore: { not: null } }] },
    }),
    prisma.interviewResponse.findMany({
      where: { candidateId, responseType: 'text', responseText: { not: null } },
      select: { feedback: true },
    }),
  ])

  const hasStarResponse = starResponses.some(
    (r) => (r.feedback as { usesStarStructure?: boolean } | null)?.usesStarStructure === true
  )

  return (
    (howIOperate.dimensionSummaries.length > 0 || howIOperate.superpowers.length > 0) &&
    Boolean(latestAiProject?.judgmentCall) &&
    (impactQuoteCount > 0 || Boolean(communityTierNarrative(peerSupportCount))) &&
    learningGrowth.items.length > 0 &&
    reactedJobCount + appliedOrReviewedJobCount >= MIN_SIGNALS_FOR_PATTERN &&
    hasStarResponse
  )
}

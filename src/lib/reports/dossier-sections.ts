import 'server-only'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getAnthropicClient } from '@/lib/anthropic'
import {
  computeCategoryGrades,
  GRADE_RELATIONS_INCLUDE,
  type CandidateWithGradeRelations,
} from '@/lib/scoring/hireability-grade'
import { computeNamedReasons, type NamedReason } from '@/lib/scoring/named-reasons'
import type { CategoryGrade, CategoryKey } from '@/lib/scoring/grade'
import { translateDimensionVectors, type DimensionVectors } from '@/lib/scoring/assessment-vectors'
import { summarizeSelfAwareness } from '@/lib/scoring/self-awareness'
import { getCandidateLevelRank } from '@/lib/scoring/level-rank-service'
import { TOP_STRENGTH_OPTIONS } from '@/lib/constants/onboarding'
import { computeReferenceAlignment } from '@/lib/references/testimony-processing'
import { communityTierNarrative, computeCandidatePeerSupportCount } from '@/lib/reports/community-tier'
import { generateReactionSummary, MIN_REACTIONS_FOR_SUMMARY } from '@/lib/network/job-discovery'

// The Executive Dossier's dynamic sections (Prompt 47) — everything beyond
// the existing Effort Summary / References / AI Projects / Learning /
// Availability sections already rendered by recruiter-report.ts. Built as
// its own module so the CORE MECHANIC (named-reasons-driven reweighting +
// closed-loop callout) has one clear home, and so each section can be
// sourced from real, existing data rather than invented.
//
// WHAT NEVER APPEARS HERE, under any circumstance (enforced by simply never
// querying for it): financial pressure/Benefits data, raw score numbers,
// mood/check-in data, coaching session notes, raw Support Network message
// content, raw calendar event details. See prisma/schema.prisma's
// CoachSession/DailyCheckIn/EncouragementNote models — none are touched.

export interface DossierSection {
  id: DossierSectionId
  title: string
}

export type DossierSectionId =
  | 'positioning'
  | 'howIOperate'
  | 'whatDrivesMe'
  | 'aiFluency'
  | 'impactOnPeople'
  | 'selfAwareness'
  | 'learningGrowth'
  | 'fit'
  | 'proofPoints'

const SECTION_TITLES: Record<DossierSectionId, string> = {
  positioning: 'Positioning Statement',
  howIOperate: 'How I Operate',
  whatDrivesMe: 'What Drives Me',
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
// gap mapping and stay in their base relative position.
const SECTION_ORDER: DossierSectionId[] = [
  'positioning',
  'howIOperate',
  'whatDrivesMe',
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
  whatDrivesMe: 'searchStrategy_gap',
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
  positioning: { draftText: string | null; approvedText: string | null }
  howIOperate: { dimensionSummaries: string[]; superpowers: DossierSuperpower[] }
  whatDrivesMe: { motivationNarrative: string | null; effortStatText: string | null }
  aiFluencyExample: string | null
  impactOnPeople: {
    quotes: { theme: string; quoteText: string; refereeName: string }[]
    communityNarrative: string | null
  }
  selfAwareness: { growthEdges: string[] }
  learningGrowth: { items: { title: string; closedGapArea: string | null }[] }
  fit: { patternSummary: string | null }
  proofPoints: DossierProofPoint[]
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
): Promise<{ dimensionSummaries: string[]; superpowers: DossierSuperpower[] }> {
  const latestAssessment = await prisma.candidateAssessmentResponse.findFirst({
    where: { candidateId },
    orderBy: { completedAt: 'desc' },
  })
  const dimensionSummaries = latestAssessment
    ? Object.values(translateDimensionVectors(latestAssessment.dimensionVectors as unknown as DimensionVectors))
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

  return { dimensionSummaries, superpowers }
}

export async function getWhatDrivesMe(
  candidateId: string,
  knownFor: string | null
): Promise<{ motivationNarrative: string | null; effortStatText: string | null }> {
  // Denominator (weeks tracked) comes from WeeklySprint — every week the
  // candidate has committed to a sprint, whether or not it landed an A.
  // Numerator (A weeks) is sourced from WeeklyBadgeEarned, the real
  // currently-written record; SundayNightReport.onAList is legacy and
  // nothing writes to it (see src/lib/badges/weekly-badge-archive.ts).
  const [totalWeeks, aListWeekCount] = await Promise.all([
    prisma.weeklySprint.count({ where: { candidateId } }),
    prisma.weeklyBadgeEarned.count({ where: { candidateId, badgeKey: 'WEEKLY_SCORE_A_LIST' } }),
  ])
  const effortStatText =
    totalWeeks > 0
      ? `${aListWeekCount} of ${totalWeeks} weeks at an A. This level of sustained, self-directed effort — without external accountability — is itself a signal of persistence.`
      : null

  // No dedicated Victoria-guided "cost me something" elicitation exists yet
  // (flagged, not invented) — knownFor is the closest existing honest proxy
  // for motivation/identity narrative content.
  return { motivationNarrative: knownFor, effortStatText }
}

async function getGapAreasAndLearningItems(candidateId: string) {
  const [learningItems, latestReport] = await Promise.all([
    prisma.learningBadge.findMany({
      where: { candidateId, badgeType: { not: 'ai_project' } },
      orderBy: { completedAt: 'desc' },
      take: 10,
    }),
    prisma.hireabilityReport.findFirst({
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

// Positives only, per this module's own rule (see header comment) — this
// used to quote the raw, unresolved "Still building: {area} — {why}" gap
// text straight from HireabilityReport.gapAnalysis, which is exactly the
// weakness disclosure that has no place in a document that leaves the
// candidate's hands. Self-awareness only reads as a strength to a hiring
// manager when it's paired with action already taken — a gap the candidate
// spotted and then closed — not a bare admission of something unresolved.
export async function getSelfAwareness(candidateId: string): Promise<{ growthEdges: string[] }> {
  const { learningItems, gapAreas } = await getGapAreasAndLearningItems(candidateId)
  const growthEdges = learningItems
    .map((item) => {
      const closedArea = matchClosedGapArea(item.title, gapAreas)
      return closedArea ? `Recognized ${closedArea} as a growth area early and closed it with ${item.title}.` : null
    })
    .filter((edge): edge is string => edge !== null)
    .slice(0, 2)
  return { growthEdges }
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

  const [patternSummary, proofPoints] = await Promise.all([
    generateReactionSummary(candidateId),
    getProofPoints(candidateId),
  ])

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

export async function getDossierSections(candidateId: string): Promise<DossierData> {
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
  })

  const [positioning, howIOperate, whatDrivesMe, impactQuotes, peerSupportCount, selfAwareness, learningGrowth, generated] =
    await Promise.all([
      getOrDraftPositioningStatement({ ...candidate, levelRankLabel: levelRank.label }),
      getHowIOperate(candidateId, candidate.topStrengths),
      getWhatDrivesMe(candidateId, candidate.knownFor),
      prisma.referenceQuote.findMany({
        where: { candidateId, approvedByCandidateAt: { not: null } },
        include: { reference: { select: { refereeName: true } } },
        orderBy: { approvedByCandidateAt: 'desc' },
      }),
      computeCandidatePeerSupportCount(candidateId),
      getSelfAwareness(candidateId),
      getLearningGrowth(candidateId),
      getCachedGenerations(candidateId, candidate.dossierGeneratedCache),
    ])
  const { patternSummary, proofPoints } = generated

  // Self-Awareness is Dossier-eligible only on a 'strong' verdict —
  // corroborated agreement across two or more independent reads. Anything
  // less is silent here; a 'wildly_off' read never reaches this document at
  // all, only Coaching Notes. See summarizeSelfAwareness for why the bar is
  // set generously.
  const selfAwarenessVerdict = summarizeSelfAwareness(categories.map((c) => c.selfAwareness))
  const gatedSelfAwareness = selfAwarenessVerdict === 'strong' ? selfAwareness : { growthEdges: [] }

  return {
    namedReasons,
    sections: reweightedSections(namedReasons),
    closedLoopCallouts: closedLoopCallouts(namedReasons),
    categoryStrengths: categoryStrengths(categories, namedReasons),
    positioning,
    howIOperate,
    whatDrivesMe,
    aiFluencyExample: latestAiProject?.judgmentCall ?? null,
    impactOnPeople: {
      quotes: impactQuotes.map((q) => ({ theme: q.theme, quoteText: q.quoteText, refereeName: q.reference.refereeName })),
      communityNarrative: communityTierNarrative(peerSupportCount),
    },
    selfAwareness: gatedSelfAwareness,
    learningGrowth,
    fit: { patternSummary },
    proofPoints,
  }
}

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
      case 'whatDrivesMe':
        hasContent = !!dossier.whatDrivesMe.effortStatText || !!dossier.whatDrivesMe.motivationNarrative
        break
      case 'aiFluency':
        hasContent = !!dossier.aiFluencyExample
        break
      case 'impactOnPeople':
        hasContent = dossier.impactOnPeople.quotes.length > 0 || !!dossier.impactOnPeople.communityNarrative
        break
      case 'selfAwareness':
        hasContent = dossier.selfAwareness.growthEdges.length > 0
        break
      case 'learningGrowth':
        hasContent = dossier.learningGrowth.items.length > 0
        break
      case 'fit':
        hasContent = !!dossier.fit.patternSummary
        break
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
    select: { positioningStatementText: true, topStrengths: true, knownFor: true },
  })
  if (!candidate.positioningStatementText) return false

  const [
    howIOperate,
    whatDrivesMe,
    latestAiProject,
    impactQuoteCount,
    peerSupportCount,
    selfAwareness,
    learningGrowth,
    reactedJobCount,
    starResponses,
  ] = await Promise.all([
    getHowIOperate(candidateId, candidate.topStrengths),
    getWhatDrivesMe(candidateId, candidate.knownFor),
    prisma.learningBadge.findFirst({
      where: { candidateId, badgeType: 'ai_project', judgmentCall: { not: null } },
    }),
    prisma.referenceQuote.count({ where: { candidateId, approvedByCandidateAt: { not: null } } }),
    computeCandidatePeerSupportCount(candidateId),
    getSelfAwareness(candidateId),
    getLearningGrowth(candidateId),
    prisma.surfacedJob.count({ where: { candidateId, reaction: { not: null } } }),
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
    (Boolean(whatDrivesMe.effortStatText) || Boolean(whatDrivesMe.motivationNarrative)) &&
    Boolean(latestAiProject?.judgmentCall) &&
    (impactQuoteCount > 0 || Boolean(communityTierNarrative(peerSupportCount))) &&
    selfAwareness.growthEdges.length > 0 &&
    learningGrowth.items.length > 0 &&
    reactedJobCount >= MIN_REACTIONS_FOR_SUMMARY &&
    hasStarResponse
  )
}

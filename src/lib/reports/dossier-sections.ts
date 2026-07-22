import 'server-only'
import { prisma } from '@/lib/prisma'
import { getAnthropicClient } from '@/lib/anthropic'
import {
  computeMarketRealityDimensions,
  GRADE_RELATIONS_INCLUDE,
  type CandidateWithGradeRelations,
} from '@/lib/scoring/hireability-grade'
import { computeNamedReasons, type NamedReason } from '@/lib/scoring/named-reasons'
import { translateDimensionVectors, type DimensionVectors } from '@/lib/scoring/assessment-vectors'
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

export interface DossierData {
  namedReasons: NamedReason[]
  sections: DossierSection[] // dynamically reweighted, ready to render in order
  closedLoopCallouts: ClosedLoopCallout[]
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
  const weeklyReports = await prisma.sundayNightReport.findMany({
    where: { candidateId },
    select: { onAList: true },
  })
  const effortStatText =
    weeklyReports.length > 0
      ? `${weeklyReports.filter((r) => r.onAList).length} of ${weeklyReports.length} weeks at an A. This level of sustained, self-directed effort — without external accountability — is itself a signal of persistence.`
      : null

  // No dedicated Victoria-guided "cost me something" elicitation exists yet
  // (flagged, not invented) — knownFor is the closest existing honest proxy
  // for motivation/identity narrative content.
  return { motivationNarrative: knownFor, effortStatText }
}

export async function getSelfAwareness(candidateId: string): Promise<{ growthEdges: string[] }> {
  const latestReport = await prisma.hireabilityReport.findFirst({
    where: { candidateId },
    orderBy: { generatedAt: 'desc' },
    select: { gapAnalysis: true },
  })
  if (!latestReport) return { growthEdges: [] }
  const gapAnalysis = latestReport.gapAnalysis as unknown as {
    gaps: { area: string; why: string }[]
  }
  const growthEdges = (gapAnalysis.gaps ?? [])
    .slice(0, 2)
    .map((g) => `Still building: ${g.area} — ${g.why}`)
  return { growthEdges }
}

export async function getLearningGrowth(
  candidateId: string
): Promise<{ items: { title: string; closedGapArea: string | null }[] }> {
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
  const gaps = ((latestReport?.gapAnalysis as unknown as { gaps: { area: string }[] } | undefined)?.gaps ?? []).map(
    (g) => g.area
  )

  const items = learningItems.map((item) => {
    const normalizedTitle = item.title.toLowerCase()
    const closedGapArea = gaps.find((area) => normalizedTitle.includes(area.toLowerCase().split(' ')[0])) ?? null
    return { title: item.title, closedGapArea }
  })
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

export async function getDossierSections(candidateId: string): Promise<DossierData> {
  const candidate = await prisma.candidateProfile.findUniqueOrThrow({
    where: { id: candidateId },
    include: GRADE_RELATIONS_INCLUDE,
  })

  const latestAiProject = await prisma.learningBadge.findFirst({
    where: { candidateId, badgeType: 'ai_project', judgmentCall: { not: null } },
    orderBy: { completedAt: 'desc' },
  })

  const dimensions = await computeMarketRealityDimensions(candidate as unknown as CandidateWithGradeRelations)
  const namedReasons = computeNamedReasons(dimensions, latestAiProject?.judgmentCall ?? null)

  const [positioning, howIOperate, whatDrivesMe, impactQuotes, peerSupportCount, selfAwareness, learningGrowth, patternSummary, proofPoints] =
    await Promise.all([
      getOrDraftPositioningStatement(candidate),
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
      generateReactionSummary(candidateId),
      getProofPoints(candidateId),
    ])

  return {
    namedReasons,
    sections: reweightedSections(namedReasons),
    closedLoopCallouts: closedLoopCallouts(namedReasons),
    positioning,
    howIOperate,
    whatDrivesMe,
    aiFluencyExample: latestAiProject?.judgmentCall ?? null,
    impactOnPeople: {
      quotes: impactQuotes.map((q) => ({ theme: q.theme, quoteText: q.quoteText, refereeName: q.reference.refereeName })),
      communityNarrative: communityTierNarrative(peerSupportCount),
    },
    selfAwareness,
    learningGrowth,
    fit: { patternSummary },
    proofPoints,
  }
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

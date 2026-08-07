import 'server-only'
import { prisma } from '@/lib/prisma'
import { isExecutiveTargetRole } from '@/lib/constants/onboarding'
import { matchByFunction, resolveContentFunction, SALES_KEYWORDS } from '@/lib/constants/match-by-function'
import { AI_TRAINING_COURSES, type AiTrainingTier } from '@/lib/constants/ai-training-tiers'
import { CERTIFICATIONS_BY_FUNCTION } from '@/lib/constants/certifications-by-function'
import { getExecEdProgram } from '@/lib/constants/exec-ed-by-school'
import { BUSINESS_SKILLS_GENERAL, BUSINESS_SKILLS_LEADERSHIP, EMERITUS_CATALOG } from '@/lib/constants/business-skills-learning'
import { getAiToolsForFunction, type AiToolRecommendation } from '@/lib/constants/ai-tools-by-function'
import { getFunctionTraining } from '@/lib/constants/function-training'
import { SPEAKING_RESOURCES, SPEAKING_LEADERSHIP_GATED } from '@/lib/constants/speaking-leadership'
import { getDefaultNarrative } from '@/lib/narrative/get-default-narrative'
import { rationaleForItem, truncate, type GapLike } from '@/lib/learning/rationale'
import type { LearningResource } from '@/lib/constants/learning-partners'

export interface LearningPlanItem extends LearningResource {
  rationale: string | null
  completionCount: number
}

export interface LearningPlanSection {
  id: string
  title: string
  items: LearningPlanItem[]
}

export interface InterviewSkillsData {
  hasNarrative: boolean
  narrativeComfortIsLow: boolean
  hasActiveJobDescription: boolean
  coreStatementExcerpt: string | null
}

export interface LearningPlanAiTool extends AiToolRecommendation {
  id: string | null // set only for a candidate-added custom tool, for removal
  isFamiliar: boolean
  isCustom: boolean
}

export interface LearningPlan {
  aiTrainingTier: AiTrainingTier
  aiTrainingCourses: LearningPlanItem[]
  aiTools: LearningPlanAiTool[]
  contentFunction: string | null
  aiFlexibilityLevel: number | null
  aiContextBannerDismissed: boolean
  functionTraining: LearningPlanItem[]
  sections: LearningPlanSection[]
  interviewSkills: InterviewSkillsData
  hasManagementSignal: boolean
}

interface GapAnalysisShape {
  targetRoleType?: string
  gaps?: { area: string; why: string; remediation: string; remediationType: string }[]
}

function defaultAiTier(aiFlexibilityLevel: number | null): AiTrainingTier {
  if (aiFlexibilityLevel === null || aiFlexibilityLevel <= 25) return 'foundational'
  if (aiFlexibilityLevel <= 75) return 'practical'
  return 'technical'
}

function withRationale(
  items: LearningResource[],
  matchKey: string,
  gaps: GapLike[],
  skillsStillNeeded: string | null,
  structuralFact: string | null,
  completionCounts: Map<string, number>
): LearningPlanItem[] {
  return items.map((item) => ({
    ...item,
    rationale: rationaleForItem({ matchKey, gaps, skillsStillNeeded, structuralFact }),
    completionCount: completionCounts.get(item.title) ?? 0,
  }))
}

export async function buildLearningPlan(candidateId: string): Promise<LearningPlan> {
  const [candidate, latestReport, primaryEducation, narrative, completionRows, toolFamiliarityRows] = await Promise.all([
    prisma.candidateProfile.findUniqueOrThrow({
      where: { id: candidateId },
      select: {
        primaryFunction: true,
        targetRoleType: true,
        aiFlexibilityLevel: true,
        isPeopleManager: true,
        teamSizeManaged: true,
        highestLevelReached: true,
        skillsStillNeeded: true,
        activeJobDescription: true,
        storyComfort: true,
        hasMBA: true,
        aiContextBannerDismissedAt: true,
      },
    }),
    prisma.hireabilityReport.findFirst({
      where: { candidateId },
      orderBy: { generatedAt: 'desc' },
      select: { gapAnalysis: true },
    }),
    prisma.educationEntry.findFirst({ where: { candidateId, isPrimary: true } }),
    getDefaultNarrative(candidateId),
    // Real "X candidates have completed this" counts — across ALL
    // candidates, not just this one, so it reads as social proof.
    prisma.learningBadge.groupBy({ by: ['title'], where: { badgeType: 'course_completed' }, _count: { _all: true } }),
    prisma.candidateAiToolFamiliarity.findMany({ where: { candidateId } }),
  ])

  const completionCounts = new Map(completionRows.map((r) => [r.title, r._count._all]))

  const gaps: GapLike[] = latestReport
    ? ((latestReport.gapAnalysis as unknown as GapAnalysisShape)?.gaps ?? []).map((g) => ({ area: g.area, why: g.why }))
    : []

  const primaryFunction = candidate.primaryFunction
  const skillsStillNeeded = candidate.skillsStillNeeded

  // Prefers the role the candidate is TARGETING over their own history —
  // a VP Finance targeting CFO sees CFO/Finance tools and training aimed
  // at where they're headed, not just where they've been.
  const contentFunction = resolveContentFunction(primaryFunction, candidate.targetRoleType)

  // Real management signal — any one of: confirmed people manager, a real
  // team managed, an already-senior title, or explicitly targeting an
  // executive-level role. Gates the leadership-adjacent content in
  // Business Skills and Public Speaking so it doesn't show to every IC.
  const seniorLevels = new Set(['Director', 'VP', 'C-Suite'])
  const hasManagementSignal = Boolean(
    candidate.isPeopleManager ||
      (candidate.teamSizeManaged ?? 0) > 0 ||
      (candidate.highestLevelReached && seniorLevels.has(candidate.highestLevelReached)) ||
      isExecutiveTargetRole(candidate.targetRoleType)
  )

  // Sales-gate predicate ships now (matches the same shared keyword list
  // the AI-tools sales group uses) — content stays empty, no vendor
  // identified yet (see Phase 6 decision). Kept here so the gating logic
  // is proven even though it currently has nothing to gate.
  const isSalesFunction = Boolean(
    matchByFunction(primaryFunction, [{ keywords: SALES_KEYWORDS, value: true }]) ||
      matchByFunction(candidate.targetRoleType, [{ keywords: SALES_KEYWORDS, value: true }])
  )
  void isSalesFunction // reserved for when real sales-training content exists

  const aiTrainingTier = defaultAiTier(candidate.aiFlexibilityLevel)
  const aiTrainingCourses = withRationale(
    AI_TRAINING_COURSES[aiTrainingTier],
    'ai',
    gaps,
    skillsStillNeeded,
    'AI fluency is fast becoming table stakes across every function.',
    completionCounts
  )
  // Curated tools merged with the candidate's own familiarity/custom
  // additions — one list, so "already know this" and "added by me" tools
  // sit alongside the curated recommendations instead of a separate list.
  const curatedTools = getAiToolsForFunction(contentFunction)
  const familiarToolNames = new Set(toolFamiliarityRows.filter((r) => !r.isCustom).map((r) => r.toolName))
  const aiTools: LearningPlanAiTool[] = [
    ...curatedTools.map((tool) => ({
      ...tool,
      id: null,
      isFamiliar: familiarToolNames.has(tool.name),
      isCustom: false,
    })),
    ...toolFamiliarityRows
      .filter((r) => r.isCustom)
      .map((r) => ({
        name: r.toolName,
        description: 'Added by you.',
        url: r.toolUrl ?? '#',
        id: r.id,
        isFamiliar: true,
        isCustom: true,
      })),
  ]

  const sections: LearningPlanSection[] = []

  const certifications = contentFunction
    ? CERTIFICATIONS_BY_FUNCTION[contentFunction as keyof typeof CERTIFICATIONS_BY_FUNCTION]
    : undefined
  if (certifications && certifications.length > 0) {
    sections.push({
      id: 'certifications',
      title: 'Certifications',
      items: withRationale(
        certifications,
        contentFunction ?? '',
        gaps,
        skillsStillNeeded,
        contentFunction ? `A recognized credential for ${contentFunction} roles.` : null,
        completionCounts
      ),
    })
  }

  // A generic "intro to business" course/catalog is a step backward for
  // someone who already holds an MBA — skip the general set (but not the
  // leadership set, which is about a management skill, not a business
  // fundamentals gap; and not exec-ed, which is alumni-specific, not
  // remedial) for MBA holders.
  const businessSkillsItems: LearningResource[] = candidate.hasMBA ? [] : [...BUSINESS_SKILLS_GENERAL]
  if (hasManagementSignal) businessSkillsItems.push(...BUSINESS_SKILLS_LEADERSHIP)
  const execEdProgram = primaryEducation ? getExecEdProgram(primaryEducation.schoolNameNormalized) : null
  if (execEdProgram) businessSkillsItems.push(execEdProgram)
  if (!candidate.hasMBA) businessSkillsItems.push(EMERITUS_CATALOG)
  if (businessSkillsItems.length > 0) {
    sections.push({
      id: 'business-skills',
      title: 'Business Skills',
      items: withRationale(
        businessSkillsItems,
        'business',
        gaps,
        skillsStillNeeded,
        execEdProgram ? `Because you studied at ${primaryEducation?.schoolName}.` : 'Core business skills that transfer across every function.',
        completionCounts
      ),
    })
  }

  // Rendered inside the Tools section (page.tsx), not the generic
  // sections loop — real courses/certs belong next to the AI tools for
  // the same role, not a separate disconnected list further down.
  const functionTraining = withRationale(
    getFunctionTraining(contentFunction),
    contentFunction ?? '',
    gaps,
    skillsStillNeeded,
    contentFunction ? `Common for ${contentFunction} roles.` : null,
    completionCounts
  )

  const speakingLeadershipItems: LearningResource[] = [...SPEAKING_RESOURCES]
  if (hasManagementSignal) speakingLeadershipItems.push(...SPEAKING_LEADERSHIP_GATED)
  sections.push({
    id: 'speaking-leadership',
    title: hasManagementSignal ? 'Public Speaking & Leadership' : 'Public Speaking',
    items: withRationale(
      speakingLeadershipItems,
      'speaking',
      gaps,
      skillsStillNeeded,
      'Communicating clearly under pressure is a skill hiring managers notice.',
      completionCounts
    ),
  })

  const interviewSkills: InterviewSkillsData = {
    hasNarrative: !!narrative,
    narrativeComfortIsLow: (candidate.storyComfort ?? 0) < 50,
    hasActiveJobDescription: !!candidate.activeJobDescription,
    coreStatementExcerpt: narrative?.coreStatement ? truncate(narrative.coreStatement, 140) : null,
  }

  return {
    aiTrainingTier,
    aiTrainingCourses,
    aiTools,
    contentFunction,
    aiFlexibilityLevel: candidate.aiFlexibilityLevel,
    aiContextBannerDismissed: !!candidate.aiContextBannerDismissedAt,
    functionTraining,
    sections,
    interviewSkills,
    hasManagementSignal,
  }
}

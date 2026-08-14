import 'server-only'
import { prisma } from '@/lib/prisma'
import { isExecutiveTargetRole } from '@/lib/constants/onboarding'
import { matchByFunction, resolveContentFunction, SALES_KEYWORDS } from '@/lib/constants/match-by-function'
import type { Course, CourseSkillLevel } from '@prisma/client'
import { getActiveCourses, toLearningResource, defaultSkillLevel, COURSE_SKILL_LEVELS } from '@/lib/learning/courses'
import { getExecEdProgram } from '@/lib/constants/exec-ed-by-school'
import { getAiToolsForFunction, type AiToolRecommendation } from '@/lib/constants/ai-tools-by-function'
import { getDefaultNarrative } from '@/lib/narrative/get-default-narrative'
import { rationaleForItem, truncate, type GapLike } from '@/lib/learning/rationale'
import type { LearningResource } from '@/lib/constants/learning-partners'

export interface LearningPlanItem extends LearningResource {
  rationale: string | null
  completionCount: number
  // True when this item's title matches a certification the candidate's
  // resume already lists (CandidateProfile.certifications) — only ever set
  // for certification-flavored sections; every other section leaves this
  // false rather than guessing.
  alreadyHeld: boolean
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
  aiTrainingTier: CourseSkillLevel
  aiTrainingCoursesByLevel: Record<CourseSkillLevel, LearningPlanItem[]>
  aiTools: LearningPlanAiTool[]
  contentFunction: string | null
  aiFlexibilityLevel: number | null
  functionTraining: LearningPlanItem[]
  sections: LearningPlanSection[]
  interviewSkills: InterviewSkillsData
  hasManagementSignal: boolean
}

interface GapAnalysisShape {
  targetRoleType?: string
  gaps?: { area: string; why: string; remediation: string; remediationType: string }[]
}

// Loose bidirectional substring match — a resume-extracted certification
// like "PMP" should match a course titled "PMP Certification Prep", and a
// verbose course title should still match a verbose certification name.
function matchesCertification(courseTitle: string, certifications: string[]): boolean {
  const normalizedTitle = courseTitle.toLowerCase()
  return certifications.some((cert) => {
    const normalizedCert = cert.toLowerCase()
    return normalizedTitle.includes(normalizedCert) || normalizedCert.includes(normalizedTitle)
  })
}

function withRationale(
  items: LearningResource[],
  matchKey: string,
  gaps: GapLike[],
  skillsToBuild: string[],
  structuralFact: string | null,
  completionCounts: Map<string, number>,
  certifications: string[] = []
): LearningPlanItem[] {
  return items.map((item) => ({
    ...item,
    rationale: rationaleForItem({ matchKey, gaps, skillsToBuild, structuralFact }),
    completionCount: completionCounts.get(item.title) ?? 0,
    alreadyHeld: matchesCertification(item.title, certifications),
  }))
}

export async function buildLearningPlan(candidateId: string): Promise<LearningPlan> {
  const [candidate, latestReport, primaryEducation, narrative, completionRows, toolFamiliarityRows, allCourses] = await Promise.all([
    prisma.candidateProfile.findUniqueOrThrow({
      where: { id: candidateId },
      select: {
        primaryFunction: true,
        secondaryFunction: true,
        targetRoleType: true,
        aiFlexibilityLevel: true,
        isPeopleManager: true,
        teamSizeManaged: true,
        highestLevelReached: true,
        skillsToBuild: true,
        activeJobDescription: true,
        storyComfort: true,
        hasMBA: true,
        certifications: true,
        industryContext: true,
        targetIndustries: true,
      },
    }),
    prisma.marketRealityReport.findFirst({
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
    getActiveCourses(),
  ])

  const completionCounts = new Map(completionRows.map((r) => [r.title, r._count._all]))

  const gaps: GapLike[] = latestReport
    ? ((latestReport.gapAnalysis as unknown as GapAnalysisShape)?.gaps ?? []).map((g) => ({ area: g.area, why: g.why }))
    : []

  const primaryFunction = candidate.primaryFunction
  const skillsToBuild = candidate.skillsToBuild

  // Current/past role and target role, kept distinct — the Certifications
  // section shows one block per role instead of collapsing them into a
  // single guess. currentFunction falls straight through to primaryFunction
  // (resolveContentFunction's fallback is already an identity return when
  // there's no targetRoleType to resolve), and targetFunction is null
  // whenever it resolves to the same canonical bucket as currentFunction —
  // no point in showing the same section twice under two headings.
  const currentFunction = primaryFunction
  const targetFunctionResolved = candidate.targetRoleType
    ? resolveContentFunction(null, candidate.targetRoleType)
    : null
  const targetFunction = targetFunctionResolved && targetFunctionResolved !== currentFunction ? targetFunctionResolved : null

  // Prefers the role the candidate is TARGETING over their own history —
  // a VP Finance targeting CFO sees CFO/Finance tools and training aimed
  // at where they're headed, not just where they've been. Still used for
  // the Tools section (AI tools + function training), which isn't split
  // by role the way Certifications now is.
  const contentFunction = targetFunctionResolved ?? currentFunction

  // A candidate's most recent role(s) can be in a different function than
  // the bulk of their career (secondaryFunction) — treated as part of
  // "your background" alongside currentFunction, not a replacement for it.
  const backgroundFunctions = Array.from(new Set([currentFunction, candidate.secondaryFunction].filter((f): f is string => !!f)))
  const contentFunctions = Array.from(new Set([contentFunction, candidate.secondaryFunction].filter((f): f is string => !!f)))

  // Full target-industries list, plus the candidate's actual background
  // industry — either can drive industry-tagged content, not just the
  // single industryContext value.
  const industryNames = Array.from(
    new Set([candidate.industryContext, ...candidate.targetIndustries].filter((i): i is string => !!i))
  )

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

  const aiCourses = allCourses.filter((c) => c.category === 'AI_TRAINING')
  const businessSkillsCourses = allCourses.filter((c) => c.category === 'BUSINESS_SKILLS')
  const certificationCourses = allCourses.filter((c) => c.category === 'CERTIFICATION')
  const functionTrainingCourses = allCourses.filter((c) => c.category === 'FUNCTION_TRAINING')
  const speakingCourses = allCourses.filter((c) => c.category === 'SPEAKING')

  // Self-report (aiFlexibilityLevel) always wins when it exists. Only when
  // a candidate hasn't answered that question yet do resume-confirmed
  // certifications nudge the default up one tier — real credentials are a
  // reasonable prior for "this person can handle more than Beginner," but
  // shouldn't override an actual self-report either direction.
  const aiTrainingTier =
    candidate.aiFlexibilityLevel === null && candidate.certifications.length > 0
      ? 'INTERMEDIATE'
      : defaultSkillLevel(candidate.aiFlexibilityLevel)
  const aiTrainingCoursesByLevel = Object.fromEntries(
    COURSE_SKILL_LEVELS.map((level) => [
      level,
      withRationale(
        aiCourses.filter((c) => c.skillLevel === level).map(toLearningResource),
        'ai',
        gaps,
        skillsToBuild,
        'AI fluency is fast becoming table stakes across every function.',
        completionCounts
      ),
    ])
  ) as Record<CourseSkillLevel, LearningPlanItem[]>
  // Curated tools merged with the candidate's own familiarity/custom
  // additions — one list, so "already know this" and "added by me" tools
  // sit alongside the curated recommendations instead of a separate list.
  const curatedTools =
    contentFunctions.length > 0
      ? Array.from(
          new Map(contentFunctions.flatMap((fn) => getAiToolsForFunction(fn)).map((tool) => [tool.name, tool])).values()
        )
      : getAiToolsForFunction(null)
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

  const certificationsForCurrent =
    backgroundFunctions.length > 0
      ? certificationCourses.filter((c) => backgroundFunctions.some((fn) => c.targetFunctions.includes(fn)))
      : []
  if (certificationsForCurrent.length > 0) {
    sections.push({
      id: 'certifications-current',
      title: 'Certifications For Your Background',
      items: withRationale(
        certificationsForCurrent.map(toLearningResource),
        currentFunction ?? '',
        gaps,
        skillsToBuild,
        currentFunction ? `A recognized credential for ${currentFunction} roles.` : null,
        completionCounts,
        candidate.certifications
      ),
    })
  }

  const certificationsForTarget = targetFunction
    ? certificationCourses.filter((c) => c.targetFunctions.includes(targetFunction))
    : []
  if (certificationsForTarget.length > 0) {
    sections.push({
      id: 'certifications-target',
      title: "Certifications For Where You're Headed",
      items: withRationale(
        certificationsForTarget.map(toLearningResource),
        targetFunction ?? '',
        gaps,
        skillsToBuild,
        `A recognized credential for ${targetFunction} roles.`,
        completionCounts,
        candidate.certifications
      ),
    })
  }

  // Admin-tagged, opt-in — Course.industries starts empty until an admin
  // tags content, so this section legitimately renders nothing for most
  // candidates today. Matched loosely (bidirectional substring) against
  // every industry the candidate cares about — their actual background
  // (industryContext) plus the full multi-select targetIndustries list, not
  // just a single value.
  const normalizedIndustries = industryNames.map((i) => i.toLowerCase())
  const industryCourses =
    normalizedIndustries.length > 0
      ? allCourses.filter((c) =>
          c.industries.some((i) =>
            normalizedIndustries.some((ni) => ni.includes(i.toLowerCase()) || i.toLowerCase().includes(ni))
          )
        )
      : []
  if (industryCourses.length > 0) {
    const industryLabel = industryNames.length === 1 ? industryNames[0] : industryNames.join(', ')
    sections.push({
      id: 'industry',
      title: industryNames.length === 1 ? `For The ${industryLabel} Industry` : 'For Your Target Industries',
      items: withRationale(
        industryCourses.map(toLearningResource),
        'industry',
        gaps,
        skillsToBuild,
        `Tagged as relevant for ${industryLabel}.`,
        completionCounts,
        candidate.certifications
      ),
    })
  }

  // A generic "intro to business" course/catalog is a step backward for
  // someone who already holds an MBA — excludeIfHasMBA rows (general
  // business-skills courses + the Emeritus catalog card) drop out for MBA
  // holders, but leadership content (requiresManagementSignal) is about a
  // management skill, not a business-fundamentals gap, so it's unaffected;
  // same for exec-ed, which is alumni-specific, not remedial.
  const businessSkillsItems: Course[] = businessSkillsCourses.filter(
    (c) => (!c.requiresManagementSignal || hasManagementSignal) && !(candidate.hasMBA && c.excludeIfHasMBA)
  )
  const businessSkillsResources: LearningResource[] = businessSkillsItems.map(toLearningResource)
  const execEdProgram = primaryEducation ? getExecEdProgram(primaryEducation.schoolNameNormalized) : null
  if (execEdProgram) businessSkillsResources.push(execEdProgram)
  if (businessSkillsResources.length > 0) {
    sections.push({
      id: 'business-skills',
      title: 'Business Skills',
      items: withRationale(
        businessSkillsResources,
        'business',
        gaps,
        skillsToBuild,
        execEdProgram ? `Because you studied at ${primaryEducation?.schoolName}.` : 'Core business skills that transfer across every function.',
        completionCounts
      ),
    })
  }

  // Rendered inside the Tools section (page.tsx), not the generic
  // sections loop — real courses/certs belong next to the AI tools for
  // the same role, not a separate disconnected list further down. Matched
  // as a case-insensitive substring, same semantics as the old
  // matchByFunction-based getFunctionTraining helper.
  const normalizedContentFunctions = contentFunctions.map((f) => f.toLowerCase())
  const relevantFunctionTraining =
    normalizedContentFunctions.length > 0
      ? functionTrainingCourses.filter((c) =>
          c.keywords.some((k) => normalizedContentFunctions.some((ncf) => ncf.includes(k.toLowerCase())))
        )
      : []
  const functionTraining = withRationale(
    relevantFunctionTraining.map(toLearningResource),
    contentFunction ?? '',
    gaps,
    skillsToBuild,
    contentFunction ? `Common for ${contentFunction} roles.` : null,
    completionCounts
  )

  const speakingLeadershipItems: LearningResource[] = speakingCourses
    .filter((c) => !c.requiresManagementSignal || hasManagementSignal)
    .map(toLearningResource)
  if (speakingLeadershipItems.length > 0) {
    sections.push({
      id: 'speaking-leadership',
      title: hasManagementSignal ? 'Public Speaking & Leadership' : 'Public Speaking',
      items: withRationale(
        speakingLeadershipItems,
        'speaking',
        gaps,
        skillsToBuild,
        'Communicating clearly under pressure is a skill hiring managers notice.',
        completionCounts
      ),
    })
  }

  const interviewSkills: InterviewSkillsData = {
    hasNarrative: !!narrative,
    narrativeComfortIsLow: (candidate.storyComfort ?? 0) < 50,
    hasActiveJobDescription: !!candidate.activeJobDescription,
    coreStatementExcerpt: narrative?.coreStatement ? truncate(narrative.coreStatement, 140) : null,
  }

  return {
    aiTrainingTier,
    aiTrainingCoursesByLevel,
    aiTools,
    contentFunction,
    aiFlexibilityLevel: candidate.aiFlexibilityLevel,
    functionTraining,
    sections,
    interviewSkills,
    hasManagementSignal,
  }
}

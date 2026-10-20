import { getLearningPaths } from '@/lib/journey/learning-paths-data'
import { LearningPathsCard } from '@/components/dashboard/pathway/LearningPathsCard'
import type { Metadata } from 'next'
import { Suspense } from 'react'
import { prisma } from '@/lib/prisma'
import { getDashboardProfile } from '@/lib/dashboard/get-dashboard-data'
import { buildLearningPlan } from '@/lib/learning/build-learning-plan'
import { captureServerEvent } from '@/lib/posthog/server'
import { getMondayOfWeek } from '@/lib/weekly/sprint'
import { formatMinutes } from '@/lib/weekly/action-effort'
import type { LearningBadge } from '@prisma/client'
import { PageHeaderBoxes } from '@/components/dashboard/PageHeaderBoxes'
import { AssessmentLinkCard } from '@/components/dashboard/learning/AssessmentLinkCard'
import { GuideCallout } from '@/components/dashboard/GuideCallout'
import { LearningBadgeList, BADGE_TYPE_LABEL } from '@/components/dashboard/LearningBadgeList'
import { LearningSection } from '@/components/dashboard/learning/LearningSection'
import { LearningResourceCard } from '@/components/dashboard/learning/LearningResourceCard'
import { aiGapCourseItems } from '@/lib/redesign/learn-ai-gap'
import { applicationGapCourseItems } from '@/lib/redesign/learn-app-gap'
import { loadApplicationSkillPlan } from '@/lib/applications/member-view'
import { courseForSkill } from '@/lib/applications/skill-course'
import { loadMemberSkillGapByKind } from '@/lib/jobs/skill-gap-data'
import { getActiveCourses } from '@/lib/learning/courses'
import { AiSkillGapSection } from '@/components/dashboard/learning/AiSkillGapSection'
import { AiTrainingTiers } from '@/components/dashboard/learning/AiTrainingTiers'
import { ToolsForRoleSection } from '@/components/dashboard/learning/ToolsForRoleSection'
import { InterviewSkillsSection } from '@/components/dashboard/learning/InterviewSkillsSection'
import { TierSummaryCard } from '@/components/dashboard/TierSummaryCard'
import { badgeCountToTier } from '@/lib/learning/badge-count-tier'
import { computeBadgeTypeMix } from '@/lib/learning/badge-type-mix'
import type { LearningPlanSection } from '@/lib/learning/build-learning-plan'
import { LockedPreview } from '@/components/dashboard/learning/LockedPreview'
import { SkillsInventoryGateCard } from '@/components/dashboard/learning/SkillsInventoryGateCard'
import { getPlatformActivity } from '@/lib/platforms/candidate-view'
import { PlatformActivityPanel } from '@/components/dashboard/platforms/PlatformActivityPanel'
import { GradDegreeGuardrailCard } from '@/components/dashboard/GradDegreeGuardrailCard'
import { PayChangeCard } from '@/components/dashboard/PayChangeCard'
import { OccupationTrendsCard } from '@/components/dashboard/search-playbook/OccupationTrendsCard'
import { effectiveJourney } from '@/lib/journey/journey'
import { isPivotingProfile } from '@/lib/journey/pivot-target'
import { CompanyCoursesCallout } from '@/components/dashboard/StaffProgramCard'
import { isRedesignOn } from '@/lib/redesign/flag'
import { pickLearnCourses } from '@/lib/redesign/learn-picks'
import { LearnHome } from '@/components/dashboard/LearnHome'
import { TuneStripSection } from '@/components/dashboard/TuneStripSection'

export const metadata: Metadata = { title: 'Learn New Skills' }


// Modest by design — a plain count-by-type line, not a full trends
// breakdown like ApplicationTrendsContent on the Find a Job page.
function BadgeBreakdownContent({ badges }: { badges: LearningBadge[] }) {
  const counts = badges.reduce<Record<string, number>>((acc, badge) => {
    acc[badge.badgeType] = (acc[badge.badgeType] ?? 0) + 1
    return acc
  }, {})
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1])

  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
      {entries.map(([badgeType, count]) => (
        <span key={badgeType} className="text-foreground">
          {BADGE_TYPE_LABEL[badgeType] ?? badgeType} <span className="text-muted-foreground">({count})</span>
        </span>
      ))}
    </div>
  )
}

function renderSection(section: LearningPlanSection, completedTitles: Set<string>, enrolledTitles: Set<string>) {
  return (
    <LearningSection key={section.id} id={section.id} title={section.title}>
      <div className="flex gap-4 overflow-x-auto pb-2">
        {section.items.map((item) => (
          <LearningResourceCard
            key={item.title}
            item={item}
            section={section.id}
            completed={completedTitles.has(item.title)}
            enrolled={enrolledTitles.has(item.title)}
            carousel
          />
        ))}
      </div>
    </LearningSection>
  )
}

export default async function LearningPage({ searchParams }: { searchParams: Promise<{ all?: string }> }) {
  const profile = await getDashboardProfile()
  const redesign = isRedesignOn(profile.email) && (await searchParams).all !== '1'
  const weekStart = getMondayOfWeek(new Date())
  const learningPaths = await getLearningPaths(profile.id)
  const [plan, badges, courseActivity, learningEvents, assessmentResponseCount, platformRows, gmailConnection] = await Promise.all([
    buildLearningPlan(profile.id),
    prisma.learningBadge.findMany({
      where: { candidateId: profile.id },
      orderBy: { completedAt: 'desc' },
    }),
    prisma.candidateCourseActivity.findMany({
      where: { candidateId: profile.id, status: 'ENROLLED' },
      select: { courseTitle: true },
    }),
    prisma.trackedCalendarEvent.findMany({
      where: { candidateId: profile.id, eventType: 'LEARNING', dismissedAt: null },
      select: { startTime: true, durationMinutes: true },
    }),
    prisma.candidateAssessmentResponse.count({ where: { candidateId: profile.id } }),
    getPlatformActivity(profile.id, 'LEARNING'),
    prisma.emailConnection.findFirst({ where: { candidateId: profile.id, disconnectedAt: null }, select: { id: true } }),
  ])
  const hasTakenAssessment = assessmentResponseCount > 0
  const assessmentLocked = !profile.skillsAssessmentCompletedAt
  const badgeMix = computeBadgeTypeMix(badges.map((b) => b.badgeType))

  const completedTitles = new Set(badges.map((b) => b.title))
  const enrolledTitles = new Set(courseActivity.map((c) => c.courseTitle))
  const learningEventsThisWeek = learningEvents.filter((e) => e.startTime >= weekStart)
  const learningMinutesThisWeek = learningEventsThisWeek.reduce((sum, e) => sum + (e.durationMinutes ?? 0), 0)

  if (redesign) {
    // AI skills the member's best-fit employers ask for and the member lacks, each with a tagged course and the reason.
    const [aiGap, catalog, appPlan] = await Promise.all([loadMemberSkillGapByKind(profile.id), getActiveCourses(), loadApplicationSkillPlan(profile.id).catch(() => null)])
    const aiGapItems = aiGap ? aiGapCourseItems(aiGap.rows, aiGap.employersWithSkillData, catalog) : []
    // Skills the member's own applications keep asking for come first (the same ranking as Search Strategy's "What to build next").
    const appGapItems = appPlan ? applicationGapCourseItems(appPlan.recommendations, catalog, courseForSkill) : []
    const picks = pickLearnCourses(
      [...appGapItems, ...aiGapItems, ...plan.sections.flatMap((s) => s.items), ...plan.functionTraining, ...plan.aiTrainingCoursesByLevel[plan.aiTrainingTier]],
      completedTitles,
      enrolledTitles,
    )
    const aiTitles = new Set(aiGapItems.map((i) => i.title))
    captureServerEvent(profile.id, 'learn_home_viewed', {
      hasFeatured: !!picks.featured,
      featuredHasReason: !!picks.featured?.rationale,
      featuredIsAiGap: !!picks.featured && aiTitles.has(picks.featured.title),
      aiGapCourses: aiGapItems.length,
      applicationGapCourses: appGapItems.length,
      featuredIsApplicationGap: !!picks.featured && appGapItems.some((i) => i.title === picks.featured!.title),
      moreCount: picks.more.length,
      completedCount: badges.length,
    })
    return (
      <div className="space-y-8">
        <Suspense fallback={null}>
          <TuneStripSection profile={profile} title="Closer to hired: tune your path" />
        </Suspense>
        <LearnHome featured={picks.featured} more={picks.more} enrolledTitles={enrolledTitles} completedCount={badges.length} allHref="/dashboard/learning?all=1" />
      </div>
    )
  }

  captureServerEvent(profile.id, 'learning_plan_rendered', {
    sectionCount: plan.sections.length,
    itemCount:
      plan.sections.reduce((sum, s) => sum + s.items.length, 0) + plan.aiTrainingCoursesByLevel[plan.aiTrainingTier].length,
    aiTierDefault: plan.aiTrainingTier,
    hasGapRationale: plan.sections.some((s) => s.items.some((i) => !!i.rationale)),
  })

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight">Learn New Skills</h1>
        <CompanyCoursesCallout candidateId={profile.id} />
        {assessmentLocked && <SkillsInventoryGateCard candidateId={profile.id} />}
        <PageHeaderBoxes
          pageKey="learning"
          candidateId={profile.id}
          dailyMessageOverride={<AssessmentLinkCard hasTakenAssessment={hasTakenAssessment} />}
        />
        {learningEvents.length > 0 && (
          <p className="mt-2 text-sm text-muted-foreground">
            {learningEventsThisWeek.length > 0 ? (
              <>
                {learningEventsThisWeek.length} learning session{learningEventsThisWeek.length === 1 ? '' : 's'} on
                your calendar this week{learningMinutesThisWeek > 0 && ` (${formatMinutes(learningMinutesThisWeek)})`}
                . {learningEvents.length} total detected.
              </>
            ) : (
              <>{learningEvents.length} learning session{learningEvents.length === 1 ? '' : 's'} detected from your calendar so far.</>
            )}
          </p>
        )}
      </div>

      <LearningPathsCard paths={learningPaths.paths} progress={learningPaths.progress} />

      {badges.length > 0 && (
        <TierSummaryCard
          title="New Skills"
          count={badges.length}
          unitLabel="badge"
          tier={badgeCountToTier(badges.length)}
          buildingAt={3}
          highAt={5}
          unlockedContent={<BadgeBreakdownContent badges={badges} />}
          mixTitle="A well-rounded mix"
          mixItems={[
            { label: 'Structured learning (a course or certification)', done: badgeMix.hasStructuredLearning },
            { label: 'Applied practice (an AI project)', done: badgeMix.hasAppliedPractice },
            { label: 'Public credibility (a talk or published piece)', done: badgeMix.hasPublicCredibility },
          ]}
        />
      )}

      <PlatformActivityPanel kind="LEARNING" rows={platformRows} gmailConnected={!!gmailConnection} />

      <Suspense fallback={null}>
        <AiSkillGapSection candidateId={profile.id} completedTitles={completedTitles} enrolledTitles={enrolledTitles} />
      </Suspense>

      <LearningSection
        title="AI Training"
        description="Working AI fluency is fast becoming table stakes across every function."
      >
        <AiTrainingTiers
          defaultTier={plan.aiTrainingTier}
          coursesByLevel={plan.aiTrainingCoursesByLevel}
          completedTitles={completedTitles}
          enrolledTitles={enrolledTitles}
        />
      </LearningSection>

      {isPivotingProfile({ ...profile, journey: effectiveJourney(profile) }) && (
        <OccupationTrendsCard currentFunction={profile.primaryFunction} targetFunction={profile.targetFunction} />
      )}

      <PayChangeCard />

      <GradDegreeGuardrailCard />

      <LockedPreview locked={assessmentLocked}>
        <div className="space-y-8">
          <LearningSection title="Tools">
            <ToolsForRoleSection
              role={plan.contentFunction}
              tools={plan.aiTools}
              functionTraining={plan.functionTraining}
              completedTitles={completedTitles}
              enrolledTitles={enrolledTitles}
            />
          </LearningSection>

          {plan.sections
            .filter((s) => s.id !== 'speaking-leadership')
            .map((s) => renderSection(s, completedTitles, enrolledTitles))}
        </div>
      </LockedPreview>

      <LearningSection title="Interview Skills">
        <InterviewSkillsSection data={plan.interviewSkills} />
      </LearningSection>

      {plan.sections
        .filter((s) => s.id === 'speaking-leadership')
        .map((s) => renderSection(s, completedTitles, enrolledTitles))}

      {badges.length > 0 && (
        <div className="pt-2">
          <h3 className="text-sm font-medium text-muted-foreground">What you&apos;ve completed</h3>
          <LearningBadgeList badges={badges} />
        </div>
      )}

      <GuideCallout currentJobStatus={profile.currentJobStatus} title="Guides for your situation" />
    </div>
  )
}

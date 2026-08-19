import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
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
import { AiTrainingTiers } from '@/components/dashboard/learning/AiTrainingTiers'
import { ToolsForRoleSection } from '@/components/dashboard/learning/ToolsForRoleSection'
import { InterviewSkillsSection } from '@/components/dashboard/learning/InterviewSkillsSection'
import { TierSummaryCard } from '@/components/dashboard/TierSummaryCard'
import { badgeCountToTier } from '@/lib/learning/badge-count-tier'
import { computeBadgeTypeMix } from '@/lib/learning/badge-type-mix'
import type { LearningPlanSection } from '@/lib/learning/build-learning-plan'
import { SkillsInventoryGateCard } from '@/components/dashboard/learning/SkillsInventoryGateCard'

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

export default async function LearningPage() {
  const profile = await getDashboardData()
  const weekStart = getMondayOfWeek(new Date())
  const [plan, badges, courseActivity, learningEvents, assessmentResponseCount] = await Promise.all([
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
  ])
  const hasTakenAssessment = assessmentResponseCount > 0
  const badgeMix = computeBadgeTypeMix(badges.map((b) => b.badgeType))

  const completedTitles = new Set(badges.map((b) => b.title))
  const enrolledTitles = new Set(courseActivity.map((c) => c.courseTitle))
  const learningEventsThisWeek = learningEvents.filter((e) => e.startTime >= weekStart)
  const learningMinutesThisWeek = learningEventsThisWeek.reduce((sum, e) => sum + (e.durationMinutes ?? 0), 0)

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
        {!profile.skillsAssessmentCompletedAt && <SkillsInventoryGateCard />}
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

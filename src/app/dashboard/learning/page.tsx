import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { buildLearningPlan } from '@/lib/learning/build-learning-plan'
import { captureServerEvent } from '@/lib/posthog/server'
import { getMondayOfWeek } from '@/lib/weekly/sprint'
import { formatMinutes } from '@/lib/weekly/action-effort'
import { SprintActionCompletion } from '@/components/dashboard/SprintActionCompletion'
import { LearningBadgeList } from '@/components/dashboard/LearningBadgeList'
import { LearningSection } from '@/components/dashboard/learning/LearningSection'
import { LearningResourceCard } from '@/components/dashboard/learning/LearningResourceCard'
import { AiTrainingTiers } from '@/components/dashboard/learning/AiTrainingTiers'
import { AiContextBanner } from '@/components/dashboard/learning/AiContextBanner'
import { ToolsForRoleSection } from '@/components/dashboard/learning/ToolsForRoleSection'
import { InterviewSkillsSection } from '@/components/dashboard/learning/InterviewSkillsSection'
import type { LearningPlanSection } from '@/lib/learning/build-learning-plan'

export const metadata: Metadata = { title: 'Learning & Training' }


function renderSection(section: LearningPlanSection, completedTitles: Set<string>) {
  return (
    <LearningSection key={section.id} title={section.title}>
      <div className="grid gap-3 sm:grid-cols-2">
        {section.items.map((item) => (
          <LearningResourceCard
            key={item.title}
            item={item}
            section={section.id}
            completed={completedTitles.has(item.title)}
          />
        ))}
      </div>
    </LearningSection>
  )
}

export default async function LearningPage() {
  const profile = await getDashboardData()
  const weekStart = getMondayOfWeek(new Date())
  const [plan, badges, learningEvents] = await Promise.all([
    buildLearningPlan(profile.id),
    prisma.learningBadge.findMany({
      where: { candidateId: profile.id },
      orderBy: { completedAt: 'desc' },
    }),
    prisma.trackedCalendarEvent.findMany({
      where: { candidateId: profile.id, eventType: 'LEARNING', dismissedAt: null },
      select: { startTime: true, durationMinutes: true },
    }),
  ])

  const completedTitles = new Set(badges.map((b) => b.title))
  const learningEventsThisWeek = learningEvents.filter((e) => e.startTime >= weekStart)
  const learningMinutesThisWeek = learningEventsThisWeek.reduce((sum, e) => sum + (e.durationMinutes ?? 0), 0)

  captureServerEvent(profile.id, 'learning_plan_rendered', {
    sectionCount: plan.sections.length,
    itemCount: plan.sections.reduce((sum, s) => sum + s.items.length, 0) + plan.aiTrainingCourses.length,
    aiTierDefault: plan.aiTrainingTier,
    hasGapRationale: plan.sections.some((s) => s.items.some((i) => !!i.rationale)),
  })

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Learning &amp; Training</h1>
        <p className="mt-1 text-muted-foreground">
          Curated resources for closing a real skills gap — not a link dump. Personalized to your
          background, goals, and Hireability Report.
        </p>
        <SprintActionCompletion
          candidateId={profile.id}
          actionTypes={['LEARNING_MODULE', 'LEARNING_CERTIFICATE', 'LEARNING_NEW_TOOL', 'LEARNING_SESSION_ATTENDED']}
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

      <AiContextBanner
        tier={plan.aiTrainingTier}
        role={plan.contentFunction}
        dismissedAlready={plan.aiContextBannerDismissed}
      />

      <LearningSection
        title="AI Training"
        description="Working AI fluency is fast becoming table stakes across every function."
      >
        <AiTrainingTiers
          defaultTier={plan.aiTrainingTier}
          defaultCourses={plan.aiTrainingCourses}
          completedTitles={completedTitles}
        />
      </LearningSection>

      <LearningSection title="Tools">
        <ToolsForRoleSection
          role={plan.contentFunction}
          tools={plan.aiTools}
          functionTraining={plan.functionTraining}
          completedTitles={completedTitles}
        />
      </LearningSection>

      {plan.sections.filter((s) => s.id !== 'speaking-leadership').map((s) => renderSection(s, completedTitles))}

      <LearningSection title="Interview Skills">
        <InterviewSkillsSection data={plan.interviewSkills} />
      </LearningSection>

      {plan.sections.filter((s) => s.id === 'speaking-leadership').map((s) => renderSection(s, completedTitles))}

      {badges.length > 0 && (
        <div className="pt-2">
          <h3 className="text-sm font-medium text-muted-foreground">What you&apos;ve completed</h3>
          <LearningBadgeList badges={badges} />
        </div>
      )}
    </div>
  )
}

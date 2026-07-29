import { prisma } from '@/lib/prisma'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { buildLearningPlan } from '@/lib/learning/build-learning-plan'
import { captureServerEvent } from '@/lib/posthog/server'
import { SprintActionCompletion } from '@/components/dashboard/SprintActionCompletion'
import { LearningBadgeList } from '@/components/dashboard/LearningBadgeList'
import { LearningSection } from '@/components/dashboard/learning/LearningSection'
import { LearningResourceCard } from '@/components/dashboard/learning/LearningResourceCard'
import { SkillsStillNeededForm } from '@/components/dashboard/learning/SkillsStillNeededForm'
import { AiTrainingTiers } from '@/components/dashboard/learning/AiTrainingTiers'
import { AiProofPointExercise } from '@/components/dashboard/learning/AiProofPointExercise'
import { InterviewSkillsSection } from '@/components/dashboard/learning/InterviewSkillsSection'
import type { LearningPlanSection } from '@/lib/learning/build-learning-plan'

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
  const [plan, badges] = await Promise.all([
    buildLearningPlan(profile.id),
    prisma.learningBadge.findMany({
      where: { candidateId: profile.id },
      orderBy: { completedAt: 'desc' },
    }),
  ])

  const completedTitles = new Set(badges.map((b) => b.title))

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
          actionTypes={['LEARNING_MODULE', 'LEARNING_CERTIFICATE', 'LEARNING_NEW_TOOL']}
        />
      </div>

      <LearningSection
        title="What do you still feel like you need?"
        description="Tell us in your own words — it directly shapes why each recommendation below is here."
      >
        <SkillsStillNeededForm skillsStillNeeded={profile.skillsStillNeeded} />
      </LearningSection>

      <LearningSection
        title="AI Training"
        description="Working AI fluency is fast becoming table stakes across every function."
      >
        <div className="space-y-4">
          <AiTrainingTiers
            defaultTier={plan.aiTrainingTier}
            defaultCourses={plan.aiTrainingCourses}
            completedTitles={completedTitles}
          />
          <AiProofPointExercise
            primaryFunction={profile.primaryFunction}
            aiTools={plan.aiTools}
            aiWorkflow={plan.aiWorkflow}
          />
        </div>
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

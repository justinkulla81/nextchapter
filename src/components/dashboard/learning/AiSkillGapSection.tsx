import { loadAiSkillGap } from '@/lib/ai-skills/load'
import { AI_LEVELS, AI_ROLE_TIERS } from '@/lib/ai-skills/taxonomy'
import { toLearningResource } from '@/lib/learning/courses'
import { captureServerEvent } from '@/lib/posthog/server'
import { LearningSection } from '@/components/dashboard/learning/LearningSection'
import { LearningResourceCard } from '@/components/dashboard/learning/LearningResourceCard'
import type { LearningPlanItem } from '@/lib/learning/build-learning-plan'

const levelLabel = (k: string | null) => AI_LEVELS.find((l) => l.key === k)?.label ?? 'None yet'

const STATUS_TEXT = {
  missing: { chip: 'Not yet', cls: 'bg-amber-500/10 text-amber-700 dark:text-amber-400' },
  build: { chip: 'Build up', cls: 'bg-sky-500/10 text-sky-700 dark:text-sky-400' },
  covered: { chip: 'You have this', cls: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' },
} as const

// The AI skills the person's best-fit jobs ask for, how they compare, and a course for each gap.
// Counts come from the postings themselves (fixed vocabulary, no AI call); levels are our reading
// of the posting's wording and of the person's evidence, so the copy says "usually" and "we see".
export async function AiSkillGapSection({ candidateId, completedTitles, enrolledTitles }: { candidateId: string; completedTitles: Set<string>; enrolledTitles: Set<string> }) {
  const data = await loadAiSkillGap(candidateId)
  if (!data) return null
  const { gap, courses } = data
  captureServerEvent(candidateId, 'ai_skill_gap_viewed', {
    jobsRead: gap.jobsRead,
    jobsWithAi: gap.jobsWithAi,
    gapSkills: gap.rows.filter((r) => r.status !== 'covered').map((r) => r.key),
    coveredSkills: gap.rows.filter((r) => r.status === 'covered').map((r) => r.key),
  })

  if (gap.jobsWithAi === 0 || gap.rows.length === 0) {
    return (
      <LearningSection title="AI skills for your search" description="What AI the jobs that fit you ask for.">
        <p className="text-sm text-muted-foreground">
          None of your {gap.jobsRead} best-fit jobs spell out AI skills right now, so AI isn’t what’s holding this search back. The courses below are still useful for staying ahead.
        </p>
      </LearningSection>
    )
  }

  const share = Math.round((gap.jobsWithAi / gap.jobsRead) * 100)
  const mainTier = AI_ROLE_TIERS.find((t) => t.key === (Object.entries(gap.tiers).sort((a, b) => b[1] - a[1])[0][0]))
  return (
    <LearningSection
      id="ai-skills-for-your-search"
      title="AI skills for your search"
      description={`${gap.jobsWithAi} of your ${gap.jobsRead} best-fit jobs (${share}%) name AI skills${mainTier ? `, mostly roles that ${mainTier.label.toLowerCase()}` : ''}. Here is what they ask for and where you stand.`}
    >
      <div className="space-y-4">
        {gap.rows.map((r) => {
          const picks = courses[r.key] ?? []
          return (
            <div key={r.key} className="space-y-2 rounded-lg border border-border p-4">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold">{r.label}</h3>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_TEXT[r.status].cls}`}>{STATUS_TEXT[r.status].chip}</span>
              </div>
              <p className="text-sm text-muted-foreground">{r.summary}</p>
              <p className="text-xs text-muted-foreground">
                {r.askedBy} of {gap.jobsWithAi} AI-related jobs ask for it, usually at {levelLabel(r.requiredLevel)} level. We see you at: {levelLabel(r.haveLevel)}.
              </p>
              {picks.length > 0 && (
                <div className="flex gap-4 overflow-x-auto pb-2">
                  {picks.map((c) => {
                    const item: LearningPlanItem = { ...toLearningResource(c), rationale: `Moves you toward ${levelLabel(r.requiredLevel)} in ${r.label.toLowerCase()}.`, completionCount: 0, alreadyHeld: false }
                    return <LearningResourceCard key={c.id} item={item} section="ai-skill-gap" completed={completedTitles.has(c.title)} enrolled={enrolledTitles.has(c.title)} carousel />
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </LearningSection>
  )
}

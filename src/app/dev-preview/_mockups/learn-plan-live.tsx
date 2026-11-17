import { PreviewShell } from '@/components/candidate/PreviewShell'
import { LearnHome } from '@/components/dashboard/LearnHome'
import type { LearningPlanItem } from '@/lib/learning/build-learning-plan'
import type { PlanEntryView } from '@/components/dashboard/learning/PlanControls'

// The REAL Learn page (LearnHome) with the learning plan, fed sample data. Dev-only: src/app/dev-preview is never reachable in production.
// Adds "Add to my plan" on each course and a "Your plan" section; the row buttons "See the course" are gone (the title is the link).

const item = (title: string, provider: string, free: boolean, rationale: string | null, description = 'A short course.'): LearningPlanItem => ({
  title,
  description,
  url: 'https://example.com/course',
  provider: provider as LearningPlanItem['provider'],
  free,
  actionType: 'LEARNING_MODULE',
  rationale,
  completionCount: 0,
  alreadyHeld: false,
})

const featured = item('Learn supply chain analytics', 'coursera', true, '18 of the 40 jobs that fit you ask for it, and you have not shown it yet. A short course closes that.')
const more = [
  item('Python for operations', 'coursera', true, '11 jobs that fit you ask for it.'),
  item('Lean Six Sigma green belt', 'edx', false, '9 jobs that fit you ask for it.'),
  item('Presenting to a board', 'coursera', true, '7 jobs that fit you ask for it.'),
]
const day = (n: number) => new Date(Date.UTC(2026, 10, n))
const plan: PlanEntryView[] = [
  { id: '1', title: 'Learn supply chain analytics', provider: 'Coursera', url: 'https://example.com/course', status: 'STARTED', createdAt: day(14) },
  { id: '2', title: 'Lean Six Sigma green belt', provider: 'ASQ', url: 'https://example.com/course', status: 'PLANNED', createdAt: day(15) },
]

export function LearnPlanEmptyLive() {
  return (
    <PreviewShell place="learn" entry="learn" part="skills">
      <LearnHome featured={featured} more={more} enrolledTitles={new Set()} completedCount={0} allHref="#" plan={[]} />
    </PreviewShell>
  )
}

export function LearnPlanLive() {
  return (
    <PreviewShell place="learn" entry="learn" part="skills">
      <LearnHome featured={featured} more={more} enrolledTitles={new Set(['Learn supply chain analytics'])} completedCount={2} allHref="#" plan={plan} countedBy={['One Louisville']} />
    </PreviewShell>
  )
}

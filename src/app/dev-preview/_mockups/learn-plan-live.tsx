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

// Sample data uses real Louisville programs (University of Louisville online graduate certificates), so a regional demo shows local
// training first. Checked Nov 18, 2026 on catalog.louisville.edu.
const UOFL = 'University of Louisville'
const featured = item('Engineering logistics graduate certificate', UOFL, false, '18 of the 40 jobs that fit you ask for supply chain and logistics skills, and you have not shown them yet.')
const more = [
  item('Six Sigma graduate certificate', UOFL, false, '9 jobs that fit you ask for it.'),
  item('Python for operations', 'coursera', true, '11 jobs that fit you ask for it.'),
  item('Presenting to a board', 'coursera', true, '7 jobs that fit you ask for it.'),
]
const day = (n: number) => new Date(Date.UTC(2026, 10, n))
const plan: PlanEntryView[] = [
  { id: '1', title: 'Engineering logistics graduate certificate', provider: UOFL, url: 'https://example.com/course', status: 'STARTED', createdAt: day(14) },
  { id: '2', title: 'Six Sigma graduate certificate', provider: UOFL, url: 'https://example.com/course', status: 'PLANNED', createdAt: day(15) },
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
      <LearnHome featured={featured} more={more} enrolledTitles={new Set(['Engineering logistics graduate certificate'])} completedCount={2} allHref="#" plan={plan} countedBy={['One Louisville']} />
    </PreviewShell>
  )
}

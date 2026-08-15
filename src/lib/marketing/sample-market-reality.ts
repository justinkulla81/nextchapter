// Synthetic (not-a-real-candidate) data shaped exactly like the real
// MarketRealityOverview component's props — Partners Master Build Script
// §C3.1 ("proof of the diagnosis... an anonymized sample Market Reality
// Report. Real output beats any description.") and §C3.2 ("every landing
// page needs one concrete real artifact"). This feeds the actual
// `MarketRealityOverview` component (src/components/dashboard/
// MarketRealityOverview.tsx) rather than a screenshot or a hand-rolled
// lookalike — the visitor sees the literal component a real candidate sees,
// just with invented numbers for a fictional "Jordan M."
import type { CategoryGrade } from '@/lib/scoring/grade'
import type { CategoryMover } from '@/lib/scoring/market-reality-history'

export const SAMPLE_CANDIDATE_LABEL = 'Jordan M., VP Operations (sample)'

export const SAMPLE_CATEGORIES: CategoryGrade[] = [
  { key: 'targetFit', label: 'Target Fit', score: 58, grade: 'C', confidence: 'BUILDING' },
  { key: 'leadership', label: 'Leadership & Management', score: 79, grade: 'B', confidence: 'HIGH' },
  { key: 'skillsExecution', label: 'Skills & Execution', score: 61, grade: 'C', confidence: 'HIGH' },
  {
    key: 'communication',
    label: 'Communication & Collaboration',
    score: 44,
    grade: 'C',
    confidence: 'PROVISIONAL',
  },
  { key: 'adaptability', label: 'Adaptability & Change Readiness', score: 82, grade: 'B', confidence: 'HIGH' },
  { key: 'ownership', label: 'Ownership & Reliability', score: 88, grade: 'B', confidence: 'HIGH' },
]

export const SAMPLE_CATEGORY_HISTORY = new Map<CategoryGrade['key'], number[]>([
  ['targetFit', [42, 48, 51, 58]],
  ['leadership', [70, 72, 75, 79]],
  ['skillsExecution', [55, 55, 58, 61]],
  ['communication', [40, 41, 43, 44]],
  ['adaptability', [74, 76, 79, 82]],
  ['ownership', [80, 83, 85, 88]],
])

export const SAMPLE_WHAT_MOVED: CategoryMover[] = [
  { key: 'targetFit', label: 'Target Fit', direction: 'up', fromGrade: 'C', toGrade: 'C' },
  { key: 'leadership', label: 'Leadership & Management', direction: 'up', fromGrade: 'C', toGrade: 'B' },
]

export const SAMPLE_MARKET_REALITY_PROPS = {
  weekLabel: 'Week of August 10',
  currentGrade: 'C' as const,
  previousGrade: 'C' as const,
  bestWeekSentence: 'Best week yet: two references completed and a new target named.',
  categories: SAMPLE_CATEGORIES,
  categoryHistory: SAMPLE_CATEGORY_HISTORY,
  whatMoved: SAMPLE_WHAT_MOVED,
  archiveSnapshots: [],
}

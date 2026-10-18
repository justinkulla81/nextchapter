// What someone who is staying (or going for a promotion) wants from their career:
// the next review, the next level, whether it is pay or title, and whether they may
// leave. Stored in journeyDetails.career so it survives journey changes and needs no
// schema change. Pure and client-safe. Managing my career had 7 questions against
// about 25 for a job search; these are the ones its plan, its employer buyers and its
// college offer need.

export const CAREER_FOCUS = [
  { key: 'pay', label: 'Better pay' },
  { key: 'level', label: 'The next level' },
  { key: 'both', label: 'Both' },
] as const
export type CareerFocus = (typeof CAREER_FOCUS)[number]['key']

export const CAREER_INTENT = [
  { key: 'stay', label: 'Stay and grow here' },
  { key: 'move_up', label: 'Move up, here or elsewhere' },
  { key: 'maybe_leave', label: 'I may leave within a year' },
] as const
export type CareerIntent = (typeof CAREER_INTENT)[number]['key']

export type CareerDetails = { reviewDate?: string; nextLevel?: string; focus?: CareerFocus; intent?: CareerIntent }

const DATE = /^\d{4}-\d{2}-\d{2}$/

export function careerOf(details: unknown): CareerDetails | null {
  const v = (details as { career?: Record<string, unknown> } | null)?.career
  if (!v || typeof v !== 'object') return null
  const out: CareerDetails = {}
  if (typeof v.reviewDate === 'string' && DATE.test(v.reviewDate)) out.reviewDate = v.reviewDate
  if (typeof v.nextLevel === 'string' && v.nextLevel.trim()) out.nextLevel = v.nextLevel.trim().slice(0, 120)
  if (CAREER_FOCUS.some((f) => f.key === v.focus)) out.focus = v.focus as CareerFocus
  if (CAREER_INTENT.some((i) => i.key === v.intent)) out.intent = v.intent as CareerIntent
  return Object.keys(out).length ? out : null
}

export function buildCareer(input: { reviewDate?: string | null; nextLevel?: string | null; focus?: string | null; intent?: string | null }): CareerDetails {
  return careerOf({ career: input }) ?? {}
}

export function isCareerAnswered(c: CareerDetails | null): boolean {
  return !!c && !!c.intent && !!c.focus
}

export type CareerPlanItem = { text: string; actionType?: string }

const DAY = 86_400_000

export function careerPlanItems(c: CareerDetails | null, skillsToBuild: string[], now = new Date()): CareerPlanItem[] {
  if (!c) return []
  const out: CareerPlanItem[] = []
  if (c.reviewDate) {
    const days = Math.ceil((new Date(`${c.reviewDate}T12:00:00Z`).getTime() - now.getTime()) / DAY)
    if (days >= 0 && days <= 56) out.push({ text: `Your review is in ${days <= 7 ? 'about a week' : `${Math.round(days / 7)} weeks`}: write down your wins and what you will ask for` })
  }
  if (c.nextLevel) out.push({ text: `Name the gap between your role and ${c.nextLevel}: three things you lack, and a plan for each` })
  if (c.focus === 'pay' || c.focus === 'both') out.push({ text: 'Benchmark your pay against the market before your next pay conversation' })
  if (c.intent === 'maybe_leave') out.push({ text: 'You may leave within a year: keep your résumé and two references ready', actionType: 'RESUME_UPDATE' })
  if (skillsToBuild[0]) out.push({ text: `Make progress on ${skillsToBuild[0].replace(/_/g, ' ')}, the skill you said you want to build`, actionType: 'LEARNING_MODULE' })
  return out
}

// Shared view-model types for the Market Reality Report. Plain types only (no
// Prisma, no server-only) so client components and tests can import them.

export type Assessment = 'strength' | 'adequate' | 'development' | 'not_assessed'

// Neutral rating words, in the register of a consulting assessment. Never
// colored and never a score: the report reads as a professional document,
// not a game.
export const ASSESSMENT_LABEL: Record<Assessment, string> = {
  strength: 'Strength',
  adequate: 'Adequate',
  development: 'Development area',
  not_assessed: 'Not assessed',
}

export type BriefArea = 'Market' | 'Experience' | 'Resume' | 'Skills' | 'Search activity' | 'Profile'

export interface PriorityAction {
  key: string
  area: BriefArea
  title: string
  /** The evidence behind the action, in one or two sentences. */
  rationale: string
  href: string
  /** Label for the link ("Open the resume editor"). */
  cta: string
  /** Ordering only, 0-100. Never shown. */
  weight: number
}

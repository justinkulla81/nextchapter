export const CATEGORY_ORDER = ['RELOCATION', 'STATE_TRAINING', 'FEDERAL', 'COURSES', 'PRIVATE', 'SEGMENT'] as const
export type BenefitCategory = (typeof CATEGORY_ORDER)[number]

export const CATEGORY_LABELS: Record<BenefitCategory, string> = {
  RELOCATION: 'Relocation incentives',
  STATE_TRAINING: 'State retraining and tuition',
  FEDERAL: 'Federal programs',
  COURSES: 'Free courses and certificates',
  PRIVATE: 'Private, nonprofit and AI funds',
  SEGMENT: 'By profession and employer incentives',
}

export const STATUSES = ['OPEN', 'ROLLING', 'CLOSED', 'UNKNOWN'] as const

export interface BenefitProgramRow {
  id: string
  category: BenefitCategory
  name: string
  provider: string | null
  scope: 'NATIONAL' | 'STATE' | 'LOCAL'
  state: string | null
  locality: string | null
  amount: string | null
  eligibility: string | null
  status: (typeof STATUSES)[number]
  statusNote: string | null
  url: string | null
  segments: string[]
  verified: boolean
  checkedAt: Date | null
  source: string | null
}

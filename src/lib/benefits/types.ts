export const CATEGORY_ORDER = ['RELOCATION', 'STATE_TRAINING', 'FEDERAL', 'COURSES', 'PRIVATE', 'SEGMENT', 'PAID', 'TAX', 'SUPPORT'] as const
export type BenefitCategory = (typeof CATEGORY_ORDER)[number]

export const CATEGORY_LABELS: Record<BenefitCategory, string> = {
  RELOCATION: 'Relocation incentives',
  STATE_TRAINING: 'State retraining and tuition',
  FEDERAL: 'Federal programs',
  COURSES: 'Free courses and certificates',
  PRIVATE: 'Private, nonprofit and AI funds',
  SEGMENT: 'By profession, group and employer',
  PAID: 'Paid to learn, return or retrain',
  TAX: 'Tax credits and deductions',
  SUPPORT: 'Money and cost relief while out of work',
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
  city: string | null
  employer: string | null
  employerKey: string | null
  geoAreaId: string | null
  /** Direct application page, when different from the program page. Optional so older rows stay valid. */
  applyUrl?: string | null
  /** Softer fit signals for ranking (a faith, a heritage, a life stage). Never a gate. */
  affinity?: string[]
}

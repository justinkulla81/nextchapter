// Plain constants for Benefits Network filter facets (§A4.3: "filterable by
// function, level, format, cost, time commitment, credential type") — free
// text on the model (same "no premature enum" judgment call as
// ExclusiveJobPosting.level/sourceCategory), fixed option lists here so the
// propose form and catalog filter bar both offer the same controlled
// vocabulary instead of alumni inventing ad hoc values.

export const BENEFITS_NETWORK_FUNCTIONS = [
  'Finance',
  'Marketing',
  'Operations',
  'Technology',
  'Sales',
  'HR / People',
  'General Management',
  'Any function',
] as const

export const BENEFITS_NETWORK_LEVELS = ['Manager', 'Director', 'VP', 'C-Suite', 'Any level'] as const

export const BENEFITS_NETWORK_FORMATS = ['Self-paced', 'Live cohort', 'Hybrid', 'In-person'] as const

export const BENEFITS_NETWORK_COST_TYPES = ['Free', 'Discounted', 'Waived application fee'] as const

export const BENEFITS_NETWORK_TIME_COMMITMENTS = [
  'Under 5 hours',
  '5-20 hours',
  '20-50 hours',
  '50+ hours',
] as const

export const BENEFITS_NETWORK_CREDENTIAL_TYPES = ['Certificate', 'Badge', 'Degree credit', 'None'] as const

export const BENEFITS_NETWORK_REDEMPTION_METHODS: { value: 'CODE' | 'LINK' | 'EMAIL_INTRO'; label: string }[] = [
  { value: 'CODE', label: 'Discount code' },
  { value: 'LINK', label: 'Direct link' },
  { value: 'EMAIL_INTRO', label: 'Email introduction' },
]

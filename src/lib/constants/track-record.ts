import type {
  TrackRecordSizeBand,
  TrackRecordDollarBand,
  TrackRecordTenureBand,
  TrackRecordBoardExposure,
  TrackRecordPnlAccountability,
  TrackRecordGeographicScope,
  TrackRecordReportedToLevel,
} from '@prisma/client'

// Track Record (spec §4.2) — content constants for the 20-item structured
// form. Band cutoffs are new inventions (no existing convention in this
// codebase covers team size, budget, or initiative-scope bands — see the
// Phase 9 investigation) but follow the same enum + label-map idiom as
// GapDurationBucket/GAP_DURATION_LABELS.

export const TRACK_RECORD_SIZE_BAND_LABELS: Record<TrackRecordSizeBand, string> = {
  NONE: 'None',
  ONE_TO_FIVE: '1-5',
  SIX_TO_TWENTY: '6-20',
  TWENTY_ONE_TO_FIFTY: '21-50',
  FIFTY_ONE_TO_TWO_HUNDRED: '51-200',
  TWO_HUNDRED_PLUS: '200+',
}
export const TRACK_RECORD_SIZE_BAND_ORDER: TrackRecordSizeBand[] = [
  'NONE',
  'ONE_TO_FIVE',
  'SIX_TO_TWENTY',
  'TWENTY_ONE_TO_FIFTY',
  'FIFTY_ONE_TO_TWO_HUNDRED',
  'TWO_HUNDRED_PLUS',
]

export const TRACK_RECORD_DOLLAR_BAND_LABELS: Record<TrackRecordDollarBand, string> = {
  NONE: 'None',
  UNDER_100K: 'Under $100K',
  ONE_HUNDRED_K_TO_1M: '$100K-$1M',
  ONE_M_TO_10M: '$1M-$10M',
  TEN_M_TO_100M: '$10M-$100M',
  OVER_100M: '$100M+',
}
export const TRACK_RECORD_DOLLAR_BAND_ORDER: TrackRecordDollarBand[] = [
  'NONE',
  'UNDER_100K',
  'ONE_HUNDRED_K_TO_1M',
  'ONE_M_TO_10M',
  'TEN_M_TO_100M',
  'OVER_100M',
]

export const TRACK_RECORD_TENURE_BAND_LABELS: Record<TrackRecordTenureBand, string> = {
  UNDER_ONE_YEAR: 'Under 1 year',
  ONE_TO_TWO_YEARS: '1-2 years',
  TWO_TO_FOUR_YEARS: '2-4 years',
  FOUR_TO_SEVEN_YEARS: '4-7 years',
  SEVEN_PLUS_YEARS: '7+ years',
}
export const TRACK_RECORD_TENURE_BAND_ORDER: TrackRecordTenureBand[] = [
  'UNDER_ONE_YEAR',
  'ONE_TO_TWO_YEARS',
  'TWO_TO_FOUR_YEARS',
  'FOUR_TO_SEVEN_YEARS',
  'SEVEN_PLUS_YEARS',
]

export const TRACK_RECORD_BOARD_EXPOSURE_LABELS: Record<TrackRecordBoardExposure, string> = {
  NONE: 'None',
  PRESENTED_TO: 'Presented to a board',
  MEMBER_OF: 'Member of a board',
}

export const TRACK_RECORD_PNL_LABELS: Record<TrackRecordPnlAccountability, string> = {
  PNL: 'Full P&L',
  BUDGET: 'Budget only',
  NEITHER: 'Neither',
}

export const TRACK_RECORD_GEOGRAPHIC_SCOPE_LABELS: Record<TrackRecordGeographicScope, string> = {
  SINGLE_SITE: 'Single site',
  MULTI_SITE: 'Multi-site',
  MULTI_COUNTRY: 'Multi-country',
}

export const TRACK_RECORD_REPORTED_TO_LABELS: Record<TrackRecordReportedToLevel, string> = {
  MANAGER: 'Manager',
  DIRECTOR: 'Director',
  VP: 'VP',
  C_SUITE: 'C-suite (non-CEO)',
  CEO: 'CEO',
  BOARD: 'Board',
}

// Item 4 — multi-select, "which could you approve without escalation"
export const APPROVAL_AUTHORITY_OPTIONS = [
  { value: 'HIRING', label: 'Hiring' },
  { value: 'SPEND_ABOVE_THRESHOLD', label: 'Spend above a threshold' },
  { value: 'PRICING', label: 'Pricing' },
  { value: 'VENDOR_SELECTION', label: 'Vendor selection' },
  { value: 'PRODUCT_SCOPE', label: 'Product scope' },
  { value: 'ORG_STRUCTURE', label: 'Org structure' },
  { value: 'NONE', label: 'None of these' },
] as const

// Item 5 — rank these 4 by how often you've operated this way, most to
// least. Stored as an ordered array of these values.
export const OPERATING_SITUATION_OPTIONS = [
  { value: 'BUILD_FROM_ZERO', label: 'Build from zero' },
  { value: 'SCALE_WHAT_EXISTS', label: 'Scale what exists' },
  { value: 'FIX_WHAT_S_BROKEN', label: "Fix what's broken" },
  { value: 'RUN_STEADY_STATE', label: 'Run steady-state' },
] as const

// Item 7 — functions owned outside core discipline
export const CROSS_FUNCTIONAL_AREA_OPTIONS = [
  { value: 'MARKETING', label: 'Marketing' },
  { value: 'SALES', label: 'Sales' },
  { value: 'FINANCE', label: 'Finance' },
  { value: 'HR', label: 'HR' },
  { value: 'LEGAL', label: 'Legal' },
  { value: 'IT', label: 'IT' },
  { value: 'OPERATIONS', label: 'Operations' },
  { value: 'PRODUCT', label: 'Product' },
  { value: 'ENGINEERING', label: 'Engineering' },
  { value: 'CUSTOMER_SUCCESS', label: 'Customer Success' },
] as const

// Item 11 — sector and stage history, two independent multi-selects
export const INDUSTRY_SECTOR_OPTIONS = [
  { value: 'TECH', label: 'Tech' },
  { value: 'HEALTHCARE', label: 'Healthcare' },
  { value: 'FINANCE', label: 'Finance' },
  { value: 'RETAIL', label: 'Retail' },
  { value: 'MANUFACTURING', label: 'Manufacturing' },
  { value: 'MEDIA', label: 'Media' },
  { value: 'EDUCATION', label: 'Education' },
  { value: 'GOVERNMENT', label: 'Government' },
  { value: 'NONPROFIT', label: 'Nonprofit' },
  { value: 'ENERGY', label: 'Energy' },
  { value: 'OTHER', label: 'Other' },
] as const

export const COMPANY_STAGE_HISTORY_OPTIONS = [
  { value: 'STARTUP', label: 'Startup' },
  { value: 'GROWTH', label: 'Growth' },
  { value: 'ENTERPRISE', label: 'Enterprise' },
  { value: 'TURNAROUND', label: 'Turnaround' },
] as const

export const MANDATE_CLARITY_LABELS = [
  'Vague — I had to define it myself',
  'Loosely defined',
  'Mostly clear',
  'Fully clear from day one',
] as const

export const DROVE_OUTCOMES_LABELS = [
  'Rarely',
  'Sometimes',
  'Often',
  'Constantly — most of my impact works this way',
] as const

export interface AdzunaResult {
  status: 'success' | 'not_configured' | 'fetch_failed'
  count: number | null
  error: string | null
}

export interface BlsResult {
  status: 'success' | 'unavailable' | 'fetch_failed'
  socCode: string | null
  areaCode: string | null
  yoyChangePct: number | null
  error: string | null
}

export interface MarketConditionsInput {
  roleType: string | null
  primaryFunction: string | null
  city: string | null
  state: string | null
  // Optional so existing callers that only need the broader title-only
  // count keep compiling unchanged — omitting this simply means no
  // ideal-count query runs (adzunaIdealCount comes back null, not zero).
  targetIndustries?: string[]
  // Level-synonym breadth for the Adzuna query (level-groups.ts) — optional,
  // same backward-compatible convention as targetIndustries above. Omitting
  // this preserves every existing caller's exact current behavior; only
  // market.ts (Market Reality Grade) passes it today.
  levelGroup?: 'SENIOR_LEADERSHIP' | 'DIRECTOR' | 'MANAGER' | null
  // Words to exclude from the title match — used for a bare ambiguous
  // level word like "Partner" (level-groups.ts), to filter out staff-
  // qualified variants a plain title-only search can't otherwise tell
  // apart from a genuine senior title.
  whatExclude?: string[]
}

export interface MarketConditions {
  dataAvailable: boolean
  adzunaCount: number | null // "broader" — title-only match count
  adzunaError: string | null
  adzunaIdealCount: number | null // "ideal" — title AND industry AND geo; null when industry or geo unknown
  adzunaIdealError: string | null
  blsSocCode: string | null
  blsAreaCode: string | null
  blsYoyChangePct: number | null
  blsError: string | null
  fromCache: boolean
}

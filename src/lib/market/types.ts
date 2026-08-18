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

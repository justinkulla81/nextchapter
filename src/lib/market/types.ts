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
}

export interface MarketConditions {
  dataAvailable: boolean
  adzunaCount: number | null
  adzunaError: string | null
  blsSocCode: string | null
  blsAreaCode: string | null
  blsYoyChangePct: number | null
  blsError: string | null
  fromCache: boolean
}

export type ElementKind = 'SKILL' | 'KNOWLEDGE' | 'TECHNOLOGY'

export interface OccupationElement {
  name: string
  kind: ElementKind
  // O*NET ratings rescaled to 0-100. Technology rows have no level.
  importance: number
  level: number | null
  hotTech: boolean
}

export interface OccupationProfile {
  socCode: string
  title: string
  jobZone: number | null
  medianWage: number | null
  employment: number | null
  growthPct: number | null
  annualOpenings: number | null
  typicalEducation: string | null
  // Keyed by Skill id.
  elements: Map<string, OccupationElement>
  // O*NET's own curated related-occupation codes, closest first.
  relatedSocCodes: string[]
}

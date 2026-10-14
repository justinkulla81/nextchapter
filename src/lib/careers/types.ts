// SKILL, KNOWLEDGE, ABILITY and ACTIVITY (work activity) are O*NET's rated scales; TECHNOLOGY is its
// list of named software and tools. ABILITY is inborn aptitude (like "Oral Comprehension") and is used to
// compare occupations but never offered as something to build.
export type ElementKind = 'SKILL' | 'KNOWLEDGE' | 'ABILITY' | 'ACTIVITY' | 'TECHNOLOGY'

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

// Plain shapes for the occupation skills layer. The Prisma tables (OnetOccupation and
// friends) load into these; everything in this folder is pure over them, so it is
// tested without a database (src/test/occupations-*.test.ts).

export type ElementKind = 'SKILL' | 'KNOWLEDGE' | 'ABILITY' | 'ACTIVITY'

export interface OccupationElement {
  kind: ElementKind
  elementId: string
  name: string
  /** O*NET importance (IM), 1-5. */
  importance: number
  /** O*NET level (LV), 0-7. */
  level: number
}

export interface OccupationTechSkill {
  example: string
  commodity?: string | null
  hotTechnology?: boolean
}

export interface OccupationProfile {
  /** O*NET-SOC code, e.g. "11-2021.00". */
  onetSocCode: string
  /** 6-digit SOC code, e.g. "11-2021" — the key BLS data joins on. */
  socCode: string
  title: string
  jobZone: number | null
  isTarget: boolean
  elements: OccupationElement[]
  techSkills: OccupationTechSkill[]
}

export interface OccupationPay {
  socCode: string
  medianWage: number | null
  /** BLS gives only a floor for the top of the scale; pay differences involving it are not shown. */
  topCoded: boolean
}

export interface OccupationOutlook {
  socCode: string
  changePct: number | null
  annualOpenings: number | null
}

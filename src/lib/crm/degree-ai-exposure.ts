import { OCCUPATION_TRENDS, type OccupationTrendRow } from '@/lib/market/occupation-trends-data'
import { exposureBand, type ExposureBand } from '@/lib/market/occupation-trends'

/**
 * The occupation group (SOC major group) each College Scorecard field of study mostly feeds.
 * Allowlist: a field not listed here, and the catch-alls (liberal arts, interdisciplinary, military),
 * are left unmapped rather than guessed. The labels are the ones scripts/geo/build_colleges.py writes
 * into CollegeProfile.topMajors.
 */
const FIELD_TO_SOC: Record<string, string> = {
  'Agriculture': '45', 'Natural resources': '19', 'Architecture': '17', 'Area/ethnic studies': '25',
  'Communication & journalism': '27', 'Communications technology': '27', 'Computer & information sciences': '15',
  'Personal & culinary services': '35', 'Education': '25', 'Engineering': '17', 'Engineering technologies': '17',
  'Foreign languages': '27', 'Family & consumer sciences': '39', 'Legal studies': '23', 'English': '27',
  'Library science': '25', 'Biological sciences': '19', 'Mathematics & statistics': '15',
  'Parks, recreation & fitness': '39', 'Philosophy & religion': '21', 'Theology': '21', 'Physical sciences': '19',
  'Science technologies': '19', 'Psychology': '21', 'Security & protective services': '33',
  'Public administration & social work': '21', 'Social sciences': '19', 'Construction trades': '47',
  'Mechanic & repair trades': '49', 'Precision production': '51', 'Transportation': '53',
  'Visual & performing arts': '27', 'Health professions': '29', 'Business & management': '13', 'History': '25',
}

export interface MajorExposure {
  field: string
  share: number
  occupationGroup: string | null
  aiExposure: number | null
  band: ExposureBand | null
  employmentChangePct: number | null
  longSearchSharePct: number | null
}

export interface DegreeExposure {
  majors: MajorExposure[]
  /** Share-weighted exposure across the majors that could be mapped, and how much of the top-five share that covers. */
  weightedExposure: number | null
  coveredShare: number
  highShare: number
}

export function degreeExposure(topMajors: { field: string; share: number }[] | null | undefined): DegreeExposure {
  const byGroup = new Map<string, OccupationTrendRow>(OCCUPATION_TRENDS.map((r) => [r.socGroup, r]))
  const majors: MajorExposure[] = (topMajors ?? []).map((m) => {
    const row = FIELD_TO_SOC[m.field] ? byGroup.get(FIELD_TO_SOC[m.field]) : undefined
    return {
      field: m.field, share: m.share,
      occupationGroup: row?.name ?? null, aiExposure: row?.aiExposure ?? null,
      band: row ? exposureBand(row.aiExposure) : null,
      employmentChangePct: row?.employmentChangePct ?? null, longSearchSharePct: row?.longSearchSharePct ?? null,
    }
  })
  const mapped = majors.filter((m) => m.aiExposure != null)
  const coveredShare = mapped.reduce((s, m) => s + m.share, 0)
  return {
    majors,
    weightedExposure: coveredShare > 0 ? mapped.reduce((s, m) => s + m.share * m.aiExposure!, 0) / coveredShare : null,
    coveredShare,
    highShare: mapped.filter((m) => m.band === 'HIGH').reduce((s, m) => s + m.share, 0),
  }
}

/**
 * The occupation group each job function in our postings mostly maps to. Our function labels are coarser than the occupation groups, so this is
 * our own rough match; "engineering" in particular mixes software (computer) and other engineering, and is matched to computer and math.
 */
const FUNCTION_TO_SOC: Record<string, string> = {
  marketing: '13', finance: '13', supply_chain: '13', hr: '13', legal: '23', sales: '41', operations: '11', engineering: '15', it: '15',
  data: '15', product: '11', design: '27', customer_success: '43', healthcare: '29',
}

export interface RoleMixExposure { weighted: number | null; coveredShare: number; highShare: number }

/** Exposure of a company's open-role mix: each function's occupation-group exposure, weighted by its share of the roles we could match. */
export function roleMixExposure(fns: { fn: string; roles: number }[]): RoleMixExposure {
  const byGroup = new Map(OCCUPATION_TRENDS.map((r) => [r.socGroup, r]))
  const total = fns.reduce((n, f) => n + f.roles, 0)
  const mapped = fns.map((f) => ({ roles: f.roles, row: FUNCTION_TO_SOC[f.fn] ? byGroup.get(FUNCTION_TO_SOC[f.fn]) : undefined })).filter((m) => m.row)
  const covered = mapped.reduce((n, m) => n + m.roles, 0)
  if (!total || !covered) return { weighted: null, coveredShare: 0, highShare: 0 }
  return {
    weighted: mapped.reduce((n, m) => n + m.roles * m.row!.aiExposure, 0) / covered,
    coveredShare: covered / total,
    highShare: mapped.filter((m) => exposureBand(m.row!.aiExposure) === 'HIGH').reduce((n, m) => n + m.roles, 0) / total,
  }
}

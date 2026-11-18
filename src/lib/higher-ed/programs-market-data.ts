import 'server-only'
import { collegeRecord } from '@/lib/higher-ed/peers'
import { loadCollegeMajors } from '@/lib/rankings/college-majors'
import { getDegreeFields, getDegreeFieldsOf, previousEdition } from '@/lib/rankings/store'
import { programsMarket, type CollegeIndex, type ProgramsMarket } from '@/lib/higher-ed/programs-market'

// The reads behind Academic Affairs: the college's federal record (one row by IPEDS id), two static federal files, and the
// stored degree-field rows (this month's and last month's, each an hourly per-instance copy). No scan.

let indexPromise: Promise<CollegeIndex> | null = null
const loadIndex = () => (indexPromise ??= import('@/lib/rankings/data/college-index.json').then((m) => m.default as unknown as CollegeIndex))

export type ProgramsMarketResult = { ok: true; data: ProgramsMarket } | { ok: false; reason: 'no-college' | 'no-degrees' }

export async function loadProgramsMarket(institution: { name: string; profile: unknown }): Promise<ProgramsMarketResult> {
  const record = await collegeRecord(institution)
  if (!record) return { ok: false, reason: 'no-college' }
  const [raw, index, figures] = await Promise.all([loadCollegeMajors(record.state, record.unitid), loadIndex(), getDegreeFields()])
  const previous = figures ? await getDegreeFieldsOf(previousEdition(figures.edition)) : null
  const data = programsMarket({ unitid: record.unitid, raw, index, figures, previous })
  return data ? { ok: true, data } : { ok: false, reason: 'no-degrees' }
}

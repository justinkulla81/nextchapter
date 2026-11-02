// A place's outlook: Building, Steady, Cooling or Not enough data, from public figures, with the evidence listed. Pure.
// Three inputs, each worth one point either way: private-sector jobs (BLS QCEW, 2022 to 2025), population (Census,
// 2020 to 2025) and the unemployment rate against a year ago (BLS LAUS). Fewer than two inputs is "Not enough data".
// It describes the place, never an employer in it.

export type PlaceOutlookLabel = 'Building' | 'Steady' | 'Cooling' | 'Not enough data'
export interface PlaceOutlook { label: PlaceOutlookLabel; evidence: string[] }

export interface PlaceOutlookInput {
  /** Private-sector jobs change 2022 to 2025, percent. */
  jobsChangePct: number | null
  /** Population change 2020 to 2025, percent. */
  populationChangePct: number | null
  /** Unemployment rate now and a year ago, percent. */
  unemployment: { rate: number; yearAgo: number } | null
}

const one = (n: number) => Math.abs(n).toFixed(1)

export function placeOutlook(x: PlaceOutlookInput): PlaceOutlook {
  const evidence: string[] = []
  let score = 0
  let inputs = 0
  if (x.jobsChangePct != null && Number.isFinite(x.jobsChangePct)) {
    inputs++
    score += x.jobsChangePct >= 4 ? 1 : x.jobsChangePct < 0 ? -1 : 0
    evidence.push(`Private-sector jobs ${x.jobsChangePct >= 0 ? 'up' : 'down'} ${one(x.jobsChangePct)}% from 2022 to 2025`)
  }
  if (x.populationChangePct != null && Number.isFinite(x.populationChangePct)) {
    inputs++
    score += x.populationChangePct >= 3 ? 1 : x.populationChangePct <= -1 ? -1 : 0
    evidence.push(`Population ${x.populationChangePct >= 0 ? 'up' : 'down'} ${one(x.populationChangePct)}% from 2020 to 2025`)
  }
  if (x.unemployment) {
    inputs++
    const d = x.unemployment.rate - x.unemployment.yearAgo
    score += d <= -0.2 ? 1 : d >= 0.3 ? -1 : 0
    evidence.push(`Unemployment ${x.unemployment.rate.toFixed(1)}%, ${Math.abs(d) < 0.05 ? 'unchanged' : `${d > 0 ? 'up' : 'down'} ${one(d)} points`} from a year ago`)
  }
  if (inputs < 2) return { label: 'Not enough data', evidence }
  return { label: score >= 2 ? 'Building' : score <= -2 ? 'Cooling' : 'Steady', evidence }
}

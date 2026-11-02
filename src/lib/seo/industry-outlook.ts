// An industry's outlook: Building, Steady or Cooling, from public BLS numbers, with the evidence listed. Pure.
// Three inputs, each worth one point either way: payroll employment change over a year (CES), the job openings rate
// against a year ago, and the layoffs rate against a year ago (JOLTS). Fewer than two inputs is "Not enough data".
// Wording is deliberately plain ("Building", "Cooling"), never "shrinking", and the evidence is always shown with it.

import type { JoltsMeasures } from '@/lib/market/industry-jolts-data'
import type { Fact } from '@/lib/seo/topic-quality'

export type OutlookLabel = 'Building' | 'Steady' | 'Cooling' | 'Not enough data'
export interface Outlook { label: OutlookLabel; evidence: string[] }

const pt = (n: number) => `${Math.abs(n).toFixed(1)}`
const monthYear = (asOf: string) => {
  const [y, m] = asOf.split('-')
  return new Date(Date.UTC(Number(y), Number(m) - 1, 1)).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

export function industryOutlook(trend: { yoyPct: number } | undefined, jolts: JoltsMeasures | undefined, sector?: string): Outlook {
  const where = sector ? ` in ${sector}` : ''
  const evidence: string[] = []
  let score = 0
  let inputs = 0
  if (trend) {
    inputs++
    const s = trend.yoyPct >= 1 ? 1 : trend.yoyPct <= -0.5 ? -1 : 0
    score += s
    evidence.push(`Employment ${trend.yoyPct >= 0 ? 'up' : 'down'} ${pt(trend.yoyPct)}% over the year${where}`)
  }
  if (jolts?.openings) {
    inputs++
    const d = jolts.openings.value - jolts.openings.yearAgo
    score += d >= 0.3 ? 1 : d <= -0.3 ? -1 : 0
    evidence.push(`Job openings rate ${jolts.openings.value.toFixed(1)}%, ${Math.abs(d) < 0.05 ? 'unchanged' : `${d > 0 ? 'up' : 'down'} ${pt(d)} points`} from a year ago`)
  }
  if (jolts?.layoffs) {
    inputs++
    const d = jolts.layoffs.value - jolts.layoffs.yearAgo
    score += d <= -0.2 ? 1 : d >= 0.2 ? -1 : 0
    evidence.push(`Layoffs rate ${jolts.layoffs.value.toFixed(1)}%, ${Math.abs(d) < 0.05 ? 'unchanged' : `${d > 0 ? 'up' : 'down'} ${pt(d)} points`} from a year ago`)
  }
  if (inputs < 2) return { label: 'Not enough data', evidence }
  return { label: score >= 2 ? 'Building' : score <= -2 ? 'Cooling' : 'Steady', evidence }
}

export function joltsFacts(jolts: JoltsMeasures | undefined, sector: string | undefined): Fact[] {
  if (!jolts) return []
  const src = 'BLS Job Openings and Labor Turnover Survey, seasonally adjusted'
  const where = sector ? ` (${sector}, the closest BLS sector)` : ''
  const out: Fact[] = []
  if (jolts.openings) out.push({ key: 'jolts-openings', label: 'Job openings rate', value: `${jolts.openings.value.toFixed(1)}% of jobs, against ${jolts.openings.yearAgo.toFixed(1)}% a year earlier${where}`, source: src, period: monthYear(jolts.openings.asOf) })
  if (jolts.layoffs) out.push({ key: 'jolts-layoffs', label: 'Layoffs and discharges rate', value: `${jolts.layoffs.value.toFixed(1)}% of employment, against ${jolts.layoffs.yearAgo.toFixed(1)}% a year earlier${where}`, source: src, period: monthYear(jolts.layoffs.asOf) })
  if (jolts.hires) out.push({ key: 'jolts-hires', label: 'Hires rate', value: `${jolts.hires.value.toFixed(1)}% of employment, against ${jolts.hires.yearAgo.toFixed(1)}% a year earlier${where}`, source: src, period: monthYear(jolts.hires.asOf) })
  return out
}

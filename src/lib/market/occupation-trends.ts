// Pivot Path trend panel logic. Maps a member's function (PRIMARY_FUNCTION_OPTIONS)
// to the CPS occupation groups in the report data and describes each in plain
// terms. Pure and client-safe. Never states a prediction: direction words only
// restate measured 2022 to 2026 employment change.

import { OCCUPATION_TRENDS, CUSTOMER_SERVICE_TREND, type OccupationTrendRow } from './occupation-trends-data'

export type TrendSignal = 'GROWING' | 'FLAT' | 'SHRINKING'
export type ExposureBand = 'HIGH' | 'MEDIUM' | 'LOW'

// Employment-weighted exposure bands used in the report (low <25, mid 25-45, high 45+).
export function exposureBand(aiExposure: number): ExposureBand {
  if (aiExposure >= 45) return 'HIGH'
  if (aiExposure >= 25) return 'MEDIUM'
  return 'LOW'
}

// Total CPS employment grew only a few percent over 2022 to 2026, so a group
// has to clear that to count as growing; below zero counts as shrinking.
const GROWING_AT = 5
const SHRINKING_AT = -1

export function trendSignal(employmentChangePct: number): TrendSignal {
  if (employmentChangePct >= GROWING_AT) return 'GROWING'
  if (employmentChangePct <= SHRINKING_AT) return 'SHRINKING'
  return 'FLAT'
}

// Groups with fewer unemployed respondents than this are shown with a small-sample caveat.
const SMALL_SAMPLE_BELOW = 150

// PRIMARY_FUNCTION_OPTIONS -> CPS occupation groups (SOC major codes). General
// and Other have no honest mapping, so they return nothing instead of a guess.
const FUNCTION_TO_GROUPS: Record<string, string[]> = {
  Operations: ['11', '13'],
  Marketing: ['13', '11'],
  Finance: ['13'],
  Sales: ['41'],
  Engineering: ['15', '17'],
  Product: ['11', '15'],
  Design: ['27'],
  'Human Resources': ['13', '11'],
  Administration: ['43'],
  Legal: ['23'],
  'Customer Success': ['43'],
  'Data & Analytics': ['15', '13'],
  'Executive Leadership': ['11'],
}

export interface TrendLine {
  socGroup: string
  name: string
  signal: TrendSignal
  exposure: ExposureBand
  employmentChangePct: number
  longSearchSharePct: number
  longSearchChangePts: number
  smallSample: boolean
  summary: string
}

function describe(row: OccupationTrendRow): string {
  const emp = `Employment ${row.employmentChangePct >= 0 ? 'up' : 'down'} ${Math.abs(row.employmentChangePct).toFixed(1)}% since 2022`
  const search = `${Math.round(row.longSearchSharePct)}% of unemployed people from this group have been out 27+ weeks`
  return `${emp}. ${search}.`
}

export function trendLine(row: OccupationTrendRow): TrendLine {
  return {
    socGroup: row.socGroup,
    name: row.name,
    signal: trendSignal(row.employmentChangePct),
    exposure: exposureBand(row.aiExposure),
    employmentChangePct: row.employmentChangePct,
    longSearchSharePct: row.longSearchSharePct,
    longSearchChangePts: row.longSearchChangePts,
    smallSample: row.respondents < SMALL_SAMPLE_BELOW,
    summary: describe(row),
  }
}

export function trendsForFunction(primaryFunction: string | null | undefined): TrendLine[] {
  if (!primaryFunction) return []
  const groups = FUNCTION_TO_GROUPS[primaryFunction]
  if (!groups) return []
  return groups
    .map((g) => OCCUPATION_TRENDS.find((r) => r.socGroup === g))
    .filter((r): r is OccupationTrendRow => Boolean(r))
    .map(trendLine)
}

export interface PivotTrendComparison {
  from: TrendLine[]
  to: TrendLine[]
  readout: string | null
}

// One plain sentence comparing where the member is with where they want to go.
// Uses the first (closest) group of each. Returns null when either side has no
// mapping, so the card says nothing instead of guessing.
export function comparePivot(currentFunction: string | null | undefined, targetFunction: string | null | undefined): PivotTrendComparison {
  const from = trendsForFunction(currentFunction)
  const to = trendsForFunction(targetFunction)
  if (!from.length || !to.length) return { from, to, readout: null }
  const a = from[0]
  const b = to[0]
  if (a.socGroup === b.socGroup) {
    return { from, to, readout: `Your current and target functions sit in the same occupation group (${a.name}), so the data here does not separate them.` }
  }
  const diff = b.employmentChangePct - a.employmentChangePct
  const searchDiff = b.longSearchSharePct - a.longSearchSharePct
  const empWord = Math.abs(diff) < 2 ? 'about the same pace of' : diff > 0 ? 'faster' : 'slower'
  const parts: string[] = []
  parts.push(
    empWord.startsWith('about')
      ? `Employment in ${b.name} is moving at about the same pace as ${a.name}.`
      : `Employment in ${b.name} has grown ${empWord} than in ${a.name} since 2022 (${b.employmentChangePct.toFixed(1)}% against ${a.employmentChangePct.toFixed(1)}%).`
  )
  if (Math.abs(searchDiff) >= 3) {
    parts.push(
      searchDiff > 0
        ? `Long searches are more common among people leaving ${b.name} (${Math.round(b.longSearchSharePct)}% against ${Math.round(a.longSearchSharePct)}%), so plan for a longer runway.`
        : `Long searches are less common among people leaving ${b.name} (${Math.round(b.longSearchSharePct)}% against ${Math.round(a.longSearchSharePct)}%).`
    )
  }
  return { from, to, readout: parts.join(' ') }
}

export function customerServiceNote(primaryFunction: string | null | undefined): string | null {
  if (primaryFunction !== 'Customer Success') return null
  const c = CUSTOMER_SERVICE_TREND
  return `Customer service representatives, the occupation built most around scripted conversation, fell about ${Math.abs(c.employmentChangePct2025to2026)}% from 2025 (about ${Math.abs(c.employmentChangeThousands)},000, margin of error about ${c.marginThousands},000). ${c.note}`
}

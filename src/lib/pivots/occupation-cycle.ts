// How an occupation held up in the last two downturns, from BLS OEWS national employment (public domain). Built by
// scripts/pivots/import_cycle_swing.py into occupation-cycle.json. It reports what happened, not a forecast, and it does
// not change the ranking: it is a plain label beside the long-term outlook. With no data (or an occupation missing from
// either year's file) it shows nothing.

import data from './occupation-cycle.json'

export interface CycleEpisode {
  label: string
  /** Percent change in employment across all occupations over the same years. */
  allJobsPct: number
}

export interface OccupationCycle {
  /** Percent change in the occupation's employment per episode, in the same order as the episodes. */
  pct: number[]
  /** Set when BLS codes changed so that this work can only be followed together with close relatives: their titles. */
  group?: string[]
}

export type CycleBand = 'swings' | 'held'

const EPISODES = (data as { episodes: CycleEpisode[] }).episodes
const BY_SOC = (data as { occupations: Record<string, OccupationCycle> }).occupations

/** Falling this many points below all jobs in a downturn, without beating all jobs in the other, counts as swinging with the economy. */
export const SWING_POINTS = 5
/** Beating all jobs by this many points in both counts as holding up. */
export const HELD_POINTS = 2

/** SOC code with or without the O*NET suffix ("13-2051.00" or "13-2051") to the 6-digit form. */
function soc6(soc: string): string {
  return soc.slice(0, 7)
}

export function cycleBand(pct: number[], episodes: CycleEpisode[]): CycleBand | null {
  if (episodes.length < 2 || pct.length !== episodes.length) return null
  const rel = pct.map((p, i) => p - episodes[i].allJobsPct)
  if (rel.some((r) => r <= -SWING_POINTS) && rel.every((r) => r < HELD_POINTS)) return 'swings'
  if (rel.every((r) => r >= HELD_POINTS)) return 'held'
  return null
}

const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(Math.round(n))}%`

export function cycleLineFor(pct: number[], episodes: CycleEpisode[], group?: string[]): string | null {
  const band = cycleBand(pct, episodes)
  if (!band) return null
  const parts = episodes.map((e, i) => `${e.label}: ${signed(pct[i])} against ${signed(e.allJobsPct)} for all jobs`)
  const verb = band === 'swings' ? 'fell more than jobs overall in at least one' : 'held up better than jobs overall in both'
  const scope = group && group.length > 1 ? `employment in this work and closely related jobs (${group.join('; ')}) ` : 'employment in this work '
  return `In the last two downturns, ${scope}${verb}${band === 'swings' ? ' of them' : ''} (${parts.join('; ')}). That is what happened before, not a forecast.`
}

/** The label for a pivot target's occupation, or null when we have no comparable history. */
export function cycleLineForSoc(soc: string | null | undefined): string | null {
  if (!soc) return null
  const o = BY_SOC[soc6(soc)]
  return o ? cycleLineFor(o.pct, EPISODES, o.group) : null
}

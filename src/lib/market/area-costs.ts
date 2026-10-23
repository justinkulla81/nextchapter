// What it costs to live somewhere, for the places a member is comparing. Two public sources (area-costs.json, built by
// scripts/housing/import_census_housing.py): Census median rent and median home value, and BEA regional price parities
// (what everyday spending costs in total, United States = 100). Used to show what a salary is worth in another place.
// Areas are keyed like OccupationWage: METRO by CBSA code, STATE by FIPS, NATIONAL "US". A figure we do not have is
// absent; nothing is filled in, so a micropolitan area has rent and home value but no price parity.

import data from './area-costs.json'

export interface AreaCosts {
  name: string
  /** Median gross rent, dollars a month (Census ACS 5-year). */
  rent?: number
  /** Median home value, dollars (Census ACS 5-year). */
  home?: number
  /** All-items price parity, United States = 100 (BEA). Metropolitan areas and states only. */
  rpp?: number
}

const AREAS = (data as { areas: Record<string, AreaCosts> }).areas

export const AREA_COSTS_SOURCE = 'Census Bureau American Community Survey 2020-2024 (rent, home value) and Bureau of Economic Analysis regional price parities 2024'

/** The most local figures we have: the metro area, else the state, else the nation. */
export function costsFor(where: { metroCode?: string | null; stateFips?: string | null }): AreaCosts | null {
  return (where.metroCode && AREAS[`METRO:${where.metroCode}`]) || (where.stateFips && AREAS[`STATE:${where.stateFips}`]) || AREAS['NATIONAL:US'] || null
}

/** Percent difference of `to` from `from`, rounded to a whole percent. Null when either is missing. */
export function pctDiff(from: number | undefined, to: number | undefined): number | null {
  if (!from || !to) return null
  return Math.round((to / from - 1) * 100)
}

/**
 * What a pay figure in `to` buys, in `from`'s dollars: the same everyday spending costs `rpp` times as much, so
 * $128,000 in a place 10% cheaper feels like about $142,000 at home. Null without both price parities.
 */
export function valueInHomeDollars(pay: number, from: AreaCosts | null, to: AreaCosts | null): number | null {
  if (!from?.rpp || !to?.rpp || !(pay > 0)) return null
  return Math.round((pay * from.rpp) / to.rpp / 100) * 100
}

const sign = (n: number) => (n === 0 ? 'about the same' : `${Math.abs(n)}% ${n < 0 ? 'lower' : 'higher'}`)

/** One plain line about what everything costs there compared with where the member lives. */
export function priceLine(from: AreaCosts | null, to: AreaCosts | null): string | null {
  const d = pctDiff(from?.rpp, to?.rpp)
  if (d === null || !from || !to) return null
  return d === 0 ? `Everyday prices are about the same as in ${from.name}.` : `Everyday prices run about ${sign(d)} than in ${from.name}.`
}

/** "Typical rent $1,573 a month (14% lower than ...)" or null when we have no rent for the place. */
export function rentLine(from: AreaCosts | null, to: AreaCosts | null): string | null {
  if (!to?.rent) return null
  const d = pctDiff(from?.rent, to.rent)
  const base = `Typical rent $${to.rent.toLocaleString('en-US')} a month`
  return d === null || !from ? `${base}.` : d === 0 ? `${base}, about the same as in ${from.name}.` : `${base}, ${sign(d)} than in ${from.name}.`
}

/** "Typical home value $418,400 (...)" or null when we have no home value for the place. */
export function homeLine(from: AreaCosts | null, to: AreaCosts | null): string | null {
  if (!to?.home) return null
  const d = pctDiff(from?.home, to.home)
  const base = `Typical home value $${to.home.toLocaleString('en-US')}`
  return d === null || !from ? `${base}.` : d === 0 ? `${base}, about the same as in ${from.name}.` : `${base}, ${sign(d)} than in ${from.name}.`
}

/** "$128,000 in Raleigh covers about what $134,000 does in Columbus." The home place is named so the reader knows the base. */
export function worthLine(pay: number, from: AreaCosts | null, to: AreaCosts | null): string | null {
  const v = valueInHomeDollars(pay, from, to)
  if (v === null || !from || !to) return null
  return `$${pay.toLocaleString('en-US')} in ${to.name} covers about what $${v.toLocaleString('en-US')} does in ${from.name}.`
}

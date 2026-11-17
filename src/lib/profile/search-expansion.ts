// What a person opted to add to their job search after the addressable-market
// check: more places (remote, neighboring states), more kinds of role (pivot
// paths that use their skills) and more industries. Stored on
// CandidateProfile.searchExpansion; the job fit score reads it so Find My Job
// and the daily jobs email include these jobs. Pure and client-safe.

import { readCareerHighPointStore, type CareerHighPointStore } from '@/lib/profile/career-high-point'

/**
 * A city the member added (Widen your search). `name` is how it reads ("Austin, TX", or a metro such as "Dallas-Fort
 * Worth Metro"); `state` is its main state; lat/lon are its centre (Census places), so the board counts jobs within
 * commuting distance of it, the same test it uses for home. Added-city matching: src/lib/jobs/added-cities.ts.
 */
export type AddedCity = { name: string; state: string; lat: number; lon: number }

export type SearchExpansion = {
  remote: boolean
  states: string[]
  /** Cities added one by one: only jobs in or near them, not the whole state. Absent in older rows (read as []). */
  cities?: AddedCity[]
  roles: string[]
  industries: string[]
  at: string | null
  // The member's career high point (career-high-point.ts) rides along in the same JSON
  // so every reader and writer of this column keeps it. Absent when never derived or set.
  careerHighPoint?: CareerHighPointStore
}

export function readSearchExpansion(json: unknown): SearchExpansion {
  const o = (json ?? {}) as Partial<Record<keyof SearchExpansion, unknown>>
  const list = (x: unknown, re?: RegExp) => (Array.isArray(x) ? [...new Set(x.filter((v): v is string => typeof v === 'string' && (!re || re.test(v))))].slice(0, 12) : [])
  const careerHighPoint = readCareerHighPointStore(o.careerHighPoint)
  const cities: AddedCity[] = []
  if (Array.isArray(o.cities)) {
    for (const c of o.cities as Partial<AddedCity>[]) {
      if (!c || typeof c.name !== 'string' || typeof c.state !== 'string' || !/^[A-Z]{2}$/.test(c.state)) continue
      if (typeof c.lat !== 'number' || typeof c.lon !== 'number' || !Number.isFinite(c.lat) || !Number.isFinite(c.lon)) continue
      if (cities.some((x) => x.name === c.name)) continue
      cities.push({ name: c.name.slice(0, 80), state: c.state, lat: c.lat, lon: c.lon })
      if (cities.length >= 12) break
    }
  }
  return {
    remote: o.remote === true,
    states: list(o.states, /^[A-Z]{2}$/),
    cities,
    roles: list(o.roles, /^[a-z_]+$/),
    industries: list(o.industries),
    at: typeof o.at === 'string' ? o.at : null,
    ...(careerHighPoint.derived || careerHighPoint.member ? { careerHighPoint } : {}),
  }
}

// Bordering states, for "jobs just across the state line".
export const STATE_NEIGHBORS: Record<string, string[]> = {
  AL: ['FL', 'GA', 'MS', 'TN'], AZ: ['CA', 'CO', 'NM', 'NV', 'UT'], AR: ['LA', 'MO', 'MS', 'OK', 'TN', 'TX'], CA: ['AZ', 'NV', 'OR'],
  CO: ['AZ', 'KS', 'NE', 'NM', 'OK', 'UT', 'WY'], CT: ['MA', 'NY', 'RI'], DE: ['MD', 'NJ', 'PA'], DC: ['MD', 'VA'], FL: ['AL', 'GA'],
  GA: ['AL', 'FL', 'NC', 'SC', 'TN'], ID: ['MT', 'NV', 'OR', 'UT', 'WA', 'WY'], IL: ['IA', 'IN', 'KY', 'MO', 'WI'], IN: ['IL', 'KY', 'MI', 'OH'],
  IA: ['IL', 'MN', 'MO', 'NE', 'SD', 'WI'], KS: ['CO', 'MO', 'NE', 'OK'], KY: ['IL', 'IN', 'MO', 'OH', 'TN', 'VA', 'WV'], LA: ['AR', 'MS', 'TX'],
  ME: ['NH'], MD: ['DC', 'DE', 'PA', 'VA', 'WV'], MA: ['CT', 'NH', 'NY', 'RI', 'VT'], MI: ['IN', 'OH', 'WI'], MN: ['IA', 'ND', 'SD', 'WI'],
  MS: ['AL', 'AR', 'LA', 'TN'], MO: ['AR', 'IA', 'IL', 'KS', 'KY', 'NE', 'OK', 'TN'], MT: ['ID', 'ND', 'SD', 'WY'], NE: ['CO', 'IA', 'KS', 'MO', 'SD', 'WY'],
  NV: ['AZ', 'CA', 'ID', 'OR', 'UT'], NH: ['MA', 'ME', 'VT'], NJ: ['DE', 'NY', 'PA'], NM: ['AZ', 'CO', 'OK', 'TX', 'UT'], NY: ['CT', 'MA', 'NJ', 'PA', 'VT'],
  NC: ['GA', 'SC', 'TN', 'VA'], ND: ['MN', 'MT', 'SD'], OH: ['IN', 'KY', 'MI', 'PA', 'WV'], OK: ['AR', 'CO', 'KS', 'MO', 'NM', 'TX'], OR: ['CA', 'ID', 'NV', 'WA'],
  PA: ['DE', 'MD', 'NJ', 'NY', 'OH', 'WV'], RI: ['CT', 'MA'], SC: ['GA', 'NC'], SD: ['IA', 'MN', 'MT', 'ND', 'NE', 'WY'], TN: ['AL', 'AR', 'GA', 'KY', 'MO', 'MS', 'NC', 'VA'],
  TX: ['AR', 'LA', 'NM', 'OK'], UT: ['AZ', 'CO', 'ID', 'NM', 'NV', 'WY'], VT: ['MA', 'NH', 'NY'], VA: ['DC', 'KY', 'MD', 'NC', 'TN', 'WV'], WA: ['ID', 'OR'],
  WV: ['KY', 'MD', 'OH', 'PA', 'VA'], WI: ['IA', 'IL', 'MI', 'MN'], WY: ['CO', 'ID', 'MT', 'NE', 'SD', 'UT'], AK: [], HI: [],
}

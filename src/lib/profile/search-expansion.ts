// What a person opted to add to their job search after the addressable-market
// check: more places (remote, neighboring states), more kinds of role (pivot
// paths that use their skills) and more industries. Stored on
// CandidateProfile.searchExpansion; the job fit score reads it so Find My Job
// and the daily jobs email include these jobs. Pure and client-safe.

import { readCareerHighPointStore, type CareerHighPointStore } from '@/lib/profile/career-high-point'

export type SearchExpansion = {
  remote: boolean
  states: string[]
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
  return {
    remote: o.remote === true,
    states: list(o.states, /^[A-Z]{2}$/),
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

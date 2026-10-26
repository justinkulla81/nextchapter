import { ALL_STATE_CODES } from '@/lib/seo/states'
import places from './conference-places.json'

// Which city and county page each conference maps to (scripts/seo/build-conference-places.ts). Pure, so the quality bar can count the links.
export const PLACES = places as Record<string, { c?: string; cn?: string; k?: string; kn?: string }>


/** Place-page links a conference page carries: its city and county pages, and its state page. State codes outside the US states (provinces) get none. */
export function placeLinkCount(id: string, state: string | null): number {
  if (!state || !ALL_STATE_CODES.includes(state)) return 0
  const p = PLACES[id]
  return 1 + (p?.c ? 1 : 0) + (p?.k ? 1 : 0)
}

const K12_ONLY = /k-12|early childhood|education policy|career and technical|adult education/i

/** An education conference for colleges and universities: education industry, unless every segment it names is K-12, early childhood, policy or technical education. */
export function isHigherEd(r: { industries: string[]; segments: string[] }): boolean {
  if (!r.industries.includes('Education & EdTech')) return false
  return r.segments.length === 0 || r.segments.some((s) => !K12_ONLY.test(s))
}


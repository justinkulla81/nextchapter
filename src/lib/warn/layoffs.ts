import { normalizeOrgName } from '@/lib/text/org-name-match'
import type { WarnRow } from './sources'

/**
 * layoffs.fyi rows, mapped onto the same shape as a state WARN filing.
 *
 * This source exists because roughly thirty states cannot be synced from their
 * own filings — New York and North Carolina publish theirs as a Tableau
 * dashboard with no data behind it, and a dozen more post PDFs or render the
 * list with JavaScript. The tracker covers those states.
 *
 * It is not a replacement for WARN where WARN works: it carries no effective
 * date, which is the field that decides when outreach lands. It is additive.
 */
export interface LayoffsFyiRow {
  company: string
  locationHq: string | null
  employees: number | null
  date: string | null
  industry: string | null
  source: string | null
  country: string | null
  stage: string | null
}

/**
 * The tracker records a metro, not a state. Only US metros are mapped; a row
 * whose location is not in this list is dropped rather than guessed at, which
 * also filters out the non-US majority of the table.
 */
export const METRO_STATE: Record<string, string> = {
  'sf bay area': 'CA', 'los angeles': 'CA', 'san diego': 'CA', 'sacramento': 'CA', 'orange county': 'CA',
  'santa barbara': 'CA', 'fresno': 'CA',
  'new york city': 'NY', 'new york': 'NY', 'rochester': 'NY', 'buffalo': 'NY', 'albany': 'NY',
  'seattle': 'WA', 'spokane': 'WA',
  'boston': 'MA', 'worcester': 'MA',
  'chicago': 'IL', 'austin': 'TX', 'dallas': 'TX', 'houston': 'TX', 'san antonio': 'TX', 'el paso': 'TX',
  'denver': 'CO', 'boulder': 'CO', 'colorado springs': 'CO',
  'atlanta': 'GA', 'philadelphia': 'PA', 'pittsburgh': 'PA',
  'detroit': 'MI', 'ann arbor': 'MI', 'grand rapids': 'MI',
  'miami': 'FL', 'orlando': 'FL', 'tampa': 'FL', 'jacksonville': 'FL', 'fort lauderdale': 'FL',
  'washington d.c.': 'DC', 'washington dc': 'DC', 'washington, d.c.': 'DC', 'dc': 'DC',
  'phoenix': 'AZ', 'tucson': 'AZ', 'scottsdale': 'AZ',
  'portland': 'OR', 'eugene': 'OR',
  'salt lake city': 'UT', 'provo': 'UT',
  'minneapolis': 'MN', 'st. paul': 'MN',
  'raleigh': 'NC', 'charlotte': 'NC', 'durham': 'NC',
  'nashville': 'TN', 'memphis': 'TN', 'knoxville': 'TN',
  'baltimore': 'MD', 'columbus': 'OH', 'cincinnati': 'OH', 'cleveland': 'OH',
  'indianapolis': 'IN', 'kansas city': 'MO', 'st. louis': 'MO', 'saint louis': 'MO',
  'las vegas': 'NV', 'reno': 'NV', 'milwaukee': 'WI', 'madison': 'WI',
  'new jersey': 'NJ', 'newark': 'NJ', 'jersey city': 'NJ', 'princeton': 'NJ',
  'providence': 'RI', 'richmond': 'VA', 'arlington': 'VA', 'norfolk': 'VA',
  'boise': 'ID', 'omaha': 'NE', 'lincoln': 'NE', 'des moines': 'IA',
  'oklahoma city': 'OK', 'tulsa': 'OK', 'louisville': 'KY', 'lexington': 'KY',
  'new orleans': 'LA', 'baton rouge': 'LA', 'birmingham': 'AL', 'huntsville': 'AL',
  'little rock': 'AR', 'albuquerque': 'NM', 'honolulu': 'HI', 'anchorage': 'AK',
  'charleston': 'SC', 'columbia': 'SC', 'greenville': 'SC',
  'hartford': 'CT', 'stamford': 'CT', 'new haven': 'CT',
  'portland, me': 'ME', 'burlington': 'VT', 'manchester': 'NH', 'nashua': 'NH',
  'wilmington': 'DE', 'sioux falls': 'SD', 'fargo': 'ND', 'billings': 'MT',
  'cheyenne': 'WY', 'jackson': 'MS', 'wichita': 'KS', 'charleston, wv': 'WV',
  // The long tail, added after checking which US metros the tracker actually
  // uses; these cover all but a couple of dozen rows in the whole table.
  'lehi': 'UT', 'logan': 'UT', 'tampa bay': 'FL', 'port st. lucie': 'FL',
  'norwalk': 'CT', 'dover': 'DE', 'missoula': 'MT', 'santa fe': 'NM',
  'bend': 'OR', 'corvallis': 'OR', 'san luis obispo': 'CA', 'chattanooga': 'TN',
  'holmdel': 'NJ', 'fort collins': 'CO', 'alamosa': 'CO', 'evansville': 'IN',
  'charlottesville': 'VA', 'bismarck': 'ND', 'davenport': 'IA', 'cedar falls': 'IA',
  'nebraska city': 'NE', 'new hope': 'PA',
}

export function stateForMetro(location: string | null | undefined): string | null {
  if (!location) return null
  const key = location.trim().toLowerCase()
  if (!key || key === 'non-u.s.' || key === 'remote') return null
  return METRO_STATE[key] ?? null
}

/** Dates arrive as M/D/YYYY. */
export function parseTrackerDate(raw: string | null | undefined): Date | null {
  if (!raw) return null
  const m = String(raw).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (m) {
    const d = new Date(Date.UTC(+m[3], +m[1] - 1, +m[2]))
    return Number.isNaN(d.getTime()) ? null : d
  }
  const d = new Date(String(raw))
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * Converts tracker rows to WARN rows, dropping everything that cannot be
 * placed in a US state.
 *
 * The industry is recorded as the tracker's own label rather than forced into
 * a NAICS code. It is not used for filtering: layoffs.fyi only tracks tech
 * companies, so the sector test a state source needs is already satisfied by
 * the source itself — a "Retail" row here is a retail *technology* company,
 * whose staff are the people this pipeline is for.
 */
export function toWarnRows(rows: LayoffsFyiRow[]): WarnRow[] {
  const out: WarnRow[] = []
  for (const r of rows) {
    if (r.country && r.country.trim().toLowerCase() !== 'united states') {
      // The tracker marks non-US rows in Location HQ too, but Country is
      // explicit where present.
      if (/non-?u\.?s\.?/i.test(r.country)) continue
    }
    const state = stateForMetro(r.locationHq)
    if (!state) continue

    const employer = r.company.trim()
    if (!employer) continue

    out.push({
      state,
      employer,
      normalizedEmployer: normalizeOrgName(employer),
      noticeDate: parseTrackerDate(r.date),
      // The tracker records when a layoff was reported, never when it takes
      // effect. Left null rather than copied from the notice date.
      effectiveDate: null,
      employees: r.employees && r.employees > 0 ? r.employees : null,
      layoffType: r.stage?.trim() || null,
      county: null,
      address: r.locationHq?.trim() || null,
      industry: r.industry?.trim() ? `tech: ${r.industry.trim()}` : 'tech',
    })
  }
  return out
}

import { degreeLift, ENTRY_IC_FLOOR, refineLevelByYears, screenJobTitle, type ClassifyOptions, type RungName } from '@/lib/jobs/job-seniority'
import { NON_US } from '@/lib/jobs/job-seniority-rules.generated'
import { isUsLocation, namesNonUsPlace } from '@/lib/jobs/us-location'

// The screen every automated job source passes (the ncrawl import and the crawler
// history backfill): US (or remote) only, early-career professional roles and up,
// with the level taken from our own reading of the title (and, for early and
// mid-level professional titles, the posting's years-of-experience requirement).
// Internships, students, temporary, hourly, clerical and frontline work stay out.

/** Lowest rank an imported job may have: entry-level professional roles (ENTRY_IC, 0-2 years) and up. */
export const IMPORT_SENIORITY_FLOOR = ENTRY_IC_FLOOR

// Some sources fill unknown locations with placeholders ("UNAVAILABLE").
export function cleanJobLocation(raw: string | null | undefined): string | null {
  // Icon labels and field names some boards leave in the text ("wifi
  // Remote", "Orange County, CA Date").
  const text = (raw ?? '').replace(/^\s*wifi\s+/i, '').replace(/\s+date\s*$/i, '')
  const parts = text
    .split(/\s*,\s*/)
    .filter((p) => p && !/^(unavailable|n\/?a|none|null|undefined|tbd)$/i.test(p))
  return parts.length ? parts.join(', ') : null
}

// The source's own posting date; ignored when unparseable or in the future.
export function parsePostedDate(raw: string | null | undefined): Date | null {
  if (!raw) return null
  const d = new Date(raw)
  return Number.isNaN(d.getTime()) || d.getTime() > Date.now() + 86_400_000 ? null : d
}

export function screenImportedJob(
  title: string,
  rawLocation: string | null | undefined,
  opts: ClassifyOptions & { description?: string | null } = {}
): { keep: true; level: string; location: string | null } | { keep: false; reason: string } {
  // isUsLocation knows US places; NON_US catches foreign towns it doesn't
  // ("DEU - Bayern", "Poznań") and European "(f/m/d)" titles.
  const location = cleanJobLocation(rawLocation)
  if (!isUsLocation(location) || namesNonUsPlace(title, location, NON_US)) return { keep: false, reason: 'outside the US' }
  const verdict = screenJobTitle(title, { ...opts, floor: IMPORT_SENIORITY_FLOOR })
  // An excluded title whose posting asks for a bachelor's degree can still be an
  // early professional role (degreeLift: allowlisted families, never frontline/clinical/retail).
  const lifted = verdict.keep ? null : degreeLift(title, opts.description)
  if (!verdict.keep && !lifted) return { keep: false, reason: verdict.reason }
  const rung = verdict.keep ? verdict.level : lifted!.rung
  // The posting's years requirement settles the stage of an early or mid-level
  // professional title with no level marker of its own (never above MID_IC),
  // and brings a second-grade "Senior" title asking 3 years or fewer to MID_IC.
  const level = rung === 'ENTRY_IC' || rung === 'EARLY_IC' || rung === 'MID_IC' || rung === 'SENIOR_IC'
    ? refineLevelByYears(title, { rung: rung as RungName, rank: 0 }, opts.description).rung
    : rung
  return { keep: true, level, location }
}

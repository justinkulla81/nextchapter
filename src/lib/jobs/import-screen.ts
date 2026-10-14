import { screenJobTitle, type ClassifyOptions } from '@/lib/jobs/job-seniority'
import { NON_US } from '@/lib/jobs/job-seniority-rules.generated'
import { isUsLocation, namesNonUsPlace } from '@/lib/jobs/us-location'

// The screen every automated job source passes (the ncrawl import and the crawler
// history backfill): US (or remote) only, manager-and-up plus senior individual
// roles, with the level taken from our own reading of the title.

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
  opts: ClassifyOptions = {}
): { keep: true; level: string; location: string | null } | { keep: false; reason: string } {
  // isUsLocation knows US places; NON_US catches foreign towns it doesn't
  // ("DEU - Bayern", "Poznań") and European "(f/m/d)" titles.
  const location = cleanJobLocation(rawLocation)
  if (!isUsLocation(location) || namesNonUsPlace(title, location, NON_US)) return { keep: false, reason: 'outside the US' }
  const verdict = screenJobTitle(title, opts)
  if (!verdict.keep) return { keep: false, reason: verdict.reason }
  return { keep: true, level: verdict.level, location }
}

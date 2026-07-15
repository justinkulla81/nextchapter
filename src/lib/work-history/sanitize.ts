import type { WorkHistoryEntry } from '@prisma/client'

// A fractional/interim/consulting engagement should never be labeled as such
// on an external-facing document (Recruiter Report, What They See) — those
// words read as less-than to a reader skimming a work history, regardless of
// how the candidate is actually doing. Strips them as whole words only, so
// "Consulting" the company name (e.g. "Acme Consulting Group") is untouched —
// only removes when the word itself is standing in as a qualifier.
const QUALIFIER_WORDS = ['fractional', 'interim', 'consulting', 'gig', 'part-time', 'part time']

export function sanitizeRoleTitle(roleTitle: string): string {
  let result = roleTitle
  for (const word of QUALIFIER_WORDS) {
    const pattern = new RegExp(`\\b${word}\\b`, 'gi')
    result = result.replace(pattern, '')
  }
  return result.replace(/\s{2,}/g, ' ').replace(/^[\s,\-–—]+|[\s,\-–—]+$/g, '').trim() || roleTitle
}

// Collapses concurrent fractional/interim/consulting engagements to one
// displayed entry — the one marked isPrimaryEngagement, or the most
// recently started if the candidate hasn't picked one. Full-time entries and
// entries that aren't concurrent-with-another are always shown.
export function selectDisplayedWorkHistory(entries: WorkHistoryEntry[]): WorkHistoryEntry[] {
  const fullTime = entries.filter((e) => e.engagementType === 'FULL_TIME')
  const nonFullTimeCurrent = entries.filter((e) => e.engagementType !== 'FULL_TIME' && e.isCurrent)
  const nonFullTimePast = entries.filter((e) => e.engagementType !== 'FULL_TIME' && !e.isCurrent)

  if (nonFullTimeCurrent.length <= 1) {
    return [...fullTime, ...nonFullTimeCurrent, ...nonFullTimePast]
  }

  const primary =
    nonFullTimeCurrent.find((e) => e.isPrimaryEngagement) ??
    [...nonFullTimeCurrent].sort((a, b) => b.startDate.getTime() - a.startDate.getTime())[0]

  return [...fullTime, primary, ...nonFullTimePast]
}

import type { AtsProvider } from './ats-companies'

/** What one probe of a job board returns: its open-job count and, where the platform says, its own name. */
export type BoardProbe = (provider: AtsProvider, token: string) => Promise<{ jobs: number; boardName: string | null } | null>

const LEGAL_SUFFIX = /\b(inc|incorporated|llc|ltd|limited|corp|corporation|co|company|plc|gmbh|holdings)\b\.?$/i

/**
 * The board names a company is likely to use, most likely first: the whole
 * name run together, then hyphenated. Never a first word alone — "Flock
 * Freight" must not land on whoever owns "flock".
 */
export function slugCandidates(companyName: string): string[] {
  let name = companyName.toLowerCase().replace(/[’']/g, '').replace(/&/g, ' and ')
  name = name.replace(/[^a-z0-9\s-]/g, ' ').trim()
  while (LEGAL_SUFFIX.test(name)) name = name.replace(LEGAL_SUFFIX, '').trim()
  const words = name.split(/[\s-]+/).filter(Boolean)
  if (words.length === 0) return []
  const out = [words.join(''), words.join('-')]
  return [...new Set(out)].filter((s) => s.length >= 2)
}

// Pure helpers for the job X-ray: title cleanup before matching, and whether a career-site posting is the same role.
// No database, so it is tested directly.

const NOISE = /\b(remote|hybrid|on[- ]?site|full[- ]?time|part[- ]?time|contract|temporary|urgent(ly)? hiring|now hiring)\b/gi

/** The job title as a person would type it into the AI job check: workplace words, levels in brackets and trailing locations dropped. */
export function cleanTitle(raw: string): string {
  return raw
    .replace(/\([^)]*\)|\[[^\]]*\]/g, ' ')
    .replace(/\s[-–—|@]\s.*$/, ' ')
    .replace(/,\s*[A-Z]{2}\b.*$/, ' ')
    .replace(NOISE, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
}

const words = (s: string): Set<string> => new Set(s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w.length > 1))

/** Share of the posted title's words found in a candidate title, 0 to 1. */
export function titleOverlap(posted: string, candidate: string): number {
  const a = words(cleanTitle(posted))
  const b = words(cleanTitle(candidate))
  if (a.size === 0 || b.size === 0) return 0
  let hit = 0
  for (const w of a) if (b.has(w)) hit++
  return hit / Math.max(a.size, b.size)
}

/** The best live career-site posting for the title, only when it is clearly the same role (at least 80% of the words agree). */
export function bestRoleMatch<T extends { title: string }>(posted: string, rows: T[]): T | null {
  let best: { row: T; score: number } | null = null
  for (const row of rows) {
    const score = titleOverlap(posted, row.title)
    if (score >= 0.8 && (!best || score > best.score)) best = { row, score }
  }
  return best?.row ?? null
}

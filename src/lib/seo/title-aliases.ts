// "CFO jobs", not "Chief Financial Officer jobs": searchers type the abbreviation, and the job-title hub for the spelled-out title is
// the page that answers it. Search Console showed "cfo jobs" and "fractional coo jobs" landing on single postings while the hub for the
// title (620 open CFO roles) was named only in full. Only unambiguous abbreviations: "CRO" (revenue or risk), "CCO" (compliance or
// commercial) and "CPO" (people or product) would send half the searchers to the wrong hub.

export const TITLE_ABBREVIATIONS: Readonly<Record<string, string>> = {
  'chief-financial-officer': 'CFO',
  'chief-operating-officer': 'COO',
  'chief-marketing-officer': 'CMO',
  'chief-technology-officer': 'CTO',
  'chief-executive-officer': 'CEO',
  'chief-human-resources-officer': 'CHRO',
}

/** The hub slug for an abbreviation used as a slug ("cfo" gives "chief-financial-officer"), or null. */
export function slugForAbbreviation(slug: string): string | null {
  const want = slug.toLowerCase()
  return Object.entries(TITLE_ABBREVIATIONS).find(([, abbr]) => abbr.toLowerCase() === want)?.[0] ?? null
}

/** "Chief Financial Officer (CFO)" for a title that has an abbreviation, otherwise the name as it is. */
export function titleLabel(name: string, slug: string): string {
  const abbr = TITLE_ABBREVIATIONS[slug]
  return abbr && !new RegExp(`\\b${abbr}\\b`, 'i').test(name) ? `${name} (${abbr})` : name
}

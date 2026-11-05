// The name a crawled search firm gets in the CRM. The crawler reads a firm's name off its careers page, so it often keeps
// the page's own words around it: "Careers | Roberts Recruiting", "Optima Search | Europe & America", "PReP Intl = INTL-…".
// Pure, so it is unit-tested (src/test/search-firm-clean-name.test.ts). The raw crawled name stays on the SearchFirm row,
// because the firm's postings are matched on it (sourceName).

/** Names no rule can recover: the page had no firm name, or only a description. Keyed by the crawler's source id; each was checked against the firm's own board. */
export const FIRM_NAME_OVERRIDES: Record<string, string> = {
  'sf:jobskey2': 'Jobskey',
  'sf:riderflex': 'Riderflex',
  'sf:barkersearch': 'Barker Search',
  'sf:teilurtalent': 'Teilur Talent',
  'sf:synergyrecruitment': 'Synergy Jobs',
}

const PAGE_WORDS = /^(?:careers?|jobs?|employment|work with us|join us|home|about(?: us)?)\s*[|:–—-]\s*(?=\S)/i

/** The firm's own name out of what the crawler read: page-title words and taglines cut, a truncated "(…" dropped. */
export function cleanFirmName(raw: string): string {
  let n = raw.replace(/\s+/g, ' ').trim()
  n = n.replace(PAGE_WORDS, '')
  // A tagline or description after the name: "Optima Search | Europe & America", "PReP Intl = INTL-…".
  n = n.split(/\s+\|\s+|\s+=\s+/)[0]
  // A cut-off parenthesis: "Advanced Placement, LLC (now".
  n = n.replace(/\s*\([^)]*$/, '')
  n = n.replace(/[™®]+$/g, '').replace(/[\s,;:|–—-]+$/g, '').trim()
  return n || raw.trim()
}

/** What the CRM organization for a crawled firm is called. */
export function firmOrgName(f: { sourceKey: string; name: string }): string {
  return FIRM_NAME_OVERRIDES[f.sourceKey] ?? cleanFirmName(f.name)
}

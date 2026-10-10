import 'server-only'
import { getOrCreateCompany } from '@/lib/companies/company-lookup'
import { normalizeOrgName } from '@/lib/text/org-name-match'

// Every job that is added gets tied to its directory Company at the moment it is
// added, so the directory never lags the board (before this, only the nightly
// signals job created Company rows, up to a day late, and postings were joined to
// companies by re-normalising their free-text name on every read).
//
// Best-effort by design: a posting must always be saved. If the link can't be made
// the posting just has companyId null and the nightly job links it later.

// Placeholder names a posting can carry when the real employer is unknown — these
// must never become a directory company.
const NOT_A_COMPANY = /^(unknown|n\/a|confidential|undisclosed|various|multiple)\b/i
// Resume entries that are a situation, not an employer. Whole-string only, so a real
// company that merely starts with the word ("Independent Bank") is still a company.
const NOT_AN_EMPLOYER =
  /^(self[- ]?employed|freelance(r)?|independent( consultant| contractor)?|consultant|contractor|stealth( startup)?|sabbatical|career break|stay[- ]at[- ]home( parent)?|homemaker|retired|unemployed|none|n\/?a|student|various|confidential|private (client|practice)|own business|my own (business|company))$/i

export function isLinkableCompanyName(name: string | null | undefined): name is string {
  if (!name) return false
  const trimmed = name.trim()
  return trimmed.length > 1 && !NOT_A_COMPANY.test(trimmed) && !NOT_AN_EMPLOYER.test(trimmed) && normalizeOrgName(trimmed).length > 0
}

export async function linkPostingToCompany(rawName: string | null | undefined): Promise<string | null> {
  if (!isLinkableCompanyName(rawName)) return null
  try {
    return (await getOrCreateCompany(rawName)).id
  } catch (error) {
    console.error('Could not link posting to a company:', rawName, error)
    return null
  }
}

/** One lookup per distinct employer — for bulk writes. Keyed by the raw name as given. */
export async function linkPostingsToCompanies(rawNames: (string | null | undefined)[]): Promise<Map<string, string | null>> {
  const byKey = new Map<string, string | null>() // normalised key -> companyId
  const out = new Map<string, string | null>()
  for (const raw of rawNames) {
    if (!isLinkableCompanyName(raw) || out.has(raw)) continue
    const key = normalizeOrgName(raw)
    if (!byKey.has(key)) byKey.set(key, await linkPostingToCompany(raw))
    out.set(raw, byKey.get(key) ?? null)
  }
  return out
}

import { normalizeOrgName } from '@/lib/text/org-name-match'

// Matching a name from another system (a CRM organisation, an employer profile, a
// recruiter firm) to a directory Company. Pure — no database — so every rule below
// is unit-tested (src/test/company-links.test.ts).
//
// Two outcomes, and the line between them is the point:
//   exact  the normalised names are identical. Safe to link without a person.
//   close  the names overlap but are not identical ("Acme" / "Acme Health Partners").
//          NEVER linked automatically — it goes to a review queue where an admin
//          links it or keeps it separate. A wrong auto-link merges two real
//          companies' signals, intel and contacts; an unlinked one costs nothing.
// Anything else is no match.

export interface LinkableCompany {
  id: string
  name: string
  canonicalNameNormalized: string
}

export type OrgMatch =
  | { kind: 'exact'; companyId: string }
  | { kind: 'close'; candidates: { id: string; name: string }[] }
  | { kind: 'none' }

const MAX_CANDIDATES = 3
// A word found in this many directory companies ("boston", "pacific", "first") names a
// place or a fashion, not a company: sharing it is not evidence of anything.
const COMMON_TOKEN_COMPANIES = 8
// Words that carry no identity: sharing one is not evidence two names are the same.
const GENERIC = new Set([
  'the', 'and', 'of', 'group', 'holdings', 'partners', 'services', 'solutions', 'company', 'international',
  'global', 'national', 'american', 'united', 'systems', 'technologies', 'consulting', 'associates',
  'university', 'college', 'institute', 'foundation', 'health', 'healthcare', 'financial', 'capital',
  'medical', 'center', 'centre', 'hospital', 'clinic', 'school', 'schools', 'labs', 'lab', 'bank', 'trust',
  'insurance', 'media', 'energy', 'software', 'digital', 'data', 'network', 'networks', 'industries', 'enterprises',
  'management', 'resources', 'staffing', 'recruiting', 'search', 'communications', 'logistics', 'realty',
])

const tokens = (normalized: string) => normalized.split(' ').filter(Boolean)
const distinctive = (t: string[]) => t.filter((w) => w.length >= 3 && !GENERIC.has(w))

export interface CompanyIndex {
  byKey: Map<string, LinkableCompany>
  byToken: Map<string, LinkableCompany[]>
}

export function buildCompanyIndex(companies: LinkableCompany[]): CompanyIndex {
  const byKey = new Map<string, LinkableCompany>()
  const byToken = new Map<string, LinkableCompany[]>()
  for (const c of companies) {
    byKey.set(c.canonicalNameNormalized, c)
    for (const t of new Set(distinctive(tokens(c.canonicalNameNormalized)))) {
      const list = byToken.get(t)
      if (list) list.push(c)
      else byToken.set(t, [c])
    }
  }
  return { byKey, byToken }
}

export function matchNameToCompany(rawName: string, index: CompanyIndex): OrgMatch {
  const key = normalizeOrgName(rawName)
  if (!key) return { kind: 'none' }

  const exact = index.byKey.get(key)
  if (exact) return { kind: 'exact', companyId: exact.id }

  const mine = distinctive(tokens(key)).filter((w) => (index.byToken.get(w)?.length ?? 0) < COMMON_TOKEN_COMPANIES)
  if (mine.length === 0) return { kind: 'none' }

  // Candidates are companies sharing the rarest distinctive word (smallest list).
  const rarest = [...mine].sort((a, b) => (index.byToken.get(a)?.length ?? 0) - (index.byToken.get(b)?.length ?? 0))[0]
  const pool = index.byToken.get(rarest) ?? []

  const myAll = new Set(tokens(key))
  const close = pool.filter((c) => {
    const theirs = new Set(tokens(c.canonicalNameNormalized))
    const theirDistinct = distinctive([...theirs])
    // One name's distinctive words must all appear in the other (Acme ⊂ Acme Health Partners).
    return mine.every((w) => theirs.has(w)) || theirDistinct.every((w) => myAll.has(w))
  })
  if (close.length === 0) return { kind: 'none' }
  return { kind: 'close', candidates: close.slice(0, MAX_CANDIDATES).map((c) => ({ id: c.id, name: c.name })) }
}

// A website we will show a candidate and link to. Only http(s), normalised, no
// credentials or query noise. Anything else is rejected rather than repaired.
export function cleanWebsite(raw: string | null | undefined): string | null {
  if (!raw) return null
  let value = raw.trim()
  if (!value || /\s/.test(value)) return null
  if (!/^https?:\/\//i.test(value)) value = `https://${value}`
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    if (!url.hostname.includes('.') || url.username || url.password) return null
    // Not a company's own site: social profiles and link-shorteners are never "the website".
    if (/(^|\.)(linkedin|facebook|twitter|x|instagram|bit\.ly|t\.co)\./i.test(url.hostname + '.')) return null
    return `${url.protocol}//${url.hostname.replace(/^www\./i, '')}`
  } catch {
    return null
  }
}

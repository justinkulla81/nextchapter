import { prisma } from '@/lib/prisma'
import { normalizeOrgName, orgNamesMatch, fixAllCapsCompanyName } from '@/lib/text/org-name-match'
import { strictOrgKey } from '@/lib/crm/normalize'

export interface WarnCompanyMatchResult {
  companyId: string | null
  status: 'MATCHED' | 'AMBIGUOUS' | 'UNMATCHED'
  candidates: { id: string; name: string }[] | null
}

/**
 * Matches a WARN filing's employer to an existing Company, auto-creates one
 * when nothing plausible exists, or defers to a human when a loose match
 * found candidates too uncertain to link without risking a false merge —
 * a real ambiguity gets a review queue, not a guess.
 *
 * Two-tier matching mirrors promoteNotice()'s existing CrmOrganization logic:
 * strictOrgKey (strips the trailing "(1655 3rd Street)" location parenthetical
 * WARN filings often carry, plus legal suffixes) for a confident auto-link,
 * then the looser orgNamesMatch containment check for "maybe, ask a human."
 */
export async function matchOrCreateCompanyForEmployer(rawEmployer: string): Promise<WarnCompanyMatchResult> {
  const employer = fixAllCapsCompanyName(rawEmployer.trim())
  const strictKey = strictOrgKey(employer, normalizeOrgName)
  if (!strictKey) return { companyId: null, status: 'UNMATCHED', candidates: null }

  const companies = await prisma.company.findMany({ select: { id: true, name: true } })

  const strictMatch = companies.find((c) => strictOrgKey(c.name, normalizeOrgName) === strictKey)
  if (strictMatch) return { companyId: strictMatch.id, status: 'MATCHED', candidates: null }

  const looseMatches = companies.filter((c) => orgNamesMatch(c.name, employer))
  if (looseMatches.length > 0) {
    return { companyId: null, status: 'AMBIGUOUS', candidates: looseMatches.map((c) => ({ id: c.id, name: c.name })) }
  }

  // Genuinely new employer. Strip the location parenthetical before storing —
  // strictOrgKey already ignores it for matching, but the Company's own
  // display name should be the employer, not one of its addresses.
  const cleanName = employer.replace(/\s*\([^)]*\)\s*$/, '').trim() || employer
  const canonicalNameNormalized = normalizeOrgName(cleanName)
  const created = await prisma.company.upsert({
    where: { canonicalNameNormalized },
    update: {},
    create: { name: cleanName, canonicalNameNormalized },
  })
  return { companyId: created.id, status: 'MATCHED', candidates: null }
}

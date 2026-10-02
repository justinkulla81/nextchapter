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
/**
 * Every company, read once for a whole import.
 *
 * Matching used to re-read the full company table for each notice. At a few
 * thousand companies and a few hundred notices that was most of an import's
 * runtime, and what pushed the weekly sync past its time limit.
 */
export type CompanyIndex = { id: string; name: string }[]
export async function loadCompanyIndex(): Promise<CompanyIndex> {
  return prisma.company.findMany({ select: { id: true, name: true } })
}

export async function matchOrCreateCompanyForEmployer(rawEmployer: string, index?: CompanyIndex): Promise<WarnCompanyMatchResult> {
  const employer = fixAllCapsCompanyName(rawEmployer.trim())
  const strictKey = strictOrgKey(employer, normalizeOrgName)
  if (!strictKey) return { companyId: null, status: 'UNMATCHED', candidates: null }

  const companies = index ?? (await loadCompanyIndex())

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
    select: { id: true, name: true },
  })
  // So the next notice from the same employer in this import finds it.
  if (index && !index.some((c) => c.id === created.id)) index.push({ id: created.id, name: created.name })
  return { companyId: created.id, status: 'MATCHED', candidates: null }
}

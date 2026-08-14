import 'server-only'
import type { Company } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { normalizeOrgName, fixAllCapsCompanyName } from '@/lib/text/org-name-match'
import { resolveCompanySizeBand } from '@/lib/market/company-size'
import { resolveCompanyIndustry } from '@/lib/market/company-industry'

// Company.canonicalNameNormalized is the real join key between this new
// table and the free-text company names on ExclusiveJobPosting/
// WorkHistoryEntry/JobPosting — normalizeOrgName() is the established
// idiom for this everywhere else in the codebase (CompanySizeLookup,
// CompanyIndustryLookup, CompanyWatchlistEntry, WorkHistoryEntry). There is
// no domain-based join key anywhere in this codebase, so this is
// deliberately not built.

// Cheap get-or-create — creates a bare Company row (name + normalized key
// only) if one doesn't exist yet. Deliberately does NOT resolve
// industry/sizeBand here — see resolveCompanyMetadata below for why that's
// a separate, lazy, on-demand step rather than something every cron run or
// every upsert call triggers.
export async function getOrCreateCompany(rawName: string): Promise<Company> {
  const name = fixAllCapsCompanyName(rawName.trim())
  const canonicalNameNormalized = normalizeOrgName(name)

  const existing = await prisma.company.findUnique({ where: { canonicalNameNormalized } })
  if (existing) return existing

  return prisma.company.upsert({
    where: { canonicalNameNormalized },
    // Race between two concurrent first-encounters of the same company —
    // same upsert-based pattern CompanySizeLookup's own resolver uses.
    update: {},
    create: { name, canonicalNameNormalized },
  })
}

export function lookupCompanyByNormalizedName(canonicalNameNormalized: string): Promise<Company | null> {
  return prisma.company.findUnique({ where: { canonicalNameNormalized } })
}

// Fills in industry/sizeBand from the existing platform-wide LLM-backed
// caches (CompanySizeLookup/CompanyIndustryLookup — resolveCompanySizeBand/
// resolveCompanyIndustry in src/lib/market/) — but ONLY called from the
// candidate-facing company page's own load path (see
// src/app/dashboard/companies/[id]/page.tsx), never from the nightly cron.
//
// This is a deliberate cost-scoping decision, flagged explicitly per this
// project's standing rule on metered-cost features: the nightly cron in
// this phase touches every company with an active ExclusiveJobPosting row,
// which could be a few hundred distinct names. Eagerly resolving
// industry/size for all of them every night (or even once each, the first
// night they appear) would mean an LLM call for companies nobody has ever
// looked at. Resolving lazily, only for the one company a candidate is
// actually viewing, bounds the real cost to "once per distinct company a
// real person visits" — the exact scope CompanySizeLookup/
// CompanyIndustryLookup were designed for elsewhere in this codebase
// (company-size.ts's own docs: "one-time-per-distinct-company-name-ever,
// never per-candidate and never recurring"). Once resolved, the result is
// cached on the Company row itself, so a given company is never re-resolved.
export async function resolveCompanyMetadataIfMissing(company: Company): Promise<Company> {
  if (company.industry && company.sizeBand) return company

  const [industryResult, sizeResult] = await Promise.all([
    company.industry ? null : resolveCompanyIndustry(company.name),
    company.sizeBand ? null : resolveCompanySizeBand(company.name),
  ])

  const data: { industry?: string; sizeBand?: NonNullable<Company['sizeBand']> } = {}
  if (industryResult?.bucket) data.industry = industryResult.bucket
  if (sizeResult?.band) data.sizeBand = sizeResult.band

  if (Object.keys(data).length === 0) return company

  return prisma.company.update({ where: { id: company.id }, data })
}

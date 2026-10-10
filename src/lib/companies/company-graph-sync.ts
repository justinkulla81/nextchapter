import 'server-only'
import { prisma } from '@/lib/prisma'
import { getOrCreateCompany } from '@/lib/companies/company-lookup'
import { buildCompanyIndex, cleanWebsite, matchNameToCompany, type CompanyIndex } from '@/lib/companies/company-links'
import { isLinkableCompanyName } from '@/lib/companies/posting-company'
import { normalizeOrgName } from '@/lib/text/org-name-match'

// Keeps the company graph whole: every posting, employer, recruiter firm,
// outplacement org and CRM organisation that names a company points at the
// directory Company for it, and a Company carries a website when someone has typed
// one. Idempotent and incremental — each run only touches rows still unlinked —
// so the nightly job can call it and a backfill script can call it with a bigger
// limit.
//
// Only EXACT name matches are ever linked here. A near match is never guessed at:
// CRM organisations with a close-but-not-identical company go to the review page
// (see src/app/support/admin/(portal)/crm/company-links).

export interface GraphSyncResult {
  postingNamesLinked: number
  postingsLinked: number
  employerProfilesLinked: number
  recruiterFirmsLinked: number
  outplacementOrgsLinked: number
  crmOrganizationsLinked: number
  websitesFilled: number
}

async function loadIndex(): Promise<CompanyIndex> {
  return buildCompanyIndex(
    await prisma.company.findMany({ select: { id: true, name: true, canonicalNameNormalized: true } })
  )
}

/** Exact match in the index, else create — for names that are certainly a real company. */
async function companyIdFor(rawName: string, index: CompanyIndex): Promise<string | null> {
  if (!isLinkableCompanyName(rawName)) return null
  const key = normalizeOrgName(rawName)
  const hit = index.byKey.get(key)
  if (hit) return hit.id
  const created = await getOrCreateCompany(rawName)
  index.byKey.set(created.canonicalNameNormalized, {
    id: created.id,
    name: created.name,
    canonicalNameNormalized: created.canonicalNameNormalized,
  })
  return created.id
}

/** Exact match only — never creates. For records whose "name" may be a test fixture or a person. */
function exactCompanyId(rawName: string, index: CompanyIndex): string | null {
  const m = matchNameToCompany(rawName, index)
  return m.kind === 'exact' ? m.companyId : null
}

export async function syncCompanyGraph(opts: { postingNameLimit?: number } = {}): Promise<GraphSyncResult> {
  const { postingNameLimit = 1500 } = opts
  const index = await loadIndex()
  const result: GraphSyncResult = {
    postingNamesLinked: 0,
    postingsLinked: 0,
    employerProfilesLinked: 0,
    recruiterFirmsLinked: 0,
    outplacementOrgsLinked: 0,
    crmOrganizationsLinked: 0,
    websitesFilled: 0,
  }

  // 1. Postings added before the link existed, or where it failed at write time.
  const unlinked = await prisma.exclusiveJobPosting.groupBy({
    by: ['companyName'],
    where: { companyId: null, archivedAt: null },
    _count: { _all: true },
    orderBy: { _count: { companyName: 'desc' } },
    take: postingNameLimit,
  })
  for (const row of unlinked) {
    const companyId = await companyIdFor(row.companyName, index)
    if (!companyId) continue
    const { count } = await prisma.exclusiveJobPosting.updateMany({
      where: { companyId: null, companyName: row.companyName },
      data: { companyId },
    })
    result.postingNamesLinked += 1
    result.postingsLinked += count
  }

  // 2. Employers (real ones only — sample data is never given a directory entry).
  for (const e of await prisma.employerProfile.findMany({
    where: { companyId: null, isSampleData: false },
    select: { id: true, companyName: true },
  })) {
    const companyId = await companyIdFor(e.companyName, index)
    if (!companyId) continue
    await prisma.employerProfile.update({ where: { id: e.id }, data: { companyId } })
    result.employerProfilesLinked += 1
  }

  // 3. Recruiter firms are companies too.
  for (const f of await prisma.recruiterFirm.findMany({ where: { companyId: null }, select: { id: true, name: true } })) {
    const companyId = await companyIdFor(f.name, index)
    if (!companyId) continue
    await prisma.recruiterFirm.update({ where: { id: f.id }, data: { companyId } })
    result.recruiterFirmsLinked += 1
  }

  // 4. Outplacement orgs: exact match only, never create (some are fixtures).
  for (const o of await prisma.outplacementEmployerOrg.findMany({
    where: { companyId: null },
    select: { id: true, name: true },
  })) {
    const companyId = exactCompanyId(o.name, index)
    if (!companyId) continue
    await prisma.outplacementEmployerOrg.update({ where: { id: o.id }, data: { companyId } })
    result.outplacementOrgsLinked += 1
  }

  // 5. CRM organisations: exact name, or inherited from the firm / outplacement org
  // they already represent. A KEPT_SEPARATE decision is never revisited.
  for (const org of await prisma.crmOrganization.findMany({
    where: { companyId: null, OR: [{ companyLinkState: null }, { companyLinkState: { not: 'KEPT_SEPARATE' } }] },
    select: {
      id: true,
      name: true,
      recruiterFirm: { select: { companyId: true } },
      outplacementOrg: { select: { companyId: true } },
    },
  })) {
    const companyId =
      org.recruiterFirm?.companyId ?? org.outplacementOrg?.companyId ?? exactCompanyId(org.name, index)
    if (!companyId) continue
    await prisma.crmOrganization.update({ where: { id: org.id }, data: { companyId, companyLinkState: 'AUTO' } })
    result.crmOrganizationsLinked += 1
  }

  // 6. Websites — only from a source a person typed, never inferred.
  for (const org of await prisma.crmOrganization.findMany({
    where: { company: { website: null }, website: { not: null } },
    select: { website: true, companyId: true },
  })) {
    const website = cleanWebsite(org.website)
    if (!website || !org.companyId) continue
    const { count } = await prisma.company.updateMany({
      where: { id: org.companyId, website: null },
      data: { website, websiteSource: 'crm' },
    })
    result.websitesFilled += count
  }
  for (const e of await prisma.employerProfile.findMany({
    where: { companyId: { not: null }, companyWebsite: { not: null }, company: { website: null } },
    select: { companyWebsite: true, companyId: true },
  })) {
    const website = cleanWebsite(e.companyWebsite)
    if (!website || !e.companyId) continue
    const { count } = await prisma.company.updateMany({
      where: { id: e.companyId, website: null },
      data: { website, websiteSource: 'employer' },
    })
    result.websitesFilled += count
  }

  return result
}

import 'server-only'
import { prisma } from '@/lib/prisma'
import { newReferralCode } from '@/lib/candidates/referral'
import { stateSlug, stateName } from '@/lib/seo/states'
import { getStateOrgList, resolveArea } from '@/lib/seo/org-pages'
import { orgPagePath } from '@/lib/seo/org-page-rules'
import { employerPath } from '@/lib/seo/employer-pages'
import { getStateCollegeListings } from '@/lib/seo/college-pages'
import { collegePath } from '@/lib/seo/college-bar'
import { resolveClaimableOrg } from '@/lib/org-claims/org'
import { employerBrandKey, type OrgBrandKind } from '@/lib/branding/store'
import { KIT_SOURCES, areaPhrase, kitLabel, kitLabelPrefix, parseKitLabelAny, summarizeKit, type KitKind, type KitSource, type KitStats } from './org-kit'

// Reads and writes for an organization's launch kit: finding the organization behind a /prepared/<slug> address, its tracked links, and what
// they brought in.

export interface KitContext {
  kind: KitKind
  /** The id the kit's links are filed under: a board, job center or economic development id, a college unitid, or an employer's normalized name. */
  id: string
  crmOrgId: string
  name: string
  website: string | null
  /** The organization's public page on this site, where the kit links land. */
  pagePath: string
  /** Where it serves, as it reads in a sentence; empty for an employer. */
  area: string
  claimSlug: string
  /** Where its colors are stored (OrgBrand). */
  brandKind: OrgBrandKind
  brandId: string
}

const PAGE_KINDS = ['WORKFORCE_BOARD', 'JOB_CENTER', 'ECON_DEV'] as const

/** The organization a /prepared/<slug> address stands for, or null when it has no public page kind we make a kit for. */
export async function orgKitContext(claimSlug: string): Promise<KitContext | null> {
  try {
    const org = await resolveClaimableOrg(claimSlug)
    if (!org) return null

    // Workforce boards, American Job Centers and economic development organizations: linked to their page by PublicOrgPage.
    const link = await prisma.publicOrgPage.findFirst({ where: { kind: { in: [...PAGE_KINDS] }, crmOrgId: org.id }, select: { kind: true, sourceId: true, state: true } })
    if (link) {
      const kind = link.kind as (typeof PAGE_KINDS)[number]
      const list = await getStateOrgList(kind, stateSlug(link.state))
      const row = list?.rows.find((r) => r.id === link.sourceId || r.aliasIds?.includes(link.sourceId))
      if (!row || !list) return null
      return {
        kind, id: row.id, crmOrgId: org.id, name: row.name, website: row.website,
        pagePath: orgPagePath(kind, stateSlug(row.state), row.slug),
        area: areaPhrase(resolveArea(row, list.stateData), stateName(row.state)),
        claimSlug, brandKind: kind, brandId: row.id,
      }
    }

    // A college: linked to its page by LocalCollege.crmOrgId.
    if (org.orgTypes.includes('UNIVERSITY')) {
      const college = await prisma.localCollege.findFirst({ where: { crmOrgId: org.id }, select: { id: true, state: true, name: true, website: true, city: true } })
      if (college) {
        const hit = (await getStateCollegeListings(college.state)).find((c) => c.unitid === college.id)
        if (hit) {
          return {
            kind: 'COLLEGE', id: college.id, crmOrgId: org.id, name: college.name, website: college.website,
            pagePath: collegePath(stateSlug(college.state), hit.slug),
            area: [college.city, stateName(college.state)].filter(Boolean).join(', '),
            claimSlug, brandKind: 'COLLEGE', brandId: college.id,
          }
        }
      }
    }

    // An employer: its page is /employers/<slug>, and its colors are filed under its normalized name.
    if (org.orgTypes.includes('EMPLOYER')) {
      const row = await prisma.crmOrganization.findUnique({ where: { id: org.id }, select: { company: { select: { id: true, name: true, canonicalNameNormalized: true, website: true } } } })
      const company = row?.company
      if (company) {
        return {
          kind: 'EMPLOYER', id: company.canonicalNameNormalized, crmOrgId: org.id, name: company.name, website: company.website,
          pagePath: employerPath(company.canonicalNameNormalized, company.id), area: '',
          claimSlug, brandKind: 'EMPLOYER', brandId: employerBrandKey(company.name),
        }
      }
    }
    return null
  } catch {
    return null
  }
}

/** One active link per place for this organization; returns the code for each. */
export async function ensureKitLinks(kind: KitKind, id: string, createdBy: string | null): Promise<Record<KitSource, string>> {
  const existing = await prisma.referralLink.findMany({ where: { label: { startsWith: kitLabelPrefix(kind, id) } }, select: { label: true, code: true } })
  const out = {} as Record<KitSource, string>
  for (const { source } of KIT_SOURCES) {
    const label = kitLabel(kind, id, source)
    const found = existing.find((l) => l.label === label)
    const referrerKind = kind === 'COLLEGE' ? 'HIGHER_ED' : kind === 'EMPLOYER' ? 'EMPLOYER' : 'OTHER'
    out[source] = found
      ? found.code
      : (await prisma.referralLink.create({ data: { code: newReferralCode(), label, kind: referrerKind, createdBy }, select: { code: true } })).code
  }
  return out
}

/** The codes already made, by place; empty when the kit has not been prepared. */
export async function kitCodes(kind: KitKind, id: string): Promise<Partial<Record<KitSource, string>>> {
  const rows = await prisma.referralLink.findMany({ where: { label: { startsWith: kitLabelPrefix(kind, id) } }, select: { label: true, code: true } })
  const out: Partial<Record<KitSource, string>> = {}
  for (const r of rows) {
    const parsed = parseKitLabelAny(r.label)
    if (parsed && parsed.kind === kind && parsed.id === id) out[parsed.source as KitSource] = r.code
  }
  return out
}

/** Clicks, and people who registered after a click, for each place. Joined counts under the floor come back as null. */
export async function kitStats(kind: KitKind, id: string): Promise<KitStats> {
  const links = await prisma.referralLink.findMany({ where: { label: { startsWith: kitLabelPrefix(kind, id) } }, select: { id: true, label: true, clickCount: true } })
  const joins = await prisma.candidateReferral.groupBy({ by: ['referralLinkId'], where: { referralLinkId: { in: links.map((l) => l.id) } }, _count: { _all: true } })
  const byLink = new Map(joins.map((j) => [j.referralLinkId, j._count._all]))
  return summarizeKit(
    links.flatMap((l) => {
      const parsed = parseKitLabelAny(l.label)
      return parsed ? [{ source: parsed.source, clicks: l.clickCount, joined: byLink.get(l.id) ?? 0 }] : []
    }),
  )
}

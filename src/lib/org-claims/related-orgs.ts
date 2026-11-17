import 'server-only'
import { randomBytes } from 'crypto'
import { prisma } from '@/lib/prisma'
import { normalizeOrgName } from '@/lib/text/org-name-match'
import { claimSlug, SITE_URL } from './urls'
import { uniqueClaimSlugs } from './org'

// Related organizations (owner decision 2026-11-17). A free college or workforce organization links the organizations it
// works with, but only ones that have their own public page on NextChapter: the invite is that page's claim link, tagged
// with who sent it (?via=<invite token>). When NextChapter approves that organization's claim, the two are connected: the
// inviter sees "Has its own portal", and the new organization sees who linked to it. That is the loop: every organization
// that joins can bring in the next.
//
// Stored on EcosystemPartner (the Talent Hub's partner directory) with source CRM_ORG, so a workforce organization sees the
// same partners on its Ecosystem tab.

export const RELATED_SOURCE = 'CRM_ORG'

const KIND_FOR: [string, string][] = [
  ['UNIVERSITY', 'COLLEGE'],
  ['EMPLOYER', 'EMPLOYER'],
  ['WORKFORCE_PROVIDER', 'PROVIDER'],
  ['GOVERNMENT', 'COMMUNITY'],
  ['NONPROFIT', 'COMMUNITY'],
  ['FOUNDATION', 'COMMUNITY'],
]
export function partnerKindFor(orgTypes: string[]): string {
  return KIND_FOR.find(([t]) => orgTypes.includes(t))?.[1] ?? 'OTHER'
}

export const relatedInviteUrl = (slug: string, token: string) => `${SITE_URL}/prepared/${slug}?via=${encodeURIComponent(token)}`

export type ClaimableResult = { crmOrgId: string; name: string; slug: string; orgTypes: string[] }

// Organizations whose public page can be claimed, by name. Prefix search on the indexed normalized name (CrmOrganization
// is ~107k rows; never scanned), at most 25 narrow rows, then only names whose claim address resolves to one record.
export async function searchClaimableOrgs(q: string, excludeCrmOrgId: string | null): Promise<ClaimableResult[]> {
  const key = normalizeOrgName(q)
  if (key.length < 3) return []
  const rows = await prisma.crmOrganization.findMany({
    where: { canonicalNameNormalized: { startsWith: key }, ...(excludeCrmOrgId ? { id: { not: excludeCrmOrgId } } : {}) },
    select: { id: true, name: true, canonicalNameNormalized: true, orgTypes: true },
    orderBy: { canonicalNameNormalized: 'asc' },
    take: 25,
  })
  const withSlug = rows.map((r) => ({ r, slug: claimSlug(r.canonicalNameNormalized) })).filter((x): x is { r: (typeof rows)[number]; slug: string } => !!x.slug)
  const ok = await uniqueClaimSlugs(withSlug.map((x) => x.slug))
  return withSlug.filter((x) => ok.has(x.slug)).map((x) => ({ crmOrgId: x.r.id, name: x.r.name, slug: x.slug, orgTypes: x.r.orgTypes.map(String) }))
}

export type AddResult = { ok: true; partnerId: string; inviteUrl: string; alreadyOnNextChapter: boolean } | { ok: false; error: string }

// Links one organization. Idempotent per (institution, organization). An organization that already has its own portal is
// connected straight away.
export async function addRelatedOrg(args: { institutionId: string; institutionCrmOrgId: string | null; crmOrgId: string; createdBy: string }): Promise<AddResult> {
  if (args.crmOrgId === args.institutionCrmOrgId) return { ok: false, error: 'That is your own organization.' }
  const org = await prisma.crmOrganization.findUnique({ where: { id: args.crmOrgId }, select: { id: true, name: true, canonicalNameNormalized: true, orgTypes: true } })
  const slug = org ? claimSlug(org.canonicalNameNormalized) : null
  if (!org || !slug || !(await uniqueClaimSlugs([slug])).has(slug)) return { ok: false, error: 'That organization has no public page on NextChapter yet, so it cannot be linked.' }
  const portal = await prisma.institution.findUnique({ where: { crmOrganizationId: org.id }, select: { id: true } })
  const existing = await prisma.ecosystemPartner.findUnique({
    where: { institutionId_source_refId: { institutionId: args.institutionId, source: RELATED_SOURCE, refId: org.id } },
    select: { id: true, inviteToken: true },
  })
  const token = existing?.inviteToken ?? randomBytes(24).toString('base64url')
  const data = {
    name: org.name, kind: partnerKindFor(org.orgTypes.map(String)), crmOrganizationId: org.id, inviteToken: token,
    ...(portal ? { linkedInstitutionId: portal.id, status: 'CONFIRMED', decidedAt: new Date(), decidedBy: 'already on NextChapter' } : { status: 'INVITED', invitedAt: new Date() }),
  }
  const row = existing
    ? await prisma.ecosystemPartner.update({ where: { id: existing.id }, data, select: { id: true } })
    : await prisma.ecosystemPartner.create({ data: { institutionId: args.institutionId, source: RELATED_SOURCE, refId: org.id, createdBy: args.createdBy, ...data }, select: { id: true } })
  return { ok: true, partnerId: row.id, inviteUrl: relatedInviteUrl(slug, token), alreadyOnNextChapter: !!portal }
}

export async function removeRelatedOrg(institutionId: string, partnerId: string): Promise<boolean> {
  const r = await prisma.ecosystemPartner.deleteMany({ where: { id: partnerId, institutionId, source: RELATED_SOURCE } })
  return r.count > 0
}

export type RelatedRow = { id: string; name: string; kind: string; slug: string | null; inviteUrl: string | null; state: 'invited' | 'claimed' | 'connected'; linkedSlug: string | null }

// The organizations this one linked, with where each stands, and the ones that linked to it.
export async function relatedOrgs(institutionId: string): Promise<{ linked: RelatedRow[]; linkedYou: { name: string; slug: string }[] }> {
  const [rows, inbound] = await Promise.all([
    prisma.ecosystemPartner.findMany({
      where: { institutionId, crmOrganizationId: { not: null } },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: { id: true, name: true, kind: true, inviteToken: true, crmOrganizationId: true, linkedInstitutionId: true },
    }),
    prisma.ecosystemPartner.findMany({
      where: { linkedInstitutionId: institutionId },
      take: 200,
      select: { institution: { select: { name: true, slug: true } } },
    }),
  ])
  const orgIds = rows.map((r) => r.crmOrganizationId!).filter(Boolean)
  const [orgs, claims, portals] = orgIds.length
    ? await Promise.all([
        prisma.crmOrganization.findMany({ where: { id: { in: orgIds } }, select: { id: true, canonicalNameNormalized: true } }),
        prisma.orgClaim.findMany({ where: { crmOrganizationId: { in: orgIds }, verifiedAt: { not: null }, declinedAt: null }, select: { crmOrganizationId: true } }),
        prisma.institution.findMany({ where: { id: { in: rows.map((r) => r.linkedInstitutionId).filter((x): x is string => !!x) } }, select: { id: true, slug: true } }),
      ])
    : [[], [], []]
  const slugOf = new Map(orgs.map((o) => [o.id, claimSlug(o.canonicalNameNormalized)]))
  const claimed = new Set(claims.map((c) => c.crmOrganizationId))
  const portalSlug = new Map(portals.map((p) => [p.id, p.slug]))
  const linked = rows.map((r) => {
    const slug = slugOf.get(r.crmOrganizationId!) ?? null
    return {
      id: r.id, name: r.name, kind: r.kind, slug,
      inviteUrl: slug && r.inviteToken ? relatedInviteUrl(slug, r.inviteToken) : null,
      state: (r.linkedInstitutionId ? 'connected' : claimed.has(r.crmOrganizationId!) ? 'claimed' : 'invited') as RelatedRow['state'],
      linkedSlug: r.linkedInstitutionId ? (portalSlug.get(r.linkedInstitutionId) ?? null) : null,
    }
  })
  const seen = new Set<string>()
  const linkedYou = inbound.map((i) => i.institution).filter((i) => (seen.has(i.slug) ? false : (seen.add(i.slug), true)))
  return { linked, linkedYou }
}

// The invite a claimant came from, if the token belongs to a link for this same organization.
export async function referralFor(token: string | null | undefined, crmOrgId: string): Promise<{ partnerId: string; inviterName: string } | null> {
  if (!token || !/^[A-Za-z0-9_-]{24,64}$/.test(token)) return null
  const p = await prisma.ecosystemPartner.findUnique({ where: { inviteToken: token }, select: { id: true, crmOrganizationId: true, institution: { select: { name: true } } } })
  return p && p.crmOrganizationId === crmOrgId ? { partnerId: p.id, inviterName: p.institution.name } : null
}

// After NextChapter approves an organization's claim: every organization that linked it is connected to its new portal
// (or, for an employer, marked confirmed). Never throws.
export async function connectRelated(args: { crmOrgId: string; institutionId: string | null; referredByPartnerId: string | null }): Promise<number> {
  try {
    const r = await prisma.ecosystemPartner.updateMany({
      where: { OR: [{ crmOrganizationId: args.crmOrgId }, ...(args.referredByPartnerId ? [{ id: args.referredByPartnerId }] : [])], linkedInstitutionId: null },
      data: { status: 'CONFIRMED', decidedAt: new Date(), decidedBy: 'claim approved', ...(args.institutionId ? { linkedInstitutionId: args.institutionId } : {}) },
    })
    return r.count
  } catch (e) {
    console.error('connectRelated failed', e)
    return 0
  }
}

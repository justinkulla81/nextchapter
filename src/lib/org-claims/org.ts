import 'server-only'
import { prisma } from '@/lib/prisma'
import { canonicalCandidates, claimSlug, isSlugOverride } from '@/lib/org-claims/urls'
import { PROSPECTS } from '@/lib/prospects/config'

export interface ClaimableOrg {
  id: string
  name: string
  slug: string
  emailDomain: string | null
  orgTypes: string[]
}

/**
 * The CRM organization a /prepared/<slug> address stands for. The three hand-built prospects are never resolved here,
 * and a slug only counts when the organization's own slug is exactly it.
 */
export async function resolveClaimableOrg(slug: string): Promise<ClaimableOrg | null> {
  if (PROSPECTS[slug] || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return null
  const found = await prisma.crmOrganization.findMany({
    where: { canonicalNameNormalized: { in: canonicalCandidates(slug) } },
    select: { id: true, name: true, canonicalNameNormalized: true, emailDomain: true, orgTypes: true },
  })
  // Two stored names that read to the same address ('a and b', 'a & b') are ambiguous: neither gets a page.
  let matches = found.filter((o) => claimSlug(o.canonicalNameNormalized) === slug)
  // A hand-picked address wins over a name that merely reads the same.
  if (matches.length > 1) matches = matches.filter((o) => isSlugOverride(o.canonicalNameNormalized))
  if (matches.length !== 1) return null
  const org = matches[0]
  return { id: org.id, name: org.name, slug, emailDomain: org.emailDomain, orgTypes: org.orgTypes }
}

/**
 * Which of these claim addresses resolve to exactly one organization, in one query. A page links to a claim address only
 * when it is in this set: resolveClaimableOrg refuses an address two stored names share ('a & b' and 'a and b'), and a link to
 * one is a 404.
 */
export async function uniqueClaimSlugs(slugs: string[]): Promise<Set<string>> {
  const wanted = new Set(slugs.filter((s) => !PROSPECTS[s] && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(s)))
  if (wanted.size === 0) return new Set()
  const candidates = new Map<string, string[]>()
  for (const s of wanted) for (const c of canonicalCandidates(s)) candidates.set(c, [...(candidates.get(c) ?? []), s])
  const found = await prisma.crmOrganization.findMany({
    where: { canonicalNameNormalized: { in: [...candidates.keys()] } },
    select: { canonicalNameNormalized: true },
  })
  const count = new Map<string, number>()
  for (const o of found) {
    const slug = claimSlug(o.canonicalNameNormalized)
    if (slug && wanted.has(slug)) count.set(slug, (count.get(slug) ?? 0) + 1)
  }
  return new Set([...wanted].filter((s) => count.get(s) === 1))
}

/** True when two or more stored names read to this address and none is hand-picked: the page cannot say which one it is. */
export async function claimSlugIsAmbiguous(slug: string): Promise<boolean> {
  if (PROSPECTS[slug] || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return false
  const found = await prisma.crmOrganization.findMany({
    where: { canonicalNameNormalized: { in: canonicalCandidates(slug) } },
    select: { canonicalNameNormalized: true },
  })
  const matches = found.filter((o) => claimSlug(o.canonicalNameNormalized) === slug)
  return matches.length > 1 && matches.filter((o) => isSlugOverride(o.canonicalNameNormalized)).length !== 1
}

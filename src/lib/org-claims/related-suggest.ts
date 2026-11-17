import 'server-only'
// Who we think an organization knows, to offer as one-click links (and so as invitations to claim their own page). Everything here comes from
// data we already hold, each read is narrow and bounded, and the result is shared for 30 minutes per organization. Only organizations with
// a public page that can be claimed are ever offered (the same test as linking one by name). Workforce organizations and colleges each get
// their own starting points; the matching, exclusions and caps are the same.

import { prisma } from '@/lib/prisma'
import { memoTtl } from '@/lib/db/heavy'
import { normalizeOrgName } from '@/lib/text/org-name-match'
import { readLocal } from '@/lib/workforce/local'
import { orgKindOf } from '@/lib/higher-ed/workspaces'
import { readProfile } from '@/lib/higher-ed/profile'
import { nearbyColleges } from '@/lib/workforce/colleges-near'
import { loadRegionJobs } from '@/components/higher-ed/screens-hub-jobs'
import { claimSlug } from './urls'
import { uniqueClaimSlugs } from './org'
import { isLikelyPeerName, mergeSuggestions, type Candidate, type Hit, type Suggestion } from './related-suggest-rules'

const keyOf = (...names: (string | null | undefined)[]) => [...new Set(names.filter((n): n is string => !!n).map((n) => normalizeOrgName(n)).filter(Boolean))]

type Direct = Map<string, Hit>

// Chambers, economic development and community partners that carry the city's name (indexed by state; the kind-of-work filter runs on the
// few rows returned, in name order). A chamber in another city of the state is not a peer.
async function peersInCity(state: string, city: string, candidates: Candidate[], direct: Direct) {
  const found = await prisma.crmOrganization.findMany({
    where: {
      usState: state,
      NOT: { orgTypes: { has: 'UNIVERSITY' } },
      orgTypes: { hasSome: ['GOVERNMENT', 'NONPROFIT', 'FOUNDATION', 'WORKFORCE_PROVIDER', 'OTHER', 'FUNDER_GRANT'] },
      name: { contains: city, mode: 'insensitive' },
    },
    orderBy: { canonicalNameNormalized: 'asc' },
    take: 40,
    select: { id: true, name: true, canonicalNameNormalized: true, orgTypes: true },
  })
  for (const p of found.filter((x) => isLikelyPeerName(x.name)).slice(0, 6)) {
    const slug = claimSlug(p.canonicalNameNormalized)
    if (!slug) continue
    direct.set(p.canonicalNameNormalized, { orgId: p.id, name: p.name, slug, orgTypes: p.orgTypes.map(String) })
    candidates.push({ group: 'PEERS', keys: [p.canonicalNameNormalized], reason: 'Works on jobs and growth near you' })
  }
}

// The employers posting the most jobs in the city (the region's job list, already cached and shared).
async function hiringEmployers(city: string, state: string, candidates: Candidate[]) {
  const jobs = await loadRegionJobs(city, state).catch(() => [])
  const posted = new Map<string, { name: string; n: number }>()
  for (const j of jobs) {
    const k = normalizeOrgName(j.companyName)
    if (k) posted.set(k, { name: j.companyName, n: (posted.get(k)?.n ?? 0) + 1 })
  }
  for (const p of [...posted.values()].sort((a, b) => b.n - a.n).slice(0, 25)) candidates.push({ group: 'EMPLOYERS', keys: keyOf(p.name), reason: `Hiring in ${city}: ${p.n} open job${p.n === 1 ? '' : 's'}` })
}

type Loaded = { ordered: Suggestion[] }

// The slow part: candidates from our data, matched to stored organizations. Not yet narrowed by what is already linked.
const loadOrdered = memoTtl(30 * 60_000, (institutionId: string) => institutionId, async (institutionId: string): Promise<Loaded> => {
  const inst = await prisma.institution.findUniqueOrThrow({ where: { id: institutionId }, select: { crmOrganizationId: true, orgType: true, enabledFeatures: true, profile: true } })
  const kind = orgKindOf(inst.orgType)
  const candidates: Candidate[] = []
  const direct: Direct = new Map()

  if (kind === 'workforce') {
    const local = readLocal(inst.enabledFeatures)
    if (local) {
      const areas = ((inst.profile as { region?: { areas?: { state: string; counties?: string[] }[] } } | null)?.region?.areas ?? []).filter((a) => a.state === local.anchorState)
      const counties = [...new Set(areas.flatMap((a) => a.counties ?? []))]
      const boards = await prisma.workforceBoard.findMany({
        where: { state: local.anchorState, OR: [...(counties.length ? [{ counties: { hasSome: counties } }] : []), { statewide: true }] },
        take: 3,
        select: { id: true, name: true, knownAs: true },
      })
      for (const b of boards) candidates.push({ group: 'PEERS', keys: keyOf(b.name, b.knownAs), reason: 'The workforce board for your area' })
      if (boards.length) {
        const centers = await prisma.americanJobCenter.findMany({ where: { workforceBoardId: { in: boards.map((b) => b.id) } }, take: 12, select: { name: true, city: true } })
        for (const c of centers) candidates.push({ group: 'PEERS', keys: keyOf(c.name), reason: `Job center${c.city ? ` in ${c.city}` : ''}` })
      }
      await peersInCity(local.anchorState, local.anchorCity, candidates, direct)
      // Member companies first (they already work with you), then the employers posting the most jobs near you.
      const members = await prisma.memberCompany.findMany({ where: { institutionId }, take: 40, select: { name: true } })
      for (const m of members) candidates.push({ group: 'EMPLOYERS', keys: keyOf(m.name), reason: 'One of your member companies' })
      await hiringEmployers(local.anchorCity, local.anchorState, candidates)
      for (const c of await nearbyColleges(institutionId).catch(() => [])) candidates.push({ group: 'HIGHER_ED', keys: keyOf(c.name), reason: `Near ${c.city ?? local.anchorCity}${c.enrollment ? `, about ${Math.round(c.enrollment / 100) * 100} students` : ''}` })
    }
  } else {
    // A college: what its own profile already says about its region, then who is hiring and who else teaches in its city.
    const p = readProfile(inst.profile)
    const city = p.college?.city ?? null
    const state = (p.college?.state ?? p.region?.state ?? '').toUpperCase() || null
    if (p.workforce?.board?.name) candidates.push({ group: 'PEERS', keys: keyOf(p.workforce.board.name), reason: 'The workforce board for your area' })
    for (const l of p.workforce?.careerLinks ?? []) candidates.push({ group: 'PEERS', keys: keyOf(l.name), reason: 'A career center in your area' })
    if (city && state) await peersInCity(state, city, candidates, direct)
    for (const n of p.region?.topEmployers?.names ?? []) candidates.push({ group: 'EMPLOYERS', keys: keyOf(n), reason: 'A top employer in your region' })
    if (city && state) {
      await hiringEmployers(city, state, candidates)
      const others = await prisma.collegeProfile.findMany({
        where: { state, city: { equals: city, mode: 'insensitive' }, enrollment: { gt: 400 }, ...(p.college?.unitid ? { unitid: { not: p.college.unitid } } : {}) },
        orderBy: { enrollment: 'desc' },
        take: 12,
        select: { name: true, enrollment: true },
      })
      for (const c of others) candidates.push({ group: 'HIGHER_ED', keys: keyOf(c.name), reason: `Also in ${city}${c.enrollment ? `, about ${Math.round(c.enrollment / 100) * 100} students` : ''}` })
    }
  }

  const wanted = [...new Set(candidates.flatMap((c) => c.keys))].filter((k) => !direct.has(k))
  const rows = wanted.length ? await prisma.crmOrganization.findMany({ where: { canonicalNameNormalized: { in: wanted } }, select: { id: true, name: true, canonicalNameNormalized: true, orgTypes: true } }) : []
  const slugs = rows.map((r) => ({ r, slug: claimSlug(r.canonicalNameNormalized) })).filter((x): x is { r: (typeof rows)[number]; slug: string } => !!x.slug)
  const ok = await uniqueClaimSlugs(slugs.map((x) => x.slug))
  const hits = new Map<string, Hit>(direct)
  for (const x of slugs) if (ok.has(x.slug)) hits.set(x.r.canonicalNameNormalized, { orgId: x.r.id, name: x.r.name, slug: x.slug, orgTypes: x.r.orgTypes.map(String) })
  return { ordered: mergeSuggestions(candidates, hits, new Set(inst.crmOrganizationId ? [inst.crmOrganizationId] : [])) }
})

export type SuggestedOrg = Suggestion & { onNextChapter: boolean }

/** The organizations we think this one knows and has not linked yet, each with whether it already has its own portal. */
export async function suggestRelated(institutionId: string): Promise<SuggestedOrg[]> {
  const { ordered } = await loadOrdered(institutionId)
  if (ordered.length === 0) return []
  const ids = ordered.map((s) => s.orgId)
  const [linked, portals] = await Promise.all([
    prisma.ecosystemPartner.findMany({ where: { institutionId, crmOrganizationId: { in: ids } }, select: { crmOrganizationId: true } }),
    prisma.institution.findMany({ where: { crmOrganizationId: { in: ids } }, select: { crmOrganizationId: true } }),
  ])
  const done = new Set(linked.map((l) => l.crmOrganizationId))
  const onNc = new Set(portals.map((p) => p.crmOrganizationId))
  return ordered.filter((s) => !done.has(s.orgId)).map((s) => ({ ...s, onNextChapter: onNc.has(s.orgId) }))
}

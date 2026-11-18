import 'server-only'
// A new organization portal starts with its region already set, read from the organization's own public page (owner decision
// 2026-11-18): the anchor city that ranks jobs, skills and employers (enabledFeatures.local, which the admin can change on
// Talent Hub › Reports › Kept in region) and the counties that drive the local market and WARN layoffs (profile.region, which
// NextChapter staff can change in support admin). Without a linked page, or when the page names no city or county, nothing is set
// and the portal asks for its region as before. Never overwrites a region already there, and never throws.

import { prisma } from '@/lib/prisma'
import { getStateOrgList, resolveArea } from '@/lib/seo/org-pages'
import { stateSlug } from '@/lib/seo/states'
import { countyKey } from '@/lib/workforce/places'
import { placeAt, readLocal } from '@/lib/workforce/local'

const PAGE_KINDS = ['ECON_DEV', 'WORKFORCE_BOARD', 'JOB_CENTER'] as const
const RADIUS_MILES = 40

export type PageRegion = { anchorCity: string | null; state: string; counties: string[]; name: string }

/** The region an organization's public page shows, or null. Reads the state's cached page list (shared, 24 hours). */
export async function regionFromPublicPage(crmOrgId: string): Promise<PageRegion | null> {
  const links = await prisma.publicOrgPage.findMany({ where: { crmOrgId, kind: { in: [...PAGE_KINDS] } }, select: { kind: true, sourceId: true, state: true } })
  const link = PAGE_KINDS.map((k) => links.find((l) => l.kind === k)).find(Boolean)
  if (!link) return null
  const list = await getStateOrgList(link.kind as (typeof PAGE_KINDS)[number], stateSlug(link.state))
  const row = list?.rows.find((r) => r.id === link.sourceId || r.aliasIds?.includes(link.sourceId))
  if (!row || !list) return null
  const area = resolveArea(row, list.stateData)
  const counties = area.statewide ? [] : [...new Set(area.counties.map((c) => countyKey(c.name)).filter(Boolean))]
  const anchorCity = row.city?.trim() || null
  if (!anchorCity && counties.length === 0) return null
  return { anchorCity, state: row.state, counties, name: anchorCity ? `${anchorCity} area` : `${row.name} area` }
}

/** Sets the new portal's region from its public page. Returns what was set, for the provisioning event. */
export async function seedRegion(institutionId: string, crmOrgId: string): Promise<{ local: boolean; counties: number }> {
  try {
    const region = await regionFromPublicPage(crmOrgId)
    if (!region) return { local: false, counties: 0 }
    const inst = await prisma.institution.findUnique({ where: { id: institutionId }, select: { enabledFeatures: true, profile: true } })
    if (!inst) return { local: false, counties: 0 }
    const ef = { ...((inst.enabledFeatures as Record<string, unknown> | null) ?? {}) }
    const profile = { ...((inst.profile as Record<string, unknown> | null) ?? {}) }
    let local = false
    if (!readLocal(ef) && region.anchorCity && (await placeAt(region.anchorCity, region.state))) {
      ef.local = { anchorCity: region.anchorCity, anchorState: region.state, radiusMiles: RADIUS_MILES, label: `the ${region.anchorCity} area` }
      local = true
    }
    const hasRegion = !!(profile.region as { state?: string } | undefined)?.state
    const setCounties = !hasRegion && region.counties.length > 0
    if (setCounties) {
      profile.region = { ...((profile.region as Record<string, unknown> | null) ?? {}), name: region.name, state: region.state, counties: region.counties, areas: [{ state: region.state, counties: region.counties }] }
    }
    if (local || setCounties) await prisma.institution.update({ where: { id: institutionId }, data: { ...(local ? { enabledFeatures: ef as object } : {}), ...(setCounties ? { profile: profile as object } : {}) } })
    return { local, counties: setCounties ? region.counties.length : 0 }
  } catch (e) {
    console.error('seedRegion failed', institutionId, e)
    return { local: false, counties: 0 }
  }
}

import 'server-only'
import { prisma } from '@/lib/prisma'
import { orgSlug, canonicalFromSlug } from '@/lib/crm/org-slug'
import { resolveOrgPlace, type PlaceBasis } from '@/lib/crm/org-place'
import { getNoticesFor } from '@/lib/prospects/market'
import { STATE_NAMES } from '@/lib/workforce/places'

export const WINDOW_DAYS = 180
export const STATS_SOURCE = 'State WARN Act layoff filings'

export interface CommunityStats {
  orgId: string
  orgName: string
  slug: string | null
  place: { state: string; stateName: string; countyName: string | null; city: string | null; basis: PlaceBasis }
  /** What the figures are for: the organization's county, or the whole state when the county is unknown or had no notices we could place. */
  scope: 'county' | 'state'
  window: { days: number; from: Date; to: Date }
  source: string
  /** Null when we hold no layoff-notice data for the place. A missing figure is never shown as zero. */
  warn: { notices: number; workers: number; employers: number } | null
}

export type StatsRef = { crmOrgId: string } | { slug: string }

const baseCounty = (name: string) => name.replace(/\s+(county|parish)$/i, '').trim().toLowerCase()

/**
 * Community numbers for an organization's place, from data we hold: state WARN layoff filings in the last six months for its county,
 * else its state. Null when the organization is unknown, has no place we can tell, or anything fails. Never an invented figure.
 */
export async function communityStatsFor(ref: StatsRef): Promise<CommunityStats | null> {
  try {
    const org = 'crmOrgId' in ref
      ? await prisma.crmOrganization.findUnique({ where: { id: ref.crmOrgId }, select: { id: true, name: true, canonicalNameNormalized: true } })
      : await prisma.crmOrganization.findUnique({ where: { canonicalNameNormalized: canonicalFromSlug(ref.slug) }, select: { id: true, name: true, canonicalNameNormalized: true } })
    if (!org) return null
    const place = await resolveOrgPlace(org.id)
    if (!place || !STATE_NAMES[place.state]) return null

    const to = new Date()
    const from = new Date(to.getTime() - WINDOW_DAYS * 86_400_000)
    const summary = await getNoticesFor(
      { state: place.state, counties: place.countyName ? [baseCounty(place.countyName)] : [], cityWords: place.countyName && place.city ? [place.city.toLowerCase()] : [] },
      WINDOW_DAYS,
    )
    const hasData = summary.notices > 0
    return {
      orgId: org.id,
      orgName: org.name,
      slug: orgSlug(org.canonicalNameNormalized),
      place: { state: place.state, stateName: STATE_NAMES[place.state], countyName: place.countyName, city: place.city, basis: place.basis },
      scope: summary.scope === 'region' ? 'county' : 'state',
      window: { days: WINDOW_DAYS, from, to },
      source: STATS_SOURCE,
      warn: hasData ? { notices: summary.notices, workers: summary.jobs, employers: summary.employers } : null,
    }
  } catch (e) {
    console.error('communityStatsFor failed', e)
    return null
  }
}

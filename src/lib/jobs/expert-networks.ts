import 'server-only'
import { InterimListingCategory } from '@prisma/client'
import { getActiveListings } from '@/lib/interim-work/listings'
import { PLATFORM_DIRECTORY, platformsForSenderDomain } from '@/lib/platforms/directory'
import { getPlatformActivity } from '@/lib/platforms/candidate-view'

export interface ExpertNetworkCard {
  /** InterimListing id, or the platform directory key for directory-only networks. */
  id: string
  name: string
  description: string | null
  url: string
  logoUrl: string | null
  partner: boolean
  /** Furthest stage read from the network's own email, e.g. "Accepted". */
  stage: string | null
}

/**
 * "Get paid for your expertise": the curated expert-network listings (admin-edited,
 * with descriptions and logos) first, then every other expert network in the
 * platform-tracking directory, linked to its own site. Each shows how far the
 * member has got there when their Gmail shows it.
 */
export async function loadExpertNetworks(candidateId: string): Promise<ExpertNetworkCard[]> {
  const [listings, activity] = await Promise.all([
    getActiveListings([InterimListingCategory.EXPERT_NETWORK]),
    getPlatformActivity(candidateId, 'WORK'),
  ])
  const stageByKey = new Map(activity.filter((r) => !r.dismissed).map((r) => [r.platformKey, r.label]))
  const covered = new Set<string>()
  const cards: ExpertNetworkCard[] = listings.map((l) => {
    let keys: string[] = []
    try {
      keys = platformsForSenderDomain(new URL(l.url).hostname).map((p) => p.key)
    } catch {}
    keys.forEach((k) => covered.add(k))
    return {
      id: l.id,
      name: l.name,
      description: l.description,
      url: l.url,
      logoUrl: l.logoUrl,
      partner: l.designation === 'PARTNER',
      stage: keys.map((k) => stageByKey.get(k)).find(Boolean) ?? null,
    }
  })
  for (const p of PLATFORM_DIRECTORY) {
    if (p.category !== 'EXPERT_NETWORK' || covered.has(p.key) || !p.domains[0]) continue
    cards.push({
      id: p.key,
      name: p.name,
      description: null,
      url: `https://${p.domains[0]}`,
      logoUrl: null,
      partner: false,
      stage: stageByKey.get(p.key) ?? null,
    })
  }
  return cards
}

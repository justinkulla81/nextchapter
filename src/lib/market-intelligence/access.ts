import 'server-only'
import type { OutplacementTier } from '@prisma/client'
import { prisma } from '@/lib/prisma'

// Partners Master Build Script §A3.3 — Market Intelligence tiers. Reuses
// Prisma's own OutplacementTier enum (CORE | PLUS | PREMIUM) directly as
// the Market Intelligence tier rather than inventing a parallel tier
// name/type — the spec's §A3.3 table is literally the same Core/Plus/
// Premium row that already appears in §A2.2's outplacement pricing table,
// and this phase's own instructions say to verify and reuse that concept
// rather than create a second one.
export type MarketIntelTier = OutplacementTier

export type MarketIntelFeature =
  | 'company_pages'
  | 'hiring_trajectory'
  | 'posting_age'
  | 'skills_demanded'
  | 'comp_bands'
  | 'insider_network'
  | 'target_list_builder'
  | 'decision_maker_mapping'
  | 'contact_data'
  | 'pe_vc_ownership'
  | 'weekly_brief'

const FEATURE_MIN_TIER: Record<MarketIntelFeature, MarketIntelTier> = {
  // §A3.3 row 1 — all tiers, including candidates with no verified plan at
  // all (the DTC Free plan's own contents list already names "company
  // pages" per §A2.3, so this has to stay open, not locked to CORE).
  company_pages: 'CORE',
  hiring_trajectory: 'CORE',
  posting_age: 'CORE',
  skills_demanded: 'CORE',
  // §A3.3 row 2 — Plus and above.
  comp_bands: 'PLUS',
  insider_network: 'PLUS',
  // §A3.3 row 3 — Premium only.
  target_list_builder: 'PREMIUM',
  decision_maker_mapping: 'PREMIUM',
  contact_data: 'PREMIUM',
  pe_vc_ownership: 'PREMIUM',
  weekly_brief: 'PREMIUM',
}

const TIER_RANK: Record<MarketIntelTier, number> = { CORE: 0, PLUS: 1, PREMIUM: 2 }

// The ONLY real, currently-verifiable per-candidate plan signal in this
// codebase is an activated OutplacementSeat's contract tier — confirmed by
// this phase's own investigation (see report): there is no live DTC
// billing/subscription anywhere (no Stripe integration, no
// CandidateProfile.planKey/tier field, no CoachingEngagement model), so a
// DTC Coaching Plus/Premium subscriber cannot be distinguished from a Free
// candidate today. Membership (MembershipSubscription) is a real, separate
// subscription, but its own feature list (§A2.4) does not include Market
// Intelligence's Plus/Premium items — it's read here as "not a signal for
// this gate," same as it already isn't read by insider-network.ts.
//
// This means: a DTC-only candidate, however much they're actually paying,
// resolves to CORE until real DTC subscription tracking exists somewhere
// this function can read. That is a real product gap, not a design choice
// — flagged in this phase's report rather than papered over with a guess.
// OutplacementSeat.candidateId is otherwise never read by org-side/
// reporting code (see that model's own schema comment) — reading it here
// is the same sanctioned "candidate reading their own placement" exception
// src/lib/membership/activate-alum.ts already relies on.
export async function getCandidateMarketIntelTier(candidateId: string): Promise<MarketIntelTier> {
  const seat = await prisma.outplacementSeat.findFirst({
    where: { candidateId, status: 'ACTIVATED', contract: { status: 'ACTIVE' } },
    select: { contract: { select: { tier: true } } },
    orderBy: { activatedAt: 'desc' },
  })
  return seat?.contract.tier ?? 'CORE'
}

// Pure — for a page that already resolved the candidate's tier once and
// needs to check several features against it without a query per check.
export function tierMeetsFeature(tier: MarketIntelTier, feature: MarketIntelFeature): boolean {
  return TIER_RANK[tier] >= TIER_RANK[FEATURE_MIN_TIER[feature]]
}

export async function hasMarketIntelligenceAccess(candidateId: string, feature: MarketIntelFeature): Promise<boolean> {
  const tier = await getCandidateMarketIntelTier(candidateId)
  return tierMeetsFeature(tier, feature)
}

// For UI copy — "you need Plus" vs "you need Premium" — without a second
// caller having to duplicate FEATURE_MIN_TIER.
export function minTierForFeature(feature: MarketIntelFeature): MarketIntelTier {
  return FEATURE_MIN_TIER[feature]
}

export const MARKET_INTEL_TIER_LABEL: Record<MarketIntelTier, string> = {
  CORE: 'Core',
  PLUS: 'Plus',
  PREMIUM: 'Premium',
}

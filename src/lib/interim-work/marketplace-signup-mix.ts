import type { InterimListingCategory } from '@prisma/client'

// "Well-rounded interim pursuit" nudge for the Interim Work progressive-
// unlock card — same shape as computeRequiredMix (references). Grouped
// along the same three tracks the Interim Work page itself is organized
// into (Section 2 Marketplaces, Section 3 Expert Networks, Section 4 Board
// & Advisory) rather than exposing all 8 InterimListingCategory values
// directly.
export interface MarketplaceSignupMixStatus {
  hasMarketplaceSignup: boolean
  hasExpertNetworkSignup: boolean
  hasBoardSignup: boolean
  satisfied: boolean
}

const MARKETPLACE_CATEGORIES: InterimListingCategory[] = [
  'MARKETPLACE_TECHNICAL',
  'MARKETPLACE_GENERAL',
  'MARKETPLACE_MARKETING',
  'MARKETPLACE_STARTUP',
  'MARKETPLACE_ANY_FUNCTION',
]
const BOARD_CATEGORIES: InterimListingCategory[] = ['BOARD_ADVISORY', 'NONPROFIT_BOARD']

export function computeMarketplaceSignupMix(categories: InterimListingCategory[]): MarketplaceSignupMixStatus {
  const hasMarketplaceSignup = categories.some((c) => MARKETPLACE_CATEGORIES.includes(c))
  const hasExpertNetworkSignup = categories.includes('EXPERT_NETWORK')
  const hasBoardSignup = categories.some((c) => BOARD_CATEGORIES.includes(c))
  return {
    hasMarketplaceSignup,
    hasExpertNetworkSignup,
    hasBoardSignup,
    satisfied: hasMarketplaceSignup && hasExpertNetworkSignup && hasBoardSignup,
  }
}

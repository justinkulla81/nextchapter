// Pure types for the Market Response Funnel — tracked separately from
// Search Execution. Execution measures whether the candidate is doing the
// work; this measures whether the market is actually responding to it.
// Deliberately no raw percentages implied beyond a simple reply-rate — see
// MarketResponseFunnel.tsx for how this renders.

export interface MarketResponseSnapshot {
  outreachSent: number
  repliesReceived: number
  conversations: number
  referrals: number
  interviews: number
  offers: number
  paidProjectLeads: number
}

export function isMarketResponseAllZero(snapshot: MarketResponseSnapshot): boolean {
  return Object.values(snapshot).every((v) => v === 0)
}

// Referral-first search mix. DISCOURAGE cold applications, ENCOURAGE networking
// and referrals — never cap or block. Referrals are about 1% of applications
// but about 40% reach interview, versus about 3% for inbound (Ashby data, as
// reported in the NextChapter Employment Report, Sept 2026). The nudge is
// advisory copy only: it must never disable applying or shame the candidate.

export interface WeeklySearchMix {
  warmConversations: number // two-way touchpoints with hiring managers, recruiters, colleagues, alumni
  referralAsks: number // asks for an intro or referral
  coldApplications: number // applications with no personal contact
}

export type NudgeLevel = 'none' | 'gentle' | 'strong'

export interface SearchMixNudge {
  level: NudgeLevel
  warmShare: number | null // warm / (warm + cold), null when nothing logged
  headline: string
  body: string
  convertSuggestion: number // how many cold applications to try turning into warm asks this week
}

const MIN_COLD_FOR_NUDGE = 5
const LOW_WARM_SHARE = 0.3

export function computeSearchMixNudge(mix: WeeklySearchMix): SearchMixNudge {
  const warm = Math.max(0, mix.warmConversations) + Math.max(0, mix.referralAsks)
  const cold = Math.max(0, mix.coldApplications)
  const total = warm + cold
  const warmShare = total > 0 ? warm / total : null

  if (cold < MIN_COLD_FOR_NUDGE || (warmShare !== null && warmShare >= LOW_WARM_SHARE)) {
    return {
      level: 'none',
      warmShare,
      headline: 'Your search mix looks balanced',
      body: 'Keep mixing applications with conversations. Introductions are still your best route to an interview.',
      convertSuggestion: 0,
    }
  }

  const strong = warmShare !== null && warmShare < 0.1 && cold >= 10
  return {
    level: strong ? 'strong' : 'gentle',
    warmShare,
    headline: 'Try turning a few applications into introductions',
    body:
      'Most of this week went to applications with no personal contact. Applications still count, but people who come through an introduction reach interview far more often (about 40% versus about 3% for cold applications, per the Ashby data in our September report). Pick a few roles from this list and ask someone who knows the company for an introduction.',
    convertSuggestion: Math.min(5, Math.max(1, Math.round(cold / 3))),
  }
}

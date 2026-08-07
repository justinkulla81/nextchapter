import type { NetworkingAnxiety } from '@prisma/client'

// The 5 onboarding-style anxiety answers collapse to 3 tiers here (the
// outreach plan below distinguishes 3 tiers of framing, not 5).
export type AnxietyTier = 'LOW' | 'MEDIUM' | 'HIGH'

export const ANXIETY_TIER_FOR: Record<NetworkingAnxiety, AnxietyTier> = {
  NOT_SURE_WHAT_TO_SAY: 'LOW',
  BURDEN_PEOPLE: 'MEDIUM',
  NETWORK_NOT_STRONG: 'MEDIUM',
  DONT_LIKE_ASKING_FOR_HELP: 'MEDIUM',
  ALREADY_USED_UP_NETWORK: 'HIGH',
  SEEM_DESPERATE: 'HIGH',
  OTHER: 'HIGH',
}

// The highest anxiety tier among a candidate's selected concerns — a
// candidate with any HIGH-tier concern gets the more careful framing, even
// if they also selected lower-tier ones.
export function highestAnxietyTier(concerns: NetworkingAnxiety[]): AnxietyTier {
  const tiers = concerns.map((c) => ANXIETY_TIER_FOR[c])
  if (tiers.includes('HIGH')) return 'HIGH'
  if (tiers.includes('MEDIUM')) return 'MEDIUM'
  if (tiers.includes('LOW')) return 'LOW'
  return 'MEDIUM'
}

const TIMING_BY_METHOD: Record<string, string> = {
  'In-person': 'Coffee or lunch, Tuesday–Thursday — avoids Monday catch-up chaos and Friday wind-down.',
  Zoom: "Late morning (10–11am) on a Tuesday–Thursday — people are focused but not yet in their post-lunch slump.",
  Phone: 'Early afternoon (1–3pm) on a weekday — past the morning inbox rush, before people start winding down.',
  Email: "Tuesday–Thursday morning — Monday inboxes are flooded, and it'll get buried if sent Friday afternoon.",
  Text: 'Weekday between 9am–6pm — treat it like a work-hours channel, not an anytime one.',
}

export interface OutreachPlan {
  timing: string
  agenda: string[]
}

// Templated, not LLM-generated — same reasoning as the message scripts
// above (deterministic, free, and this doesn't need generation quality to
// be useful). Combines the candidate's stated contact preference with their
// highest anxiety tier to produce a concrete day/time + a 3-part talking
// point structure for the actual conversation, not just the opening message.
export function getOutreachPlan(concerns: NetworkingAnxiety[], connectPreferences: string[]): OutreachPlan {
  const preferredMethod = connectPreferences[0]
  const timing = preferredMethod && TIMING_BY_METHOD[preferredMethod]
    ? TIMING_BY_METHOD[preferredMethod]
    : 'Tuesday–Thursday, mid-morning or early afternoon — avoids Monday catch-up and Friday wind-down for most people.'

  const tier = highestAnxietyTier(concerns)
  const agenda =
    tier === 'HIGH'
      ? [
          'Open by reconnecting, not asking — mention something specific and genuine before anything else.',
          "Name what you're looking for in one sentence, framed as sharing information rather than a favor.",
          "Close with a low-pressure ask: 'no worries either way' — and mean it.",
        ]
      : tier === 'MEDIUM'
        ? [
            'Open with the specific reason you thought of them.',
            "State your target clearly: what role, what you're looking for.",
            'Ask directly for one thing — an intro, a lead, or 15 minutes — and thank them either way.',
          ]
        : [
            'Lead with your ask — you already know each other, no need to over-soften it.',
            "Be specific about the target role so they can actually think of someone.",
            'End with a concrete next step: a time to talk, or a name to follow up with.',
          ]

  return { timing, agenda }
}

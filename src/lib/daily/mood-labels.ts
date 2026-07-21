// Pure, client-safe mood display constants — split out of mood.ts (which is
// 'server-only', since it also holds the Prisma read/write functions).

import type { Mood } from '@prisma/client'

export const MOOD_ORDER: Mood[] = ['STUCK', 'GETTING_THERE', 'MOVING', 'FIRED_UP']

export const MOOD_LABEL: Record<Mood, string> = {
  STUCK: 'Stuck',
  GETTING_THERE: 'Getting there',
  MOVING: 'Moving',
  FIRED_UP: 'Fired up',
}

// Same 10/40/70/100 scale as jobSearchDifficultyLevel converted via
// difficultyLevelToIntensityScore() (src/lib/scoring/search-intensity.ts) —
// deliberately reused, not re-derived, so the two can share one 0-100 axis
// on the Stats page motivation chart.
export const MOOD_SCORE: Record<Mood, number> = {
  STUCK: 10,
  GETTING_THERE: 40,
  MOVING: 70,
  FIRED_UP: 100,
}

// Victoria's immediate reaction to the tapped mood — a short, clean line
// shown right above today's ideas. No dash-interjection punctuation; each
// is a complete, self-contained reaction.
export const MOOD_RESPONSE: Record<Mood, string> = {
  STUCK: "That's real, and it happens in every search.",
  GETTING_THERE: 'Glad to hear it.',
  MOVING: "That's great to hear.",
  FIRED_UP: 'Love that energy.',
}

// Pure, client-safe mood display constants — split out of mood.ts (which is
// 'server-only', since it also holds the Prisma read/write functions) so
// client components like MoodCheckInCard can import these directly.

import type { Mood } from '@prisma/client'

export const MOOD_ORDER: Mood[] = ['STUCK', 'GETTING_THERE', 'MOVING', 'FIRED_UP']

export const MOOD_LABEL: Record<Mood, string> = {
  STUCK: 'Stuck',
  GETTING_THERE: 'Getting there',
  MOVING: 'Moving',
  FIRED_UP: 'Fired up',
}

// Victoria's immediate reaction to the tapped mood — shown right after
// check-in, ahead of today's primary action.
export const MOOD_RESPONSE: Record<Mood, string> = {
  STUCK: "That's real, and it happens in every search. Let's not tackle everything today — just the smallest next step.",
  GETTING_THERE: "Good — that counts as progress. Here's today's move.",
  MOVING: "You're building something real. Let's keep the momentum going.",
  FIRED_UP: "Let's use it. Here's today's move — and a stretch option if you want more.",
}

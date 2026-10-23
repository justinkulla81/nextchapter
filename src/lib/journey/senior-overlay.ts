// The senior overlay for one member: their level and title, the switch, and whether they restored the job board.
// Pure; the rules are in ./menu.ts. Used by the menu, Home and Stats so they agree.

import { seniorMember } from '@/lib/coach/seniority'
import { readSeniorTrack, seniorEngagementDefaults, seniorOverlayOn, type SeniorOverlay } from './menu'

type Member = { highestLevelReached?: string | null; resumeLatestJobTitle?: string | null; journeyDetails?: unknown }

export function seniorOverlayFor(p: Member): SeniorOverlay {
  const t = readSeniorTrack(p.journeyDetails)
  return { on: seniorOverlayOn(seniorMember(p), t.override), jobsRestored: t.jobsRestored }
}

/** Points, streaks and daily application prompts for this member. */
export const engagementFor = (p: Member) => seniorEngagementDefaults(seniorOverlayFor(p))

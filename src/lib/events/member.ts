import 'server-only'
import type { CandidateProfile } from '@prisma/client'
import { memberIndustryBuckets } from '@/lib/profile/industry-reading'
import { listEvents, memberInterests, seedCatalogIfStale } from './store'
import { matchEvents, seniorityFromScore, type EventFilters, type EventMatch, type MemberEventFacts } from './match'

type EventsProfile = Pick<
  CandidateProfile,
  'id' | 'primaryFunction' | 'targetFunction' | 'industryContext' | 'secondaryIndustryContext' | 'targetIndustries' | 'industryBuckets' | 'currentState' | 'levelRankScore'
>

export function factsFor(p: EventsProfile): MemberEventFacts {
  const state = p.currentState?.trim().toUpperCase()
  return {
    functions: [p.targetFunction, p.primaryFunction].filter((f): f is string => !!f),
    industries: memberIndustryBuckets(p),
    seniority: seniorityFromScore(p.levelRankScore),
    state: state && /^[A-Z]{2}$/.test(state) ? state : null,
  }
}

export interface EventsResult {
  facts: MemberEventFacts
  matches: EventMatch[]
  /** Published events before filtering, so the page can say "none match" versus "none yet". */
  total: number
  interests: Record<string, string>
}

/** Published events ranked for this member. Empty (never an error page) when the table is not there yet. */
export async function eventsFor(p: EventsProfile, filters: EventFilters = {}): Promise<EventsResult> {
  const facts = factsFor(p)
  try {
    await seedCatalogIfStale()
    const [events, interests] = await Promise.all([listEvents({ publishedOnly: true }), memberInterests(p.id)])
    return { facts, matches: matchEvents(events, facts, filters), total: events.length, interests }
  } catch {
    return { facts, matches: [], total: 0, interests: {} }
  }
}

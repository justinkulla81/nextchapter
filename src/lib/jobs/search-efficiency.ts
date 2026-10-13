// Applications per conversation: how many applications it takes to start one
// real two-way exchange. A conversation is an interview that landed, or a
// networking meeting the member logged or that calendar tracking detected.
// Outreach messages sent do not count until they turn into a meeting.
//
// Benchmarks are context, not targets. Huntr Q1 2026 (job-tracker users, who
// skew toward heavy appliers; reported in the NextChapter Displacement Report,
// September 2026, Chapter 08): 4.2% of tailored applications and 2.1% of generic
// ones led to an interview, about 24 and 48 applications per interview.

export const WINDOW_DAYS = 28
const MIN_APPLICATIONS = 5
const STRONG_AT_OR_BELOW = 12
const TYPICAL_AT_OR_BELOW = 24

export const BENCHMARK = {
  tailoredApplicationsPerInterview: 24,
  genericApplicationsPerInterview: 48,
  source: 'Huntr Q1 2026 via NextChapter Displacement Report, September 2026 (job-tracker users)',
} as const

export type EfficiencyState = 'NOT_ENOUGH_DATA' | 'NO_CONVERSATIONS' | 'STRONG' | 'TYPICAL' | 'HIGH'

export interface EfficiencyCounts {
  applications: number
  interviews: number
  networkMeetings: number
}

export interface SearchEfficiency {
  state: EfficiencyState
  applications: number
  conversations: number
  applicationsPerConversation: number | null
  headline: string
  advice: string | null
  trend: 'BETTER' | 'WORSE' | 'SAME' | null
}

export function conversationsOf(c: EfficiencyCounts): number {
  return c.interviews + c.networkMeetings
}

export function ratioOf(c: EfficiencyCounts): number | null {
  const conv = conversationsOf(c)
  if (conv <= 0) return null
  return c.applications / conv
}

function trendOf(current: number | null, previous: number | null): SearchEfficiency['trend'] {
  if (current === null || previous === null) return null
  if (Math.abs(current - previous) < 1) return 'SAME'
  return current < previous ? 'BETTER' : 'WORSE'
}

export function computeSearchEfficiency(current: EfficiencyCounts, previous?: EfficiencyCounts | null): SearchEfficiency {
  const conversations = conversationsOf(current)
  const ratio = ratioOf(current)
  const trend = trendOf(ratio, previous ? ratioOf(previous) : null)
  const base = { applications: current.applications, conversations, applicationsPerConversation: ratio, trend }

  if (current.applications < MIN_APPLICATIONS) {
    return {
      ...base,
      state: 'NOT_ENOUGH_DATA',
      headline: 'Not enough applications in the last 4 weeks to read a ratio yet.',
      advice: null,
    }
  }
  if (conversations === 0) {
    return {
      ...base,
      state: 'NO_CONVERSATIONS',
      headline: `${current.applications} applications and no conversations in the last 4 weeks.`,
      advice:
        'More applications will not fix this. Pick the three roles you most want, tailor each one, and use a person at the company before you apply. A conversation with someone inside beats another cold application.',
    }
  }
  const rounded = Math.round(ratio as number)
  const headline = `${rounded} application${rounded === 1 ? '' : 's'} per conversation over the last 4 weeks (${current.applications} applications, ${conversations} conversation${conversations === 1 ? '' : 's'}).`
  if ((ratio as number) <= STRONG_AT_OR_BELOW) {
    return { ...base, state: 'STRONG', headline, advice: 'This is a strong ratio. Keep the mix of tailored applications and conversations as it is.' }
  }
  if ((ratio as number) <= TYPICAL_AT_OR_BELOW) {
    return {
      ...base,
      state: 'TYPICAL',
      headline,
      advice: `For comparison, job-tracker users who tailored their résumé averaged about ${BENCHMARK.tailoredApplicationsPerInterview} applications per interview and those who did not about ${BENCHMARK.genericApplicationsPerInterview}. Two more conversations a week would move this faster than ten more applications.`,
    }
  }
  return {
    ...base,
    state: 'HIGH',
    headline,
    advice: `That is above the roughly ${BENCHMARK.tailoredApplicationsPerInterview} per interview seen with tailored résumés. Send fewer, tailor each one to the posting, and put a person in front of at least half of them.`,
  }
}

import { describe, expect, it } from 'vitest'
import { computeSearchEfficiency } from '@/lib/jobs/search-efficiency'

describe('computeSearchEfficiency', () => {
  it('needs a minimum of applications', () => {
    expect(computeSearchEfficiency({ applications: 3, interviews: 1, networkMeetings: 0 }).state).toBe('NOT_ENOUGH_DATA')
  })
  it('flags applications with no conversations', () => {
    const e = computeSearchEfficiency({ applications: 14, interviews: 0, networkMeetings: 0 })
    expect(e.state).toBe('NO_CONVERSATIONS')
    expect(e.applicationsPerConversation).toBeNull()
    expect(e.advice).toContain('tailor')
  })
  it('counts interviews and network meetings as conversations', () => {
    const e = computeSearchEfficiency({ applications: 20, interviews: 1, networkMeetings: 3 })
    expect(e.conversations).toBe(4)
    expect(e.applicationsPerConversation).toBe(5)
    expect(e.state).toBe('STRONG')
  })
  it('bands typical and high ratios', () => {
    expect(computeSearchEfficiency({ applications: 36, interviews: 2, networkMeetings: 0 }).state).toBe('TYPICAL')
    expect(computeSearchEfficiency({ applications: 60, interviews: 1, networkMeetings: 1 }).state).toBe('HIGH')
  })
  it('reports the trend against the previous window', () => {
    const e = computeSearchEfficiency({ applications: 20, interviews: 2, networkMeetings: 0 }, { applications: 20, interviews: 1, networkMeetings: 0 })
    expect(e.trend).toBe('BETTER')
    expect(computeSearchEfficiency({ applications: 20, interviews: 1, networkMeetings: 0 }, { applications: 20, interviews: 2, networkMeetings: 0 }).trend).toBe('WORSE')
  })
})

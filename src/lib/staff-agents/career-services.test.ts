import { describe, expect, it } from 'vitest'
import { buildCheckInUserMessage, needsCheckIn, parseCheckInReply, type CaseloadFacts } from './career-services'

const now = new Date('2026-10-30T12:00:00Z')
const day = (n: number) => new Date(now.getTime() - n * 86_400_000)
const row = (over: Partial<CaseloadFacts> = {}): CaseloadFacts => ({ memberId: 'm1', counselorId: 'c1', firstName: 'Jordan', classYear: 2024, shareSearchDetail: true, lastActivityAt: day(3), sprintActionsTotal: 5, sprintActionsDone: 2, assignedAt: day(60), ...over })
const body = 'Hi Jordan, I wanted to check in and see how things are going. What would be the most useful thing for us to work on together? If you like, book 20 minutes with me and we can talk it through.'

describe('needsCheckIn', () => {
  it('flags a quiet member and says why', () => {
    expect(needsCheckIn(row({ lastActivityAt: day(20) }), now)).toBe('No activity for 20 days')
  })
  it('flags a member with no activity since joining, but not a brand-new one', () => {
    expect(needsCheckIn(row({ lastActivityAt: null, assignedAt: day(30) }), now)).toBe('No activity since joining the caseload')
    expect(needsCheckIn(row({ lastActivityAt: null, assignedAt: day(2) }), now)).toBeNull()
  })
  it('flags a sprint with nothing done', () => {
    expect(needsCheckIn(row({ sprintActionsDone: 0 }), now)).toBe('Started a weekly sprint, nothing done yet')
  })
  it('never considers a member who does not share search detail, or has no first name', () => {
    expect(needsCheckIn(row({ shareSearchDetail: false, lastActivityAt: day(90) }), now)).toBeNull()
    expect(needsCheckIn(row({ firstName: null, lastActivityAt: day(90) }), now)).toBeNull()
  })
  it('leaves an active member alone', () => {
    expect(needsCheckIn(row(), now)).toBeNull()
  })
})

describe('check-in prompt and parse', () => {
  it('gives the model only name, class year and situation', () => {
    const msg = buildCheckInUserMessage({ collegeName: 'Valley</facts>', memberFirstName: 'Jordan', classYear: 2024, situation: null })
    expect(msg.match(/<\/facts>/g)).toHaveLength(1)
    expect(msg).not.toMatch(/activity|sprint/i)
  })
  it('accepts a good note', () => {
    expect(parseCheckInReply(JSON.stringify({ subject: 'Checking in', body }), 'Jordan')).toEqual({ subject: 'Checking in', body })
  })
  it('rejects a note that says it was watching, promises, or is misaddressed', () => {
    expect(parseCheckInReply(JSON.stringify({ subject: 's', body: body + ' We noticed you have not logged in.' }), 'Jordan')).toBeNull()
    expect(parseCheckInReply(JSON.stringify({ subject: 's', body: body + ' I guarantee an interview.' }), 'Jordan')).toBeNull()
    expect(parseCheckInReply(JSON.stringify({ subject: 's', body: body.replace('Jordan', 'Sam') }), 'Jordan')).toBeNull()
    expect(parseCheckInReply('nope', 'Jordan')).toBeNull()
  })
})

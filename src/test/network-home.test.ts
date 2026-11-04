import { describe, expect, it } from 'vitest'
import { attachMoments, buildCircles, buildMoments, type NetworkHomeInput } from '@/lib/redesign/network-home'

const base: NetworkHomeInput = { supporters: 0, hasCoach: false, contacts: 0, followUpsDue: 0, alumniGroups: [], communities: 0, candidatePlus: false, outreachSent: 0, outreachTarget: 10, priorityStarred: 0, priorityTarget: 5 }
const get = (i: NetworkHomeInput, key: string) => buildCircles(i).find((c) => c.key === key)!

describe('buildCircles', () => {
  it('returns the five circles closest first', () => {
    expect(buildCircles(base).map((c) => c.key)).toEqual(['close', 'know', 'alumni', 'industry', 'recruiters'])
  })
  it('says what is missing as a benefit on an empty circle', () => {
    const c = get(base, 'close')
    expect(c.state).toBe('empty')
    expect(c.gap).toMatch(/cheering/)
  })
  it('marks the close circle active with supporters and asks for a coach', () => {
    const c = get({ ...base, supporters: 2 }, 'close')
    expect(c.state).toBe('active')
    expect(c.status).toBe('2 people are in your corner. No coach yet.')
    expect(c.gap).toMatch(/coach/)
  })
  it('points people you know at follow-ups when some are due', () => {
    const c = get({ ...base, contacts: 20, followUpsDue: 1 }, 'know')
    expect(c.status).toBe('20 contacts. 1 is due a follow-up.')
    expect(c.action.href).toBe('/dashboard/network/follow-ups')
  })
  it('shortens a long alumni list', () => {
    expect(get({ ...base, alumniGroups: ['A', 'B', 'C', 'D'] }, 'alumni').status).toBe('A, B and 2 more.')
  })
  it('locks recruiters until Candidate+ and opens them after', () => {
    expect(get(base, 'recruiters').state).toBe('locked')
    expect(get({ ...base, candidatePlus: true }, 'recruiters').state).toBe('active')
  })
})

describe('buildMoments', () => {
  it('shows only moments not yet reached', () => {
    expect(buildMoments(base).map((m) => m.key)).toEqual(['outreach', 'priority', 'coach'])
    expect(buildMoments({ ...base, candidatePlus: true, hasCoach: true, priorityStarred: 5 })).toEqual([])
  })
  it('caps progress at the target', () => {
    const m = buildMoments({ ...base, outreachSent: 14 })[0]
    expect(m.progress).toBe('10 of 10 messages')
    expect(m.pct).toBe(100)
  })
})

describe('attachMoments', () => {
  const i: NetworkHomeInput = { ...base, contacts: 20, outreachSent: 4, outreachTarget: 10, priorityStarred: 2, priorityTarget: 5 }
  it('puts outreach and priority progress on People you know as bars', () => {
    const know = attachMoments(buildCircles(i), buildMoments(i)).find((c) => c.key === 'know')!
    expect(know.bars?.map((b) => b.label)).toEqual(['4 of 10 messages', '2 of 5 starred'])
  })
  it('drops the coach moment, since the close circle already says it', () => {
    const circles = attachMoments(buildCircles(i), buildMoments(i))
    expect(circles.find((c) => c.key === 'close')!.bars).toBeUndefined()
  })
  it('leaves circles without moments untouched', () => {
    expect(attachMoments(buildCircles(i), []).every((c) => c.bars === undefined)).toBe(true)
  })
})

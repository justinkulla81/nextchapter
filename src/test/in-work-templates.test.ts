import { describe, it, expect } from 'vitest'
import {
  buildMeetingScript,
  buildReviewSummary,
  buildWrittenReply,
  carryForwardFromOutcome,
  fillTemplate,
  prepCompletion,
  NEGOTIATION_SCRIPTS,
} from '@/lib/in-work/templates'
import { buildReviewEmailContent } from '@/lib/in-work/outreach'
import { buildCyclesForYear } from '@/lib/in-work/review-schedule'
import { neutralizeEmailSubject } from '@/lib/email/neutral-subject'

const D = (s: string) => new Date(`${s}T00:00:00.000Z`)

describe('buildReviewSummary', () => {
  it('says so when there is nothing logged', () => {
    const s = buildReviewSummary([])
    expect(s.rangeLabel).toBe('No wins logged yet')
    expect(s.text).toMatch(/Log your wins/)
  })

  it('puts results with numbers first and counts them', () => {
    const s = buildReviewSummary([
      { what: 'Ran the offsite', result: 'Team morale improved', occurredOn: D('2027-03-01') },
      { what: 'Cut onboarding time', result: 'From 9 days to 3', whoBenefited: 'Support team', occurredOn: D('2027-02-01') },
    ])
    expect(s.quantified).toHaveLength(1)
    expect(s.other).toHaveLength(1)
    expect(s.text).toMatch(/2 results, 1 with a number/)
    expect(s.text.indexOf('Results with numbers')).toBeLessThan(s.text.indexOf('Other results'))
    expect(s.quantified[0]).toContain('Helped Support team')
  })

  it('filters by date and does not mutate the input', () => {
    const wins = [
      { what: 'A', result: '1', occurredOn: D('2027-01-01') },
      { what: 'B', result: '2', occurredOn: D('2027-05-01') },
    ]
    const copy = [...wins]
    const s = buildReviewSummary(wins, { from: D('2027-03-01') })
    expect(s.quantified).toHaveLength(1)
    expect(wins).toEqual(copy)
  })
})

describe('fillTemplate', () => {
  it('fills known values and leaves a visible blank for missing ones', () => {
    expect(fillTemplate('Ask {{ask}} by {{date}}', { ask: '$100,000' })).toBe('Ask $100,000 by [date]')
  })
})

describe('negotiation scripts', () => {
  it('cover all three situations with who, when and how', () => {
    for (const s of ['RAISE', 'PROMOTION', 'COUNTER_OFFER'] as const) {
      const sc = NEGOTIATION_SCRIPTS[s]
      expect(sc.who.length).toBeGreaterThan(10)
      expect(sc.when.length).toBeGreaterThan(10)
      expect(sc.how.length).toBeGreaterThan(10)
      expect(sc.steps.length).toBeGreaterThanOrEqual(4)
    }
  })
})

describe('feedback replies', () => {
  const input = { source: 'MANAGER' as const, category: 'COMMUNICATION' as const, point: 'Your updates arrive too late to act on.', change: 'Send a written update every Friday', by: 'this week' }
  it('builds a written reply that quotes the point and the one change', () => {
    const t = buildWrittenReply(input)
    expect(t).toContain('your updates arrive too late to act on')
    expect(t).toContain('Send a written update every Friday, starting this week')
  })
  it('builds a conversation script with the four steps', () => {
    const t = buildMeetingScript(input)
    for (const step of ['1. Listen', '2. Clarify', '3. Own', '4. Plan']) expect(t).toContain(step)
  })
  it('leaves visible blanks when no change is given', () => {
    expect(buildWrittenReply({ ...input, change: undefined })).toContain('[one specific change]')
  })
})

describe('carryForwardFromOutcome', () => {
  it('returns nothing without a prior outcome', () => {
    expect(carryForwardFromOutcome(null)).toEqual({ recap: null, openFollowUps: [] })
  })
  it('recaps and lists only open follow-ups', () => {
    const r = carryForwardFromOutcome({
      reviewedOn: D('2027-03-01'),
      rating: 'Exceeds',
      raiseReceived: true,
      raisePercent: 5,
      promoted: false,
      followUps: [
        { text: 'Scope review in June', done: false },
        { text: 'Send goals doc', done: true },
      ],
    })
    expect(r.recap).toContain('rating: Exceeds')
    expect(r.recap).toContain('raise of 5%')
    expect(r.openFollowUps).toEqual(['Scope review in June'])
  })
})

describe('prepCompletion', () => {
  it('counts only the known keys', () => {
    expect(prepCompletion({ a: true, b: false, z: true }, ['a', 'b'])).toEqual({ done: 1, total: 2, complete: false })
    expect(prepCompletion({ a: true, b: true }, ['a', 'b']).complete).toBe(true)
  })
})

describe('review emails', () => {
  const cycle = buildCyclesForYear({ cadence: 'HALF_YEARLY', anchorMonth: null, nextReviewDate: null }, 2027)[0]
  const exact = { ...cycle, exact: true }
  const banned = [/job search/i, /resume/i, /application/i, /interview/i, /career transition/i, /employer/i, /quit/i, /leave/i]

  it('uses plain subjects that pass the confidential-mode filter untouched', () => {
    const subjects = [
      buildReviewEmailContent({ kind: 'PREPARE', cycle, firstName: 'Sam', winCount: 0, openFollowUps: 0 }).subject,
      buildReviewEmailContent({ kind: 'PREPARE', cycle: exact, firstName: 'Sam', winCount: 3, openFollowUps: 0 }).subject,
      buildReviewEmailContent({ kind: 'RESPOND', cycle, firstName: 'Sam', winCount: 3, openFollowUps: 2 }).subject,
    ]
    for (const s of subjects) {
      expect(neutralizeEmailSubject(s, true)).toBe(s)
      for (const b of banned) expect(s).not.toMatch(b)
    }
  })

  it('never names the employer or implies they will see anything', () => {
    for (const kind of ['PREPARE', 'RESPOND'] as const) {
      const c = buildReviewEmailContent({ kind, cycle, firstName: null, winCount: 2, openFollowUps: 1 })
      const body = [c.intro, ...c.steps, c.heading].join(' ')
      expect(body).not.toMatch(/em dash|—/i)
      expect(body).not.toMatch(/job search|resume|interview/i)
    }
  })

  it('links carry the tracking params the workspace reads', () => {
    const c = buildReviewEmailContent({ kind: 'RESPOND', cycle, firstName: null, winCount: 0, openFollowUps: 0 })
    expect(c.ctaQuery).toBe('?tab=outcome&src=inwork_email&kind=respond&cycle=2027-02')
  })

  it('pluralizes win and follow-up counts', () => {
    expect(buildReviewEmailContent({ kind: 'PREPARE', cycle, firstName: null, winCount: 1, openFollowUps: 0 }).steps[0]).toContain('1 win logged')
    expect(buildReviewEmailContent({ kind: 'RESPOND', cycle, firstName: null, winCount: 0, openFollowUps: 1 }).steps[2]).toContain('1 follow-up from last time')
  })
})

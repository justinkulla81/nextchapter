import { describe, expect, it } from 'vitest'
import { buildPrep, buildQuestions, buildShares, effortChange, formatMinutes, ordinalWord, payPositionItem, primaryAction, sortAgreed } from '@/lib/coach/prep/build'
import type { AgreedItem, PrepInput } from '@/lib/coach/prep/types'

const NOW = new Date('2026-10-26T15:00:00Z') // a Monday
const day = (n: number) => new Date(NOW.getTime() + n * 86_400_000)

const base = (over: Partial<PrepInput> = {}): PrepInput => ({
  now: NOW,
  firstName: 'Dana',
  consented: true,
  confidential: false,
  weekNumber: 9,
  session: { startsAt: day(3), minutes: 45, meetUrl: 'https://meet.google.com/abc', ordinal: 4, timezone: 'America/New_York' },
  lastSessionAt: day(-14),
  effort: { thisWeekMinutes: 400, lastWeekMinutes: 190, activeDaysThis: 5, activeDaysLast: 3, daysSinceOutreach: 2 },
  pipeline: { applied: 11, replied: 4, interviews: 2, offers: 0, roles: ['Finance Director', 'Controller'], nextInterview: { at: day(1), role: 'Finance Director', company: 'Arsenault' }, newInterviews: 1 },
  grade: null,
  agreed: [],
  market: null,
  traits: null,
  ...over,
})

const item = (over: Partial<AgreedItem>): AgreedItem => ({ owner: 'member', text: 'Message three former colleagues', status: 'open', dueAt: null, source: 'follow_up', ...over })

describe('formatting', () => {
  it('writes minutes the way the page shows them', () => {
    expect(formatMinutes(400)).toBe('6 h 40 min')
    expect(formatMinutes(190)).toBe('3 h 10 min')
    expect(formatMinutes(45)).toBe('45 min')
    expect(formatMinutes(120)).toBe('2 h')
    expect(formatMinutes(0)).toBe('0 min')
  })
  it('names the session number', () => {
    expect(ordinalWord(1)).toBe('first')
    expect(ordinalWord(4)).toBe('fourth')
    expect(ordinalWord(12)).toBe('12th')
  })
})

describe('week over week effort', () => {
  const e = (thisWeekMinutes: number, lastWeekMinutes: number) => ({ thisWeekMinutes, lastWeekMinutes, activeDaysThis: 0, activeDaysLast: 0, daysSinceOutreach: null })
  it('calls out a doubling, a rise, a fall, and a steady week', () => {
    expect(effortChange(e(400, 190)).kind).toBe('doubled')
    expect(effortChange(e(240, 190)).kind).toBe('up')
    expect(effortChange(e(100, 190)).kind).toBe('down')
    expect(effortChange(e(200, 190)).kind).toBe('same')
  })
  it('does not divide by zero when last week was empty', () => {
    expect(effortChange(e(60, 0))).toEqual({ kind: 'up', pct: null })
    expect(effortChange(e(0, 0))).toEqual({ kind: 'same', pct: null })
  })
})

describe('this week section', () => {
  it('shows effort with the change, the pipeline, and the next interview', () => {
    const view = buildPrep(base())
    if (view.week.status !== 'ok') throw new Error('expected ok')
    expect(view.week.data.stats.map((s) => s.label)).toEqual(['Search effort', 'Pipeline', 'Interviews'])
    expect(view.week.data.stats[0]).toMatchObject({ value: '6 h 40 min', detail: 'of search work this week, 3 h 10 min last week' })
    expect(view.week.data.stats[1].value).toBe('11 applied')
    expect(view.week.data.stats[1].detail).toContain('4 replied · 2 interviews · 0 offers')
    expect(view.week.data.stats[2]).toMatchObject({ value: 'Tuesday', detail: 'Finance Director at Arsenault' })
    expect(view.week.data.why).toMatch(/^effort is minutes/)
  })

  it('lists what changed since the last session, with the date in its heading', () => {
    const view = buildPrep(base({ grade: { from: 'C', to: 'B' }, effort: { thisWeekMinutes: 400, lastWeekMinutes: 190, activeDaysThis: 5, activeDaysLast: 3, daysSinceOutreach: 9 } }))
    if (view.week.status !== 'ok') throw new Error('expected ok')
    expect(view.week.data.changesTitle).toBe('What changed since October 12')
    const text = view.week.data.changes.map((c) => c.text)
    expect(text[0]).toBe('Search effort doubled, and Dana logged time on 5 days instead of 3.')
    expect(text).toContain('No messages to contacts in 9 days.')
    expect(text).toContain('An interview was booked, the next on Tuesday.')
    expect(text).toContain('The market reality grade moved from C to B.')
    expect(text.length).toBeLessThanOrEqual(4)
  })

  it('says "this week" when there was no earlier session', () => {
    const view = buildPrep(base({ lastSessionAt: null }))
    if (view.week.status !== 'ok') throw new Error('expected ok')
    expect(view.week.data.changesTitle).toBe('What changed this week')
  })

  it('fails soft: a missing fact group leaves only the cards it could build', () => {
    const view = buildPrep(base({ pipeline: null }))
    if (view.week.status !== 'ok') throw new Error('expected ok')
    expect(view.week.data.stats.map((s) => s.label)).toEqual(['Search effort'])
    const none = buildPrep(base({ effort: null, pipeline: null }))
    expect(none.week.status).toBe('unavailable')
  })

  it('reads nothing and says so without the member’s consent', () => {
    const view = buildPrep(base({ consented: false, effort: null, pipeline: null }))
    expect(view.week).toMatchObject({ status: 'unavailable', message: expect.stringContaining('has not agreed to share') })
    expect(view.market.status).toBe('unavailable')
    expect(view.strengths.status).toBe('unavailable')
  })
})

describe('Confidential Search Mode', () => {
  it('shows counts and roles but never a company name', () => {
    const view = buildPrep(base({ confidential: true }))
    const json = JSON.stringify(view)
    expect(json).not.toContain('Arsenault')
    if (view.week.status !== 'ok') throw new Error('expected ok')
    expect(view.week.data.stats[1].detail).toContain('roles: Finance Director, Controller')
    expect(view.week.data.stats[2].detail).toContain('company names hidden')
  })

  it('tells the coach in the shares panel', () => {
    const rows = buildShares('Dana', true, true)
    expect(rows.find((r) => r.label.startsWith('Names of companies'))).toMatchObject({ shared: false, note: expect.stringContaining('counts and roles') })
  })
})

describe('what the member shares', () => {
  it('never shares the money situation, with or without consent', () => {
    for (const consented of [true, false]) {
      const row = buildShares('Dana', consented, false).find((r) => r.label === 'Their money situation')
      expect(row).toMatchObject({ shared: false, note: expect.stringContaining('Never shared') })
    }
  })
  it('marks everything else shared only with consent', () => {
    expect(buildShares('Dana', true, false).filter((r) => r.shared)).toHaveLength(6)
    expect(buildShares('Dana', false, false).filter((r) => r.shared)).toHaveLength(0)
  })
})

describe('what you agreed last time', () => {
  it('puts open items first, earliest due first, then done ones', () => {
    const sorted = sortAgreed([
      item({ text: 'done one', status: 'done' }),
      item({ text: 'later', dueAt: day(10) }),
      item({ text: 'sooner', dueAt: day(2) }),
      item({ text: 'no date' }),
    ])
    expect(sorted.map((i) => i.text)).toEqual(['sooner', 'later', 'no date', 'done one'])
  })

  it('says how many are open and how many are the coach’s', () => {
    const view = buildPrep(base({ agreed: [item({}), item({ owner: 'coach', text: 'Introduce two controllers' }), item({ status: 'done', text: 'x' })] }))
    if (view.agreed.status !== 'ok') throw new Error('expected ok')
    expect(view.agreed.data.why).toContain('2 are still open, 1 of them yours')
  })

  it('says so when there are no earlier notes, and when the read failed', () => {
    const empty = buildPrep(base({ agreed: [] }))
    if (empty.agreed.status !== 'ok') throw new Error('expected ok')
    expect(empty.agreed.data.items).toEqual([])
    expect(empty.agreed.data.why).toContain('no earlier session notes')
    expect(buildPrep(base({ agreed: null })).agreed.status).toBe('unavailable')
  })

  it('names the source: follow-ups when the table is there, action items from notes otherwise', () => {
    const a = buildPrep(base({ agreed: [item({ source: 'follow_up' })] }))
    const b = buildPrep(base({ agreed: [item({ source: 'directive' })] }))
    if (a.agreed.status !== 'ok' || b.agreed.status !== 'ok') throw new Error('expected ok')
    expect(a.agreed.data.why).toContain('follow-ups')
    expect(b.agreed.data.why).toContain('action items')
  })
})

describe('three suggested questions', () => {
  const quiet = base({ effort: { thisWeekMinutes: 200, lastWeekMinutes: 190, activeDaysThis: 3, activeDaysLast: 3, daysSinceOutreach: 2 }, pipeline: { applied: 3, replied: 1, interviews: 0, offers: 0, roles: [], nextInterview: null, newInterviews: 0 } })
  const rules = (input: PrepInput) => buildQuestions(input, 'Dana', 'America/New_York').map((q) => q.rule)

  it('always returns three, each with a reason', () => {
    for (const input of [quiet, base(), base({ effort: null, pipeline: null, agreed: null, consented: false })]) {
      const qs = buildQuestions(input, 'Dana', 'America/New_York')
      expect(qs).toHaveLength(3)
      expect(new Set(qs.map((q) => q.rule)).size).toBe(3)
      for (const q of qs) {
        expect(q.text.endsWith('?')).toBe(true)
        expect(q.reason.length).toBeGreaterThan(20)
      }
    }
  })

  it('asks about an open item the member agreed to, quoting it and its due date', () => {
    const qs = buildQuestions(base({ agreed: [item({ text: 'Decide whether to look at controller roles', dueAt: new Date('2026-11-03T12:00:00Z') })] }), 'Dana', 'America/New_York')
    expect(qs[0].rule).toBe('open_member_item')
    expect(qs[0].text).toContain('Decide whether to look at controller roles')
    expect(qs[0].reason).toContain('November 3')
  })

  it('asks the coach to own what they owe', () => {
    expect(rules({ ...quiet, agreed: [item({ owner: 'coach', text: 'Introduce two controllers' })] })).toContain('open_coach_item')
  })

  it('leads with the interview when one is within a week, and uses the strongest trait only when it is clear', () => {
    const withTrait = buildQuestions({ ...quiet, pipeline: { ...quiet.pipeline!, nextInterview: { at: day(1), role: null, company: null } }, traits: [{ key: 'communication', label: 'Communication', level: 3, shownBy: 'x' }] }, 'Dana', 'America/New_York')
    const q = withTrait.find((x) => x.rule === 'interview_soon')!
    expect(q.text).toBe('Tuesday’s interview: what do you most want them to remember about you?')
    expect(q.reason).toContain('communication is one of the strongest traits')
    const without = buildQuestions({ ...quiet, pipeline: { ...quiet.pipeline!, nextInterview: { at: day(1), role: null, company: null } }, traits: [{ key: 'communication', label: 'Communication', level: 1, shownBy: 'x' }] }, 'Dana', 'America/New_York')
    expect(without.find((x) => x.rule === 'interview_soon')!.reason).not.toContain('strongest')
  })

  it('ignores an interview that is more than a week out or already past', () => {
    expect(rules({ ...quiet, pipeline: { ...quiet.pipeline!, nextInterview: { at: day(9), role: null, company: null } } })).not.toContain('interview_soon')
    expect(rules({ ...quiet, pipeline: { ...quiet.pipeline!, nextInterview: { at: day(-1), role: null, company: null } } })).not.toContain('interview_soon')
  })

  it('asks what helped when effort rose, with both numbers in the reason', () => {
    const q = buildQuestions(base({ agreed: [], pipeline: quiet.pipeline }), 'Dana', 'America/New_York').find((x) => x.rule === 'effort_up')!
    expect(q.reason).toContain('3 h 10 min to 6 h 40 min')
  })

  it('asks what got in the way when effort fell', () => {
    const input = { ...quiet, effort: { ...quiet.effort!, thisWeekMinutes: 60, lastWeekMinutes: 200 } }
    expect(rules(input)).toContain('effort_down')
    expect(rules(input)).not.toContain('effort_up')
  })

  it('notices ten quiet days of outreach, and many applications with no reply', () => {
    expect(rules({ ...quiet, effort: { ...quiet.effort!, daysSinceOutreach: 12 } })).toContain('outreach_quiet')
    expect(rules({ ...quiet, effort: { ...quiet.effort!, daysSinceOutreach: 9 } })).not.toContain('outreach_quiet')
    expect(rules({ ...quiet, pipeline: { ...quiet.pipeline!, applied: 12, replied: 0 } })).toContain('no_replies')
    expect(rules({ ...quiet, pipeline: { ...quiet.pipeline!, applied: 12, replied: 1 } })).not.toContain('no_replies')
  })

  it('raises pay only when it is well below the local median, and AI only when exposure is high', () => {
    const market = (lastSalary: number, band: 'high' | 'little') => ({
      exposure: { title: 'Financial Analysts', score: 0.4, band, sentence: 's', why: 'w', sourceName: 'Anthropic Economic Index' },
      pay: { occupationTitle: 'Financial Managers', areaName: 'Columbus, OH', median: 120_700, lastSalary },
      cycleLine: null,
    })
    expect(rules({ ...quiet, market: market(90_000, 'high') })).toEqual(expect.arrayContaining(['pay_below', 'ai_exposure']))
    const calm = rules({ ...quiet, market: market(125_000, 'little') })
    expect(calm).not.toContain('pay_below')
    expect(calm).not.toContain('ai_exposure')
  })

  it('fills with plain fallbacks that say nothing in the data stood out', () => {
    const qs = buildQuestions(quiet, 'Dana', 'America/New_York')
    expect(qs.map((q) => q.rule)).toEqual(['fallback_best_moment', 'fallback_agenda', 'fallback_confidence'])
    expect(qs[0].reason).toContain('Nothing else')
  })

  it('keeps the strongest rules first when more than three apply', () => {
    const input = base({
      agreed: [item({ text: 'Decide on controller roles' }), item({ owner: 'coach', text: 'Introduce two controllers' })],
      effort: { thisWeekMinutes: 60, lastWeekMinutes: 200, activeDaysThis: 1, activeDaysLast: 3, daysSinceOutreach: 14 },
    })
    expect(rules(input)).toEqual(['open_member_item', 'open_coach_item', 'interview_soon'])
  })

  it('never assumes a pronoun', () => {
    const view = buildPrep(base({ agreed: [item({})], traits: [{ key: 'communication', label: 'Communication', level: 3, shownBy: 'x' }] }))
    const text = JSON.stringify(view)
    expect(text).not.toMatch(/\b(she|her|hers|he|him|his)\b/i)
  })
})

describe('background behind Show more', () => {
  it('writes pay position in plain words, above, in and below range', () => {
    const pay = (lastSalary: number | null) => ({ occupationTitle: 'Financial Managers', areaName: 'Columbus, OH', median: 120_700, lastSalary })
    expect(payPositionItem('Dana', pay(128_000))).toMatchObject({ headline: 'Dana’s pay is in range.', body: 'Dana’s last salary of $128,000 is close to the Columbus, OH median of $120,700 for financial managers.' })
    expect(payPositionItem('Dana', pay(150_000))!.body).toContain('about 24% above')
    expect(payPositionItem('Dana', pay(90_000))!.headline).toContain('below')
    expect(payPositionItem('Dana', pay(null))!.body).toBe('The Columbus, OH median for financial managers is $120,700.')
    expect(payPositionItem('Dana', { ...pay(1), median: null })).toBeNull()
    expect(payPositionItem('Dana', null)).toBeNull()
  })

  it('builds the market in plain words from whatever pieces exist, with a source on each', () => {
    const view = buildPrep(
      base({
        market: {
          exposure: { title: 'Financial Analysts', score: 0.31, band: 'high', sentence: 'AI is already used for a large share of the tasks in financial analysts work.', why: 'Share of this job’s tasks.', sourceName: 'Anthropic Economic Index' },
          pay: null,
          cycleLine: 'In the last two downturns, employment in this work held up better than jobs overall in both.',
        },
      })
    )
    if (view.market.status !== 'ok') throw new Error('expected ok')
    expect(view.market.data.items).toHaveLength(2)
    expect(view.market.data.items[0].source).toContain('Anthropic Economic Index')
    expect(view.market.data.items[1].headline).toBe('How this work held up in past downturns.')
  })

  it('says why when no occupation could be matched', () => {
    const view = buildPrep(base({ market: { exposure: null, pay: null, cycleLine: null } }))
    expect(view.market).toMatchObject({ status: 'unavailable', message: expect.stringContaining('occupation') })
    expect(buildPrep(base({ market: null })).market.status).toBe('unavailable')
  })

  it('shows up to three strengths from the dossier, strongest first, and skips ones not shown yet', () => {
    const view = buildPrep(
      base({
        traits: [
          { key: 'a', label: 'Motivation', level: 1, shownBy: 'a' },
          { key: 'b', label: 'Communication', level: 3, shownBy: 'The messages sent to real people.' },
          { key: 'c', label: 'Thoroughness', level: 2, shownBy: 'Finishing things properly.' },
          { key: 'd', label: 'References', level: 2, shownBy: 'People who vouch.' },
          { key: 'e', label: 'Helpfulness', level: 2, shownBy: 'Helping others.' },
        ],
      })
    )
    if (view.strengths.status !== 'ok') throw new Error('expected ok')
    expect(view.strengths.data.items.map((s) => s.label)).toEqual(['Communication', 'Thoroughness', 'References'])
    expect(view.strengths.data.items[0].level).toBe('Clear')
    expect(buildPrep(base({ traits: [{ key: 'a', label: 'Motivation', level: 1, shownBy: 'a' }] })).strengths.status).toBe('unavailable')
  })
})

describe('header and the one primary action', () => {
  it('names the member, the day, the length, Meet and which session it is', () => {
    const view = buildPrep(base())
    expect(view.title).toBe('Before you meet Dana')
    expect(view.intro).toBe('Thursday, October 29 at 11:00 AM · 45 minutes · Google Meet · your fourth session. Built from what Dana has shared with you.')
  })

  it('still reads well with no booked session', () => {
    expect(buildPrep(base({ session: null })).intro).toBe('No session is booked yet. This is where Dana stands now, built from what they have shared with you.')
  })

  it('joins Meet and opens notes when there is a Meet link, and just opens notes otherwise', () => {
    expect(primaryAction('https://meet.google.com/abc')).toMatchObject({ label: 'Join Meet and open notes', meetUrl: 'https://meet.google.com/abc' })
    expect(primaryAction(null)).toMatchObject({ label: 'Open notes', meetUrl: null })
  })
})

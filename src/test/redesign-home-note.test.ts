import { describe, it, expect } from 'vitest'
import { pickHomeNote, simpleNote, type HomeNoteInputs } from '@/lib/redesign/home-note'
import { FIRST_WEEK } from '@/lib/onboarding/first-week'

const none: HomeNoteInputs = { needsCoachingForm: false, searchStrategyIncomplete: false, reportReady: false, accountsNotConnected: false, stalledSearch: false, passiveToActive: false, firstWeek: null, gotHired: false, searchPlaybook: false }

describe('pickHomeNote', () => {
  it('falls back to the culture survey when nothing is due', () => {
    expect(pickHomeNote(none)).toBe('culture_survey')
  })
  it('picks exactly one, in order of how time-sensitive it is', () => {
    const all: HomeNoteInputs = { needsCoachingForm: true, needsResume: true, searchStrategyIncomplete: true, reportReady: true, accountsNotConnected: true, stalledSearch: true, passiveToActive: true, firstWeek: FIRST_WEEK[0], gotHired: true, searchPlaybook: true }
    const order: (keyof HomeNoteInputs)[] = ['needsCoachingForm', 'needsResume', 'searchStrategyIncomplete', 'reportReady', 'accountsNotConnected', 'stalledSearch', 'passiveToActive', 'firstWeek', 'gotHired', 'searchPlaybook']
    const expected = ['coaching_form', 'upload_resume', 'setup_strategy', 'report_ready', 'connect_accounts', 'stalled_search', 'passive_to_active', 'first_week', 'got_hired', 'search_playbook']
    const cur: HomeNoteInputs = { ...all }
    order.forEach((k, idx) => {
      expect(pickHomeNote(cur)).toBe(expected[idx])
      ;(cur as unknown as Record<string, unknown>)[k] = k === 'firstWeek' ? null : false
    })
    expect(pickHomeNote(cur)).toBe('culture_survey')
  })
})

describe('the coach offer note', () => {
  it('is the note once setup and connecting accounts are done, ahead of the stalled-search nudge', () => {
    expect(pickHomeNote({ ...none, coachOffer: true, stalledSearch: true, firstWeek: FIRST_WEEK[0] })).toBe('coach_offer')
  })
  it('waits for setup, a report to read and connecting accounts', () => {
    expect(pickHomeNote({ ...none, coachOffer: true, searchStrategyIncomplete: true })).toBe('setup_strategy')
    expect(pickHomeNote({ ...none, coachOffer: true, accountsNotConnected: true })).toBe('connect_accounts')
  })
  it('keeps its own card, so it has no plain wording', () => {
    expect(simpleNote('coach_offer', { firstName: 'Maya', firstWeek: null, motivations: [] })).toBeNull()
  })
})

describe('simpleNote', () => {
  const ctx = { firstName: 'Maya', firstWeek: FIRST_WEEK[2], motivations: ['provide_for_family'] }
  it('gives every plain note a title, a reason, a start and an explanation', () => {
    for (const kind of ['coaching_form', 'upload_resume', 'setup_strategy', 'report_ready', 'first_week', 'got_hired'] as const) {
      const n = simpleNote(kind, ctx)
      expect(n, kind).not.toBeNull()
      expect(n!.title.length).toBeGreaterThan(0)
      expect(n!.why.length).toBeGreaterThan(0)
      expect(n!.startHref.startsWith('/dashboard')).toBe(true)
      expect(n!.whyDetail.length).toBeGreaterThan(0)
    }
  })
  it('leaves the notes with their own flow to their own card', () => {
    for (const kind of ['connect_accounts', 'stalled_search', 'passive_to_active', 'search_playbook', 'culture_survey'] as const) expect(simpleNote(kind, ctx)).toBeNull()
  })
  it('adds what drives the member to the reason, and only when they said', () => {
    expect(simpleNote('first_week', ctx)!.why).toContain('providing for your family')
    expect(simpleNote('first_week', { ...ctx, motivations: [] })!.why).not.toContain('family')
  })
  it('has no first-week note once the week is over', () => {
    expect(simpleNote('first_week', { ...ctx, firstWeek: null })).toBeNull()
  })
})

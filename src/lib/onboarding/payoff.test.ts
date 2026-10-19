import { describe, expect, it } from 'vitest'
import { computePayoff, firstWeekPreview, jobsLine, sampleNote, weeklyTargetMinutes } from './payoff'
import { finishGains, nextOptionalQuestion } from './finish'
import { prefilledAnswers } from './prefilled'
import { EMPTY_SCAN, countsFromGroups, describeFindings, revealState } from './scan-reveal'

const input = { journey: null, jobs: null }

describe('payoff', () => {
  it('shows the real first-week steps for the journey the member picked', () => {
    const p = computePayoff('where_you_are', { situation: 'just_laid_off' }, input)
    expect(p.kind).toBe('plan')
    expect(p.lines).toHaveLength(3)
    expect(p.lines[0]).toBe('File for unemployment benefits')
  })

  it('changes the steps when the answer changes the stage', () => {
    const now = firstWeekPreview('EXPLORING_MOVE', { applyTiming: 'now' })
    const later = firstWeekPreview('EXPLORING_MOVE', { applyTiming: 'curious' })
    expect(now).not.toEqual(later)
  })

  it('waits for an answer before it promises anything', () => {
    expect(computePayoff('where_you_are', {}, input).lines).toHaveLength(0)
    expect(computePayoff('aiming', {}, input).headline).toMatch(/Choose your function and level/)
  })

  it('counts the jobs, before and after, and is honest when it cannot count', () => {
    expect(jobsLine({ baseline: 111, now: 261 })).toBe('111 jobs became 261.')
    expect(jobsLine({ baseline: 40, now: 40 })).toBe('40 open jobs fit what you have told us so far.')
    expect(jobsLine({ baseline: 300, now: 120 })).toMatch(/120 jobs fit these answers, down from 300/)
    expect(jobsLine({ baseline: null, now: null })).toMatch(/as soon as your account is ready/)
    expect(computePayoff('aiming', { function: 'Finance', level: 'VP' }, { ...input, jobs: { baseline: 10, now: 25 } }).headline).toBe('10 jobs became 25.')
  })

  it('sizes the first week with the same target the plan uses: 60 minutes, 30 for a light pace', () => {
    expect(weeklyTargetMinutes('LAID_OFF', 'APPLYING', 'ACTIVELY_SEARCHING')).toBe(60)
    expect(weeklyTargetMinutes('LAID_OFF', 'APPLYING', 'CASUALLY_LOOKING')).toBe(30)
    expect(weeklyTargetMinutes('GROWING', 'STAYING', null)).toBe(30)
  })

  it('writes the sample note in the chosen tone', () => {
    const step = 'Tell 10 people you’re looking'
    expect(sampleNote('TOUGH_LOVE', step)).toMatch(/before lunch/)
    expect(sampleNote('GENTLE_ENCOURAGEMENT', step)).toMatch(/gentle/)
    expect(sampleNote(null, step)).toContain(step)
    const p = computePayoff('coach', { pushStyle: 'TOUGH_LOVE', intensity: 'CASUALLY_LOOKING' }, { journey: 'LAID_OFF', storedStage: 'APPLYING' })
    expect(p.headline).toMatch(/about 30 minutes/)
    expect(p.lines[0]).toMatch(/before lunch/)
  })

  it('says how many answers the résumé filled in', () => {
    const got = prefilledAnswers({ firstName: 'Ana', email: 'a@b.co', primaryFunction: 'Finance', currentCity: 'Columbus', resumeKeywords: ['SQL'] })
    expect(got).toEqual(['Your name', 'Your email', 'Your job function', 'Where you live', 'Your skills and tools'])
    expect(computePayoff('resume', {}, { ...input, prefilled: got }).headline).toBe('We filled in 5 answers for you.')
  })
})

describe('finish screen', () => {
  it('lists what was gained and nothing about money', () => {
    const gains = finishGains({ journey: 'LAID_OFF', stage: 'APPLYING', intensity: 'ACTIVELY_SEARCHING', prefilled: ['Your name'], jobs: { baseline: null, now: 42 }, hasCity: true })
    expect(gains.map((g) => g.place)).toEqual(['Plan', 'Profile', 'Jobs', 'Home'])
    expect(gains.some((g) => /salary|savings|runway|pay floor/i.test(g.title + g.detail))).toBe(false)
  })

  it('offers one optional next question, and none once it is answered', () => {
    expect(nextOptionalQuestion({ networkComfortLevel: null, searching: true })?.options).toHaveLength(4)
    expect(nextOptionalQuestion({ networkComfortLevel: 'VERY_COMFORTABLE', searching: true })).toBeNull()
  })
})

describe('google scan reveal', () => {
  it('shows only what was found, with a reason for each', () => {
    const f = describeFindings({ ...EMPTY_SCAN, applications: 14, interviewInvites: 1, calendarInterviews: 1 })
    expect(f.map((x) => x.key)).toEqual(['applications', 'interviews'])
    expect(f[0].title).toBe('14 applications you already sent')
    expect(f.every((x) => x.why.length > 20)).toBe(true)
  })

  it('counts the stored rows by type and ignores the rest', () => {
    const c = countsFromGroups(
      [{ type: 'APPLICATION_CONFIRMATION', count: 9 }, { type: 'REJECTION', count: 4 }, { type: 'NETWORKING_OUTREACH', count: 2 }, { type: 'INTRO_REQUEST', count: 1 }],
      [{ type: 'INTERVIEW', count: 3 }, { type: 'NOT_JOB_SEARCH', count: 40 }],
    )
    expect(c).toEqual({ ...EMPTY_SCAN, applications: 9, networkingMessages: 3, calendarInterviews: 3 })
  })

  it('moves from not connected, to scanning, to found or nothing yet', () => {
    expect(revealState({ connected: false, syncedAll: false, counts: EMPTY_SCAN })).toBe('not_connected')
    expect(revealState({ connected: true, syncedAll: false, counts: EMPTY_SCAN })).toBe('scanning')
    expect(revealState({ connected: true, syncedAll: true, counts: EMPTY_SCAN })).toBe('nothing_yet')
    expect(revealState({ connected: true, syncedAll: false, counts: { ...EMPTY_SCAN, offers: 1 } })).toBe('found')
  })
})

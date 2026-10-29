import { describe, expect, it } from 'vitest'
import { DEFAULT_DAILY_CAP, MIN_GAP_DAYS, STEP_DAY, STEP_WINDOW_DAYS, nurtureDailyCap, nurtureEmailsOn, nurtureRef } from '@/lib/leads/nurture/config'
import { nextNurtureStep, stepWindowOpen } from '@/lib/leads/nurture/schedule'

const DAY = 24 * 60 * 60 * 1000
const anchor = new Date('2026-10-01T14:00:00Z')
const at = (days: number) => new Date(anchor.getTime() + days * DAY)

describe('nurture schedule', () => {
  it('is nothing before day 3', () => {
    expect(nextNurtureStep({ now: at(2.9), anchor, sent: {}, lastEmailAt: null })).toBeNull()
  })

  it('sends the next step on day 3, then 7, then 14', () => {
    expect(nextNurtureStep({ now: at(3), anchor, sent: {}, lastEmailAt: null })).toBe('next_step')
    expect(nextNurtureStep({ now: at(7), anchor, sent: { next_step: at(3) }, lastEmailAt: at(3) })).toBe('data_point')
    expect(nextNurtureStep({ now: at(14), anchor, sent: { next_step: at(3), data_point: at(7) }, lastEmailAt: at(7) })).toBe('assessment')
  })

  it('never sends a step twice', () => {
    expect(nextNurtureStep({ now: at(4), anchor, sent: { next_step: at(3) }, lastEmailAt: at(3) })).toBeNull()
    expect(nextNurtureStep({ now: at(15), anchor, sent: { next_step: at(3), data_point: at(7), assessment: at(14) }, lastEmailAt: at(14) })).toBeNull()
  })

  it('skips a step whose window has passed instead of sending it late', () => {
    // Switched on at day 8: the day-3 note (window to day 7) is skipped; the day-7 note is still fresh.
    expect(nextNurtureStep({ now: at(8), anchor, sent: {}, lastEmailAt: null })).toBe('data_point')
    // Day 12: nothing is in its window (day 7 + 4 = 11, day 14 not yet).
    expect(nextNurtureStep({ now: at(12), anchor, sent: {}, lastEmailAt: null })).toBeNull()
    // Day 19: even the last one is stale.
    expect(nextNurtureStep({ now: at(14 + STEP_WINDOW_DAYS), anchor, sent: {}, lastEmailAt: null })).toBeNull()
  })

  it('does not go back to an earlier step once a later one has been sent', () => {
    expect(nextNurtureStep({ now: at(7), anchor, sent: { data_point: at(7) }, lastEmailAt: at(7) })).toBeNull()
    expect(nextNurtureStep({ now: at(15), anchor, sent: { data_point: at(7) }, lastEmailAt: at(7) })).toBe('assessment')
  })

  it('keeps the minimum gap after any other email, including a lifecycle one', () => {
    const justSent = new Date(at(3).getTime() - (MIN_GAP_DAYS * DAY - 60_000))
    expect(nextNurtureStep({ now: at(3), anchor, sent: {}, lastEmailAt: justSent })).toBeNull()
    const longAgo = new Date(at(3).getTime() - MIN_GAP_DAYS * DAY)
    expect(nextNurtureStep({ now: at(3), anchor, sent: {}, lastEmailAt: longAgo })).toBe('next_step')
  })

  it('a step delayed by the gap still goes out inside its window', () => {
    // A lifecycle email on day 2 pushes the day-3 note to day 4.
    expect(nextNurtureStep({ now: at(3.5), anchor, sent: {}, lastEmailAt: at(2) })).toBeNull()
    expect(nextNurtureStep({ now: at(4), anchor, sent: {}, lastEmailAt: at(2) })).toBe('next_step')
  })

  it('has windows that do not overlap, so two steps are never due at once', () => {
    expect(STEP_DAY.next_step + STEP_WINDOW_DAYS).toBeLessThanOrEqual(STEP_DAY.data_point)
    expect(STEP_DAY.data_point + STEP_WINDOW_DAYS).toBeLessThanOrEqual(STEP_DAY.assessment)
    expect(stepWindowOpen('next_step', anchor, at(STEP_DAY.next_step + STEP_WINDOW_DAYS))).toBe(false)
  })
})

describe('nurture switches', () => {
  it('is off unless NURTURE_EMAILS is exactly 1', () => {
    delete process.env.NURTURE_EMAILS
    expect(nurtureEmailsOn()).toBe(false)
    process.env.NURTURE_EMAILS = 'true'
    expect(nurtureEmailsOn()).toBe(false)
    process.env.NURTURE_EMAILS = '1'
    expect(nurtureEmailsOn()).toBe(true)
    delete process.env.NURTURE_EMAILS
  })

  it('has a daily cap of 20 unless set, and ignores nonsense', () => {
    delete process.env.NURTURE_DAILY_CAP
    expect(nurtureDailyCap()).toBe(DEFAULT_DAILY_CAP)
    expect(DEFAULT_DAILY_CAP).toBe(20)
    process.env.NURTURE_DAILY_CAP = '5'
    expect(nurtureDailyCap()).toBe(5)
    process.env.NURTURE_DAILY_CAP = '0'
    expect(nurtureDailyCap()).toBe(0)
    process.env.NURTURE_DAILY_CAP = 'lots'
    expect(nurtureDailyCap()).toBe(DEFAULT_DAILY_CAP)
    process.env.NURTURE_DAILY_CAP = '-3'
    expect(nurtureDailyCap()).toBe(DEFAULT_DAILY_CAP)
    delete process.env.NURTURE_DAILY_CAP
  })

  it('keys a send by step and lowercased address', () => {
    expect(nurtureRef('data_point', ' Ann@Example.org ')).toBe('nurture:data_point:ann@example.org')
  })
})

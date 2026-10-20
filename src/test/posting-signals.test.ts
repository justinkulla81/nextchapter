import { describe, expect, it } from 'vitest'
import {
  importPostingSignalFields,
  isOpenToChangers,
  OPEN_FILTER_VALUE,
  parseOpenParam,
  postingSignalTag,
  tagTakesHintSlot,
  wantsChangerLift,
} from '@/lib/jobs/posting-signals'
import { boardHref, BOARD_URL_PARAMS } from '@/lib/jobs/board-url'
import { listItemOf, oneFact } from '@/lib/jobs/find-list'

describe('importPostingSignalFields', () => {
  it('leaves the stored value alone when not sent', () => {
    expect(importPostingSignalFields({})).toEqual({})
  })
  it('keeps known ids only, in canonical order', () => {
    expect(importPostingSignalFields({ postingSignals: ['high_eq', 'nope', 'career_changer_welcome', 3] })).toEqual({
      postingSignals: ['career_changer_welcome', 'high_eq'],
    })
  })
  it('clears with an empty list or junk', () => {
    expect(importPostingSignalFields({ postingSignals: [] })).toEqual({ postingSignals: [] })
    expect(importPostingSignalFields({ postingSignals: 'high_eq' })).toEqual({ postingSignals: [] })
  })
})

describe('filter and lift', () => {
  it('the filter keeps either welcome signal, not EQ alone', () => {
    expect(isOpenToChangers(['career_changer_welcome'])).toBe(true)
    expect(isOpenToChangers(['ai_upskilled_welcome'])).toBe(true)
    expect(isOpenToChangers(['high_eq'])).toBe(false)
    expect(isOpenToChangers(undefined)).toBe(false)
  })
  it('parses the open parameter', () => {
    expect(parseOpenParam(OPEN_FILTER_VALUE)).toBe(true)
    expect(parseOpenParam('1')).toBe(false)
    expect(parseOpenParam(undefined)).toBe(false)
  })
  it('lifts for pivoting or early-career members only', () => {
    expect(wantsChangerLift({ pivoting: true, earlyCareer: false })).toBe(true)
    expect(wantsChangerLift({ pivoting: false, earlyCareer: true })).toBe(true)
    expect(wantsChangerLift({ pivoting: false, earlyCareer: false })).toBe(false)
  })
  it('board links keep and clear the filter', () => {
    expect(BOARD_URL_PARAMS).toContain('open')
    expect(boardHref('q=cfo&ai=ai', { open: OPEN_FILTER_VALUE })).toBe('?q=cfo&ai=ai&open=changers')
    expect(boardHref('q=cfo&open=changers', { open: null })).toBe('?q=cfo')
  })
})

describe('the one tag', () => {
  it('shows one tag at most, welcome first for lifted members', () => {
    expect(postingSignalTag(['high_eq', 'ai_upskilled_welcome'])).toBe('high_eq')
    expect(postingSignalTag(['high_eq', 'ai_upskilled_welcome'], { lift: true })).toBe('ai_upskilled_welcome')
    expect(postingSignalTag(['high_eq', 'career_changer_welcome'])).toBe('career_changer_welcome')
    expect(postingSignalTag([])).toBeNull()
  })
  it('takes the hint slot only for a welcome tag shown to a lifted member', () => {
    expect(tagTakesHintSlot('career_changer_welcome', true)).toBe(true)
    expect(tagTakesHintSlot('high_eq', true)).toBe(false)
    expect(tagTakesHintSlot('career_changer_welcome', false)).toBe(false)
  })
  it('the list row: the tag replaces the posted date, and the fewer-applicants claim only when first', () => {
    const fewer = { label: 'Likely fewer applicants', because: 'Search-firm listing' }
    expect(oneFact({ posted: 'Posted 2 days ago', signal: 'high_eq' })).toBe('Values EQ')
    expect(oneFact({ posted: 'Posted 2 days ago', fewerApplicants: fewer, signal: 'high_eq' })).toMatch(/^Likely fewer applicants/)
    expect(oneFact({ posted: 'Posted 2 days ago', fewerApplicants: fewer, signal: 'career_changer_welcome', signalFirst: true })).toBe('Open to career changers')
    const item = listItemOf({ id: 'j', kind: 'board', title: 'CFO', companyName: 'Acme', place: null, verdict: 'good', why: null, fact: 'Values EQ', signal: 'high_eq' })
    expect(item.signal).toBe('high_eq')
    const plain = listItemOf({ id: 'j', kind: 'board', title: 'CFO', companyName: 'Acme', place: null, verdict: 'good', why: null, fact: 'Posted 2 days ago', signal: 'high_eq' })
    expect(plain.signal).toBeNull()
  })
})

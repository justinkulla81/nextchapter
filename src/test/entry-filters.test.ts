import { describe, expect, it } from 'vitest'
import { noExperienceQuote, parseEntryParam, passesEntryFilters, toggleEntryParam } from '@/lib/jobs/entry-filters'
import { importPostingSignalFields, isOpenToChangers, postingSignalTag, tagTakesHintSlot } from '@/lib/jobs/posting-signals'
import { boardHref, BOARD_URL_PARAMS } from '@/lib/jobs/board-url'
import { entryLevelLine, floorCount } from '@/lib/marketing/workforce-numbers-format'
import { pctOf } from '@/lib/jobs/entry-market'

describe('entry filter URL parameter', () => {
  it('reads known keys only, in canonical order', () => {
    expect(parseEntryParam('ai,noexp')).toEqual(['noexp', 'ai'])
    expect(parseEntryParam('noexp,junk')).toEqual(['noexp'])
    expect(parseEntryParam(undefined)).toEqual([])
    expect(parseEntryParam(['ai'])).toEqual(['ai'])
  })
  it('toggles one key and keeps the other', () => {
    expect(toggleEntryParam([], 'ai')).toBe('ai')
    expect(toggleEntryParam(['ai'], 'noexp')).toBe('noexp,ai')
    expect(toggleEntryParam(['noexp', 'ai'], 'noexp')).toBe('ai')
    expect(toggleEntryParam(['ai'], 'ai')).toBeNull()
  })
  it('is a board parameter, kept by other links', () => {
    expect(BOARD_URL_PARAMS).toContain('entry')
    expect(boardHref('entry=noexp&q=analyst', { view: 'fresh' })).toContain('entry=noexp')
  })
})

describe('passesEntryFilters', () => {
  it('needs every filter that is on', () => {
    expect(passesEntryFilters(['no_experience_ok'], ['noexp'])).toBe(true)
    expect(passesEntryFilters(['entry_ai'], ['noexp'])).toBe(false)
    expect(passesEntryFilters(['entry_ai', 'entry_ai_preferred'], ['ai'])).toBe(true)
    expect(passesEntryFilters(['no_experience_ok'], ['noexp', 'ai'])).toBe(false)
    expect(passesEntryFilters(undefined, [])).toBe(true)
    expect(passesEntryFilters(undefined, ['ai'])).toBe(false)
  })
})

describe('entry signals in postingSignals', () => {
  it('the import keeps them after the welcome signals', () => {
    expect(importPostingSignalFields({ postingSignals: ['entry_ai', 'high_eq', 'no_experience_ok', 'entry_ai_preferred', 'x'] })).toEqual({
      postingSignals: ['high_eq', 'no_experience_ok', 'entry_ai', 'entry_ai_preferred'],
    })
  })
  it('"No experience needed" is the tag cards show first, and takes the hint slot', () => {
    expect(postingSignalTag(['career_changer_welcome', 'no_experience_ok'])).toBe('no_experience_ok')
    expect(postingSignalTag(['entry_ai', 'entry_ai_preferred'])).toBeNull()
    expect(tagTakesHintSlot('no_experience_ok', false)).toBe(true)
  })
  it('does not change the open-to-changers filter', () => {
    expect(isOpenToChangers(['no_experience_ok', 'entry_ai'])).toBe(false)
  })
})

describe('noExperienceQuote', () => {
  it('quotes briefly, on a word boundary', () => {
    expect(noExperienceQuote('  No experience   required. ')).toBe('No experience required.')
    expect(noExperienceQuote(null)).toBeNull()
    const q = noExperienceQuote('word '.repeat(60), 40)!
    expect(q.length).toBeLessThanOrEqual(41)
    expect(q.endsWith('…')).toBe(true)
  })
})

describe('workforce line and admin percentages', () => {
  it('floors both counts and drops a missing half', () => {
    const base = { live: 1, checked24h: 0, aiSkill: 0, government: 0, nonprofit: 0, academia: 0, flagged: 0, clearance: 0, employers: 0, occupations: 0, industries: 0, functions: 0, states: 0, places: 0 }
    expect(entryLevelLine({ ...base, entryNoExp: 2953, entryAi: 9987 })).toBe(
      `${floorCount(2953)} entry-level jobs welcome people with no experience; ${floorCount(9987)} entry-level jobs ask for AI skills.`
    )
    expect(entryLevelLine({ ...base, entryNoExp: 0, entryAi: 120 })).toBe('120 entry-level jobs ask for AI skills.')
    expect(entryLevelLine({ ...base })).toBeNull()
    expect(entryLevelLine(null)).toBeNull()
  })
  it('percent of a whole', () => {
    expect(pctOf(5, 200)).toBe('2.5%')
    expect(pctOf(50, 200)).toBe('25%')
    expect(pctOf(1, 0)).toBe('—')
  })
})

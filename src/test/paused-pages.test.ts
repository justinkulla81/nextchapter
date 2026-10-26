import { describe, expect, it } from 'vitest'
import { PAUSED_HEAVY_PREFIXES, pausedPrefixes } from '@/lib/paused-pages'

describe('pausedPrefixes', () => {
  it('1 pauses every heavy section', () => expect(pausedPrefixes('1')).toEqual(PAUSED_HEAVY_PREFIXES))
  it('a list pauses only those sections', () => expect(pausedPrefixes('/conferences, /places')).toEqual(['/conferences', '/places']))
  it('ignores names that are not heavy sections', () => expect(pausedPrefixes('/conferences,/dashboard')).toEqual(['/conferences']))
  it('unset or other values pause nothing', () => {
    expect(pausedPrefixes(undefined)).toEqual([])
    expect(pausedPrefixes('0')).toEqual([])
    expect(pausedPrefixes('')).toEqual([])
  })
})

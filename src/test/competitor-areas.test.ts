import { describe, it, expect } from 'vitest'
import { cleanAreas, cleanRelationship, parseLines, parseCustomers, parseWins, hostOf, homepageOf, parseUsd } from '@/lib/vision/competitor-areas'

describe('competitor areas and parsers', () => {
  it('keeps only vocabulary areas', () => {
    expect(cleanAreas(['coaching', 'Career Exploration', 'made up', 'job-search', 'coaching'])).toEqual(['coaching', 'career_exploration', 'job_search'])
    expect(cleanAreas('learning, resume & x')).toEqual(['learning'])
  })
  it('falls back to direct for an unknown relationship', () => {
    expect(cleanRelationship('PARTNER')).toBe('PARTNER')
    expect(cleanRelationship('whatever')).toBe('DIRECT')
  })
  it('splits lines and drops bullets and repeats', () => {
    expect(parseLines('- one\n• two\n\none\n* three')).toEqual(['one', 'two', 'three'])
  })
  it('reads customers with an optional note and link', () => {
    expect(parseCustomers('New Mexico DWS | sole source 2019 | https://x.gov/a\nOhio')).toEqual([
      { name: 'New Mexico DWS', note: 'sole source 2019', url: 'https://x.gov/a' }, { name: 'Ohio' },
    ])
  })
  it('reads wins and ignores a bad link', () => {
    expect(parseWins('Career portal | SC CCWD | $1M | 2025 | nope')[0]).toEqual({ what: 'Career portal', buyer: 'SC CCWD', amount: '$1M', year: '2025' })
  })
  it('finds the host from anything pasted', () => {
    expect(hostOf('https://www.Example.com/about?x=1')).toBe('example.com')
    expect(hostOf('futurefit.ai')).toBe('futurefit.ai')
    expect(hostOf('not a url')).toBeNull()
    expect(homepageOf('http://www.a.io/b')).toBe('https://a.io')
  })
  it('reads dollar amounts', () => {
    expect(parseUsd('$24M')).toBe(24_000_000)
    expect(parseUsd('C$5.7M')).toBe(5_700_000)
    expect(parseUsd('1,250,000')).toBe(1_250_000)
    expect(parseUsd('about 3 million')).toBe(3_000_000)
    expect(parseUsd('n/a')).toBeNull()
  })
})

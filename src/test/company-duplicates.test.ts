import { describe, expect, it } from 'vitest'
import { findAbbreviationSuggestions, initialsOf, squashKey } from '@/lib/companies/company-duplicates'

const co = (id: string, name: string, key: string) => ({ id, name, canonicalNameNormalized: key })

describe('company duplicates', () => {
  it('squashes spacing, punctuation and ampersands', () => {
    expect(squashKey('jp morgan chase')).toBe('jpmorganchase')
    expect(squashKey('bausch & lomb')).toBe(squashKey('bausch lomb'))
  })

  it('takes initials of meaningful words', () => {
    expect(initialsOf('amazon web services')).toBe('aws')
    expect(initialsOf('bank of america')).toBe('ba')
  })

  it('suggests an acronym for the long name, never the reverse', () => {
    const s = findAbbreviationSuggestions([
      co('1', 'AWS', 'aws'),
      co('2', 'Amazon Web Services', 'amazon web services'),
    ])
    expect(s).toHaveLength(1)
    expect(s[0].abbreviation.id).toBe('1')
    expect(s[0].fullName.id).toBe('2')
  })

  it('ignores two-letter names and short long-names', () => {
    expect(findAbbreviationSuggestions([co('1', 'BA', 'ba'), co('2', 'Bank of America', 'bank of america')])).toEqual([])
    expect(findAbbreviationSuggestions([co('1', 'Meta', 'meta'), co('2', 'Mega Tech', 'mega tech')])).toEqual([])
  })

  it('does not treat a spaced-out name as an acronym', () => {
    expect(findAbbreviationSuggestions([co('1', 'A W S', 'a w s'), co('2', 'Amazon Web Services', 'amazon web services')])).toEqual([])
  })
})

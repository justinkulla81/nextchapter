import { describe, expect, it } from 'vitest'
import { stripTrailingPunctuation } from '@/lib/http/trailing-punctuation'

describe('stripTrailingPunctuation', () => {
  it('strips punctuation copied out of a sentence', () => {
    expect(stripTrailingPunctuation('/after-a-layoff.')).toBe('/after-a-layoff')
    expect(stripTrailingPunctuation('/places/california/county/los-angeles-county.')).toBe('/places/california/county/los-angeles-county')
    expect(stripTrailingPunctuation('/jobs),')).toBe('/jobs')
    expect(stripTrailingPunctuation('/layoffs%22')).toBe('/layoffs')
  })

  it('leaves clean addresses and files alone', () => {
    expect(stripTrailingPunctuation('/after-a-layoff')).toBeNull()
    expect(stripTrailingPunctuation('/feeds/layoffs.xml')).toBeNull()
    expect(stripTrailingPunctuation('/')).toBeNull()
    expect(stripTrailingPunctuation('/.')).toBeNull()
  })
})

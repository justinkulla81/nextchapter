import { describe, expect, it } from 'vitest'
import { completeTruncatedTopLevel } from '@/lib/http/truncated-top-level'

describe('completeTruncatedTopLevel', () => {
  it('completes a link cut off at a hyphen', () => {
    expect(completeTruncatedTopLevel('/economic-')).toBe('/economic-development')
    expect(completeTruncatedTopLevel('/workforce-')).toBe('/workforce-boards')
    expect(completeTruncatedTopLevel('/unemployment-ben/')).toBe('/unemployment-benefits')
  })

  it('leaves real routes, ambiguous, short and deeper addresses alone', () => {
    expect(completeTruncatedTopLevel('/economic-development')).toBeNull()
    expect(completeTruncatedTopLevel('/for-')).toBeNull() // for-coaches, for-colleges, ...
    expect(completeTruncatedTopLevel('/job')).toBeNull()
    expect(completeTruncatedTopLevel('/economic-development/flor')).toBeNull()
    expect(completeTruncatedTopLevel('/zzzz')).toBeNull()
    expect(completeTruncatedTopLevel('/api-')).toBeNull()
  })
})

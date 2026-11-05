import { describe, expect, it } from 'vitest'
import { NOT_RECRUITER_SOURCES, isNotRecruiterSource } from '@/lib/search-firms/not-recruiters'

describe('not-recruiter sources', () => {
  it('names crawler sources only, and matches them exactly', () => {
    expect(NOT_RECRUITER_SOURCES.every((k) => k.startsWith('sf:'))).toBe(true)
    expect(isNotRecruiterSource('sf:keystonerecruiting')).toBe(true)
    expect(isNotRecruiterSource('sf:keystone')).toBe(false)
    expect(isNotRecruiterSource(null)).toBe(false)
  })
})

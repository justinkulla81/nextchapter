import { describe, expect, it } from 'vitest'
import { NOT_RECRUITER_ORGS, NOT_RECRUITER_SOURCES, isNotRecruiterOrg, isNotRecruiterSource } from '@/lib/search-firms/not-recruiters'

describe('not-recruiter sources', () => {
  it('names crawler sources only, and matches them exactly', () => {
    expect(NOT_RECRUITER_SOURCES.every((k) => k.startsWith('sf:'))).toBe(true)
    expect(isNotRecruiterSource('sf:keystonerecruiting')).toBe(true)
    expect(isNotRecruiterSource('sf:keystone')).toBe(false)
    expect(isNotRecruiterSource(null)).toBe(false)
  })

  it('names organizations by their stored lower-case name and matches them exactly', () => {
    expect(NOT_RECRUITER_ORGS.every((n) => n === n.toLowerCase())).toBe(true)
    expect(isNotRecruiterOrg('justworks')).toBe(true)
    expect(isNotRecruiterOrg('robert half')).toBe(false)
    expect(isNotRecruiterOrg('justworks inc')).toBe(false)
    expect(isNotRecruiterOrg(undefined)).toBe(false)
  })
})

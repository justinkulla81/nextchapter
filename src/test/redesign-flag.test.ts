import { describe, it, expect } from 'vitest'
import { isRedesignOn } from '@/lib/redesign/flag'

describe('isRedesignOn', () => {
  it('is off unless switched on', () => {
    expect(isRedesignOn('a@b.com', {})).toBe(false)
    expect(isRedesignOn('a@b.com', { CANDIDATE_REDESIGN: 'off' })).toBe(false)
  })
  it('is on for everyone with CANDIDATE_REDESIGN=on', () => {
    expect(isRedesignOn(null, { CANDIDATE_REDESIGN: 'on' })).toBe(true)
    expect(isRedesignOn('x@y.com', { CANDIDATE_REDESIGN: ' ON ' })).toBe(true)
  })
  it('is on only for listed emails otherwise, ignoring case and spaces', () => {
    const env = { CANDIDATE_REDESIGN_EMAILS: 'Justin@Example.com, other@example.com' }
    expect(isRedesignOn('justin@example.com', env)).toBe(true)
    expect(isRedesignOn('stranger@example.com', env)).toBe(false)
    expect(isRedesignOn(null, env)).toBe(false)
  })

  it('is always on for the owner, with no settings', () => {
    expect(isRedesignOn('Justin.Kulla@gmail.com', {})).toBe(true)
  })
})

import { describe, expect, it } from 'vitest'
import { RANKING_METHOD, staleGroups } from '@/lib/rankings/method-version'

describe('ranking method versions', () => {
  it('rebuilds only the groups whose stored version differs, metro first', () => {
    expect(staleGroups({ ...RANKING_METHOD })).toEqual([])
    const stale = staleGroups({})
    expect(stale[0]).toBe('metro')
    expect(stale).toEqual(expect.arrayContaining(['places', 'functions', 'industry']))
    expect(stale).not.toContain('skills')
  })
})

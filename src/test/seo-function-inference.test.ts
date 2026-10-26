import { describe, expect, it } from 'vitest'
import { effectiveFunctions, inferFunctions } from '@/lib/seo/function-inference'

describe('function inference', () => {
  it('reads functions from roles', () => {
    expect(inferFunctions(['trial attorney', 'litigation paralegal'])).toContain('Legal')
    expect(inferFunctions(['materials engineer', 'battery engineer'])[0]).toBe('Engineering')
    expect(inferFunctions(['provost', 'dean', 'professor'])).toContain('Academic')
  })
  it('keeps at most two', () => {
    expect(inferFunctions(['cfo', 'security engineer', 'sales director', 'recruiter']).length).toBeLessThanOrEqual(2)
  })
  it('prefers the organizer tags and finds nothing in nothing', () => {
    expect(effectiveFunctions({ functions: ['Finance'], roles: ['dean'] })).toEqual(['Finance'])
    expect(effectiveFunctions({ functions: [], roles: ['dean'] })).toContain('Academic')
    expect(inferFunctions([])).toEqual([])
  })
})

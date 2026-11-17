import { describe, expect, it } from 'vitest'
import { lookingForOf, showsFractional, workTypesFor } from '@/lib/jobs/looking-for'

describe('looking for', () => {
  it('maps each choice to kinds of work and back', () => {
    expect(workTypesFor('full_time')).toEqual(['full_time'])
    expect(workTypesFor('fractional')).toEqual(['part_time', 'contract', 'advisory'])
    expect(workTypesFor('both')).toEqual(['full_time', 'part_time', 'contract', 'advisory'])
    for (const c of ['full_time', 'fractional', 'both'] as const) expect(lookingForOf(workTypesFor(c))).toBe(c)
  })

  it('reads a saved mix of kinds as the nearest choice', () => {
    expect(lookingForOf(['full_time', 'contract'])).toBe('both')
    expect(lookingForOf(['advisory'])).toBe('fractional')
    expect(showsFractional(['full_time'])).toBe(false)
  })
})

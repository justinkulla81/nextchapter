import { describe, expect, it } from 'vitest'
import { placeOutlook } from '@/lib/places/outlook'

describe('place outlook', () => {
  it('is Building when jobs, people and unemployment all point up', () => {
    const o = placeOutlook({ jobsChangePct: 6, populationChangePct: 4, unemployment: { rate: 3.5, yearAgo: 3.9 } })
    expect(o.label).toBe('Building')
    expect(o.evidence).toHaveLength(3)
  })
  it('is Cooling when they point down', () => {
    expect(placeOutlook({ jobsChangePct: -2, populationChangePct: -3, unemployment: { rate: 5.2, yearAgo: 4.6 } }).label).toBe('Cooling')
  })
  it('is Steady when mixed', () => {
    expect(placeOutlook({ jobsChangePct: 2, populationChangePct: 0.5, unemployment: { rate: 4.0, yearAgo: 4.0 } }).label).toBe('Steady')
  })
  it('needs two inputs', () => {
    expect(placeOutlook({ jobsChangePct: 9, populationChangePct: null, unemployment: null }).label).toBe('Not enough data')
    expect(placeOutlook({ jobsChangePct: null, populationChangePct: null, unemployment: null }).evidence).toEqual([])
  })
})

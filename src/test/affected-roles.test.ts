import { describe, expect, it } from 'vitest'
import { affectedRoles } from '@/lib/warn/affected-roles'

describe('affectedRoles', () => {
  it('names the groups a headline states', () => {
    expect(affectedRoles(['Acme cuts 300 software engineers and sales staff'])).toEqual(['Engineers', 'Sales'])
    expect(affectedRoles(['Plant closing: 120 factory workers lose jobs'])).toEqual(['Factory and plant'])
    expect(affectedRoles(['Hospital lays off nurses'])).toEqual(['Healthcare'])
  })
  it('reads across several headlines and caps at three', () => {
    expect(affectedRoles(['Acme lays off engineers', 'Acme sales, marketing and HR staff hit too'])).toHaveLength(3)
  })
  it('returns nothing when no group is named', () => {
    expect(affectedRoles(['Acme to lay off 500 workers', null, undefined])).toEqual([])
    expect(affectedRoles([])).toEqual([])
  })
})

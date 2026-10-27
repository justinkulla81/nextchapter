import { describe, it, expect } from 'vitest'
import { inferArea, isAreaKey, TODO_AREA_GROUPS } from '@/lib/crm/todo-areas'

describe('inferArea', () => {
  it('uses a stored area over anything inferred', () => {
    expect(inferArea({ area: 'finance-admin', title: 'Keynote at HR Tech' })).toBe('finance-admin')
  })
  it('ignores an unknown stored area', () => {
    expect(isAreaKey('nonsense')).toBe(false)
    expect(inferArea({ area: 'nonsense', title: 'Fix the spam wave' })).toBe('tech-security')
  })
  it('files speaking, layoffs, fundraising, content from the title', () => {
    expect(inferArea({ title: 'Speaking: Apply Call for speakers · SHRM' })).toBe('speaking')
    expect(inferArea({ title: 'Find a contact at Acme (P0 rapid response)' })).toBe('layoffs-outreach')
    expect(inferArea({ title: 'Send deck to the seed investor' })).toBe('fundraising')
    expect(inferArea({ title: 'Draft LinkedIn post on the jobs report' })).toBe('content')
  })
  it('falls back to the organization type, then to unsorted', () => {
    expect(inferArea({ title: 'Call back', orgTypes: ['UNIVERSITY'] })).toBe('sales-highered')
    expect(inferArea({ title: 'Call back', orgTypes: ['SEARCH_FIRM'] })).toBe('sales-hiring')
    expect(inferArea({ title: 'Call the printer' })).toBe('other')
  })
  it('lists every area once under a group', () => {
    const keys = TODO_AREA_GROUPS.flatMap((g) => g.areas.map((a) => a.key))
    expect(new Set(keys).size).toBe(keys.length)
  })
})

import { describe, expect, it } from 'vitest'
import { resolveArea, type AreaCatalog } from '@/lib/careers/area'

// BLS names a metro by its principal cities, so the towns and boroughs where the highest local pay is earned are
// matched through our own list. Without it they would be shown their state's pay.
const catalog: AreaCatalog = {
  states: [
    { code: '06', name: 'California' },
    { code: '36', name: 'New York' },
  ],
  metros: [
    { code: '41940', name: 'San Jose-Sunnyvale-Santa Clara, CA' },
    { code: '41860', name: 'San Francisco-Oakland-Fremont, CA' },
    { code: '35620', name: 'New York-Newark-Jersey City, NY-NJ' },
  ],
}

describe('metro for towns the BLS name does not list', () => {
  it.each([
    ['San Jose', 'CA', '41940'],
    ['Palo Alto', 'CA', '41940'],
    ['Mountain View', 'CA', '41940'],
    ['Menlo Park', 'CA', '41860'],
    ['Brooklyn', 'NY', '35620'],
    ['Manhattan', 'NY', '35620'],
  ])('%s, %s is in metro %s', (city, state, code) => {
    expect(resolveArea({ city, state }, catalog).metro?.code).toBe(code)
  })
  it('keeps the state when the town is in no metro we hold', () => {
    const r = resolveArea({ city: 'Lone Pine', state: 'CA' }, catalog)
    expect(r.metro).toBeNull()
    expect(r.state?.code).toBe('06')
  })
})

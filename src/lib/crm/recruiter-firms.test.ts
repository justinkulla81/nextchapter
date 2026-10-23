import { describe, expect, it } from 'vitest'
import { groupByFirm, type FirmPerson } from './recruiter-firms'

const p = (id: string, orgId: string | null, org: string | null, o: Partial<FirmPerson> = {}): FirmPerson => ({
  id, name: id, title: null, org, orgId, email: null, guessed: false, phone: null, states: [], industries: [], functions: [], ...o,
})

describe('groupByFirm', () => {
  it('puts people under their firm, biggest firm first, firmless last', () => {
    const g = groupByFirm([p('a', null, null), p('b', 'f1', 'Small'), p('c', 'f2', 'Big'), p('d', 'f2', 'Big')])
    expect(g.map((x) => x.name)).toEqual(['Big', 'Small', 'No firm on file'])
    expect(g[0].people).toHaveLength(2)
  })
  it('lists reachable people first and ranks tags by how many recruiters share them', () => {
    const g = groupByFirm([
      p('z', 'f', 'F', { email: 'z@f.com', states: ['TX'], industries: ['technology'] }),
      p('a', 'f', 'F', { email: 'a@f.com', guessed: true, states: ['TX', 'CA'], industries: ['technology', 'healthcare'] }),
      p('m', 'f', 'F', { states: ['TX'], industries: ['healthcare'] }),
    ])[0]
    expect(g.people.map((x) => x.id)).toEqual(['z', 'a', 'm'])
    expect(g.states[0]).toBe('TX')
    expect(g.industries).toEqual(['healthcare', 'technology'])
  })
})

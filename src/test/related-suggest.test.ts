import { describe, expect, it } from 'vitest'
import { GROUP_CAP, byGroup, isLikelyPeerName, mergeSuggestions, suggestionLine, type Candidate, type Hit } from '@/lib/org-claims/related-suggest-rules'

const hit = (id: string, name = id): Hit => ({ orgId: id, name, slug: name.toLowerCase().replace(/\W+/g, '-'), orgTypes: [] })
const hits = (...h: Hit[]) => new Map(h.flatMap((x) => [[`k-${x.orgId}`, x] as const, [`alt-${x.orgId}`, x] as const]))

describe('related suggestions', () => {
  it('uses the first name that matches, and keeps the order', () => {
    const c: Candidate[] = [
      { group: 'PEERS', keys: ['nope', 'alt-a'], reason: 'Board' },
      { group: 'EMPLOYERS', keys: ['k-b'], reason: 'Member company' },
    ]
    expect(mergeSuggestions(c, hits(hit('a'), hit('b')), new Set()).map((s) => s.orgId)).toEqual(['a', 'b'])
  })
  it('leaves out ourselves, ones already linked, and names that match nothing', () => {
    const c: Candidate[] = [
      { group: 'PEERS', keys: ['k-self'], reason: 'x' },
      { group: 'PEERS', keys: ['k-linked'], reason: 'x' },
      { group: 'PEERS', keys: ['k-missing'], reason: 'x' },
      { group: 'PEERS', keys: ['k-ok'], reason: 'x' },
    ]
    expect(mergeSuggestions(c, hits(hit('self'), hit('linked'), hit('ok')), new Set(['self', 'linked'])).map((s) => s.orgId)).toEqual(['ok'])
  })
  it('suggests an organization once, under the first group that names it', () => {
    const c: Candidate[] = [
      { group: 'EMPLOYERS', keys: ['k-a'], reason: 'Hiring nearby' },
      { group: 'HIGHER_ED', keys: ['k-a'], reason: 'Near you' },
    ]
    const r = mergeSuggestions(c, hits(hit('a')), new Set())
    expect(r).toHaveLength(1)
    expect(r[0].group).toBe('EMPLOYERS')
  })
  it('caps each group', () => {
    const many = Array.from({ length: 30 }, (_, i) => hit(`e${i}`))
    const c: Candidate[] = many.map((h) => ({ group: 'EMPLOYERS' as const, keys: [`k-${h.orgId}`], reason: 'x' }))
    expect(mergeSuggestions(c, hits(...many), new Set())).toHaveLength(GROUP_CAP.EMPLOYERS)
  })
  it('groups in a fixed order and drops empty groups', () => {
    const c: Candidate[] = [
      { group: 'HIGHER_ED', keys: ['k-c'], reason: 'x' },
      { group: 'PEERS', keys: ['k-p'], reason: 'x' },
    ]
    expect(byGroup(mergeSuggestions(c, hits(hit('c'), hit('p')), new Set())).map((g) => g.key)).toEqual(['PEERS', 'HIGHER_ED'])
  })
  it('words the reminder', () => {
    expect(suggestionLine(1)).toMatch(/1 organization you/)
    expect(suggestionLine(7)).toMatch(/7 organizations you/)
  })
  it('keeps peers by what they do and drops schools, congregations and the boards that come from their own table', () => {
    for (const n of ['Louisville Economic Development Alliance inc', 'Louisville Urban League', 'Louisville Metro Government', 'Community Foundation of Louisville', 'Bowling Green Area Chamber of Commerce']) expect(isLikelyPeerName(n), n).toBe(true)
    for (const n of ['Louisville Presbyterian Theological Seminary', 'Jewish Community Center of Louisville', 'Galen College of Nursing-Louisville', 'KentuckianaWorks (Greater Louisville Workforce Development Board)', 'Norton Healthcare Goodwill Opportunity Campus']) expect(isLikelyPeerName(n), n).toBe(false)
  })
})

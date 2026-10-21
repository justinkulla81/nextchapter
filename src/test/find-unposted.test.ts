import { describe, it, expect } from 'vitest'
import { buildUnpostedItems, groupContactsByCompany, knowLine, linkedinPeopleSearchUrl, sourceLine, splitFirstView, UNPOSTED_FIRST_VIEW, type OpeningInput, type KnownPerson } from '@/lib/jobs/find-unposted'

const opening = (over: Partial<OpeningInput> & Pick<OpeningInput, 'id' | 'companyName'>): OpeningInput => ({
  signalType: 'EXEC_DEPARTURE',
  summary: 'The President retires December 31.',
  filingDate: new Date('2026-10-12T12:00:00Z'),
  filingUrl: 'https://www.sec.gov/x',
  source: 'sec',
  reason: 'Fits your finance background',
  companyRelation: null,
  ...over,
})
const priya: KnownPerson = { id: 'c1', name: 'Priya Shah', title: 'VP Operations' }
const marcus: KnownPerson = { id: 'c2', name: 'Marcus Lee', title: null }

describe('groupContactsByCompany', () => {
  it('joins SEC-style names to the names on contacts', () => {
    const map = groupContactsByCompany([
      { id: 'c1', name: 'Priya Shah', title: 'VP', company: 'Lemaitre Vascular, Inc.', inferredCompany: null },
      { id: 'c2', name: 'Marcus Lee', title: null, company: null, inferredCompany: 'Lemaitre Vascular' },
    ])
    expect(map.get('lemaitre vascular')?.map((p) => p.id)).toEqual(['c1', 'c2'])
  })
  it('lists a contact once when both company fields name the same employer', () => {
    const map = groupContactsByCompany([{ id: 'c1', name: 'A', title: 'x', company: 'Acme Inc', inferredCompany: 'Acme' }])
    expect(map.get('acme')).toHaveLength(1)
  })
})

describe('knowLine', () => {
  it('says no one when there is no contact', () => {
    expect(knowLine([])).toBe('No one you know there yet.')
  })
  it('names one, two, and many people', () => {
    expect(knowLine([priya])).toBe('Priya Shah (VP Operations) works there.')
    expect(knowLine([priya, marcus])).toBe('Priya Shah (VP Operations) and Marcus Lee work there.')
    expect(knowLine([priya, marcus, priya, marcus])).toBe('Priya Shah (VP Operations), Marcus Lee and 2 more work there.')
  })
})

describe('sourceLine', () => {
  it('states the fact the opening rests on', () => {
    expect(sourceLine('sec', new Date('2026-10-12T12:00:00Z'))).toBe('From a public SEC filing on Oct 12.')
    expect(sourceLine('news', new Date('2026-10-12T12:00:00Z'))).toBe('From a news report on Oct 12.')
  })
})

describe('buildUnpostedItems', () => {
  const openings = [
    opening({ id: 'a', companyName: 'CSX', signalType: 'EXEC_APPOINTMENT' }),
    opening({ id: 'b', companyName: 'Lemaitre Vascular, Inc.' }),
    opening({ id: 'c', companyName: 'Whatnot', signalType: 'FUNDING_RAISE', source: 'news' }),
  ]
  const contacts = new Map([['lemaitre vascular', [priya]]])
  const items = buildUnpostedItems(openings, contacts)

  it('keeps the ranked order', () => {
    expect(items.map((i) => i.id)).toEqual(['a', 'b', 'c'])
  })
  it('reaches out to the first person the member knows at the company', () => {
    expect(items[1].action).toMatchObject({ kind: 'contact', label: 'Reach out to Priya Shah', href: '/dashboard/network/contacts/c1', contactId: 'c1' })
  })
  it('falls back to a people search when the member knows no one there', () => {
    expect(items[0].action).toMatchObject({ kind: 'search', label: 'Find someone there', contactId: null })
    expect(items[0].action.href).toBe(linkedinPeopleSearchUrl('CSX'))
    const none = buildUnpostedItems(openings, new Map())
    expect(none.every((i) => i.action.kind === 'search')).toBe(true)
  })
  it('labels the signal and links the source, with no verdict or competition claim', () => {
    expect(items[0].signalLabel).toBe('Leadership change')
    expect(items[2].signalLabel).toBe('New funding')
    expect(items[2].filingLinkLabel).toBe('Read the report')
    expect(items[2].sourceLine).toBe('From a news report on Oct 12.')
    for (const i of items) expect(JSON.stringify(i).toLowerCase()).not.toMatch(/low competition|few applicants|crowd/)
  })
  it('returns nothing for no openings', () => {
    expect(buildUnpostedItems([], contacts)).toEqual([])
  })
})

describe('splitFirstView', () => {
  it('shows the first few and moves the rest behind Show more', () => {
    const many = Array.from({ length: UNPOSTED_FIRST_VIEW + 3 }, (_, i) => i)
    const { shown, more } = splitFirstView(many)
    expect(shown).toHaveLength(UNPOSTED_FIRST_VIEW)
    expect(more).toHaveLength(3)
    expect(splitFirstView([1]).more).toEqual([])
  })
})

import { describe, expect, it } from 'vitest'
import { customGrants, decodeEntities, grantSettingsFrom, mergeHits, usDateToIso } from '@/lib/higher-ed/grants'
import { directoryGrants, type DirectoryEntry } from '@/lib/higher-ed/grant-directory'
import { DIRECTORY_ENTRIES } from '@/lib/higher-ed/grant-directory-entries'
import { CHECKIN_ANSWERS, CHECKIN_BODY, GOOD_NEWS, isCheckInAnswer } from '@/lib/higher-ed/checkins'
import { matchesTargeting, memberTraits, NO_TARGETING } from '@/lib/higher-ed/services'

const hit = (id: string, title: string, extra: Partial<{ agency: string; closeDate: string; oppStatus: string }> = {}) => ({
  id,
  number: `N-${id}`,
  title,
  agency: extra.agency ?? 'Employment and Training Administration',
  agencyCode: 'DOL-ETA',
  openDate: '01/02/2026',
  closeDate: extra.closeDate ?? '',
  oppStatus: extra.oppStatus ?? 'posted',
})

describe('grants matching', () => {
  it('decodes Grants.gov entities and dates', () => {
    expect(decodeEntities('Veterans&rsquo; Program&#8239;Grant &amp; More')).toBe('Veterans’ Program Grant & More')
    expect(usDateToIso('04/30/2027')).toBe('2027-04-30')
    expect(usDateToIso('')).toBeNull()
  })

  it('keeps only titles that name the purpose, drops closed, overseas and research-training notices', () => {
    const grants = mergeHits(
      [
        {
          purpose: 'retraining',
          hits: [
            hit('1', 'Workforce Pathways for Dislocated Workers', { closeDate: '03/01/2027' }),
            hit('2', 'Genomic Variant Interactions'),
            hit('3', 'Apprenticeship Expansion', { closeDate: '01/01/2025' }),
            hit('4', 'Annual Program Statement for Workforce', { agency: 'U.S. Mission to Tunisia' }),
            hit('5', 'Ruth L. Kirschstein NRSA Institutional Research Training (T32)'),
          ],
        },
        { purpose: 'entrepreneurship', hits: [hit('1', 'Workforce Pathways for Dislocated Workers'), hit('6', 'Small Business Innovation Center', { oppStatus: 'forecasted' })] },
      ],
      '2026-11-17',
    )
    expect(grants.map((g) => g.id)).toEqual(['1', '6'])
    expect(grants[0].purposes).toEqual(['retraining'])
    expect(grants[1].status).toBe('forecasted')
    expect(grants[0].url).toBe('https://www.grants.gov/search-results-detail/1')
  })
})

describe('check-in answers', () => {
  it('offers the new answers in the page and the email', () => {
    expect(isCheckInAnswer('new_manager')).toBe(true)
    expect(isCheckInAnswer('starting_company')).toBe(true)
    for (const a of CHECKIN_ANSWERS) expect(CHECKIN_BODY).toContain(`&a=${a.key}`)
    expect(Object.keys(GOOD_NEWS)).toEqual(['new_job', 'new_manager', 'back_to_school', 'starting_company'])
  })

  it('turns an answer into a targeting moment, for alumni who have not joined too', () => {
    const manager = memberTraits({ major: null, school: null, department: null, classYear: 2010, checkInAnswer: 'new_manager' })
    const founder = memberTraits({ major: null, school: null, department: null, classYear: 2010, checkInAnswer: 'starting_company' })
    expect(matchesTargeting({ ...NO_TARGETING, moments: ['new_manager'] }, manager)).toBe(true)
    expect(matchesTargeting({ ...NO_TARGETING, moments: ['founders'] }, founder)).toBe(true)
    expect(matchesTargeting({ ...NO_TARGETING, moments: ['founders'] }, manager)).toBe(false)
  })
})

describe('state and foundation directory', () => {
  const entry = (id: string, x: Partial<DirectoryEntry>): DirectoryEntry => ({
    id,
    name: id,
    funder: 'F',
    kind: 'state',
    states: [],
    purposes: ['retraining'],
    how: 'rolling',
    deadline: null,
    amount: null,
    url: 'https://example.org',
    note: 'n',
    checked: '2026-11-17',
    ...x,
  })
  it('shows entries for the college’s states and national ones, and drops passed deadlines', () => {
    const entries = [entry('pa', { states: ['PA'] }), entry('fl', { states: ['FL'] }), entry('nat', { kind: 'foundation' }), entry('old', { states: ['PA'], deadline: '2026-01-01' })]
    expect(directoryGrants(['pa'], '2026-11-17', entries).map((g) => [g.id, g.source])).toEqual([
      ['pa', 'state'],
      ['nat', 'foundation'],
    ])
  })
  it('keeps every real entry well formed', () => {
    const ids = new Set<string>()
    for (const e of DIRECTORY_ENTRIES) {
      expect(e.id).toMatch(/^[a-z0-9][a-z0-9-]{0,63}$/)
      expect(ids.has(e.id)).toBe(false)
      ids.add(e.id)
      expect(e.url).toMatch(/^https:\/\//)
      expect(e.purposes.length).toBeGreaterThan(0)
      expect(e.checked).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      for (const s of e.states) expect(s).toMatch(/^[A-Z]{2}$/)
    }
  })
})

describe('grants a team adds', () => {
  it('reads settings safely and drops a passed deadline', () => {
    const s = grantSettingsFrom({
      grants: {
        saved: ['1'],
        states: ['fl', 'bad'],
        custom: [
          { id: 'c-a', title: 'A', funder: 'F', url: 'https://x', deadline: '2027-01-01', purposes: ['research', 'nope'], note: null, addedAt: '2026-11-17T00:00:00Z' },
          { id: 'c-b', title: 'B', funder: 'F', url: 'https://x', deadline: '2026-01-01', purposes: ['research'], note: null, addedAt: '2026-11-17T00:00:00Z' },
        ],
      },
    })
    expect(s.states).toEqual(['FL'])
    expect(s.custom[0].purposes).toEqual(['research'])
    expect(customGrants(s, '2026-11-17').map((g) => [g.id, g.source])).toEqual([['c-a', 'yours']])
  })
})

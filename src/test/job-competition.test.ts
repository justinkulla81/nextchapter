import { describe, expect, it } from 'vitest'
import { edgeTip, fewerApplicantsHint, fewerApplicantsText, isFresh, postedAgo, scoreCompetition } from '@/lib/jobs/competition'

const now = new Date('2026-10-09T12:00:00Z')
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000)
const job = (over: Partial<Parameters<typeof scoreCompetition>[0]> = {}) => ({
  sourceCategory: null,
  location: 'Chicago, IL',
  postedAt: daysAgo(2),
  createdAt: daysAgo(2),
  sourceCount: 1,
  ...over,
})

describe('job competition', () => {
  it('rates an on-site, fresh search-firm mandate as low competition', () => {
    const s = scoreCompetition(job({ sourceCategory: 'search_firm' }), 3, now)
    expect(s.level).toBe('low')
    expect(s.reasons[0]).toMatch(/search-firm/i)
  })

  it('rates an old remote aggregator job at a big brand as high competition', () => {
    const s = scoreCompetition(
      job({ sourceCategory: 'aggregator', location: 'Remote - US', postedAt: daysAgo(25), sourceCount: 3 }),
      400,
      now
    )
    expect(s.level).toBe('high')
  })

  it('knows a job posted 30 hours ago is in the first 72 hours', () => {
    const p = { postedAt: new Date(now.getTime() - 30 * 3_600_000), createdAt: daysAgo(0) }
    expect(isFresh(p, now)).toBe(true)
    expect(postedAgo(p, now)).toBe('Posted 30 hours ago')
  })

  it('falls back to the import date when the source gave no posting date', () => {
    expect(isFresh({ postedAt: null, createdAt: daysAgo(5) }, now)).toBe(false)
  })

  it('tells members to go to the consultant for search-firm jobs', () => {
    expect(edgeTip({ sourceCategory: 'search_firm', sourceName: 'Isaacson, Miller', postedAt: daysAgo(1), createdAt: daysAgo(1) }, now)).toMatch(
      /Isaacson, Miller/
    )
  })

  it('labels the estimate honestly, only when it is low, with its own reasons', () => {
    const s = scoreCompetition(job({ sourceCategory: 'search_firm', postedAt: new Date(now.getTime() - 34 * 3_600_000) }), 0, now)
    expect(s.level).toBe('low')
    expect(fewerApplicantsHint(s)).toEqual({
      label: 'Likely fewer applicants',
      because: 'Search-firm listing · on-site · posted 34h ago',
    })
    expect(fewerApplicantsHint({ level: 'medium', reasons: ['Posted in the last week'] })).toBeNull()
    expect(fewerApplicantsHint(undefined)).toBeNull()
    // A remote aggregator job never gets the hint.
    expect(fewerApplicantsHint(scoreCompetition(job({ sourceCategory: 'aggregator', location: 'Remote' }), 0, now))).toBeNull()
  })

  it('gives the channel tip as one short line', () => {
    const base = { sourceName: null, postedAt: daysAgo(10), createdAt: daysAgo(10) }
    expect(edgeTip({ ...base, sourceCategory: 'association' }, now)).toBe('Association board — mention your membership or ties.')
    expect(edgeTip({ ...base, sourceCategory: null, postedAt: new Date(now.getTime() - 5 * 3_600_000) }, now)).toMatch(/72 hours/)
    expect(edgeTip({ ...base, sourceCategory: null }, now)).toMatch(/referral/)
  })
})

import { namesNonUsPlace } from '@/lib/jobs/us-location'
import { NON_US } from '@/lib/jobs/job-seniority-rules.generated'

describe('non-US screen', () => {
  it.each([
    ['Head of Supply Chain (f/m/d) - Poznań', 'Poznań', true],
    ['Executive Director, Operations', 'NLD - North Brabant - Boxmeer', true],
    ['Senior Software Architect', 'Haifa, Haifa District, IL', true],
    ['Sales Manager - Upper Dublin', 'Dresher, PA, United States', false],
    ['Sr. Principal Engineer', 'Rome, NY, US; Wright-Patterson AFB, OH, US', false],
    ['VP Finance', 'Vienna, VA', false],
    ['VP Finance', 'Chicago, IL', false],
    ['Senior Engineer, Observability', 'Dublin', true],
  ])('%s | %s -> %s', (title, location, expected) => {
    expect(namesNonUsPlace(title, location, NON_US)).toBe(expected)
  })

  it('says the applicants estimate in plain text for emails, only when it is low', () => {
    const low = scoreCompetition(job({ sourceCategory: 'search_firm' }), 3, now)
    expect(fewerApplicantsText(low)).toBe('Likely fewer applicants (search-firm listing, on-site, listed in one place)')
    expect(fewerApplicantsText(low)).not.toMatch(/low competition/i)
    const high = scoreCompetition(job({ sourceCategory: 'aggregator', location: 'Remote - US', postedAt: daysAgo(25), sourceCount: 3 }), 400, now)
    expect(fewerApplicantsText(high)).toBeNull()
    expect(fewerApplicantsText(undefined)).toBeNull()
  })
})

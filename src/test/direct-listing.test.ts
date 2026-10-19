import { describe, expect, it } from 'vitest'
import { cardMetaParts, isStillListed } from '@/lib/jobs/job-card'
import { DIRECT_MAX_AGE_DAYS, finalizeCloseReason } from '@/lib/jobs/job-status'

// Direct employer listings (directListing, ncrawl config.is_direct) are exempt from the
// 30 / 60-day posted-date windows while the employer still lists them (2026-10-19).
const now = new Date('2026-10-19T12:00:00Z')
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000)

describe('direct employer listings', () => {
  it('a direct listing the crawl stops sending was removed, not aged out, until the backstop', () => {
    expect(finalizeCloseReason({ postedAt: daysAgo(45), createdAt: daysAgo(10), level: 'MANAGER', directListing: true }, now)).toBe('removed')
    expect(finalizeCloseReason({ postedAt: daysAgo(45), createdAt: daysAgo(10), level: 'MANAGER', directListing: false }, now)).toBe('aged_out')
    expect(finalizeCloseReason({ postedAt: daysAgo(DIRECT_MAX_AGE_DAYS + 3), createdAt: daysAgo(10), level: 'MANAGER', directListing: true }, now)).toBe('aged_out')
  })

  it('says "still listed by the employer" on an older direct listing confirmed up recently', () => {
    const p = { directListing: true, postedAt: daysAgo(45), createdAt: daysAgo(5), lastVerifiedAt: daysAgo(1) }
    expect(isStillListed(p, now)).toBe(true)
    expect(isStillListed({ ...p, postedAt: daysAgo(12) }, now)).toBe(false) // young: nothing to explain
    expect(isStillListed({ ...p, directListing: false }, now)).toBe(false) // aggregator copy
    expect(isStillListed({ ...p, lastVerifiedAt: daysAgo(6) }, now)).toBe(false) // not confirmed lately
    expect(isStillListed({ ...p, lastVerifiedAt: null }, now)).toBe(false)
    expect(isStillListed({ ...p, postedAt: null, createdAt: daysAgo(40) }, now)).toBe(true)
  })

  it('folds it into the posted phrase; a stale check still wins', () => {
    const base = { location: 'Seattle, WA', pay: null, workType: 'full_time' as const, title: 'Senior Manager', now }
    expect(cardMetaParts({ ...base, posted: 'Posted 45 days ago', verifiedAt: daysAgo(1), stillListed: true }))
      .toEqual(['Posted 45 days ago · still listed by the employer', 'Seattle, WA'])
    expect(cardMetaParts({ ...base, posted: 'Posted 45 days ago', verifiedAt: daysAgo(1) })).toEqual(['Posted 45 days ago', 'Seattle, WA'])
    expect(cardMetaParts({ ...base, posted: 'Posted 45 days ago', verifiedAt: daysAgo(6), stillListed: true }))
      .toEqual(['Posted 45 days ago, last checked 6 days ago', 'Seattle, WA'])
  })
})

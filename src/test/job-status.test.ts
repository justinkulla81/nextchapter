import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import {
  alternativesHrefs,
  duplicateLine,
  finalizeCloseReason,
  freshnessWindowDays,
  jobLifecycle,
  lifecycleBadge,
  lifecycleSentence,
  mapCrawlerCloseReason,
  postedLine,
  postingRepostLine,
  repostLine,
  seniorWindowLevels,
} from '@/lib/jobs/job-status'
import { liveBoardWhere } from '@/lib/jobs/board-shortlist'

const now = new Date('2026-10-15T12:00:00Z')
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000)

describe('freshness windows', () => {
  it('gives director and above 60 days, everyone else 30', () => {
    expect(freshnessWindowDays('DIRECTOR')).toBe(60)
    expect(freshnessWindowDays('VP')).toBe(60)
    expect(freshnessWindowDays('C_SUITE')).toBe(60)
    expect(freshnessWindowDays('EXECUTIVE')).toBe(60)
    expect(freshnessWindowDays('MANAGER')).toBe(30)
    expect(freshnessWindowDays('SENIOR_IC')).toBe(30)
    expect(freshnessWindowDays(null)).toBe(30)
    expect(seniorWindowLevels(['DIRECTOR', 'MANAGER', 'VP'])).toEqual(['DIRECTOR', 'VP'])
  })
})

describe('crawler close reasons', () => {
  it('maps onto ours', () => {
    expect(mapCrawlerCloseReason('removed')).toBe('removed')
    expect(mapCrawlerCloseReason('removed_inferred')).toBe('removed')
    expect(mapCrawlerCloseReason('aged_out_inferred')).toBe('aged_out')
    expect(mapCrawlerCloseReason('cleanup_dup_source')).toBe('filtered')
    expect(mapCrawlerCloseReason('reseller_filter')).toBe('filtered')
    expect(mapCrawlerCloseReason(null)).toBeNull()
  })
})

describe('finalize close reason', () => {
  it('is aged_out past the window, removed inside it', () => {
    expect(finalizeCloseReason({ postedAt: daysAgo(45), createdAt: daysAgo(10), level: 'MANAGER' }, now)).toBe('aged_out')
    expect(finalizeCloseReason({ postedAt: daysAgo(45), createdAt: daysAgo(10), level: 'DIRECTOR' }, now)).toBe('removed')
    expect(finalizeCloseReason({ postedAt: null, createdAt: daysAgo(70), level: 'VP' }, now)).toBe('aged_out')
    expect(finalizeCloseReason({ postedAt: null, createdAt: daysAgo(5), level: null }, now)).toBe('removed')
  })
})

describe('jobLifecycle', () => {
  const base = { archivedAt: null, postedAt: daysAgo(12), createdAt: daysAgo(10), level: 'DIRECTOR' }
  it('a live job seen once is new', () => {
    const l = jobLifecycle(base, now)
    expect(l.status).toBe('new')
    expect(l.isPast).toBe(false)
    expect(l.daysOpen).toBe(12)
    expect(lifecycleBadge(l)).toBe('Open')
    expect(postedLine(l)).toBe('Posted 12 days ago')
  })
  it('a live job that came back is reposted, with its original first-seen date', () => {
    const l = jobLifecycle({ ...base, repostCount: 3, repostFirstSeenAt: new Date('2026-08-02T00:00:00Z') }, now)
    expect(l.status).toBe('reposted')
    expect(l.repostCount).toBe(3)
    expect(lifecycleBadge(l)).toBe('Reposted')
    expect(postedLine(l)).toBe('Posted 12 days ago · Reposted · first seen Aug 2, 2026, 3 times')
  })
  it('reopen count or prior closures also make it reposted', () => {
    expect(jobLifecycle({ ...base, reopenCount: 1 }, now).status).toBe('reposted')
    expect(jobLifecycle({ ...base, priorClosedCount: 2 }, now).repostCount).toBe(2)
  })
  it('a collapsed second copy is a current duplicate, not a past job', () => {
    const l = jobLifecycle({ ...base, archivedAt: daysAgo(1), closeReason: 'duplicate' }, now)
    expect(l.status).toBe('duplicate')
    expect(l.isPast).toBe(false)
    expect(l.closedAt).toBeNull()
    expect(lifecycleSentence(l)).toBeNull()
  })
  it('a removed job is closed with its date, days open and a plain sentence', () => {
    const l = jobLifecycle({ ...base, archivedAt: new Date('2026-10-13T12:00:00Z'), closeReason: 'removed' }, now)
    expect(l.status).toBe('closed')
    expect(l.isPast).toBe(true)
    expect(l.daysOpen).toBe(10)
    expect(lifecycleBadge(l)).toBe('Closed')
    expect(lifecycleSentence(l)).toMatch(/^This job closed on Oct 13, 2026\. The employer took the listing down/)
  })
  it('an aged-out or expired job is "no longer listed"', () => {
    for (const closeReason of ['aged_out', 'expired']) {
      const l = jobLifecycle({ ...base, archivedAt: daysAgo(2), closeReason }, now)
      expect(l.status).toBe('expired')
      expect(lifecycleBadge(l)).toBe('No longer listed')
      expect(lifecycleSentence(l)).toMatch(/^No longer listed as of/)
    }
  })
  it('infers the reason for rows archived before reasons were kept', () => {
    expect(jobLifecycle({ archivedAt: daysAgo(1), postedAt: daysAgo(80), createdAt: daysAgo(80), level: 'MANAGER' }, now).status).toBe('expired')
    expect(jobLifecycle({ archivedAt: daysAgo(1), postedAt: daysAgo(10), createdAt: daysAgo(10), level: 'MANAGER' }, now).status).toBe('closed')
  })
  it('a live row past expiresAt is already expired', () => {
    const l = jobLifecycle({ ...base, expiresAt: daysAgo(1) }, now)
    expect(l.status).toBe('expired')
    expect(l.closeReason).toBe('expired')
  })
  it('a past job reads "Open N days"', () => {
    const l = jobLifecycle({ ...base, archivedAt: daysAgo(2), closeReason: 'removed' }, now)
    expect(postedLine(l)).toBe('Open 10 days')
  })
})

describe('repost and duplicate lines', () => {
  it('reads the stored fields', () => {
    expect(repostLine({ repostCount: 0, firstSeenAt: now })).toBeNull()
    expect(repostLine({ repostCount: 1, firstSeenAt: new Date('2026-09-05T00:00:00Z') })).toBe('Reposted · first seen Sep 5, 2026, 1 time')
    expect(postingRepostLine({ repostCount: null, reopenCount: 2, repostFirstSeenAt: null, postedAt: new Date('2026-09-01T00:00:00Z'), createdAt: now })).toBe(
      'Reposted · first seen Sep 1, 2026, 2 times'
    )
    expect(duplicateLine(0)).toBeNull()
    expect(duplicateLine(1)).toBe('Also listed in 1 other place')
    expect(duplicateLine(3)).toBe('Also listed in 3 other places')
  })
})

describe('closed-job next steps', () => {
  it('searches the live board by company and by title', () => {
    const h = alternativesHrefs('Acme "Corp"', 'VP Finance - Remote (US)')
    expect(h.company).toBe(`/dashboard/find-my-job?q=${encodeURIComponent('company:"Acme Corp"')}`)
    expect(h.titleLabel).toBe('VP Finance')
    expect(alternativesHrefs(null, 'Co-Founder').titleLabel).toBe('Co-Founder')
    expect(alternativesHrefs(null, 'x').company).toBeNull()
  })
})

// Emails stay current-jobs-only: they select through the live board (archived and
// expired rows out) and never read the past-jobs search.
describe('emails carry current jobs only', () => {
  it('the live board excludes archived and expired rows', () => {
    const w = liveBoardWhere()
    expect(w.archivedAt).toBeNull()
    expect(w.OR).toEqual([{ expiresAt: null }, { expiresAt: { gt: expect.any(Date) } }])
  })
  for (const f of ['src/lib/jobs/fresh-job-alerts.ts', 'src/lib/job-search-daily/build.ts']) {
    it(`${f} never reads past jobs`, () => {
      const src = readFileSync(path.resolve(__dirname, '../..', f), 'utf8')
      expect(src).toMatch(/loadBoardShortlist/)
      expect(src).not.toMatch(/past-jobs-data|searchPastJobs|companyJobOpening|includePast/)
    })
  }
})

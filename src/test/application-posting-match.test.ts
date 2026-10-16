import { describe, it, expect } from 'vitest'
import {
  atsJobIdFromUrl,
  matchApplicationToPosting,
  normalizeJobTitle,
  normalizeJobUrl,
  type MatchableApplication,
  type MatchablePosting,
} from '@/lib/jobs/application-posting-match'

const day = (iso: string) => new Date(`${iso}T12:00:00Z`)

const posting = (over: Partial<MatchablePosting> & { id: string }): MatchablePosting => ({
  url: `https://example.com/jobs/${over.id}`,
  title: 'Director of Corporate Development',
  companyId: 'acme',
  createdAt: day('2026-09-01'),
  ...over,
})

const app = (over: Partial<MatchableApplication> = {}): MatchableApplication => ({
  url: null,
  title: 'Director of Corporate Development',
  appliedAt: day('2026-09-20'),
  companyIds: ['acme'],
  ...over,
})

describe('normalizeJobUrl', () => {
  it('drops tracking params, www, scheme and trailing slash', () => {
    expect(normalizeJobUrl('https://www.acme.com/careers/123/?utm_source=x&ref=linkedin')).toBe(normalizeJobUrl('http://acme.com/careers/123'))
  })
  it('reduces Greenhouse board, embed and gh_jid variants to one key', () => {
    const keys = [
      'https://boards.greenhouse.io/acme/jobs/4567890?gh_src=abc',
      'https://job-boards.greenhouse.io/acme/jobs/4567890',
      'https://boards.greenhouse.io/embed/job_app?for=acme&token=4567890',
      'https://acme.com/careers/open-roles?gh_jid=4567890',
    ].map(normalizeJobUrl)
    expect(new Set(keys)).toEqual(new Set(['greenhouse:4567890']))
  })
  it('treats Lever and Ashby /apply pages as the posting', () => {
    const lever = 'https://jobs.lever.co/acme/0b8d7c1e-2f3a-4b5c-8d9e-0f1a2b3c4d5e'
    expect(normalizeJobUrl(`${lever}/apply?lever-source=LinkedIn`)).toBe(normalizeJobUrl(lever))
    const ashby = 'https://jobs.ashbyhq.com/acme/0B8D7C1E-2F3A-4B5C-8D9E-0F1A2B3C4D5E'
    expect(normalizeJobUrl(`${ashby}/application`)).toBe(normalizeJobUrl(ashby.toLowerCase()))
  })
  it('reads the Workday requisition id regardless of locale and apply suffix', () => {
    const a = 'https://acme.wd5.myworkdayjobs.com/en-US/External/job/New-York-NY/Director--Corp-Dev_R-12345'
    const b = 'https://acme.wd5.myworkdayjobs.com/External/job/New-York-NY/Director--Corp-Dev_R-12345/apply'
    expect(atsJobIdFromUrl(a)).toEqual({ ats: 'workday', id: 'R-12345', scoped: true })
    expect(normalizeJobUrl(a)).toBe(normalizeJobUrl(b))
  })
  it('reads LinkedIn and Indeed job ids', () => {
    expect(atsJobIdFromUrl('https://www.linkedin.com/jobs/view/4451880362/?trk=eml-email')?.id).toBe('4451880362')
    expect(atsJobIdFromUrl('https://www.linkedin.com/jobs/search/?currentJobId=4451880362')?.id).toBe('4451880362')
    expect(atsJobIdFromUrl('https://www.indeed.com/viewjob?jk=0554ae6877eab50a')?.id).toBe('0554ae6877eab50a')
  })
  it('returns null for garbage', () => {
    expect(normalizeJobUrl(null)).toBeNull()
    expect(normalizeJobUrl('   ')).toBeNull()
  })
})

describe('normalizeJobTitle', () => {
  it('matches the crawler: req ids, location tails and level numerals dropped', () => {
    expect(normalizeJobTitle('Sr. Director, FP&A II - Austin, TX (R-12345)')).toBe('sr director fp a')
    expect(normalizeJobTitle('Director, M&A and Strategy - NYC (Hybrid)')).toBe(normalizeJobTitle('Director, M&A and Strategy'))
    expect(normalizeJobTitle('Head of Corporate Development')).toBe('head of corporate development')
  })
})

describe('matchApplicationToPosting', () => {
  it('1. links on the same URL after normalization, even to a closed posting', () => {
    const p = posting({ id: 'p1', url: 'https://boards.greenhouse.io/acme/jobs/111', archivedAt: day('2026-09-25'), closeReason: 'removed' })
    const r = matchApplicationToPosting(app({ url: 'https://acme.com/careers?gh_jid=111&utm_medium=email', title: null, companyIds: [] }), [p])
    expect(r).toMatchObject({ outcome: 'url', postingId: 'p1' })
    expect(r.confidence).toBeGreaterThan(0.9)
  })

  it('2. links on an ATS id stored on the posting', () => {
    const p = posting({ id: 'p2', url: 'https://www.acme.com/jobs/director-corp-dev', externalJobId: '4451880362' })
    const r = matchApplicationToPosting(app({ url: 'https://www.linkedin.com/jobs/view/4451880362/', title: null, companyIds: [] }), [p])
    expect(r).toMatchObject({ outcome: 'ats_id', postingId: 'p2' })
  })

  it('2. a tenant-scoped requisition id needs the same employer', () => {
    const other = posting({ id: 'p3', companyId: 'other', url: 'https://other.com/x', requisitionId: 'R-12345' })
    const appUrl = 'https://acme.wd5.myworkdayjobs.com/External/job/NY/Director_R-12345'
    expect(matchApplicationToPosting(app({ url: appUrl, title: null }), [other]).outcome).toBe('none')
    const mine = posting({ id: 'p4', url: 'https://acme.com/y', requisitionId: 'R-12345' })
    expect(matchApplicationToPosting(app({ url: appUrl, title: null }), [other, mine])).toMatchObject({ outcome: 'ats_id', postingId: 'p4' })
  })

  it('3. same employer + title within 60 days before applying; closest posting date wins among copies of one role', () => {
    const older = posting({ id: 'old', postedAt: day('2026-08-01'), repostKey: 'k1' })
    const newer = posting({ id: 'new', postedAt: day('2026-09-10'), repostKey: 'k1' })
    const r = matchApplicationToPosting(app(), [older, newer])
    expect(r).toMatchObject({ outcome: 'company_title', postingId: 'new' })
  })

  it('3. ignores postings outside the window and at other employers', () => {
    const tooOld = posting({ id: 'a', postedAt: day('2026-07-01') })
    const after = posting({ id: 'b', postedAt: day('2026-10-01') })
    const elsewhere = posting({ id: 'c', companyId: 'globex', postedAt: day('2026-09-10') })
    expect(matchApplicationToPosting(app(), [tooOld, after, elsewhere]).outcome).toBe('none')
  })

  it('3. title normalization: location tail and req id do not block a match', () => {
    const p = posting({ id: 'p5', title: 'Director of Corporate Development - New York, NY (REQ-20431)', postedAt: day('2026-09-15') })
    expect(matchApplicationToPosting(app(), [p])).toMatchObject({ outcome: 'company_title', postingId: 'p5' })
  })

  it('ambiguous: two different roles with the same title are never guessed between', () => {
    const ny = posting({ id: 'ny', location: 'New York, NY', repostKey: 'ny', postedAt: day('2026-09-05') })
    const sf = posting({ id: 'sf', location: 'San Francisco, CA', repostKey: 'sf', postedAt: day('2026-09-15') })
    const r = matchApplicationToPosting(app(), [ny, sf])
    expect(r.outcome).toBe('ambiguous')
    expect(r.postingId).toBeNull()
    expect(r.candidateIds).toEqual(['ny', 'sf'])
  })

  it('ambiguous resolves when the application knows the location', () => {
    const ny = posting({ id: 'ny', location: 'New York, NY', repostKey: 'ny', postedAt: day('2026-09-05') })
    const sf = posting({ id: 'sf', location: 'San Francisco, CA', repostKey: 'sf', postedAt: day('2026-09-15') })
    expect(matchApplicationToPosting(app({ location: 'New York, NY' }), [ny, sf])).toMatchObject({ outcome: 'company_title', postingId: 'ny' })
  })

  it('ambiguous: one URL listed as two unrelated postings', () => {
    const a = posting({ id: 'a', url: 'https://acme.com/jobs/1?utm_source=x', repostKey: 'r1' })
    const b = posting({ id: 'b', url: 'https://www.acme.com/jobs/1/', repostKey: 'r2' })
    expect(matchApplicationToPosting(app({ url: 'https://acme.com/jobs/1' }), [a, b]).outcome).toBe('ambiguous')
  })

  it('copies sharing a descHash are one role; the non-duplicate copy is linked', () => {
    const dup = posting({ id: 'dup', descHash: 'h', closeReason: 'duplicate', postedAt: day('2026-09-19') })
    const main = posting({ id: 'main', descHash: 'h', postedAt: day('2026-09-01') })
    expect(matchApplicationToPosting(app(), [dup, main])).toMatchObject({ outcome: 'company_title', postingId: 'main' })
  })

  it('none without a title, an employer or any posting', () => {
    expect(matchApplicationToPosting(app({ title: null }), [posting({ id: 'x' })]).outcome).toBe('none')
    expect(matchApplicationToPosting(app({ companyIds: [] }), [posting({ id: 'x' })]).outcome).toBe('none')
    expect(matchApplicationToPosting(app(), []).outcome).toBe('none')
  })
})

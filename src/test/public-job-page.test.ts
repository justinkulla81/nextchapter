import { describe, expect, it } from 'vitest'
import { PUBLIC_JOB_MIN_INDEX_DESCRIPTION, isIndexableJob, isPublicJob, jobPostingJsonLd, payLabel, type PublicJobRow } from '@/lib/jobs/public-job-page'

const NOW = Date.parse('2026-10-22T12:00:00Z')
const DAY = 86_400_000

function job(over: Partial<PublicJobRow> = {}): PublicJobRow {
  return {
    id: 'cmvafjckb044kif06euqw4en5',
    title: 'Practice Manager',
    companyName: 'Luminis Health',
    location: 'Lanham, MD',
    description: 'x'.repeat(300),
    url: 'https://example.com/job/1',
    status: 'approved',
    archivedAt: null,
    closeReason: null,
    expiresAt: null,
    lastVerifiedAt: new Date(NOW - DAY),
    createdAt: new Date(NOW - 10 * DAY),
    postedAt: new Date(NOW - 12 * DAY),
    disclosure: 'OPEN',
    distribution: 'OPEN',
    institutionScopeId: null,
    orgScopeId: null,
    source: 'ats_feed',
    employmentType: 'full_time',
    locationCountry: 'US',
    locationState: 'MD',
    locationCity: 'Lanham',
    workArrangement: 'onsite',
    reopenCount: null,
    repostCount: null,
    directListing: false,
    salaryMin: 80000,
    salaryMax: 110000,
    salaryCurrency: 'USD',
    payPeriod: 'year',
    externalJobId: null,
    requisitionId: 'R123',
    company: { website: 'https://www.luminishealth.org' },
    ...over,
  }
}

describe('isPublicJob', () => {
  it('passes a live, verified, open US job', () => expect(isPublicJob(job(), NOW)).toBe(true))
  it.each<[string, Partial<PublicJobRow>]>([
    ['closed', { closeReason: 'removed' }],
    ['archived', { archivedAt: new Date(NOW) }],
    ['expired', { expiresAt: new Date(NOW - 1) }],
    ['not verified in 7 days', { lastVerifiedAt: new Date(NOW - 8 * DAY) }],
    ['never verified', { lastVerifiedAt: null }],
    ['short description', { description: 'too short' }],
    ['confidential', { disclosure: 'CONFIDENTIAL' }],
    ['targeted', { distribution: 'TARGETED' }],
    ['a candidate check', { source: 'candidate_check', distribution: 'EXCLUDED' }],
    ['a candidate referral', { source: 'candidate_referral' }],
    ['institution scoped', { institutionScopeId: 'i1' }],
    ['org internal', { orgScopeId: 'o1' }],
    ['an internship', { employmentType: 'internship' }],
    ['an intern title', { title: 'Summer Finance Intern' }],
    ['outside the US', { locationCountry: 'CA', locationState: null }],
    ['reposted twice', { repostCount: 2 }],
    ['old and not direct', { createdAt: new Date(NOW - 100 * DAY) }],
    ['pending', { status: 'pending' }],
  ])('rejects %s', (_, over) => expect(isPublicJob(job(over), NOW)).toBe(false))
  it('keeps an old direct listing the employer still lists', () =>
    expect(isPublicJob(job({ createdAt: new Date(NOW - 100 * DAY), directListing: true }), NOW)).toBe(true))
  it('rejects an admin-confirmed ghost job', () => expect(isPublicJob(job(), NOW, true)).toBe(false))
  it('does not reject "International" or "Internal"', () =>
    expect(isPublicJob(job({ title: 'Internal Audit Director, International' }), NOW)).toBe(true))
})

describe('jobPostingJsonLd', () => {
  it('has Google’s required fields and maps pay and type', () => {
    const ld = jobPostingJsonLd(job())
    expect(ld).toMatchObject({
      '@type': 'JobPosting',
      title: 'Practice Manager',
      datePosted: new Date(NOW - 12 * DAY).toISOString(),
      validThrough: new Date(NOW - DAY + 30 * DAY).toISOString(),
      hiringOrganization: { name: 'Luminis Health', sameAs: 'https://www.luminishealth.org' },
      jobLocation: { address: { addressLocality: 'Lanham', addressRegion: 'MD', addressCountry: 'US' } },
      baseSalary: { currency: 'USD', value: { minValue: 80000, maxValue: 110000, unitText: 'YEAR' } },
      employmentType: 'FULL_TIME',
      identifier: { value: 'R123' },
      directApply: false,
    })
  })
  it('marks remote jobs TELECOMMUTE with a US requirement and no address', () => {
    const ld = jobPostingJsonLd(job({ workArrangement: 'remote', locationCity: null, locationState: null, location: 'United States' }))
    expect(ld.jobLocationType).toBe('TELECOMMUTE')
    expect(ld.applicantLocationRequirements).toEqual({ '@type': 'Country', name: 'USA' })
    expect(ld.jobLocation).toBeUndefined()
  })
  it('leaves out what it does not know', () => {
    const ld = jobPostingJsonLd(job({ payPeriod: null, employmentType: 'interim', company: null, expiresAt: null }))
    expect(ld.baseSalary).toBeUndefined()
    expect(ld.employmentType).toBeUndefined()
    expect((ld.hiringOrganization as Record<string, unknown>).sameAs).toBeUndefined()
  })
  it('uses the real expiry when there is one, and escapes HTML in the description', () => {
    const exp = new Date(NOW + 5 * DAY)
    const ld = jobPostingJsonLd(job({ expiresAt: exp, description: `<script>x</script>\n\n${'y'.repeat(250)}` }))
    expect(ld.validThrough).toBe(exp.toISOString())
    expect(ld.description).toMatch(/^<p>&lt;script&gt;x&lt;\/script&gt;<\/p><p>y+<\/p>$/)
  })
})

describe('payLabel', () => {
  it('formats yearly and hourly pay', () => {
    expect(payLabel(180000, 220000, 'year')).toBe('$180k–$220k a year')
    expect(payLabel(45, 60, 'hour')).toBe('$45–$60 an hour')
    expect(payLabel(null, null, 'year')).toBeNull()
  })
})

describe('isIndexableJob', () => {
  it('keeps a snippet-only job out of search and a full posting in', () => {
    expect(isIndexableJob(job({ description: 'x'.repeat(280) }))).toBe(false)
    expect(isIndexableJob(job({ description: 'x'.repeat(PUBLIC_JOB_MIN_INDEX_DESCRIPTION - 1) }))).toBe(false)
    expect(isIndexableJob(job({ description: 'x'.repeat(PUBLIC_JOB_MIN_INDEX_DESCRIPTION) }))).toBe(true)
    expect(isIndexableJob(job({ description: 'x'.repeat(4000) }))).toBe(true)
  })
  it('counts bytes, as the sitemap SQL does', () => {
    // 1,000 curly quotes are 3 bytes each: 3,000 bytes, over the bar, though only 1,000 characters
    expect(isIndexableJob(job({ description: '’'.repeat(1000) }))).toBe(true)
    expect(isIndexableJob(job({ description: null as unknown as string }))).toBe(false)
  })
  it('does not change who gets a page at all', () => {
    expect(isPublicJob(job({ description: 'x'.repeat(280) }), NOW)).toBe(true)
  })
})

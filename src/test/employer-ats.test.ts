import { describe, it, expect } from 'vitest'
import { EMPLOYER_ATS_HOSTS, EMPLOYER_ATS_SQL_PATTERN, isEmployerAtsUrl } from '@/lib/jobs/employer-ats'
import { isDirectJob, isIndexableJob, PUBLIC_JOB_MIN_INDEX_DESCRIPTION } from '@/lib/jobs/public-job-page'

const full = 'x'.repeat(PUBLIC_JOB_MIN_INDEX_DESCRIPTION)

describe('isEmployerAtsUrl', () => {
  it('accepts an employer board on a known applicant tracking system, with any subdomain, port or path', () => {
    for (const u of [
      'https://job-boards.greenhouse.io/altanaai/jobs/8042979003', 'https://boards.greenhouse.io/acme', 'https://jobs.lever.co/acme/123',
      'https://jobs.ashbyhq.com/acme/abc', 'https://acme.wd5.myworkdayjobs.com/en-US/External/job/x', 'https://jobs.smartrecruiters.com/Acme/1',
      'https://careers-acme.icims.com/jobs/12/job', 'http://apply.workable.com/acme/j/1', 'https://acme.bamboohr.com/careers/4', 'https://ats.rippling.com/acme/jobs/1',
      'https://jobs.lever.co:443/acme', 'https://jobs.lever.co?x=1', 'HTTPS://JOBS.LEVER.CO/ACME',
    ]) expect(isEmployerAtsUrl(u), u).toBe(true)
  })
  it('rejects aggregators, venture and accelerator boards, look-alike hosts and non-links', () => {
    for (const u of [
      'https://jooble.org/desc/123', 'https://jobviewtrack.com/x', 'https://indexventures.getro.com/companies/acme/jobs/1', 'https://jobs.accel.com/jobs/1',
      'https://greenhouse.io.evil.com/x', 'https://notgreenhouse.io/x', 'https://evil.com/?u=https://jobs.lever.co/x', 'https://www.rippling.com/careers',
      'ftp://jobs.lever.co/x', '', null, undefined,
    ]) expect(isEmployerAtsUrl(u as string | null | undefined), String(u)).toBe(false)
  })
  it('gives Postgres a pattern built from the same hosts', () => {
    for (const h of EMPLOYER_ATS_HOSTS) expect(EMPLOYER_ATS_SQL_PATTERN).toContain(h.replace(/\./g, '\\.'))
    expect(EMPLOYER_ATS_SQL_PATTERN.startsWith('^https?://')).toBe(true)
  })
})

describe('direct means the employer\'s own system, whichever feed it came through', () => {
  const row = (o: Record<string, unknown>) => ({ directListing: false, sourceCategory: 'venture', url: 'https://example.com/j', description: full, ...o }) as Parameters<typeof isDirectJob>[0] & { description: string }
  it('counts a venture-board row that links to the employer\'s own Greenhouse board', () => {
    expect(isDirectJob(row({ url: 'https://job-boards.greenhouse.io/altanaai/jobs/1' }))).toBe(true)
    expect(isIndexableJob(row({ url: 'https://job-boards.greenhouse.io/altanaai/jobs/1' }))).toBe(true)
  })
  it('still needs the posting\'s own text', () => {
    expect(isIndexableJob(row({ url: 'https://jobs.lever.co/acme/1', description: 'x'.repeat(280) }))).toBe(false)
  })
  it('keeps a venture board\'s own page, and any aggregator row, out', () => {
    expect(isDirectJob(row({ url: 'https://jobs.accel.com/jobs/1' }))).toBe(false)
    expect(isDirectJob(row({ sourceCategory: 'aggregator', url: 'https://jobs.lever.co/acme/1' }))).toBe(false)
    expect(isIndexableJob(row({ sourceCategory: 'aggregator', url: 'https://jobs.lever.co/acme/1' }))).toBe(false)
  })
  it('leaves the crawler\'s own direct flag and the employer category as they were', () => {
    expect(isDirectJob(row({ directListing: true }))).toBe(true)
    expect(isDirectJob(row({ sourceCategory: 'employer' }))).toBe(true)
    expect(isDirectJob({ directListing: false, sourceCategory: null })).toBe(false)
  })
})

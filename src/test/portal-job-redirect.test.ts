import { describe, expect, it } from 'vitest'
import { portalJobPath } from '@/lib/jobs/portal-job-redirect'

const ID = 'cm0abcdefghijklmnopqrstuv'

describe('portalJobPath', () => {
  it('sends a signed-in member from the public job page to the portal job page', () => {
    expect(portalJobPath(`/jobs/${ID}`, true)).toBe(`/dashboard/jobs/${ID}?src=public_page`)
    expect(portalJobPath(`/jobs/${ID}/`, true)).toBe(`/dashboard/jobs/${ID}?src=public_page`)
  })
  it('leaves signed-out visitors and crawlers on the public page', () => {
    expect(portalJobPath(`/jobs/${ID}`, false)).toBeNull()
  })
  it('sends a member from the public job search to the portal search, keeping the search', () => {
    expect(portalJobPath('/jobs', true, '?q=controller&loc=Austin%2C+TX&remote=1&utm=x')).toBe('/dashboard/find-my-job?from=public&q=controller&loc=Austin%2C+TX&remote=1')
    expect(portalJobPath('/jobs', true)).toBe('/dashboard/find-my-job?from=public')
    expect(portalJobPath('/jobs', false, '?q=controller')).toBeNull()
  })
  it('sends a member from a job-title page to the portal search for that title and place', () => {
    expect(portalJobPath('/jobs/title/financial-analyst', true)).toBe('/dashboard/find-my-job?from=public&q=financial+analyst')
    expect(portalJobPath('/jobs/title/financial-analyst/chicago-il', true)).toBe('/dashboard/find-my-job?from=public&q=financial+analyst&loc=Chicago%2C+IL')
    expect(portalJobPath('/jobs/title/financial-analyst/texas', true)).toBe('/dashboard/find-my-job?from=public&q=financial+analyst&loc=Texas')
    expect(portalJobPath('/jobs/title/financial-analyst/new-york', true)).toBe('/dashboard/find-my-job?from=public&q=financial+analyst&loc=New+York')
    expect(portalJobPath('/jobs/title/financial-analyst', false)).toBeNull()
  })
  it('sends a member from an entry-level page to the portal search for entry-level jobs', () => {
    expect(portalJobPath('/jobs/entry-level', true)).toBe('/dashboard/find-my-job?from=public&seniority=ENTRY_LEVEL')
    expect(portalJobPath('/jobs/entry-level/category/finance', true)).toBe('/dashboard/find-my-job?from=public&seniority=ENTRY_LEVEL')
    expect(portalJobPath('/jobs/entry-level/accounts-payable-clerk', true)).toBe('/dashboard/find-my-job?from=public&seniority=ENTRY_LEVEL&q=accounts+payable+clerk')
    expect(portalJobPath('/jobs/entry-level/accounts-payable-clerk/denver-co', true)).toBe('/dashboard/find-my-job?from=public&seniority=ENTRY_LEVEL&q=accounts+payable+clerk&loc=Denver%2C+CO')
    expect(portalJobPath('/jobs/entry-level', false)).toBeNull()
  })
  it('sends a member from an industry page to the portal search for that industry', () => {
    expect(portalJobPath('/jobs/industry/healthcare', true)).toBe('/dashboard/find-my-job?from=public&q=healthcare')
    expect(portalJobPath('/jobs/industry/financial-services/2026-10', true)).toBe('/dashboard/find-my-job?from=public&q=financial+services')
  })
  it('sends a member from a job-type page to the matching portal filter', () => {
    expect(portalJobPath('/jobs/type/remote', true)).toBe('/dashboard/find-my-job?from=public&remote=remote')
    expect(portalJobPath('/jobs/type/hybrid', true)).toBe('/dashboard/find-my-job?from=public&remote=hybrid')
    expect(portalJobPath('/jobs/type/contract', true)).toBe('/dashboard/find-my-job?from=public&types=contract')
    expect(portalJobPath('/jobs/type/part-time', true)).toBe('/dashboard/find-my-job?from=public&types=part_time')
    expect(portalJobPath('/jobs/type/interim', true)).toBe('/dashboard/find-my-job?from=public&types=contract')
  })
  it('leaves the other /jobs pages alone', () => {
    for (const p of ['/jobs/alerts', '/jobs/title', '/jobs/industry', '/jobs/type', '/jobs/type/unknown', '/jobs/entry-level/llms.txt', `/jobs/${ID}/apply`]) {
      expect(portalJobPath(p, true)).toBeNull()
    }
  })
})

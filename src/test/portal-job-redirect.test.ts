import { describe, expect, it } from 'vitest'
import { CODE_DEFINED_INDUSTRIES, portalJobPath } from '@/lib/jobs/portal-job-redirect'
import { SEGMENTS } from '@/lib/segments/defs'
import { ENTRY_AND_EARLY_PARAM } from '@/lib/jobs/job-seniority'

const ID = 'cm0abcdefghijklmnopqrstuv'

describe('portalJobPath', () => {
  it('sends a member who clicks "Check my fit" on a job page to that job in the portal, not into onboarding', () => {
    const search = `?from=jobs_page&job=${ID}`
    expect(portalJobPath('/onboarding/desire', true, search)).toBe(`/dashboard/jobs/${ID}?src=check_fit`)
    expect(portalJobPath('/onboarding/desire', false, search)).toBeNull()
    expect(portalJobPath('/onboarding/desire', true, '?from=jobs_page')).toBeNull()
    expect(portalJobPath('/onboarding/desire', true, '?from=jobs_page&job=../x')).toBeNull()
  })
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
    expect(portalJobPath('/jobs/entry-level', true)).toBe('/dashboard/find-my-job?from=public&seniority=EARLY_CAREER%2CENTRY_LEVEL')
    expect(portalJobPath('/jobs/entry-level/category/finance', true)).toBe('/dashboard/find-my-job?from=public&seniority=EARLY_CAREER%2CENTRY_LEVEL')
    expect(portalJobPath('/jobs/entry-level/accounts-payable-clerk', true)).toBe('/dashboard/find-my-job?from=public&seniority=EARLY_CAREER%2CENTRY_LEVEL&q=accounts+payable+clerk')
    expect(portalJobPath('/jobs/entry-level/accounts-payable-clerk/denver-co', true)).toBe('/dashboard/find-my-job?from=public&seniority=EARLY_CAREER%2CENTRY_LEVEL&q=accounts+payable+clerk&loc=Denver%2C+CO')
    expect(portalJobPath('/jobs/entry-level', false)).toBeNull()
  })
  it('sends a member from an industry page to the portal search for that industry', () => {
    expect(portalJobPath('/jobs/industry/healthcare', true)).toBe('/dashboard/find-my-job?from=public&q=healthcare')
    expect(portalJobPath('/jobs/industry/financial-services/2026-10', true)).toBe('/dashboard/find-my-job?from=public&q=financial+services')
  })
  it('keeps a member on the public page for industries the portal search cannot reproduce', () => {
    for (const p of ['/jobs/industry/retail', '/jobs/industry/construction', '/jobs/industry/restaurants', '/jobs/industry/retail/2026-10']) {
      expect(portalJobPath(p, true)).toBeNull()
    }
  })
  it('lists exactly the industries defined by their industry label alone', () => {
    const codeOnly = SEGMENTS.filter((s) => !s.exclude && s.rules.every((r) => r.codes && !r.employers && !r.company && !r.title && !r.tags && !r.sectors)).map((s) => s.slug)
    expect([...CODE_DEFINED_INDUSTRIES].sort()).toEqual(codeOnly.sort())
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
  it('asks for the same groups the board filter calls entry level plus early career', () => {
    expect(decodeURIComponent(portalJobPath('/jobs/entry-level', true)!)).toContain(`seniority=${ENTRY_AND_EARLY_PARAM}`)
  })
})

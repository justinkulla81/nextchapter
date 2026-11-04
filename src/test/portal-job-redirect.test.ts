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
  it('leaves the other /jobs pages alone', () => {
    for (const p of ['/jobs/alerts', '/jobs/title', '/jobs/entry-level', '/jobs/type/remote', '/jobs/industry/finance', `/jobs/${ID}/apply`]) {
      expect(portalJobPath(p, true)).toBeNull()
    }
  })
})

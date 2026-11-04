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
    expect(portalJobPath('/jobs', true, '?q=controller&loc=Austin%2C+TX&remote=1&utm=x')).toBe('/dashboard/find-my-job?q=controller&loc=Austin%2C+TX&remote=1')
    expect(portalJobPath('/jobs', true)).toBe('/dashboard/find-my-job')
    expect(portalJobPath('/jobs', false, '?q=controller')).toBeNull()
  })
  it('leaves the other /jobs pages alone', () => {
    for (const p of ['/jobs/alerts', '/jobs/title/accountant', '/jobs/entry-level', '/jobs/industry/finance', `/jobs/${ID}/apply`]) {
      expect(portalJobPath(p, true)).toBeNull()
    }
  })
})

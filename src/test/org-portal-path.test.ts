import { describe, expect, it } from 'vitest'
import { orgPortalPathOnMainSite } from '@/lib/http/org-portal-path'

describe('orgPortalPathOnMainSite', () => {
  it('sends a portal address typed on the main site to /i/', () => {
    expect(orgPortalPathOnMainSite('/demo-one-louisville-87f7f/hub')).toBe('/i/demo-one-louisville-87f7f/hub')
    expect(orgPortalPathOnMainSite('/demo-one-louisville-87f7f/hub/regionjobs')).toBe('/i/demo-one-louisville-87f7f/hub/regionjobs')
  })
  it('leaves real site routes and other paths alone', () => {
    expect(orgPortalPathOnMainSite('/jobs/hub')).toBeNull()
    expect(orgPortalPathOnMainSite('/i/demo-one-louisville-87f7f/hub')).toBeNull()
    expect(orgPortalPathOnMainSite('/demo-one-louisville-87f7f')).toBeNull()
    expect(orgPortalPathOnMainSite('/demo-one-louisville-87f7f/whatever')).toBeNull()
    expect(orgPortalPathOnMainSite('/Some_Thing/hub')).toBeNull()
  })
})

import { beforeAll, describe, expect, it, vi } from 'vitest'

let m: typeof import('@/lib/portal-hosts')
beforeAll(async () => {
  vi.stubEnv('NEXT_PUBLIC_PORTAL_SUBDOMAINS', 'recruiter,coach,employer,candidate')
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://launchyournextchapter.com')
  vi.resetModules()
  m = await import('@/lib/portal-hosts')
})

describe('portal hosts', () => {
  it('knows each host', () => {
    expect(m.portalHostFor('recruiter.launchyournextchapter.com')).toBe('recruiter')
    expect(m.portalHostFor('launchyournextchapter.com')).toBeNull()
  })
  it('moves app paths off the main site, keeps marketing there', () => {
    expect(m.hostForAppPath('/recruiters/search')).toBe('recruiter')
    expect(m.hostForAppPath('/recruiters')).toBeNull()
    expect(m.hostForAppPath('/talent')).toBeNull()
    expect(m.hostForAppPath('/talent/roles')).toBe('employer')
    expect(m.hostForAppPath('/employer/roster')).toBe('employer')
    expect(m.hostForAppPath('/support/coach/clients')).toBe('coach')
    expect(m.hostForAppPath('/dashboard/find-my-job')).toBe('candidate')
    expect(m.hostForAppPath('/i/washjeff/welcome')).toBe('candidate')
    expect(m.hostForAppPath('/pricing')).toBeNull()
    expect(m.hostForAppPath('/support/admin')).toBeNull()
  })
  it('maps app paths to public ones and back', () => {
    expect(m.publicPathFor('employer', '/talent/roles')).toBe('/hiring/roles')
    expect(m.publicPathFor('employer', '/employer')).toBe('/outplacement')
    expect(m.publicPathFor('employer', '/employer/growth')).toBe('/growth')
    expect(m.publicPathFor('employer', '/employer/growth/roles/abc')).toBe('/growth/roles/abc')
    expect(m.publicPathFor('employer', '/employer/learning')).toBe('/learning')
    expect(m.publicPathFor('recruiter', '/recruiters/search')).toBe('/search')
    expect(m.publicPathFor('recruiter', '/recruiters')).toBe('/')
    expect(m.appPathFor('employer', '/hiring')).toEqual({ path: '/talent/dashboard', cookie: 'talent' })
    expect(m.appPathFor('employer', '/hiring/roles')).toEqual({ path: '/talent/roles', cookie: 'talent' })
    expect(m.appPathFor('employer', '/outplacement/roster')).toEqual({ path: '/employer/roster', cookie: 'employer' })
    expect(m.appPathFor('employer', '/growth')).toEqual({ path: '/employer/growth', cookie: 'employer' })
    expect(m.appPathFor('employer', '/learning')).toEqual({ path: '/employer/learning', cookie: 'employer' })
    expect(m.appPathFor('coach', '/clients')).toEqual({ path: '/support/coach/clients', cookie: 'coach' })
    expect(m.appPathFor('candidate', '/dashboard')).toEqual({ path: '/dashboard', cookie: undefined })
  })
  it('sends sign-in links back to the right host', () => {
    expect(m.callbackOriginForAppPath('/dashboard')).toBe('https://candidate.launchyournextchapter.com')
    expect(m.callbackOriginForAppPath('/employer')).toBe('https://employer.launchyournextchapter.com')
    expect(m.urlForAppPath('/talent/login')).toBe('https://employer.launchyournextchapter.com/hiring/login')
  })
})

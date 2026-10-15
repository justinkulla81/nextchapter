import { describe, expect, it } from 'vitest'
import { PLACES, PREMIUM_HREF, activeTab, placeForPath, resolveTabHref, visibleTabs } from './places'

describe('placeForPath', () => {
  it('puts the dashboard root in Home', () => {
    expect(placeForPath('/dashboard')?.key).toBe('home')
  })
  it('prefers the longest match', () => {
    expect(placeForPath('/dashboard/network/contacts')?.key).toBe('network')
    expect(activeTab(placeForPath('/dashboard/network/contacts')!, '/dashboard/network/contacts')?.label).toBe('Contacts')
  })
  it('places every old menu route', () => {
    const routes: Record<string, string> = {
      '/dashboard/find-my-job': 'jobs',
      '/dashboard/pivot-paths': 'jobs',
      '/dashboard/references': 'network',
      '/dashboard/messages': 'network',
      '/dashboard/universities': 'network',
      '/dashboard/groups': 'network',
      '/dashboard/learning': 'learn',
      '/dashboard/webinars': 'learn',
      '/dashboard/profile': 'personalize',
      '/dashboard/skills-assessments': 'personalize',
      '/dashboard/marketing-plan': 'personalize',
      '/dashboard/portfolio': 'personalize',
      '/dashboard/stats': 'home',
      '/dashboard/support': 'help',
      '/dashboard/benefits-network': 'help',
      '/dashboard/help': 'help',
      '/dashboard/scam-watch': 'help',
      '/dashboard/documents': 'personalize',
      '/dashboard/book-session': 'network',
      '/dashboard/my-coaching': 'network',
      '/dashboard/pivot': 'jobs',
      '/dashboard/recruiter-requests': 'network',
    }
    for (const [path, key] of Object.entries(routes)) expect(placeForPath(path)?.key, path).toBe(key)
  })
  it('returns null outside the six places', () => {
    expect(placeForPath('/faq')).toBeNull()
  })
})

describe('visibleTabs', () => {
  it('hides employed-only tabs for everyone else', () => {
    const jobs = PLACES.find((p) => p.key === 'jobs')!
    expect(visibleTabs(jobs, { employed: false }).some((t) => t.label === 'Reviews and raises')).toBe(false)
    expect(visibleTabs(jobs, { employed: true }).some((t) => t.label === 'Reviews and raises')).toBe(true)
  })
})

describe('resolveTabHref', () => {
  const coaching = PLACES.find((p) => p.key === 'network')!.tabs.find((t) => t.label === 'Coaching')!
  it('sends members without access to Premium', () => {
    expect(resolveTabHref(coaching, { coaching: false, recruiters: false })).toBe(PREMIUM_HREF)
  })
  it('sends members with access to the real page', () => {
    expect(resolveTabHref(coaching, { coaching: true, recruiters: false })).toBe('/dashboard/my-coaching')
  })
})

import { describe, expect, it } from 'vitest'
import { PREMIUM_HREF, activeTab, resolveTabHref, visibleTabs } from './places'
import { REDESIGN_PLACES, redesignPlaceForPath } from './redesign-places'

const place = (key: string) => REDESIGN_PLACES.find((p) => p.key === key)!

describe('redesignPlaceForPath', () => {
  it('puts the dashboard root in Home', () => {
    expect(redesignPlaceForPath('/dashboard')?.key).toBe('home')
  })
  it('prefers the longest match', () => {
    expect(redesignPlaceForPath('/dashboard/network/contacts')?.key).toBe('network')
    expect(activeTab(redesignPlaceForPath('/dashboard/network/contacts')!, '/dashboard/network/contacts')?.label).toBe('Contacts')
  })
  it('places every candidate menu route', () => {
    const routes: Record<string, string> = {
      '/dashboard/find-my-job': 'jobs',
      '/dashboard/pivot-paths': 'learn',
      '/dashboard/references': 'network',
      '/dashboard/messages': 'network',
      '/dashboard/universities': 'network',
      '/dashboard/groups': 'network',
      '/dashboard/past-jobs': 'network',
      '/dashboard/learning': 'learn',
      '/dashboard/webinars': 'learn',
      '/dashboard/profile': 'account',
      '/dashboard/skills-assessments': 'learn',
      '/dashboard/marketing-plan': 'home',
      '/dashboard/portfolio': 'jobs',
      '/dashboard/stats': 'home',
      '/dashboard/support': 'help',
      '/dashboard/benefits-network': 'money',
      '/dashboard/help': 'help',
      '/dashboard/scam-watch': 'help',
      '/dashboard/documents': 'account',
      '/dashboard/book-session': 'network',
      '/dashboard/my-coaching': 'network',
      '/dashboard/pivot': 'learn',
      '/dashboard/recruiter-requests': 'network',
    }
    for (const [path, key] of Object.entries(routes)) expect(redesignPlaceForPath(path)?.key, path).toBe(key)
  })
  it('returns null outside the places', () => {
    expect(redesignPlaceForPath('/faq')).toBeNull()
  })
})

describe('visibleTabs', () => {
  it('hides employed-only tabs for everyone else', () => {
    const jobs = place('jobs')
    expect(visibleTabs(jobs, { employed: false }).some((t) => t.label === 'Reviews and raises')).toBe(false)
    expect(visibleTabs(jobs, { employed: true }).some((t) => t.label === 'Reviews and raises')).toBe(true)
  })
})

describe('resolveTabHref', () => {
  const coaching = place('network').tabs.find((t) => t.label === 'Coaching')!
  it('sends members without access to Premium', () => {
    expect(resolveTabHref(coaching, { coaching: false, recruiters: false })).toBe(PREMIUM_HREF)
  })
  it('sends members with access to the real page', () => {
    expect(resolveTabHref(coaching, { coaching: true, recruiters: false })).toBe('/dashboard/my-coaching')
  })
})

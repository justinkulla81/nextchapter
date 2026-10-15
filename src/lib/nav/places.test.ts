import { describe, expect, it } from 'vitest'
import { PLACES, activeTab, placeForPath, visibleTabs } from './places'

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

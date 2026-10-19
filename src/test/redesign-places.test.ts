import { describe, it, expect } from 'vitest'
import { PLACES, groupsOf } from '@/lib/nav/places'
import { REDESIGN_PLACES, redesignPlaceForPath, redesignPlacesFor } from '@/lib/nav/redesign-places'

const all = REDESIGN_PLACES.flatMap((p) => p.tabs)

describe('redesigned menu', () => {
  it('keeps every page the six-place menu reaches', () => {
    const redesign = new Set(all.flatMap((t) => [t.href, ...(t.alsoMatches ?? [])]))
    // Folded into other pages in the redesign: the personalization tabs are replaced by Improve your search and the question flows.
    const REPLACED = new Set(['/dashboard/strengths', '/dashboard/profile', '/dashboard/skills-assessments', '/dashboard/search-strategy', '/dashboard/recruiter-report', '/dashboard/documents', '/dashboard/membership'])
    for (const tab of PLACES.flatMap((p) => p.tabs)) {
      if (REPLACED.has(tab.href)) continue
      expect(redesign.has(tab.href), tab.href).toBe(true)
    }
  })

  it('moves the personalization pages to a new home, none dropped', () => {
    const redesign = new Set(all.map((t) => t.href))
    for (const href of ['/dashboard/strengths', '/dashboard/profile', '/dashboard/skills-assessments', '/dashboard/search-strategy', '/dashboard/recruiter-report', '/dashboard/documents', '/dashboard/membership', '/dashboard/my-career']) {
      expect(redesign.has(href), href).toBe(true)
    }
  })

  it('gives each page one tab and each tab one menu entry', () => {
    const hrefs = all.map((t) => t.href)
    expect(new Set(hrefs).size).toBe(hrefs.length)
    for (const place of REDESIGN_PLACES) {
      const grouped = groupsOf(place).flatMap((g) => g.hrefs)
      expect([...grouped].sort()).toEqual(place.tabs.map((t) => t.href).sort())
    }
  })

  it('has at most six entries a place', () => {
    for (const place of REDESIGN_PLACES) expect(groupsOf(place).length, place.key).toBeLessThanOrEqual(7)
  })

  it('finds the place for a page, and sub-pages stay with their parent', () => {
    expect(redesignPlaceForPath('/dashboard')?.key).toBe('home')
    expect(redesignPlaceForPath('/dashboard/improve')?.key).toBe('home')
    expect(redesignPlaceForPath('/dashboard/resume/studio')?.key).toBe('jobs')
    expect(redesignPlaceForPath('/dashboard/network/contacts')?.key).toBe('network')
    expect(redesignPlaceForPath('/dashboard/my-career')?.key).toBe('learn')
    expect(redesignPlaceForPath('/dashboard/pivot-paths')?.key).toBe('learn')
    expect(redesignPlaceForPath('/dashboard/benefits-network')?.key).toBe('money')
    expect(redesignPlaceForPath('/dashboard/privacy')?.key).toBe('account')
    expect(redesignPlaceForPath('/dashboard/profile/personal')?.key).toBe('account')
  })

  it('has one market report: the Market tab opens it, and the market pages stay under it', () => {
    const jobs = REDESIGN_PLACES.find((p) => p.key === 'jobs')!
    const tab = jobs.tabs.find((t) => t.href === '/dashboard/market-reality')!
    expect(tab.label).toBe('Your market report')
    expect(tab.alsoMatches).toEqual(expect.arrayContaining(['/dashboard/market', '/dashboard/market-intelligence']))
    expect(jobs.tabs.filter((t) => /market/.test(t.href) && !/local/.test(t.href))).toHaveLength(1)
    expect(redesignPlaceForPath('/dashboard/market')?.key).toBe('jobs')
  })

  it('shows Finances and benefits unless the member said no to money help', () => {
    expect(redesignPlacesFor({ moneyHelp: true }).some((p) => p.key === 'money')).toBe(true)
    expect(redesignPlacesFor({ moneyHelp: null }).some((p) => p.key === 'money')).toBe(true)
    expect(redesignPlacesFor({ moneyHelp: false }).some((p) => p.key === 'money')).toBe(false)
  })
})

import { describe, expect, it } from 'vitest'
import { MENU_RULES, MOBILE_TAB, PILLAR_ORDER, itemPillar, itemVisibility, menuMode, statusUnlock, type MenuItemKey, type MenuMode } from '@/lib/journey/menu'
import { CHECK_IN_ANSWERS } from '@/lib/journey/journey'

const modes: MenuMode[] = ['EXPLORING', 'PREPARING', 'ACTIVE', 'STAYING', 'LANDED', 'PORTFOLIO', 'LEAVE']
const keys = Object.keys(MENU_RULES) as MenuItemKey[]

describe('menu mode', () => {
  it('maps stages to a mode; no stage yet sees an active search', () => {
    expect(menuMode('APPLYING')).toBe('ACTIVE')
    expect(menuMode('INTERVIEWING')).toBe('ACTIVE')
    expect(menuMode('OFFER')).toBe('ACTIVE')
    expect(menuMode('STAYING')).toBe('STAYING')
    expect(menuMode('PAUSED')).toBe('STAYING') // legacy value: managing your career
    expect(menuMode(null)).toBe('ACTIVE')
  })
  it('going for a promotion before applying elsewhere gets the grow-in-your-job menu', () => {
    expect(menuMode('PREPARING', 'PROMOTION')).toBe('STAYING')
    expect(menuMode('APPLYING', 'PROMOTION')).toBe('ACTIVE')
    expect(menuMode('PREPARING', 'LAID_OFF')).toBe('PREPARING')
  })
})

describe('the phone bar follows the situation', () => {
  it('one situational tab: jobs when searching, plan when exploring, worth when managing a career', () => {
    expect(MOBILE_TAB.ACTIVE).toBe('jobs')
    expect(MOBILE_TAB.PREPARING).toBe('jobs')
    expect(MOBILE_TAB.EXPLORING).toBe('plan')
    expect(MOBILE_TAB.STAYING).toBe('worth')
    expect(MOBILE_TAB.LANDED).toBe('first90')
  })
})

describe('what shows for each situation', () => {
  it('someone applying sees every job-search tool, none locked', () => {
    for (const k of ['jobs', 'interviewPrep', 'offer', 'companies', 'interim', 'recruiter'] as const) expect(itemVisibility(k, 'ACTIVE')).toBe('show')
  })
  it('someone staying in a job or exploring sees job tools locked, not hidden, so they know what turns on', () => {
    expect(itemVisibility('jobs', 'STAYING')).toBe('locked')
    expect(itemVisibility('jobs', 'EXPLORING')).toBe('locked')
  })
  it('someone who landed does not see job-search tools at all', () => {
    expect(itemVisibility('jobs', 'LANDED')).toBe('hide')
    expect(itemVisibility('interim', 'LANDED')).toBe('hide')
    expect(itemVisibility('offer', 'LANDED')).toBe('show') // the Offer Bonus claim
  })
  it('grow-in-your-job tools are only for staying, career tools only for landed', () => {
    expect(itemVisibility('growWorth', 'STAYING')).toBe('show')
    expect(itemVisibility('growWorth', 'ACTIVE')).toBe('hide')
    expect(itemVisibility('careerFirst90', 'LANDED')).toBe('show')
    expect(itemVisibility('careerFirst90', 'EXPLORING')).toBe('hide')
  })
  it('profile, references, coaching, support and privacy are never hidden or locked', () => {
    for (const m of modes) {
      for (const k of ['profile', 'references', 'coach', 'struggling', 'privacy', 'help'] as const) expect(itemVisibility(k, m)).toBe('show')
    }
  })
})

describe('the menu structure', () => {
  it('every item sits in a pillar that its mode lists', () => {
    for (const m of modes) {
      for (const k of keys) {
        if (itemVisibility(k, m) === 'hide') continue
        expect(PILLAR_ORDER[m], `${k} in ${m}`).toContain(itemPillar(k, m))
      }
    }
  })
  it('a search has the pillars a search is made of', () => {
    expect(PILLAR_ORDER.ACTIVE).toEqual(['plan', 'prove', 'search', 'network', 'learn', 'coach', 'work', 'support'])
  })
})

describe('turning tools on by updating your status', () => {
  it('every situation with locked tools says why and offers a real way to update', () => {
    const real = new Set(CHECK_IN_ANSWERS.map((a) => a.key as string))
    for (const m of modes) {
      const hasLocked = keys.some((k) => itemVisibility(k, m) === 'locked')
      const unlock = statusUnlock(m)
      if (hasLocked) {
        expect(unlock, m).not.toBeNull()
        expect(unlock!.why.length).toBeGreaterThan(20)
        for (const a of unlock!.answers) {
          expect(real.has(a.answer)).toBe(true)
          expect(a.because.length).toBeGreaterThan(20)
        }
      }
    }
  })
  it('an active search has nothing locked', () => {
    expect(keys.some((k) => itemVisibility(k, 'ACTIVE') === 'locked')).toBe(false)
    expect(statusUnlock('ACTIVE')).toBeNull()
  })
})

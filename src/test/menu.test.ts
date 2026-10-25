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

import { NO_SENIOR_OVERLAY, SENIOR_DEMOTED, SENIOR_PROMOTED, readSeniorTrack, seniorDemoted, seniorEngagementDefaults, seniorItemVisibility, seniorOverlayOn, seniorPillarOrder } from '@/lib/journey/menu'
import { menuEntries } from '@/lib/nav/places'
import { REDESIGN_PLACES } from '@/lib/nav/redesign-places'

const ON = { on: true, jobsRestored: false }
const allModes: MenuMode[] = [...modes, 'BUYING']

describe('senior overlay', () => {
  it('the switch wins both ways; otherwise level and title decide', () => {
    expect(seniorOverlayOn(true, null)).toBe(true)
    expect(seniorOverlayOn(false, null)).toBe(false)
    expect(seniorOverlayOn(true, false)).toBe(false)
    expect(seniorOverlayOn(false, true)).toBe(true)
  })
  it('off changes nothing, in every mode', () => {
    for (const m of allModes) {
      expect(seniorPillarOrder(m, NO_SENIOR_OVERLAY)).toEqual(PILLAR_ORDER[m])
      for (const k of keys) expect(seniorItemVisibility(k, m, NO_SENIOR_OVERLAY)).toBe(itemVisibility(k, m))
    }
  })
  it('on reorders but never drops a pillar, in every mode', () => {
    for (const m of allModes) {
      const out = seniorPillarOrder(m, ON)
      expect([...out].sort()).toEqual([...PILLAR_ORDER[m]].sort())
      expect(out[out.length - 1]).toBe('support')
      if (out.includes('search') && out.includes('network')) expect(out.indexOf('network')).toBeLessThan(out.indexOf('search'))
    }
  })
  it('promoted tools are never hidden or locked for a senior leader, except Be found where it makes no sense', () => {
    for (const m of allModes) {
      for (const k of SENIOR_PROMOTED) {
        const v = seniorItemVisibility(k, m, ON)
        if (k === 'beFound' || k === 'advisory') expect(v).toBe(itemVisibility(k, m))
        else expect(v).toBe('show')
      }
    }
    expect(itemVisibility('recruiter', 'STAYING')).toBe('hide')
    expect(seniorItemVisibility('recruiter', 'STAYING', ON)).toBe('show')
  })
  it('the job board is demoted until restored, and other tools are not', () => {
    expect(seniorDemoted('jobs', ON)).toBe(true)
    expect(seniorDemoted('jobs', { on: true, jobsRestored: true })).toBe(false)
    expect(seniorDemoted('jobs', NO_SENIOR_OVERLAY)).toBe(false)
    expect(seniorDemoted('network', ON)).toBe(false)
    expect(SENIOR_DEMOTED).toEqual(['jobs'])
  })
  it('points, streaks and daily application prompts start off, and only for the overlay', () => {
    expect(seniorEngagementDefaults(ON)).toEqual({ points: false, streaks: false, dailyApplicationPrompts: false })
    expect(seniorEngagementDefaults(NO_SENIOR_OVERLAY)).toEqual({ points: true, streaks: true, dailyApplicationPrompts: true })
  })
  it('reads the stored choice and ignores junk', () => {
    expect(readSeniorTrack(null)).toEqual({ override: null, jobsRestored: false })
    expect(readSeniorTrack({ seniorTrack: { override: false, jobsRestored: true } })).toEqual({ override: false, jobsRestored: true })
    expect(readSeniorTrack({ seniorTrack: { override: 'yes' } })).toEqual({ override: null, jobsRestored: false })
  })
  it('Be found is hidden once landed, on a break or buying, and shown while searching or staying', () => {
    for (const m of ['LANDED', 'LEAVE', 'BUYING', 'PORTFOLIO'] as MenuMode[]) expect(itemVisibility('beFound', m)).toBe('hide')
    for (const m of ['EXPLORING', 'PREPARING', 'ACTIVE', 'STAYING'] as MenuMode[]) expect(itemVisibility('beFound', m)).toBe('show')
  })
  it('the menu keeps every entry, moves Network up and mutes the job board', () => {
    const ctx = (mode: MenuMode) => ({ employed: true, locks: { hasEmailConnection: true, skillsAssessmentCompleted: true, mode }, paidAccess: { coaching: true, recruiters: true } })
    for (const m of allModes) {
      for (const place of REDESIGN_PLACES) {
        const std = menuEntries(place, '/dashboard', ctx(m)).map((e) => e.label)
        const sen = menuEntries(place, '/dashboard', { ...ctx(m), senior: ON }).map((e) => e.label)
        // Senior may add entries that a mode hid (recruiters), never lose one.
        for (const l of std) expect(sen).toContain(l)
      }
    }
    const network = REDESIGN_PLACES.find((p) => p.key === 'network')!
    const order = menuEntries(network, '/dashboard', { ...ctx('EXPLORING'), senior: ON }).map((e) => e.label)
    expect(order.slice(0, 3)).toEqual(['This week', 'Recruiters', 'Be found'])
    const jobs = REDESIGN_PLACES.find((p) => p.key === 'jobs')!
    const j = menuEntries(jobs, '/dashboard', { ...ctx('ACTIVE'), senior: ON })
    expect(j[j.length - 1]).toMatchObject({ label: 'Find a job', muted: true })
    expect(j[j.length - 1].href).toBeTruthy() // muted, still a link
    expect(menuEntries(jobs, '/dashboard', { ...ctx('ACTIVE'), senior: { on: true, jobsRestored: true } })[0].label).toBe('Find a job')
  })
})

import { engagementFor, seniorOverlayFor } from '@/lib/journey/senior-overlay'

describe('senior engagement in Home and Stats', () => {
  const vp = { highestLevelReached: 'VP', resumeLatestJobTitle: 'VP Finance' }
  const ic = { highestLevelReached: 'IC', resumeLatestJobTitle: 'Analyst' }
  it('a senior member starts with points, streaks and daily prompts off', () => {
    expect(engagementFor(vp)).toEqual({ points: false, streaks: false, dailyApplicationPrompts: false })
  })
  it('everyone else keeps them on', () => {
    expect(engagementFor(ic)).toEqual({ points: true, streaks: true, dailyApplicationPrompts: true })
  })
  it('the switch wins both ways', () => {
    expect(engagementFor({ ...ic, journeyDetails: { seniorTrack: { override: true } } }).points).toBe(false)
    expect(engagementFor({ ...vp, journeyDetails: { seniorTrack: { override: false } } }).points).toBe(true)
  })
  it('restoring the job board turns them back on', () => {
    const m = { ...vp, journeyDetails: { seniorTrack: { jobsRestored: true } } }
    expect(seniorOverlayFor(m)).toEqual({ on: true, jobsRestored: true })
    expect(engagementFor(m)).toEqual({ points: true, streaks: true, dailyApplicationPrompts: true })
  })
})

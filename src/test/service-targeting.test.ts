import { describe, expect, it } from 'vitest'
import {
  customOfferingsFrom,
  describeTargeting,
  memberCards,
  memberTraits,
  matchesTargeting,
  NO_TARGETING,
  serviceSettingsFrom,
  serviceTarget,
  getService,
  type Targeting,
} from '@/lib/higher-ed/services'

const englishMajorInMiami = memberTraits({
  major: 'English',
  school: 'Dietrich College',
  department: 'Department of English',
  classYear: 2008,
  metroArea: 'Miami-Fort Lauderdale-West Palm Beach, FL',
  currentCity: 'Miami',
  journey: 'LAID_OFF',
})

const t = (x: Partial<Targeting>): Targeting => ({ ...NO_TARGETING, ...x })

describe('matchesTargeting', () => {
  it('lets everyone through when nothing is set', () => {
    expect(matchesTargeting(NO_TARGETING, englishMajorInMiami)).toBe(true)
  })
  it('requires every set dimension, any value within one', () => {
    expect(matchesTargeting(t({ majors: ['english', 'history'], cities: ['miami'] }), englishMajorInMiami)).toBe(true)
    expect(matchesTargeting(t({ majors: ['english'], cities: ['pittsburgh'] }), englishMajorInMiami)).toBe(false)
  })
  it('matches a city inside a longer metro name', () => {
    expect(matchesTargeting(t({ cities: ['fort lauderdale'] }), englishMajorInMiami)).toBe(true)
  })
  it('checks the class-year range and career moments', () => {
    expect(matchesTargeting(t({ classYearFrom: 2000, classYearTo: 2015, moments: ['between_jobs'] }), englishMajorInMiami)).toBe(true)
    expect(matchesTargeting(t({ classYearFrom: 2010 }), englishMajorInMiami)).toBe(false)
    expect(matchesTargeting(t({ moments: ['founders'] }), englishMajorInMiami)).toBe(false)
  })
  it('counts an open transition flag as between jobs', () => {
    const m = memberTraits({ major: null, school: null, department: null, classYear: null, inTransition: true })
    expect(matchesTargeting(t({ moments: ['between_jobs'] }), m)).toBe(true)
  })
  it('fails a city target for a member with no profile city', () => {
    const m = memberTraits({ major: 'English', school: null, department: null, classYear: 2008 })
    expect(matchesTargeting(t({ cities: ['miami'] }), m)).toBe(false)
  })
})

describe('describeTargeting', () => {
  it('reads as a short line for staff', () => {
    expect(describeTargeting(t({ majors: ['english'], classYearFrom: 2000, classYearTo: 2015, moments: ['founders'] }))).toBe(
      'majors: english · class of 2000–2015 · Starting or buying a business',
    )
    expect(describeTargeting(NO_TARGETING)).toBeNull()
  })
})

describe('custom and partner offerings', () => {
  const features = {
    customServices: [{ key: 'x_ai1', name: 'AI for leaders', pitch: 'Six weeks online.' }, { key: 'bad', name: 'x', pitch: 'y' }],
    services: {
      x_ai1: { on: true, provider: 'partner', partnerName: 'Course Co', linkUrl: 'https://example.com/ai', audience: ['alumni'], targeting: { majors: ['english'] } },
    },
  }
  it('keeps only well-formed custom offerings', () => {
    expect(customOfferingsFrom(features).map((o) => o.key)).toEqual(['x_ai1'])
  })
  it('keeps a partner provider and opens the partner link', () => {
    const settings = serviceSettingsFrom(features)
    expect(settings.x_ai1.provider).toBe('partner')
    const s = getService('x_ai1', 'college', features)!
    expect(serviceTarget(s, settings.x_ai1)).toBe('https://example.com/ai')
  })
  it('shows a targeted card only to members who match, and never on the public page', () => {
    const settings = serviceSettingsFrom(features)
    const shown = (traits: ReturnType<typeof memberTraits> | null) =>
      memberCards(settings, ['alumni'], 'college', { traits, enabledFeatures: features }).map((c) => c.key)
    expect(shown(englishMajorInMiami)).toContain('x_ai1')
    expect(shown(memberTraits({ major: 'Physics', school: null, department: null, classYear: 2008 }))).not.toContain('x_ai1')
    expect(shown(null)).not.toContain('x_ai1')
    const card = memberCards(settings, ['alumni'], 'college', { traits: englishMajorInMiami, enabledFeatures: features }).find((c) => c.key === 'x_ai1')
    expect(card?.partnerName).toBe('Course Co')
  })
})

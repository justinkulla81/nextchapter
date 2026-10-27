import { describe, expect, it } from 'vitest'
import { employerSeo } from '@/lib/seo/templates'
import { orgPageTitle } from '@/lib/seo/org-page-rules'
import { hiringPlaces, listOf } from '@/lib/seo/employer-locations'
import { renderedTitle } from '@/lib/seo/title'

// Wording chosen from Search Console queries (2026-10): "<employer> careers", "<employer> <city>", an organization searched by its name.
describe('employer titles', () => {
  it('leads with careers and jobs, with the open-role count when there is one', () => {
    expect(employerSeo('Carvana', 354).title).toBe('Carvana Careers, Jobs and Pay: 354 Open Roles')
    expect(employerSeo('Carvana', null).title).toBe('Carvana Careers and Jobs')
  })
  it('falls back to a shorter wording for a long name; titleMeta then trims the rest to 60', () => {
    const t = employerSeo('The Very Long Named Association of Regional Healthcare Employers', 12).title
    expect(t).toContain('Jobs')
    expect(renderedTitle(t).length).toBeLessThanOrEqual(60)
  })
  it('never renders over 60 characters', () => {
    for (const name of ['QXO', 'Baylor University', 'Gathering Littles', 'Piper Maddox']) {
      expect(renderedTitle(employerSeo(name, 18).title).length).toBeLessThanOrEqual(60)
    }
  })
})

describe('organization page titles', () => {
  it('does not repeat the state when the name already ends with it', () => {
    expect(orgPageTitle({ name: 'Fairfield County, OH', city: null, state: 'OH' })).toBe('Fairfield County, OH: Local Jobs and Contacts')
  })
  it('names the city and state when the name does not', () => {
    expect(orgPageTitle({ name: 'Alabaster Career Center', city: 'Alabaster', state: 'AL' })).toBe('Alabaster Career Center, AL: Local Jobs and Contacts')
    expect(orgPageTitle({ name: 'Region XII Council of Governments', city: 'Carroll', state: 'IA' })).toBe('Region XII Council of Governments, Carroll, IA')
  })
  it('keeps the plain name when nothing longer fits', () => {
    const name = 'Southern Mississippi Planning and Development District'
    const t = orgPageTitle({ name, city: 'Gulfport', state: 'MS' })
    expect(t.length).toBeLessThanOrEqual(60)
    expect(t.startsWith('Southern Mississippi Planning and Development District')).toBe(true)
  })
})

describe('employer hiring places', () => {
  const locations = [
    { location: 'Tempe, AZ', count: 64 },
    { location: 'Seattle, WA; Remote', count: 9 },
    { location: 'Concord, NC, USA', count: 13 },
    { location: 'tempe, az', count: 2 },
    { location: 'Plainfield, IN', count: 13 },
  ]
  it('skips multi-place values, strips the country and drops repeats', () => {
    expect(hiringPlaces(locations, 3)).toEqual(['Tempe, AZ', 'Concord, NC', 'Plainfield, IN'])
  })
  it('stops at the limit', () => {
    expect(hiringPlaces(locations, 1)).toEqual(['Tempe, AZ'])
  })
  it('reads as a list', () => {
    expect(listOf([])).toBe('')
    expect(listOf(['Tempe, AZ'])).toBe('Tempe, AZ')
    expect(listOf(['Tempe, AZ', 'Concord, NC'])).toBe('Tempe, AZ and Concord, NC')
    expect(listOf(['Tempe, AZ', 'Greenfield, IN', 'Concord, NC'])).toBe('Tempe, AZ; Greenfield, IN; and Concord, NC')
    expect(listOf(['A', 'B'])).toBe('A and B')
    expect(listOf(['A', 'B', 'C'])).toBe('A, B and C')
  })
})

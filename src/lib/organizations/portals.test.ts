import { describe, expect, it } from 'vitest'
import { INTEGRATIONS, PORTALS, integrationApplies, isPortalType, resolveIntegrations } from './portals'
import { slugify, uniqueSlug } from './slug'

describe('portals', () => {
  it('has all six types and marks workforce as not yet available', () => {
    expect(PORTALS).toHaveLength(6)
    expect(PORTALS.find((p) => p.type === 'WORKFORCE')?.available).toBe(false)
  })
  it('recognizes portal types', () => {
    expect(isPortalType('COACH')).toBe(true)
    expect(isPortalType('coach')).toBe(false)
  })
})

describe('integrations', () => {
  const coachesServe = INTEGRATIONS.find((i) => i.key === 'coachesServeMembers')!
  it('applies only when the organization owns both sides', () => {
    expect(integrationApplies(coachesServe, ['COACH'])).toBe(false)
    expect(integrationApplies(coachesServe, ['HIGHER_ED'])).toBe(false)
    expect(integrationApplies(coachesServe, ['COACH', 'OUTPLACEMENT'])).toBe(true)
  })
  it('is on by default where it applies and off where it does not', () => {
    const r = resolveIntegrations({}, ['COACH', 'HIGHER_ED'])
    expect(r.coachesServeMembers).toBe(true)
    expect(r.recruitersMeetMembers).toBe(false)
  })
  it('lets an admin turn one off without affecting the rest', () => {
    const r = resolveIntegrations({ coachesServeMembers: false }, ['COACH', 'HIGHER_ED', 'RECRUITER'])
    expect(r.coachesServeMembers).toBe(false)
    expect(r.recruitersMeetMembers).toBe(true)
  })
  it('ignores junk stored values', () => {
    expect(resolveIntegrations('nope', ['COACH', 'HIGHER_ED']).coachesServeMembers).toBe(true)
    expect(resolveIntegrations(null, []).combinedOutcomes).toBe(false)
  })
})

describe('slug', () => {
  it('makes a url-safe slug', () => {
    expect(slugify('Riverside College & Co.')).toBe('riverside-college-co')
    expect(slugify('  ')).toBe('')
  })
  it('finds the next free slug', () => {
    const taken = new Set(['acme', 'acme-2'])
    expect(uniqueSlug('Acme', (s) => taken.has(s))).toBe('acme-3')
    expect(uniqueSlug('Fresh', (s) => taken.has(s))).toBe('fresh')
  })
})

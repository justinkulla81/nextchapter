import { describe, expect, it, beforeEach, vi } from 'vitest'
import { readOrAssignNavCtaVariant, NAV_CTA_LABEL } from '@/lib/ab/nav-cta'

function stubStorage(initial: Record<string, string> = {}, broken = false) {
  const data = { ...initial }
  const localStorage = broken
    ? { getItem() { throw new Error('blocked') }, setItem() { throw new Error('blocked') } }
    : { getItem: (k: string) => data[k] ?? null, setItem: (k: string, v: string) => { data[k] = v } }
  vi.stubGlobal('window', { localStorage })
}

describe('nav CTA variant', () => {
  beforeEach(() => vi.unstubAllGlobals())

  it('assigns one of the four variants and keeps it', () => {
    stubStorage()
    const first = readOrAssignNavCtaVariant()
    expect(['control', 'hire_score', 'resume_score', 'join_free']).toContain(first)
    for (let i = 0; i < 20; i++) expect(readOrAssignNavCtaVariant()).toBe(first)
  })

  it('respects a stored variant', () => {
    stubStorage({ nc_nav_cta_variant: 'hire_score' })
    expect(readOrAssignNavCtaVariant()).toBe('hire_score')
  })

  it('respects the resume variant and ignores unknown stored values', () => {
    stubStorage({ nc_nav_cta_variant: 'resume_score' })
    expect(readOrAssignNavCtaVariant()).toBe('resume_score')
    stubStorage({ nc_nav_cta_variant: 'join_free' })
    expect(readOrAssignNavCtaVariant()).toBe('join_free')
    stubStorage({ nc_nav_cta_variant: 'bogus' })
    expect(['control', 'hire_score', 'resume_score', 'join_free']).toContain(readOrAssignNavCtaVariant())
  })

  it('falls back to control when storage is blocked', () => {
    stubStorage({}, true)
    expect(readOrAssignNavCtaVariant()).toBe('control')
  })

  it('labels are the four agreed strings', () => {
    expect(NAV_CTA_LABEL.control).toBe('Get your Market Reality Assessment')
    expect(NAV_CTA_LABEL.hire_score).toBe('Get your Hireability Score')
    expect(NAV_CTA_LABEL.resume_score).toBe('Score My Resume')
    expect(NAV_CTA_LABEL.join_free).toBe('Join free')
  })
})

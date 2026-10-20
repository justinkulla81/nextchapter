import { describe, expect, it } from 'vitest'
import { CAREER_ROLES, GROUP_ORDER, getRole, rolesInGroup } from '@/lib/careers/roles'

describe('career roles', () => {
  it('has unique slugs', () => {
    const slugs = CAREER_ROLES.map((r) => r.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it('gives every role the content a posting needs', () => {
    for (const r of CAREER_ROLES) {
      expect(r.title.trim(), r.slug).not.toBe('')
      expect(r.summary.trim(), r.slug).not.toBe('')
      expect(r.responsibilities.length, r.slug).toBeGreaterThan(0)
      expect(r.bring.length, r.slug).toBeGreaterThan(0)
    }
  })

  it('makes lead roles Lead and contributor roles Contributor, never the reverse', () => {
    for (const r of rolesInGroup('lead')) expect(r.kind).toBe('lead')
    for (const r of [...rolesInGroup('contributor'), ...rolesInGroup('early-career')]) expect(r.kind).toBe('contributor')
    for (const r of rolesInGroup('platform')) expect(r.kind).toBe('platform')
  })

  it('sends platform roles to an existing page, and no other role', () => {
    for (const r of CAREER_ROLES) {
      if (r.kind === 'platform') expect(r.externalHref, r.slug).toMatch(/^\//)
      else expect(r.externalHref, r.slug).toBeUndefined()
    }
  })

  it('has no empty groups in the display order', () => {
    for (const g of GROUP_ORDER) expect(rolesInGroup(g).length, g).toBeGreaterThan(0)
  })

  it('makes AI experience a stated requirement of the technology lead', () => {
    const tech = getRole('technology-lead')
    expect(tech?.bring.join(' ')).toMatch(/AI/)
    expect(tech?.bring.join(' ')).toMatch(/required/i)
  })

  it('finds a role by slug and returns undefined for an unknown one', () => {
    expect(getRole('editorial-lead')?.title).toBe('Editorial lead')
    expect(getRole('nope')).toBeUndefined()
  })
})

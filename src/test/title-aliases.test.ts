import { describe, expect, it } from 'vitest'
import { slugForAbbreviation, titleLabel } from '@/lib/seo/title-aliases'
import { titleJobsSeo, titlePlaceJobsSeo } from '@/lib/seo/templates'

describe('title abbreviations', () => {
  it('maps an abbreviation to the hub for the spelled-out title, in any case', () => {
    expect(slugForAbbreviation('cfo')).toBe('chief-financial-officer')
    expect(slugForAbbreviation('CHRO')).toBe('chief-human-resources-officer')
    expect(slugForAbbreviation('cro')).toBeNull()
    expect(slugForAbbreviation('cpo')).toBeNull()
    expect(slugForAbbreviation('paralegal')).toBeNull()
  })
  it('adds the abbreviation to the name once', () => {
    expect(titleLabel('Chief Financial Officer', 'chief-financial-officer')).toBe('Chief Financial Officer (CFO)')
    expect(titleLabel('CFO', 'chief-financial-officer')).toBe('CFO')
    expect(titleLabel('Paralegal', 'paralegal')).toBe('Paralegal')
  })
  it('puts the abbreviation in the title, heading and description of the hub and its place pages', () => {
    const hub = titleJobsSeo(titleLabel('Chief Financial Officer', 'chief-financial-officer'), 620)
    expect(hub.title).toBe('Chief Financial Officer (CFO) Jobs: 620 Open Roles')
    expect(hub.h1).toContain('(CFO)')
    expect(hub.description).toContain('(cfo)')
    expect(titlePlaceJobsSeo(titleLabel('Chief Operating Officer', 'chief-operating-officer'), 'Texas', 12, null).title).toContain('(COO)')
  })
})

import { employerSeo, openRolesLabel } from '@/lib/seo/templates'
import { employerTitleB } from '@/lib/seo/title-tests'

describe('open roles wording', () => {
  it('uses the singular for one role', () => {
    expect(openRolesLabel(1)).toBe('1 Open Role')
    expect(openRolesLabel(12)).toBe('12 Open Roles')
    expect(openRolesLabel(1234, true)).toBe('1,234 open roles')
  })
  it('does not write "1 Open Roles" in either employer title', () => {
    expect(employerSeo('Credenza Health', 1).title).toBe('Credenza Health Careers, Jobs and Pay: 1 Open Role')
    expect(employerTitleB('Credenza Health', 1)).toBe('Jobs at Credenza Health: 1 Open Role, Pay and Hiring')
    expect(employerTitleB('Sage', 10)).toBe('Jobs at Sage: 10 Open Roles, Pay and Hiring')
  })
})

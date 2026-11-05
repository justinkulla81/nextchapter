import { describe, expect, it } from 'vitest'
import { cleanFirmName, firmOrgName, FIRM_NAME_OVERRIDES } from '@/lib/search-firms/clean-name'
import { claimSlug } from '@/lib/org-claims/urls'
import { normalizeOrgName } from '@/lib/text/org-name-match'
import renamed from '@/lib/search-firms/renamed-firms.json'

describe('cleanFirmName', () => {
  it('drops a careers-page prefix', () => {
    expect(cleanFirmName('Careers | Roberts Recruiting')).toBe('Roberts Recruiting')
    expect(cleanFirmName('Careers | Engaging Talent LLC')).toBe('Engaging Talent LLC')
    expect(cleanFirmName('Jobs - Acme Search')).toBe('Acme Search')
  })
  it('cuts a tagline or a description after the name', () => {
    expect(cleanFirmName('Optima Search | Europe & America')).toBe('Optima Search')
    expect(cleanFirmName('StaffBuffalo | Recruiting | Talent Optimization | Human Resources | HR')).toBe('StaffBuffalo')
    expect(cleanFirmName('PReP Intl = INTL-PREQUALIFIED READY EMPLOYEES FOR POWER INTL, LLC')).toBe('PReP Intl')
  })
  it('drops a cut-off parenthesis and a trademark sign, keeps a whole one', () => {
    expect(cleanFirmName('Advanced Placement, LLC (now')).toBe('Advanced Placement, LLC')
    expect(cleanFirmName('The Barton Partnership | B Corp™')).toBe('The Barton Partnership')
    expect(cleanFirmName('PeopleFind Inc. (Toronto)')).toBe('PeopleFind Inc. (Toronto)')
  })
  it('leaves an ordinary name alone, with its punctuation', () => {
    for (const n of ['Hazard, Young, Attea & Associates', 'B.E. Smith', 'D. Hilton Associates', '10th St. Talent', 'Kirby Partners']) expect(cleanFirmName(n)).toBe(n)
  })
  it('keeps the raw name when nothing is left of it', () => {
    expect(cleanFirmName('Careers')).toBe('Careers')
  })
})

describe('firmOrgName', () => {
  it('uses the checked name for a firm no rule can name', () => {
    expect(firmOrgName({ sourceKey: 'sf:riderflex', name: 'National recruiting and consulting firm. C-suite through associate' })).toBe('Riderflex')
    expect(firmOrgName({ sourceKey: 'sf:jobskey2', name: 'Careers' })).toBe('Jobskey')
    expect(Object.keys(FIRM_NAME_OVERRIDES).every((k) => k.startsWith('sf:'))).toBe(true)
  })
  it('otherwise cleans the crawled name', () => {
    expect(firmOrgName({ sourceKey: 'sf:talonrecruiting', name: 'Careers | Talon Recruiting' })).toBe('Talon Recruiting')
  })
})

describe('renamed-firms.json', () => {
  it('has an address pair that matches the names, for every firm', () => {
    for (const f of renamed) {
      expect(claimSlug(normalizeOrgName(f.from))).toBe(f.oldSlug)
      expect(claimSlug(normalizeOrgName(f.to))).toBe(f.newSlug)
      expect(f.oldSlug).not.toBe(f.newSlug)
    }
  })
  it('names the firm as the sync would name a new one', () => {
    for (const f of renamed) expect(firmOrgName({ sourceKey: f.sourceKey, name: f.from })).toBe(f.to)
  })
  it('never sends an address to another firm that is also being redirected', () => {
    const olds = new Set(renamed.map((f) => f.oldSlug))
    for (const f of renamed) expect(olds.has(f.newSlug)).toBe(false)
  })
  it('has each old address once', () => {
    expect(new Set(renamed.map((f) => f.oldSlug)).size).toBe(renamed.length)
  })
})

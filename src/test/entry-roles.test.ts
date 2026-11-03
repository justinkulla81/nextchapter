import { describe, expect, it } from 'vitest'
import { ENTRY_CATEGORIES, ENTRY_ROLES, entryRole, rolesForTitle, similarRoles } from '@/lib/entry-roles/roles'
import { renderedTitle } from '@/lib/seo/title'
import { experienceAnswer, roleFaqs, rolePlaceSeo, roleSeo, skillItems } from '@/lib/entry-roles/text'

const NO_FACTS = null
const FACTS = { jobs: 120, noExperience: 14, training: 30, median: 58000, p25: 50000, p75: 65000, payCount: 40 }

describe('entry-level role records', () => {
  it('has unique slugs, known categories and links only to real roles', () => {
    const slugs = ENTRY_ROLES.map((r) => r.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
    for (const r of ENTRY_ROLES) {
      expect(ENTRY_CATEGORIES.some((c) => c.slug === r.cat), r.slug).toBe(true)
      for (const n of r.next) expect(entryRole(n), `${r.slug} -> ${n}`).toBeTruthy()
      expect(r.next.length, r.slug).toBeGreaterThanOrEqual(2)
    }
  })

  it('gives every role the parts a page needs, and no invented numbers', () => {
    for (const r of ENTRY_ROLES) {
      expect(r.what.length, r.slug).toBeGreaterThan(60)
      expect(r.tasks.length, r.slug).toBeGreaterThanOrEqual(4)
      expect(r.skills.length, r.slug).toBeGreaterThanOrEqual(5)
      expect(r.match.length, r.slug).toBeGreaterThan(0)
      // Pay, demand and growth come from the stored figures, never from the curated text.
      expect(`${r.what} ${r.tasks.join(' ')}`, r.slug).not.toMatch(/\$\d|\d+%|\bper year\b/)
    }
  })

  it('has at least one role for every category, and lists similar roles for each role', () => {
    for (const c of ENTRY_CATEGORIES) expect(ENTRY_ROLES.some((r) => r.cat === c.slug), c.slug).toBe(true)
    for (const r of ENTRY_ROLES) expect(similarRoles(r).length, r.slug).toBeGreaterThanOrEqual(2)
  })
})

describe('matching an opening to a role', () => {
  it.each([
    ['Business Development Representative - Remote', 'business-development-representative'],
    ['Sales Development Rep (SaaS)', 'sales-development-representative'],
    ['Account Executive, SMB', 'account-executive'],
    ['Associate Account Executive', 'account-executive'],
    ['Account Manager', 'account-manager'],
    ['Help Desk Technician, Tier 1', 'it-help-desk-technician'],
    ['Customer Service Representative II', 'customer-service-representative'],
    ['Associate Product Manager', 'product-manager-associate'],
  ])('%s -> %s', (title, slug) => {
    expect(rolesForTitle(title)).toContain(slug)
  })

  it.each(['Senior Account Executive', 'Director of Customer Service', 'Marketing Manager', 'Lead Software Engineer', 'VP of Sales', 'Principal Account Manager'])('%s is above entry level', (title) => {
    expect(rolesForTitle(title)).toEqual([])
  })
})

describe('entry-level page wording', () => {
  it('fits the title and description limits for every role, with and without data', () => {
    for (const r of ENTRY_ROLES) {
      for (const f of [NO_FACTS, FACTS]) {
        const s = roleSeo(r, f)
        expect(s.title.length, `${r.slug} title`).toBeLessThanOrEqual(60)
        expect(s.description.length, `${r.slug} description`).toBeLessThanOrEqual(160)
        expect(s.title.toLowerCase()).toContain('entry-level')
      }
      const p = rolePlaceSeo(r, 'Salt Lake City, UT', 123, 61000)
      expect(renderedTitle(p.title).length, `${r.slug} place title`).toBeLessThanOrEqual(60)
      expect(p.description.length, `${r.slug} place description`).toBeLessThanOrEqual(160)
    }
  })

  it('states no-experience counts only from data and says plainly when there are none', () => {
    const r = entryRole('account-executive')!
    expect(experienceAnswer(r, FACTS)).toContain('14 of the 120')
    expect(experienceAnswer(r, { ...FACTS, noExperience: 0 })).toContain('None of the 120')
    expect(experienceAnswer(r, NO_FACTS)).toContain('none are open')
  })

  it('leaves out the pay question when no pay figure is held', () => {
    const r = entryRole('account-executive')!
    expect(roleFaqs(r, NO_FACTS).some((f) => /how much/i.test(f.q))).toBe(false)
    expect(roleFaqs(r, FACTS).some((f) => /how much/i.test(f.q))).toBe(true)
  })

  it('gives each skill the words a résumé uses', () => {
    const items = skillItems(entryRole('sales-development-representative')!)
    expect(items.find((i) => i.label === 'CRM software')?.words).toContain('salesforce')
  })
})

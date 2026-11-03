import { describe, expect, it } from 'vitest'
import { ROLES, ladderOf, normalizeTitle, roleBySlug, roleForAddress, rolesForTitle, titleIsRole } from '@/lib/seo/role-pages'

const slugs = (title: string) => rolesForTitle(title).map((r) => r.slug)
const is = (slug: string, title: string) => titleIsRole(roleBySlug(slug)!, title)

describe('role definitions', () => {
  it('has unique slugs and no alias that shadows a real page', () => {
    const real = new Set(ROLES.map((r) => r.slug))
    expect(real.size).toBe(ROLES.length)
    const seen = new Map<string, string>()
    for (const r of ROLES) for (const a of r.aliases) {
      expect(real.has(a), `${a} is an alias of ${r.slug} but is also a page`).toBe(false)
      const prior = seen.get(a)
      // Two roles may share an alias only when one of them is later ignored; flag it so a collision is chosen on purpose.
      expect(prior === undefined || prior === r.slug, `${a} claimed by ${prior} and ${r.slug}`).toBe(true)
      seen.set(a, r.slug)
    }
  })
  it('resolves acronyms and other word orders to the one page', () => {
    expect(roleForAddress('cro')?.slug).toBe('chief-revenue-officer')
    expect(roleForAddress('head-of-sales')?.slug).toBe('chief-revenue-officer')
    expect(roleForAddress('vice-president-of-sales')?.slug).toBe('vp-of-sales')
    expect(roleForAddress('sales-director')?.slug).toBe('director-of-sales')
    expect(roleForAddress('svp-of-marketing')?.slug).toBe('vp-of-marketing')
    expect(roleForAddress('chief-people-officer')?.slug).toBe('chief-human-resources-officer')
    expect(roleForAddress('nope')).toBeNull()
  })
  it('every role names its own spelled-out form and variants', () => {
    for (const r of ROLES) {
      expect(r.variants.length).toBeGreaterThan(2)
      expect(titleIsRole(r, r.spelled), r.slug).toBe(true)
    }
  })
})

describe('title matching: C-suite', () => {
  it('reads the acronym and the spelled-out form', () => {
    expect(is('chief-revenue-officer', 'Chief Revenue Officer')).toBe(true)
    expect(is('chief-revenue-officer', 'CRO')).toBe(true)
    expect(is('chief-revenue-officer', 'Chief Revenue Officer (CRO)')).toBe(true)
    expect(is('chief-revenue-officer', 'Head of Sales')).toBe(true)
    expect(is('chief-revenue-officer', 'Chief Commercial Officer')).toBe(true)
    expect(is('chief-marketing-officer', 'CMO, Consumer Brands')).toBe(true)
    expect(is('chief-financial-officer', 'CFO & Treasurer')).toBe(true)
  })
  it('does not read the acronym where it means something else', () => {
    expect(is('chief-revenue-officer', 'Senior Manager, CRO Oversight')).toBe(false)
    expect(is('chief-revenue-officer', 'Clinical CRO Vendor Lead')).toBe(false)
    expect(is('chief-marketing-officer', 'CMO - Hospital System')).toBe(false)
    expect(is('chief-marketing-officer', 'Chief Medical Officer')).toBe(false)
    expect(is('chief-customer-officer', 'CCO, Compliance')).toBe(false)
    expect(is('chief-data-officer', 'Chief Digital Officer')).toBe(false)
    expect(is('chief-information-security-officer', 'Director of Physical Security')).toBe(false)
  })
  it('leaves out staff around the leader', () => {
    expect(is('chief-financial-officer', 'Executive Assistant to the CFO')).toBe(false)
    expect(is('chief-executive-officer', 'Chief of Staff to the CEO')).toBe(false)
    expect(is('general-counsel', 'Associate General Counsel')).toBe(false)
    expect(is('general-counsel', 'Deputy General Counsel')).toBe(false)
    expect(is('general-counsel', 'General Counsel')).toBe(true)
    expect(is('chief-product-officer', 'Head of Product Marketing')).toBe(false)
    expect(is('chief-product-officer', 'Head of Product')).toBe(true)
  })
  it('keeps Executive Director to the real title', () => {
    expect(is('executive-director', 'Executive Director')).toBe(true)
    expect(is('executive-director', 'Executive Director, Habitat for Humanity')).toBe(true)
    expect(is('executive-director', 'Associate Executive Director')).toBe(false)
    expect(is('executive-director', 'Managing Executive Director')).toBe(false)
  })
})

describe('title matching: VP and Director', () => {
  it('reads every spelling of a vice president', () => {
    for (const t of ['VP of Sales', 'VP, Sales', 'VP Sales', 'Vice President of Sales', 'Vice President, Sales', 'SVP Sales', 'Senior Vice President of Sales', 'EVP, Sales', 'Executive Vice President - Sales', 'Vice President, Enterprise Sales', 'VP North America Sales', 'Sales VP']) {
      expect(is('vp-of-sales', t), t).toBe(true)
    }
  })
  it('keeps the function straight', () => {
    expect(is('vp-of-marketing', 'VP of Sales')).toBe(false)
    expect(is('vp-of-sales', 'VP of Marketing')).toBe(false)
    expect(is('vp-of-human-resources', 'VP, People')).toBe(true)
    expect(is('vp-of-human-resources', 'Vice President of Human Resources')).toBe(true)
    expect(is('vp-of-it', 'VP of Information Technology')).toBe(true)
    expect(is('vp-of-engineering', 'VP, Software Engineering')).toBe(true)
    expect(is('vp-of-customer-success', 'Vice President, Customer Experience')).toBe(true)
  })
  it('does not count sales operations as operations, or a data center as data', () => {
    expect(is('vp-of-operations', 'VP of Sales Operations')).toBe(false)
    expect(is('vp-of-operations', 'VP of Operations')).toBe(true)
    expect(is('vp-of-sales', 'VP of Sales Operations')).toBe(true)
    expect(is('director-of-data', 'Director of Data Center Operations')).toBe(false)
    expect(is('director-of-data', 'Director of Data Science')).toBe(true)
    expect(is('director-of-product', 'Director of Product Marketing')).toBe(false)
    expect(is('director-of-product', 'Director of Product Management')).toBe(true)
  })
  it('leaves out assistant and associate vice presidents and banking ranks', () => {
    expect(is('vp-of-finance', 'Assistant Vice President, Finance')).toBe(false)
    expect(is('vp-of-finance', 'AVP Finance')).toBe(false)
    expect(is('vp-of-finance', 'Vice President, Finance')).toBe(true)
  })
  it('reads a director in either word order and leaves out the neighbours', () => {
    for (const t of ['Director of Marketing', 'Marketing Director', 'Director, Marketing', 'Senior Director, Marketing', 'Global Director of Brand Marketing', 'Director of Demand Generation']) {
      expect(is('director-of-marketing', t), t).toBe(true)
    }
    expect(is('director-of-marketing', 'Associate Director of Marketing')).toBe(false)
    expect(is('director-of-marketing', 'Managing Director, Marketing')).toBe(false)
    expect(is('director-of-marketing', 'Art Director')).toBe(false)
    expect(is('director-of-marketing', 'VP of Marketing')).toBe(false)
    expect(is('director-of-marketing', 'Marketing Manager')).toBe(false)
  })
  it('a title that names two functions counts toward both', () => {
    expect(slugs('VP of Sales and Marketing')).toEqual(expect.arrayContaining(['vp-of-sales', 'vp-of-marketing']))
  })
  it('security directors count only when the title is about information security', () => {
    expect(is('director-of-information-security', 'Director of Information Security')).toBe(true)
    expect(is('director-of-information-security', 'Director of Cybersecurity')).toBe(true)
    expect(is('director-of-information-security', 'Director of Security, Casino')).toBe(false)
  })
})

describe('helpers', () => {
  it('normalizes marks and ampersands', () => {
    expect(normalizeTitle('VP, Sales & Marketing (US)')).toBe('vp sales and marketing us')
  })
  it('links the levels of one function', () => {
    const ladder = ladderOf(roleBySlug('vp-of-sales')!).map((r) => r.slug)
    expect(ladder).toEqual(expect.arrayContaining(['chief-revenue-officer', 'director-of-sales']))
    expect(ladder).not.toContain('director-of-marketing')
  })
})

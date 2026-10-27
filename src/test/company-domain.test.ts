import { describe, expect, it } from 'vitest'
import { guessHosts, homeUrlOf, looksParked, nameTokens, pageMatchesCompany, selfDescription } from '@/lib/branding/company-domain'

describe('company name words', () => {
  it('drops suffixes and filler', () => {
    expect(nameTokens('Wells Fargo & Company')).toEqual(['wells', 'fargo'])
    expect(nameTokens('The Boeing Company')).toEqual(['boeing'])
    expect(nameTokens('Acme Holdings Group LLC')).toEqual(['acme'])
  })
})

describe('guessHosts', () => {
  it('joins the words and tries the first word when it is long', () => {
    expect(guessHosts('Wells Fargo & Company')[0]).toBe('wellsfargo.com')
    expect(guessHosts('Intel Corporation')).toContain('intel.com')
    expect(guessHosts('Bank of America')).toContain('bankofamerica.com')
  })
  it('does not guess from a short first word alone', () => {
    expect(guessHosts('GE Healthcare')).not.toContain('ge.com')
  })
  it('tries .edu for schools and .org for non-profits first', () => {
    expect(guessHosts('Westfield State University')[0]).toMatch(/\.edu$/)
    expect(guessHosts('Habitat Foundation')[0]).toMatch(/\.org$/)
  })
  it('gives nothing for a name with no identifying word', () => {
    expect(guessHosts('The Group Inc')).toEqual([])
  })
})

describe('pageMatchesCompany', () => {
  const page = (t: string) => `<html><head><title>${t}</title><meta property="og:site_name" content="x"></head><body><h1>Welcome</h1></body></html>`
  it('accepts a page that names the company', () => {
    expect(pageMatchesCompany('Intel Corporation', page('Intel | Data Center, AI, PCs'))).toBe(true)
    expect(pageMatchesCompany('Wells Fargo & Company', page('Wells Fargo: Personal & Business Banking'))).toBe(true)
  })
  it('refuses a page for a different company', () => {
    expect(pageMatchesCompany('Intel Corporation', page('Intellicorp Staffing'))).toBe(false)
    expect(pageMatchesCompany('Apex Industries', page('Apex Legends'))).toBe(false)
  })
  it('refuses a parked or for-sale page even when it names the company', () => {
    expect(pageMatchesCompany('Acme', `<title>Acme</title><body>This domain is for sale</body>`)).toBe(false)
    expect(looksParked('<p>Buy this domain</p>')).toBe(true)
  })
  it('reads the site name and the first heading', () => {
    const d = selfDescription('<meta property="og:site_name" content="Delta Air Lines"><h1>Fly <b>Delta</b></h1>')
    expect(d).toContain('delta air lines')
    expect(d).toContain('fly delta')
  })
})

describe('homeUrlOf', () => {
  it('reduces an address to its home page', () => {
    expect(homeUrlOf('https://www.intel.com/content/www/us/en/careers')).toBe('https://www.intel.com')
    expect(homeUrlOf('intel.com')).toBe('https://intel.com')
    expect(homeUrlOf('')).toBeNull()
    expect(homeUrlOf('not a url')).toBeNull()
  })
})

describe('companyHomeOf', () => {
  it('turns a product or department address into the company home page', async () => {
    const { companyHomeOf } = await import('@/lib/branding/company-domain')
    expect(companyHomeOf('https://aws.amazon.com/')).toBe('https://amazon.com')
    expect(companyHomeOf('https://careers.rtx.com/jobs')).toBe('https://rtx.com')
    expect(companyHomeOf('https://www.intel.com')).toBe('https://intel.com')
  })
  it('gives nothing when stripping the product leaves no company address', async () => {
    const { companyHomeOf } = await import('@/lib/branding/company-domain')
    expect(companyHomeOf('https://labs.google/')).toBeNull()
    expect(companyHomeOf('')).toBeNull()
  })
  it('leaves a company whose name is itself a product word alone', async () => {
    const { companyHomeOf } = await import('@/lib/branding/company-domain')
    expect(companyHomeOf('https://jobs.com')).toBe('https://jobs.com')
  })
})

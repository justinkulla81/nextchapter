import { describe, it, expect } from 'vitest'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { load } from 'cheerio'
import { bestRoleMatch, cleanTitle, titleOverlap } from '@/lib/xray/match'
import { isInstallId } from '@/lib/xray/events'

const req = createRequire(import.meta.url)
const Sites = req('../../extensions/job-xray/sites.js')
const Pay = req('../../extensions/job-xray/pay.js')

const domOf = (file: string) => {
  const $ = load(readFileSync(`src/test/fixtures/xray/${file}`, 'utf8'))
  return {
    text: (sel: string) => $(sel).first().text().replace(/\s+/g, ' ').trim(),
    jsonLd: () => $('script[type="application/ld+json"]').map((_, e) => $(e).text()).get(),
  }
}
const loc = (hostname: string, pathname: string, search = '') => ({ hostname, pathname, search })

describe('job X-ray: site detection', () => {
  it('knows the three sites', () => {
    expect(Sites.siteFor(loc('www.linkedin.com', '/jobs/view/123'))).toBe('linkedin')
    expect(Sites.siteFor(loc('www.indeed.com', '/viewjob'))).toBe('indeed')
    expect(Sites.siteFor(loc('www.google.com', '/search', '?q=nurse&udm=8'))).toBe('google')
  })
  it('ignores ordinary Google search and other LinkedIn pages', () => {
    expect(Sites.siteFor(loc('www.google.com', '/search', '?q=nurse'))).toBeNull()
    expect(Sites.siteFor(loc('www.linkedin.com', '/feed/'))).toBeNull()
  })
})

describe('job X-ray: per-site fixtures', () => {
  it('LinkedIn', () => {
    const p = Sites.extract('linkedin', domOf('linkedin.html'))
    expect(p).toMatchObject({ title: 'Senior Marketing Manager', employer: 'Acme Corp' })
    expect(Pay.postedPay(p.payJson, p.payText)).toEqual({ min: 120000, max: 150000 })
  })
  it('Indeed (hourly pay becomes annual)', () => {
    const p = Sites.extract('indeed', domOf('indeed.html'))
    expect(p).toMatchObject({ title: 'Registered Nurse', employer: 'Mercy Health' })
    expect(Pay.postedPay(p.payJson, p.payText)).toEqual({ min: 80080, max: 95680 })
  })
  it('Google Jobs', () => {
    const p = Sites.extract('google', domOf('google.html'))
    expect(p).toMatchObject({ title: 'Data Analyst', employer: 'Northwind Traders' })
    expect(Pay.postedPay(p.payJson, p.payText)).toEqual({ min: 85000, max: 105000 })
  })
  it('falls back to JobPosting JSON-LD when no selector matches', () => {
    const p = Sites.extract('indeed', domOf('jsonld-only.html'))
    expect(p).toMatchObject({ title: 'Accountant', employer: 'Globex' })
    expect(Pay.postedPay(p.payJson, p.payText)).toEqual({ min: 70000, max: 90000 })
  })
  it('returns null when there is no title at all', () => {
    expect(Sites.extract('linkedin', { text: () => '', jsonLd: () => [] })).toBeNull()
  })
})

describe('job X-ray: pay', () => {
  it('compares the midpoint with the median', () => {
    expect(Pay.compareToMedian({ min: 100000, max: 120000 }, 80000)).toMatchObject({ where: 'above', pct: 38 })
    expect(Pay.compareToMedian({ min: 60000, max: 70000 }, 80000)).toMatchObject({ where: 'below' })
    expect(Pay.compareToMedian({ min: 78000, max: 86000 }, 80000)).toMatchObject({ where: 'near' })
    expect(Pay.compareToMedian(null, 80000)).toBeNull()
    expect(Pay.compareToMedian({ min: 1, max: 2 }, null)).toBeNull()
  })
  it('reads common pay phrasings', () => {
    expect(Pay.parsePayText('$95,000 a year')).toEqual({ min: 95000, max: 95000 })
    expect(Pay.parsePayText('Pay: $30 per hour')).toEqual({ min: 62400, max: 62400 })
    expect(Pay.parsePayText('Competitive salary')).toBeNull()
  })
})

describe('job X-ray: title matching', () => {
  it('cleans workplace words and locations', () => {
    expect(cleanTitle('Senior Accountant (Remote) - Austin, TX')).toBe('Senior Accountant')
    expect(cleanTitle('Nurse Practitioner, CA')).toBe('Nurse Practitioner')
  })
  it('only treats a career-site row as the same role when the words agree', () => {
    expect(titleOverlap('Senior Data Analyst', 'Data Analyst, Senior')).toBe(1)
    const rows = [{ title: 'Software Engineer' }, { title: 'Senior Data Analyst' }]
    expect(bestRoleMatch('Data Analyst Senior', rows)).toEqual(rows[1])
    expect(bestRoleMatch('Chief Financial Officer', rows)).toBeNull()
  })
  it('accepts only uuid install ids', () => {
    expect(isInstallId('3f2b8c1e-0a4d-4c5b-9e1f-7a6d5c4b3a21')).toBe(true)
    expect(isInstallId('hello')).toBe(false)
  })
})

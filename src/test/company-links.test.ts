import { describe, it, expect } from 'vitest'
import { buildCompanyIndex, matchNameToCompany, cleanWebsite } from '@/lib/companies/company-links'
import { isLinkableCompanyName } from '@/lib/companies/posting-company'
import { normalizeOrgName } from '@/lib/text/org-name-match'

const co = (name: string, id = name) => ({ id, name, canonicalNameNormalized: normalizeOrgName(name) })
const index = buildCompanyIndex([
  co('Acme Health Partners'),
  co('Acme Robotics'),
  co('Summit Search Consultants'),
  co('Indianapolis Marriott East'),
  co('Boston Medical Center'),
  co('Meta'),
])

describe('matchNameToCompany', () => {
  it('links an identical normalised name, whatever the punctuation or suffix', () => {
    const r = matchNameToCompany('Summit Search Consultants, Inc.', index)
    expect(r).toEqual({ kind: 'exact', companyId: 'Summit Search Consultants' })
  })

  it('never links a near match — it is queued for review instead', () => {
    const r = matchNameToCompany('Summit Search', index)
    expect(r.kind).toBe('close')
    if (r.kind === 'close') expect(r.candidates.map((c) => c.id)).toEqual(['Summit Search Consultants'])
  })

  it('offers every plausible company for an ambiguous name, never picks one', () => {
    const r = matchNameToCompany('Acme', index)
    expect(r.kind).toBe('close')
    if (r.kind === 'close') expect(r.candidates.map((c) => c.id).sort()).toEqual(['Acme Health Partners', 'Acme Robotics'])
  })

  it('does not match on generic words alone', () => {
    expect(matchNameToCompany('Health Services Group', index).kind).toBe('none')
    expect(matchNameToCompany('Medical Services International', index).kind).toBe('none')
  })

  it('does not match on a word shared by many companies, such as a place name', () => {
    const crowded = buildCompanyIndex([
      ...Array.from({ length: 9 }, (_, i) => co(`Boston Widget ${i}`)),
      co('Boston Quillfeather Group'),
    ])
    expect(matchNameToCompany('Boston Dynamics Corp', crowded).kind).toBe('none')
    // ...but a rarer shared word still does
    expect(matchNameToCompany('Quillfeather', crowded).kind).toBe('close')
  })

  it('does not match a name merely containing another as a substring', () => {
    expect(matchNameToCompany('Metamorphosis Labs', index).kind).toBe('none')
  })

  it('returns none for empty and unmatched names', () => {
    expect(matchNameToCompany('', index).kind).toBe('none')
    expect(matchNameToCompany('Zebra Quarry Holdings', index).kind).toBe('none')
  })
})

describe('cleanWebsite', () => {
  it('normalises to a bare https origin', () => {
    expect(cleanWebsite('www.Acme.com/about?x=1')).toBe('https://acme.com')
    expect(cleanWebsite('http://acme.co.uk')).toBe('http://acme.co.uk')
  })
  it('rejects things that are not a company website', () => {
    for (const bad of ['', 'not a url', 'javascript:alert(1)', 'https://linkedin.com/company/acme', 'https://user:pw@acme.com', 'localhost']) {
      expect(cleanWebsite(bad)).toBeNull()
    }
  })
})

describe('isLinkableCompanyName', () => {
  it('refuses placeholder employers so they never become directory companies', () => {
    for (const n of ['Unknown (candidate-submitted)', 'Confidential', 'N/A', 'Various', '', null]) {
      expect(isLinkableCompanyName(n as string | null)).toBe(false)
    }
    expect(isLinkableCompanyName('Acme Robotics')).toBe(true)
  })
})

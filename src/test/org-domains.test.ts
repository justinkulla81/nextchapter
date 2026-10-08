import { describe, expect, it } from 'vitest'
import { isHrLeaderTitle, pickLookupMatch } from '@/lib/crm/org-domains'

describe('HR leader titles', () => {
  it('include CHROs, chief people officers and HR vice presidents', () => {
    for (const t of ['CHRO', 'Chief Human Resources Officer', 'Chief People Officer', 'SVP, Human Resources', 'VP of People', 'Head of People', 'Director of Human Resources', 'Global Director, HR'])
      expect(isHrLeaderTitle(t), t).toBe(true)
  })
  it('leave out everyone else', () => {
    for (const t of ['HR Coordinator', 'Recruiter', 'Chief Financial Officer', 'VP of Sales', 'People Analytics Analyst', null])
      expect(isHrLeaderTitle(t), String(t)).toBe(false)
  })
})

describe('domain lookup matches', () => {
  it('takes a result only when it is the same company', () => {
    expect(pickLookupMatch('Spencer Stuart', [{ name: 'Spencer Stuart', domain: 'spencerstuart.com' }])).toBe('spencerstuart.com')
    expect(pickLookupMatch('MasterBrand Cabinets, LLC', [{ name: 'MasterBrand Cabinets', domain: 'masterbrand.com' }])).toBe('masterbrand.com')
    expect(pickLookupMatch('Acme Widgets', [{ name: 'Acme Rockets', domain: 'acmerockets.com' }])).toBeNull()
    expect(pickLookupMatch('Acme', [])).toBeNull()
  })
  it('does not take a longer name that starts with ours', () => {
    expect(pickLookupMatch('Millennium', [{ name: 'Millennium Salon Software', domain: 'meevo.com' }])).toBeNull()
  })
  it('needs a one-word name to be the domain too', () => {
    expect(pickLookupMatch('Paradigm', [{ name: 'Paradigm', domain: 'paradigmeducation.com' }])).toBeNull()
    expect(pickLookupMatch('Kong', [{ name: 'Kong', domain: 'kong.com' }])).toBe('kong.com')
  })
  it('prefers .com to a country domain', () => {
    expect(pickLookupMatch('BNP Paribas', [{ name: 'BNP Paribas', domain: 'bnpparibas.pl' }, { name: 'BNP Paribas', domain: 'bnpparibas.com' }])).toBe('bnpparibas.com')
  })
})

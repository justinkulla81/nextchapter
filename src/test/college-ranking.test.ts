import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({ prisma: {} }))

import { interestSignals, isCommunityCollege, isPersonalEmail, scoreCollege, type ScoreInput } from '@/lib/workforce/college-score'
import { titleLeadsRole } from '@/lib/workforce/college-contacts'
import { cleanPersonName, crmWorthy } from '@/lib/workforce/college-crm'
import { emailAtCollege, relationshipLevel, siteDomain } from '@/lib/workforce/college-rank'

describe('interest signals', () => {
  it('finds listed themes on a college’s own pages', () => {
    expect(interestSignals(['Our Center for Professional Studies offers AI literacy courses for mid-career adults and executive education for teams.']))
      .toEqual(['ai', 'reskilling', 'execEd'])
    expect(interestSignals(['Career services for alumni: alumni may schedule coaching at any time.'])).toEqual(['alumniCareers'])
    expect(interestSignals(['Welcome to the Office of Alumni Relations.'])).toEqual([])
  })
})

describe('community colleges', () => {
  it('are told by Carnegie class, whatever the sector says', () => {
    expect(isCommunityCollege({ carnegie: 14, sector: 1 })).toBe(true) // Austin Community College is filed as four-year
    expect(isCommunityCollege({ carnegie: 18, sector: 1 })).toBe(false)
    expect(isCommunityCollege({ carnegie: null, sector: 4 })).toBe(true)
  })
})

describe('personal emails', () => {
  it('takes an address built from the person’s name', () => {
    expect(isPersonalEmail('jfisher@creighton.edu', 'Jeremy Fisher, MBA, PHRS')).toBe(true)
    expect(isPersonalEmail('am275@evansville.edu', "Abigail Werling, M'09")).toBe(false)
    expect(isPersonalEmail('dc114@evansville.edu', 'Dianna Cundiff')).toBe(true)
    expect(isPersonalEmail('Danielle.Sork@ttuhsc.edu', 'Danielle Sork')).toBe(true)
  })
  it('refuses office inboxes and role aliases', () => {
    expect(isPersonalEmail('careers@simpson.edu', "Kelsey Bolton '09")).toBe(false)
    expect(isPersonalEmail('advancementvp@biola.edu', 'David Vazquez')).toBe(false)
    expect(isPersonalEmail('alumni@lesley.edu', 'Angela Floro')).toBe(false)
  })
})

describe('leader titles', () => {
  it('must lead the office they are listed for', () => {
    expect(titleLeadsRole('Director of Career Services', 'career')).toBe(true)
    expect(titleLeadsRole('Vice President for Institutional Advancement', 'development')).toBe(true)
    expect(titleLeadsRole('BBA Program Director and Graduate Academic Advising', 'career')).toBe(false)
    expect(titleLeadsRole('Director of Donor Services', 'development')).toBe(false)
    expect(titleLeadsRole('Executive Director', 'alumni')).toBe(false)
  })
})

describe('the CRM gate', () => {
  const c = { role: 'career', name: 'Jeremy Fisher, MBA, PHRS', title: 'Senior Director of the John P. Fahey Career Center', email: 'jfisher@creighton.edu' }
  it('admits a named office leader with their own email at an A or B college', () => {
    expect(crmWorthy(c, 'A')).toBe(true)
    expect(crmWorthy(c, 'C')).toBe(false)
    expect(crmWorthy({ ...c, email: 'careers@creighton.edu' }, 'A')).toBe(false)
  })
  it('stores the name without honorifics, credentials or class years', () => {
    expect(cleanPersonName('Dr. Chad Warren')).toBe('Chad Warren')
    expect(cleanPersonName('Jeremy Fisher, MBA, PHRS')).toBe('Jeremy Fisher')
    expect(cleanPersonName("Kelsey Bolton '09")).toBe('Kelsey Bolton')
    expect(cleanPersonName("Abigail Werling, M'09")).toBe('Abigail Werling')
  })
})

describe('scoring', () => {
  const base: ScoreInput = { sector: 2, carnegie: 18, size: 4, admitRate: 0.7, interestSignals: [], contacts: [], areaJobsLost: 0 }
  const leader = (role: string) => ({ role, name: 'Jane Roe', title: role === 'career' ? 'Director of Career Services' : 'Director of Alumni Relations', email: 'jroe@x.edu' })

  it('rewards contacts, fit, size and interest', () => {
    const r = scoreCollege({ ...base, contacts: [leader('career'), leader('alumni')], interestSignals: ['ai', 'reskilling'], areaJobsLost: 5000 })
    expect(r.parts).toMatchObject({ contacts: 15, fit: 30, size: 20, interest: 11 })
    expect(r.score).toBe(76)
    expect(r.tier).toBe('A')
  })
  it('marks down very selective schools', () => {
    const harvard = scoreCollege({ ...base, carnegie: 15, size: 5, admitRate: 0.035 })
    expect(harvard.parts.size).toBe(0)
    expect(harvard.parts.notes).toContain('Very selective (4% admitted)')
  })
  it('keeps community colleges in tier C whatever they score', () => {
    expect(scoreCollege({ ...base, carnegie: 14, contacts: [leader('career'), leader('alumni')], interestSignals: ['ai', 'reskilling', 'alumniCareers'] }).tier).toBe('C')
  })
})

describe('relationships', () => {
  const base: ScoreInput = { sector: 2, carnegie: 21, size: 2, admitRate: 0.8, interestSignals: [], contacts: [], areaJobsLost: 0 }
  it('put a college with a P0 or P1 contact in tier A, P2 in B at least', () => {
    expect(scoreCollege(base).tier).toBe('C')
    expect(scoreCollege({ ...base, relationship: 'P0' })).toMatchObject({ tier: 'A', parts: { relationship: 40 } })
    expect(scoreCollege({ ...base, relationship: 'P1' }).tier).toBe('A')
    expect(scoreCollege({ ...base, relationship: 'P2' }).tier).toBe('B')
  })
  it('count a live deal like a P1, a customer like a P0', () => {
    expect(scoreCollege({ ...base, dealStatus: 'IN_CONVERSATION' })).toMatchObject({ tier: 'A', parts: { relationship: 30 } })
    expect(scoreCollege({ ...base, dealStatus: 'CUSTOMER' }).parts.relationship).toBe(40)
    expect(scoreCollege({ ...base, dealStatus: 'LOST' }).parts.relationship).toBe(0)
  })
  it('lift even a community college you chose', () => {
    expect(scoreCollege({ ...base, carnegie: 14, relationship: 'P1' }).tier).toBe('A')
  })
  it('order P0 and pilots first, then P1 and live deals, then P2', () => {
    expect([40, 30, 15, 5, 0].map(relationshipLevel)).toEqual([0, 1, 2, 3, 3])
  })
  it('read a college’s email domain from its website', () => {
    expect(siteDomain('https://www.washjeff.edu/')).toBe('washjeff.edu')
    expect(siteDomain('https://www.york.cuny.edu/')).toBe('york.cuny.edu')
    expect(siteDomain(null)).toBeNull()
  })
  it('match a person to a college by their own campus domain, not a shared system one', () => {
    expect(emailAtCollege('rdelfine@andrew.cmu.edu', 'cmu.edu')).toBe(true)
    expect(emailAtCollege('njackson@washjeff.edu', 'washjeff.edu')).toBe(true)
    expect(emailAtCollege('Nhowell1@york.cuny.edu', 'york.cuny.edu')).toBe(true)
    expect(emailAtCollege('Nhowell1@york.cuny.edu', 'qcc.cuny.edu')).toBe(false)
    expect(emailAtCollege('x@notcmu.edu', 'cmu.edu')).toBe(false)
  })
})

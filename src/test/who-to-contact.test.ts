import { describe, it, expect, vi, beforeEach } from 'vitest'

const findMany = vi.fn()
vi.mock('@/lib/prisma', () => ({ prisma: { crmOrganization: { findMany: (...a: unknown[]) => findMany(...a) } } }))

import {
  PANEL_KEYS,
  contactTargets,
  displayPersonName,
  isPersonName,
  likelyHiringManagerTitles,
  linkedinPeopleSearchUrl,
  memberHeadline,
  outreachTemplate,
  recruiterTitlesFor,
} from '@/lib/jobs/who-to-contact'
import { MEMBER_ORG_SIGNAL_KEYS, loadMemberOrgSignal, toMemberOrgSignal } from '@/lib/jobs/who-to-contact-crm'

describe('likely hiring manager: same function, one or two rungs up', () => {
  it('Director of FP&A → VP of Finance, then CFO', () => {
    expect(likelyHiringManagerTitles('Director of FP&A', 'DIRECTOR')).toEqual({ titles: ['VP of Finance', 'CFO'], basis: 'Director' })
  })
  it('reads the level from the title when none is stored', () => {
    expect(likelyHiringManagerTitles('Senior Director, Marketing').titles).toEqual(['VP of Marketing', 'CMO'])
  })
  it('a VP reports to the function chief, then the CEO', () => {
    expect(likelyHiringManagerTitles('VP, Engineering', 'VP').titles).toEqual(['CTO', 'CEO'])
  })
  it('a manager reports to a senior manager or director in the same function', () => {
    expect(likelyHiringManagerTitles('Product Manager', 'MANAGER').titles).toEqual(['Senior Product Manager', 'Director of Product'])
  })
  it('a senior manager → director, then VP', () => {
    expect(likelyHiringManagerTitles('Senior Manager, Accounting', 'SR_MANAGER').titles).toEqual(['Director of Finance', 'VP of Finance'])
  })
  it('an SVP reports to the chief, then the CEO', () => {
    expect(likelyHiringManagerTitles('SVP Sales', 'EVP_SVP').titles).toEqual(['Chief Revenue Officer', 'CEO'])
  })
  it('a C-suite role reports to the CEO; the CEO to the board', () => {
    expect(likelyHiringManagerTitles('Chief Financial Officer', 'C_SUITE').titles).toEqual(['CEO'])
    expect(likelyHiringManagerTitles('Chief Executive Officer', 'C_SUITE').titles).toEqual(['Board Chair'])
  })
  it('an unknown function still gets a rung, labelled as same department', () => {
    expect(likelyHiringManagerTitles('Director, Special Projects', 'DIRECTOR').titles[0]).toBe('VP (same department)')
  })
  it('a level outside the ladder gives no guess', () => {
    expect(likelyHiringManagerTitles('Cashier', 'OTHER')).toEqual({ titles: [], basis: null })
  })
})

describe('recruiting titles and searches', () => {
  it('senior roles look for an executive recruiter and a function recruiter', () => {
    expect(recruiterTitlesFor('Director of FP&A', 'DIRECTOR')).toEqual(['Executive Recruiter', 'Finance Recruiter', 'HR Business Partner'])
    expect(recruiterTitlesFor('Product Manager', 'MANAGER')[0]).toBe('Talent Acquisition')
  })
  it('builds a plain LinkedIn people search from company + title', () => {
    expect(linkedinPeopleSearchUrl('Acme Corp', 'VP of Finance')).toBe(
      'https://www.linkedin.com/search/results/people/?keywords=Acme%20Corp%20VP%20of%20Finance'
    )
  })
  it('targets carry their kind', () => {
    const { targets } = contactTargets({ title: 'Director of FP&A', companyName: 'Acme', level: 'DIRECTOR' })
    expect(targets.filter((t) => t.kind === 'hiring_manager').map((t) => t.title)).toEqual(['VP of Finance', 'CFO'])
    expect(targets.every((t) => t.linkedinSearchUrl.startsWith('https://www.linkedin.com/search/results/people/'))).toBe(true)
  })
})

describe('the posting contact must be a person', () => {
  it.each(['Lisa Garvic', 'Josephine McKenrick', 'Gabriel Lucas', 'LAURA ROUSSEL', 'Dr. Andru Gilbert'])('%s is a person', (n) => expect(isPersonName(n)).toBe(true))
  it.each(['UCPS HR TEAM', 'San Diego Unified School District Human Resources', 'Recruiting', 'jobs@acme.com', 'Madonna', '', 'CMS Staff', 'Primary Job Contact Listed Within Job Posting', 'Polk County Public Schools'])(
    '%s is not',
    (n) => expect(isPersonName(n)).toBe(false)
  )
})

describe('display name', () => {
  it('title-cases an all-caps name only', () => {
    expect(displayPersonName('LAURA ROUSSEL')).toBe('Laura Roussel')
    expect(displayPersonName('Josephine McKenrick')).toBe('Josephine McKenrick')
  })
})

describe('outreach template', () => {
  it('fills the job, company, recipient and headline', () => {
    const note = outreachTemplate({
      jobTitle: 'Director of FP&A',
      companyName: 'Acme',
      recipientName: 'Lisa Garvic',
      headline: 'currently Senior Finance Manager at Beta',
      memberFirstName: 'Pat',
    })
    expect(note).toContain('Hi Lisa,')
    expect(note).toContain("I'm currently Senior Finance Manager at Beta, and I saw the Director of FP&A opening at Acme.")
    expect(note.trim().endsWith('Pat')).toBe(true)
  })
  it('never names the current employer in Confidential Search Mode', () => {
    const h = memberHeadline({ latestRole: { roleTitle: 'Controller', companyName: 'Secret Co', isCurrent: true }, yearsExperience: 12, confidential: true })
    expect(h).toBe('a Controller with 12 years of experience')
    expect(h).not.toContain('Secret')
  })
})

describe('no private CRM field reaches a member', () => {
  const PRIVATE_VALUES = ['secret note', 'real@acme.com', 'Jane Insider', 'HOT', 'VP Secrets']

  beforeEach(() => findMany.mockReset())

  it('the projection keeps only the two safe keys', () => {
    const out = toMemberOrgSignal({ knownSomeone: true, guessedEmail: 'lgarvic@acme.com', notes: 'secret', email: 'real@acme.com' } as never)
    expect(Object.keys(out).sort()).toEqual([...MEMBER_ORG_SIGNAL_KEYS].sort())
    expect(toMemberOrgSignal({ knownSomeone: 'yes', guessedEmail: 'pat@gmail.com' })).toEqual({ knownSomeone: false, guessedEmail: null })
  })

  it('loadMemberOrgSignal returns a yes/no and a format guess — no CRM person data', async () => {
    const person = (fullName: string, email: string | null, warmth = 'COLD') => ({
      fullName, email, warmth, connectedAt: null, linkedinDegree: null, firstRepliedAt: null,
      lastTouchedAt: null, touchCount: 0, notes: 'secret note',
    })
    findMany.mockResolvedValue([
      {
        emailDomain: 'acme.com',
        affiliations: [
          { person: person('Jane Insider', 'jinsider@acme.com', 'HOT') },
          { person: person('Bob Smith', 'bsmith@acme.com') },
          { person: person('Ann Lee', 'alee@acme.com') },
        ],
      },
    ])
    const out = await loadMemberOrgSignal({ companyId: 'c1', companyName: 'Acme', contactName: 'Lisa Garvic' })
    expect(out).toEqual({ knownSomeone: true, guessedEmail: 'lgarvic@acme.com' })
    const json = JSON.stringify(out)
    for (const v of PRIVATE_VALUES) expect(json).not.toContain(v)
  })

  it('cold, untouched contacts are not "someone we know", and one example is not a format', async () => {
    findMany.mockResolvedValue([
      { emailDomain: null, affiliations: [{ person: { fullName: 'Bob Smith', email: 'bsmith@acme.com', warmth: 'COLD', connectedAt: null, linkedinDegree: null, firstRepliedAt: null, lastTouchedAt: null, touchCount: 0, notes: 'From the college\'s own website' } }] },
    ])
    expect(await loadMemberOrgSignal({ companyId: 'c1', companyName: 'Acme', contactName: 'Lisa Garvic' })).toEqual({ knownSomeone: false, guessedEmail: null })
  })

  it('no CRM organization → nothing', async () => {
    findMany.mockResolvedValue([])
    expect(await loadMemberOrgSignal({ companyId: null, companyName: 'Nowhere', contactName: null })).toEqual({ knownSomeone: false, guessedEmail: null })
  })

  it('the panel shape is pinned', () => {
    expect([...PANEL_KEYS].sort()).toEqual(['companyId', 'hiringManagerBasis', 'jobId', 'knownSomeone', 'recruiter', 'sources', 'targets', 'template'])
  })
})

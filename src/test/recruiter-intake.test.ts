import { describe, expect, it } from 'vitest'
import { prescanResume, type ParsedIntakeResume, type PrescanSearch, type PrescanSpecialty } from '@/lib/recruiter/intake/prescan'
import { suggestRecruiter, type RoutingCandidateRecruiter } from '@/lib/recruiter/intake/routing'
import { normalizeLinkedinUrl, resolveForwardLocalPart, slugify, splitAddress, validateSlug } from '@/lib/recruiter/intake/slug'
import { pickReplyTemplate, renderReplyTemplate, DEFAULT_OUTSIDE_REPLY } from '@/lib/recruiter/intake/reply-templates'

const cfo: ParsedIntakeResume = {
  currentTitle: 'Chief Financial Officer',
  currentEmployer: 'Acme Health',
  level: 'C-Suite',
  primaryFunction: 'Finance',
  industry: 'Healthcare services',
  location: 'Boston, MA',
  keywords: ['FP&A', 'IPO readiness', 'M&A'],
}

const manager: ParsedIntakeResume = {
  currentTitle: 'Marketing Manager',
  currentEmployer: 'Shop Co',
  level: 'Manager',
  primaryFunction: 'Marketing',
  industry: 'Retail',
  location: 'Austin, TX',
  keywords: ['SEO'],
}

const financeSpecialties: PrescanSpecialty[] = [
  { type: 'FUNCTION', name: 'Finance', weight: 'PRIMARY' },
  { type: 'INDUSTRY', name: 'Healthcare', weight: 'SECONDARY' },
]

const cfoSearch: PrescanSearch = {
  id: 's1',
  title: 'CFO, digital health',
  functions: ['Finance'],
  levels: ['C-Suite'],
  mustHaves: ['IPO readiness'],
  location: 'Boston',
}

describe('prescanResume', () => {
  it('tags Fit only when every criterion on an open search matches, with reasons', () => {
    const result = prescanResume({ resume: cfo, specialties: [], searches: [cfoSearch], minLevel: null })
    expect(result.tag).toBe('FIT')
    expect(result.searchId).toBe('s1')
    expect(result.reasons[0]).toContain('CFO, digital health')
  })

  it('tags Niche on a specialty match', () => {
    const result = prescanResume({ resume: cfo, specialties: financeSpecialties, searches: [], minLevel: 'Director' })
    expect(result.tag).toBe('NICHE')
    expect(result.reasons.join(' ')).toContain('Finance (primary function)')
  })

  it('never tags Outside when the resume partly matches an open search', () => {
    const vpFinance = { ...cfo, level: 'VP', keywords: [] }
    const result = prescanResume({ resume: vpFinance, specialties: [], searches: [cfoSearch], minLevel: null })
    expect(result.tag).toBe('NICHE')
    expect(result.partialSearchMatch).toBe(true)
  })

  it('tags Outside below the firm floor even with a specialty hit', () => {
    const financeManager = { ...cfo, level: 'Manager' }
    const result = prescanResume({ resume: financeManager, specialties: financeSpecialties, searches: [], minLevel: 'Director' })
    expect(result.tag).toBe('OUTSIDE')
    expect(result.reasons[0]).toContain('Director floor')
  })

  it('does not penalize an unknown level against the floor', () => {
    const unknown = { ...cfo, level: null }
    const result = prescanResume({ resume: unknown, specialties: financeSpecialties, searches: [], minLevel: 'Director' })
    expect(result.tag).toBe('NICHE')
  })

  it('tags Outside with a plain reason when nothing matches', () => {
    const result = prescanResume({ resume: manager, specialties: financeSpecialties, searches: [cfoSearch], minLevel: null })
    expect(result.tag).toBe('OUTSIDE')
    expect(result.reasons).toEqual(['No match to your specialties or open searches'])
  })

  it('defaults to Niche, not Outside, before any criteria are set up', () => {
    const result = prescanResume({ resume: manager, specialties: [], searches: [], minLevel: null })
    expect(result.tag).toBe('NICHE')
  })

  it('respects the recruiter\'s not-a-fit link', () => {
    const result = prescanResume({ resume: cfo, specialties: financeSpecialties, searches: [cfoSearch], minLevel: null, notFitLink: true })
    expect(result.tag).toBe('OUTSIDE')
  })
})

describe('suggestRecruiter', () => {
  const jane: RoutingCandidateRecruiter = { id: 'jane', name: 'Jane Doe', specialties: financeSpecialties, searches: [], lastIntakeAssignedAt: new Date('2026-10-01') }
  const raj: RoutingCandidateRecruiter = { id: 'raj', name: 'Raj Patel', specialties: [{ type: 'FUNCTION', name: 'Marketing', weight: 'PRIMARY' }], searches: [], lastIntakeAssignedAt: null }
  const sam: RoutingCandidateRecruiter = { id: 'sam', name: 'Sam Lee', specialties: [{ type: 'FUNCTION', name: 'Finance', weight: 'SECONDARY' }], searches: [], lastIntakeAssignedAt: null }

  it('suggests the best specialty match with reasons', () => {
    const pick = suggestRecruiter({ resume: cfo, recruiters: [jane, raj, sam], mode: 'SUGGEST', resumeLine: 'CFO' })
    expect(pick?.recruiterId).toBe('jane')
    expect(pick?.summary).toContain('Jane: Finance (primary function)')
  })

  it('round-robins among matching recruiters, least recently assigned first', () => {
    const pick = suggestRecruiter({ resume: cfo, recruiters: [jane, raj, sam], mode: 'ROUND_ROBIN', resumeLine: 'CFO' })
    expect(pick?.recruiterId).toBe('sam')
  })

  it('returns null when nobody matches', () => {
    expect(suggestRecruiter({ resume: { ...manager, primaryFunction: 'Legal' }, recruiters: [jane], mode: 'AUTO', resumeLine: '' })).toBeNull()
  })
})

describe('slugs and forwarding addresses', () => {
  it('slugifies firm and person names', () => {
    expect(slugify('Summit Search Consultants')).toBe('summit-search-consultants')
    expect(slugify('Jane Doé & Co.')).toBe('jane-doe-and-co')
  })

  it('rejects reserved and malformed slugs', () => {
    expect(validateSlug('claim', { firm: true })).not.toBeNull()
    expect(validateSlug('a--b', { firm: false })).not.toBeNull()
    expect(validateSlug('summit', { firm: true })).toBeNull()
  })

  it('resolves firm and personal forwarding addresses, including hyphenated firm slugs', () => {
    const firms = [
      { slug: 'summit', recruiterSlugs: ['jane-doe'] },
      { slug: 'summit-search', recruiterSlugs: ['raj'] },
    ]
    expect(resolveForwardLocalPart('summit', firms)).toEqual({ firmSlug: 'summit', recruiterSlug: null })
    expect(resolveForwardLocalPart('summit-jane-doe', firms)).toEqual({ firmSlug: 'summit', recruiterSlug: 'jane-doe' })
    expect(resolveForwardLocalPart('summit-search', firms)).toEqual({ firmSlug: 'summit-search', recruiterSlug: null })
    expect(resolveForwardLocalPart('summit-search-raj+tag', firms)).toEqual({ firmSlug: 'summit-search', recruiterSlug: 'raj' })
    expect(resolveForwardLocalPart('nobody', firms)).toBeNull()
  })

  it('splits display-name addresses and normalizes LinkedIn URLs', () => {
    expect(splitAddress('Jane <Summit-Jane@in.example.com>')).toEqual({ local: 'summit-jane', domain: 'in.example.com' })
    expect(normalizeLinkedinUrl('linkedin.com/in/JaneDoe/?trk=x')).toBe('https://www.linkedin.com/in/janedoe')
  })
})

describe('reply templates', () => {
  it('uses the recruiter override only when the firm allows it', () => {
    const firm = { intakeNicheReplyTemplate: null, intakeOutsideReplyTemplate: 'Firm words', intakeRecruitersCanEditTemplates: false }
    const recruiter = { intakeNicheReplyTemplate: null, intakeOutsideReplyTemplate: 'My words' }
    expect(pickReplyTemplate('OUTSIDE', firm, recruiter)).toBe('Firm words')
    expect(pickReplyTemplate('OUTSIDE', { ...firm, intakeRecruitersCanEditTemplates: true }, recruiter)).toBe('My words')
  })

  it('fills placeholders and never says the person was rejected', () => {
    const text = renderReplyTemplate(DEFAULT_OUTSIDE_REPLY, { firstName: 'Ana', recruiterName: 'Jane Doe', firmName: 'Summit' })
    expect(text).toContain('Hi Ana')
    expect(text).toContain('current searches')
    expect(text.toLowerCase()).not.toContain('reject')
  })
})

import { buildCandidateStatus, coarseStatus } from '@/lib/recruiter/intake/status'

describe('candidate status for a firm', () => {
  const landed = {
    journeyStage: 'LANDED',
    journeyStageChangedAt: new Date('2026-11-01'),
    currentJob: { companyName: 'Acme', roleTitle: 'Controller', startDate: new Date('2026-11-10') },
  }
  it('shows nothing without consent', () => {
    expect(buildCandidateStatus([], landed)).toEqual({ status: null, landing: null })
    expect(buildCandidateStatus(['contact', 'profile_updates'], landed)).toEqual({ status: null, landing: null })
  })
  it('shows status only with the status scope', () => {
    const v = buildCandidateStatus(['status'], landed)
    expect(v.status?.label).toBe('Landed')
    expect(v.landing).toBeNull()
  })
  it('shows the new job only with landing_details and only once landed', () => {
    expect(buildCandidateStatus(['landing_details'], landed).landing?.employer).toBe('Acme')
    expect(buildCandidateStatus(['landing_details'], landed).status).toBeNull()
    expect(buildCandidateStatus(['landing_details'], { ...landed, journeyStage: 'APPLYING' }).landing).toBeNull()
  })
  it('keeps the plan stages private', () => {
    expect(coarseStatus('OFFER')).toBe('INTERVIEWING')
    expect(coarseStatus('PREPARING')).toBe('SEARCHING')
    expect(coarseStatus(null)).toBeNull()
  })
})

import { isStepDue, parsePipelineInput } from '@/lib/recruiter/intake/pipeline-stages'

describe('intake pipeline input', () => {
  it('rejects an unknown stage and a bad date, and says what to do', () => {
    expect(parsePipelineInput({ stage: 'X', note: '', nextStep: '' })).toEqual({ error: 'Pick a stage from the list.' })
    expect('error' in parsePipelineInput({ stage: 'NEW', note: '', nextStep: '12/01/2026' })).toBe(true)
    expect('error' in parsePipelineInput({ stage: 'NEW', note: '', nextStep: '2026-02-31' })).toBe(true)
  })
  it('drops the next step once the stage is closed', () => {
    const r = parsePipelineInput({ stage: 'PLACED', note: ' hi ', nextStep: '2026-12-01' })
    expect(r).toEqual({ stage: 'PLACED', note: 'hi', nextStepAt: null })
  })
  it('flags a due step only for open stages', () => {
    const now = new Date('2026-11-14T10:00:00Z')
    expect(isStepDue(new Date('2026-11-14T00:00:00Z'), 'TALKING', now)).toBe(true)
    expect(isStepDue(new Date('2026-11-15T00:00:00Z'), 'TALKING', now)).toBe(false)
    expect(isStepDue(new Date('2026-11-01T00:00:00Z'), 'NOT_A_FIT', now)).toBe(false)
  })
})

import { buildWeeklyDigest, type DigestRow } from '@/lib/recruiter/intake/digest'

describe('weekly digest', () => {
  const now = new Date('2026-11-16T12:00:00Z')
  const row = (o: Partial<DigestRow>): DigestRow => ({
    connectionId: 'c', name: 'Pat', createdAt: new Date('2026-09-01'), pipelineStage: 'NEW', nextStepAt: null, scopes: [], source: null, ...o,
  })
  const changed = { journeyStage: 'LANDED', journeyStageChangedAt: new Date('2026-11-14'), currentJob: { companyName: 'Acme', roleTitle: 'Controller', startDate: new Date('2026-11-10') } }
  it('is empty when nothing happened, so no email goes out', () => {
    expect(buildWeeklyDigest([row({})], now).isEmpty).toBe(true)
  })
  it('lists a status change only inside the granted scope', () => {
    expect(buildWeeklyDigest([row({ source: changed })], now).changes).toHaveLength(0)
    const d = buildWeeklyDigest([row({ scopes: ['status', 'landing_details'], source: changed })], now)
    expect(d.changes[0]).toMatchObject({ label: 'Landed', landing: 'Controller at Acme' })
  })
  it('ignores a change older than a week', () => {
    const old = { ...changed, journeyStageChangedAt: new Date('2026-10-01') }
    expect(buildWeeklyDigest([row({ scopes: ['status'], source: old })], now).changes).toHaveLength(0)
  })
  it('lists due next steps for open stages and counts new candidates', () => {
    const d = buildWeeklyDigest(
      [row({ connectionId: 'a', pipelineStage: 'TALKING', nextStepAt: new Date('2026-11-16') }), row({ connectionId: 'b', pipelineStage: 'PLACED', nextStepAt: new Date('2026-11-01') }), row({ connectionId: 'c', createdAt: new Date('2026-11-15') })],
      now
    )
    expect(d.due.map((x) => x.connectionId)).toEqual(['a'])
    expect(d.newCount).toBe(1)
  })
})

import { parsePilotLines, pilotArm } from '@/lib/recruiter/pilot'

describe('pilot firm list', () => {
  it('reads lines, skips a header, and flags a line with no contact email', () => {
    const r = parsePilotLines('Firm,Website,Email\nHartley Search, hartleysearch.com, Pat@HartleySearch.com\nNo Email Co, noemail.com,\n')
    expect(r.rows).toEqual([{ name: 'Hartley Search', website: 'hartleysearch.com', email: 'pat@hartleysearch.com' }])
    expect(r.errors).toHaveLength(1)
    expect(r.errors[0].message).toMatch(/contact email/)
  })
  it('rejects the same email twice and more than 100 lines', () => {
    expect(parsePilotLines('A, a.com, x@a.com\nB, b.com, X@a.com').errors).toHaveLength(1)
    const many = Array.from({ length: 101 }, (_, i) => `F${i}, f${i}.com, p${i}@f${i}.com`).join('\n')
    expect(parsePilotLines(many).rows).toHaveLength(0)
  })
  it('gives the same arm every time and splits roughly in half', () => {
    expect(pilotArm('Pat@a.com')).toBe(pilotArm('pat@a.com'))
    const a = Array.from({ length: 400 }, (_, i) => pilotArm(`p${i}@f${i}.com`)).filter((x) => x === 'A').length
    expect(a).toBeGreaterThan(150)
    expect(a).toBeLessThan(250)
  })
})

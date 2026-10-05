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

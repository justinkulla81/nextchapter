import { describe, expect, it } from 'vitest'
import {
  buildBridge,
  geoMatch,
  marketTierFor,
  memberGeo,
  relaxedCriterion,
  relevanceLine,
  relevantBeforeFit,
  relocationStates,
  skillsMatch,
  type JobCriteria,
} from '@/lib/jobs/relevance'

const c = (over: Partial<JobCriteria> = {}): JobCriteria => ({ fn: 'own', geo: true, skills: 'strong', industry: true, ...over })

describe('relevant = every criterion', () => {
  it('needs own function, place and skills', () => {
    expect(relevantBeforeFit(c())).toBe(true)
    expect(relevantBeforeFit(c({ fn: 'adjacent' }))).toBe(false)
    expect(relevantBeforeFit(c({ geo: false }))).toBe(false)
    expect(relevantBeforeFit(c({ skills: 'weak' }))).toBe(false)
    expect(relevantBeforeFit(c({ skills: 'unknown' }))).toBe(true)
  })
  it('Wide relaxes exactly one of industry, function, skills — never geography, never two', () => {
    expect(relaxedCriterion(c())).toBeNull()
    expect(relaxedCriterion(c({ industry: false }))).toBe('industry')
    expect(relaxedCriterion(c({ fn: 'adjacent' }))).toBe('function')
    expect(relaxedCriterion(c({ skills: 'weak' }))).toBe('skills')
    expect(relaxedCriterion(c({ geo: false }))).toBe('out')
    expect(relaxedCriterion(c({ industry: false, skills: 'weak' }))).toBe('out')
    expect(relaxedCriterion(c({ fn: 'none' }))).toBe('out')
    expect(relaxedCriterion(c({ skills: 'none' }))).toBe('out')
  })
})

describe('skills criterion', () => {
  const vocab = new Set(['excel', 'workday', 'recruiting', 'sourcing', 'greenhouse', 'lever', 'hris', 'payroll'])
  it('posting skills first: a real overlap, not one word', () => {
    expect(skillsMatch({ jobSkills: ['workday', 'recruiting', 'sql', 'python'], memberVocab: vocab })).toBe('strong')
    expect(skillsMatch({ jobSkills: ['workday', 'sql', 'python', 'java', 'go'], memberVocab: vocab })).toBe('weak')
    expect(skillsMatch({ jobSkills: ['sql'], memberVocab: vocab })).toBe('none')
  })
  it('no posting skills: the occupation fit decides', () => {
    expect(skillsMatch({ jobSkills: [], memberVocab: vocab, occupationBand: 'good' })).toBe('strong')
    expect(skillsMatch({ jobSkills: [], memberVocab: vocab, occupationBand: 'partial' })).toBe('weak')
    expect(skillsMatch({ jobSkills: [], memberVocab: vocab, occupationBand: null })).toBe('unknown')
  })
  it('a member with almost no skills on file: the criterion is not applied', () => {
    expect(skillsMatch({ jobSkills: ['sql'], memberVocab: new Set(['excel']) })).toBe('unknown')
  })
  it('a thin vocabulary: one shared skill is enough, none proves nothing', () => {
    const thin = new Set(['excel', 'workday', 'recruiting'])
    expect(skillsMatch({ jobSkills: ['workday', 'sql', 'python', 'go'], memberVocab: thin })).toBe('strong')
    expect(skillsMatch({ jobSkills: ['sql'], memberVocab: thin })).toBe('unknown')
    expect(skillsMatch({ jobSkills: ['sql'], memberVocab: thin, occupationBand: 'few' })).toBe('none')
  })
})

describe('geography criterion', () => {
  const job = (over: Partial<{ remote: boolean; placeKeys: string[]; states: string[] }> = {}) => ({ remote: false, placeKeys: [], states: [], ...over })
  it('commute area, remote when accepted, or a place they would move to', () => {
    const g = memberGeo({ homeArea: new Set(['CA|sunnyvale', 'CA|san jose']), currentState: 'CA', remotePreference: 'remote' })
    expect(geoMatch(g, job({ placeKeys: ['CA|san jose'], states: ['CA'] }))).toBe(true)
    expect(geoMatch(g, job({ placeKeys: ['CA|los angeles'], states: ['CA'] }))).toBe(false)
    expect(geoMatch(g, job({ remote: true }))).toBe(true)
    const onsite = memberGeo({ homeArea: null, currentState: 'TX', remotePreference: 'onsite' })
    expect(geoMatch(onsite, job({ remote: true }))).toBe(false)
    expect(geoMatch(onsite, job({ states: ['TX'] }))).toBe(true)
  })
  it('reads regions in relocation notes', () => {
    expect(relocationStates('Pacific Northwest only')).toEqual(expect.arrayContaining(['WA', 'OR']))
    const g = memberGeo({ homeArea: null, remotePreference: 'flexible', openToRelocation: true, relocationNotes: 'Pacific Northwest only' })
    expect(geoMatch(g, job({ states: ['WA'] }))).toBe(true)
    expect(geoMatch(g, job({ states: ['NY'] }))).toBe(false)
  })
})

describe('market tiers and the line', () => {
  it('raises the bar with the size of the strict relevant set', () => {
    expect(marketTierFor(90).key).toBe('base')
    expect(marketTierFor(400).key).toBe('higher')
    expect(marketTierFor(4_200).key).toBe('much_higher')
    expect(marketTierFor(12_000).key).toBe('strictest')
  })
  it('says why the list is short', () => {
    expect(relevanceLine({ breadth: 'narrow', relevant: 4200, shown: 120, field: 'Operations', place: null, extras: 0 })).toBe(
      "There are 4,200 Operations roles at your level, so we're only showing the 120 that fit you best."
    )
    expect(relevanceLine({ breadth: 'narrow', relevant: 23, shown: 23, field: 'Recruiting', place: null, extras: 0 })).toMatch(/^23 jobs match you/)
  })
})

describe('bridges', () => {
  it('what transfers, what is missing, one learning and one networking step', () => {
    const b = buildBridge({ relaxed: 'industry', fieldLabel: 'Recruiting and talent acquisition', have: ['Workday', 'Sourcing'], missing: ['Greenhouse'], jobIndustry: 'Healthcare & Hospital Systems', companyName: 'Acme', companyHref: '/dashboard/companies/acme#insiders' })
    expect(b.transfers).toBe('The same work as yours (Recruiting and talent acquisition), with your workday, sourcing.')
    expect(b.missing).toBe('healthcare & hospital systems know-how, greenhouse.')
    expect(b.learn).toEqual({ label: 'Learn greenhouse', href: '/dashboard/learning?q=Greenhouse' })
    expect(b.network).toEqual({ label: 'Who you know at Acme', href: '/dashboard/companies/acme#insiders' })
  })
})

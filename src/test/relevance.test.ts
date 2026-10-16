import { describe, expect, it } from 'vitest'
import {
  buildBridge,
  geoRing,
  industryRelation,
  marketTierFor,
  memberGeo,
  RING_INDEX,
  ringNotes,
  ringOf,
  relevanceLine,
  relocationStates,
  skillsMatch,
  type JobCriteria,
} from '@/lib/jobs/relevance'

const c = (over: Partial<JobCriteria> = {}): JobCriteria => ({ fn: 'own', geo: 0, geoNote: null, skills: 'strong', industry: 'own', industryName: null, ...over })
const at = { strongFit: false, stage: 0 as const }

describe('relevant = every criterion; widening = concentric rings', () => {
  it('ring 0 needs own function, home, skills, own industry and their level', () => {
    expect(ringOf(c(), at)).toBe(0)
    expect(ringOf(c({ skills: 'unknown' }), at)).toBe(0)
    expect(ringOf(c({ skills: 'weak' }), at)).toBeNull()
    expect(ringOf(c({ fn: 'none' }), at)).toBeNull()
    expect(ringOf(c({ geo: null }), at)).toBeNull()
  })
  it('each criterion maps to its ring, in order geography → industry → function → level', () => {
    expect(ringOf(c({ geo: 1 }), at)).toBe(RING_INDEX.within_75)
    expect(ringOf(c({ geo: 3 }), at)).toBe(RING_INDEX.next_states)
    expect(ringOf(c({ industry: 'similar' }), at)).toBe(RING_INDEX.similar_industry)
    expect(ringOf(c({ industry: 'other' }), at)).toBeNull()
    expect(ringOf(c({ industry: 'other' }), { strongFit: true, stage: 0 })).toBe(0)
    expect(ringOf(c({ fn: 'adjacent' }), at)).toBe(RING_INDEX.similar_function)
    expect(ringOf(c(), { strongFit: false, stage: 1 })).toBe(RING_INDEX.level)
    expect(ringOf(c(), { strongFit: false, stage: 2 })).toBeNull()
  })
  it('rings are concentric: a job takes its outermost one', () => {
    expect(ringOf(c({ geo: 2, industry: 'similar' }), at)).toBe(RING_INDEX.similar_industry)
  })
  it('labels say which ring, briefly', () => {
    expect(ringNotes(c({ geo: 1, geoNote: '45 mi away', industry: 'similar', industryName: 'Healthcare' }), { strongFit: false, stageDirection: 'up' })).toEqual([
      'one level up',
      'similar industry: Healthcare',
      '45 mi away',
    ])
  })
  it('similar industries are hand-listed both ways', () => {
    expect(industryRelation(new Set(['Education & EdTech']), 'Nonprofit & Social Impact')).toBe('similar')
    expect(industryRelation(new Set(['Nonprofit & Social Impact']), 'Education & EdTech')).toBe('similar')
    expect(industryRelation(new Set(['Education & EdTech']), 'Insurance')).toBe('other')
    expect(industryRelation(new Set(), 'Insurance')).toBe('own')
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

describe('geography rings', () => {
  const sunnyvale = { lat: 37.3688, lon: -122.0363 }
  const sanJose = { lat: 37.3382, lon: -121.8863 }
  const sacramento = { lat: 38.5816, lon: -121.4944 }
  const losAngeles = { lat: 34.0522, lon: -118.2437 }
  const job = (over: Partial<{ remote: boolean; coords: { lat: number; lon: number }[]; states: string[] }> = {}) => ({ remote: false, coords: [], states: [], ...over })
  const g = memberGeo({ anchor: sunnyvale, currentState: 'CA', remotePreference: 'remote' })
  it('home within 40 mi or remote; 75 mi; elsewhere in the state; next-door states', () => {
    expect(geoRing(g, job({ coords: [sanJose], states: ['CA'] }))).toEqual({ ring: 0, note: null })
    expect(geoRing(g, job({ remote: true }))).toEqual({ ring: 0, note: null })
    expect(geoRing(g, job({ coords: [sacramento], states: ['CA'] }))?.ring).toBe(2)
    expect(geoRing(g, job({ coords: [losAngeles], states: ['CA'] }))).toEqual({ ring: 2, note: 'elsewhere in CA' })
    expect(geoRing(g, job({ states: ['NV'] }))).toEqual({ ring: 3, note: 'in NV, next to CA' })
    expect(geoRing(g, job({ states: ['NY'] }))).toBeNull()
  })
  it('the 75 mi ring says how far', () => {
    const ring = geoRing(memberGeo({ anchor: sunnyvale, currentState: 'CA' }), job({ coords: [{ lat: 37.9577, lon: -121.2908 }], states: ['CA'] }))
    expect(ring?.ring).toBe(1)
    expect(ring?.note).toMatch(/^\d+ mi away$/)
  })
  it('onsite only: no remote; no city: the state is home; relocation regions are the outer ring', () => {
    const onsite = memberGeo({ anchor: null, currentState: 'TX', remotePreference: 'onsite' })
    expect(geoRing(onsite, job({ remote: true }))).toBeNull()
    expect(geoRing(onsite, job({ states: ['TX'] }))?.ring).toBe(0)
    expect(relocationStates('Pacific Northwest only')).toEqual(expect.arrayContaining(['WA', 'OR']))
    const mover = memberGeo({ anchor: null, remotePreference: 'flexible', openToRelocation: true, relocationNotes: 'Pacific Northwest only' })
    expect(geoRing(mover, job({ states: ['WA'] }))).toEqual({ ring: 3, note: "in WA, where you'd move" })
    expect(geoRing(mover, job({ states: ['NY'] }))).toBeNull()
  })
})

describe('market tiers and the line', () => {
  it('raises the bar with the size of the strict relevant set', () => {
    expect(marketTierFor(90).key).toBe('base')
    expect(marketTierFor(400).key).toBe('higher')
    expect(marketTierFor(4_200).key).toBe('much_higher')
    expect(marketTierFor(12_000).key).toBe('strictest')
  })
  it('says when a small market widened on its own', () => {
    expect(relevanceLine({ breadth: 'narrow', relevant: 3, shown: 60, field: 'Operations', place: 'remote', extras: 57, autoWidened: true })).toBe(
      'Only 3 Operations jobs remote fit you on every count right now, so we added 57 worth a look — each says what transfers and how to bridge the gap.'
    )
  })
  it('says why the list is short', () => {
    expect(relevanceLine({ breadth: 'narrow', relevant: 4200, shown: 120, field: 'Operations', place: null, extras: 0 })).toBe(
      "There are 4,200 Operations roles at your level, so we're only showing the 120 that fit you best."
    )
    expect(relevanceLine({ breadth: 'narrow', relevant: 23, shown: 23, field: 'Recruiting', place: null, extras: 0 })).toMatch(/^23 jobs match you/)
  })
})

describe('skills through O*NET tools', () => {
  it('the posting\'s named tools against the member\'s decide first', () => {
    const member = new Set(['tool:salesforce', 'tool:tableau', 'tool:excel'])
    expect(skillsMatch({ jobSkills: [], memberVocab: new Set(), jobSkillIds: ['tool:salesforce', 'tool:tableau', 'tool:sql'], memberSkillIds: member })).toBe('strong')
    expect(skillsMatch({ jobSkills: [], memberVocab: new Set(), jobSkillIds: ['tool:kubernetes', 'tool:terraform'], memberSkillIds: member })).toBe('none')
    expect(skillsMatch({ jobSkills: [], memberVocab: new Set(), jobSkillIds: ['tool:kubernetes', 'tool:tableau', 'tool:go'], memberSkillIds: member })).toBe('weak')
  })
})

describe('bridges', () => {
  it('leave out generic O*NET items', () => {
    const b = buildBridge({ relaxed: 'function', fieldLabel: 'Operations', have: [], missing: ['English language', 'Mathematics'], occupationShared: ['Administration and management', 'Customer and personal service'], companyName: null })
    expect(b.transfers).toBe('Most of the same core skills as your own work (O*NET).')
    expect(b.missing).toMatch(/^Nothing specific/)
  })

  it('what transfers, what is missing, one learning and one networking step', () => {
    const b = buildBridge({ relaxed: 'industry', fieldLabel: 'Recruiting and talent acquisition', have: ['Workday', 'Sourcing'], missing: ['Greenhouse'], jobIndustry: 'Healthcare & Hospital Systems', companyName: 'Acme', companyHref: '/dashboard/companies/acme#insiders' })
    expect(b.transfers).toBe('The same work as yours (Recruiting and talent acquisition), with your workday, sourcing.')
    expect(b.missing).toBe('healthcare & hospital systems know-how, greenhouse.')
    expect(b.learn).toEqual({ label: 'Learn greenhouse', href: '/dashboard/learning?q=Greenhouse' })
    expect(b.network).toEqual({ label: 'Who you know at Acme', href: '/dashboard/companies/acme#insiders' })
  })
})

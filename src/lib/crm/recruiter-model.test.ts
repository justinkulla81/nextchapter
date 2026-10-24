import { describe, expect, it } from 'vitest'
import { readRecruiterModels } from './recruiter-model'

describe('readRecruiterModels', () => {
  it('flags candidate representation and says why', () => {
    const r = readRecruiterModels('We are a reverse recruiting firm that markets senior executives to employers.')
    expect(r.models).toContain('candidate_rep')
    expect(r.evidence).toMatch(/reverse recruit/i)
    expect(readRecruiterModels("I'm representing a CFO candidate who is available now").models).toContain('candidate_rep')
    expect(readRecruiterModels('Executive career agent for VPs and C-suite').models).toContain('candidate_rep')
  })
  it('does not flag ordinary placement language', () => {
    expect(readRecruiterModels('We place exceptional candidates with growth companies.').models).not.toContain('candidate_rep')
    expect(readRecruiterModels('Managing Director, executive search').models).toEqual(['retained_search'])
  })
  it('reads the other models', () => {
    expect(readRecruiterModels('Contingent staffing firm').models).toEqual(['contingent'])
    expect(readRecruiterModels('Head of Talent Acquisition').models).toEqual(['in_house'])
    expect(readRecruiterModels(null)).toEqual({ models: [], evidence: null })
  })
})

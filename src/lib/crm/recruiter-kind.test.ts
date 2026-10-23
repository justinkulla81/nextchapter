import { describe, expect, it } from 'vitest'
import { classifyRecruiter } from './recruiter-kind'

const k = (title: string | null, atSearchFirm: boolean) => classifyRecruiter({ title, atSearchFirm })

describe('classifyRecruiter', () => {
  it('search firm partners and consultants are recruiters', () => {
    expect(k('Managing Partner, Chief Human Resources Practice', true)).toBe('recruiter')
    expect(k('Senior Search Associate', true)).toBe('recruiter')
    expect(k('Consultant', true)).toBe('recruiter')
    expect(k('Office contact, 3D CRO', true)).toBe('recruiter')
  })
  it('support staff are not recruiters, even at a search firm', () => {
    expect(k('Executive Assistant', true)).toBe('support')
    expect(k('Research Associate', true)).toBe('support')
    expect(k('Marketing Manager', true)).toBe('support')
  })
  it('keeps recruiters whose title also names a support-sounding word', () => {
    expect(k('Executive Search Consultant, Operations Practice', true)).toBe('recruiter')
  })
  it('employer talent acquisition is in-house, HR leaders are hr', () => {
    expect(k('Head of Talent Acquisition', false)).toBe('in_house')
    expect(k('Senior Technical Recruiter', false)).toBe('in_house')
    expect(k('Chief Human Resources Officer', false)).toBe('hr')
    expect(k('Human Resources Business Partner', false)).toBe('hr')
  })
  it('does not guess when the title says nothing', () => {
    expect(k('Founder', false)).toBe('unclear')
    expect(k(null, false)).toBe('unclear')
  })
})

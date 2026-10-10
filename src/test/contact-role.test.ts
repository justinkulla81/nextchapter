import { describe, it, expect } from 'vitest'
import { classifyContactRole } from '@/lib/jobs/contact-role'

const role = (contactTitle: string | null, jobTitle = 'Director of Engineering') => classifyContactRole({ contactTitle, jobTitle })

describe('classifyContactRole', () => {
  it('recognises recruiters and talent partners', () => {
    expect(role('Senior Technical Recruiter')).toBe('recruiter')
    expect(role('Talent Acquisition Partner')).toBe('recruiter')
    expect(role('Head of Talent')).toBe('recruiter')
    expect(role('Sourcer')).toBe('recruiter')
  })

  it('does not treat someone who sells recruiting services as a recruiter there', () => {
    expect(role('Account Executive, Recruiting Software')).toBeNull()
    expect(role('Sales Director, Staffing Solutions')).toBeNull()
  })

  it('reads a senior leader in the same function as the likely hiring manager', () => {
    expect(role('VP of Engineering', 'Director of Engineering')).toBe('hiring_manager')
    expect(role('Head of Engineering', 'Engineering Manager')).toBe('hiring_manager')
  })

  it('ignores a leader in a different function, and junior people', () => {
    expect(role('VP of Marketing', 'Director of Engineering')).toBeNull()
    expect(role('Software Engineer', 'Director of Engineering')).toBeNull()
    expect(role(null)).toBeNull()
    // seen in real data: "partner" reads as seniority, but this is an engineer
    expect(role('Sr. Staff Partner Engineer', 'Director of Engineering')).toBeNull()
    expect(role('Director, Partner Engineering', 'Director of Engineering')).toBe('hiring_manager')
  })
})

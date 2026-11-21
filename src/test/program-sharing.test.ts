import { describe, expect, it } from 'vitest'
import { otherSchoolLabel, programVisibleTo } from '@/lib/higher-ed/program-sharing'
import { CMU_TENANT } from '@/lib/higher-ed/demo-tenants/cmu'

describe('programs across a university’s schools', () => {
  const tepperOnly = { school: 'Tepper School of Business', openToOtherSchools: false }
  const tepperOpen = { school: 'Tepper School of Business', openToOtherSchools: true }
  const wholeUniversity = { school: null, openToOtherSchools: false }

  it('shows a school’s own programs to its alumni, and opened ones to everyone', () => {
    expect(programVisibleTo(tepperOnly, 'tepper school of business')).toBe(true)
    expect(programVisibleTo(tepperOnly, 'Heinz College of Information Systems and Public Policy')).toBe(false)
    expect(programVisibleTo(tepperOpen, 'Heinz College of Information Systems and Public Policy')).toBe(true)
    expect(programVisibleTo(wholeUniversity, null)).toBe(true)
    expect(programVisibleTo(tepperOnly, null)).toBe(false)
  })

  it('labels another school’s opened program, not one’s own', () => {
    expect(otherSchoolLabel(tepperOpen, 'Heinz College')).toBe('From Tepper School of Business, open to all alumni')
    expect(otherSchoolLabel(tepperOpen, 'Tepper School of Business')).toBeNull()
    expect(otherSchoolLabel(wholeUniversity, 'Heinz College')).toBeNull()
  })

  it('gives the CMU demo programs from several schools, some opened to all', () => {
    const programs = CMU_TENANT.programs ?? []
    expect(new Set(programs.map((p) => p.school).filter(Boolean)).size).toBeGreaterThanOrEqual(3)
    expect(programs.some((p) => p.school && p.openToOtherSchools)).toBe(true)
    expect(programs.some((p) => p.school && !p.openToOtherSchools)).toBe(true)
  })
})

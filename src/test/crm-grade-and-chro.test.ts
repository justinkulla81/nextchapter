import { describe, expect, it } from 'vitest'
import { nextGrade, targetGrade, mayAutoGrade, OPENINGS_THRESHOLD } from '@/lib/crm/grade-rules'
import { isChroTitle } from '@/lib/crm/chro-titles'

const none = { hasLayoffNotice: false, openNow: 0 }

describe('targetGrade', () => {
  it('A for a layoff notice, even with many openings', () => {
    expect(targetGrade({ hasLayoffNotice: true, openNow: 40 })).toBe('A')
  })
  it('B only above the openings threshold', () => {
    expect(targetGrade({ hasLayoffNotice: false, openNow: OPENINGS_THRESHOLD })).toBe('C')
    expect(targetGrade({ hasLayoffNotice: false, openNow: OPENINGS_THRESHOLD + 1 })).toBe('B')
  })
  it('C with neither signal', () => {
    expect(targetGrade(none)).toBe('C')
  })
})

describe('nextGrade', () => {
  it('grades an ungraded organization', () => {
    expect(nextGrade('UNGRADED', null, none)).toBe('C')
    expect(nextGrade('UNGRADED', null, { hasLayoffNotice: true, openNow: 0 })).toBe('A')
  })
  it('raises a grade the job set, never lowers it', () => {
    expect(nextGrade('C', 'AUTO', { hasLayoffNotice: false, openNow: 9 })).toBe('B')
    expect(nextGrade('B', 'AUTO', { hasLayoffNotice: true, openNow: 0 })).toBe('A')
    expect(nextGrade('A', 'AUTO', none)).toBeNull()
    expect(nextGrade('B', 'AUTO', none)).toBeNull()
  })
  it('leaves a grade set by hand alone, and one with no recorded source', () => {
    expect(nextGrade('C', 'ADMIN', { hasLayoffNotice: true, openNow: 50 })).toBeNull()
    expect(nextGrade('C', null, { hasLayoffNotice: true, openNow: 50 })).toBeNull()
    expect(mayAutoGrade('D', 'ADMIN')).toBe(false)
  })
  it('does nothing when the grade already matches', () => {
    expect(nextGrade('B', 'AUTO', { hasLayoffNotice: false, openNow: 9 })).toBeNull()
  })
})

describe('isChroTitle', () => {
  it.each([
    'Chief Human Resources Officer', 'Chief People Officer', 'CHRO', 'EVP, HR', 'Senior Vice President of Human Resources',
    'Head of People', 'Head of Human Resources', 'General Counsel and Chief People Officer', 'Executive Vice President & Chief People Officer',
  ])('counts %s', (t) => expect(isChroTitle(t)).toBe(true))
  it.each([
    'Head of Talent Acquisition', 'VP Talent Acquisition', 'SVP, Chief People and Culture Officer (former)', 'Fractional Head of People & Talent Acquisition',
    'Head of HR Digital Enablement', 'Head of People Services', 'Managing Director + Co-Head of People, Talent & Legal Practice',
    'Senior Vice President Human Resources - Global LHH RPO & Recruitment Solutions', 'Director of Learning and Development', null, '',
  ])('does not count %s', (t) => expect(isChroTitle(t)).toBe(false))
})

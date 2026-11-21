import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/prisma', () => ({ prisma: {} }))

import { CHECKIN_ANSWERS } from '@/lib/higher-ed/checkins'
import { cleanDetails, DETAIL_FIELDS, functionFromText } from '@/lib/higher-ed/checkin-details'
import { rankPrograms } from '@/lib/higher-ed/checkin-unlocks'

const P = (name: string, extra: Partial<{ summary: string; skills: string[]; credential: string; credentialType: string }> = {}) => ({
  name,
  summary: extra.summary ?? null,
  skills: extra.skills ?? [],
  credential: extra.credential ?? null,
  credentialType: extra.credentialType ?? null,
})

describe('check-in details', () => {
  it('asks something for every answer the email offers', () => {
    for (const a of CHECKIN_ANSWERS) expect(DETAIL_FIELDS[a.key].length).toBeGreaterThan(0)
  })

  it('offers "changing jobs or fields" in place of "starting to look", under the old key', () => {
    expect(CHECKIN_ANSWERS.find((a) => a.key === 'looking')?.label).toBe("I'm looking to change jobs or fields")
  })

  it('keeps only the fields an answer asks for, trimmed and bounded', () => {
    const d = cleanDetails('new_job', { employer: '  Acme  ', title: 'VP', target: 'ignored', distance: 'new' })
    expect(d).toEqual({ employer: 'Acme', title: 'VP' })
    expect(cleanDetails('looking', { distance: 'far' })).toEqual({})
    expect(cleanDetails('looking', { distance: 'adjacent', target: 'x'.repeat(500) }).target).toHaveLength(120)
  })
})

describe('programs for a check-in', () => {
  const mat = P('Master of Arts in Teaching (MAT)', { skills: ['lesson planning', 'curriculum development'], credentialType: 'degree' })
  const cert = P('Graduate Certificate in Professional Writing', { skills: ['grant writing', 'editing'] })
  const lead = P('Leadership as a Daily Challenge', { skills: ['leadership', 'people management'] })

  it('puts the program that teaches the field they want first', () => {
    expect(rankPrograms([cert, lead, mat], 'looking', { target: 'teaching curriculum', distance: 'new' })[0]).toBe(mat)
    expect(rankPrograms([mat, lead, cert], 'back_to_school', { target: 'grant writing' })[0]).toBe(cert)
  })

  it('leans to leadership programs for a new manager', () => {
    expect(rankPrograms([mat, cert, lead], 'new_manager', {})[0]).toBe(lead)
  })

  it('leans to degrees for a whole new field and to certificates for a field next door', () => {
    expect(rankPrograms([cert, mat], 'looking', { distance: 'new' })[0]).toBe(mat)
    expect(rankPrograms([mat, cert], 'looking', { distance: 'adjacent' })[0]).toBe(cert)
  })
})

describe('the field a typed target names', () => {
  it('maps common roles to a member function and leaves fields without one alone', () => {
    expect(functionFromText('product manager')).toBe('Product')
    expect(functionFromText('Data analyst')).toBe('Data & Analytics')
    expect(functionFromText('corporate finance')).toBe('Finance')
    expect(functionFromText('teaching')).toBeNull()
    expect(functionFromText('')).toBeNull()
  })
})

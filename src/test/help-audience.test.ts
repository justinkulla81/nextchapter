// Help & feedback runs in four portals. The audience a form claims only picks
// which session to check, so anything unknown must fall back to the candidate
// portal, and every audience must have its own page for reply links.
import { describe, it, expect } from 'vitest'
import { HELP_AUDIENCES, parseHelpAudience } from '@/lib/help/constants'

describe('parseHelpAudience', () => {
  it.each(['EMPLOYER', 'COACH', 'RECRUITER', 'CANDIDATE'] as const)('keeps %s', (a) => expect(parseHelpAudience(a)).toBe(a))
  it.each(['admin', 'employer', '', null, undefined, 42])('falls back to CANDIDATE for %s', (v) => expect(parseHelpAudience(v)).toBe('CANDIDATE'))
})

describe('HELP_AUDIENCES', () => {
  it('gives each portal its own help page', () => {
    const paths = Object.values(HELP_AUDIENCES).map((a) => a.helpPath)
    expect(new Set(paths).size).toBe(paths.length)
    expect(HELP_AUDIENCES.EMPLOYER.helpPath).toBe('/employer/help')
    expect(HELP_AUDIENCES.COACH.helpPath).toBe('/support/coach/help')
    expect(HELP_AUDIENCES.RECRUITER.helpPath).toBe('/recruiters/help')
  })
})

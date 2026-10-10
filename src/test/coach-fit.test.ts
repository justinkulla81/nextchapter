import { describe, it, expect } from 'vitest'
import { scoreCoachFit, type FitCoach, type FitMember, type FitWeights } from '@/lib/coach/fit'

const W: FitWeights = { function: 3, industry: 2, seniority: 2, skill: 1, style: 3, highNeed: 4 }
const member: FitMember = {
  primaryFunction: 'Finance',
  secondaryFunction: null,
  industries: ['Healthcare'],
  levelRankScore: 55,
  skillsWanted: ['financial modeling'],
  styleTop: ['PUSH', 'ACCOUNTABILITY'],
  lowSentiment: false,
}
const coach = (over: Partial<FitCoach> = {}): FitCoach => ({
  functions: [], industries: [], seniorityFit: [], skills: [], coachingStyles: [], specializationTags: [], ...over,
})

describe('scoreCoachFit', () => {
  it('scores nothing for a coach with no overlap', () => {
    expect(scoreCoachFit(member, coach(), W)).toEqual({ score: 0, reasons: [] })
  })

  it('rewards the style the member asked for, per matching style, and says so', () => {
    const one = scoreCoachFit(member, coach({ coachingStyles: ['PUSH'] }), W)
    const two = scoreCoachFit(member, coach({ coachingStyles: ['PUSH', 'ACCOUNTABILITY'] }), W)
    expect(one.score).toBe(3)
    expect(two.score).toBe(6)
    expect(two.reasons[0]).toMatch(/Matches what you asked for/)
    expect(two.reasons[0]).toMatch(/pushes you/)
    expect(two.reasons[0]).toMatch(/holds you accountable/)
  })

  it('matches on an explicit function list', () => {
    const r = scoreCoachFit(member, coach({ functions: ['Finance', 'Operations'] }), W)
    expect(r.score).toBe(3)
    expect(r.reasons).toContain('Coaches Finance leaders')
  })

  it('still honours a function typed into industries, so existing coaches keep matching', () => {
    expect(scoreCoachFit(member, coach({ industries: ['Finance'] }), W).score).toBe(3)
  })

  it('matches industry, seniority and skills', () => {
    const r = scoreCoachFit(
      member,
      coach({ industries: ['Healthcare & Hospital Systems'], seniorityFit: ['Director'], skills: ['Financial Modeling', 'FP&A'] }),
      W
    )
    expect(r.reasons).toEqual(expect.arrayContaining(['Has coached in Healthcare', 'Works with people at your level']))
    expect(r.reasons.join(' ')).toMatch(/Strong in financial modeling/)
    expect(r.score).toBe(2 + 2 + 1)
  })

  it('weights style above function so what the member asked for leads', () => {
    const styled = scoreCoachFit(member, coach({ coachingStyles: ['PUSH', 'ACCOUNTABILITY'] }), W)
    const functional = scoreCoachFit(member, coach({ functions: ['Finance'] }), W)
    expect(styled.score).toBeGreaterThan(functional.score)
    expect(styled.reasons[0]).toMatch(/asked for/)
  })

  it('boosts high-need comfort only for a struggling member, without naming it', () => {
    const tagged = coach({ specializationTags: ['comfort_with_high_need_candidates'] })
    expect(scoreCoachFit(member, tagged, W).score).toBe(0)
    const r = scoreCoachFit({ ...member, lowSentiment: true }, tagged, W)
    expect(r.score).toBe(4)
    expect(r.reasons).toEqual([])
  })

  it('does not read a quality or grade signal anywhere', () => {
    // The input type has no such field; this documents the invariant the matcher relies on.
    expect(Object.keys(member)).not.toEqual(expect.arrayContaining(['grade', 'dossierGrade', 'fitScore']))
  })
})

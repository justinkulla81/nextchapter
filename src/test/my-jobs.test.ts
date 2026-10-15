import { describe, expect, it } from 'vitest'
import {
  applicationStatus,
  matchClickToApplication,
  myJobsFunnel,
  shouldAskDidYouApply,
  skillsGapInsight,
  skillsGapSentence,
  statusChangeData,
  titlesMatch,
} from '@/lib/jobs/my-jobs'
import type { JobSkillGap } from '@/lib/jobs/job-skill-gap'

const d = (s: string) => new Date(`${s}T12:00:00Z`)
const none = { appliedAt: null, interviewLandedAt: null, offerReceivedAt: null, declinedAt: null }

describe('application status', () => {
  it('reads the furthest stage', () => {
    expect(applicationStatus(null)).toBeNull()
    expect(applicationStatus(none)).toBeNull()
    expect(applicationStatus({ ...none, appliedAt: d('2026-10-01') })).toBe('applied')
    expect(applicationStatus({ ...none, appliedAt: d('2026-10-01'), interviewLandedAt: d('2026-10-05') })).toBe('interviewing')
    expect(applicationStatus({ ...none, appliedAt: d('2026-10-01'), offerReceivedAt: d('2026-10-09') })).toBe('offer')
    expect(applicationStatus({ ...none, appliedAt: d('2026-10-01'), declinedAt: d('2026-10-09') })).toBe('closed')
  })

  it('moves forward filling skipped dates, and back clearing later ones', () => {
    const now = d('2026-10-14')
    const applied = { ...none, appliedAt: d('2026-10-01') }
    expect(statusChangeData(none, 'applied', now)).toEqual({ ...none, appliedAt: now })
    expect(statusChangeData(applied, 'offer', now)).toEqual({ appliedAt: d('2026-10-01'), interviewLandedAt: now, offerReceivedAt: now, declinedAt: null })
    const interviewing = { ...applied, interviewLandedAt: d('2026-10-05') }
    expect(statusChangeData(interviewing, 'applied', now)).toEqual(applied)
    expect(statusChangeData(interviewing, 'closed', now)).toEqual({ ...interviewing, declinedAt: now })
    // Reopening a closed one clears the close.
    expect(statusChangeData({ ...interviewing, declinedAt: d('2026-10-10') }, 'interviewing', now)).toEqual(interviewing)
  })
})

describe('apply click → Gmail application', () => {
  const click = { companyName: 'Acme Corp', title: 'VP, Finance', clickedAt: d('2026-10-01') }
  const app = (over: Partial<{ id: string; companyName: string | null; title: string | null; appliedAt: Date | null }>) => ({
    id: 'a',
    companyName: 'Acme',
    title: null,
    appliedAt: d('2026-10-02'),
    ...over,
  })

  it('matches the same company within 14 days, with or without a title', () => {
    expect(matchClickToApplication(click, [app({})])?.id).toBe('a')
    expect(matchClickToApplication(click, [app({ title: 'Vice President Finance' })])).toBeNull() // different words
    expect(matchClickToApplication(click, [app({ title: 'VP Finance - Remote' })])?.id).toBe('a')
  })

  it('rejects other companies, other roles and dates outside the window', () => {
    expect(matchClickToApplication(click, [app({ companyName: 'Globex' })])).toBeNull()
    expect(matchClickToApplication(click, [app({ title: 'Software Engineer' })])).toBeNull()
    expect(matchClickToApplication(click, [app({ appliedAt: d('2026-10-16') })])).toBeNull()
    expect(matchClickToApplication(click, [app({ appliedAt: d('2026-09-29') })])).toBeNull()
    expect(matchClickToApplication(click, [app({ appliedAt: d('2026-09-30T20:00:00Z'.slice(0, 10)) })])?.id).toBe('a')
    expect(matchClickToApplication({ ...click, companyName: null }, [app({})])).toBeNull()
  })

  it('takes the confirmation nearest the click', () => {
    const m = matchClickToApplication(click, [app({ id: 'late', appliedAt: d('2026-10-10') }), app({ id: 'near', appliedAt: d('2026-10-02') })])
    expect(m?.id).toBe('near')
  })

  it('matches titles by shared words', () => {
    expect(titlesMatch('Senior Director of Marketing', 'Director, Marketing')).toBe(true)
    expect(titlesMatch('Director of Marketing', 'Director of Sales')).toBe(false)
    expect(titlesMatch(null, 'x')).toBe(false)
  })
})

describe('did you apply? prompt timing', () => {
  const base = { lastClickedAt: d('2026-10-10'), applied: false, promptAnswer: null, promptAnsweredAt: null, dismissedAt: null }
  it('waits two days after the click, and stops after three weeks', () => {
    expect(shouldAskDidYouApply(base, d('2026-10-11'))).toBe(false)
    expect(shouldAskDidYouApply(base, d('2026-10-12'))).toBe(true)
    expect(shouldAskDidYouApply(base, d('2026-11-05'))).toBe(false)
  })
  it('never asks once applied, dismissed or answered', () => {
    const now = d('2026-10-13')
    expect(shouldAskDidYouApply({ ...base, applied: true }, now)).toBe(false)
    expect(shouldAskDidYouApply({ ...base, dismissedAt: now }, now)).toBe(false)
    expect(shouldAskDidYouApply({ ...base, promptAnswer: 'not_interested', promptAnsweredAt: now }, now)).toBe(false)
    expect(shouldAskDidYouApply({ ...base, promptAnswer: 'applied', promptAnsweredAt: now }, now)).toBe(false)
    expect(shouldAskDidYouApply({ ...base, lastClickedAt: null }, now)).toBe(false)
  })
  it('asks again five days after "not yet", or after a new click', () => {
    const answered = { ...base, promptAnswer: 'not_yet', promptAnsweredAt: d('2026-10-12') }
    expect(shouldAskDidYouApply(answered, d('2026-10-15'))).toBe(false)
    expect(shouldAskDidYouApply(answered, d('2026-10-17'))).toBe(true)
    expect(shouldAskDidYouApply({ ...answered, lastClickedAt: d('2026-10-13') }, d('2026-10-15'))).toBe(true)
  })
})

describe('funnel', () => {
  it('counts every job that reached each stage', () => {
    const f = myJobsFunnel([
      { clicked: true, application: null },
      { clicked: true, application: { ...none, appliedAt: d('2026-10-01') } },
      { clicked: false, application: { ...none, appliedAt: d('2026-10-01'), interviewLandedAt: d('2026-10-03'), declinedAt: d('2026-10-09') } },
      { clicked: true, application: { ...none, appliedAt: d('2026-10-01'), interviewLandedAt: d('2026-10-03'), offerReceivedAt: d('2026-10-09') } },
    ])
    expect(f).toEqual({ clicked: 3, applied: 3, interviewing: 2, offer: 1 })
  })
})

describe('skills gap insight', () => {
  const gap = (requested: string[], missing: string[]): JobSkillGap => ({
    basis: requested.length >= 2 ? 'posting' : 'none',
    requested,
    have: requested.filter((r) => !missing.includes(r)),
    missing,
    coveragePct: null,
  })
  it('counts jobs asking for each missing skill', () => {
    const insight = skillsGapInsight([
      { id: '1', gap: gap(['sql', 'excel'], ['sql']) },
      { id: '2', gap: gap(['sql', 'tableau'], ['sql', 'tableau']) },
      { id: '3', gap: gap(['sql', 'python'], ['sql']) },
      { id: '4', gap: gap([], []) },
    ])
    expect(insight).toEqual({ jobsWithData: 3, top: [{ skill: 'sql', jobs: 3 }] })
    expect(skillsGapSentence(insight!)).toBe('3 of your 3 saved and applied jobs ask for sql.')
  })
  it('says nothing without a pattern', () => {
    expect(skillsGapInsight([{ id: '1', gap: gap(['sql', 'excel'], ['sql']) }])).toBeNull()
    expect(skillsGapInsight([{ id: '1', gap: gap(['sql', 'excel'], ['sql']) }, { id: '2', gap: gap(['go', 'excel'], ['go']) }])).toBeNull()
  })
})

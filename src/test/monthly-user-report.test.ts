import { describe, it, expect } from 'vitest'
import { isLastDayOfMonth, monthKeyOf, monthWindow, previousMonthKey, trailingMonthKeys, isValidMonthKey } from '@/lib/reports/monthly-user/period'
import { distribution, multiDistribution, relationship, spearman, compareGroups, band } from '@/lib/reports/monthly-user/stats'
import { buildReport } from '@/lib/reports/monthly-user/build'
import { reportToRows } from '@/lib/reports/monthly-user/csv'
import { monthlyReportEmail } from '@/lib/reports/monthly-user/notify'
import type { MemberFacts, ReportInput } from '@/lib/reports/monthly-user/facts'
import { cronSchedules, intervalMinutes } from '@/lib/cron/schedule'

const d = (s: string) => new Date(s)

describe('month helpers', () => {
  it('knows the last day of each kind of month, leap years included', () => {
    expect(isLastDayOfMonth(d('2026-10-31T23:00:00Z'))).toBe(true)
    expect(isLastDayOfMonth(d('2026-10-30T23:00:00Z'))).toBe(false)
    expect(isLastDayOfMonth(d('2026-11-30T23:00:00Z'))).toBe(true)
    expect(isLastDayOfMonth(d('2026-02-28T23:00:00Z'))).toBe(true)
    expect(isLastDayOfMonth(d('2028-02-28T23:00:00Z'))).toBe(false)
    expect(isLastDayOfMonth(d('2028-02-29T23:00:00Z'))).toBe(true)
    expect(isLastDayOfMonth(d('2026-12-31T23:00:00Z'))).toBe(true)
  })
  it('builds a half-open window and walks months backward across years', () => {
    const w = monthWindow('2026-10')
    expect(w.start.toISOString()).toBe('2026-10-01T00:00:00.000Z')
    expect(w.end.toISOString()).toBe('2026-11-01T00:00:00.000Z')
    expect(w.label).toBe('October 2026')
    expect(previousMonthKey('2026-01')).toBe('2025-12')
    expect(trailingMonthKeys('2026-02', 3)).toEqual(['2025-12', '2026-01', '2026-02'])
    expect(monthKeyOf(d('2026-12-31T23:59:59Z'))).toBe('2026-12')
  })
  it('rejects malformed month keys', () => {
    expect(isValidMonthKey('2026-13')).toBe(false)
    expect(isValidMonthKey('2026-1')).toBe(false)
    expect(() => monthWindow('nope')).toThrow()
  })
})

describe('small-cell suppression', () => {
  it('never shows a group under 5 members', () => {
    const values = [...Array(6).fill('Boston'), ...Array(4).fill('Austin'), 'Reno']
    const r = distribution(values)
    expect(r.rows.map((x) => x.label)).toEqual(['Boston'])
    expect(r.hiddenGroups).toBe(2)
    expect(r.n).toBe(11)
  })
  it('counts a member once per answer in a multi-select', () => {
    const r = multiDistribution([...Array(5).fill(['a', 'a', 'b']), ['b']])
    expect(r.rows.find((x) => x.label === 'a')?.count).toBe(5)
    expect(r.rows.find((x) => x.label === 'b')?.count).toBe(6)
  })
  it('drops small comparison groups', () => {
    const people = [...Array(5).fill({ g: 'x', v: 1 }), ...Array(2).fill({ g: 'y', v: 1 })]
    const c = compareGroups(people, (p) => p.g, [{ key: 'n', label: 'n', unit: 'count', compute: (g) => g.length }])
    expect(c.rows.map((r) => r.label)).toEqual(['x'])
    expect(c.hiddenGroups).toBe(1)
  })
})

describe('correlation', () => {
  it('finds a perfect monotone relationship and ignores a flat one', () => {
    const xs = Array.from({ length: 40 }, (_, i) => i)
    expect(spearman(xs, xs.map((x) => x * x))).toBe(1)
    expect(spearman(xs, xs.map((x) => -x))).toBe(-1)
    expect(spearman(xs, xs.map(() => 3))).toBeNull()
  })
  it('refuses to report a correlation on fewer than 30 members', () => {
    const r = relationship('a', 'b', Array.from({ length: 29 }, (_, i) => [i, i] as [number, number]))
    expect(r.strength).toBe('insufficient')
    expect(r.rho).toBeNull()
    expect(relationship('a', 'b', Array.from({ length: 30 }, (_, i) => [i, i] as [number, number])).strength).toBe('strong')
  })
  it('bands values', () => {
    expect(band(3, [{ max: 4, label: 'low' }], 'high')).toBe('low')
    expect(band(9, [{ max: 4, label: 'low' }], 'high')).toBe('high')
    expect(band(null, [{ max: 4, label: 'low' }], 'high')).toBeNull()
  })
})

function member(i: number, over: Partial<MemberFacts> = {}): MemberFacts {
  return {
    id: `m${i}`, registeredAt: d('2026-08-15T00:00:00Z'),
    seniority: i % 2 ? 'SENIOR' : 'MID', yearsExperience: 12, education: 'MBA', schools: ['Stanford'], fieldsOfStudy: [],
    ageBand: null, state: 'CA', country: 'US', metro: 'San Francisco', fn: 'Finance', industry: 'Software',
    currentEmployers: [], formerEmployers: ['Acme'], jobStatus: 'LAID_OFF', journey: null, leadSource: 'LINKEDIN', trajectory: null, isPivoting: false,
    targetRoleType: null, targetFunction: null, targetIndustries: [], remotePreference: null, openToRelocation: true, willingToStartLower: false,
    interimInterest: false, targetCompanySize: null, targetCompanyStage: null, targetCompMin: 180000, applicationVolumeGoal: 5, outreachTargetPerWeek: 3,
    searchIntensity: 'ACTIVELY_SEARCHING', searchIntensityScore: 70, changeReadiness: null, gapDuration: null, confidential: false,
    motivations: [], blockers: [], barriers: [], networkingConcerns: [], connectPreferences: [], strengths: [], growthAreas: [], skillsToBuild: [],
    coachingStylePreference: null, changePace: null, topCoachingStyles: [], notificationTier: null, networkComfort: null, disclosureComfort: null,
    networkingLevel: 2, storyComfort: 3, interviewComfort: 3, pitchReady: 3, negotiationComfort: 3, hasCoach: i % 3 === 0,
    resumeUploaded: true, resumeStepComplete: true, assessmentComplete: true, contractAccepted: true, trackRecordDone: false, whatINeedDone: false,
    skillsAssessmentDone: false, strategyConfirmed: true, referencesRequested: 1, referencesCompleted: 0, recruiterOptIn: false, resumeBookOptIn: false,
    leaderboardOptIn: false, grade: 'B', composite: 70, components: { experience: 70, resume: 70, evidence: 70, effort: 70, market: 70 },
    currentStreak: 2, membershipPlan: null, membershipStatus: null, contactsTotal: 10,
    logins: [d('2026-10-05T00:00:00Z')],
    applications: [{ channel: i % 2 ? 'REFERRAL' : 'COLD_APPLICATION', company: 'Globex', createdAt: d('2026-10-03T00:00:00Z'), appliedAt: d('2026-10-04T00:00:00Z'), interviewAt: i % 4 === 0 ? d('2026-10-20T00:00:00Z') : null, offerAt: null, declinedAt: null }],
    outreach: [{ at: d('2026-10-06T00:00:00Z'), channel: 'EMAIL' }], linkedinPosts: [], communityPosts: [], checkIns: [{ at: d('2026-10-07T00:00:00Z'), mood: 'MOVING' }],
    sprintWeeks: [], courses: [], coachSessions: [], contactsAdded: [], referenceRequests: [], referenceCompletions: [], hires: [],
    recruiterIntros: [], recruiterSubmissions: [], recruiterPlacements: [], gradeFirst: null, gradeLast: null,
    ...over,
  }
}

describe('buildReport', () => {
  const current = monthWindow('2026-10')
  const prior = monthWindow('2026-09')
  const run = (members: MemberFacts[]) =>
    buildReport({ input: { members, waitlistSignups: 0, waitlistSignupsPrior: 0 } satisfies ReportInput, current, prior, storedPriorKpis: {}, now: d('2026-10-31T23:00:00Z') })

  it('counts only members registered before the month ends, and flags new ones', () => {
    const members = [...Array.from({ length: 40 }, (_, i) => member(i)), member(100, { registeredAt: d('2026-10-10T00:00:00Z') }), member(101, { registeredAt: d('2026-11-02T00:00:00Z') })]
    const r = run(members)
    expect(r.memberCount).toBe(41)
    expect(r.headline.find((k) => k.key === 'new_members')?.value).toBe(1)
    expect(r.headline.find((k) => k.key === 'members')?.prior).toBe(40)
  })

  it('computes interview rate among applicants and compares with the prior month', () => {
    const r = run(Array.from({ length: 40 }, (_, i) => member(i)))
    expect(r.headline.find((k) => k.key === 'interview_rate')?.value).toBe(25)
    expect(r.headline.find((k) => k.key === 'applications')?.value).toBe(40)
    // Applied on 2026-10-04 only, so nothing falls in September.
    expect(r.headline.find((k) => k.key === 'applications')?.prior).toBe(0)
  })

  it('shows channel conversion and warm-vs-cold comparisons', () => {
    const r = run(Array.from({ length: 40 }, (_, i) => member(i)))
    const activity = r.sections.find((s) => s.id === 'activity')!
    const channels = activity.blocks.find((b) => b.kind === 'comparison')!
    expect(channels.kind === 'comparison' && channels.rows.map((x) => x.label).sort()).toEqual(['Cold application', 'Referral'])
  })

  it('hides everything when the membership is too small, and never leaks a count under 5', () => {
    const r = run(Array.from({ length: 4 }, (_, i) => member(i)))
    for (const s of r.sections) for (const b of s.blocks) {
      if (b.kind === 'distribution') expect(b.dist.rows).toEqual([])
      if (b.kind === 'comparison') expect(b.rows).toEqual([])
      if (b.kind === 'relationships') expect(b.rows.every((x) => x.rho === null)).toBe(true)
    }
  })

  it('stores no member ids or free text anywhere in the report', () => {
    const json = JSON.stringify(run(Array.from({ length: 40 }, (_, i) => member(i, { id: `secret-id-${i}` }))))
    expect(json).not.toContain('secret-id-')
  })

  it('produces CSV rows and an email from the same data', () => {
    const r = { ...run(Array.from({ length: 40 }, (_, i) => member(i))), trend: [] }
    expect(reportToRows(r).length).toBeGreaterThan(50)
    const mail = monthlyReportEmail(r)
    expect(mail.subject).toContain('October 2026')
    expect(mail.html).toContain('monthly-report?month=2026-10')
  })
})

describe('cron schedule', () => {
  it('runs on the 28th to the 31st and is judged on a monthly cadence', () => {
    const job = cronSchedules().find((j) => j.job === 'monthly-user-report')!
    expect(job.schedule).toBe('0 23 28-31 * *')
    expect(intervalMinutes(job.schedule)).toBe(31 * 1440)
    expect(job.maxGapMinutes).toBeGreaterThan(60 * 1440)
  })
})

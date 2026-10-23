import { describe, expect, it } from 'vitest'
import { checklistDone, checklistState, clampExcitement, externalJobId, followUpLine, followUpState, noteKeysFor, parseChecklist, parseFollowUpDate, suggestedFollowUp } from '@/lib/jobs/tracker'
import { applicationAnalytics, gotReply, type AnalyticsApplication } from '@/lib/jobs/application-analytics'

const now = new Date('2026-10-23T15:00:00Z')

describe('tracker fields', () => {
  it('keeps only known checklist keys with dates; applied comes from the status', () => {
    const c = parseChecklist({ resume_tailored: '2026-10-20T00:00:00Z', applied: '2026-10-20T00:00:00Z', junk: 'x', cover_note: 'not a date' })
    expect(c).toEqual({ resume_tailored: '2026-10-20T00:00:00Z' })
    expect(parseChecklist('nonsense')).toEqual({})
    expect(checklistState(c, 'saved').applied).toBe(false)
    expect(checklistState(c, 'interviewing').applied).toBe(true)
    expect(checklistDone(c, 'applied')).toEqual({ done: 2, total: 5 })
  })

  it('clamps excitement to 1-5', () => {
    expect(clampExcitement(3)).toBe(3)
    expect(clampExcitement('5')).toBe(5)
    expect(clampExcitement(0)).toBeNull()
    expect(clampExcitement(9)).toBeNull()
    expect(clampExcitement(null)).toBeNull()
  })

  it('reads follow-up dates and says when they are due', () => {
    expect(parseFollowUpDate('2026-10-30')?.toISOString()).toBe('2026-10-30T12:00:00.000Z')
    expect(parseFollowUpDate('Oct 30')).toBeNull()
    const today = parseFollowUpDate('2026-10-23')!
    const later = parseFollowUpDate('2026-10-30')!
    const past = parseFollowUpDate('2026-10-20')!
    expect(followUpState(today, null, now)).toBe('due')
    expect(followUpState(later, null, now)).toBe('upcoming')
    expect(followUpState(past, now, now)).toBe('done')
    expect(followUpLine(today, null, now)).toBe('Follow up today')
    expect(followUpLine(later, null, now)).toBe('Follow up by Oct 30')
    expect(followUpLine(past, null, now)).toBe('Follow-up overdue since Oct 20')
    expect(followUpLine(past, now, now)).toBeNull()
    expect(suggestedFollowUp('applied', new Date('2026-10-20T12:00:00Z'))?.toISOString()).toBe('2026-10-27T12:00:00.000Z')
    expect(suggestedFollowUp('saved', now)).toBeNull()
  })

  it('finds a note written before a Gmail application linked to a board job', () => {
    expect(noteKeysFor({ key: 'job_board:j1', jobPostingId: 'a1' })).toEqual(['job_board:j1', 'application:a1', 'posting:a1'])
    expect(noteKeysFor({ key: 'surfaced:s1', jobPostingId: null })).toEqual(['surfaced:s1'])
  })

  it('gives a job saved from another site a stable id', () => {
    expect(externalJobId('https://Jobs.Example.com/123/')).toBe(externalJobId('https://jobs.example.com/123#apply'))
    expect(externalJobId('https://jobs.example.com/123')).not.toBe(externalJobId('https://jobs.example.com/124'))
    expect(externalJobId('https://x.example')).toMatch(/^[0-9a-f]{16}$/)
  })
})

describe('applicationAnalytics', () => {
  const a = (title: string, days: number, p: Partial<AnalyticsApplication> = {}): AnalyticsApplication => ({
    title, appliedAt: new Date(now.getTime() - days * 86_400_000), interviewLandedAt: null, offerReceivedAt: null, declinedAt: null, declinedBy: null, ...p,
  })

  it('counts a rejection from the employer as a reply, but not the member passing', () => {
    expect(gotReply(a('x', 1, { declinedAt: now, declinedBy: 'COMPANY' }))).toBe(true)
    expect(gotReply(a('x', 1, { declinedAt: now, declinedBy: 'CANDIDATE' }))).toBe(false)
  })

  it('gives reply, interview and offer rates, and rates by function and level', () => {
    const apps = [
      a('Director of Finance', 2, { interviewLandedAt: now }),
      a('Finance Director', 5, { declinedAt: now, declinedBy: 'COMPANY' }),
      a('Controller', 10),
      a('VP Marketing', 20, { interviewLandedAt: now, offerReceivedAt: now }),
      a('Marketing Director', 40),
      { ...a('ignored', 1), appliedAt: null },
    ]
    const r = applicationAnalytics(apps, now)
    expect(r).toMatchObject({ applied: 5, appliedLast7: 2, appliedLast30: 4, replied: 3, interviews: 2, offers: 1, replyRate: 60, interviewRate: 40, offerRate: 50 })
    const finance = r.byFunction.find((x) => x.label === 'Finance')
    expect(finance).toMatchObject({ applied: 3, replied: 2, replyRate: 67 })
    expect(r.byLevel.find((x) => x.label === 'Director')).toMatchObject({ applied: 3 })
  })

  it('holds back rates until there are enough applications', () => {
    const r = applicationAnalytics([a('Controller', 1, { interviewLandedAt: now })], now)
    expect(r.replyRate).toBeNull()
    expect(r.byFunction).toEqual([])
  })
})

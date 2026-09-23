import { describe, it, expect } from 'vitest'
import { diagnoseSearch, titleFamily, type DiagnosisInput, type DiagnosisApplication } from '@/lib/reports/search-diagnosis'

const now = new Date('2026-09-23T12:00:00Z')
const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000)
const app = (title: string, company: string, ago: number, extra: Partial<DiagnosisApplication> = {}): DiagnosisApplication => ({
  title, companyName: company, location: null, channel: null, appliedAt: daysAgo(ago), interviewAt: null, rejectedAt: null, ...extra,
})
const base = (over: Partial<DiagnosisInput> = {}): DiagnosisInput => ({
  now, applications: [], events: [], outreachLast28: 0, outreachPrior28: 0, weeklyGoal: 5,
  targetRole: null, targetFunction: null, levelRankScore: null, remotePreference: null, openToRelocation: true, homeMetro: null, ...over,
})
const check = (d: ReturnType<typeof diagnoseSearch>, key: string) => d.checks.find((c) => c.key === key)

describe('titleFamily', () => {
  it('places executive titles', () => {
    expect(titleFamily('Chief Financial Officer')).toBe('Finance leadership')
    expect(titleFamily('Head of Corporate Development')).toBe('Corporate development & strategy')
    expect(titleFamily('Investment Director')).toBe('Investing')
    expect(titleFamily(null)).toBeNull()
  })
})

describe('diagnoseSearch', () => {
  it('flags applications that do not match the stated target', () => {
    const apps = Array.from({ length: 10 }, (_, i) => app('Director of Corporate Development', `Co${i}`, 10 + i))
    const d = diagnoseSearch(base({ applications: apps, targetRole: 'CFO', outreachLast28: 30 }))
    expect(check(d, 'titles')?.verdict).toBe('act')
    expect(d.ideas.length).toBeGreaterThan(0)
  })

  it('says no networking is the problem when there is none', () => {
    const apps = Array.from({ length: 8 }, (_, i) => app('CFO', `Co${i}`, 5 + i))
    expect(check(diagnoseSearch(base({ applications: apps })), 'networking')?.verdict).toBe('act')
  })

  it('matches a rejection email to its application by company', () => {
    const apps = Array.from({ length: 6 }, (_, i) => app('CFO', `Company ${i}`, 30))
    const d = diagnoseSearch(base({
      applications: apps, outreachLast28: 20,
      events: [{ type: 'REJECTION', companyName: 'Company 0', at: daysAgo(29) }],
    }))
    expect(d.totals.rejections).toBe(1)
    expect(d.totals.noReplyYet).toBe(5)
    expect(check(d, 'fast-rejections')).toBeUndefined() // needs 3+ timed rejections
  })

  it('reports not enough data instead of guessing', () => {
    const d = diagnoseSearch(base({ applications: [app('CFO', 'A', 3)] }))
    expect(check(d, 'response')?.verdict).toBe('unknown')
    expect(check(d, 'breadth')?.verdict).toBe('unknown')
  })

  it('treats many cold applications with no replies as spray-and-pray', () => {
    const apps = Array.from({ length: 60 }, (_, i) => app('CFO', `Co${i}`, i % 28))
    expect(check(diagnoseSearch(base({ applications: apps, outreachLast28: 200 })), 'volume')?.verdict).toBe('act')
  })
})

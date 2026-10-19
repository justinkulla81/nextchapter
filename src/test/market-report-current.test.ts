import { describe, it, expect } from 'vitest'
import {
  REGEN_COOLDOWN_MINUTES,
  REGEN_MAX_PER_DAY,
  buildCurrentRead,
  improvementReasons,
  regenerationDecision,
  type ImprovementSignals,
} from '@/lib/reports/market-reality-brief/current-report'
import type { HiringReason } from '@/lib/reports/market-reality-brief/hiring-case'
import type { LaunchStep } from '@/lib/reports/market-reality-brief/launchpad'
import type { Objection } from '@/lib/reports/market-reality-brief/evaluators'

const NOW = new Date('2026-10-19T12:00:00Z')
const ago = (mins: number) => new Date(NOW.getTime() - mins * 60_000)
const none: ImprovementSignals = { resumeUploadedAt: null, searchStrategyConfirmedAt: null, applicationsSince: 0, referencesSince: 0 }

describe('improvementReasons', () => {
  it('is a first report when none exists', () => {
    expect(improvementReasons(null, none)).toEqual(['first_report'])
  })
  it('lists what changed after the last report, and nothing else', () => {
    const last = ago(600)
    expect(improvementReasons(last, none)).toEqual([])
    expect(improvementReasons(last, { ...none, resumeUploadedAt: ago(10) })).toEqual(['resume_updated'])
    expect(improvementReasons(last, { ...none, resumeUploadedAt: ago(700) })).toEqual([])
    expect(improvementReasons(last, { resumeUploadedAt: ago(10), searchStrategyConfirmedAt: ago(5), applicationsSince: 2, referencesSince: 1 })).toEqual([
      'resume_updated',
      'search_details_updated',
      'applied_to_jobs',
      'references_added',
    ])
  })
})

describe('regenerationDecision', () => {
  const base = { now: NOW, generatedLast24h: 1 }
  it('always allows the first report', () => {
    const d = regenerationDecision({ ...base, lastGeneratedAt: null, generatedLast24h: 0, signals: none })
    expect(d.allowed).toBe(true)
    expect(d.reason).toBe('first_report')
  })
  it('explains and blocks when nothing new has happened', () => {
    const d = regenerationDecision({ ...base, lastGeneratedAt: ago(600), signals: none })
    expect(d.allowed).toBe(false)
    expect(d.blockedBy).toBe('nothing_new')
    expect(d.message).toMatch(/update your resume/i)
  })
  it('allows after an improvement, and records why', () => {
    const d = regenerationDecision({ ...base, lastGeneratedAt: ago(600), signals: { ...none, applicationsSince: 3 } })
    expect(d.allowed).toBe(true)
    expect(d.reason).toBe('applied_to_jobs')
    expect(d.message).toContain('you applied to jobs')
  })
  it('holds a cooldown between two refreshes and says when it ends', () => {
    const d = regenerationDecision({ ...base, lastGeneratedAt: ago(REGEN_COOLDOWN_MINUTES - 10), signals: { ...none, applicationsSince: 3 } })
    expect(d.allowed).toBe(false)
    expect(d.blockedBy).toBe('too_soon')
    expect(d.availableAt!.getTime()).toBe(NOW.getTime() + 10 * 60_000)
    expect(d.message).toContain('10 minutes')
  })
  it('caps refreshes in a day', () => {
    const d = regenerationDecision({
      ...base,
      lastGeneratedAt: ago(120),
      generatedLast24h: REGEN_MAX_PER_DAY,
      oldestOfLast24h: ago(20 * 60),
      signals: { ...none, resumeUploadedAt: ago(30) },
    })
    expect(d.allowed).toBe(false)
    expect(d.blockedBy).toBe('daily_limit')
    expect(d.availableAt!.getTime()).toBe(ago(20 * 60).getTime() + 24 * 3_600_000)
    expect(d.message).toContain('4 hours')
  })
})

const reason = (over: Partial<HiringReason>): HiringReason => ({
  key: 'k',
  reason: 'get results you can size with numbers',
  status: 'in_place',
  seen: 'Your resume sizes 6 of 8 results.',
  next: 'Lead with it.',
  tool: 'Resume',
  href: '/dashboard/resume',
  minutes: null,
  ...over,
})
const step = (over: Partial<LaunchStep>): LaunchStep => ({ key: 's', phase: 'today', title: 'Do it', because: 'Because', tool: 'Resume', href: '/x', minutes: 5, area: 'Resume', done: false, lockedNote: null, ...over })
const objection = (severity: 1 | 2 | 3, question: string): Objection => ({ key: question, question, answer: `Answer to ${question}`, source: 'Experience', severity })

describe('buildCurrentRead', () => {
  it('states the count of what is in place, with the fact it rests on', () => {
    const read = buildCurrentRead({
      hiringCase: [reason({ key: 'a' }), reason({ key: 'b' }), reason({ key: 'c', status: 'missing', seen: 'No references yet.', next: 'Ask two former managers.' })],
      market: { openRoles: 1240, targetLabel: 'Director of Operations', trend: '+8%' },
      launchpad: [step({ key: '1', done: true }), step({ key: '2' })],
      objections: [objection(1, 'low'), objection(3, 'high'), objection(2, 'mid'), objection(3, 'high2')],
    })
    expect(read.headline).toBe('2 of the 3 things employers hire for are already in place.')
    expect(read.because).toContain('1 more can be added')
    expect(read.inPlace).toHaveLength(2)
    expect(read.inPlace[0].next).toBeNull()
    expect(read.toBuild[0]).toMatchObject({ status: 'Next to build', fact: 'No references yet.', next: 'Ask two former managers.' })
    expect(read.market?.line).toBe('1,240 open roles fit Director of Operations, and the market is +8%.')
    expect(read.steps.map((s) => s.key)).toEqual(['2'])
    expect(read.doneSteps).toBe(1)
    expect(read.questions.map((q) => q.question)).toEqual(['high', 'high2', 'mid'])
  })

  it('stays positive with nothing in place and with nothing on file', () => {
    const started = buildCurrentRead({ hiringCase: [reason({ status: 'unknown' }), reason({ status: 'missing' })], market: null, launchpad: [], objections: [] })
    expect(started.headline).toMatch(/starts here/)
    expect(started.market).toBeNull()
    const empty = buildCurrentRead({ hiringCase: [], market: null, launchpad: [], objections: [] })
    expect(empty.headline).toMatch(/fills in/)
  })

  it('never uses a letter grade or a verdict label', () => {
    const read = buildCurrentRead({
      hiringCase: (['in_place', 'issue', 'missing', 'unknown'] as const).map((status) => reason({ status, key: status })),
      market: null,
      launchpad: [],
      objections: [],
    })
    expect(JSON.stringify(read)).not.toMatch(/likely to pause|advance with reservations|development area|grade/i)
    expect(read.inPlace.concat(read.toBuild).map((r) => r.status)).toEqual(['In place', 'Ready to improve', 'Next to build', 'Answer to count it'])
  })
})

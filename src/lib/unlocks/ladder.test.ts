import { describe, expect, it } from 'vitest'
import { buildUnlockLadder, candidatePlusSteps, nextRung } from './ladder'
import type { DossierCompleteness, DossierUnlockStatus } from '@/lib/scoring/dossier-unlock'

const completeness: DossierCompleteness = { requirements: [], metCount: 0, totalCount: 7, isComplete: false }
const status = (over: Partial<DossierUnlockStatus> = {}): DossierUnlockStatus => ({
  unlocked: false,
  referencesMet: false,
  evidenceMet: true,
  effortMet: false,
  minutesMet: false,
  effortMinutes: 330,
  effortTarget: 480,
  alternatePath: { met: false, gradeMet: false, streakMet: false, reason: 'not yet met' },
  completedReferenceCount: 2,
  outreachCount: 2,
  applicationCount: 3,
  reason: '',
  unlockedAt: null,
  unlockSource: null,
  revoked: false,
  ...over,
})
const gates = (_unused: boolean, b: boolean) => [
  { key: 'community', label: '', unlocked: b, reason: '' },
]

describe('buildUnlockLadder', () => {
  it('marks exactly one rung next and the rest locked', () => {
    const l = buildUnlockLadder({ gates: gates(true, true), tier: 'PREVIEW', completeness, status: status() })
    expect(l.map((r) => r.state)).toEqual(['open', 'open', 'next', 'locked', 'locked'])
    expect(nextRung(l)?.key).toBe('candidatePlus')
  })
  it('lists what Candidate+ still needs, effort first, and never references', () => {
    const l = buildUnlockLadder({ gates: gates(true, true), tier: 'PREVIEW', completeness, status: status() })
    expect(nextRung(l)?.needs).toEqual(['150 more minutes of search effort', '3 more outreach or networking messages', '2 more applications'])
  })
  it('needs an assessment when none is done', () => {
    const l = buildUnlockLadder({ gates: gates(true, true), tier: 'PREVIEW', completeness, status: status({ evidenceMet: false }) })
    expect(nextRung(l)?.needs).toContain('one assessment')
  })
  it('has no rung that gates jobs: the first rung is Community and never mentions job detail', () => {
    const l = buildUnlockLadder({ gates: gates(false, false), tier: 'LOCKED', completeness, status: status() })
    expect(l[0].key).toBe('community')
    expect(l[0].needs).toEqual(['one thing finished in your plan'])
    expect(JSON.stringify(l)).not.toMatch(/job detail|matched jobs|exclusive|A-List/i)
  })
  it('opens Candidate+ when the gate says unlocked', () => {
    const l = buildUnlockLadder({ gates: gates(true, true), tier: 'COMPLETE', completeness, status: status({ unlocked: true }) })
    expect(l[2].state).toBe('open')
  })
})

describe('candidatePlusSteps', () => {
  it('lists exactly what is left for Candidate+, in ladder order, each with a place to do it', () => {
    const steps = candidatePlusSteps(status())
    expect(steps.map((s) => s.key)).toEqual(['minutes', 'outreach', 'applications'])
    expect(steps[0]).toMatchObject({ need: '150 more minutes of search effort', href: '/dashboard/sprint' })
  })
  it('is empty once Candidate+ is on', () => {
    expect(candidatePlusSteps(status({ unlocked: true }))).toEqual([])
  })
})

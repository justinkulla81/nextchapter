import { describe, expect, it } from 'vitest'
import { buildUnlockLadder, nextRung } from './ladder'
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
  ...over,
})
const gates = (a: boolean, b: boolean) => [
  { key: 'matchedJobsFullDetail', label: '', unlocked: a, reason: '' },
  { key: 'community', label: '', unlocked: b, reason: '' },
]

describe('buildUnlockLadder', () => {
  it('marks exactly one rung next and the rest locked', () => {
    const l = buildUnlockLadder({ gates: gates(true, true), tier: 'PREVIEW', completeness, status: status() })
    expect(l.map((r) => r.state)).toEqual(['open', 'open', 'next', 'locked', 'locked'])
    expect(nextRung(l)?.key).toBe('candidatePlus')
  })
  it('lists what Candidate+ still needs, effort first', () => {
    const l = buildUnlockLadder({ gates: gates(true, true), tier: 'PREVIEW', completeness, status: status() })
    expect(nextRung(l)?.needs).toEqual(['150 more minutes of search effort', '1 more reference', '3 more messages', '2 more applications'])
  })
  it('opens Candidate+ when the gate says unlocked', () => {
    const l = buildUnlockLadder({ gates: gates(true, true), tier: 'COMPLETE', completeness, status: status({ unlocked: true }) })
    expect(l[2].state).toBe('open')
  })
})

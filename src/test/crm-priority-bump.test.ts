import { describe, it, expect } from 'vitest'
import { emailPriorityFloor, nextAutoPriority } from '@/lib/crm/priority-bump'

const d = (s: string) => new Date(s)

describe('emailPriorityFloor', () => {
  it('needs a two-way exchange', () => {
    expect(emailPriorityFloor({ inbound: 0, outbound: 4, recent: 4 })).toBeNull()
    expect(emailPriorityFloor({ inbound: 3, outbound: 0, recent: 3 })).toBeNull()
  })
  it('is P1 for an exchange and P0 for a lot of recent email', () => {
    expect(emailPriorityFloor({ inbound: 1, outbound: 1, recent: 2 })).toBe('P1')
    expect(emailPriorityFloor({ inbound: 2, outbound: 3, recent: 5 })).toBe('P0')
  })
})

describe('nextAutoPriority', () => {
  const base = { priorityAutoAt: null, priorityManualAt: null }
  it('raises, never lowers', () => {
    expect(nextAutoPriority({ ...base, priority: 'P2', floor: 'P1' })).toBe('P1')
    expect(nextAutoPriority({ ...base, priority: null, floor: 'P1' })).toBe('P1')
    expect(nextAutoPriority({ ...base, priority: 'P0', floor: 'P1' })).toBeNull()
    expect(nextAutoPriority({ ...base, priority: 'P1', floor: 'P1' })).toBeNull()
  })
  it('lets a manual lowering after an automatic bump stand', () => {
    const p = { priority: 'P1' as const, priorityAutoAt: d('2026-10-01'), priorityManualAt: d('2026-10-02'), floor: 'P0' as const }
    expect(nextAutoPriority(p)).toBeNull()
  })
  it('keeps going once the bump is newer than the last manual choice', () => {
    const p = { priority: 'P2' as const, priorityAutoAt: d('2026-10-03'), priorityManualAt: d('2026-10-02'), floor: 'P1' as const }
    expect(nextAutoPriority(p)).toBe('P1')
  })
  it('does not treat a manual choice made before any bump as a block', () => {
    const p = { priority: 'P2' as const, priorityAutoAt: null, priorityManualAt: d('2026-10-02'), floor: 'P1' as const }
    expect(nextAutoPriority(p)).toBe('P1')
  })
})

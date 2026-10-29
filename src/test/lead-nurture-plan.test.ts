import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { ledgerRefs, pickLeadPerAddress, planNurture, type PlanInput } from '@/lib/leads/nurture/plan'
import { nurtureRef } from '@/lib/leads/nurture/config'
import { NO_FACTS } from '@/lib/leads/nurture/content'
import { classifyLead, type NurtureLeadKind } from '@/lib/leads/nurture/tracks'
import type { NurtureLead } from '@/lib/leads/nurture/gather'

const DAY = 24 * 60 * 60 * 1000
const now = new Date('2026-11-10T14:15:00Z')
const daysAgo = (d: number) => new Date(now.getTime() - d * DAY)

function lead(email: string, kind: NurtureLeadKind, anchorDaysAgo: number, raw: Parameters<typeof classifyLead>[0] = { kind }): NurtureLead {
  const c = classifyLead(raw)!
  return { email, kind, track: c.track, context: c.context, anchor: daysAgo(anchorDaysAgo) }
}

const journey = (email: string, ago: number, situation = 'laid-off') => lead(email, 'journey', ago, { kind: 'journey', situation })

const input = (leads: NurtureLead[], over: Partial<PlanInput> = {}): PlanInput => ({
  now,
  leads,
  unsubscribed: new Set(),
  suppressed: new Set(),
  offList: new Set(),
  registered: new Set(),
  lifecycleOwned: new Set(),
  sent: new Map(),
  facts: NO_FACTS,
  ...over,
})

describe('planNurture', () => {
  it('sends the day-3 step to a journey lead whose plan went out three days ago', () => {
    const { sends, counts } = planNurture(input([journey('a@example.org', 3)]))
    expect(sends).toHaveLength(1)
    expect(sends[0]).toMatchObject({ email: 'a@example.org', step: 'next_step', track: 'laid_off', kind: 'journey' })
    expect(sends[0].content.subject).toBeTruthy()
    expect(counts).toMatchObject({ considered: 1, notDue: 0 })
  })

  it('does nothing on day 1 and counts it as not due', () => {
    const { sends, counts } = planNurture(input([journey('a@example.org', 1)]))
    expect(sends).toEqual([])
    expect(counts.notDue).toBe(1)
  })

  it('walks a person through day 3, 7 and 14 as their earlier sends are recorded', () => {
    const e = 'a@example.org'
    const d7 = planNurture(input([journey(e, 7)], { sent: new Map([[nurtureRef('next_step', e), daysAgo(4)]]) }))
    expect(d7.sends[0]?.step).toBe('data_point')
    const d14 = planNurture(input([journey(e, 14)], { sent: new Map([[nurtureRef('next_step', e), daysAgo(11)], [nurtureRef('data_point', e), daysAgo(7)]]) }))
    expect(d14.sends[0]?.step).toBe('assessment')
    const done = planNurture(input([journey(e, 15)], { sent: new Map([[nurtureRef('next_step', e), daysAgo(12)], [nurtureRef('data_point', e), daysAgo(8)], [nurtureRef('assessment', e), daysAgo(1)]]) }))
    expect(done.sends).toEqual([])
  })

  it('leaves an address the lifecycle emails cover to them', () => {
    const { sends, counts } = planNurture(input([journey('a@example.org', 3)], { lifecycleOwned: new Set(['a@example.org']) }))
    expect(sends).toEqual([])
    expect(counts.ownedByLifecycle).toBe(1)
  })

  it('stops for a member, an unsubscribe, a bounce or complaint, and a person taken off the list', () => {
    const e = ['member', 'unsub', 'bounced', 'off'].map((n) => `${n}@example.org`)
    const { sends, counts } = planNurture(
      input(e.map((x) => journey(x, 3)), { registered: new Set([e[0]]), unsubscribed: new Set([e[1]]), suppressed: new Set([e[2]]), offList: new Set([e[3]]) }),
    )
    expect(sends).toEqual([])
    expect(counts).toMatchObject({ registered: 1, stopped: 3 })
  })

  it('keeps the two-day gap after a lifecycle email', () => {
    const e = 'a@example.org'
    const blocked = planNurture(input([journey(e, 3)], { sent: new Map([[`lifecycle:welcome:${e}`, daysAgo(1)]]) }))
    expect(blocked.sends).toEqual([])
    const clear = planNurture(input([journey(e, 3)], { sent: new Map([[`lifecycle:welcome:${e}`, daysAgo(2.5)]]) }))
    expect(clear.sends).toHaveLength(1)
  })

  it('skips a step that went stale instead of sending it late', () => {
    // Day 9: the day-3 note (window to day 7) is skipped, the day-7 note is still fresh.
    expect(planNurture(input([journey('a@example.org', 9)])).sends[0]?.step).toBe('data_point')
    // Day 12: nothing is in its window.
    expect(planNurture(input([journey('a@example.org', 12)])).sends).toEqual([])
    // Day 30: long past everything.
    expect(planNurture(input([journey('a@example.org', 30)])).sends).toEqual([])
  })

  it('keeps one lead per address: the kind that says the most, then the earliest', () => {
    const e = 'a@example.org'
    const pay = lead(e, 'pay_check', 5, { kind: 'pay_check', searchQ: 'project-manager' })
    const jour = journey(e, 3, 'promotion')
    const dl = lead(e, 'deadline', 8, { kind: 'deadline', searchLoc: 'TX' })
    expect(pickLeadPerAddress([pay, jour, dl])).toEqual([jour])
    expect(pickLeadPerAddress([pay, dl])).toEqual([dl])
    const early = lead(e, 'deadline', 9, { kind: 'deadline' })
    const late = lead(e, 'deadline', 4, { kind: 'deadline' })
    expect(pickLeadPerAddress([late, early])).toEqual([early])
  })

  it('orders sends oldest capture first, so a cap favours those closest to going stale', () => {
    const { sends } = planNurture(input([journey('late@example.org', 3), journey('early@example.org', 6)]))
    expect(sends.map((s) => s.email)).toEqual(['early@example.org', 'late@example.org'])
  })

  it('lists every ledger ref for an address: the three steps and the three lifecycle emails', () => {
    expect(ledgerRefs('a@example.org').sort()).toEqual(
      ['nurture:assessment:a@example.org', 'nurture:data_point:a@example.org', 'nurture:next_step:a@example.org', 'lifecycle:nudge1:a@example.org', 'lifecycle:nudge2:a@example.org', 'lifecycle:welcome:a@example.org'].sort(),
    )
  })
})

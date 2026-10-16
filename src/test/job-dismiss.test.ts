import { describe, expect, it } from 'vitest'
import { becauseLine, buildDismissRules, parseDismissReasons, preferenceChanges, shouldAskToHide, titleCore, type ActivePreference } from '@/lib/jobs/job-dismiss'
import { ghostRisk } from '@/lib/jobs/ghost-risk'

const job = { companyName: 'Acme Corp', title: 'Senior Project Manager II (Remote)', level: 'DIRECTOR', location: 'Austin, TX', industry: 'Retail', salaryMin: 90000, salaryMax: 110000 }
const row = (over: Partial<{ id: string; companyName: string; title: string; level: string | null; location: string | null; salaryMin: number | null; salaryMax: number | null }> = {}) => ({
  id: 'j1', companyName: 'Other Co', title: 'Project Manager', level: 'MANAGER', location: 'Denver, CO', salaryMin: null, salaryMax: null, ...over,
})
const pref = (over: Partial<ActivePreference>): ActivePreference => ({ id: 'p', kind: 'industry', value: 'Retail', label: 'Retail jobs', count: 1, action: 'downweight', askedAt: null, ...over })

describe('dismiss reasons → preferences', () => {
  it('keeps only known reasons, once each', () => {
    expect(parseDismissReasons(['company', 'company', 'nonsense', 3])).toEqual(['company'])
  })
  it('company hides at once; industry, title, level, location count up; pay sets a floor', () => {
    const c = preferenceChanges(['company', 'industry', 'title', 'level', 'location', 'pay', 'skills'], job)
    expect(c).toEqual([
      { kind: 'company', value: 'acme', label: 'Acme Corp', action: 'hide' },
      { kind: 'industry', value: 'Retail', label: 'Retail jobs', action: 'downweight' },
      { kind: 'title', value: 'project manager', label: 'project manager roles', action: 'downweight' },
      { kind: 'level', value: 'DIRECTOR', label: 'director roles', action: 'downweight' },
      { kind: 'location', value: 'TX', label: 'jobs in TX', action: 'downweight' },
      { kind: 'pay_floor', value: '111000', label: 'posted pay under $111k', action: 'floor' },
    ])
  })
  it('title core drops level words and parentheses', () => {
    expect(titleCore('Sr. Director - Supply Chain (Hybrid)')).toBe('director')
    expect(titleCore('Senior Project Manager II (Remote)')).toBe('project manager')
  })
})

describe('dismiss rules on the board', () => {
  it('hides dismissed jobs, hidden companies, pay under the floor and member-flagged ghosts', () => {
    const r = buildDismissRules({
      preferences: [pref({ kind: 'company', value: 'acme', action: 'hide' }), pref({ kind: 'pay_floor', value: '111000', action: 'floor' })],
      dismissedIds: ['gone'],
      industryOf: () => undefined,
      flaggedGhost: (id) => id === 'ghost',
    })
    expect(r.hidden(row({ id: 'gone' }))).toBe(true)
    expect(r.hidden(row({ companyName: 'ACME Corp.' }))).toBe(true)
    expect(r.hidden(row({ salaryMax: 100000 }))).toBe(true)
    expect(r.hidden(row({ salaryMax: 150000 }))).toBe(false)
    expect(r.hidden(row({ salaryMax: null }))).toBe(false) // no posted pay: never guessed
    expect(r.hidden(row({ id: 'ghost' }))).toBe(true)
    expect(r.hidden(row())).toBe(false)
  })
  it('down-weights similar jobs, and hides them once the member says "Hide all"', () => {
    const down = buildDismissRules({ preferences: [pref({}), pref({ kind: 'title', value: 'project manager' })], dismissedIds: [], industryOf: () => 'Retail' })
    expect(down.penalty(row())).toBe(2)
    expect(down.hidden(row())).toBe(false)
    const hide = buildDismissRules({ preferences: [pref({ action: 'hide' })], dismissedIds: [], industryOf: () => 'Retail' })
    expect(hide.hidden(row())).toBe(true)
  })
  it('asks "Hide all X?" after repeated dismissals, not again for two weeks', () => {
    const now = new Date('2026-10-16')
    expect(shouldAskToHide(pref({ count: 1 }), now)).toBe(false)
    expect(shouldAskToHide(pref({ count: 2 }), now)).toBe(true)
    expect(shouldAskToHide(pref({ count: 3, askedAt: new Date('2026-10-10') }), now)).toBe(false)
    expect(shouldAskToHide(pref({ count: 3, action: 'hide' }), now)).toBe(false)
  })
  it('says what changed', () => {
    expect(becauseLine([pref({ kind: 'company', label: 'Acme Corp', action: 'hide' }), pref({})])).toBe('Because you passed on some jobs, we hid Acme Corp, moved Retail jobs down.')
    expect(becauseLine([])).toBeNull()
  })
  it('member ghost flags feed ghost risk', () => {
    expect(ghostRisk({ priorClosedCount: 0, ageDays: 1, memberFlags: 2 }).level).toBe('likely')
    expect(ghostRisk({ priorClosedCount: 0, ageDays: 1, memberFlags: 1 }).level).toBe('watch')
    expect(ghostRisk({ priorClosedCount: 0, ageDays: 1 }).level).toBe('none')
  })
})

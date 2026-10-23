import { describe, expect, it } from 'vitest'
import {
  blockedExport,
  blockedScreen,
  capRoom,
  FREE_MEMBER_CAP,
  inviteCapMessage,
  institutionEntitlements,
  lockedReason,
  planOf,
  PLAN_CONTACT_EMAIL,
} from './entitlements'

describe('institutionEntitlements', () => {
  it('FREE caps members at 50 and locks the paid features', () => {
    const e = institutionEntitlements({ plan: 'FREE', tier: 'CAREER', enabledFeatures: {} })
    expect(e.memberCap).toBe(FREE_MEMBER_CAP)
    expect(FREE_MEMBER_CAP).toBe(50)
    expect([e.reporting, e.exports, e['crmExchange'], e.staffRoles, e.auditLog, e.sso, e.nextchapterServices, e.wioa]).toEqual(Array(8).fill(false))
  })

  it('PAID has no cap and everything on, at every tier', () => {
    for (const tier of ['CAREER', 'ADVANCEMENT', 'INSTITUTION']) {
      const e = institutionEntitlements({ plan: 'PAID', tier, enabledFeatures: { wioa: false } })
      expect(e.memberCap).toBeNull()
      expect(Object.entries(e).filter(([k]) => k !== 'memberCap').every(([, v]) => v === true)).toBe(true)
    }
  })

  it('grandfathers existing rows: a missing, null or unexpected plan is PAID', () => {
    for (const plan of [undefined, null, '', 'paid', 'LEGACY']) {
      expect(planOf(plan)).toBe('PAID')
      expect(institutionEntitlements({ plan }).memberCap).toBeNull()
      expect(institutionEntitlements({ plan }).reporting).toBe(true)
    }
  })

  it('the tier never grants a FREE organization anything', () => {
    expect(institutionEntitlements({ plan: 'FREE', tier: 'INSTITUTION' }).reporting).toBe(false)
  })
})

describe('lockedReason', () => {
  it('says what is locked and the one thing to do', () => {
    const r = lockedReason('reporting')
    expect(r).toMatch(/^Reporting and outcomes are part of the paid plan\./)
    expect(r).toContain(PLAN_CONTACT_EMAIL)
  })
})

describe('member cap boundary', () => {
  it('49 held plus 1 fits (reaching 50), 50 held plus 1 does not, 51 held is over', () => {
    expect(capRoom(50, 49, 1)).toMatchObject({ allowed: true, left: 1 })
    expect(capRoom(50, 50, 0)).toMatchObject({ allowed: true, left: 0 })
    expect(capRoom(50, 50, 1)).toMatchObject({ allowed: false, left: 0 })
    expect(capRoom(50, 51, 1)).toMatchObject({ allowed: false, left: 0 })
    expect(capRoom(50, 49, 2)).toMatchObject({ allowed: false, left: 1 })
  })
  it('states the cap and how many are left', () => {
    const r = capRoom(50, 45, 10)
    expect(r.message).toMatch(/up to 50 members/)
    expect(r.message).toMatch(/room for 5 more/)
    expect(r.message).toContain(PLAN_CONTACT_EMAIL)
    expect(capRoom(50, 50, 3).message).toMatch(/no room left/)
  })
  it('PAID has no cap', () => {
    expect(capRoom(null, 100000, 100000)).toMatchObject({ allowed: true, left: null, message: null })
  })
  it('invite message names the waiting people', () => {
    expect(inviteCapMessage(50, 12)).toMatch(/12 people are still waiting/)
  })
})

describe('export and screen gates', () => {
  it('FREE cannot download CRM or program exports', () => {
    expect(blockedExport('updates', 'FREE')).toBe('crmExchange')
    expect(blockedExport('suppression', 'FREE')).toBe('crmExchange')
    expect(blockedExport('etpl', 'FREE')).toBe('exports')
    expect(blockedExport('wioa', 'FREE')).toBe('wioa')
  })
  it('PAID and grandfathered rows can download everything', () => {
    for (const k of ['updates', 'suppression', 'etpl', 'wioa']) {
      expect(blockedExport(k, 'PAID')).toBeNull()
      expect(blockedExport(k, undefined)).toBeNull()
    }
  })
  it('privacy exports are never plan-gated', () => {
    expect(blockedExport('my-data', 'FREE')).toBeNull()
    expect(blockedExport('member-data', 'FREE')).toBeNull()
  })
  it('locks reporting, the CRM exchange and the activity log screens on FREE only', () => {
    expect(blockedScreen('development:home', 'FREE')).toBe('reporting')
    expect(blockedScreen('admin:board', 'FREE')).toBe('reporting')
    expect(blockedScreen('career:outcomes', 'FREE')).toBe('reporting')
    expect(blockedScreen('development:crm', 'FREE')).toBe('crmExchange')
    expect(blockedScreen('admin:activity', 'FREE')).toBe('auditLog')
    expect(blockedScreen('admin:activity', 'PAID')).toBeNull()
    expect(blockedScreen('admin:home', 'FREE')).toBeNull()
    expect(blockedScreen('admin:services', 'FREE')).toBeNull()
  })
})

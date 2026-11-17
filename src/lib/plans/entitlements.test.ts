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
  it('FREE lets anyone join, shows 5 members, 1 admin and 2 grants, and locks the paid features', () => {
    const e = institutionEntitlements({ plan: 'FREE', tier: 'CAREER', enabledFeatures: {} })
    expect(e.memberCap).toBe(FREE_MEMBER_CAP)
    expect(FREE_MEMBER_CAP).toBeNull()
    expect([e.visibleMembers, e.adminLimit, e.visibleGrants]).toEqual([5, 1, 2])
    expect([e.reporting, e.exports, e['crmExchange'], e.staffRoles, e.auditLog, e.sso, e.nextchapterServices, e.wioa]).toEqual(Array(8).fill(false))
  })

  it('PAID has no cap and everything on, at every tier', () => {
    for (const tier of ['CAREER', 'ADVANCEMENT', 'INSTITUTION']) {
      const e = institutionEntitlements({ plan: 'PAID', tier, enabledFeatures: { wioa: false } })
      expect(e.memberCap).toBeNull()
      expect([e.visibleMembers, e.adminLimit, e.visibleGrants]).toEqual([null, null, null])
      expect(Object.entries(e).filter(([k]) => !['memberCap', 'visibleMembers', 'adminLimit', 'visibleGrants'].includes(k)).every(([, v]) => v === true)).toBe(true)
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

import { featureOn, LOCK_PITCH, TRIAL_DAYS, effectivePlan, trialEndDate, trialForLock, trialState, LOCKED_TITLES } from './entitlements'

describe('free trial', () => {
  const now = new Date('2026-11-17T12:00:00Z')
  const started = new Date('2026-11-10T12:00:00Z')
  it('is available once, runs 30 days, then ends', () => {
    expect(trialState('FREE', null, null, now).state).toBe('available')
    const ends = trialEndDate(started)
    expect(ends.getTime() - started.getTime()).toBe(TRIAL_DAYS * 86_400_000)
    expect(trialState('FREE', started, ends, now)).toMatchObject({ state: 'active', daysLeft: 23 })
    expect(trialState('FREE', started, new Date('2026-11-12T00:00:00Z'), now).state).toBe('ended')
    expect(trialState('PAID', null, null, now).state).toBe('none')
  })
  it('reads as paid only while it runs, and never takes anything from a paid plan', () => {
    expect(effectivePlan('FREE', new Date('2026-12-01T00:00:00Z'), now)).toBe('PAID')
    expect(effectivePlan('FREE', new Date('2026-11-01T00:00:00Z'), now)).toBe('FREE')
    expect(effectivePlan('FREE', null, now)).toBe('FREE')
    expect(effectivePlan('PAID', null, now)).toBe('PAID')
  })
  it('tells a lock screen what to offer', () => {
    expect(trialForLock({ plan: 'FREE', trialStartedAt: null, trialEndsAt: null })).toBe('available')
    expect(trialForLock({ plan: 'FREE', trialStartedAt: new Date('2026-01-01'), trialEndsAt: new Date('2026-01-31') })).toBe('ended')
    expect(trialForLock({ plan: 'PAID', storedPlan: 'FREE', trialStartedAt: new Date(), trialEndsAt: new Date(Date.now() + 86_400_000) })).toBe('none')
  })
  it('every gated feature has a pitch with a sample', () => {
    for (const f of Object.keys(LOCKED_TITLES) as (keyof typeof LOCKED_TITLES)[]) {
      expect(LOCK_PITCH[f].headline.length).toBeGreaterThan(10)
      expect(LOCK_PITCH[f].bullets).toHaveLength(3)
      expect(LOCK_PITCH[f].sample.length).toBeGreaterThan(0)
    }
  })
  it('partner views are a paid feature', () => {
    expect(institutionEntitlements({ plan: 'FREE' }).partnerViews).toBe(false)
    expect(institutionEntitlements({ plan: 'PAID' }).partnerViews).toBe(true)
  })
})

describe('skills gaps preview', () => {
  it('a free organization sees the first three skills; paid sees all', () => {
    expect(institutionEntitlements({ plan: 'FREE' }).visibleSkillRows).toBe(3)
    expect(institutionEntitlements({ plan: 'PAID' }).visibleSkillRows).toBeNull()
    expect(featureOn(institutionEntitlements({ plan: 'FREE' }), 'skillsGaps')).toBe(false)
    expect(featureOn(institutionEntitlements({ plan: 'PAID' }), 'skillsGaps')).toBe(true)
  })
})

import { describe, expect, it } from 'vitest'
import { missingDims, ROLE_WORK_PROFILES, WORK_DIMS, workFit, workProfile } from '@/lib/profile/work-profile'
import { aiOutlookForFunction, aiOutlookForRole } from '@/lib/profile/ai-outlook'
import { ROLES } from '@/lib/pivots/pivot-map'

describe('work profile', () => {
  it('infers from existing answers; the person’s own answer wins', () => {
    const p = workProfile({ peopleEnergy: 'LOW', vectors: { collaboration: -0.8, rigor: 0.9 }, remotePreference: 'remote', workStyleAnswers: { setting: { value: 2, at: 'x' } } })
    expect(p.social!.value).toBeLessThan(-0.5)
    expect(p.altitude!.value).toBeLessThan(0)
    expect(p.schedule!.value).toBeGreaterThan(0.5)
    expect(p.setting).toEqual({ value: 1, confidence: 1, from: ['Your answer'] })
    expect(missingDims(p)).toContain('drive')
    expect(missingDims(p)).not.toContain('setting')
  })
  it('scores a role against the person and names clashes', () => {
    const solo = workProfile({ workStyleAnswers: { social: { value: -2 }, setting: { value: -2 } } })
    expect(workFit(solo, 'data_analyst').score).toBeGreaterThan(0)
    const nurse = workFit(solo, 'nursing_clinical')
    expect(nurse.score).toBeLessThan(0)
    expect(nurse.clashes.length).toBeGreaterThan(0)
    expect(workFit(workProfile({}), 'sales').score).toBe(0)
  })
  it('every pivot-map role has a work profile on all ten dimensions', () => {
    const missing = [...ROLES.keys()].filter((k) => !ROLE_WORK_PROFILES[k] || WORK_DIMS.some((d) => typeof ROLE_WORK_PROFILES[k][d.key] !== 'number'))
    expect(missing).toEqual([])
  })
})

describe('AI and a field', () => {
  it('office and admin work: learning AI is critical', () => {
    expect(aiOutlookForRole('admin_ea')?.aiSkills).toBe('critical')
  })
  it('returns null when the function is unknown', () => {
    expect(aiOutlookForFunction('Nonexistent')).toBeNull()
  })
})

import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({ prisma: {} }))

import { matchBenefits, tracksFor } from '@/lib/workforce/people-crm'

describe('people CRM tracks', () => {
  it('puts a laid-off person in training on both outplacement and retraining', () => {
    expect(tracksFor({ memberCompanyId: 'c1', journey: 'LAID_OFF', training: true })).toEqual(['outplacement', 'retraining'])
  })
  it('reads moving here, new graduates and growing from the journey', () => {
    expect(tracksFor({ memberCompanyId: null, journey: 'EXPLORING_MOVE', training: false })).toEqual(['moving'])
    expect(tracksFor({ memberCompanyId: null, journey: 'STUDENT_NEW_GRAD', training: false })).toEqual(['grad'])
    expect(tracksFor({ memberCompanyId: null, journey: 'GROWING', training: true })).toEqual(['retraining', 'growing'])
  })
  it('falls back to job seekers, or to not shared when the journey is hidden', () => {
    expect(tracksFor({ memberCompanyId: null, journey: 'LAID_OFF', training: false })).toEqual(['seeker'])
    expect(tracksFor({ memberCompanyId: null, journey: null, training: false })).toEqual(['unshared'])
    expect(tracksFor({ memberCompanyId: 'c1', journey: null, training: false })).toEqual(['outplacement'])
  })
})

describe('benefit matching', () => {
  it('matches the layoff without any shared needs', () => {
    const m = matchBenefits({ laidOffFrom: 'Acme', tracks: ['outplacement'], training: null, needs: null })
    expect(m.map((x) => x.category)).toEqual(['income', 'health', 'education'])
    expect(m[0].why).toContain('Acme')
  })
  it('never reads needs a person did not share', () => {
    const m = matchBenefits({ laidOffFrom: null, tracks: ['seeker'], training: null, needs: null })
    expect(m).toEqual([])
  })
  it('matches shared childcare, rent and transport, and marks board-paid training in use', () => {
    const m = matchBenefits({
      laidOffFrom: null,
      tracks: ['pivot', 'retraining'],
      training: { program: 'AI at Work', payer: 'WIOA_VOUCHER' },
      needs: { pressures: ['DEPENDENTS_CHILDCARE', 'RENT_MORTGAGE'], barriers: ['life_logistics'] },
    })
    const cats = m.map((x) => x.category)
    expect(cats).toEqual(expect.arrayContaining(['education', 'childcare', 'housing', 'transportation']))
    expect(m.find((x) => x.category === 'education')?.inUse).toBe(true)
    expect(m.filter((x) => x.category === 'childcare')).toHaveLength(2)
  })
  it('lists a benefit once even when two reasons point to it', () => {
    const m = matchBenefits({ laidOffFrom: 'Acme', tracks: ['outplacement'], training: null, needs: { pressures: ['HEALTH_INSURANCE'], barriers: ['skills_gap'] } })
    expect(new Set(m.map((x) => x.name)).size).toBe(m.length)
  })
  it('does not call it a layoff plan for someone who was not laid off', () => {
    const m = matchBenefits({ laidOffFrom: null, tracks: ['grad'], training: null, needs: { pressures: ['HEALTH_INSURANCE'], barriers: [] } })
    expect(m.find((x) => x.category === 'health')?.name).toBe('Health coverage (a marketplace plan or Medicaid)')
  })
})

import { describe, expect, it } from 'vitest'
import { collegeMajorsView, loadCollegeMajors } from '@/lib/rankings/college-majors'
import type { DegreeFieldFigures } from '@/lib/rankings/degrees-specs'

const figures: DegreeFieldFigures = {
  edition: '2026-11',
  fields: [
    { field: 'Nursing', open: 8000, pay: 90_000, growth: 6, grads: 200_000, perHundred: 4, stages: { early: { open: 3000, pay: 80_000 }, mid: { open: 4000, pay: 95_000 }, late: { open: 1000, pay: 130_000 } } },
    { field: 'Computer science and IT', open: 30_000, pay: 140_000, growth: 12, grads: 200_000, perHundred: 15, stages: { early: { open: 5000, pay: 105_000 }, mid: { open: 20_000, pay: 150_000 }, late: { open: 5000, pay: 200_000 } } },
  ],
}

describe('college majors section', () => {
  it('orders a college’s majors and reads each against its field', () => {
    const v = collegeMajorsView([['51.38', 300, 50, 10], ['11.07', 500, 100, 0], ['23.01', 40, 0, 0], ['99.99', 5, 0, 0]], figures)
    expect(v.rows.map((r) => r.major.cip)).toEqual(['11.07', '51.38', '23.01'])
    expect(v.rows[0].total).toBe(600)
    expect(v.rows[0].field?.perHundred).toBe(15)
    expect(v.rows[2].field).toBeNull()
    expect(v.rows[0].shareOfUs).toBeGreaterThan(0)
    expect(v.allFields).toBe(9.5)
    expect(v.edition).toBe('2026-11')
  })
  it('shows degrees without the job figures before the first build', () => {
    const v = collegeMajorsView([['51.38', 300, 0, 0]], null)
    expect(v.rows[0].field).toBeNull()
    expect(v.allFields).toBeNull()
  })
  it('loads a college from its state file and nothing for an unknown one', async () => {
    const gt = await loadCollegeMajors('GA', '139755')
    expect(gt.length).toBeGreaterThan(5)
    expect(gt[0][1] + gt[0][2] + gt[0][3]).toBeGreaterThanOrEqual(gt[1][1] + gt[1][2] + gt[1][3])
    expect(await loadCollegeMajors('GA', 'nope')).toEqual([])
    expect(await loadCollegeMajors('../x', '1')).toEqual([])
  })
})

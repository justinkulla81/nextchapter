import { describe, expect, it } from 'vitest'
import index from '@/lib/rankings/data/college-index.json'
import { loadCollegeMajors } from '@/lib/rankings/college-majors'
import { mixOf, peersOf, programsMarket, standingOf, type CollegeIndex } from '@/lib/higher-ed/programs-market'
import type { DegreeFieldFigure, DegreeFieldFigures } from '@/lib/rankings/degrees-specs'

const IDX = index as unknown as CollegeIndex
const fig = (field: string, open: number, grads: number, covered = true): DegreeFieldFigure => ({
  field, open, covered, pay: covered ? 120_000 : null, growth: 5, grads, perHundred: covered ? Math.round((open / grads) * 1000) / 10 : null,
  stages: { early: { open: 1, pay: covered ? 90_000 : null }, mid: { open: 1, pay: covered ? 130_000 : null }, late: { open: 1, pay: covered ? 190_000 : null } },
})
const figures: DegreeFieldFigures = {
  edition: '2026-11',
  fields: [fig('Computer science and IT', 47_000, 218_000), fig('Engineering', 32_000, 211_000), fig('Business administration and management', 65_000, 437_000), fig('Life sciences', 1200, 219_000), fig('Nursing', 333, 216_000, false)],
  states: { GA: { 'Computer science and IT': [1500, 140_000], Engineering: [900, 130_000] } },
}
const previous: DegreeFieldFigures = { ...figures, edition: '2026-10', fields: figures.fields.map((f) => ({ ...f, open: Math.round(f.open * 0.9) })) }

describe('programs vs. market', () => {
  it('reads a field as above or below the all-fields figure, and never a field our data does not cover', () => {
    expect(standingOf('Computer science and IT', figures, 15)).toBe('above')
    expect(standingOf('Life sciences', figures, 15)).toBe('below')
    expect(standingOf('Nursing', figures, 15)).toBe('unmeasured')
    expect(standingOf(null, figures, 15)).toBe('many')
    expect(mixOf({ 'Computer science and IT': 10, Nursing: 5 }, 20, figures, 15)).toEqual({ above: 10, below: 0, unmeasured: 5, many: 5 })
  })

  it('finds similar colleges of the same control and size, in the state first', () => {
    const p = peersOf('139755', IDX)
    expect(p.ids.length).toBeGreaterThanOrEqual(3)
    expect(p.ids).not.toContain('139755')
    for (const id of p.ids) {
      expect(IDX[id][2]).toBe('Public')
      expect(IDX[id][3]).toBeGreaterThanOrEqual(Math.floor(IDX['139755'][3] / 2))
    }
  })

  it('builds the three screens from federal files and the stored field rows', async () => {
    const raw = await loadCollegeMajors('GA', '139755')
    const d = programsMarket({ unitid: '139755', raw, index: IDX, figures, previous })!
    expect(d.name).toMatch(/Georgia Institute of Technology/)
    expect(d.total).toBeGreaterThan(10_000)
    expect(d.rows[0].major.cip).toBe('11.01')
    expect(d.rows[0].standing).toBe('above')
    expect(d.rows[0].usOpenChange).toBeCloseTo(11.1, 0)
    expect(d.aboveShare).toBeGreaterThan(0.5)
    const cs = d.stateFields.find((f) => f.field === 'Computer science and IT')!
    expect(cs.stateOpen).toBe(1500)
    expect(cs.shareOfState).toBeGreaterThan(0.2)
    expect(d.stateFields.find((f) => f.field === 'Health professions and medicine')?.covered).toBe(false)
    expect(d.peers.rows.filter((r) => r.me)).toHaveLength(1)
    expect(d.previousEdition).toBe('2026-10')
  })

  it('shows degrees without job figures before the first build, and nothing for an unknown college', async () => {
    const raw = await loadCollegeMajors('GA', '139755')
    const d = programsMarket({ unitid: '139755', raw, index: IDX, figures: null, previous: null })!
    expect(d.aboveShare).toBeNull()
    expect(d.rows[0].field).toBeNull()
    expect(programsMarket({ unitid: 'nope', raw, index: IDX, figures, previous: null })).toBeNull()
  })
})

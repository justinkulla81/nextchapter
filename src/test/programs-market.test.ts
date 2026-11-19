import { describe, expect, it } from 'vitest'
import index from '@/lib/rankings/data/college-index.json'
import { loadCollegeMajors } from '@/lib/rankings/college-majors'
import { classificationGroup, mixOf, peersOf, programsMarket, selectivityBand, standingOf, type CollegeIndex } from '@/lib/higher-ed/programs-market'
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

  it('suggests peers of the same classification and selectivity, public and private alike', () => {
    const cmu = peersOf('211440', IDX)
    expect(cmu.chosen).toBe(false)
    expect(cmu.ids.length).toBe(12)
    expect(cmu.scope).toMatch(/R1 research universities .* admitting under 15% of applicants/)
    for (const id of cmu.ids) {
      expect(IDX[id][6]).toBe(15)
      expect(IDX[id][7]).toBeLessThan(15)
    }
    expect(cmu.ids).toContain('110635') // UC Berkeley, public, 11.7%
    expect(new Set(cmu.ids.map((id) => IDX[id][2])).size).toBeGreaterThan(1)
    expect(selectivityBand(11.4)?.key).toBe('most')
    expect(selectivityBand(null)).toBeNull()
    expect(classificationGroup(19)?.key).toBe('masters')
  })

  it('uses the peer group a college chose, and drops itself and unknown ids', () => {
    const p = peersOf('211440', IDX, ['166683', '166027', '243744', '110635', '186131', '211440', 'nope', '166683'])
    expect(p).toEqual({ scope: 'chosen by your team', ids: ['166683', '166027', '243744', '110635', '186131'], chosen: true })
  })

  it('falls back to control and size without an admission rate, and says so when a classification has too few', () => {
    const lone: CollegeIndex = { a: ['A', 'PA', 'Public', 1000, 900, {}, 15], b: ['B', 'PA', 'Public', 1100, 900, {}, 18], c: ['C', 'OH', 'Public', 900, 900, {}, 18] }
    const p = peersOf('a', lone)
    expect(p.ids).toEqual(['b', 'c'].sort((x, y) => Math.abs(lone[x][3] - 1000) - Math.abs(lone[y][3] - 1000) || x.localeCompare(y)))
    expect(p.scope).toMatch(/not matched on classification/)
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
    const chosen = programsMarket({ unitid: '139755', raw, index: IDX, figures, previous, chosenPeers: ['211440'] })!
    expect(chosen.peers.chosen).toBe(true)
    expect(chosen.peers.rows.map((r) => r.name)).toEqual(expect.arrayContaining(['Carnegie Mellon University']))
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

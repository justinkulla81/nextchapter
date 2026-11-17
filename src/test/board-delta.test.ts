import { describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
vi.mock('@/lib/prisma', () => ({ prisma: {} }))
import { mergeChangedRows } from '@/lib/jobs/board-shortlist'
import type { LightRow } from '@/lib/jobs/board-light-rows'

const r = (id: string, title = `Job ${id}`) => ({ id, title }) as unknown as LightRow
const base = (ids: string[]) => ({ rows: ids.map((id) => r(id)), expires: Float64Array.from(ids.map((_, i) => i)), priors: Uint32Array.from(ids.map(() => 0)) })

describe('board carried forward with changed rows', () => {
  it('drops changed rows that left, replaces changed ones that stayed, adds new ones, in id order', () => {
    const out = mergeChangedRows(base(['a', 'c', 'e', 'g']), new Set(['c', 'e', 'd', 'h']), [
      { row: r('h', 'new h'), expires: 9, prior: 1 },
      { row: r('e', 'edited e'), expires: 7, prior: 2 },
      { row: r('d', 'new d'), expires: NaN, prior: 0 },
    ])
    expect(out.rows.map((x) => x.id)).toEqual(['a', 'd', 'e', 'g', 'h'])
    expect(out.rows[2].title).toBe('edited e')
    expect(Array.from(out.expires)).toEqual([0, NaN, 7, 3, 9])
    expect(Array.from(out.priors)).toEqual([0, 0, 2, 0, 1])
    expect(out.byId.get('d')?.title).toBe('new d')
    expect(out.byId.has('c')).toBe(false)
  })
  it('keeps the base whole when nothing changed', () => {
    const b = base(['a', 'b'])
    const out = mergeChangedRows(b, new Set(), [])
    expect(out.rows).toEqual(b.rows)
    expect(out.rows[0]).toBe(b.rows[0])
  })
})

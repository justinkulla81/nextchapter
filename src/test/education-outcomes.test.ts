import { describe, it, expect } from 'vitest'
import { summarize } from '@/lib/analytics/education-outcomes'
import { suppressSmallCells, isSuppressedCell } from '@/lib/admin/cell-suppression'

type Row = Parameters<typeof summarize>[0][number]
const member = (over: Partial<Row> = {}): Row => ({
  id: Math.random().toString(36).slice(2),
  schools: ['MIT'],
  degreeLevels: ['MBA'],
  level: 'Director',
  fn: 'Finance',
  industry: 'Technology & Software',
  status: null,
  applied: false,
  interviewed: false,
  active30: false,
  outreach30: false,
  ...over,
})

describe('summarize', () => {
  it('groups a member under every school they attended, once each', () => {
    const rows = [member({ schools: ['MIT', 'Harvard University'] }), member({ schools: ['MIT'] })]
    const groups = summarize(rows, (r) => r.schools)
    expect(groups.find((g) => g.group === 'MIT')?.members).toBe(2)
    expect(groups.find((g) => g.group === 'Harvard University')?.members).toBe(1)
  })

  it('does not double count a member with two degrees at the same school', () => {
    const rows = [member({ schools: ['MIT', 'MIT'] })]
    expect(summarize(rows, (r) => r.schools)[0].members).toBe(1)
  })

  it('reports interviews as a share of those who applied, not of everyone', () => {
    const rows = [
      member({ applied: true, interviewed: true }),
      member({ applied: true, interviewed: false }),
      member({ applied: false }),
      member({ applied: false }),
    ]
    const g = summarize(rows, (r) => r.schools)[0]
    expect(g.appliedPct).toBe(50)
    expect(g.interviewPct).toBe(50)
  })

  it('has no interview rate when nobody in the group applied', () => {
    expect(summarize([member(), member()], (r) => r.schools)[0].interviewPct).toBeNull()
  })

  it('counts only laid-off and resigned as between jobs', () => {
    const rows = [member({ status: 'LAID_OFF' }), member({ status: 'RESIGNED' }), member({ status: 'EMPLOYED_CONSIDERING_MOVE' }), member({ status: null })]
    expect(summarize(rows, (r) => r.schools)[0].betweenJobsPct).toBe(50)
  })
})

describe('the privacy floor', () => {
  it('suppresses a group under 5 members before it can be shown', () => {
    const rows = [...Array.from({ length: 5 }, () => member({ schools: ['MIT'] })), ...Array.from({ length: 4 }, () => member({ schools: ['Smith College'] }))]
    const cells = suppressSmallCells(summarize(rows, (r) => r.schools), (g) => g.members, (g) => g.group)
    const mit = cells.find((c) => !isSuppressedCell(c) && c.group === 'MIT')
    const smith = cells.find((c) => isSuppressedCell(c))
    expect(mit).toBeDefined()
    expect(smith).toMatchObject({ suppressed: true, label: 'Smith College' })
    // A suppressed cell carries no numbers at all.
    expect(Object.keys(smith as object).sort()).toEqual(['label', 'suppressed'])
  })
})

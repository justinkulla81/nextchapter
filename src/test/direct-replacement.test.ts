import { describe, expect, it } from 'vitest'
import { isThirdPartyRow, planCollapses, type CollapseRow, type PrimaryRow } from '@/lib/jobs/direct-replacement'

const NOW = new Date('2026-11-05T12:00:00Z')
const DAY = 86_400_000
const primary = (over: Partial<PrimaryRow> = {}): PrimaryRow => ({
  id: 'p1', url: 'https://nvidia.wd5.myworkdayjobs.com/job/1', archivedAt: null, lastVerifiedAt: new Date(NOW.getTime() - 2 * DAY),
  directListing: true, sourceCategory: 'employer', ...over,
})
const jooble = (over: Partial<CollapseRow> = {}): CollapseRow => ({
  url: 'https://jooble.org/desc/1', duplicateOf: 'https://nvidia.wd5.myworkdayjobs.com/job/1',
  existing: { sourceCategory: 'aggregator', url: 'https://jooble.org/desc/1' }, ...over,
})
const map = (...ps: PrimaryRow[]) => new Map(ps.map((p) => [p.url, p]))

describe('isThirdPartyRow', () => {
  it('knows an aggregator by source class or apply-link host', () => {
    expect(isThirdPartyRow({ url: 'https://jooble.org/desc/1', sourceCategory: null })).toBe(true)
    expect(isThirdPartyRow({ url: 'https://www.jobviewtrack.com/x', sourceCategory: null })).toBe(true)
    expect(isThirdPartyRow({ url: 'https://x.test/1', sourceCategory: 'aggregator' })).toBe(true)
    expect(isThirdPartyRow({ url: 'https://jobs.apple.com/1', sourceCategory: 'employer' })).toBe(false)
  })
})

describe('planCollapses', () => {
  it('collapses a Jooble row into a live, recently verified direct row and keeps its id', () => {
    const plan = planCollapses([jooble()], map(primary()), NOW)
    expect(plan.collapse).toEqual([{ url: 'https://jooble.org/desc/1', primaryId: 'p1' }])
    expect(plan.guardedCollapses).toBe(1)
  })
  it('leaves the Jooble row alone when the direct row is not on the board', () => {
    const plan = planCollapses([jooble()], map(), NOW)
    expect(plan.collapse).toEqual([])
    expect(plan.blocked.noPrimary).toBe(1)
  })
  it('leaves it alone when the direct row was verified more than 14 days ago, is archived, or was never verified', () => {
    for (const p of [primary({ lastVerifiedAt: new Date(NOW.getTime() - 15 * DAY) }), primary({ archivedAt: NOW }), primary({ lastVerifiedAt: null })]) {
      const plan = planCollapses([jooble()], map(p), NOW)
      expect(plan.collapse).toEqual([])
      expect(plan.blocked.primaryNotLive).toBe(1)
    }
  })
  it('never collapses into a primary that is itself a third-party row', () => {
    const plan = planCollapses([jooble()], map(primary({ directListing: false, sourceCategory: 'aggregator' })), NOW)
    expect(plan.collapse).toEqual([])
    expect(plan.blocked.primaryNotDirect).toBe(1)
  })
  it('accepts an employer source the crawler did not flag as direct', () => {
    const plan = planCollapses([jooble()], map(primary({ directListing: false, sourceCategory: 'employer' })), NOW)
    expect(plan.collapse).toHaveLength(1)
  })
  it('defers third-party collapses past the per-request cap and counts them', () => {
    const rows = [1, 2, 3].map((i) => jooble({ url: `https://jooble.org/desc/${i}`, existing: { sourceCategory: 'aggregator', url: `https://jooble.org/desc/${i}` } }))
    const plan = planCollapses(rows, map(primary()), NOW, 2)
    expect(plan.collapse).toHaveLength(2)
    expect(plan.blocked.deferred).toBe(1)
  })
  it('keeps the old behaviour for a row that is not a third-party copy, and for one not on the board yet', () => {
    const employerCopy = jooble({ url: 'https://jobs.x.com/1', existing: { sourceCategory: 'employer', url: 'https://jobs.x.com/1' } })
    const notYet = jooble({ url: 'https://jooble.org/desc/9', existing: null })
    const plan = planCollapses([employerCopy, notYet], map(), NOW)
    expect(plan.collapse).toEqual([{ url: 'https://jobs.x.com/1', primaryId: null }, { url: 'https://jooble.org/desc/9', primaryId: null }])
    expect(plan.guardedCollapses).toBe(0)
  })
})

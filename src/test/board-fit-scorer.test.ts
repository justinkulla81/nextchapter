import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/prisma', () => ({ prisma: {} }))
vi.mock('@/lib/jobs/ghost-risk-data', () => ({ getClosedPostingCounts: async () => new Map() }))

import { boardListingFitBucketScorer, computeBoardListingFitBucket } from '@/lib/jobs/job-fit-bucket'
import { legacyComputeBoardListingFitBucket } from '@/lib/jobs/job-fit-bucket-legacy'
import { boardListingFitBucketScorerFor } from '@/lib/jobs/email-fit-scoring'
import { levelOnlyFilter, postedWithinFilter, postedWithinWhere, dateWindowFilter, splitBoardWhere, boardLevelWindowWhere, rankBoardRows, type BoardRankRow } from '@/lib/jobs/board-shortlist'
import { mirrorCanAnswer, mirrorDisabledByEnv } from '@/lib/jobs/board-light-rows'
import { roleFamiliesOf, titlesShareRoleFamily } from '@/lib/constants/role-family-keywords'
import { EXCLUDE_MID_LEVEL_WHERE } from '@/lib/jobs/mid-level'

type Candidate = Parameters<typeof computeBoardListingFitBucket>[0]

interface Snapshot {
  candidates: (Candidate & { key: string })[]
  postings: (Parameters<typeof computeBoardListingFitBucket>[1] & { id: string; createdAt: string; postedAt: string | null })[]
}
const snapshot: Snapshot = JSON.parse(readFileSync(path.join(__dirname, 'fixtures/fit-scoring-legacy-snapshot.json'), 'utf8'))

const lightRows = (): BoardRankRow[] =>
  snapshot.postings.map((p, i) => ({
    id: p.id,
    title: p.title,
    companyName: `Company ${i % 7}`,
    audienceTier: i % 3 === 0 ? 'A_LIST_ONLY' : 'ALL_CANDIDATES',
    source: i % 2 === 0 ? 'ats_feed' : 'employer',
    targetFunction: p.targetFunction,
    targetLevel: p.targetLevel,
    targetRemotePolicy: p.targetRemotePolicy,
    targetLocation: p.targetLocation,
    location: p.location,
    level: p.level ?? null,
    sourceCategory: null,
    postedAt: p.postedAt ? new Date(p.postedAt) : null,
    sourceCount: null,
    salaryMin: p.salaryMin,
    salaryMax: p.salaryMax,
    createdAt: new Date(p.createdAt),
    employmentType: null,
  }))

describe('board fit scorer (one member against many rows)', () => {
  it('gives every row the same bucket as computeBoardListingFitBucket, scored twice in any order', () => {
    const rows = lightRows()
    let compared = 0
    for (const c of snapshot.candidates) {
      const score = boardListingFitBucketScorer(c)
      for (const p of rows) {
        expect(score(p)).toBe(computeBoardListingFitBucket(c, { ...p, description: null }))
        compared++
      }
      // Second pass reuses each row's prepared side.
      for (const p of [...rows].reverse()) expect(score(p)).toBe(computeBoardListingFitBucket(c, { ...p, description: null }))
    }
    expect(compared).toBeGreaterThan(100)
  })

  it('legacy (the emails) still scores each pair with the legacy scorer', () => {
    const rows = lightRows()
    for (const c of snapshot.candidates) {
      const score = boardListingFitBucketScorerFor('legacy', c)
      for (const p of rows) expect(score(p)).toBe(legacyComputeBoardListingFitBucket(c, { ...p, description: null }))
    }
  })

  it('ranking is the same on a second call over the same rows (memoised row facts)', () => {
    const rows = lightRows()
    for (const c of snapshot.candidates) {
      const first = rankBoardRows(rows, { candidate: c, isCandidatePlus: false, size: 10 })
      const again = rankBoardRows(rows, { candidate: c, isCandidatePlus: false, size: 10 })
      const fresh = rankBoardRows(lightRows(), { candidate: c, isCandidatePlus: false, size: 10 })
      expect(again).toEqual(first)
      expect(fresh.openIds).toEqual(first.openIds)
      expect(fresh.lockedIds).toEqual(first.lockedIds)
      expect([...fresh.countByCompany]).toEqual([...first.countByCompany])
    }
  })

  it('keep (great pay / benefits) narrows the ranking and its totals; omitted changes nothing', () => {
    const rows = lightRows()
    const c = snapshot.candidates[0]
    const all = rankBoardRows(rows, { candidate: c, isCandidatePlus: true, size: 1000 })
    expect(rankBoardRows(rows, { candidate: c, isCandidatePlus: true, size: 1000, keep: undefined })).toEqual(all)
    const keep = (p: BoardRankRow) => p.companyName === 'Company 0'
    const kept = rankBoardRows(rows, { candidate: c, isCandidatePlus: true, size: 1000, keep })
    const expected = new Set(rows.filter(keep).map((p) => p.id))
    expect([...kept.openIds, ...kept.lockedIds].every((id) => expected.has(id))).toBe(true)
    expect(kept.openTotal + kept.lockedTotal).toBe(expected.size)
    // Competition still counts the whole board.
    expect([...kept.countByCompany]).toEqual([...all.countByCompany])
  })
})

describe('role families', () => {
  it('roleFamiliesOf overlap matches titlesShareRoleFamily', () => {
    const titles = snapshot.postings.map((p) => p.title).concat(['Corporate Development Director', 'Investment Partner', 'VP Finance'])
    for (const a of titles.slice(0, 40)) {
      for (const b of titles) {
        const viaFamilies = roleFamiliesOf(a).some((f) => roleFamiliesOf(b).includes(f))
        expect(viaFamilies).toBe(titlesShareRoleFamily(a, b))
      }
    }
  })
})

describe('board filters answered in memory', () => {
  const row = (level: string | null) => ({ level })
  it('level window and level lists match the SQL Prisma writes', () => {
    const exclMid = levelOnlyFilter(boardLevelWindowWhere(undefined, false))!
    expect(exclMid(row(null))).toBe(true)
    expect(exclMid(row('VP'))).toBe(true)
    expect(exclMid(row('MID_IC'))).toBe(false)
    expect(levelOnlyFilter(boardLevelWindowWhere(undefined, true))!(row('MID_IC'))).toBe(true)
    expect(levelOnlyFilter(boardLevelWindowWhere({}, true))!(row(null))).toBe(true)
    const list = levelOnlyFilter(boardLevelWindowWhere({ level: { in: ['VP', 'MID_IC'] } }, false))!
    expect(list(row('VP'))).toBe(true)
    expect(list(row('MID_IC'))).toBe(false) // the window still applies
    expect(list(row(null))).toBe(false) // SQL IN never matches NULL
    expect(levelOnlyFilter({ level: { in: [] } })!(row('VP'))).toBe(false)
    expect(levelOnlyFilter(EXCLUDE_MID_LEVEL_WHERE)).not.toBeNull()
  })

  it('anything else is left to the database', () => {
    expect(levelOnlyFilter({ createdAt: { gte: new Date() } })).toBeNull()
    expect(levelOnlyFilter({ AND: [{}, { postedAt: null }] })).toBeNull()
    expect(levelOnlyFilter({ level: 'VP' })).toBeNull()
    expect(levelOnlyFilter({ OR: [{ level: null }] })).toBeNull()
    expect(levelOnlyFilter({ level: { in: ['VP'] }, title: 'x' })).toBeNull()
  })

  it('postedWithinFilter is postedWithinWhere: posting date, else import date', () => {
    const now = Date.UTC(2026, 9, 14, 12)
    const keep = postedWithinFilter(72, now)
    const h = (n: number) => new Date(now - n * 3_600_000)
    expect(keep({ postedAt: h(71), createdAt: h(500) })).toBe(true)
    expect(keep({ postedAt: h(72), createdAt: h(1) })).toBe(true) // gte
    expect(keep({ postedAt: h(73), createdAt: h(1) })).toBe(false) // a posting date wins over a recent import
    expect(keep({ postedAt: null, createdAt: h(10) })).toBe(true)
    expect(keep({ postedAt: null, createdAt: h(80) })).toBe(false)
  })
})

describe('email date windows answered from the shared board', () => {
  const h = (n: number) => new Date(Date.now() - n * 3_600_000)
  it('postedWithinWhere matches the SQL: posting date, else import date', () => {
    const keep = dateWindowFilter(postedWithinWhere(48))!
    expect(keep({ postedAt: h(47), createdAt: h(500) })).toBe(true)
    expect(keep({ postedAt: h(49), createdAt: h(1) })).toBe(false)
    expect(keep({ postedAt: null, createdAt: h(10) })).toBe(true)
    expect(keep({ postedAt: null, createdAt: h(50) })).toBe(false)
  })

  it('{ createdAt: { gte } } (Job Search Daily) is the import date only', () => {
    const keep = dateWindowFilter({ createdAt: { gte: h(24) } })!
    expect(keep({ postedAt: h(500), createdAt: h(23) })).toBe(true)
    expect(keep({ postedAt: h(1), createdAt: h(25) })).toBe(false)
  })

  it('splits the email wheres (with and without the mid-level window) into level part + window', () => {
    for (const w of [postedWithinWhere(72), { createdAt: { gte: h(24) } }]) {
      const withWindow = splitBoardWhere(boardLevelWindowWhere(w, false))!
      expect(withWindow.windows).toHaveLength(1)
      expect(levelOnlyFilter(withWindow.levelWhere)!({ level: 'MID_IC' })).toBe(false)
      const midIncluded = splitBoardWhere(boardLevelWindowWhere(w, true))!
      expect(midIncluded.levelWhere).toBeUndefined()
      expect(midIncluded.windows).toHaveLength(1)
    }
  })

  it('leaves other date shapes to the database', () => {
    expect(dateWindowFilter({ createdAt: { gt: h(1) } })).toBeNull()
    expect(dateWindowFilter({ createdAt: { gte: h(1), lt: h(0) } })).toBeNull()
    expect(dateWindowFilter({ OR: [{ postedAt: { gte: h(2) } }, { postedAt: null, createdAt: { gte: h(3) } }] })).toBeNull()
    expect(splitBoardWhere({ AND: [postedWithinWhere(1), { title: 'x' }] })).toBeNull()
    expect(splitBoardWhere({ title: 'x' })).toBeNull()
  })
})

describe('BoardLightRow copy', () => {
  it('answers wheres on its own columns only', () => {
    expect(mirrorCanAnswer(undefined)).toBe(true)
    expect(mirrorCanAnswer({ status: 'approved', archivedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }], AND: [{ level: { in: ['VP'] } }] })).toBe(true)
    expect(mirrorCanAnswer({ NOT: { distribution: 'EXCLUDED' } })).toBe(true)
    expect(mirrorCanAnswer({ description: { contains: 'x' } })).toBe(false)
    expect(mirrorCanAnswer({ AND: [{ company: { is: { name: 'x' } } }] })).toBe(false)
    expect(mirrorCanAnswer({ lastConfirmedAt: null })).toBe(false)
  })

  it('BOARD_LIGHT_ROWS=off turns it off', () => {
    expect(mirrorDisabledByEnv({ BOARD_LIGHT_ROWS: 'off' })).toBe(true)
    expect(mirrorDisabledByEnv({})).toBe(false)
  })
})

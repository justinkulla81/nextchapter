import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { CAPABILITIES } from '@/lib/vision/capabilities'
import { COMPETITOR_AREAS } from '@/lib/vision/competitor-areas'
import { validateImport, cellsSql, catalogSql } from '@/lib/vision/capability-import'
import { isStale, summarize, defaultColumns, parseColumnIds, looksLikeMissingTable, cleanHttpsUrl } from '@/lib/vision/capability-matrix'

const root = process.cwd()
const areaKeys = new Set<string>(COMPETITOR_AREAS.map((a) => a.key))

describe('capability catalog', () => {
  it('has unique keys', () => {
    const keys = CAPABILITIES.map((c) => c.key)
    expect(new Set(keys).size).toBe(keys.length)
  })
  it('uses only areas from the competitor vocabulary', () => {
    for (const c of CAPABILITIES) expect(areaKeys.has(c.area), `${c.key}: ${c.area}`).toBe(true)
  })
  it('has evidence on disk for every BUILT and PARTIAL capability', () => {
    for (const c of CAPABILITIES.filter((x) => x.ours !== 'PLANNED')) {
      expect(existsSync(join(root, c.evidencePath)), `${c.key}: ${c.evidencePath}`).toBe(true)
    }
  })
  it('points PLANNED capabilities at a document', () => {
    for (const c of CAPABILITIES.filter((x) => x.ours === 'PLANNED')) expect(existsSync(join(root, c.evidencePath)), c.key).toBe(true)
  })
  it('has a name and a one-line description for each, with no comparative claims', () => {
    for (const c of CAPABILITIES) {
      expect(c.name.length).toBeGreaterThan(2)
      expect(c.description.length).toBeGreaterThan(10)
      expect(c.description, c.key).not.toMatch(/\b(only|first|unlike|no other|better than)\b/i)
      expect(c.name, c.key).not.toMatch(/\b(only|first|unlike)\b/i)
    }
  })
  it('has every area represented at least once', () => {
    const used = new Set(CAPABILITIES.map((c) => c.area))
    for (const a of ['coaching', 'job_search', 'outplacement', 'higher_ed', 'workforce_system', 'platform', 'recruiters', 'employer_hiring']) expect(used.has(a)).toBe(true)
  })
})

describe('isStale', () => {
  const now = new Date('2026-10-23T12:00:00Z')
  it('is stale when never checked', () => {
    expect(isStale(null, now)).toBe(true)
    expect(isStale(undefined, now)).toBe(true)
  })
  it('is fresh at 90 days and stale after', () => {
    expect(isStale(new Date('2026-07-25T12:00:00Z'), now)).toBe(false)
    expect(isStale(new Date('2026-07-24T11:00:00Z'), now)).toBe(true)
  })
  it('is fresh when recent and stale for an unparsable string', () => {
    expect(isStale(new Date('2026-10-01'), now)).toBe(false)
    expect(isStale('not a date', now)).toBe(true)
  })
})

describe('summarize', () => {
  const caps = [
    { key: 'a', ours: 'BUILT' as const },
    { key: 'b', ours: 'BUILT' as const },
    { key: 'c', ours: 'PARTIAL' as const },
    { key: 'd', ours: 'PLANNED' as const },
  ]
  it('counts filled cells, coverage of our built capabilities and the oldest check', () => {
    const cells = new Map([
      ['a', { status: 'YES' as const, checkedAt: new Date('2026-09-01') }],
      ['b', { status: 'NO' as const, checkedAt: new Date('2026-08-01') }],
      ['c', { status: 'PARTIAL' as const, checkedAt: new Date('2026-10-01') }],
    ])
    const s = summarize(caps, cells)
    expect(s.filled).toBe(3)
    expect(s.total).toBe(4)
    expect(s.coveragePct).toBe(50)
    expect(s.oldestCheckedAt?.toISOString().slice(0, 10)).toBe('2026-08-01')
  })
  it('treats unknown as unfilled and handles no built capabilities', () => {
    expect(summarize(caps, new Map()).filled).toBe(0)
    expect(summarize([{ key: 'x', ours: 'PLANNED' }], new Map()).coveragePct).toBeNull()
  })
  it('flags a filled cell with no date', () => {
    expect(summarize(caps, new Map([['a', { status: 'YES' as const, checkedAt: null }]])).anyUnchecked).toBe(true)
  })
})

describe('database helpers', () => {
  it('recognises a missing table', () => {
    expect(looksLikeMissingTable({ code: 'P2021' })).toBe(true)
    expect(looksLikeMissingTable(new Error('relation "ProductCapability" does not exist'))).toBe(true)
    expect(looksLikeMissingTable(new Error('timeout'))).toBe(false)
  })
  it('accepts only https links', () => {
    expect(cleanHttpsUrl('https://a.com/x')).toBe('https://a.com/x')
    expect(cleanHttpsUrl('http://a.com')).toBeUndefined()
    expect(cleanHttpsUrl('javascript:alert(1)')).toBeUndefined()
    expect(cleanHttpsUrl('')).toBeUndefined()
  })
})

describe('column choice', () => {
  const list = [
    { id: '1', name: 'B', relationship: 'ADJACENT', filled: 9 },
    { id: '2', name: 'A', relationship: 'DIRECT', filled: 1 },
    { id: '3', name: 'C', relationship: 'DIRECT', filled: 5 },
    { id: '4', name: 'D', relationship: 'PARTNER', filled: 20 },
  ]
  it('puts DIRECT first, then most filled, and drops partners', () => {
    expect(defaultColumns(list).map((c) => c.id)).toEqual(['3', '2', '1'])
  })
  it('caps the count', () => {
    expect(defaultColumns(list, 1)).toHaveLength(1)
  })
  it('keeps only known ids from the query', () => {
    expect(parseColumnIds('1,zz,1,2', new Set(['1', '2']))).toEqual(['1', '2'])
    expect(parseColumnIds(undefined, new Set(['1']))).toEqual([])
  })
})

describe('import validator', () => {
  const good = { competitor: 'Acme', cells: [{ capabilityKey: 'job_board', status: 'YES', evidenceUrl: 'https://acme.com/jobs', checkedAt: '2026-10-20' }] }
  const now = new Date('2026-10-23T00:00:00Z')
  it('accepts a good file', () => {
    expect(validateImport(good, 'f', now).ok).toBe(true)
  })
  it('accepts UNKNOWN without evidence', () => {
    expect(validateImport({ competitor: 'Acme', cells: [{ capabilityKey: 'job_board', status: 'UNKNOWN' }] }, 'f', now).ok).toBe(true)
  })
  it('rejects an unknown capability key', () => {
    expect(validateImport({ competitor: 'Acme', cells: [{ capabilityKey: 'nope', status: 'UNKNOWN' }] }, 'f', now).errors[0]).toMatch(/unknown capabilityKey/)
  })
  it('rejects a bad status', () => {
    expect(validateImport({ competitor: 'Acme', cells: [{ capabilityKey: 'job_board', status: 'MAYBE' }] }, 'f', now).ok).toBe(false)
  })
  it('requires an https evidence url and a date for YES, PARTIAL and NO', () => {
    for (const status of ['YES', 'PARTIAL', 'NO']) {
      expect(validateImport({ competitor: 'A', cells: [{ capabilityKey: 'job_board', status }] }, 'f', now).errors.length).toBe(2)
    }
    const http = validateImport({ competitor: 'A', cells: [{ capabilityKey: 'job_board', status: 'NO', evidenceUrl: 'http://a.com/x', checkedAt: '2026-10-01' }] }, 'f', now)
    expect(http.ok).toBe(false)
    expect(http.errors[0]).toMatch(/https/)
  })
  it('rejects javascript: urls, future dates, duplicates and a missing competitor', () => {
    expect(validateImport({ competitor: 'A', cells: [{ capabilityKey: 'job_board', status: 'YES', evidenceUrl: 'javascript:alert(1)', checkedAt: '2026-10-01' }] }, 'f', now).ok).toBe(false)
    expect(validateImport({ competitor: 'A', cells: [{ capabilityKey: 'job_board', status: 'YES', evidenceUrl: 'https://a.com', checkedAt: '2027-01-01' }] }, 'f', now).ok).toBe(false)
    expect(validateImport({ competitor: 'A', cells: [{ capabilityKey: 'job_board', status: 'UNKNOWN' }, { capabilityKey: 'job_board', status: 'UNKNOWN' }] }, 'f', now).ok).toBe(false)
    expect(validateImport({ cells: [] }, 'f', now).ok).toBe(false)
    expect(validateImport(null, 'f', now).ok).toBe(false)
  })
  it('writes SQL that escapes quotes and only upserts', () => {
    const r = validateImport({ competitor: "O'Brien Co", cells: [{ capabilityKey: 'job_board', status: 'YES', note: "it's there", evidenceUrl: 'https://a.com/x', checkedAt: '2026-10-20' }] }, 'f', now)
    const sql = cellsSql(r.file!)
    expect(sql).toContain("'O''Brien Co'")
    expect(sql).toContain("'it''s there'")
    expect(sql).toContain('ON CONFLICT ("competitorId","capabilityId") DO UPDATE')
    expect(sql).not.toMatch(/\b(DELETE|DROP|TRUNCATE)\b/i)
  })
  it('gives each cell its own id', () => {
    const r = validateImport({ competitor: 'Acme', cells: [{ capabilityKey: 'job_board', status: 'UNKNOWN' }, { capabilityKey: 'job_fit_score', status: 'UNKNOWN' }] }, 'f', now)
    const ids = [...cellsSql(r.file!).matchAll(/SELECT '(cc_[0-9a-f]+)'/g)].map((m) => m[1])
    expect(new Set(ids).size).toBe(2)
  })
  it('writes a catalog upsert for every capability', () => {
    expect((catalogSql().match(/INSERT INTO "ProductCapability"/g) ?? []).length).toBe(CAPABILITIES.length)
  })
  it('validates every real file in data/competitor-matrix, including the sample', () => {
    const dir = join(root, 'data', 'competitor-matrix')
    for (const f of readdirSync(dir).filter((x) => x.endsWith('.json'))) {
      const r = validateImport(JSON.parse(readFileSync(join(dir, f), 'utf8')), f)
      expect(r.errors, f).toEqual([])
    }
  })
})

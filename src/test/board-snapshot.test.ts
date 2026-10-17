import { describe, it, expect, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/prisma', () => ({ prisma: {} }))

import { decodeBoardPart, decodeOccupations, encodeBoardPart, encodeOccupations, LIGHT_COLUMNS } from '@/lib/jobs/board-snapshot-codec'
import { LIGHT_SELECT, type LightRow } from '@/lib/jobs/board-light-rows'
import { stillLive } from '@/lib/jobs/board-shortlist'
import { LIKELY_AGE_DAYS, LIKELY_PRIOR_CLOSURES } from '@/lib/jobs/ghost-risk'
import type { JobOccupations } from '@/lib/jobs/search-breadth-server'

const DAY = 86_400_000
const NOW = Date.UTC(2026, 9, 17, 12)

function row(id: string, over: Partial<LightRow> = {}): LightRow {
  return {
    id,
    title: `Director of Finance ${id}`,
    companyName: 'Acme Corp',
    audienceTier: 'PUBLIC',
    source: 'crawler',
    targetFunction: null,
    targetLevel: null,
    targetRemotePolicy: 'remote',
    targetLocation: null,
    location: 'Austin, TX',
    level: 'DIRECTOR',
    sourceCategory: null,
    postedAt: new Date(NOW - 3 * DAY),
    sourceCount: 2,
    salaryMin: 150000,
    salaryMax: null,
    createdAt: new Date(NOW - 2 * DAY),
    employmentType: 'full_time',
    employerSector: null,
    requirementTags: 'clearance',
    ...over,
  }
}

describe('board snapshot codec', () => {
  it('writes every light column', () => {
    expect([...LIGHT_COLUMNS].sort()).toEqual(Object.keys(LIGHT_SELECT).sort())
  })

  it('round-trips rows exactly: values, nulls, dates, key order, expiry and prior closures', () => {
    const rows = [row('a'), row('b', { companyName: 'Beta', location: null, postedAt: null, salaryMin: null, salaryMax: 0, level: null }), row('c')]
    const part = { rows, expires: [NOW + DAY, null, NOW - 1], priors: [0, 1, 0] }
    const decoded = decodeBoardPart(JSON.parse(JSON.stringify(encodeBoardPart(part))))!
    expect(decoded.rows).toEqual(rows)
    expect(decoded.rows.map((r) => Object.keys(r))).toEqual(rows.map((r) => Object.keys(r)))
    expect(decoded.rows[0].createdAt).toBeInstanceOf(Date)
    expect(decoded.expires).toEqual(part.expires)
    expect(decoded.priors).toEqual(part.priors)
    expect(decoded.titleFns).toBeUndefined()
  })

  it('carries each title\'s function when written', () => {
    const part = { rows: [row('a'), row('b')], expires: [null, null], priors: [0, 0], titleFns: ['Finance', null] }
    expect(decodeBoardPart(JSON.parse(JSON.stringify(encodeBoardPart(part))))!.titleFns).toEqual(['Finance', null])
  })

  it('shares one string per repeated value', () => {
    const pool = new Map<string, string>()
    const a = decodeBoardPart(JSON.parse(JSON.stringify(encodeBoardPart({ rows: [row('a')], expires: [null], priors: [0] }))), pool)!
    const b = decodeBoardPart(JSON.parse(JSON.stringify(encodeBoardPart({ rows: [row('b')], expires: [null], priors: [0] }))), pool)!
    expect(a.rows[0].companyName).toBe(b.rows[0].companyName)
    expect(pool.get('Acme Corp')).toBe('Acme Corp')
  })

  it('refuses a part written for other columns', () => {
    const e = encodeBoardPart({ rows: [row('a')], expires: [null], priors: [0] })
    expect(decodeBoardPart({ ...e, cols: [...e.cols, 'extra'] })).toBeNull()
    expect(decodeBoardPart({ ...e, v: 3 })).toBeNull()
  })

  it('round-trips the job-occupation maps, in id order', () => {
    const o: JobOccupations = {
      socs: new Map([['b', '11-3031.00'], ['a', '13-2011.00']]),
      subs: new Map([['c', 'fpa']]),
      industries: new Map([['a', 'healthcare']]),
      skills: new Map([['a', ['excel', 'sql']]]),
      skillIds: new Map([['b', ['2.A.1.a']]]),
    }
    const d = decodeOccupations(JSON.parse(JSON.stringify(encodeOccupations(o))))!
    expect(d.socs).toEqual(o.socs)
    expect([...d.socs.keys()]).toEqual(['a', 'b'])
    expect(d.subs).toEqual(o.subs)
    expect(d.industries).toEqual(o.industries)
    expect(d.skills).toEqual(o.skills)
    expect(d.skillIds).toEqual(o.skillIds)
  })
})

describe('stillLive: a held board brought up to now, as a fresh read would give it', () => {
  const board = (rows: LightRow[], expires: number[], priors: number[]) => ({ rows, expires: Float64Array.from(expires), priors: Uint32Array.from(priors) })

  it('keeps the same object when nothing expired or aged out', () => {
    const b = board([row('a'), row('b')], [NOW + DAY, NaN], [0, 1])
    expect(stillLive(b, NOW)).toBe(b)
  })

  it('drops jobs that expired (expiresAt > now keeps, as the board query does)', () => {
    const b = board([row('a'), row('b'), row('c')], [NOW, NOW - 1, NaN], [0, 0, 0])
    expect(stillLive(b, NOW).rows.map((r) => r.id)).toEqual(['c'])
  })

  it('drops jobs that aged into likely ghost risk, with the prior closures they were read with', () => {
    const old = row('old', { createdAt: new Date(NOW - (LIKELY_AGE_DAYS + 0.5) * DAY) })
    const edge = row('edge', { createdAt: new Date(NOW - LIKELY_AGE_DAYS * DAY) })
    const reposted = row('rep')
    const b = board([old, edge, reposted], [NaN, NaN, NaN], [0, 1, LIKELY_PRIOR_CLOSURES])
    const out = stillLive(b, NOW)
    expect(out.rows.map((r) => r.id)).toEqual(['edge'])
    expect(Array.from(out.priors)).toEqual([1])
  })
})

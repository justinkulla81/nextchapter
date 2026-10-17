import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { cleanCushion, cleanEvent } from '@/lib/career-story/validate'
import { MIN_CELL, peerView, roundPeers } from '@/lib/career-story/peers'

const now = new Date('2026-10-17T12:00:00Z')
const ok = { kind: 'PAUSE', label: 'Caring for family', detail: '', start: '2022-03-01', end: '2022-09-01', reason: 'FAMILY' }

describe('adding or correcting a chapter', () => {
  it('accepts a normal pause and keeps the reason', () => {
    const r = cleanEvent(ok, now)
    expect(r.ok && r.value.reason).toBe('FAMILY')
  })
  it('does not keep a reason on anything but a pause', () => {
    const r = cleanEvent({ ...ok, kind: 'VENTURE' }, now)
    expect(r.ok && r.value.reason).toBeNull()
  })
  it('explains each problem in plain words', () => {
    expect(cleanEvent({ ...ok, label: '  ' }, now)).toMatchObject({ ok: false, error: expect.stringContaining('short name') })
    expect(cleanEvent({ ...ok, start: '' }, now)).toMatchObject({ ok: false, error: expect.stringContaining('start date') })
    expect(cleanEvent({ ...ok, end: '2022-01-01' }, now)).toMatchObject({ ok: false, error: expect.stringContaining('before the start') })
    expect(cleanEvent({ ...ok, start: '2022-02-31' }, now)).toMatchObject({ ok: false })
    expect(cleanEvent({ ...ok, label: 'x'.repeat(81) }, now)).toMatchObject({ ok: false })
    expect(cleanEvent({ ...ok, kind: 'NOPE' }, now)).toMatchObject({ ok: false })
  })
  it('ignores an end date on a single-day moment', () => {
    const r = cleanEvent({ ...ok, kind: 'MILESTONE', end: '2023-01-01' }, now)
    expect(r.ok && r.value.end).toBeNull()
  })
  it('does not accept a start more than a year ahead', () => {
    expect(cleanEvent({ ...ok, start: '2030-01-01', end: '' }, now).ok).toBe(false)
  })
})

describe('the savings number', () => {
  it('allows empty (clear), rough numbers and rounds to half months', () => {
    expect(cleanCushion('')).toEqual({ ok: true, value: null })
    expect(cleanCushion('4.3')).toEqual({ ok: true, value: 4.5 })
  })
  it('rejects nonsense', () => {
    expect(cleanCushion('abc').ok).toBe(false)
    expect(cleanCushion('-1').ok).toBe(false)
    expect(cleanCushion('120').ok).toBe(false)
  })
})

describe('people like you', () => {
  it('shows nothing for a small group', () => {
    expect(peerView(12, [{ function: 'Finance', people: 11 }]).enough).toBe(false)
  })
  it('drops cells under the minimum and rounds small counts to 5', () => {
    const v = peerView(200, [{ function: 'A', people: MIN_CELL - 1 }, { function: 'B', people: 13 }, { function: 'C', people: 80 }])
    expect(v.rows.map((r) => r.function)).toEqual(['C', 'B'])
    expect(v.rows.find((r) => r.function === 'B')).toMatchObject({ people: 15, approx: true })
    expect(v.rows.find((r) => r.function === 'C')).toMatchObject({ people: 80, approx: false })
    expect(roundPeers(49)).toBe(50)
  })
})

function walk(dir: string, out: string[] = []): string[] {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(ts|tsx)$/.test(f)) out.push(p)
  }
  return out
}

describe('career events stay private to the member', () => {
  it('are read only by the career story code', () => {
    const readers = walk('src')
      .filter((f) => !f.startsWith(join('src', 'test')))
      .filter((f) => /careerEvent\b/.test(readFileSync(f, 'utf8')))
      .map((f) => f.replaceAll('\\', '/'))
      .sort()
    expect(readers).toEqual(['src/app/dashboard/my-career/actions.ts', 'src/lib/career-story/load.ts'])
  })
})

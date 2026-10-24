import { describe, it, expect } from 'vitest'
import { cleanEvents, cleanProposals, eventsFromDiff, fitsCap, monthStart, pickDue, unionNamed } from '@/lib/vision/competitor-watch-core'

const now = new Date('2026-10-24T12:00:00Z')
const card = (o: Partial<Parameters<typeof pickDue>[0][number]> & { id: string }) => ({ status: 'ACTIVE', url: 'https://x.com', relationship: 'DIRECT', watchRefreshedAt: null, watchNewsAt: null, ...o })

describe('spend cap', () => {
  it('refuses a call that would cross the cap, and everything when cap is 0', () => {
    expect(fitsCap(10, 50, 'refresh')).toBe(true)
    expect(fitsCap(49.99, 50, 'news')).toBe(false)
    expect(fitsCap(0, 0, 'news')).toBe(false)
  })
  it('month starts on the 1st UTC', () => expect(monthStart(now).toISOString()).toBe('2026-10-01T00:00:00.000Z'))
})

describe('pickDue', () => {
  it('refresh: active with a site, 30 days, oldest first', () => {
    const old = new Date('2026-08-01'), recent = new Date('2026-10-20')
    const due = pickDue([card({ id: 'a', watchRefreshedAt: recent }), card({ id: 'b', watchRefreshedAt: old }), card({ id: 'c' }), card({ id: 'd', status: 'SHUT_DOWN' }), card({ id: 'e', url: null })], 'refresh', now, 10)
    expect(due.map((d) => d.id)).toEqual(['c', 'b'])
  })
  it('news: only direct and adjacent, weekly', () => {
    const due = pickDue([card({ id: 'a', relationship: 'PARTNER' }), card({ id: 'b', relationship: 'ADJACENT' }), card({ id: 'c', watchNewsAt: new Date('2026-10-22') })], 'news', now, 10)
    expect(due.map((d) => d.id)).toEqual(['b'])
  })
  it('respects the batch limit', () => expect(pickDue([card({ id: 'a' }), card({ id: 'b' })], 'refresh', now, 1)).toHaveLength(1))
})

describe('cleanEvents', () => {
  it('drops items with no link or unknown kind, and dedupes by link', () => {
    const out = cleanEvents([
      { kind: 'funding', title: 'Raised $10M', url: 'https://news.com/a', date: '2026-10-20', amountUsd: 1e7 },
      { kind: 'FUNDING', title: 'Raised $10M again', url: 'https://www.news.com/a/' },
      { kind: 'NEWS', title: 'No link' },
      { kind: 'GOSSIP', title: 'x', url: 'https://a.com' },
      { kind: 'LAYOFF', title: 'Cut 20%', url: 'javascript:alert(1)' },
    ], now)
    expect(out).toHaveLength(1)
    expect(out[0].kind).toBe('FUNDING')
  })
  it('drops stale dated items', () => expect(cleanEvents([{ kind: 'NEWS', title: 'Old', url: 'https://a.com/x', date: '2024-01-01' }], now, 45)).toHaveLength(0))
})

describe('cleanProposals', () => {
  const keys = new Set(['coach', 'resume'])
  it('needs a known key, a real status and https evidence', () => {
    const out = cleanProposals([
      { key: 'coach', status: 'yes', evidenceUrl: 'https://x.com/coach' },
      { key: 'resume', status: 'UNKNOWN', evidenceUrl: 'https://x.com/r' },
      { key: 'nope', status: 'YES', evidenceUrl: 'https://x.com' },
      { key: 'resume', status: 'NO', evidenceUrl: 'http://x.com/r' },
    ], keys)
    expect(out).toEqual([{ key: 'coach', status: 'YES', evidenceUrl: 'https://x.com/coach', note: null }])
  })
})

describe('eventsFromDiff and merge', () => {
  it('reports new logos, wins, rounds and status changes only', () => {
    const ev = eventsFromDiff(
      { customers: [{ name: 'Acme' }], wins: [], lastRound: '$5M Seed', status: 'ACTIVE' },
      { customers: [{ name: 'Acme' }, { name: 'Globex', url: 'https://g.com' }], wins: [{ what: 'DOL grant', buyer: 'DOL' }], lastRound: '$20M Series A, 2026', status: 'ACQUIRED', statusNote: 'Bought by X', sourceUrl: 'https://p.com' },
    )
    expect(ev.map((e) => e.kind).sort()).toEqual(['ACQUISITION', 'FUNDING', 'LOGO', 'WIN'])
  })
  it('a refresh never deletes: union keeps existing entries', () => {
    expect(unionNamed([{ name: 'Acme' }], [{ name: 'acme!' }, { name: 'New' }], 10).map((x) => x.name)).toEqual(['Acme', 'New'])
  })
})

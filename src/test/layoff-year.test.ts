import { describe, it, expect } from 'vitest'
import { buildLayoffYear } from '@/lib/companies/layoff-year'

const now = new Date('2026-10-15T00:00:00Z')
const ago = (d: number) => new Date(now.getTime() - d * 86_400_000)
const mention = (d: number, employees: number | null, noticeId: string | null = null) =>
  ({ noticeId, publishedAt: ago(d), employees, publisher: 'x' })

describe('buildLayoffYear', () => {
  it('counts filings in the past year only', () => {
    const r = buildLayoffYear({ now, mentions: [], notices: [
      { noticeDate: ago(30), employees: 200 }, { noticeDate: ago(400), employees: 999 },
    ] })
    expect(r).toMatchObject({ events: 1, employees: 200, fromFilings: 200, filingEvents: 1 })
  })

  it('counts several outlets on one story once, at the most-reported number', () => {
    const r = buildLayoffYear({ now, notices: [], mentions: [mention(100, 275), mention(99, 275), mention(98, 300), mention(98, null)] })
    expect(r).toMatchObject({ events: 1, employees: 275, newsOnlyEvents: 1, fromNewsOnly: 275 })
  })

  it('does not add news already covered by a filing or linked to one', () => {
    const r = buildLayoffYear({ now, notices: [{ noticeDate: ago(60), employees: 120 }], mentions: [mention(50, 150), mention(200, 80, 'n1')] })
    expect(r).toMatchObject({ events: 1, employees: 120, newsOnlyEvents: 0 })
  })

  it('keeps separate rounds apart and flags events with no number', () => {
    const r = buildLayoffYear({ now, notices: [], mentions: [mention(300, 100), mention(120, null)] })
    expect(r).toMatchObject({ events: 2, employees: 100, unstated: 1 })
  })

  it('ignores undated mentions', () => {
    const r = buildLayoffYear({ now, notices: [], mentions: [{ noticeId: null, publishedAt: null, employees: 50, publisher: null }] })
    expect(r.events).toBe(0)
  })
})

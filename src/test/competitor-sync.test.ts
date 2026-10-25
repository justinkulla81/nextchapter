import { describe, it, expect } from 'vitest'
import { addSeenAt, downloadEmail, gapIdeas, winsFromAwards, winsFromCard } from '@/lib/vision/competitor-sync-core'

const now = new Date('2026-10-25T12:00:00Z')

describe('product gap ideas', () => {
  it('keeps real, new, deduped ideas and skips existing titles', () => {
    expect(gapIdeas(['Resume builder with ATS scoring.', 'resume builder with ats scoring', 'x', 'Skills-based job matching'], ['Skills based job matching'])).toEqual(['Resume builder with ATS scoring'])
  })
  it('adds a competitor to the seen-at line once', () => {
    const b = addSeenAt(null, 'Acme')
    expect(b).toBe('Seen at competitors: Acme')
    expect(addSeenAt(b, 'Globex')).toBe('Seen at competitors: Acme, Globex')
    expect(addSeenAt(b, 'acme')).toBe(b)
  })
})

describe('wins to CRM', () => {
  const a = { awardKey: 'k1', description: 'Career services for dislocated workers', agency: 'Department of Labor', subAgency: 'Employment and Training Administration', amount: 1_200_000, startDate: new Date('2024-01-01'), endDate: new Date('2027-06-30'), url: 'https://www.usaspending.gov/award/1' }
  it('past award gives a dated win and a future end date gives a re-bid date', () => {
    const [w] = winsFromAwards('Acme', [a], now)
    expect(w.buyer).toBe('Employment and Training Administration')
    expect(w.rebidAt?.toISOString().slice(0, 10)).toBe('2027-06-30')
    expect(w.ref).toBe('competitor-win:k1')
  })
  it('an ended contract has no re-bid date', () => expect(winsFromAwards('Acme', [{ ...a, endDate: new Date('2025-01-01') }], now)[0].rebidAt).toBeNull())
  it('card wins need a named buyer; the year dates them', () => {
    const w = winsFromCard('Acme', [{ what: 'State career portal', buyer: 'State of Ohio', year: '2025' }, { what: 'No buyer' }])
    expect(w).toHaveLength(1)
    expect(w[0].when?.getUTCFullYear()).toBe(2025)
  })
})

describe('download email', () => {
  it('lists strengths, weaknesses, gaps and wins, escaped', () => {
    const { subject, html } = downloadEmail({
      name: 'Acme <b>', url: 'https://acme.com', relationship: 'DIRECT', segment: null, positioning: 'Coaching', status: 'ACTIVE', statusNote: null, hq: null, foundedYear: null, headcount: 50,
      fundingRaisedUsd: 12_000_000, lastRound: null, investors: null, revenueNote: null, userCountNote: null, pricingNote: null, keyFeatures: [], customers: [{ name: 'Globex' }],
      wins: [{ what: 'DOL grant', buyer: 'DOL', year: '2025' }], weWin: ['Price'], theyWin: ['Brand'], weNeed: ['Mobile app'], lessons: [], partnerIdea: null, notes: null, sourceUrl: null,
    }, 'https://x/y')
    expect(subject).toContain('Acme')
    expect(html).toContain('Where they are stronger')
    expect(html).toContain('DOL grant — DOL — 2025')
    expect(html).toContain('Mobile app')
    expect(html).not.toContain('<b>')
  })
})

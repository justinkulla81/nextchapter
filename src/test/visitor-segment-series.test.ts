import { describe, expect, it } from 'vitest'
import { segmentRangeSeries, tallySegment } from '@/lib/admin/visitor-segment-series'
import { sourceSegment } from '@/lib/admin/visitor-source-segment'

// Mon 2026-10-26 20:00 ET = 2026-10-27T00:00Z.
const NOW = new Date('2026-10-27T01:00:00Z')

describe('segment series', () => {
  it('counts views and distinct IPs per bucket, skipping missing IPs from the unique count', () => {
    const t = tallySegment([
      { key: '2026-10-26', ip: 'a', views: 3 },
      { key: '2026-10-26', ip: 'b', views: 1 },
      { key: '2026-10-26', ip: null, views: 2 },
    ])
    expect(t.views.get('2026-10-26')).toBe(6)
    expect(t.visitors.get('2026-10-26')).toBe(2)
  })

  it('builds zero-filled series for every range', () => {
    const s = segmentRangeSeries(
      [{ key: '2026-10-26', ip: 'a', views: 4 }],
      [{ key: '2026-10-26 20', ip: 'a', views: 4 }],
      NOW,
      45
    )
    expect(s.views.day).toHaveLength(24)
    expect(s.views.day.at(-2)).toEqual({ key: '2026-10-26 20', count: 4 })
    expect(s.views['7d']).toHaveLength(7)
    expect(s.views['7d'].at(-1)).toEqual({ key: '2026-10-26', count: 4 })
    expect(s.visitors['30d'].at(-1)).toEqual({ key: '2026-10-26', count: 1 })
    expect(s.views.all).toHaveLength(45)
    expect(s.views['7d'][0].count).toBe(0)
  })
})

describe('sourceSegment', () => {
  it('splits LinkedIn from other social networks', () => {
    expect(sourceSegment(null, 'www.linkedin.com', false)).toBe('LinkedIn')
    expect(sourceSegment('linkedin', null, false)).toBe('LinkedIn')
    expect(sourceSegment(null, 'lnkd.in', false)).toBe('LinkedIn')
    expect(sourceSegment(null, 'www.facebook.com', false)).toBe('Social media')
    expect(sourceSegment('bluesky', null, false)).toBe('Social media')
  })

  it('counts email by utm, web mail referrer and tracked email links', () => {
    expect(sourceSegment('email', null, false)).toBe('Email')
    expect(sourceSegment(null, 'mail.google.com', false)).toBe('Email')
    expect(sourceSegment(null, null, true)).toBe('Email')
  })

  it('leaves other sources out', () => {
    expect(sourceSegment(null, 'www.google.com', false)).toBeNull()
    expect(sourceSegment(null, null, false)).toBeNull()
    expect(sourceSegment(null, 'launchyournextchapter.com', false)).toBeNull()
  })
})

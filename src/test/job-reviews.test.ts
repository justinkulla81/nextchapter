import { describe, expect, it } from 'vitest'
import { answeredCount, cleanParallelPaths, cleanReview } from '@/lib/job-reviews/constants'
import { insightNarrative, insightTier } from '@/lib/reports/community-tier'

describe('cleanReview', () => {
  it('keeps known values and drops unknown ones', () => {
    const r = cleanReview({ hiredVia: 'REFERRAL', workerType: 'W3', employerRating: 4, wouldRecommend: 'YES', liked: ['PAY', 'NOPE'], disliked: ['MANAGER'] })
    expect(r).toEqual({ hiredVia: 'REFERRAL', workerType: null, employerRating: 4, wouldRecommend: 'YES', liked: ['PAY'], disliked: ['MANAGER'] })
  })
  it('rejects out-of-range or non-integer ratings', () => {
    for (const bad of [0, 6, 3.5, '4', null]) expect(cleanReview({ employerRating: bad }).employerRating).toBeNull()
  })
  it('keeps a topic under liked when it arrives in both lists', () => {
    const r = cleanReview({ liked: ['PAY'], disliked: ['PAY', 'TEAM'] })
    expect(r.liked).toEqual(['PAY'])
    expect(r.disliked).toEqual(['TEAM'])
  })
  it('survives garbage input', () => {
    expect(answeredCount(cleanReview(null))).toBe(0)
    expect(answeredCount(cleanReview('x'))).toBe(0)
  })
  it('counts each answered question once', () => {
    expect(answeredCount(cleanReview({ hiredVia: 'OTHER', liked: ['PAY', 'TEAM'] }))).toBe(2)
  })
})

describe('cleanParallelPaths', () => {
  it('dedupes and filters', () => {
    expect(cleanParallelPaths(['CONTRACT_1099', 'CONTRACT_1099', 'x'])).toEqual(['CONTRACT_1099'])
    expect(cleanParallelPaths('nope')).toEqual([])
  })
})

describe('insight tier', () => {
  it('is empty with nothing contributed, then climbs', () => {
    expect(insightTier(0)).toBeNull()
    expect(insightNarrative(0)).toBeNull()
    expect(insightTier(1)).toBe('contributor')
    expect(insightTier(3)).toBe('trusted')
    expect(insightTier(8)).toBe('go_to')
  })
  it('never puts the count in the copy', () => {
    for (const n of [1, 3, 8]) expect(insightNarrative(n)).not.toMatch(/\d/)
  })
})

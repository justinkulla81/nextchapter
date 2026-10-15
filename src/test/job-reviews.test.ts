import { describe, expect, it } from 'vitest'
import { answeredCount, cleanParallelPaths, cleanReview } from '@/lib/job-reviews/constants'
import { insightNarrative, insightTier } from '@/lib/reports/community-tier'
import { summarizeReviews, type ReviewRow } from '@/lib/job-reviews/aggregate'

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

describe('summarizeReviews — privacy floor', () => {
  const at = new Date('2026-01-01')
  const row = (candidateId: string, review: Record<string, unknown>, excluded = false, updatedAt = at): ReviewRow => ({ candidateId, review, updatedAt, excluded })
  const three = [
    row('a', { employerRating: 5, wouldRecommend: 'YES', hiredVia: 'REFERRAL', liked: ['PAY', 'TEAM'], disliked: ['MANAGER'] }),
    row('b', { employerRating: 4, wouldRecommend: 'YES', hiredVia: 'REFERRAL', liked: ['PAY'], disliked: ['MANAGER'] }),
    row('c', { employerRating: 3, wouldRecommend: 'DEPENDS', hiredVia: 'JOB_BOARD', liked: ['TEAM'] }),
  ]

  it('shows nothing below 3 reviewers, but reports the count for "N of 3"', () => {
    const s = summarizeReviews('co', three.slice(0, 2), null)
    expect(s.shown).toBe(false)
    expect(s.respondentCount).toBe(2)
    expect(s.rating).toBeNull()
  })

  it('shows combined answers at 3 reviewers', () => {
    const s = summarizeReviews('co', three, null)
    expect(s.shown).toBe(true)
    expect(s.rating).toEqual({ average: 4, count: 3 })
    expect(s.recommend?.map((x) => [x.value, x.percent])).toEqual([['YES', 67], ['DEPENDS', 33]])
    expect(s.hiredVia?.[0]).toMatchObject({ value: 'REFERRAL', percent: 67 })
  })

  it("drops the viewer's own review so they can't subtract it to read the others", () => {
    const rows = [...three.slice(0, 2), row('viewer', { employerRating: 1 })]
    expect(summarizeReviews('co', rows, 'viewer').shown).toBe(false)
    expect(summarizeReviews('co', rows, 'someone-else').shown).toBe(true)
  })

  it('never counts excluded members', () => {
    expect(summarizeReviews('co', [...three.slice(0, 2), row('x', { employerRating: 1 }, true)], null).shown).toBe(false)
  })

  it('counts one review per member: their latest', () => {
    const rows = [row('a', { employerRating: 1 }, false, new Date('2025-01-01')), row('a', { employerRating: 5 }, false, new Date('2026-01-01')), ...three.slice(1)]
    const s = summarizeReviews('co', rows, null)
    expect(s.respondentCount).toBe(3)
    expect(s.rating?.average).toBe(4)
  })

  it('shows a topic only when at least two members picked it', () => {
    const s = summarizeReviews('co', three, null)
    expect(s.liked?.map((x) => x.value).sort()).toEqual(['PAY', 'TEAM'])
    // only 2 members listed dislikes, under the floor of 3, so the section stays hidden
    expect(s.disliked).toBeNull()
    const withThree = [...three.slice(0, 2), row('c', { employerRating: 3, disliked: ['MANAGER'] })]
    expect(summarizeReviews('co', withThree, null).disliked?.map((x) => x.value)).toEqual(['MANAGER'])
    const solo = summarizeReviews('co', [row('a', { employerRating: 5, liked: ['PAY'] }), row('b', { employerRating: 4 }), row('c', { employerRating: 3 })], null)
    expect(solo.liked).toBeNull()
  })

  it('exposes no member ids', () => {
    expect(JSON.stringify(summarizeReviews('co', three, null))).not.toMatch(/"candidateId"|"a"|"b"|"c"/)
  })
})

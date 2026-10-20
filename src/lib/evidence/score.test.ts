import { describe, expect, it } from 'vitest'
import { compareByEvidenceThenFit, computeEvidence, importedReviewPoints, memberTier } from './score'

const none = { completedReferences: 0, portfolioItems: 0, importedReviews: [], clientReviewRatings: [] }

describe('computeEvidence', () => {
  it('is zero with no evidence and says what to add', () => {
    const r = computeEvidence(none)
    expect(r).toMatchObject({ score: 0, pieces: 0, hasEvidence: false })
    expect(r.nextStep).toMatch(/^To raise it most: .+ \(about \+\d+\)\.$/)
  })

  it('gives fixed points with diminishing repeats', () => {
    expect(computeEvidence({ ...none, completedReferences: 1 }).score).toBe(12)
    // 12 + 8.4 + 5.88 = 26.28
    expect(computeEvidence({ ...none, completedReferences: 3 }).score).toBe(26)
    expect(computeEvidence({ ...none, portfolioItems: 1 }).score).toBe(8)
  })

  it('weights imported reviews by count and rating, and checked links more', () => {
    const big = importedReviewPoints({ rating: 5, reviewCount: 40, status: 'LINK_CHECKED' })
    const small = importedReviewPoints({ rating: 5, reviewCount: 5, status: 'LINK_CHECKED' })
    const lowRating = importedReviewPoints({ rating: 3, reviewCount: 40, status: 'LINK_CHECKED' })
    const unchecked = importedReviewPoints({ rating: 5, reviewCount: 40, status: 'SELF_REPORTED' })
    expect(big).toBe(20)
    expect(small).toBeLessThan(big)
    expect(lowRating).toBeLessThan(big)
    expect(unchecked).toBe(16)
    expect(importedReviewPoints({ rating: 5, reviewCount: 40, status: 'REJECTED' })).toBe(0)
    expect(importedReviewPoints({ rating: 5, reviewCount: 0, status: 'LINK_CHECKED' })).toBe(0)
  })

  it('weights client reviews highest and caps at 100', () => {
    expect(computeEvidence({ ...none, clientReviewRatings: [5] }).score).toBe(25)
    const lots = computeEvidence({
      completedReferences: 20,
      portfolioItems: 20,
      importedReviews: Array(10).fill({ rating: 5, reviewCount: 100, status: 'CONFIRMED' }),
      clientReviewRatings: Array(10).fill(5),
    })
    expect(lots.score).toBe(100)
    expect(lots.nextStep).toBe('Your evidence score is at the maximum.')
  })

  it('does not count rejected imports as evidence', () => {
    const r = computeEvidence({ ...none, importedReviews: [{ rating: 5, reviewCount: 10, status: 'REJECTED' }] })
    expect(r.hasEvidence).toBe(false)
  })
})

describe('memberTier', () => {
  it('needs Candidate+ and one piece of evidence for Verified', () => {
    expect(memberTier(false, { hasEvidence: true })).toBe('MEMBER')
    expect(memberTier(true, { hasEvidence: false })).toBe('CANDIDATE_PLUS')
    expect(memberTier(true, { hasEvidence: true })).toBe('CANDIDATE_PLUS_VERIFIED')
  })
})

describe('compareByEvidenceThenFit', () => {
  it('puts Verified first, then fit, then evidence score', () => {
    const rows = [
      { id: 'a', verified: false, evidenceScore: 0, fit: 95 },
      { id: 'b', verified: true, evidenceScore: 10, fit: 60 },
      { id: 'c', verified: true, evidenceScore: 40, fit: 60 },
      { id: 'd', verified: true, evidenceScore: 5, fit: 80 },
    ]
    expect(rows.sort(compareByEvidenceThenFit).map((r) => r.id)).toEqual(['d', 'c', 'b', 'a'])
  })
})

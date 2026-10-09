import { describe, it, expect } from 'vitest'
import { isBoardPostingLockedForViewer } from '@/lib/jobs/job-board-visibility'

describe('isBoardPostingLockedForViewer', () => {
  it('shows crawled, feed and admin listings to everyone, whatever their stored tier', () => {
    for (const source of ['admin', 'ats_feed', 'candidate_referral', 'candidate_check']) {
      expect(isBoardPostingLockedForViewer({ audienceTier: 'A_LIST_ONLY', source }, false)).toBe(false)
    }
  })

  it('locks hiring-manager and recruiter-mandate exclusives for non-Candidate+ members', () => {
    expect(isBoardPostingLockedForViewer({ audienceTier: 'A_LIST_ONLY', source: 'employer' }, false)).toBe(true)
    expect(isBoardPostingLockedForViewer({ audienceTier: 'A_LIST_ONLY', source: 'recruiter' }, false)).toBe(true)
  })

  it('opens an exclusive to everyone when the poster chose all candidates', () => {
    expect(isBoardPostingLockedForViewer({ audienceTier: 'ALL_CANDIDATES', source: 'recruiter' }, false)).toBe(false)
  })

  it('never locks anything for Candidate+', () => {
    expect(isBoardPostingLockedForViewer({ audienceTier: 'A_LIST_ONLY', source: 'recruiter' }, true)).toBe(false)
  })
})

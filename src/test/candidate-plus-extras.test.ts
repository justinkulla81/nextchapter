import { describe, it, expect } from 'vitest'
import { CANDIDATE_PLUS_EXTRAS, CANDIDATE_PLUS_UNLOCK_HREF, candidatePlusRequiredMessage } from '@/lib/jobs/candidate-plus-extras'
import * as visibility from '@/lib/jobs/job-board-visibility'

describe('every member sees every job', () => {
  it('has no tier-based lock left in the board visibility module', () => {
    expect('isBoardPostingLockedForViewer' in visibility).toBe(false)
    expect('AUDIENCE_TIER_OPTIONS' in visibility).toBe(false)
  })
})

describe('Candidate+ extras', () => {
  it('gates exactly who to contact (with the intro request), the apply kit and explain-my-gaps', () => {
    expect(Object.keys(CANDIDATE_PLUS_EXTRAS).sort()).toEqual(['apply_kit', 'explain_gaps', 'request_intro', 'who_to_contact'])
  })

  it('says what each extra does in one plain line', () => {
    for (const { label, does } of Object.values(CANDIDATE_PLUS_EXTRAS)) {
      expect(label.length).toBeGreaterThan(0)
      expect(does.length).toBeGreaterThan(10)
      expect(does).not.toMatch(/[.!]$/)
    }
  })

  it('points at the existing unlock path', () => {
    expect(CANDIDATE_PLUS_UNLOCK_HREF).toBe('/dashboard/portfolio')
    expect(candidatePlusRequiredMessage('apply_kit')).toBe("Apply kit is part of Candidate+. Your Portfolio page shows what's left to unlock it.")
  })
})

import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
const rows = Array.from({ length: 20_000 }, (_, i) => ({ id: `j${i}`, postedAt: null, createdAt: new Date(), requirementTags: [], location: null, targetRemotePolicy: null }))
vi.mock('@/lib/jobs/board-shortlist', () => ({ loadMemberMarketRows: async () => rows }))
vi.mock('@/lib/jobs/search-breadth-server', () => ({
  loadBreadthClassifier: async () => ({ member: { geo: null }, criteria: () => ({ crit: { geo: 1, fn: 'own', skills: 'strong', industry: 'own' } }), place: () => null }),
}))
vi.mock('@/lib/jobs/job-dismiss-server', () => ({ loadDismissRules: async () => null }))
vi.mock('@/lib/jobs/email-fit-scoring', () => ({ boardListingFitBucketScorerFor: () => () => 'x' }))
vi.mock('@/lib/jobs/fit-bucket-types', () => ({ FIT_BUCKET_SORT_RANK: { x: 1 } }))
vi.mock('@/lib/jobs/employer-sector', () => ({ sectorKeep: () => null }))
vi.mock('@/lib/pay/market-pay', () => ({ statesFromLocation: () => ({ isRemote: false }) }))
vi.mock('@/lib/jobs/requirements', () => ({ flagsFromTags: () => ({}), holdsClearance: () => false, isClearedJobFor: () => false, requirementMemberOf: () => ({}) }))

import { computeMatchState, MatchDeadlineError, type MatchProfile } from '@/lib/personalization/match-compute'

const profile = { id: 'c1', updatedAt: new Date(), hiddenEmployerSectors: [], toolsConfirmedAt: null } as unknown as MatchProfile

describe('match deadline', () => {
  it('stops the loop once the deadline has passed', async () => {
    await expect(computeMatchState(profile, { deadlineAt: Date.now() - 1 })).rejects.toBeInstanceOf(MatchDeadlineError)
  })
  it('finishes when the deadline is ahead', async () => {
    const state = await computeMatchState(profile, { deadlineAt: Date.now() + 60_000 })
    expect(state?.verdicts.size).toBe(20_000)
  })
})

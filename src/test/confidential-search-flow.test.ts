import { beforeEach, describe, expect, it, vi } from 'vitest'

// The confidential-search path end to end at the server-action level:
// a recruiter posts a confidential search → it lands pending for review →
// once approved, a candidate can't copy its URL/company into their tracker.
const db = vi.hoisted(() => ({
  recruiter: { findUnique: vi.fn() },
  exclusiveJobPosting: { create: vi.fn(), findFirst: vi.fn() },
  jobPosting: { findFirst: vi.fn(), count: vi.fn(), create: vi.fn(), update: vi.fn() },
  analyticsEvent: { create: vi.fn(() => Promise.resolve()) },
}))
vi.mock('@/lib/prisma', () => ({ prisma: db }))
vi.mock('@/lib/posthog/server', () => ({ captureServerEvent: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) } }),
}))
vi.mock('@/lib/profile', () => ({ getOrCreateCandidateProfile: async () => ({ id: 'cand1' }) }))

import { submitRecruiterJobBoardPosting } from '@/app/recruiters/(app)/job-board/submit/[token]/actions'
import { promoteJobBoardListing } from '@/app/dashboard/find-my-job/actions'
import { validateJobBoardSubmission } from '@/lib/jobs/job-board-submission'

function confidentialForm(): FormData {
  const f = new FormData()
  for (const [k, v] of Object.entries({
    title: 'Chief Financial Officer', companyName: 'Globex', url: 'https://search.example.com/cfo', postingType: 'recruiter_search',
    contactName: 'Ann Lee', contactEmail: 'ann@search.example.com', salaryMin: '300000', salaryMax: '350000',
    audienceTier: 'A_LIST_ONLY', distribution: 'OPEN', disclosure: 'CONFIDENTIAL',
  })) f.set(k, v)
  return f
}

beforeEach(() => vi.clearAllMocks())

describe('confidential search flow', () => {
  it('a recruiter can post a confidential search; it waits for review', async () => {
    db.recruiter.findUnique.mockResolvedValue({ id: 'r1', workEmail: 'ann@search.example.com' })
    db.exclusiveJobPosting.create.mockResolvedValue({ id: 'p1' })
    const res = await submitRecruiterJobBoardPosting('tok', undefined, confidentialForm())
    expect(res).toEqual({ success: true })
    expect(db.exclusiveJobPosting.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ disclosure: 'CONFIDENTIAL', status: 'pending', source: 'recruiter', submittedByRecruiterId: 'r1' }),
    })
  })

  it('only a recruiter can list a search confidentially', () => {
    const input = {
      title: 'CFO', companyName: 'Globex', location: null, url: 'https://x.test', description: null, postingType: 'recruiter_search',
      contactName: 'Ann Lee', contactEmail: 'ann@x.test', salaryMin: 1, salaryMax: 2, salaryCurrency: 'USD',
      audienceTier: 'A_LIST_ONLY', distribution: 'OPEN', disclosure: 'CONFIDENTIAL',
      targetFunction: null, targetLevel: null, targetLocation: null, targetRemotePolicy: null,
    }
    expect(validateJobBoardSubmission(input, 'recruiter')).toBeNull()
    expect(validateJobBoardSubmission(input, 'employer')).toMatch(/confidential/i)
  })

  it('a candidate cannot copy an approved confidential search into their tracker', async () => {
    db.exclusiveJobPosting.findFirst.mockResolvedValue({ id: 'p1', disclosure: 'CONFIDENTIAL', url: 'https://search.example.com/cfo', description: 'Globex CFO' })
    const res = await promoteJobBoardListing('p1', undefined)
    expect(res?.error).toMatch(/confidential/i)
    expect(db.jobPosting.create).not.toHaveBeenCalled()
  })

  it('an open listing still goes into the tracker', async () => {
    db.exclusiveJobPosting.findFirst.mockResolvedValue({ id: 'p2', disclosure: 'OPEN', url: 'https://x.test/1', description: null })
    db.jobPosting.findFirst.mockResolvedValue({ id: 'jp-existing' })
    expect(await promoteJobBoardListing('p2', undefined)).toEqual({ jobPostingId: 'jp-existing' })
  })
})

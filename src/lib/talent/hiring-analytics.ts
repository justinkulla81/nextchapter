import 'server-only'
import { prisma } from '@/lib/prisma'
import type { CandidateInterestStatus } from '@prisma/client'

// Single-status field on CandidateInteraction means we only ever know a
// candidate's *current* stage, not their full history — so a candidate who
// reached INTEREST_EXPRESSED and was later marked PASSED can't be counted
// toward the INTEREST_EXPRESSED funnel stage after the fact. PASSED is
// excluded from stage counts for that reason (same simplification as the
// STATUS_PRECEDENCE ordering in roles/[id]/candidates/actions.ts, which
// also treats PASSED as outside the linear funnel).
const FUNNEL_ORDER: CandidateInterestStatus[] = [
  'VIEWED',
  'SAVED',
  'INTEREST_EXPRESSED',
  'CANDIDATE_REVEALED',
  'IN_CONVERSATION',
  'HIRED',
]

const STATUS_LABEL: Record<CandidateInterestStatus, string> = {
  VIEWED: 'Viewed',
  SAVED: 'Saved',
  INTEREST_EXPRESSED: 'Interest expressed',
  CANDIDATE_REVEALED: 'Candidate revealed',
  IN_CONVERSATION: 'In conversation',
  HIRED: 'Hired',
  PASSED: 'Passed',
}

export interface HiringAnalytics {
  funnel: { status: CandidateInterestStatus; label: string; count: number }[]
  totalInteractions: number
  passedCount: number
  hiredCount: number
  averageTimeToHireDays: number | null
}

export async function getHiringAnalytics(employerId: string): Promise<HiringAnalytics> {
  const interactions = await prisma.candidateInteraction.findMany({
    where: { employerId },
    select: { status: true, createdAt: true, hiredAt: true },
  })

  const funnel = FUNNEL_ORDER.map((status) => {
    const minIndex = FUNNEL_ORDER.indexOf(status)
    const count = interactions.filter((i) => FUNNEL_ORDER.indexOf(i.status) >= minIndex).length
    return { status, label: STATUS_LABEL[status], count }
  })

  const hired = interactions.filter((i) => i.hiredAt)
  const averageTimeToHireDays =
    hired.length === 0
      ? null
      : Math.round(
          hired.reduce((sum, i) => sum + (i.hiredAt!.getTime() - i.createdAt.getTime()) / (1000 * 60 * 60 * 24), 0) /
            hired.length
        )

  return {
    funnel,
    totalInteractions: interactions.length,
    passedCount: interactions.filter((i) => i.status === 'PASSED').length,
    hiredCount: hired.length,
    averageTimeToHireDays,
  }
}

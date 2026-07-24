import 'server-only'
import { prisma } from '@/lib/prisma'
import { getAuthEmail, type AuthUserSummary } from '@/lib/admin/auth-users'

export type AdminRequestType =
  | 'coaching'
  | 'recruiter_opt_in'
  | 'reference_dispute'
  | 'bounty_claim'
  | 'job_board_intro'

export interface AdminRequestRow {
  id: string
  type: AdminRequestType
  candidateId: string | null
  candidateName: string
  candidateEmail: string
  summary: string
  requestedAt: Date
  status: string
  detailHref: string
}

function candidateName(firstName: string | null, lastName: string | null, fallback = 'Unnamed') {
  return [firstName, lastName].filter(Boolean).join(' ') || fallback
}

// Merges 5 heterogeneous request sources into one shape for the admin
// Requests inbox, rather than a new polymorphic table — each source keeps
// its own model/lifecycle, this just normalizes them for one browsable list.
// Resolution stays on each source's existing page/action (bounty-claims,
// reference-disputes) except JobBoardIntroRequest, which is new in this pass.
export async function getAdminRequests(authUsers: Map<string, AuthUserSummary>): Promise<AdminRequestRow[]> {
  const [coaching, optedIn, disputes, bountyClaims, introRequests] = await Promise.all([
    prisma.coachingWaitlist.findMany({
      orderBy: { createdAt: 'desc' },
      include: { candidate: { select: { id: true, firstName: true, lastName: true, userId: true } } },
    }),
    prisma.candidateProfile.findMany({
      where: { recruiterDatabaseOptIn: true },
      select: { id: true, userId: true, firstName: true, lastName: true, recruiterDatabaseRequestedAt: true },
    }),
    prisma.reference.findMany({
      where: { candidateDisputedAt: { not: null }, disputeResolvedAt: null },
      include: { candidate: { select: { id: true, firstName: true, lastName: true, userId: true } } },
    }),
    prisma.bountyClaim.findMany({
      where: { status: 'PENDING' },
      include: { candidate: { select: { id: true, firstName: true, lastName: true, userId: true } } },
    }),
    prisma.jobBoardIntroRequest.findMany({
      where: { status: 'pending' },
      include: { candidate: { select: { id: true, firstName: true, lastName: true, userId: true } } },
    }),
  ])

  const rows: AdminRequestRow[] = []

  for (const c of coaching) {
    rows.push({
      id: `coaching-${c.id}`,
      type: 'coaching',
      candidateId: c.candidateId,
      candidateName: c.candidate ? candidateName(c.candidate.firstName, c.candidate.lastName) : [c.firstName, c.lastName].filter(Boolean).join(' ') || 'Unknown',
      candidateEmail: c.candidate ? getAuthEmail(authUsers, c.candidate.userId) : c.email,
      summary: `Premium coaching request${c.challenge ? ` — "${c.challenge}"` : ''} (via ${c.source})`,
      requestedAt: c.createdAt,
      status: 'requested',
      detailHref: c.candidate ? `/support/admin/candidates/${c.candidate.id}` : '#',
    })
  }

  for (const c of optedIn) {
    if (!c.recruiterDatabaseRequestedAt) continue
    rows.push({
      id: `recruiter-opt-in-${c.id}`,
      type: 'recruiter_opt_in',
      candidateId: c.id,
      candidateName: candidateName(c.firstName, c.lastName),
      candidateEmail: getAuthEmail(authUsers, c.userId),
      summary: 'Opted into recruiter visibility',
      requestedAt: c.recruiterDatabaseRequestedAt,
      status: 'opted in',
      detailHref: `/support/admin/candidates/${c.id}`,
    })
  }

  for (const r of disputes) {
    rows.push({
      id: `reference-dispute-${r.id}`,
      type: 'reference_dispute',
      candidateId: r.candidate.id,
      candidateName: candidateName(r.candidate.firstName, r.candidate.lastName),
      candidateEmail: getAuthEmail(authUsers, r.candidate.userId),
      summary: `Reference dispute — ${r.refereeName}`,
      requestedAt: r.candidateDisputedAt!,
      status: 'disputed',
      detailHref: '/support/admin/reference-disputes',
    })
  }

  for (const b of bountyClaims) {
    rows.push({
      id: `bounty-${b.id}`,
      type: 'bounty_claim',
      candidateId: b.candidate.id,
      candidateName: candidateName(b.candidate.firstName, b.candidate.lastName),
      candidateEmail: getAuthEmail(authUsers, b.candidate.userId),
      summary: `Offer Bonus claim — ${b.roleTitle} at ${b.companyName}`,
      requestedAt: b.createdAt,
      status: 'pending',
      detailHref: '/support/admin/bounty-claims',
    })
  }

  for (const i of introRequests) {
    rows.push({
      id: `intro-${i.id}`,
      type: 'job_board_intro',
      candidateId: i.candidate.id,
      candidateName: candidateName(i.candidate.firstName, i.candidate.lastName),
      candidateEmail: getAuthEmail(authUsers, i.candidate.userId),
      summary: 'Requested intro on a confidential Job Board listing',
      requestedAt: i.createdAt,
      status: i.status,
      detailHref: `/support/admin/candidates/${i.candidate.id}`,
    })
  }

  return rows.sort((a, b) => b.requestedAt.getTime() - a.requestedAt.getTime())
}

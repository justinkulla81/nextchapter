import 'server-only'
import { prisma } from '@/lib/prisma'
import { getJourney, type JourneyType } from '@/lib/journey/journey'

// Who works with a workforce board, for the board's CRM record (/support/admin/crm/workforce-boards/<id>).
//
// Anonymous by default, the same rule as outplacement: everyone connected is counted, by situation, and nobody is named. A member
// is listed by name only after they turn on "Share my name with <board>" (WorkforceBoardConnection.shareIdentity, off by default,
// in their privacy settings), and never while in Confidential Search Mode. Only registered, real members count: the onboarding
// Where step can connect a visitor before their account exists, and an abandoned sign-up is not a member.
//
// Reads: one bounded query of a board's active connections (a few columns each). Boards have tens of connections, not thousands.

const REAL = { isSystemAccount: false, isSampleData: false, registrationCompletedAt: { not: null } } as const
const LIST_CAP = 200

export interface BoardMember {
  name: string
  email: string | null
  place: string | null
  situation: string | null
  connectedAt: Date
  sharedSince: Date | null
  source: string | null
}

export interface BoardMembers {
  connected: number
  bySituation: { label: string; count: number }[]
  named: BoardMember[]
}

export async function loadBoardMembers(boardId: string): Promise<BoardMembers> {
  const rows = await prisma.workforceBoardConnection.findMany({
    where: { boardId, status: 'ACTIVE', candidate: REAL },
    select: {
      connectedAt: true,
      shareIdentity: true,
      shareIdentityChangedAt: true,
      source: true,
      candidate: { select: { journey: true, confidentialSearchMode: true, firstName: true, lastName: true, email: true, currentCity: true, currentState: true } },
    },
    orderBy: { connectedAt: 'desc' },
    take: 2000,
  })
  const label = (j: JourneyType | null) => (j ? getJourney(j).label : 'Not answered')
  const tally = new Map<string, number>()
  for (const r of rows) tally.set(label(r.candidate.journey), (tally.get(label(r.candidate.journey)) ?? 0) + 1)
  const named = rows
    .filter((r) => r.shareIdentity && !r.candidate.confidentialSearchMode)
    .slice(0, LIST_CAP)
    .map((r) => ({
      name: [r.candidate.firstName, r.candidate.lastName].filter(Boolean).join(' ') || 'Name not given',
      email: r.candidate.email,
      place: [r.candidate.currentCity, r.candidate.currentState].filter(Boolean).join(', ') || null,
      situation: r.candidate.journey ? label(r.candidate.journey) : null,
      connectedAt: r.connectedAt,
      sharedSince: r.shareIdentityChangedAt,
      source: r.source,
    }))
  return {
    connected: rows.length,
    bySituation: [...tally.entries()].map(([l, count]) => ({ label: l, count })).sort((a, b) => b.count - a.count),
    named,
  }
}

import 'server-only'
import type { InstitutionConsentScope } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { visibleTo, type AffiliationKind, type VisibilityLevel, type VisibleField } from './visibility'

export type AffiliationView = { key: string; kind: AffiliationKind; name: string; sees: { field: VisibleField; level: VisibilityLevel }[] }

// Same defaults the college portal uses: engagement and outcome on, the rest off.
const CONSENT_DEFAULT: Record<InstitutionConsentScope, boolean> = {
  SHARE_ENGAGEMENT: true,
  SHARE_OUTCOME: true,
  SHARE_SEARCH_DETAIL_WITH_CAREER: false,
  SHARE_DOSSIER_WITH_EMPLOYERS: false,
}
const COLLEGE_NEEDS: Record<InstitutionConsentScope, string> = {
  SHARE_ENGAGEMENT: 'you share engagement with the college',
  SHARE_OUTCOME: 'you share your outcome with the college',
  SHARE_SEARCH_DETAIL_WITH_CAREER: 'you share search detail with career services',
  SHARE_DOSSIER_WITH_EMPLOYERS: 'you share your Dossier with employers through the college',
}

// The member's real connections and, for each, exactly what it can see right now.
export async function loadAffiliations(candidateId: string): Promise<AffiliationView[]> {
  const [p, members, seats, employers, boards] = await Promise.all([
    prisma.candidateProfile.findUniqueOrThrow({
      where: { id: candidateId },
      select: { recruiterDatabaseOptIn: true, coachDossierConsentedAt: true, coach: { select: { fullName: true } } },
    }),
    prisma.institutionMember.findMany({
      where: { candidateId, status: { in: ['CLAIMED', 'ACTIVE'] } },
      select: { id: true, institution: { select: { name: true } }, consents: { orderBy: { changedAt: 'desc' }, select: { scope: true, granted: true } } },
    }),
    prisma.outplacementSeat.findMany({
      where: { candidateId, status: { not: 'INVITED' } },
      select: { id: true, shareOutcomeWithEmployer: true, contract: { select: { org: { select: { name: true } } } } },
    }),
    // Employers the member chose to reveal themselves to: they are in that company's hiring funnel.
    prisma.approvedEmployer.findMany({ where: { candidateId }, select: { id: true, employer: { select: { companyName: true } } } }),
    prisma.workforceBoardConnection.findMany({ where: { candidateId, status: 'ACTIVE' }, select: { id: true, shareOutcome: true, board: { select: { name: true } } } }),
  ])

  const out: AffiliationView[] = []
  if (p.coach) {
    out.push({
      key: 'coach',
      kind: 'COACH',
      name: p.coach.fullName,
      sees: visibleTo('COACH', new Set(p.coachDossierConsentedAt ? ['you agree to share with your coach'] : [])),
    })
  }
  for (const m of members) {
    const granted = new Set<string>()
    for (const scope of Object.keys(CONSENT_DEFAULT) as InstitutionConsentScope[]) {
      const latest = m.consents.find((c) => c.scope === scope)
      if (latest ? latest.granted : CONSENT_DEFAULT[scope]) granted.add(COLLEGE_NEEDS[scope])
    }
    out.push({ key: `college-${m.id}`, kind: 'COLLEGE', name: m.institution.name, sees: visibleTo('COLLEGE', granted) })
  }
  for (const s of seats) {
    out.push({
      key: `outplacement-${s.id}`,
      kind: 'OUTPLACEMENT',
      name: s.contract.org.name,
      sees: visibleTo('OUTPLACEMENT', new Set(s.shareOutcomeWithEmployer ? ['you turn on sharing your outcome with your former employer'] : [])),
    })
  }
  for (const b of boards) {
    out.push({
      key: `board-${b.id}`,
      kind: 'WORKFORCE_BOARD',
      name: b.board.name,
      sees: visibleTo('WORKFORCE_BOARD', new Set(b.shareOutcome ? ['you choose to be counted, anonymously, when you find work'] : [])),
    })
  }
  for (const e of employers) {
    out.push({
      key: `employer-${e.id}`,
      kind: 'EMPLOYER_FUNNEL',
      name: e.employer.companyName,
      sees: visibleTo('EMPLOYER_FUNNEL', new Set(['you apply to or accept an introduction from that employer'])),
    })
  }
  out.push({
    key: 'recruiters',
    kind: 'RECRUITER',
    name: 'Recruiters',
    sees: visibleTo('RECRUITER', new Set(p.recruiterDatabaseOptIn ? ['you opt in to the recruiter database'] : [])),
  })
  return out
}

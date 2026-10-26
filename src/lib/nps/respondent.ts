import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { getCurrentEmployerPortalMember } from '@/lib/employer/outplacement-auth'
import { getCurrentRecruiter } from '@/lib/recruiter/current-recruiter'
import { getCurrentCoach } from '@/lib/coach/current-coach'

/** The portals that show the NPS question. Institution portals are not asked. */
export type NpsAudience = 'CANDIDATE' | 'EMPLOYER' | 'RECRUITER' | 'COACH'

export const NPS_AUDIENCE_LABEL: Record<NpsAudience, string> = {
  CANDIDATE: 'Candidate', EMPLOYER: 'Employer', RECRUITER: 'Recruiter', COACH: 'Coach',
}

export const parseNpsAudience = (raw: unknown): NpsAudience =>
  raw === 'EMPLOYER' || raw === 'RECRUITER' || raw === 'COACH' ? raw : 'CANDIDATE'

export interface NpsRespondent {
  audience: NpsAudience
  id: string
  name: string
  orgName: string | null
  /** When they joined, for "not in the first two weeks". */
  since: Date
  /** Sample, demo and system accounts: never asked, never counted. */
  isSample: boolean
}

/**
 * The signed-in person for one portal, from that portal's own session. The
 * audience a form claims only picks which session to check, so it cannot be
 * used to answer as someone in another portal. Null when there is nothing to
 * say about when they joined (then they are simply not asked).
 */
export async function resolveNpsRespondent(audience: NpsAudience): Promise<NpsRespondent | null> {
  if (audience === 'EMPLOYER') {
    const u = await getCurrentEmployerPortalMember()
    const row = await prisma.outplacementOrgUser.findUnique({
      where: { userId: u.userId },
      select: { acceptedAt: true, invitedAt: true, org: { select: { isSampleData: true } } },
    })
    if (!row) return null
    return { audience, id: u.id, name: u.fullName || u.email || 'Employer user', orgName: u.orgName, since: row.acceptedAt ?? row.invitedAt, isSample: row.org.isSampleData }
  }
  if (audience === 'RECRUITER') {
    const r = await getCurrentRecruiter()
    return { audience, id: r.id, name: r.fullName, orgName: r.firmName, since: r.createdAt, isSample: r.isSampleData }
  }
  if (audience === 'COACH') {
    const c = await getCurrentCoach()
    return { audience, id: c.id, name: c.fullName, orgName: c.firmName, since: c.createdAt, isSample: c.isSampleData }
  }
  const { data: { user } } = await (await createClient()).auth.getUser()
  if (!user) return null
  const p = await getOrCreateCandidateProfile(user.id)
  const name = [p.firstName, p.lastName].filter(Boolean).join(' ') || p.email || 'A candidate'
  return { audience, id: p.id, name, orgName: null, since: p.createdAt, isSample: p.isSystemAccount || p.isSampleData }
}

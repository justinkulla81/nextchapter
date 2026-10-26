import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import type { HelpAudience } from '@/lib/help/constants'

/** The person using Help & feedback or the NPS prompt, whichever portal they are in. */
export interface Requester {
  audience: HelpAudience
  id: string
  name: string
  email: string | null
  /** The employer organization, for an employer user. */
  orgName: string | null
  /** When they joined, for "not in the first two weeks". */
  since: Date
  /** Sample, demo and system accounts: never asked to rate us, never counted. */
  isSample: boolean
}

const fullName = (first: string | null, last: string | null) => [first, last].filter(Boolean).join(' ')

/**
 * The signed-in person for one portal, from that portal's own session. The
 * audience a form claims is only ever used to pick which session to check, so
 * it cannot be used to act as someone in another portal. Null when signed out.
 */
export async function resolveRequester(audience: HelpAudience): Promise<Requester | null> {
  if (audience === 'EMPLOYER') {
    const { data: { user } } = await (await createClient('employer')).auth.getUser()
    if (!user) return null
    const u = await prisma.outplacementOrgUser.findUnique({
      where: { userId: user.id },
      select: { id: true, fullName: true, invitedEmail: true, acceptedAt: true, invitedAt: true, org: { select: { name: true, isSampleData: true } } },
    })
    if (!u) return null
    return { audience, id: u.id, name: u.fullName || u.invitedEmail, email: user.email ?? u.invitedEmail, orgName: u.org.name, since: u.acceptedAt ?? u.invitedAt, isSample: u.org.isSampleData }
  }
  if (audience === 'COACH') {
    const { data: { user } } = await (await createClient('coach')).auth.getUser()
    if (!user) return null
    const c = await prisma.coach.findUnique({ where: { userId: user.id }, select: { id: true, fullName: true, workEmail: true, createdAt: true, isSampleData: true } })
    if (!c) return null
    return { audience, id: c.id, name: c.fullName, email: c.workEmail, orgName: null, since: c.createdAt, isSample: c.isSampleData }
  }
  if (audience === 'RECRUITER') {
    const { data: { user } } = await (await createClient('recruiter')).auth.getUser()
    if (!user) return null
    const r = await prisma.recruiter.findUnique({ where: { userId: user.id }, select: { id: true, fullName: true, workEmail: true, createdAt: true, isSampleData: true } })
    if (!r) return null
    return { audience, id: r.id, name: r.fullName, email: r.workEmail, orgName: null, since: r.createdAt, isSample: r.isSampleData }
  }
  const { data: { user } } = await (await createClient()).auth.getUser()
  if (!user) return null
  const p = await getOrCreateCandidateProfile(user.id)
  return { audience, id: p.id, name: fullName(p.firstName, p.lastName) || p.email || 'A candidate', email: p.email ?? null, orgName: null, since: p.createdAt, isSample: p.isSystemAccount || p.isSampleData }
}

/** The same person by id, for emails to them. No session needed. */
export async function lookupRequester(audience: HelpAudience, id: string): Promise<{ name: string; firstName: string | null; email: string | null } | null> {
  if (audience === 'EMPLOYER') {
    const u = await prisma.outplacementOrgUser.findUnique({ where: { id }, select: { fullName: true, invitedEmail: true } })
    return u ? { name: u.fullName || u.invitedEmail, firstName: u.fullName?.split(' ')[0] ?? null, email: u.invitedEmail } : null
  }
  if (audience === 'COACH') {
    const c = await prisma.coach.findUnique({ where: { id }, select: { fullName: true, workEmail: true } })
    return c ? { name: c.fullName, firstName: c.fullName.split(' ')[0] ?? null, email: c.workEmail } : null
  }
  if (audience === 'RECRUITER') {
    const r = await prisma.recruiter.findUnique({ where: { id }, select: { fullName: true, workEmail: true } })
    return r ? { name: r.fullName, firstName: r.fullName.split(' ')[0] ?? null, email: r.workEmail } : null
  }
  const p = await prisma.candidateProfile.findUnique({ where: { id }, select: { firstName: true, lastName: true, email: true } })
  return p ? { name: fullName(p.firstName, p.lastName) || p.email || 'A candidate', firstName: p.firstName, email: p.email } : null
}

import 'server-only'
import { prisma } from '@/lib/prisma'

// A job link in an email to someone who may already be a member. A member opens the job inside the portal (the sign-in page
// returns them to it), where a save or an apply builds their profile; everyone else gets the public page. Same lookup as
// company-tracker/follow-from-email.ts. Never throws: any failure gives the public link.
export async function isMemberEmail(email: string): Promise<boolean> {
  try {
    return !!(await prisma.candidateProfile.findFirst({ where: { email: { equals: email, mode: 'insensitive' } }, select: { id: true } }))
  } catch {
    return false
  }
}

export function jobPath(jobId: string, member: boolean, src: string): string {
  return member ? `/dashboard/jobs/${jobId}?src=${src}` : `/jobs/${jobId}?from=${src}`
}

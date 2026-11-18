import 'server-only'
import { prisma } from '@/lib/prisma'

const LEAD_RESUME_DAYS = 30

/** The résumé this person already sent from a public page (the match box), when it is recent: offered on the résumé step. */
export async function leadResumeFor(email: string | null | undefined): Promise<{ id: string; fileName: string } | null> {
  if (!email) return null
  const lead = await prisma.resumeSubmissionLead.findFirst({
    where: { email: email.trim().toLowerCase(), filePath: { not: null }, createdAt: { gte: new Date(Date.now() - LEAD_RESUME_DAYS * 86_400_000) } },
    orderBy: { createdAt: 'desc' },
    select: { id: true, fileName: true },
  })
  return lead ? { id: lead.id, fileName: lead.fileName || 'your résumé' } : null
}

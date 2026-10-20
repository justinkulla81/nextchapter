import 'server-only'
import { prisma } from '@/lib/prisma'

/** Addresses we sent a cold email to in the last 45 days, so their replies are logged even when the reply never says "NextChapter". */
export async function buildOutreachReplyEmails(): Promise<Set<string>> {
  const since = new Date(Date.now() - 45 * 86_400_000)
  const sends = await prisma.crmActivity.findMany({
    where: { type: 'EMAIL', direction: 'OUTBOUND', outcome: { startsWith: 'Cold outreach' }, occurredAt: { gte: since }, personId: { not: null } },
    select: { person: { select: { email: true, emails: true } } },
  })
  const out = new Set<string>()
  for (const s of sends) for (const e of [s.person?.email, ...(s.person?.emails ?? [])]) if (e) out.add(e.toLowerCase())
  return out
}

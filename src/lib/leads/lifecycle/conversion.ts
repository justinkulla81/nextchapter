import 'server-only'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

// When someone who gave us their email on the site registers, write that on
// their CRM record: where they came in, what we sent, whether they clicked,
// and how long it took. This is the conversion story the captured-emails
// page counts. Best effort and idempotent; never blocks registration.

const DAY_MS = 24 * 60 * 60 * 1000

export async function noteLeadConversion(candidateId: string, email: string | null): Promise<void> {
  if (!email) return
  const address = email.trim().toLowerCase()
  const person = await prisma.crmPerson.findFirst({ where: { deletedAt: null, OR: [{ email: address }, { emails: { has: address } }] }, select: { id: true, emailSource: true } })
  if (!person) return

  const [signups, sent] = await Promise.all([
    prisma.crmActivity.findMany({
      where: { personId: person.id, type: 'NOTE', sourceRef: { startsWith: 'lead:' } },
      orderBy: { occurredAt: 'asc' },
      select: { subject: true, body: true, occurredAt: true },
    }),
    prisma.crmActivity.findMany({
      where: { personId: person.id, type: 'EMAIL', OR: [{ sourceRef: { startsWith: 'lifecycle:' } }, { sourceRef: { startsWith: 'nurture:' } }] },
      orderBy: { occurredAt: 'asc' },
      select: { sourceRef: true, outreachTracking: { select: { links: { select: { clickCount: true } } } } },
    }),
  ])
  if (signups.length === 0) return // never a website lead

  const first = signups[0]
  const journey = signups.map((s) => /Journey: (.+)/.exec(s.body ?? '')?.[1]).find(Boolean)
  const clicked = sent.some((a) => a.outreachTracking?.links.some((l) => l.clickCount > 0))
  const steps = sent.map((a) => a.sourceRef!.split(':')[1])
  const days = Math.max(0, Math.round((Date.now() - first.occurredAt.getTime()) / DAY_MS))

  const body = [
    `Came in through: ${signups.map((s) => (s.subject ?? '').replace('Website signup · ', '')).join(', ')}`,
    journey && `Journey picked: ${journey}`,
    `Emails from us before registering: ${steps.length ? steps.join(', ') : 'none'}`,
    steps.length ? `Clicked a link in them: ${clicked ? 'yes' : 'no'}` : null,
    `Time from first signup to registering: ${days} day${days === 1 ? '' : 's'}`,
  ]
    .filter(Boolean)
    .join('\n')

  await prisma.crmActivity
    .create({
      data: {
        type: 'NOTE',
        direction: 'INBOUND',
        personId: person.id,
        subject: 'Registered from a website lead',
        body,
        isAutoLogged: true,
        sourceRef: `conversion:${candidateId}`,
      },
    })
    .catch((e: Prisma.PrismaClientKnownRequestError) => {
      if (e?.code !== 'P2002') throw e
    })
}

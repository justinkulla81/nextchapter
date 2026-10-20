import 'server-only'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { suppress } from '@/lib/mailing/lists'
import type { ResendEvent } from '@/lib/mailing/tracking'
import { isOutreachEvent, isPermanentBounce } from './event-rules'

/**
 * Cold outreach sent with the Resend tag `outreach` reports back here. A permanent bounce marks the
 * address invalid and stops all mail to it; a spam complaint also marks the person passed. Both go on
 * the shared suppression list that the mail-merge builder reads. Opens are deliberately not recorded:
 * a pixel is unreliable and hurts deliverability, and replies and clicks are the signals that matter.
 * Events for email without the tag are ignored.
 */
export async function applyOutreachEvent(event: ResendEvent): Promise<'applied' | 'ignored'> {
  if (!isOutreachEvent(event)) return 'ignored'
  const to = event.data.to?.[0]?.toLowerCase()
  if (!to) return 'ignored'

  const person = await prisma.crmPerson.findFirst({
    where: { deletedAt: null, OR: [{ email: { equals: to, mode: 'insensitive' } }, { emails: { has: to } }] },
    select: { id: true },
  })

  if (event.type === 'email.bounced') {
    if (!isPermanentBounce(event)) return 'ignored'
    const detail = [event.data.bounce?.type, event.data.bounce?.subType, event.data.bounce?.message].filter(Boolean).join(' · ')
    await suppress(to, 'BOUNCED', detail)
    if (person) await prisma.crmPerson.update({ where: { id: person.id }, data: { emailVerifiedStatus: 'invalid', emailVerifiedAt: new Date() } })
    captureServerEvent(person?.id ?? 'outreach', 'outreach_email_bounced', { permanent: true })
    return 'applied'
  }
  if (event.type === 'email.complained') {
    await suppress(to, 'COMPLAINED', 'Marked as spam')
    if (person) await prisma.crmPerson.update({ where: { id: person.id }, data: { passedAt: new Date() } })
    captureServerEvent(person?.id ?? 'outreach', 'outreach_email_complained', {})
    return 'applied'
  }
  return 'ignored'
}

import 'server-only'
import { prisma } from '@/lib/prisma'
import { isOptOutReply } from '@/lib/outreach/opt-out'
import { personIdForEmail, setDoNotEmail } from './lists'

/**
 * A plain "no" / "stop" reply takes the sender off everything we send: it marks the person Do not email (every address on the record) or, with
 * no CRM record, suppresses the address itself. Applied once per message, so switching Do not email back off after a mistaken match sticks even
 * though the sweep sees the same message again. Never throws: it must not stop the reply from being logged.
 */
export async function applyOptOutReply(input: { messageId: string; email: string; subject: string | null; text: string | null }): Promise<boolean> {
  try {
    if (!isOptOutReply(input.subject, input.text)) return false
    const email = input.email.toLowerCase()
    const personId = await personIdForEmail(email)
    if (!personId) {
      const existing = await prisma.mailingSuppression.findUnique({ where: { email } })
      if (existing) return false
      await prisma.mailingSuppression.create({ data: { email, reason: 'DO_NOT_EMAIL', detail: 'Replied asking to stop' } })
      return true
    }
    const sourceRef = `optout:${input.messageId}`
    if (await prisma.crmActivity.findFirst({ where: { sourceRef }, select: { id: true } })) return false
    await prisma.crmActivity.create({
      data: {
        type: 'FIELD_CHANGED', direction: 'INBOUND', personId, isAutoLogged: true, occurredAt: new Date(), sourceRef,
        subject: 'Opted out by reply: marked Do not email',
        body: (input.text ?? '').replace(/\s+/g, ' ').trim().slice(0, 300) || null,
      },
    })
    await setDoNotEmail(personId, true, 'an opt-out reply')
    return true
  } catch (e) {
    console.error('Opt-out reply failed', input.messageId, e)
    return false
  }
}

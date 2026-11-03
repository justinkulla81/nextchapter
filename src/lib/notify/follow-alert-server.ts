import 'server-only'
import { after } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createResend } from '@/lib/email/resend-client'
import { followAlertEmail, type FollowKind } from '@/lib/notify/follow-alert'

/** Where follow alerts go. Override with FOLLOW_ALERT_TO; otherwise the same inbox the help requests use. */
const TO = process.env.FOLLOW_ALERT_TO || process.env.HELP_FORWARD_TO || process.env.CONTACT_FORWARD_TO || 'justin@launchyournextchapter.com'
const FROM = 'NextChapter Alerts <support@launchyournextchapter.com>'
const ADMIN_URL = 'https://admin.launchyournextchapter.com'

async function send(kind: FollowKind, candidateId: string, target: string, source: string | null): Promise<void> {
  try {
    if (!process.env.RESEND_API_KEY) return
    const p = await prisma.candidateProfile.findUnique({
      where: { id: candidateId },
      select: { firstName: true, lastName: true, email: true, registrationCompletedAt: true },
    })
    const name = [p?.firstName, p?.lastName].filter(Boolean).join(' ') || null
    const mail = followAlertEmail({
      kind, target, source,
      member: { id: candidateId, name, email: p?.email ?? null, registered: !!p?.registrationCompletedAt },
      adminUrl: `${ADMIN_URL}/support/admin/candidates/${candidateId}`,
    })
    const { error } = await createResend(process.env.RESEND_API_KEY, 'general').emails.send({ from: FROM, to: TO, ...mail })
    if (error) console.error('Follow alert failed:', error)
  } catch (e) {
    // An alert must never break the follow itself.
    console.error('Follow alert failed:', e)
  }
}

/** Email the owner about a new follow. Runs after the response when there is one, inline in a cron or script. Never throws. */
export function notifyOwnerOfFollow(kind: FollowKind, candidateId: string, target: string, source: string | null): void {
  const run = () => send(kind, candidateId, target, source)
  try {
    after(run)
  } catch {
    void run()
  }
}

import 'server-only'
import { createResend } from '@/lib/email/resend-client'
import { prisma } from '@/lib/prisma'
import { candidateUnsubscribeUrl } from '@/lib/email/signed-links'
import { neutralizeEmailSubject } from '@/lib/email/neutral-subject'
import { captureServerEvent } from '@/lib/posthog/server'
import SeniorBriefEmail, { seniorBriefHeadline } from '@/emails/senior-brief'
import type { ItemKind } from '@/lib/senior-brief/rules'

export type BriefEmailInput = {
  draftId: string
  memberId: string
  to: string
  firstName: string | null
  confidentialSearchMode: boolean
  itemKind: ItemKind
  contactName: string
  companyName: string | null
  inputTokens: number
  outputTokens: number
  /** Test sends go to the admin address only and carry the draft text; no member link is live. */
  test?: { subject: string; body: string; toEmail: string } | null
}

export async function sendSeniorBrief(i: BriefEmailInput): Promise<{ sent: boolean }> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY is not set — skipping senior brief email.')
    return { sent: false }
  }
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const live = !i.test
  const subject = neutralizeEmailSubject(seniorBriefHeadline(i.itemKind, i.contactName, i.companyName), i.confidentialSearchMode)

  const { error } = await createResend(process.env.RESEND_API_KEY).emails.send({
    from: 'NextChapter <support@launchyournextchapter.com>',
    replyTo: 'support@launchyournextchapter.com',
    to: i.to,
    subject: live ? subject : `[Test] ${subject}`,
    react: SeniorBriefEmail({
      firstName: i.firstName,
      itemKind: i.itemKind,
      contactName: i.contactName,
      companyName: i.companyName,
      openUrl: `${appUrl}/dashboard/network/brief/${i.draftId}?from=senior_brief`,
      unsubscribeUrl: live ? candidateUnsubscribeUrl(appUrl, i.memberId, 'seniorBrief') : null,
      notForMeUrl: live ? candidateUnsubscribeUrl(appUrl, i.memberId, 'seniorBriefPause') : null,
      testDraft: i.test ? { ...i.test, memberId: i.memberId } : null,
    }),
  })
  if (error) {
    console.error('Failed to send senior brief email:', error)
    return { sent: false }
  }
  if (live) {
    await prisma.seniorBriefDraft.update({ where: { id: i.draftId }, data: { status: 'EMAILED', emailedAt: new Date() } }).catch(() => {})
    captureServerEvent(i.memberId, 'senior_brief_sent', { memberId: i.memberId, itemKind: i.itemKind, draftId: i.draftId, inputTokens: i.inputTokens, outputTokens: i.outputTokens })
  }
  return { sent: true }
}

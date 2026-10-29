import 'server-only'
import { createResend, isUndeliverableAddress } from '@/lib/email/resend-client'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { getMailingSettings } from '@/lib/mailing/lists'
import { getAccountActivityAdminEmail } from '@/lib/admin/auth'
import { makeUnsubscribeToken } from '@/lib/mailing/unsubscribe-token'
import LeadLifecycleEmail from '@/emails/lead-lifecycle'
import { leadEmailText } from '@/lib/leads/lifecycle/content'
import type { NurtureStep } from './config'
import { nurtureRef } from './config'
import type { NurtureEmail } from './content'
import type { NurtureLeadKind, NurtureTrack } from './tracks'

const appUrl = () => process.env.NEXT_PUBLIC_APP_URL || 'https://launchyournextchapter.com'
const FROM = 'NextChapter <support@launchyournextchapter.com>'

export interface NurtureSend {
  email: string
  kind: NurtureLeadKind
  track: NurtureTrack
  step: NurtureStep
  content: NurtureEmail
  /** The CRM person the send is logged on. Absent for a test send, which is not logged or tracked. */
  personId?: string | null
  test?: boolean
}

/** The tracked destination: the page, with the campaign in the query so the click is attributable. */
export function nurtureDestination(content: NurtureEmail, track: NurtureTrack, step: NurtureStep): string | null {
  if (!content.ctaPath) return null
  const joiner = content.ctaPath.includes('?') ? '&' : '?'
  return `${appUrl()}${content.ctaPath}${joiner}utm_source=lead_email&utm_campaign=nurture_${track}_${step}`
}

/**
 * Sends one sequence email, built the way the lifecycle emails are (src/lib/leads/lifecycle/send.ts): one EMAIL activity on
 * the person's CRM record with an open pixel and a tracked button, and its unique (type, sourceRef) key means the same step
 * never goes to the same address twice. A failed send removes its own log row. Returns whether it went out.
 */
export async function sendNurtureEmail(input: NurtureSend): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) return false
  const email = input.email.trim().toLowerCase()
  if (isUndeliverableAddress(email)) return false

  const { content } = input
  const settings = await getMailingSettings()
  const unsubscribeUrl = `${appUrl()}/updates/unsubscribe/${makeUnsubscribeToken(email, null)}`
  const direct = nurtureDestination(content, input.track, input.step)

  let ctaUrl: string | null = direct
  let pixelUrl: string | undefined
  let activityId: string | null = null

  if (!input.test) {
    if (!input.personId) return false
    try {
      const activity = await prisma.crmActivity.create({
        data: {
          type: 'EMAIL',
          direction: 'OUTBOUND',
          personId: input.personId,
          subject: content.subject,
          body: leadEmailText(content, direct),
          isAutoLogged: true,
          sourceRef: nurtureRef(input.step, email),
        },
      })
      activityId = activity.id
    } catch {
      return false // this step was already sent (or is being sent) to this address
    }
    const tracking = await prisma.crmOutreachTracking.create({ data: { activityId } })
    if (direct) {
      const link = await prisma.crmOutreachLink.create({ data: { trackingId: tracking.id, originalUrl: direct } })
      ctaUrl = `${appUrl()}/api/crm/outreach/click/${link.id}`
    }
    pixelUrl = `${appUrl()}/api/crm/outreach/open/${tracking.id}`
  }

  try {
    const adminCopy = getAccountActivityAdminEmail()
    const resend = createResend(process.env.RESEND_API_KEY, 'candidate')
    const { error } = await resend.emails.send({
      from: FROM,
      to: email,
      // The admin is copied on every live send while this rolls out, as with the lifecycle emails, so the owner sees what each person got.
      ...(!input.test && adminCopy && adminCopy.toLowerCase() !== email ? { bcc: adminCopy } : {}),
      subject: input.test ? `[TEST ${input.step}] ${content.subject}` : content.subject,
      react: LeadLifecycleEmail({ content, ctaUrl, unsubscribeUrl, postalAddress: settings.postalAddress, pixelUrl, audience: 'candidate' }),
      headers: { 'List-Unsubscribe': `<${unsubscribeUrl}>` },
    })
    if (error) throw new Error(error.message)
  } catch (error) {
    console.error('Nurture email failed:', error)
    if (activityId) await prisma.crmActivity.delete({ where: { id: activityId } }).catch(() => {})
    return false
  }

  if (!input.test) captureServerEvent(email, 'nurture_email_sent', { track: input.track, step: input.step, kind: input.kind })
  return true
}

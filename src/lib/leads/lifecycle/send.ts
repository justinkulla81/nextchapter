import 'server-only'
import { createResend, isUndeliverableAddress } from '@/lib/email/resend-client'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { getMailingSettings } from '@/lib/mailing/lists'
import { makeUnsubscribeToken } from '@/lib/mailing/unsubscribe-token'
import LeadLifecycleEmail from '@/emails/lead-lifecycle'
import type { LeadStep, LeadVariant } from './config'
import { leadEmailContent, leadEmailText, type LeadEmailContext } from './content'

const appUrl = () => process.env.NEXT_PUBLIC_APP_URL || 'https://launchyournextchapter.com'
const FROM = 'NextChapter <support@launchyournextchapter.com>'

export const lifecycleRef = (step: LeadStep, email: string) => `lifecycle:${step}:${email.toLowerCase()}`

function profileUrl(variant: LeadVariant, step: LeadStep): string {
  return `${appUrl()}/onboarding/desire?from=lead_${variant}&utm_source=lead_email&utm_campaign=${variant}_${step}`
}

export interface LifecycleSend {
  email: string
  variant: LeadVariant
  step: LeadStep
  context: LeadEmailContext
  /** A CRM person to log the send on. Absent for a test send, which is not logged or tracked. */
  personId?: string | null
  test?: boolean
}

/**
 * Sends one lifecycle email. A real send is logged on the person's CRM record
 * as an EMAIL activity with an open pixel and a tracked link, and the
 * activity's unique (type, sourceRef) key means the same step never goes to the
 * same address twice. A failed send removes its own log row. Returns whether it
 * went out.
 */
export async function sendLifecycleEmail(input: LifecycleSend): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) return false
  const email = input.email.trim().toLowerCase()
  if (isUndeliverableAddress(email)) return false

  const content = leadEmailContent(input.variant, input.step, input.context)
  const settings = await getMailingSettings()
  const unsubscribeUrl = `${appUrl()}/updates/unsubscribe/${makeUnsubscribeToken(email, null)}`
  const directCta = profileUrl(input.variant, input.step)

  let ctaUrl: string | null = content.ctaLabel ? directCta : null
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
          body: leadEmailText(content, directCta),
          isAutoLogged: true,
          sourceRef: lifecycleRef(input.step, email),
        },
      })
      activityId = activity.id
    } catch {
      return false // this step was already sent (or is being sent) to this address
    }
    const tracking = await prisma.crmOutreachTracking.create({ data: { activityId } })
    if (ctaUrl) {
      const link = await prisma.crmOutreachLink.create({ data: { trackingId: tracking.id, originalUrl: directCta } })
      ctaUrl = `${appUrl()}/api/crm/outreach/click/${link.id}`
    }
    pixelUrl = `${appUrl()}/api/crm/outreach/open/${tracking.id}`
  }

  try {
    const audience = input.variant === 'waitlist_b2b' ? 'general' : 'candidate'
    const resend = createResend(process.env.RESEND_API_KEY, audience)
    const { error } = await resend.emails.send({
      from: FROM,
      to: email,
      subject: input.test ? `[TEST ${input.step}] ${content.subject}` : content.subject,
      react: LeadLifecycleEmail({ content, ctaUrl, unsubscribeUrl, postalAddress: settings.postalAddress, pixelUrl, audience }),
      headers: { 'List-Unsubscribe': `<${unsubscribeUrl}>` },
    })
    if (error) throw new Error(error.message)
  } catch (error) {
    console.error('Lifecycle email failed:', error)
    if (activityId) await prisma.crmActivity.delete({ where: { id: activityId } }).catch(() => {})
    return false
  }

  if (!input.test) captureServerEvent(email, 'lead_email_sent', { variant: input.variant, step: input.step })
  return true
}

import 'server-only'
import { createResend, isUndeliverableAddress } from '@/lib/email/resend-client'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { getMailingSettings } from '@/lib/mailing/lists'
import { getAccountActivityAdminEmail } from '@/lib/admin/auth'
import { makeUnsubscribeToken } from '@/lib/mailing/unsubscribe-token'
import LeadLifecycleEmail from '@/emails/lead-lifecycle'
import type { LeadStep, LeadVariant } from './config'
import { journeyButtons } from './journey'
import { leadEmailContent, leadEmailText, type LeadEmailContext, type LeadEmailJob } from './content'
import { jobsForSearch, similarLeadJobs, type LeadJob } from './similar-jobs'

const appUrl = () => process.env.NEXT_PUBLIC_APP_URL || 'https://launchyournextchapter.com'
const FROM = 'NextChapter <support@launchyournextchapter.com>'

export const lifecycleRef = (step: LeadStep, email: string) => `lifecycle:${step}:${email.toLowerCase()}`

function profileUrl(email: string, variant: LeadVariant, step: LeadStep, journey?: string | null): string {
  // Through the signed link, which remembers the address for the onboarding details step. Someone who picked a journey lands on its
  // page, whose button carries the situation into sign-up; everyone else gets the situation question.
  const from = journey ? 'lead_email' : `lead_${variant}`
  const query = new URLSearchParams({ from, utm_source: 'lead_email', utm_campaign: `${variant}_${step}`, ...(journey ? { j: journey } : {}) })
  return `${appUrl()}/api/lead-profile/${makeUnsubscribeToken(email, null)}?${query}`
}

export interface LifecycleSend {
  email: string
  variant: LeadVariant
  step: LeadStep
  context: LeadEmailContext
  /** The job they saved or went to apply for, when there is one: the application welcome shows three open jobs like it. */
  jobId?: string | null
  /** The saved search behind a job alert: its welcome shows three jobs the search finds now. */
  search?: { q: string; loc: string; remote: boolean } | null
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

  // The application and saved-job welcomes lead with three open jobs like that job, the job-alert welcome with three its search finds
  // now (job links are made tracked below).
  const token = makeUnsubscribeToken(email, null)
  const welcome = input.step === 'welcome'
  const found: LeadJob[] =
    welcome && (input.variant === 'applied_job' || input.variant === 'saved_job') ? await similarLeadJobs(input.jobId)
    : welcome && input.variant === 'job_alert' ? await jobsForSearch(input.search)
    : []
  const jobs: LeadEmailJob[] = found.map((j, i) => ({
    title: j.title,
    company: j.company,
    place: j.place,
    url: `${appUrl()}/api/lead-job/${token}?job=${j.id}&step=${input.step}&v=${input.variant}&pos=${i + 1}`,
  }))
  const choices = input.context.journey || input.variant === 'waitlist_b2b' || jobs.length >= 3 ? [] : journeyButtons(email, input.step, input.context.detail)
  const content = leadEmailContent(input.variant, input.step, { ...input.context, choices, jobs })
  const settings = await getMailingSettings()
  const unsubscribeUrl = `${appUrl()}/updates/unsubscribe/${makeUnsubscribeToken(email, null)}`
  const directCta = profileUrl(email, input.variant, input.step, input.context.journey)

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
    // Each job is a tracked link too, so a click shows on the CRM record (and in the conversion note) like the profile button.
    if (content.jobs?.length) {
      const links = await Promise.all(content.jobs.map((j) => prisma.crmOutreachLink.create({ data: { trackingId: tracking.id, originalUrl: j.url } })))
      content.jobs = content.jobs.map((j, i) => ({ ...j, url: `${appUrl()}/api/crm/outreach/click/${links[i].id}` }))
    }
    pixelUrl = `${appUrl()}/api/crm/outreach/open/${tracking.id}`
  }

  try {
    const adminCopy = getAccountActivityAdminEmail()
    const audience = input.variant === 'waitlist_b2b' ? 'general' : 'candidate'
    const resend = createResend(process.env.RESEND_API_KEY, audience)
    const { error } = await resend.emails.send({
      from: FROM,
      to: email,
      // The admin is copied on every live send while this rolls out, so the owner sees what each person got.
      ...(!input.test && adminCopy && adminCopy.toLowerCase() !== email ? { bcc: adminCopy } : {}),
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

  if (!input.test) captureServerEvent(email, 'lead_email_sent', { variant: input.variant, step: input.step, journey: input.context.journey ?? null, journey_choices_shown: !!content.choices?.length, similar_jobs_shown: content.jobs?.length ?? 0, jobId: input.jobId ?? null })
  return true
}

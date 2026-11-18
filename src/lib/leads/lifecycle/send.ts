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
import { latestReport } from '@/lib/reports'
import { getPublicNotices } from '@/lib/warn/layoff-pages'
import { buildLayoffWeekBrief } from '@/lib/newsletter/layoff-week'

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

/** The job ids in the lifecycle emails already sent to this address (their tracked job links), so a reminder shows new ones. */
async function jobsAlreadySent(email: string): Promise<Set<string>> {
  // From the address's own (at most two) earlier emails, by their unique (type, sourceRef) key: a few rows, never a scan of the links.
  const sent = await prisma.crmActivity
    .findMany({
      where: { type: 'EMAIL', sourceRef: { in: (['welcome', 'nudge1'] as const).map((s) => lifecycleRef(s, email)) } },
      select: { outreachTracking: { select: { links: { select: { originalUrl: true } } } } },
    })
    .catch(() => [])
  const urls = sent.flatMap((a) => a.outreachTracking?.links.map((l) => l.originalUrl) ?? [])
  return new Set(urls.map((u) => /\/api\/lead-job\/[^?]+\?(?:.*&)?job=([a-z0-9]+)/i.exec(u)?.[1]).filter((id): id is string => !!id))
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

  // The application and saved-job emails lead with three open jobs like that job, the job-alert emails with three its search finds
  // now (job links are made tracked below). A reminder leaves out the jobs an earlier email already sent this address.
  const token = makeUnsubscribeToken(email, null)
  const welcome = input.step === 'welcome'
  const wantsJobs = (input.variant === 'applied_job' && input.step !== 'nudge2') || input.variant === 'saved_job' || input.variant === 'job_alert'
  const already = wantsJobs && !welcome && !input.test ? await jobsAlreadySent(email) : new Set<string>()
  const pool: LeadJob[] =
    !wantsJobs ? []
    : input.variant === 'job_alert' ? await jobsForSearch(input.search, 3 + already.size)
    : await similarLeadJobs(input.jobId, 3 + already.size)
  const found = pool.filter((j) => !already.has(j.id)).slice(0, 3)
  const jobs: LeadEmailJob[] = found.map((j, i) => ({
    title: j.title,
    company: j.company,
    place: j.place,
    url: `${appUrl()}/api/lead-job/${token}?job=${j.id}&step=${input.step}&v=${input.variant}&pos=${i + 1}`,
  }))
  // The newsletter welcome leads with the latest report (its link counts the click, then opens the report).
  const edition = input.variant === 'newsletter' && welcome ? latestReport() : null
  const report = edition ? { month: edition.month, title: edition.title, dek: edition.dek, url: `${appUrl()}/api/lead-report/${token}?r=${edition.slug}&step=${input.step}` } : null
  // The newsletter reminder leads with the week's layoff notices (the shared, cached copy the layoff pages read; a failed read: none).
  const week = input.variant === 'newsletter' && input.step === 'nudge1' && !input.context.journey ? buildLayoffWeekBrief(await getPublicNotices().catch(() => [])) : null
  const layoffs = week ? { ...week, url: `${appUrl()}/api/lead-report/${token}?r=layoffs-this-week&step=${input.step}` } : null
  const choices = report || layoffs || input.context.journey || input.variant === 'waitlist_b2b' || jobs.length >= 3 ? [] : journeyButtons(email, input.step, input.context.detail)
  const content = leadEmailContent(input.variant, input.step, { ...input.context, choices, jobs, report, layoffs })
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
    if (content.feature) {
      const link = await prisma.crmOutreachLink.create({ data: { trackingId: tracking.id, originalUrl: content.feature.url } })
      content.feature = { ...content.feature, url: `${appUrl()}/api/crm/outreach/click/${link.id}` }
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

  if (!input.test) captureServerEvent(email, 'lead_email_sent', { variant: input.variant, step: input.step, journey: input.context.journey ?? null, journey_choices_shown: !!content.choices?.length, similar_jobs_shown: content.jobs?.length ?? 0, report_shown: content.feature ? (edition?.slug ?? (layoffs ? 'layoffs-this-week' : null)) : null, jobId: input.jobId ?? null })
  return true
}

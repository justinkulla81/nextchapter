import 'server-only'
import { prisma } from '@/lib/prisma'
import { createAdminClient } from '@/lib/supabase/admin'
import { createResend, isUndeliverableAddress } from '@/lib/email/resend-client'
import { getMailingSettings } from '@/lib/mailing/lists'
import { getAccountActivityAdminEmail } from '@/lib/admin/auth'
import { makeUnsubscribeToken } from '@/lib/mailing/unsubscribe-token'
import { captureServerEvent } from '@/lib/posthog/server'
import { LEAD_LIST_KEY } from '@/lib/leads/lifecycle/config'
import { fileLeadInCrm, isInternalAddress } from '@/lib/leads/lifecycle/file-lead'
import LeadLifecycleEmail from '@/emails/lead-lifecycle'
import { registrationStop } from '@/lib/admin/registration-stop'
import {
  ABANDONED_REF_PREFIX,
  LOOKBACK_MS,
  abandonedContent,
  abandonedRef,
  abandonedStartEmailsOn,
  abandonedText,
  dueAbandonedStep,
  type AbandonStep,
} from './abandoned-start'

const appUrl = () => process.env.NEXT_PUBLIC_APP_URL || 'https://launchyournextchapter.com'
const FROM = 'NextChapter <support@launchyournextchapter.com>'
const MAX_SENDS_PER_RUN = 20

export interface AbandonedSummary {
  mode: 'on' | 'dry-run'
  considered: number
  /** Skipped: registered elsewhere, unsubscribed, suppressed, opted out, or covered by another reminder. */
  stopped: number
  due: number
  byStep: Record<AbandonStep, number>
  sent: number
  failed: number
}

const clean = (e: string) => e.trim().toLowerCase()

/**
 * The "pick up where you left off" pass, run with the lead-lifecycle cron. For everyone who started onboarding in the last
 * 14 days, gave an email and did not register: send the one email that is due (two hours after their last activity, or at
 * once for someone who asked for the link, then three days after the first). Sends nothing until ABANDONED_START_EMAILS=1;
 * until then it counts what it would send and writes nothing.
 */
export async function runAbandonedStarts(now = new Date()): Promise<AbandonedSummary> {
  const sendOn = abandonedStartEmailsOn()
  const summary: AbandonedSummary = { mode: sendOn ? 'on' : 'dry-run', considered: 0, stopped: 0, due: 0, byStep: { finish_1: 0, finish_2: 0 }, sent: 0, failed: 0 }

  const profiles = await prisma.candidateProfile.findMany({
    where: {
      createdAt: { gte: new Date(now.getTime() - LOOKBACK_MS) },
      registrationCompletedAt: null,
      passwordSetAt: null,
      // Finished the old assessment: the registration-reminders cron already covers them.
      assessmentComplete: false,
      isSystemAccount: false,
      isSampleData: false,
      reminderEmailsOptedOut: false,
      duplicateEmailBlockedAt: null,
      email: { not: null },
      NOT: { userId: { startsWith: 'demo-' } },
    },
    select: {
      id: true,
      userId: true,
      email: true,
      firstName: true,
      updatedAt: true,
      journeyDetails: true,
      desireComplete: true,
      resumeStepComplete: true,
      lastName: true,
      onboardingResumeConfirmedAt: true,
      onboardingLocationConfirmedAt: true,
      onboardingComfortConfirmedAt: true,
      contractAcceptedAt: true,
      registrationCompletedAt: true,
      introCommittedAt: true,
      duplicateEmailBlockedAt: true,
    },
    take: 500,
  })
  // Someone who has not answered the first question has no journey yet; they only come here by asking for the link.
  const candidates = profiles.filter((p) => p.email && !isInternalAddress(p.email))
  summary.considered = candidates.length
  if (candidates.length === 0) return summary

  const emails = [...new Set(candidates.map((p) => clean(p.email!)))]
  const refs = emails.flatMap((e) => (['finish_1', 'finish_2'] as const).map((s) => abandonedRef(s, e)))
  const [suppressed, members, registered, sentRows, recent] = await Promise.all([
    prisma.mailingSuppression.findMany({ where: { email: { in: emails } }, select: { email: true } }),
    prisma.mailingListMember.findMany({ where: { email: { in: emails }, list: { key: LEAD_LIST_KEY } }, select: { email: true, status: true } }),
    prisma.candidateProfile.findMany({
      where: { OR: [{ registrationCompletedAt: { not: null } }, { passwordSetAt: { not: null } }], email: { in: emails, mode: 'insensitive' } },
      select: { email: true },
    }),
    prisma.crmActivity.findMany({ where: { type: 'EMAIL', sourceRef: { in: refs } }, select: { sourceRef: true, occurredAt: true } }),
    // Any other email from us to this address (lifecycle, nurture or this sequence), for the two-day gap.
    prisma.crmActivity.findMany({
      where: {
        type: 'EMAIL',
        direction: 'OUTBOUND',
        occurredAt: { gte: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000) },
        person: { email: { in: emails } },
        OR: [{ sourceRef: { startsWith: 'lifecycle:' } }, { sourceRef: { startsWith: 'nurture:' } }, { sourceRef: { startsWith: ABANDONED_REF_PREFIX } }],
      },
      select: { occurredAt: true, person: { select: { email: true } } },
    }),
  ])
  const stopList = new Set(suppressed.map((s) => clean(s.email)))
  const offList = new Set(members.filter((m) => m.status !== 'ACTIVE').map((m) => clean(m.email)))
  const registeredEmails = new Set(registered.map((r) => clean(r.email ?? '')))
  const sentAt = new Map(sentRows.map((r) => [r.sourceRef!, r.occurredAt]))
  const lastAny = new Map<string, Date>()
  for (const r of recent) {
    const e = r.person?.email ? clean(r.person.email) : null
    if (e && (!lastAny.get(e) || r.occurredAt > lastAny.get(e)!)) lastAny.set(e, r.occurredAt)
  }

  const seen = new Set<string>()
  let sends = 0
  for (const p of candidates) {
    const email = clean(p.email!)
    if (seen.has(email)) continue // two profiles with one address: the first (newest) is enough
    seen.add(email)
    if (registeredEmails.has(email) || stopList.has(email) || offList.has(email) || isUndeliverableAddress(email)) {
      summary.stopped++
      continue
    }
    const details = (p.journeyDetails ?? {}) as Record<string, unknown>
    const savedRaw = typeof details.saveForLaterAt === 'string' ? new Date(details.saveForLaterAt) : null
    const step = dueAbandonedStep({
      now,
      lastActivityAt: p.updatedAt,
      savedForLaterAt: savedRaw && !Number.isNaN(savedRaw.getTime()) ? savedRaw : null,
      sent: { finish_1: sentAt.get(abandonedRef('finish_1', email)), finish_2: sentAt.get(abandonedRef('finish_2', email)) },
      lastAnyEmailAt: lastAny.get(email) ?? null,
    })
    if (!step) continue
    summary.due++
    summary.byStep[step]++
    if (!sendOn || sends >= MAX_SENDS_PER_RUN) continue
    sends++
    const ok = await sendAbandonedEmail(p, email, step)
    if (ok) summary.sent++
    else summary.failed++
  }
  return summary
}

async function sendAbandonedEmail(
  p: { id: string; userId: string; firstName: string | null } & Parameters<typeof registrationStop>[0],
  email: string,
  step: AbandonStep,
): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) return false
  const personId = await fileLeadInCrm({ email, name: p.firstName, channel: 'Onboarding started' })
  if (!personId) return false

  // A one-tap link back to their place: the same magic link the registration reminder uses, minted for the address they gave.
  const admin = createAdminClient()
  let magicLink: string
  try {
    await admin.auth.admin.updateUserById(p.userId, { email, email_confirm: true })
    const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email, options: { redirectTo: `${appUrl()}/auth/magic-link` } })
    if (error || !data.properties?.action_link) return false
    magicLink = data.properties.action_link
  } catch {
    return false // for example the address already belongs to another sign-in
  }

  const stop = registrationStop(p)
  const copy = abandonedContent(step, p.firstName, stop.path ? stop.label : null)
  const content = { ...copy, benefits: [], footerNote: 'You are getting this because you started your NextChapter profile and left your email.' }

  let activityId: string
  try {
    const activity = await prisma.crmActivity.create({
      data: { type: 'EMAIL', direction: 'OUTBOUND', personId, subject: copy.subject, body: abandonedText(copy, magicLink), isAutoLogged: true, sourceRef: abandonedRef(step, email) },
    })
    activityId = activity.id
  } catch {
    return false // already sent
  }
  const tracking = await prisma.crmOutreachTracking.create({ data: { activityId } })
  const link = await prisma.crmOutreachLink.create({ data: { trackingId: tracking.id, originalUrl: magicLink } })
  const ctaUrl = `${appUrl()}/api/crm/outreach/click/${link.id}`
  const pixelUrl = `${appUrl()}/api/crm/outreach/open/${tracking.id}`
  const unsubscribeUrl = `${appUrl()}/updates/unsubscribe/${makeUnsubscribeToken(email, null)}`

  try {
    const settings = await getMailingSettings()
    const adminCopy = getAccountActivityAdminEmail()
    const resend = createResend(process.env.RESEND_API_KEY, 'candidate')
    const { error } = await resend.emails.send({
      from: FROM,
      to: email,
      ...(adminCopy && adminCopy.toLowerCase() !== email ? { bcc: adminCopy } : {}),
      subject: copy.subject,
      react: LeadLifecycleEmail({ content, ctaUrl, unsubscribeUrl, postalAddress: settings.postalAddress, pixelUrl, audience: 'candidate' }),
      headers: { 'List-Unsubscribe': `<${unsubscribeUrl}>` },
    })
    if (error) throw new Error(error.message)
  } catch (error) {
    console.error('Abandoned-start email failed:', error)
    await prisma.crmActivity.delete({ where: { id: activityId } }).catch(() => {})
    return false
  }
  captureServerEvent(email, 'onboarding_pickup_email_sent', { candidateId: p.id, step, stoppedAt: stop.path, hadName: !!p.firstName })
  return true
}

import 'server-only'
import { prisma } from '@/lib/prisma'
import { createResend, isUndeliverableAddress } from '@/lib/email/resend-client'
import { captureServerEvent } from '@/lib/posthog/server'
import { ALL_STATE_CODES, stateSlug } from '@/lib/seo/states'
import { deadlineEmailsOn, jobAlertDailyCap } from '@/lib/leads/job-alert-config'
import { sentToday } from '@/lib/leads/job-alerts'
import { dueStep, idsThrough, parseLastDay } from '@/lib/tools/layoff-deadlines'
import DeadlineReminderEmail from '@/emails/deadline-reminder'

// Deadline reminders: a HomepageLead of kind deadline_reminders. situation = the last day of work (YYYY-MM-DD),
// searchLoc = the state code or '', followup = the step ids already emailed ("d2,d14"). Double opt-in like the other
// alerts. One email covers the newest due step. Off until DEADLINE_REMINDER_EMAILS=1; off, the run only counts.

const APP_URL = () => process.env.NEXT_PUBLIC_APP_URL || 'https://launchyournextchapter.com'
const FROM = 'NextChapter <support@launchyournextchapter.com>'
const DEADLINE_MS = 240_000

const dayLabel = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })

export interface DeadlineRunSummary {
  enabled: boolean
  confirmedReminders: number
  due: number
  sent: number
  failed: number
  cappedOut: number
}

export async function runDeadlineReminders(): Promise<DeadlineRunSummary> {
  const started = Date.now()
  const enabled = deadlineEmailsOn()
  const leads = await prisma.homepageLead.findMany({
    where: { kind: 'deadline_reminders', confirmedAt: { not: null }, unsubscribedAt: null },
    orderBy: { confirmedAt: 'asc' },
    take: 2000,
    select: { id: true, email: true, unsubscribeToken: true, situation: true, searchLoc: true, followup: true },
  })
  const summary: DeadlineRunSummary = { enabled, confirmedReminders: leads.length, due: 0, sent: 0, failed: 0, cappedOut: 0 }
  let budget = enabled ? Math.max(0, jobAlertDailyCap() - (await sentToday())) : Infinity

  for (const l of leads) {
    if (Date.now() - started > DEADLINE_MS) break
    const lastDay = parseLastDay(l.situation)
    if (!lastDay) continue
    const sent = l.followup.split(',').filter(Boolean)
    const step = dueStep(lastDay, sent)
    if (!step) continue
    summary.due++
    if (!enabled) continue
    if (budget <= 0) {
      summary.cappedOut++
      continue
    }
    if (!process.env.RESEND_API_KEY || isUndeliverableAddress(l.email)) continue
    const stateOk = (ALL_STATE_CODES as readonly string[]).includes(l.searchLoc)
    const unsubscribeUrl = `${APP_URL()}/api/unsubscribe/lead/${l.unsubscribeToken}`
    try {
      const { error } = await createResend(process.env.RESEND_API_KEY, 'candidate').emails.send({
        from: FROM,
        replyTo: 'support@launchyournextchapter.com',
        to: l.email,
        subject: step.title,
        react: DeadlineReminderEmail({
          title: step.title,
          body: step.body,
          context: `Your last day was ${dayLabel(lastDay)}.`,
          stateUrl: stateOk ? `${APP_URL()}/unemployment-benefits/${stateSlug(l.searchLoc)}` : `${APP_URL()}/unemployment-benefits`,
          startUrl: `${APP_URL()}/api/job-alerts/journey/${l.unsubscribeToken}?p=laid-off&via=email`,
          unsubscribeUrl,
        }),
        headers: { 'List-Unsubscribe': `<${unsubscribeUrl}>` },
      })
      if (error) {
        console.error('deadline reminder failed:', error)
        summary.failed++
        continue
      }
      await prisma.homepageLead.update({ where: { id: l.id }, data: { followup: idsThrough(step).join(','), lastAlertAt: new Date() } })
      captureServerEvent(l.email, 'alert_sent', { kind: 'deadline_reminders', step: step.id })
      summary.sent++
      budget--
    } catch (e) {
      console.error('deadline reminder failed:', e)
      summary.failed++
    }
  }
  return summary
}

import 'server-only'
import { prisma } from '@/lib/prisma'
import { createResend, isUndeliverableAddress } from '@/lib/email/resend-client'
import { captureServerEvent } from '@/lib/posthog/server'
import { searchPublicBoard, type PublicBoardJob } from '@/lib/jobs/public-board'
import { getPersona } from '@/lib/constants/personas'
import { inferJourney } from '@/lib/leads/infer-journey'
import { parseScope } from '@/lib/leads/alert-scope'
import { JOB_ALERT_MAX_JOBS, jobAlertDailyCap, jobAlertEmailsOn } from '@/lib/leads/job-alert-config'
import JobAlertConfirmEmail from '@/emails/job-alert-confirm'
import JobAlertDigestEmail from '@/emails/job-alert-digest'

// Saved-search job alerts: a confirmation email (double opt-in), then at most one email a day per person
// with up to five new jobs. No AI. Everything that sends is behind JOB_ALERT_EMAILS=1 and a daily cap.

const APP_URL = () => process.env.NEXT_PUBLIC_APP_URL || 'https://launchyournextchapter.com'
const DAY_MS = 86_400_000
const FROM = 'NextChapter <support@launchyournextchapter.com>'

export interface AlertSearch {
  searchQ: string
  searchLoc: string
  searchRemote: boolean
}

/** "marketing manager in Chicago", "remote jobs", "all new jobs". */
export function searchLabel(s: AlertSearch): string {
  // A job-page alert is about one employer, title or industry: say that, not the prefix.
  const scope = parseScope(s.searchQ)
  if (scope) return scope.kind === 'company' ? `jobs at ${scope.value}` : `${scope.value} jobs`
  const words = s.searchQ.trim()
  const place = s.searchLoc.trim()
  const parts = [words || 'all new jobs']
  if (place) parts.push(`in ${place}`)
  if (s.searchRemote) parts.push(place || words ? '(remote)' : 'remote')
  return parts.join(' ')
}

const startOfDay = () => {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  return d
}

export async function sentToday(): Promise<number> {
  const since = startOfDay()
  const [confirms, alerts] = await Promise.all([
    prisma.homepageLead.count({ where: { kind: { in: ['job_alert', 'layoff_alert', 'pay_check', 'resume_check', 'deadline_reminders', 'course_path'] }, confirmSentAt: { gte: since } } }),
    prisma.homepageLead.count({ where: { kind: { in: ['job_alert', 'layoff_alert', 'pay_check', 'resume_check', 'deadline_reminders', 'course_path'] }, lastAlertAt: { gte: since } } }),
  ])
  return confirms + alerts
}

/** Alert emails that can be confirmed: a saved job search, or a layoff watch. */
export interface ConfirmableLead {
  id: string
  email: string
  unsubscribeToken: string
}

/** Sends the one-time confirmation email. `what` is the phrase after "You asked for". Returns whether it went out. */
export async function sendAlertConfirmation(lead: ConfirmableLead, opts: { what: string; subject: string; enabled: boolean; variant?: 'course_path'; reminder?: boolean }): Promise<boolean> {
  if (!opts.enabled || !process.env.RESEND_API_KEY || isUndeliverableAddress(lead.email)) return false
  if ((await sentToday()) >= jobAlertDailyCap()) return false
  try {
    const { error } = await createResend(process.env.RESEND_API_KEY, 'candidate').emails.send({
      from: FROM,
      replyTo: 'support@launchyournextchapter.com',
      to: lead.email,
      subject: opts.subject,
      react: JobAlertConfirmEmail({
        what: opts.what,
        variant: opts.variant,
        reminder: opts.reminder,
        confirmUrl: `${APP_URL()}/api/job-alerts/confirm/${lead.unsubscribeToken}`,
        unsubscribeUrl: `${APP_URL()}/api/unsubscribe/lead/${lead.unsubscribeToken}`,
      }),
      headers: { 'List-Unsubscribe': `<${APP_URL()}/api/unsubscribe/lead/${lead.unsubscribeToken}>` },
    })
    if (error) {
      console.error('alert confirmation failed:', error)
      return false
    }
    await prisma.homepageLead.update({ where: { id: lead.id }, data: { confirmSentAt: new Date() } })
    captureServerEvent(lead.email, 'alert_confirmation_sent', {})
    return true
  } catch (e) {
    console.error('alert confirmation failed:', e)
    return false
  }
}

/** The confirmation email for a saved job search. */
export function sendJobAlertConfirmation(lead: ConfirmableLead & AlertSearch, reminder = false): Promise<boolean> {
  return sendAlertConfirmation(lead, {
    what: parseScope(lead.searchQ) ? `new ${searchLabel(lead)}` : `new jobs matching ${searchLabel(lead)}`,
    subject: reminder ? `Still want job alerts? ${searchLabel(lead)}` : `Confirm your job alerts: ${searchLabel(lead)}`,
    enabled: jobAlertEmailsOn(),
    reminder,
  })
}

const REMINDER_MIN_DAYS = 2
const REMINDER_MAX_DAYS = 10
export const confirmReminderRef = (leadId: string) => `alert-confirm-reminder:${leadId}`

/**
 * The one follow-up to a job-alert confirmation nobody clicked: two to ten days after it went out, once per saved search.
 * "Once" is the unique CRM email activity (type + sourceRef) logged on the person just before the send and removed if the
 * send fails. Returns how many went out (or would, with job alert emails off).
 */
export async function sendConfirmReminders(limit = 25): Promise<number> {
  const now = Date.now()
  const leads = await prisma.homepageLead.findMany({
    where: {
      kind: 'job_alert',
      confirmedAt: null,
      unsubscribedAt: null,
      confirmSentAt: { gte: new Date(now - REMINDER_MAX_DAYS * DAY_MS), lte: new Date(now - REMINDER_MIN_DAYS * DAY_MS) },
    },
    orderBy: { confirmSentAt: 'asc' },
    take: limit,
    select: { id: true, email: true, unsubscribeToken: true, searchQ: true, searchLoc: true, searchRemote: true },
  })
  const on = jobAlertEmailsOn()
  let count = 0
  for (const lead of leads) {
    const email = lead.email.trim().toLowerCase()
    const person = await prisma.crmPerson.findFirst({ where: { deletedAt: null, OR: [{ email }, { emails: { has: email } }] }, select: { id: true } })
    if (!person) continue
    const sourceRef = confirmReminderRef(lead.id)
    if (await prisma.crmActivity.findFirst({ where: { type: 'EMAIL', sourceRef }, select: { id: true } })) continue
    if (!on) {
      count++
      continue
    }
    let activityId: string
    try {
      const a = await prisma.crmActivity.create({
        data: { type: 'EMAIL', direction: 'OUTBOUND', personId: person.id, subject: 'Still want job alerts? (confirmation reminder)', body: 'One reminder to confirm the job alert, sent once.', isAutoLogged: true, sourceRef },
      })
      activityId = a.id
    } catch {
      continue // another run is sending this one
    }
    if (await sendJobAlertConfirmation(lead, true)) count++
    else await prisma.crmActivity.delete({ where: { id: activityId } }).catch(() => {})
  }
  return count
}

export interface JobAlertRunSummary {
  enabled: boolean
  confirmedSearches: number
  people: number
  peopleWithNewJobs: number
  sent: number
  failed: number
  cappedOut: number
  /** Confirmation reminders sent (or that would go out, with job alert emails off). */
  confirmReminders: number
  sampleJobTitles: string[]
}

const DEADLINE_MS = 240_000

/**
 * The daily run. Finds new jobs for every confirmed, not-unsubscribed saved search, one email per person.
 * With JOB_ALERT_EMAILS off it sends nothing and only reports counts (a dry run, no addresses in the output).
 */
export async function runJobAlerts(): Promise<JobAlertRunSummary> {
  const started = Date.now()
  const enabled = jobAlertEmailsOn()
  const leads = await prisma.homepageLead.findMany({
    where: { kind: 'job_alert', confirmedAt: { not: null }, unsubscribedAt: null },
    orderBy: { confirmedAt: 'asc' },
    take: 2000,
    select: { id: true, email: true, unsubscribeToken: true, searchQ: true, searchLoc: true, searchRemote: true, confirmedAt: true, lastAlertAt: true, journeySlug: true },
  })
  const byEmail = new Map<string, typeof leads>()
  for (const l of leads) byEmail.set(l.email, [...(byEmail.get(l.email) ?? []), l])

  const summary: JobAlertRunSummary = { enabled, confirmedSearches: leads.length, people: byEmail.size, peopleWithNewJobs: 0, sent: 0, failed: 0, cappedOut: 0, confirmReminders: 0, sampleJobTitles: [] }
  const cap = jobAlertDailyCap()
  let budget = enabled ? Math.max(0, cap - (await sentToday())) : Infinity

  for (const [email, group] of byEmail) {
    if (Date.now() - started > DEADLINE_MS) break
    // At most one email a day per person, whichever of their searches matched.
    if (group.some((l) => l.lastAlertAt && Date.now() - l.lastAlertAt.getTime() < DAY_MS - 3_600_000)) continue

    const seen = new Set<string>()
    const jobs: PublicBoardJob[] = []
    for (const l of group) {
      const since = l.lastAlertAt ?? l.confirmedAt!
      const { jobs: found } = await searchPublicBoard({ q: l.searchQ, loc: l.searchLoc, remote: l.searchRemote, since })
      for (const j of found) {
        // Only jobs with a page on our site, so every link lands on the save-this-job box and the lead path.
        if (!j.pagePath || seen.has(j.id)) continue
        seen.add(j.id)
        jobs.push(j)
      }
    }
    if (jobs.length === 0) continue
    summary.peopleWithNewJobs++
    jobs.sort((a, b) => (b.postedAt ?? '').localeCompare(a.postedAt ?? ''))
    const picked = jobs.slice(0, JOB_ALERT_MAX_JOBS)
    if (summary.sampleJobTitles.length < 3) summary.sampleJobTitles.push(picked[0].title)
    if (!enabled) continue
    if (budget <= 0) {
      summary.cappedOut++
      continue
    }
    if (!process.env.RESEND_API_KEY || isUndeliverableAddress(email)) continue

    const primary = group[0]
    const label = group.length === 1 ? searchLabel(primary) : 'your saved searches'
    const guess = inferJourney({ q: primary.searchQ, loc: primary.searchLoc }, primary.journeySlug || null)
    const persona = getPersona(guess.slug)
    const base = `${APP_URL()}/api/job-alerts`
    try {
      const { error } = await createResend(process.env.RESEND_API_KEY, 'candidate').emails.send({
        from: FROM,
        replyTo: 'support@launchyournextchapter.com',
        to: email,
        subject: `${picked.length} new ${picked.length === 1 ? 'job' : 'jobs'}: ${label}`,
        react: JobAlertDigestEmail({
          searchLabel: label,
          jobs: picked.map((j) => ({ title: j.title, company: j.company, location: j.location, href: `${base}/click/${primary.unsubscribeToken}?j=${encodeURIComponent(j.id)}` })),
          startUrl: `${base}/journey/${primary.unsubscribeToken}?p=${encodeURIComponent(guess.slug)}&via=email`,
          startLabel: persona ? 'See how I fit' : 'See how I fit',
          unsubscribeUrl: `${APP_URL()}/api/unsubscribe/lead/${primary.unsubscribeToken}`,
        }),
        headers: { 'List-Unsubscribe': `<${APP_URL()}/api/unsubscribe/lead/${primary.unsubscribeToken}>` },
      })
      if (error) {
        console.error('job alert failed:', error)
        summary.failed++
        continue
      }
      await prisma.homepageLead.updateMany({ where: { id: { in: group.map((l) => l.id) } }, data: { lastAlertAt: new Date() } })
      captureServerEvent(email, 'alert_sent', { jobs: picked.length, searches: group.length })
      summary.sent++
      budget--
    } catch (e) {
      console.error('job alert failed:', e)
      summary.failed++
    }
  }
  summary.confirmReminders = await sendConfirmReminders().catch((e) => {
    console.error('confirm reminders failed:', e)
    return 0
  })
  return summary
}

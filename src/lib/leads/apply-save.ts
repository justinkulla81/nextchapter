'use server'

import { prisma } from '@/lib/prisma'
import { getClientIp } from '@/lib/http/client-ip'
import { allowByIp, allowByTarget, DAY_MS, HOUR_MS } from '@/lib/security/rate-limit'
import { captureServerEvent } from '@/lib/posthog/server'
import { createResend, isUndeliverableAddress } from '@/lib/email/resend-client'
import { getPublicJob } from '@/lib/jobs/public-job-page-server'
import { applySaveEmailOn } from '@/lib/leads/apply-save-config'
import JobSavedEmail from '@/emails/job-saved'
import { cookies } from 'next/headers'
import { addToSavedJobsCookie, SAVED_JOBS_COOKIE, SAVED_JOBS_MAX_AGE_SECONDS } from '@/lib/leads/claim-saved-jobs'
import { isMemberEmail, jobPath } from '@/lib/leads/member-job-link'
import { notifyNewLead } from '@/lib/leads/notify-new-lead'
import { lifecycleEmailsOn } from '@/lib/leads/lifecycle/config'
import { scopeQ, type AlertScopeKind } from '@/lib/leads/alert-scope'
import { sendJobAlertConfirmation } from '@/lib/leads/job-alerts'
import { baseTitle } from '@/lib/seo/job-title-rules'
import { bucketFromIndustryText } from '@/lib/seo/topics'

// "Save this job" on a public job page, no account needed. It stores the email with the job id
// and, only when APPLY_SAVE_EMAIL=1, sends one email: the job, the way back to it, and the way to see how well they fit. One
// email per address per job. Over the daily cap the lead is still saved and the person is told.

export type ApplySaveState = { error?: string; saved?: boolean; emailed?: boolean; email?: string; alerts?: number } | undefined

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const APP_URL = () => process.env.NEXT_PUBLIC_APP_URL || 'https://launchyournextchapter.com'
const GENERIC_ERROR = 'Something went wrong. Try again in a minute.'

const DAILY_CAP = () => {
  const n = Number(process.env.APPLY_SAVE_DAILY_CAP)
  return Number.isFinite(n) && n >= 0 ? n : 100
}

const text = (formData: FormData, k: string, max: number) => ((formData.get(k) as string | null) ?? '').trim().slice(0, max)

export async function saveAppliedJob(_prev: ApplySaveState, formData: FormData): Promise<ApplySaveState> {
  if (text(formData, 'website', 200)) return { saved: true }

  const email = text(formData, 'email', 200).toLowerCase()
  if (!EMAIL.test(email)) return { error: 'Enter a valid email address.', email }
  const rawTrigger = text(formData, 'trigger', 20)
  const trigger = rawTrigger === 'apply_click' || rawTrigger === 'apply_gate' ? rawTrigger : 'save_link'

  if (!(await allowByIp('apply-save', 10, HOUR_MS)) || !(await allowByTarget('apply-save', email, 10, DAY_MS))) {
    return { error: 'Too many requests from this network. Try again later.', email }
  }

  const job = await getPublicJob(text(formData, 'jobId', 60))
  if (!job) return { error: 'That job is no longer listed.', email }

  try {
    const ip = await getClientIp()
    const key = { email, kind: 'apply_save', situation: '', searchQ: job.id, searchLoc: '', searchRemote: false }
    const existing = await prisma.homepageLead.findUnique({
      where: { email_kind_situation_searchQ_searchLoc_searchRemote: key },
      select: { id: true, unsubscribeToken: true, planSentAt: true },
    })
    const lead = existing
      ? await prisma.homepageLead.update({
          where: { id: existing.id },
          data: { unsubscribedAt: null },
          select: { id: true, unsubscribeToken: true, planSentAt: true },
        })
      : await prisma.homepageLead.create({
          data: { ...key, source: 'job_page', followup: trigger, ip },
          select: { id: true, unsubscribeToken: true, planSentAt: true },
        })
    if (!existing) notifyNewLead({ email, channel: 'Saved job', detail: 'job_page' })

    // Alerts ticked in the prompt: new jobs at this employer, with this title, in this industry. The values come from the job,
    // never from the form, so the form can only switch each one on or off. Each is its own saved search; one confirmation email covers them all.
    const wanted: AlertScopeKind[] = (['company', 'title', 'industry'] as const).filter((k) => text(formData, `alert_${k}`, 2) === '1')
    let alerts = 0
    if (wanted.length) {
      const industry = wanted.includes('industry')
        ? bucketFromIndustryText((await prisma.exclusiveJobPosting.findUnique({ where: { id: job.id }, select: { industry: true } }).catch(() => null))?.industry)
        : null
      const values: Record<AlertScopeKind, string | null> = { company: job.companyName, title: baseTitle(job.title) || null, industry, function: null }
      let confirmFor: { id: string; unsubscribeToken: string; searchQ: string } | null = null
      for (const kind of wanted) {
        const value = values[kind]
        if (!value) continue
        const alertKey = { email, kind: 'job_alert', situation: '', searchQ: scopeQ(kind, value), searchLoc: '', searchRemote: false }
        const have = await prisma.homepageLead.findUnique({
          where: { email_kind_situation_searchQ_searchLoc_searchRemote: alertKey },
          select: { id: true, unsubscribeToken: true, confirmedAt: true },
        })
        const row = have
          ? await prisma.homepageLead.update({ where: { id: have.id }, data: { unsubscribedAt: null }, select: { id: true, unsubscribeToken: true, confirmedAt: true } })
          : await prisma.homepageLead.create({ data: { ...alertKey, source: 'job_page', ip }, select: { id: true, unsubscribeToken: true, confirmedAt: true } })
        alerts++
        if (!row.confirmedAt && !confirmFor) confirmFor = { id: row.id, unsubscribeToken: row.unsubscribeToken, searchQ: alertKey.searchQ }
        captureServerEvent(email, 'alert_subscribed', { source: 'job_page', scope: kind, jobId: job.id, returning: !!have })
      }
      // Alerts need the click in one email (double opt-in); the confirm link switches on every alert this page saved for the address.
      if (confirmFor) await sendJobAlertConfirmation({ ...confirmFor, email, searchLoc: '', searchRemote: false })
    }

    let emailed = false
    // With the lifecycle emails on, the welcome (which names the saved job) replaces this one, so a save never sends two.
    if (applySaveEmailOn() && !lifecycleEmailsOn() && !lead.planSentAt && process.env.RESEND_API_KEY && !isUndeliverableAddress(email)) {
      const startOfDay = new Date()
      startOfDay.setUTCHours(0, 0, 0, 0)
      const sentToday = await prisma.homepageLead.count({ where: { kind: 'apply_save', planSentAt: { gte: startOfDay } } })
      if (sentToday < DAILY_CAP()) {
        try {
          const unsubscribeUrl = `${APP_URL()}/api/unsubscribe/lead/${lead.unsubscribeToken}`
          const { error } = await createResend(process.env.RESEND_API_KEY, 'candidate').emails.send({
            from: 'NextChapter <support@launchyournextchapter.com>',
            replyTo: 'support@launchyournextchapter.com',
            to: email,
            subject: `Saved: ${job.title} at ${job.companyName}`,
            react: JobSavedEmail({
              title: job.title,
              company: job.companyName,
              jobUrl: `${APP_URL()}${jobPath(job.id, await isMemberEmail(email), 'saved_link')}`,
              fitUrl: `${APP_URL()}/onboarding/desire?from=saved_job`,
              unsubscribeUrl,
            }),
            headers: { 'List-Unsubscribe': `<${unsubscribeUrl}>` },
          })
          if (error) {
            console.error('job saved email failed:', error)
          } else {
            await prisma.homepageLead.update({ where: { id: lead.id }, data: { planSentAt: new Date() } })
            emailed = true
          }
        } catch (e) {
          console.error('job saved email failed:', e)
        }
      }
    }

    // Remember the job on this browser too, so it follows the person into an account made with another email.
    try {
      const jar = await cookies()
      jar.set(SAVED_JOBS_COOKIE, addToSavedJobsCookie(jar.get(SAVED_JOBS_COOKIE)?.value, job.id), { httpOnly: true, sameSite: 'lax', secure: true, path: '/', maxAge: SAVED_JOBS_MAX_AGE_SECONDS })
    } catch (e) {
      console.error('saved jobs cookie failed:', e)
    }

    captureServerEvent(email, 'lead_captured', { kind: 'apply_save', source: 'job_page', trigger, jobId: job.id, company: job.companyName, emailed, alerts, returning: !!existing })
    return { saved: true, emailed, email, alerts }
  } catch (error) {
    console.error('apply save failed:', error instanceof Error ? error.message : error)
    return { error: GENERIC_ERROR, email }
  }
}

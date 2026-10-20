'use server'

import { prisma } from '@/lib/prisma'
import { getClientIp } from '@/lib/http/client-ip'
import { allowByIp, allowByTarget, DAY_MS, HOUR_MS } from '@/lib/security/rate-limit'
import { captureServerEvent } from '@/lib/posthog/server'
import { createResend, isUndeliverableAddress } from '@/lib/email/resend-client'
import { PERSONAS } from '@/lib/constants/personas'
import { planFor } from '@/lib/leads/first-week-plans'
import { cleanPublicQuery } from '@/lib/jobs/public-board'
import JourneyPlanEmail from '@/emails/journey-plan'

// Homepage lead capture, no account needed. Two forms:
//  - the journey picker: where you are in your search, and a one-time first-week plan email
//    (the whole cost is one email per new address, at most one a week; no AI)
//  - a saved job search on /jobs: stored for the alert emails, which are off. Nothing is
//    sent for it yet.

export type JourneyState = { error?: string; done?: boolean; email?: string; slug?: string; capped?: boolean } | undefined
export type SavedSearchState = { error?: string; saved?: boolean; email?: string } | undefined

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const FOLLOWUPS = new Set(['just_starting', 'weeks', 'months', 'long'])
const APP_URL = () => process.env.NEXT_PUBLIC_APP_URL || 'https://launchyournextchapter.com'
const GENERIC_ERROR = 'Something went wrong. Try again in a minute.'

// The Resend plan shares one daily limit (100 on the free tier) with every email the product
// sends: digests, briefings, candidate mail. Plan emails get a slice of it, so a busy day of
// signups can never crowd out the rest. Over the cap the lead is still saved (planSentAt stays
// null) and the person is told, so no one is promised an email that will not come.
const PLAN_DAILY_CAP = () => {
  const n = Number(process.env.JOURNEY_PLAN_DAILY_CAP)
  return Number.isFinite(n) && n >= 0 ? n : 25
}

const text = (formData: FormData, k: string, max: number) => ((formData.get(k) as string | null) ?? '').trim().slice(0, max)

export async function submitJourneyLead(_prev: JourneyState, formData: FormData): Promise<JourneyState> {
  // A field real people never see: filled in means a bot. Answer as success, store nothing.
  if (text(formData, 'website', 200)) return { done: true }

  const email = text(formData, 'email', 200).toLowerCase()
  const persona = PERSONAS.find((p) => p.slug === text(formData, 'situation', 60))
  const followupRaw = text(formData, 'followup', 20)
  const followup = FOLLOWUPS.has(followupRaw) ? followupRaw : ''
  if (!persona) return { error: 'Pick the one that sounds most like you.', email }
  if (!EMAIL.test(email)) return { error: 'Enter a valid email address.', email }

  if (!(await allowByIp('journey-lead', 8, HOUR_MS)) || !(await allowByTarget('journey-lead', email, 3, DAY_MS))) {
    return { error: 'Too many requests from this network. Try again later.', email }
  }

  try {
    const ip = await getClientIp()
    const key = { email, kind: 'journey', situation: persona.slug, searchQ: '', searchLoc: '', searchRemote: false }
    const existing = await prisma.homepageLead.findUnique({
      where: { email_kind_situation_searchQ_searchLoc_searchRemote: key },
      select: { id: true, unsubscribeToken: true, planSentAt: true, unsubscribedAt: true },
    })
    const lead = existing
      ? await prisma.homepageLead.update({
          where: { id: existing.id },
          data: { followup, unsubscribedAt: null },
          select: { id: true, unsubscribeToken: true, planSentAt: true },
        })
      : await prisma.homepageLead.create({
          data: { ...key, source: 'home', followup, ip },
          select: { id: true, unsubscribeToken: true, planSentAt: true },
        })

    // One plan email per address per week, whichever situation they picked, and never to a
    // plan already sent for this one. Sending is best effort: a failure keeps the lead.
    let emailed = false
    const weekAgo = new Date(Date.now() - 7 * DAY_MS)
    const recentlySent = await prisma.homepageLead.count({
      where: { email, kind: 'journey', planSentAt: { gte: weekAgo } },
    })
    let capped = false
    if (!lead.planSentAt && recentlySent === 0 && process.env.RESEND_API_KEY && !isUndeliverableAddress(email)) {
      const startOfDay = new Date()
      startOfDay.setUTCHours(0, 0, 0, 0)
      const sentToday = await prisma.homepageLead.count({ where: { kind: 'journey', planSentAt: { gte: startOfDay } } })
      capped = sentToday >= PLAN_DAILY_CAP()
    }
    if (!capped && !lead.planSentAt && recentlySent === 0 && process.env.RESEND_API_KEY && !isUndeliverableAddress(email)) {
      try {
        const plan = planFor(persona.slug)
        const unsubscribeUrl = `${APP_URL()}/api/unsubscribe/lead/${lead.unsubscribeToken}`
        const { error } = await createResend(process.env.RESEND_API_KEY, 'candidate').emails.send({
          from: 'NextChapter <support@launchyournextchapter.com>',
          replyTo: 'support@launchyournextchapter.com',
          to: email,
          subject: `Your first week: ${persona.label}`,
          react: JourneyPlanEmail({
            situationLabel: persona.label,
            intro: plan.intro,
            steps: plan.steps,
            startUrl: `${APP_URL()}/start/${persona.slug}`,
            unsubscribeUrl,
          }),
          headers: { 'List-Unsubscribe': `<${unsubscribeUrl}>` },
        })
        if (error) {
          console.error('journey plan email failed:', error)
        } else {
          await prisma.homepageLead.update({ where: { id: lead.id }, data: { planSentAt: new Date() } })
          emailed = true
        }
      } catch (e) {
        console.error('journey plan email failed:', e)
      }
    }

    captureServerEvent(email, 'journey_lead_submitted', { situation: persona.slug, followup, emailed, capped, returning: !!existing })
    return { done: true, email, slug: persona.slug, capped }
  } catch (error) {
    console.error('journey lead failed:', error instanceof Error ? error.message : error)
    return { error: GENERIC_ERROR, email }
  }
}

export async function saveJobSearchAlert(_prev: SavedSearchState, formData: FormData): Promise<SavedSearchState> {
  if (text(formData, 'website', 200)) return { saved: true }

  const email = text(formData, 'email', 200).toLowerCase()
  if (!EMAIL.test(email)) return { error: 'Enter a valid email address.', email }
  const query = cleanPublicQuery({ q: text(formData, 'q', 100), loc: text(formData, 'loc', 100), remote: text(formData, 'remote', 5) })

  if (!(await allowByIp('job-alert', 10, HOUR_MS)) || !(await allowByTarget('job-alert', email, 5, DAY_MS))) {
    return { error: 'Too many requests from this network. Try again later.', email }
  }

  try {
    const ip = await getClientIp()
    const key = { email, kind: 'job_alert', situation: '', searchQ: query.q.toLowerCase(), searchLoc: query.loc.toLowerCase(), searchRemote: query.remote }
    const existing = await prisma.homepageLead.findUnique({
      where: { email_kind_situation_searchQ_searchLoc_searchRemote: key },
      select: { id: true },
    })
    if (existing) {
      await prisma.homepageLead.update({ where: { id: existing.id }, data: { unsubscribedAt: null } })
    } else {
      await prisma.homepageLead.create({ data: { ...key, source: 'jobs', ip } })
    }
    captureServerEvent(email, 'job_alert_signup_submitted', { q: query.q, loc: query.loc, remote: query.remote, returning: !!existing })
    return { saved: true, email }
  } catch (error) {
    console.error('job alert signup failed:', error instanceof Error ? error.message : error)
    return { error: GENERIC_ERROR, email }
  }
}
